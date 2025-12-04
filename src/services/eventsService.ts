import { InternalEvent } from '../types/internalEvent';

export const listEvents = async (): Promise<InternalEvent[]> => {
  return [];
};

export const createEvent = async (payload: Partial<InternalEvent>): Promise<InternalEvent> => {
  return {
    ...payload,
    id: payload.id || 'temp-id',
    createdAt: payload.createdAt || new Date()
  };
};
