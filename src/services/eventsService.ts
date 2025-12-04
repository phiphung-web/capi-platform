import prisma from '../config/database';
import { InternalEvent } from '../types/internalEvent';

type DirectEventPayload = {
  mode: string;
  event_name: string;
  event_id: string;
  event_time: number;
  source: string;
  user?: Record<string, unknown>;
  data?: Record<string, unknown>;
  raw_payload?: unknown;
};

const isNonEmptyString = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0;

export const listEvents = async (): Promise<InternalEvent[]> => {
  return [];
};

export const getActiveApiKey = async (key: string) => {
  const apiKey = await prisma.apiKey.findUnique({
    where: { key }
  });

  if (!apiKey || !apiKey.isActive) {
    return null;
  }

  return apiKey;
};

export const validateDirectEventPayload = (payload: any): string | null => {
  if (!payload || payload.mode !== 'direct') {
    return 'invalid_mode';
  }

  if (
    !isNonEmptyString(payload.event_name) ||
    !isNonEmptyString(payload.event_id) ||
    !isNonEmptyString(payload.source)
  ) {
    return 'invalid_payload';
  }

  if (typeof payload.event_time !== 'number' || !Number.isInteger(payload.event_time)) {
    return 'invalid_event_time';
  }

  return null;
};

export const createDirectEvent = async (
  projectId: string,
  payload: DirectEventPayload
): Promise<{ eventId: string; destinations: { id: string; status: string }[] }> => {
  const userJson = payload.user && typeof payload.user === 'object' ? payload.user : {};
  const dataJson = payload.data && typeof payload.data === 'object' ? payload.data : {};

  const event = await prisma.event.create({
    data: {
      projectId,
      eventName: payload.event_name,
      eventId: payload.event_id,
      eventTime: payload.event_time,
      source: payload.source,
      userJson,
      dataJson,
      rawPayload: payload.raw_payload ?? null
    }
  });

  const destinations = await prisma.destination.findMany({
    where: { projectId, isActive: true },
    select: { id: true }
  });

  if (destinations.length > 0) {
    await prisma.deliveryLog.createMany({
      data: destinations.map((destination) => ({
        eventId: event.id,
        destinationId: destination.id,
        status: 'pending',
        attempts: 0
      }))
    });
  }

  return {
    eventId: event.id,
    destinations: destinations.map((destination) => ({
      id: destination.id,
      status: 'pending'
    }))
  };
};
