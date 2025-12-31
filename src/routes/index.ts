import { Router } from 'express';

import healthRouter from './health';
import eventsRouter from './events';
import adminRouter from './admin';
import authRouter from './auth';
import projectsRouter from './projects';
import destinationsRouter from './destinations';
import sourcesRouter from './sources';
import eventsAdminRouter from './eventsAdmin';
import deliveryLogsRouter from './deliveryLogs';
import apiKeysRouter from './apiKeys';
import stagesRouter from './stages';
import destinationRulesRouter from './destinationRules';

const router = Router();

router.use('/health', healthRouter);
router.use('/events', eventsRouter);
router.use('/admin', adminRouter);
router.use('/auth', authRouter);
router.use('/projects', projectsRouter);
router.use('/projects', destinationsRouter);
router.use('/projects', eventsAdminRouter);
router.use('/projects', deliveryLogsRouter);
router.use('/projects', apiKeysRouter);
router.use('/projects', stagesRouter);
router.use('/projects', destinationRulesRouter);
router.use('/', sourcesRouter);

export default router;
