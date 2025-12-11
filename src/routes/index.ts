import { Router } from 'express';

import healthRouter from './health';
import eventsRouter from './events';
import adminRouter from './admin';
import authRouter from './auth';
import projectsRouter from './projects';
import destinationsRouter from './destinations';
import eventsListRouter from './eventsList';
import statsRouter from './stats';
import sourcesRouter from './sources';

const router = Router();

router.use('/health', healthRouter);
router.use('/events', eventsRouter);
router.use('/admin', adminRouter);
router.use('/auth', authRouter);
router.use('/projects', projectsRouter);
router.use('/projects', destinationsRouter);
router.use('/projects', eventsListRouter);
router.use('/projects', statsRouter);
router.use('/', sourcesRouter);

export default router;
