import { Request, Response } from 'express';
import * as eventsService from '../services/eventsService';

export const listEvents = async (_req: Request, res: Response) => {
  const events = await eventsService.listEvents();
  res.json({ events });
};

export const createEvent = async (req: Request, res: Response) => {
  const event = await eventsService.createEvent(req.body);
  res.status(201).json({ event });
};
