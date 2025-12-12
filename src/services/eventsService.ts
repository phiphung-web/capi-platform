import crypto, { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { InternalEvent } from "../types/internalEvent";

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

export type MappedEventPayload = {
  mode: "mapped";
  event_key: string;
  payload: Record<string, unknown>;
};

export type IngestPayload = DirectEventPayload | MappedEventPayload;

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
  if (!payload || payload.mode !== "direct") {
    return "invalid_mode";
  }

  if (
    !isNonEmptyString(payload.event_name) ||
    !isNonEmptyString(payload.source)
  ) {
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

const createDeliveryLogs = async (projectId: string, eventId: string) => {
  const destinations = await prisma.destination.findMany({
    where: { projectId, isActive: true },
    select: { id: true },
  });

  if (destinations.length > 0) {
    await prisma.deliveryLog.createMany({
      data: destinations.map((destination) => ({
        eventId,
        destinationId: destination.id,
        status: "pending",
        attempts: 0,
      })),
    });
  }

  return destinations.map((destination) => ({
    id: destination.id,
    status: "pending",
  }));
};

const createEventRecord = async (data: Prisma.EventCreateInput) => {
  return prisma.event.create({ data });
};

export const createDirectEvent = async (
  projectId: string,
  payload: DirectEventPayload
): Promise<{ eventId: string; event_internal_id: string; destinations: { id: string; status: string }[] }> => {
  const userJson: Prisma.InputJsonValue =
    payload.user && typeof payload.user === "object"
      ? (payload.user as Prisma.InputJsonValue)
      : ({} as Prisma.InputJsonValue);
  const dataJson: Prisma.InputJsonValue =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Prisma.InputJsonValue)
      : ({} as Prisma.InputJsonValue);
  const rawPayload =
    payload.raw_payload !== undefined
      ? (payload.raw_payload as Prisma.InputJsonValue)
      : undefined;

  const finalEventId =
    typeof payload.event_id === "string" && payload.event_id.trim().length > 0
      ? payload.event_id.trim()
      : (crypto.randomUUID
          ? crypto.randomUUID()
          : `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`);

  const finalEventTime =
    typeof payload.event_time === "number" && Number.isFinite(payload.event_time)
      ? payload.event_time
      : Math.floor(Date.now() / 1000);

  const quality = computeQuality({
    eventId: finalEventId,
    eventTime: finalEventTime,
    user: (userJson as Record<string, unknown>) || {},
    data: (dataJson as Record<string, unknown>) || {},
  });

  const event = await createEventRecord({
    project: { connect: { id: projectId } },
    source: payload.source_id ? { connect: { id: payload.source_id } } : undefined,
    eventName: payload.event_name,
    eventId: finalEventId,
    eventTime: finalEventTime,
    sourceTag: payload.source,
    userJson,
    dataJson,
    qualityScore: quality.score,
    qualityFlags: quality.flags as Prisma.InputJsonValue,
    ...(rawPayload !== undefined ? { rawPayload } : {}),
  });

  const destinations = await createDeliveryLogs(projectId, event.id);

  return { eventId: event.id, event_internal_id: event.id, destinations };
};

export const ingestEvent = async (projectId: string, body: IngestPayload) => {
  if (body.mode === "direct") {
    const validationError = validateDirectEventPayload(body);
    if (validationError) {
      return { error: validationError, status: 400 as const };
    }
    const result = await createDirectEvent(projectId, body);
    return {
      success: true,
      event_internal_id: result.event_internal_id,
      destinations: result.destinations,
    };
  }

  const validationError = validateMappedEventPayload(body);
  if (validationError) {
    return { error: validationError, status: 400 as const };
  }

  const source = await prisma.source.findFirst({
    where: { projectId, eventKey: body.event_key },
  });

  if (!source) {
    return { error: "unknown_event_key", status: 400 as const };
  }

  if (!source.mappingJson) {
    return { error: "source_not_mapped", status: 400 as const };
  }

  const mapping = source.mappingJson as unknown as SimpleMapping;
  const mapped = applySimpleMapping(body.payload, mapping);

  const eventId = randomUUID();
  const eventTime = Math.floor(Date.now() / 1000);

  const userJson = mapped.user as Prisma.InputJsonValue;
  const dataJson = mapped.data as Prisma.InputJsonValue;

  const quality = computeQuality({
    eventId,
    eventTime,
    user: mapped.user,
    data: mapped.data,
  });

  const event = await createEventRecord({
    project: { connect: { id: projectId } },
    source: { connect: { id: source.id } },
    eventName: mapped.eventName,
    eventId,
    eventTime,
    sourceTag: mapped.sourceTag || source.type || source.name || "mapped",
    userJson,
    dataJson,
    rawPayload: body.payload as Prisma.InputJsonValue,
    qualityScore: quality.score,
    qualityFlags: quality.flags as Prisma.InputJsonValue,
  });

  const destinations = await createDeliveryLogs(projectId, event.id);

  return { success: true, event_internal_id: event.id, destinations };
};
