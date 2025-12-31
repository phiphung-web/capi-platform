import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { InternalEvent } from "../types/internalEvent";
import {
  computeDedupeKey,
  normalizeDirectPayload,
  NormalizedEventInput
} from "./eventNormalization";
import { planDeliveryLogsForEvent } from "./deliveryPlanner";

export type DirectEventPayload = {
  mode: "direct";
  event_name: string;
  event_id?: string;
  event_time?: number;
  source: string;
  source_id?: string;
  user?: Record<string, unknown>;
  data?: Record<string, unknown>;
  raw_payload?: unknown;
};

export type UniversalEventPayload = {
  event_name: string;
  event_id?: string;
  event_time?: number | string;
  stage?: string;
  occurred_at?: string;
  actor?: Record<string, unknown>;
  object?: Record<string, unknown>;
  value?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  user?: Record<string, unknown>;
  data?: Record<string, unknown>;
  raw_payload?: unknown;
  source?: string;
  source_id?: string;
};

export type MappedEventPayload = {
  mode: "mapped";
  event_key: string;
  payload: Record<string, unknown>;
};

export type IngestPayload =
  | DirectEventPayload
  | MappedEventPayload
  | UniversalEventPayload;

type SimpleMapping = {
  event_name: string;
  source_tag?: string;
  user?: Record<string, string>;
  data?: Record<string, string>;
  meta?: Record<string, string>;
};

const isNonEmptyString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0;

const computeQuality = (input: {
  eventId?: string;
  eventTime?: number;
  user: Record<string, unknown>;
  data: Record<string, unknown>;
}) => {
  let score = 0;
  const flags: Record<string, boolean> = {};

  const email = typeof (input.user as any).email === "string" ? (input.user as any).email : null;
  const phone = typeof (input.user as any).phone === "string" ? (input.user as any).phone : null;
  const currency =
    typeof (input.data as any).currency === "string" ? (input.data as any).currency : null;

  if (isNonEmptyString(email)) {
    score += 0.35;
  } else {
    flags.missing_email = true;
  }

  if (isNonEmptyString(phone)) {
    score += 0.35;
  } else {
    flags.missing_phone = true;
  }

  if (isNonEmptyString(input.eventId)) {
    score += 0.1;
  } else {
    flags.missing_event_id = true;
  }

  if (typeof input.eventTime === "number") {
    score += 0.1;
  } else {
    flags.missing_event_time = true;
  }

  if ((input.data as any).value !== undefined) {
    score += 0.05;
  } else {
    flags.missing_value = true;
  }

  if (isNonEmptyString(currency)) {
    score += 0.05;
  } else {
    flags.missing_currency = true;
  }

  return {
    score: Math.round(Math.min(1, score) * 100),
    flags: Object.keys(flags).length > 0 ? flags : null,
  };
};

export const listEvents = async (): Promise<InternalEvent[]> => {
  return [];
};

export const getActiveApiKey = async (key: string) => {
  const apiKey = await prisma.apiKey.findFirst({
    where: { key, isActive: true }
  });

  if (!apiKey) {
    return null;
  }

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() }
  });

  return apiKey;
};

export const validateDirectEventPayload = (payload: any): string | null => {
  if (!payload) return "invalid_payload";
  if (payload.mode && payload.mode !== "direct") {
    return "invalid_mode";
  }
  if (!isNonEmptyString(payload.event_name)) {
    return "invalid_payload";
  }
  return null;
};

const validateMappedEventPayload = (payload: any): string | null => {
  if (!payload || payload.mode !== "mapped") {
    return "invalid_mode";
  }

  if (!isNonEmptyString(payload.event_key)) {
    return "invalid_event_key";
  }

  if (!payload.payload || typeof payload.payload !== "object") {
    return "invalid_payload";
  }

  return null;
};

const applySimpleMapping = (
  payload: Record<string, unknown>,
  mapping: SimpleMapping
) => {
  const user: Record<string, unknown> = {};
  const data: Record<string, unknown> = {};
  const meta: Record<string, unknown> = {};

  if (mapping.user) {
    for (const [internalKey, sourceKey] of Object.entries(mapping.user)) {
      if (sourceKey in payload) {
        user[internalKey] = payload[sourceKey];
      }
    }
  }

  if (mapping.data) {
    for (const [internalKey, sourceKey] of Object.entries(mapping.data)) {
      if (sourceKey in payload) {
        data[internalKey] = payload[sourceKey];
      }
    }
  }

  if (mapping.meta) {
    for (const [internalKey, sourceKey] of Object.entries(mapping.meta)) {
      if (sourceKey in payload) {
        meta[internalKey] = payload[sourceKey];
      }
    }
    if (Object.keys(meta).length > 0) {
      (data as any).meta = meta;
    }
  }

  const eventName = mapping.event_name || "CustomEvent";
  const sourceTag = mapping.source_tag || "mapped";

  return {
    eventName,
    sourceTag,
    user,
    data,
  };
};

const normalizeMappedPayload = (
  payload: MappedEventPayload,
  mapping: SimpleMapping
): NormalizedEventInput | null => {
  const mapped = applySimpleMapping(payload.payload, mapping);
  const payloadStage =
    payload.payload && typeof payload.payload === "object"
      ? (payload.payload as any).stage
      : undefined;
  const payloadOccurredAt =
    payload.payload && typeof payload.payload === "object"
      ? (payload.payload as any).occurred_at
      : undefined;

  const normalized = normalizeDirectPayload(
    {
      event_name: mapped.eventName,
      source: mapped.sourceTag,
      user: mapped.user,
      data: mapped.data,
      stage: payloadStage,
      occurred_at: payloadOccurredAt,
      raw_payload: payload.payload
    } as any,
    mapped.sourceTag
  );

  if (!normalized) return null;
  return normalized;
};

const resolveStage = async (
  projectId: string,
  stage: string | null | undefined,
  eventName: string
) => {
  if (stage) return stage;

  const stages = await prisma.stageDefinition.findMany({
    where: { projectId },
    orderBy: { order: "asc" }
  });

  let defaultStage: string | null = null;
  for (const s of stages) {
    if (s.isDefault && !defaultStage) {
      defaultStage = s.key;
    }
    const rules = s.inferenceRules as any;
    const matches = Array.isArray(rules?.event_name_equals)
      ? rules.event_name_equals
      : [];
    if (matches.includes(eventName)) {
      return s.key;
    }
  }

  return defaultStage;
};

const buildEventCreateInput = (
  projectId: string,
  input: NormalizedEventInput,
  dedupeKey: string
): Prisma.EventCreateInput => {
  const quality = computeQuality({
    eventId: input.eventId,
    eventTime: input.eventTime,
    user: (input.userJson as Record<string, unknown>) || {},
    data: (input.dataJson as Record<string, unknown>) || {}
  });

  return {
    project: { connect: { id: projectId } },
    source: input.sourceId ? { connect: { id: input.sourceId } } : undefined,
    eventName: input.eventName,
    eventId: input.eventId,
    eventTime: input.eventTime,
    stage: input.stage ?? undefined,
    occurredAt: input.occurredAt ?? undefined,
    receivedAt: input.receivedAt,
    clientEventId: input.clientEventId ?? undefined,
    dedupeKey,
    schemaVersion: input.schemaVersion,
    actorEmail: input.actorEmail ?? undefined,
    actorPhone: input.actorPhone ?? undefined,
    actorExternalId: input.actorExternalId ?? undefined,
    actorIp: input.actorIp ?? undefined,
    actorUserAgent: input.actorUserAgent ?? undefined,
    objectType: input.objectType ?? undefined,
    objectId: input.objectId ?? undefined,
    valueAmount:
      typeof input.valueAmount === "number" ? input.valueAmount : input.valueAmount ?? undefined,
    valueCurrency: input.valueCurrency ?? undefined,
    sourceTag: input.sourceTag,
    userJson: input.userJson,
    dataJson: input.dataJson,
    qualityScore: quality.score,
    qualityFlags: quality.flags as Prisma.InputJsonValue,
    ...(input.rawPayload !== undefined ? { rawPayload: input.rawPayload } : {})
  };
};

export const ingestEvent = async (projectId: string, body: IngestPayload) => {
  let normalized: NormalizedEventInput | null = null;
  let sourceId: string | null = null;
  let sourceTagOverride: string | null = null;

  if (body && (body as MappedEventPayload).mode === "mapped") {
    const validationError = validateMappedEventPayload(body);
    if (validationError) {
      return { error: validationError, status: 400 as const };
    }

    const source = await prisma.source.findFirst({
      where: { projectId, eventKey: (body as MappedEventPayload).event_key }
    });

    if (!source) {
      return { error: "unknown_event_key", status: 400 as const };
    }

    if (!source.mappingJson) {
      return { error: "source_not_mapped", status: 400 as const };
    }

    const mapping = source.mappingJson as unknown as SimpleMapping;
    normalized = normalizeMappedPayload(body as MappedEventPayload, mapping);
    sourceId = source.id;
    sourceTagOverride = source.type || source.name || "mapped";
  } else {
    const validationError = validateDirectEventPayload(body);
    if (validationError) {
      return { error: validationError, status: 400 as const };
    }
    normalized = normalizeDirectPayload(body as any, "direct");
  }

  if (!normalized) {
    return { error: "invalid_payload", status: 400 as const };
  }

  if (sourceId) {
    normalized.sourceId = sourceId;
  }
  if (sourceTagOverride && (!normalized.sourceTag || normalized.sourceTag === "mapped")) {
    normalized.sourceTag = sourceTagOverride;
  }

  const resolvedStage = await resolveStage(
    projectId,
    normalized.stage ?? null,
    normalized.eventName
  );
  normalized.stage = resolvedStage;

  const dedupeKey = computeDedupeKey(projectId, normalized);

  let event;
  let isDuplicate = false;
  try {
    event = await prisma.event.create({
      data: buildEventCreateInput(projectId, normalized, dedupeKey)
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      event = await prisma.event.findFirst({
        where: { projectId, dedupeKey }
      });
      isDuplicate = true;
    } else {
      throw err;
    }
  }

  if (!event) {
    return { error: "conflict", status: 409 as const };
  }

  let deliveries = { created: 0, skippedDuplicates: 0, destinations: [] as { id: string; status: string }[] };

  if (!isDuplicate) {
    deliveries = await planDeliveryLogsForEvent(event);
  }

  return {
    success: true,
    ok: true,
    event_internal_id: event.id,
    eventId: event.id,
    event: {
      id: event.id,
      event_name: event.eventName,
      stage: event.stage ?? null,
      dedupe_key: event.dedupeKey,
      is_duplicate: isDuplicate
    },
    deliveries: {
      created: deliveries.created,
      skipped_duplicates: deliveries.skippedDuplicates
    },
    destinations: deliveries.destinations
  };
};
