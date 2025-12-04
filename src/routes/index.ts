import { Router } from 'express';

import healthRouter from './health';
import eventsRouter from './events';
import adminRouter from './admin';

const router = Router();

router.use('/health', healthRouter);
router.use('/events', eventsRouter);
router.use('/admin', adminRouter);

export default router;
