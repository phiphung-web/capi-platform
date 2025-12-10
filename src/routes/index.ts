import { Router } from 'express';

import healthRouter from './health';
import eventsRouter from './events';
import adminRouter from './admin';
import sourcesRouter from './sources';
import authRouter from './auth';
import projectsRouter from './projects';
import destinationsRouter from './destinations';
import eventsListRouter from './eventsList';
import statsRouter from './stats';

const router = Router();

router.use('/health', healthRouter);
router.use('/events', eventsRouter);
router.use('/admin', adminRouter);
router.use('/sources', sourcesRouter);
router.use('/auth', authRouter);
router.use('/projects', projectsRouter);
router.use('/projects', destinationsRouter);
router.use('/projects', eventsListRouter);
router.use('/projects', statsRouter);

export default router;
