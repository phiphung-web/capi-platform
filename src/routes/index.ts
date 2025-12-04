import { Router } from 'express';

import healthRouter from './health';
import eventsRouter from './events';

const router = Router();

router.use('/health', healthRouter);
router.use('/events', eventsRouter);

export default router;
