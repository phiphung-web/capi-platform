import prisma from "../config/database";
import { InternalEvent } from "../types/internalEvent";
import { Prisma } from "@prisma/client";

type DirectEventPayload = {
  mode: string;
  event_name: string;
  event_id: string;
  event_time: number;
  source: string;
  source_id?: string;
  user?: Record<string, unknown>;
  data?: Record<string, unknown>;
  raw_payload?: unknown;
};

const isNonEmptyString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0;

const computeQuality = (
  payload: DirectEventPayload,
  user: Record<string, unknown>,
  data: Record<string, unknown>
) => {
  let score = 0;
  const flags: string[] = [];

  const email = typeof (user as any).email === "string" ? (user as any).email : null;
  const phone = typeof (user as any).phone === "string" ? (user as any).phone : null;
  const currency = typeof (data as any).currency === "string" ? (data as any).currency : null;

  if (isNonEmptyString(email)) {
    score += 0.35;
  } else {
    flags.push("missing_email");
  }

  if (isNonEmptyString(phone)) {
    score += 0.35;
  } else {
    flags.push("missing_phone");
  }

  if (isNonEmptyString(payload.event_id)) {
    score += 0.1;
  } else {
    flags.push("missing_event_id");
  }

  if (typeof payload.event_time === "number") {
    score += 0.1;
  } else {
    flags.push("missing_event_time");
  }

  if ((data as any).value !== undefined) {
    score += 0.05;
  } else {
    flags.push("missing_value");
  }

  if (isNonEmptyString(currency)) {
    score += 0.05;
  } else {
    flags.push("missing_currency");
  }

  return {
    score: Math.min(1, score),
    flags,
  };
};

export const listEvents = async (): Promise<InternalEvent[]> => {
  return [];
};

export const getActiveApiKey = async (key: string) => {
  const apiKey = await prisma.apiKey.findUnique({
    where: { key },
  });

  if (!apiKey || !apiKey.isActive) {
    return null;
  }

  return apiKey;
};

export const validateDirectEventPayload = (payload: any): string | null => {
  if (!payload || payload.mode !== "direct") {
    return "invalid_mode";
  }

  if (
    !isNonEmptyString(payload.event_name) ||
    !isNonEmptyString(payload.event_id) ||
    !isNonEmptyString(payload.source)
  ) {
    return "invalid_payload";
  }

  if (
    typeof payload.event_time !== "number" ||
    !Number.isInteger(payload.event_time)
  ) {
    return "invalid_event_time";
  }

  return null;
};

export const createDirectEvent = async (
  projectId: string,
  payload: DirectEventPayload
): Promise<{
  eventId: string;
  destinations: { id: string; status: string }[];
}> => {
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
  const quality = computeQuality(
    payload,
    (userJson as Record<string, unknown>) || {},
    (dataJson as Record<string, unknown>) || {}
  );

  const event = await prisma.event.create({
    data: {
      projectId,
      sourceId: typeof payload.source_id === "string" ? payload.source_id : null,
      eventName: payload.event_name,
      eventId: payload.event_id,
      eventTime: payload.event_time,
      source: payload.source,
      userJson,
      dataJson,
      qualityScore: quality.score,
      qualityFlags: quality.flags,
      ...(rawPayload !== undefined ? { rawPayload } : {}),
    },
  });

  const destinations = await prisma.destination.findMany({
    where: { projectId, isActive: true },
    select: { id: true },
  });

  if (destinations.length > 0) {
    await prisma.deliveryLog.createMany({
      data: destinations.map((destination) => ({
        eventId: event.id,
        destinationId: destination.id,
        status: "pending",
        attempts: 0,
      })),
    });
  }

  return {
    eventId: event.id,
    destinations: destinations.map((destination) => ({
      id: destination.id,
      status: "pending",
    })),
  };
};
