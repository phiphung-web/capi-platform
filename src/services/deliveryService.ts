import { Prisma } from "@prisma/client";
import crypto from "crypto";
import prisma from "../config/database";
import { getAdapter } from "../adapters";

const LOCK_TIMEOUT_MS = 15 * 60 * 1000;

type ProcessOptions = {
  destinationId?: string;
  limit?: number;
  dryRun?: boolean;
};

type ProcessCounts = {
  success: number;
  retrying: number;
  failed: number;
  dead: number;
};

const parseDeliveryPolicy = (policy: unknown) => {
  const defaults = {
    maxAttempts: 8,
    baseBackoffSeconds: 5,
    maxBackoffSeconds: 3600,
    jitterRatio: 0.2
  };
  if (!policy || typeof policy !== "object") return defaults;
  const record = policy as Record<string, unknown>;
  return {
    maxAttempts:
      typeof record.maxAttempts === "number" ? record.maxAttempts : defaults.maxAttempts,
    baseBackoffSeconds:
      typeof record.baseBackoffSeconds === "number"
        ? record.baseBackoffSeconds
        : defaults.baseBackoffSeconds,
    maxBackoffSeconds:
      typeof record.maxBackoffSeconds === "number"
        ? record.maxBackoffSeconds
        : defaults.maxBackoffSeconds,
    jitterRatio:
      typeof record.jitterRatio === "number" ? record.jitterRatio : defaults.jitterRatio
  };
};

const computeBackoff = (attempt: number, policy: ReturnType<typeof parseDeliveryPolicy>) => {
  const base = policy.baseBackoffSeconds * Math.pow(2, Math.max(0, attempt - 1));
  const capped = Math.min(base, policy.maxBackoffSeconds);
  const jitter = capped * policy.jitterRatio * (Math.random() * 2 - 1);
  const delaySeconds = Math.max(1, Math.round(capped + jitter));
  return delaySeconds;
};

const toJsonValue = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
};

const buildLegacyRule = (destinationId: string): Prisma.DestinationRuleGetPayload<{}> => {
  return {
    id: `legacy_${destinationId}`,
    destinationId,
    name: "Legacy",
    isEnabled: true,
    priority: 0,
    match: {},
    action: {},
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

const claimDeliveries = async (options: ProcessOptions) => {
  const limit = options.limit ?? 20;
  const now = new Date();
  const lockExpiredAt = new Date(Date.now() - LOCK_TIMEOUT_MS);
  const lockId = crypto.randomUUID();

  const destinationFilter = options.destinationId
    ? Prisma.sql`AND "destinationId" = ${options.destinationId}`
    : Prisma.empty;

  const claimQuery = Prisma.sql`
    WITH cte AS (
      SELECT "id"
      FROM "DeliveryLog"
      WHERE (
        "status" = 'PENDING'
        OR ("status" = 'RETRYING' AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now}))
        OR ("status" = 'PROCESSING' AND "processingLockedAt" <= ${lockExpiredAt})
      )
      ${destinationFilter}
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "DeliveryLog"
    SET "status" = 'PROCESSING',
        "processingLockId" = ${lockId},
        "processingLockedAt" = ${now},
        "attemptCount" = "attemptCount" + 1,
        "lastAttemptAt" = ${now}
    FROM cte
    WHERE "DeliveryLog"."id" = cte.id
    RETURNING "DeliveryLog"."id";
  `;

  const claimed = await prisma.$queryRaw<{ id: string }[]>(claimQuery);
  return { lockId, claimedIds: claimed.map((row) => row.id) };
};

export async function processPendingDeliveries(options: ProcessOptions = {}) {
  const now = new Date();
  const lockExpiredAt = new Date(Date.now() - LOCK_TIMEOUT_MS);
  const limit = options.limit ?? 20;

  const baseWhere: Prisma.DeliveryLogWhereInput = {
    OR: [
      { status: "PENDING" },
      { status: "RETRYING", nextAttemptAt: { lte: now } },
      { status: "RETRYING", nextAttemptAt: null },
      { status: "PROCESSING", processingLockedAt: { lte: lockExpiredAt } }
    ]
  };

  if (options.destinationId) {
    baseWhere.destinationId = options.destinationId;
  }

  if (options.dryRun) {
    const eligible = await prisma.deliveryLog.count({ where: baseWhere });
    return {
      claimed: eligible,
      processed: { success: 0, retrying: 0, failed: 0, dead: 0 }
    };
  }

  const { claimedIds } = await claimDeliveries({ destinationId: options.destinationId, limit });

  if (claimedIds.length === 0) {
    return {
      claimed: 0,
      processed: { success: 0, retrying: 0, failed: 0, dead: 0 }
    };
  }

  const logs = await prisma.deliveryLog.findMany({
    where: { id: { in: claimedIds } },
    include: { event: true, destination: true, destinationRule: true }
  });

  const processed: ProcessCounts = { success: 0, retrying: 0, failed: 0, dead: 0 };

  for (const log of logs) {
    const destination = log.destination;
    const event = log.event;
    const rule = log.destinationRule ?? buildLegacyRule(log.destinationId);
    const adapter = getAdapter(destination.adapterKey);

    if (!adapter) {
      await prisma.deliveryLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          lastError: "unknown_adapter",
          processingLockId: null,
          processingLockedAt: null
        }
      });
      processed.failed += 1;
      continue;
    }

    if (!destination.isActive || !destination.isEnabled) {
      await prisma.deliveryLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          lastError: "destination_disabled",
          processingLockId: null,
          processingLockedAt: null
        }
      });
      processed.failed += 1;
      continue;
    }

    const configCheck = adapter.validateConfig(destination.config);
    if (!configCheck.ok) {
      await prisma.deliveryLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          lastError: `invalid_config:${(configCheck.errors || []).join(",")}`,
          processingLockId: null,
          processingLockedAt: null
        }
      });
      processed.failed += 1;
      continue;
    }

    const ruleCheck = adapter.validateRule(rule);
    if (!ruleCheck.ok) {
      await prisma.deliveryLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          lastError: `invalid_rule:${(ruleCheck.errors || []).join(",")}`,
          processingLockId: null,
          processingLockedAt: null
        }
      });
      processed.failed += 1;
      continue;
    }

    const compileResult = adapter.compile({ event, rule, destination });
    if (compileResult.dropReason) {
      await prisma.deliveryLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          lastError: compileResult.dropReason,
          providerRequest: toJsonValue(compileResult.providerRequest),
          processingLockId: null,
          processingLockedAt: null
        }
      });
      processed.failed += 1;
      continue;
    }

    const policy = parseDeliveryPolicy(destination.deliveryPolicy);
    const providerRequest = compileResult.providerRequest;
    const sendResult = await adapter.send(providerRequest, destination.config);

    if (sendResult.ok) {
      await prisma.deliveryLog.update({
        where: { id: log.id },
        data: {
          status: "SUCCESS",
          providerStatusCode: sendResult.status ?? null,
          providerResponse: toJsonValue(sendResult.json),
          providerRequest: toJsonValue(providerRequest),
          deliveredAt: new Date(),
          processingLockId: null,
          processingLockedAt: null,
          nextAttemptAt: null
        }
      });
      processed.success += 1;
      continue;
    }

    const attempt = log.attemptCount;
    const isClientError =
      typeof sendResult.status === "number" && sendResult.status >= 400 && sendResult.status < 500;
    const shouldStop = attempt >= policy.maxAttempts || isClientError;

    if (shouldStop) {
      await prisma.deliveryLog.update({
        where: { id: log.id },
        data: {
          status: attempt >= policy.maxAttempts ? "DEAD" : "FAILED",
          providerStatusCode: sendResult.status ?? null,
          providerResponse: toJsonValue(sendResult.json),
          providerRequest: toJsonValue(providerRequest),
          lastError: sendResult.errorText ? sendResult.errorText.slice(0, 2000) : "send_failed",
          processingLockId: null,
          processingLockedAt: null,
          nextAttemptAt: null
        }
      });
      if (attempt >= policy.maxAttempts) {
        processed.dead += 1;
      } else {
        processed.failed += 1;
      }
      continue;
    }

    const delaySeconds = computeBackoff(attempt, policy);
    const nextAttemptAt = new Date(Date.now() + delaySeconds * 1000);

    await prisma.deliveryLog.update({
      where: { id: log.id },
      data: {
        status: "RETRYING",
        providerStatusCode: sendResult.status ?? null,
        providerResponse: toJsonValue(sendResult.json),
        providerRequest: toJsonValue(providerRequest),
        lastError: sendResult.errorText ? sendResult.errorText.slice(0, 2000) : "send_failed",
        nextAttemptAt,
        processingLockId: null,
        processingLockedAt: null
      }
    });
    processed.retrying += 1;
  }

  return { claimed: claimedIds.length, processed };
}
