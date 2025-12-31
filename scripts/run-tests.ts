import assert from "assert";
import dotenv from "dotenv";
import { Prisma } from "@prisma/client";
import { computeDedupeKey, normalizeDirectPayload } from "../src/services/eventNormalization";
import { sha256Hex } from "../src/utils/hash";
import { prisma } from "../src/config/database";
import { ingestEvent } from "../src/services/eventsService";
import { processPendingDeliveries } from "../src/services/deliveryService";
import { registerAdapter } from "../src/adapters";
import { Adapter } from "../src/adapters/types";

dotenv.config();

type TestCase = {
  name: string;
  run: () => Promise<void> | void;
};

const tests: TestCase[] = [];

const test = (name: string, run: TestCase["run"]) => {
  tests.push({ name, run });
};

const canRunIntegration = async () => {
  if (!process.env.DATABASE_URL) {
    return false;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

const createProject = async (name: string) => {
  return prisma.project.create({
    data: {
      name,
      description: "test project",
      domain: "example.test"
    }
  });
};

const cleanupProject = async (projectId: string) => {
  await prisma.$transaction([
    prisma.deliveryLog.deleteMany({ where: { event: { projectId } } }),
    prisma.destinationRule.deleteMany({
      where: { destination: { projectId } }
    }),
    prisma.destination.deleteMany({ where: { projectId } }),
    prisma.event.deleteMany({ where: { projectId } }),
    prisma.stageDefinition.deleteMany({ where: { projectId } }),
    prisma.source.deleteMany({ where: { projectId } }),
    prisma.apiKey.deleteMany({ where: { projectId } }),
    prisma.projectMember.deleteMany({ where: { projectId } }),
    prisma.project.deleteMany({ where: { id: projectId } })
  ]);
};

test("dedupe key stable for property ordering", () => {
  const payloadA = {
    event_name: "booking_confirmed",
    properties: { a: 1, b: 2 },
    actor: { email: "user@example.com" }
  };
  const payloadB = {
    event_name: "booking_confirmed",
    properties: { b: 2, a: 1 },
    actor: { email: "user@example.com" }
  };
  const normA = normalizeDirectPayload(payloadA, "direct");
  const normB = normalizeDirectPayload(payloadB, "direct");
  assert.ok(normA && normB);
  const keyA = computeDedupeKey("prj_test", normA);
  const keyB = computeDedupeKey("prj_test", normB);
  assert.strictEqual(keyA, keyB);
});

test("event_id dedupe uses projectId + event_id", () => {
  const payload = {
    event_name: "booking_confirmed",
    event_id: "evt_123",
    actor: { email: "user@example.com" }
  };
  const normalized = normalizeDirectPayload(payload, "direct");
  assert.ok(normalized);
  const expected = `sha256:${sha256Hex("prj_test:evt_123")}`;
  const key = computeDedupeKey("prj_test", normalized);
  assert.strictEqual(key, expected);
});

test("legacy payload preserves properties and maps actor/value", () => {
  const payload = {
    event_name: "legacy_event",
    user: { email: "user@example.com", phone: "+123" },
    data: { value: 99, currency: "USD" },
    provider_id: "abc123"
  };
  const normalized = normalizeDirectPayload(payload, "direct");
  assert.ok(normalized);
  const data = normalized.dataJson as Record<string, unknown>;
  assert.strictEqual(normalized.actorEmail, "user@example.com");
  assert.strictEqual(normalized.actorPhone, "+123");
  assert.strictEqual(normalized.valueAmount, 99);
  assert.strictEqual(normalized.valueCurrency, "USD");
  assert.strictEqual(data.provider_id, "abc123");
});

const mockAdapter: Adapter = {
  key: "mock",
  validateConfig: () => ({ ok: true }),
  validateRule: () => ({ ok: true }),
  compile: ({ event }) => ({
    providerEventName: event.eventName,
    providerRequest: { eventId: event.eventId }
  }),
  send: async (_request, config) => {
    const mode = (config as any)?.mode;
    if (mode === "client_fail") {
      return { ok: false, status: 400, json: { error: "bad_request" }, errorText: "bad_request" };
    }
    if (mode === "fail") {
      return { ok: false, status: 500, json: { error: "fail" }, errorText: "fail" };
    }
    return { ok: true, status: 200, json: { ok: true } };
  }
};

const runIntegrationTests = async () => {
  registerAdapter(mockAdapter);

  // Idempotent ingest and DeliveryLog dedupe
  await (async () => {
    const project = await createProject("itest_ingest");
    try {
      const destination = await prisma.destination.create({
        data: {
          projectId: project.id,
          type: "mock",
          adapterKey: "mock",
          config: { mode: "ok" } as Prisma.InputJsonValue,
          isActive: true,
          isEnabled: true,
          healthStatus: "OK"
        }
      });

      await prisma.destinationRule.create({
        data: {
          destinationId: destination.id,
          name: "rule-1",
          isEnabled: true,
          priority: 10,
          match: { event_name: ["booking_confirmed"] } as Prisma.InputJsonValue,
          action: {
            providerEventName: "Booking",
            fieldMapping: { event_time: "eventTime" }
          } as Prisma.InputJsonValue
        }
      });

      const payload = {
        event_name: "booking_confirmed",
        event_id: "evt_1",
        user: { email: "user@example.com" },
        data: { value: 10, currency: "USD" }
      };

      await ingestEvent(project.id, payload as any);
      await ingestEvent(project.id, payload as any);

      const eventCount = await prisma.event.count({ where: { projectId: project.id } });
      const deliveryCount = await prisma.deliveryLog.count({
        where: { event: { projectId: project.id } }
      });
      assert.strictEqual(eventCount, 1);
      assert.strictEqual(deliveryCount, 1);

      const payloadNoId = {
        event_name: "booking_confirmed",
        user: { email: "user@example.com" },
        data: { value: 10, currency: "USD" }
      };

      await ingestEvent(project.id, payloadNoId as any);
      await ingestEvent(project.id, payloadNoId as any);

      const eventCountAfter = await prisma.event.count({ where: { projectId: project.id } });
      assert.strictEqual(eventCountAfter, 2);

      const rules = await prisma.destinationRule.create({
        data: {
          destinationId: destination.id,
          name: "rule-2",
          isEnabled: true,
          priority: 20,
          match: { event_name: ["multi_rule"] } as Prisma.InputJsonValue,
          action: {
            providerEventName: "RuleTwo",
            fieldMapping: { event_time: "eventTime" }
          } as Prisma.InputJsonValue
        }
      });

      const payloadMulti = {
        event_name: "multi_rule",
        event_id: "evt_multi",
        user: { email: "user@example.com" },
        data: { value: 10, currency: "USD" }
      };

      const result = (await ingestEvent(project.id, payloadMulti as any)) as any;
      const event = await prisma.event.findFirst({ where: { id: result.eventId } });
      assert.ok(event);
      const deliveryLogs = await prisma.deliveryLog.findMany({
        where: { eventId: event!.id }
      });
      assert.strictEqual(deliveryLogs.length, 2);
      assert.ok(rules.id);
    } finally {
      await cleanupProject(project.id);
    }
  })();

  // Delivery engine concurrency and retries
  await (async () => {
    const project = await createProject("itest_delivery");
    try {
      const destination = await prisma.destination.create({
        data: {
          projectId: project.id,
          type: "mock",
          adapterKey: "mock",
          config: { mode: "fail" } as Prisma.InputJsonValue,
          deliveryPolicy: {
            maxAttempts: 2,
            baseBackoffSeconds: 1,
            maxBackoffSeconds: 4,
            jitterRatio: 0
          } as Prisma.InputJsonValue,
          isActive: true,
          isEnabled: true,
          healthStatus: "OK"
        }
      });

      await prisma.destinationRule.create({
        data: {
          destinationId: destination.id,
          name: "rule-1",
          isEnabled: true,
          priority: 10,
          match: { event_name: ["delivery_test"] } as Prisma.InputJsonValue,
          action: {
            providerEventName: "Delivery",
            fieldMapping: { event_time: "eventTime" }
          } as Prisma.InputJsonValue
        }
      });

      const payload = {
        event_name: "delivery_test",
        event_id: "evt_delivery",
        user: { email: "user@example.com" }
      };

      await ingestEvent(project.id, payload as any);

      const concurrent = await Promise.all([
        processPendingDeliveries({ limit: 1 }),
        processPendingDeliveries({ limit: 1 })
      ]);
      const claimedTotal = concurrent.reduce((sum, item) => sum + item.claimed, 0);
      assert.strictEqual(claimedTotal, 1);

      let log = await prisma.deliveryLog.findFirst({
        where: { event: { projectId: project.id } },
        orderBy: { createdAt: "desc" }
      });
      assert.ok(log);
      assert.strictEqual(log?.status, "RETRYING");
      assert.strictEqual(log?.attemptCount, 1);

      await prisma.deliveryLog.update({
        where: { id: log!.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) }
      });

      await processPendingDeliveries({ limit: 1 });
      log = await prisma.deliveryLog.findFirst({
        where: { id: log!.id }
      });
      assert.ok(log);
      assert.strictEqual(log?.attemptCount, 2);
      assert.strictEqual(log?.status, "DEAD");

      const claimAgain = await processPendingDeliveries({ limit: 1 });
      assert.strictEqual(claimAgain.claimed, 0);
    } finally {
      await cleanupProject(project.id);
    }
  })();
};

const run = async () => {
  let failed = 0;
  for (const testCase of tests) {
    try {
      await testCase.run();
      console.log(`ok - ${testCase.name}`);
    } catch (err: any) {
      failed += 1;
      console.error(`not ok - ${testCase.name}`);
      console.error(err?.stack || err);
    }
  }

  const integration = await canRunIntegration();
  if (!integration) {
    console.log("skipped - integration tests (no database connection)");
  } else {
    try {
      await runIntegrationTests();
      console.log("ok - integration tests");
    } catch (err: any) {
      failed += 1;
      console.error("not ok - integration tests");
      console.error(err?.stack || err);
    }
  }

  await prisma.$disconnect();
  if (failed > 0) {
    process.exit(1);
  }
};

run().catch((err) => {
  console.error(err);
  prisma.$disconnect().finally(() => process.exit(1));
});
