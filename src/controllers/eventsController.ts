import { Request, Response } from 'express';
import * as eventsService from '../services/eventsService';

export const listEvents = async (_req: Request, res: Response) => {
  const events = await eventsService.listEvents();
  res.json({ events });
};

export const createEvent = async (req: Request, res: Response) => {
  try {
    const authHeader = req.header('authorization') || req.header('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!token) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    const apiKey = await eventsService.getActiveApiKey(token);
    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    const validationError = eventsService.validateDirectEventPayload(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const result = await eventsService.createDirectEvent(apiKey.projectId, req.body);

    return res.status(201).json({
      success: true,
      event_internal_id: result.eventId,
      destinations: result.destinations
    });
  } catch (err) {
    console.error('Error creating event', err);
    return res.status(500).json({ success: false, error: 'internal_error' });
  }
};
