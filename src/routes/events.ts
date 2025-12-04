import { Router } from 'express';
import * as eventsController from '../controllers/eventsController';

const eventsRouter = Router();

eventsRouter.get('/', eventsController.listEvents);
eventsRouter.post('/', eventsController.createEvent);

export default eventsRouter;
