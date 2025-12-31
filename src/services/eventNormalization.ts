import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { sha256Hex } from "../utils/hash";
import { stableStringify } from "../utils/stableJson";

type AnyRecord = Record<string, unknown>;

export type NormalizedEventInput = {
  eventName: string;
  sourceTag: string;
  sourceId?: string | null;
  eventId: string;
  eventTime: number;
  stage?: string | null;
  occurredAt?: Date | null;
  receivedAt: Date;
  clientEventId?: string | null;
  schemaVersion: number;
  actorEmail?: string | null;
  actorPhone?: string | null;
  actorExternalId?: string | null;
  actorIp?: string | null;
  actorUserAgent?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  valueAmount?: Prisma.Decimal | number | null;
  valueCurrency?: string | null;
  userJson: Prisma.InputJsonValue;
  dataJson: Prisma.InputJsonValue;
  rawPayload?: Prisma.InputJsonValue;
};

export type CanonicalEventForDedupe = {
  eventName: string;
  stage?: string | null;
  occurredAt?: Date | null;
  actor: {
    email?: string | null;
    phone?: string | null;
    externalId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  };
  object: {
    type?: string | null;
    id?: string | null;
  };
  value: {
    amount?: number | null;
    currency?: string | null;
  };
  properties: AnyRecord;
};

const isRecord = (value: unknown): value is AnyRecord =>
  !!value && typeof value === "object" && !Array.isArray(value);

const pickString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseOccurredAt = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseEventTimeSeconds = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }
  return null;
};

const knownTopLevelKeys = new Set([
  "mode",
  "event_name",
  "event_id",
  "event_time",
  "stage",
  "occurred_at",
  "actor",
  "object",
  "value",
  "properties",
  "user",
  "data",
  "raw_payload",
  "source",
  "source_id",
  "event_key",
  "payload",
  "projectId"
]);

const mergeProperties = (payload: AnyRecord) => {
  const data = isRecord(payload.data) ? payload.data : {};
  const properties = isRecord(payload.properties) ? payload.properties : {};
  const merged: AnyRecord = { ...data };
  for (const [key, value] of Object.entries(properties)) {
    merged[key] = value;
  }
  for (const [key, value] of Object.entries(payload)) {
    if (!knownTopLevelKeys.has(key) && !(key in merged)) {
      merged[key] = value;
    }
  }
  return merged;
};

const extractActor = (payload: AnyRecord) => {
  const actorSource = isRecord(payload.actor) ? payload.actor : {};
  const userSource = isRecord(payload.user) ? payload.user : {};
  const mergedSource = { ...actorSource, ...userSource };
  const userDataSource = isRecord(payload.user_data) ? payload.user_data : {};

  const email =
    pickString(mergedSource.email) ?? pickString(userDataSource.em) ?? pickString(mergedSource.em);
  const phone =
    pickString(mergedSource.phone) ?? pickString(userDataSource.ph) ?? pickString(mergedSource.ph);
  const externalId =
    pickString(mergedSource.external_id) ??
    pickString(mergedSource.externalId) ??
    pickString(mergedSource.id);
  const ip =
    pickString(mergedSource.ip) ??
    pickString(mergedSource.client_ip_address) ??
    pickString(userDataSource.client_ip_address);
  const userAgent =
    pickString(mergedSource.user_agent) ??
    pickString(mergedSource.userAgent) ??
    pickString(mergedSource.ua) ??
    pickString(userDataSource.client_user_agent);

  return {
    email,
    phone,
    externalId,
    ip,
    userAgent
  };
};

const extractObject = (payload: AnyRecord) => {
  const objectSource = isRecord(payload.object) ? payload.object : {};
  const dataSource = isRecord(payload.data) ? payload.data : {};
  const objectType =
    pickString(objectSource.type) ?? pickString(objectSource.object_type) ?? pickString(dataSource.object_type);
  const objectId =
    pickString(objectSource.id) ?? pickString(objectSource.object_id) ?? pickString(dataSource.object_id);
  return { objectType, objectId };
};

const extractValue = (payload: AnyRecord) => {
  const valueSource = isRecord(payload.value) ? payload.value : {};
  const dataSource = isRecord(payload.data) ? payload.data : {};
  const amount =
    typeof valueSource.amount === "number"
      ? valueSource.amount
      : typeof dataSource.value === "number"
        ? (dataSource.value as number)
        : null;
  const currency =
    pickString(valueSource.currency) ??
    pickString(dataSource.currency) ??
    pickString(dataSource.value_currency);
  return { valueAmount: amount, valueCurrency: currency };
};

export const buildCanonicalForDedupe = (input: NormalizedEventInput): CanonicalEventForDedupe => {
  const properties = (input.dataJson ?? {}) as AnyRecord;
  return {
    eventName: input.eventName,
    stage: input.stage ?? null,
    occurredAt: input.occurredAt ?? null,
    actor: {
      email: input.actorEmail ?? null,
      phone: input.actorPhone ?? null,
      externalId: input.actorExternalId ?? null,
      ip: input.actorIp ?? null,
      userAgent: input.actorUserAgent ?? null
    },
    object: {
      type: input.objectType ?? null,
      id: input.objectId ?? null
    },
    value: {
      amount: typeof input.valueAmount === "number" ? input.valueAmount : null,
      currency: input.valueCurrency ?? null
    },
    properties
  };
};

export const computeDedupeKey = (
  projectId: string,
  input: NormalizedEventInput
): string => {
  if (input.clientEventId) {
    return `sha256:${sha256Hex(`${projectId}:${input.clientEventId}`)}`;
  }
  const canonical = buildCanonicalForDedupe(input);
  return `sha256:${sha256Hex(stableStringify(canonical))}`;
};

export const normalizeDirectPayload = (
  payload: AnyRecord,
  sourceTagFallback = "direct"
): NormalizedEventInput | null => {
  const eventName = pickString(payload.event_name);
  if (!eventName) return null;

  const clientEventId = pickString(payload.event_id);
  const occurredAt = parseOccurredAt(payload.occurred_at);
  const eventTime =
    parseEventTimeSeconds(payload.event_time) ??
    (occurredAt ? Math.floor(occurredAt.getTime() / 1000) : null) ??
    Math.floor(Date.now() / 1000);
  const eventId =
    clientEventId ||
    (crypto.randomUUID
      ? crypto.randomUUID()
      : `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`);

  const actor = extractActor(payload);
  const object = extractObject(payload);
  const value = extractValue(payload);
  const properties = mergeProperties(payload);

  const userJsonSource = isRecord(payload.user) ? payload.user : {};
  const userJson: AnyRecord = { ...actor, ...userJsonSource };

  const dataJson: AnyRecord = properties;
  const rawPayload =
    payload.raw_payload !== undefined ? (payload.raw_payload as Prisma.InputJsonValue) : undefined;

  return {
    eventName,
    sourceTag: pickString(payload.source) ?? sourceTagFallback,
    sourceId: pickString(payload.source_id),
    eventId,
    eventTime,
    stage: pickString(payload.stage),
    occurredAt,
    receivedAt: new Date(),
    clientEventId,
    schemaVersion: 1,
    actorEmail: actor.email,
    actorPhone: actor.phone,
    actorExternalId: actor.externalId,
    actorIp: actor.ip,
    actorUserAgent: actor.userAgent,
    objectType: object.objectType,
    objectId: object.objectId,
    valueAmount: value.valueAmount,
    valueCurrency: value.valueCurrency,
    userJson: userJson as Prisma.InputJsonValue,
    dataJson: dataJson as Prisma.InputJsonValue,
    rawPayload
  };
};
