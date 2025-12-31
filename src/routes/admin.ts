import { Router } from 'express';
import { prisma } from '../config/database';
import { processPendingDeliveries } from '../services/deliveryService';

const adminRouter = Router();

adminRouter.post('/process-deliveries', async (req, res) => {
  const token = req.header('x-admin-token');
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken || token !== adminToken) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  const { destinationId, limit, dryRun } = req.body || {};
  const parsedLimit =
    typeof limit === "number" ? limit : typeof limit === "string" ? parseInt(limit, 10) : undefined;
  const result = await processPendingDeliveries({
    destinationId: typeof destinationId === "string" ? destinationId : undefined,
    limit: parsedLimit,
    dryRun: Boolean(dryRun)
  });
  return res.json({ success: true, ok: true, ...result });
});

adminRouter.get('/destinations/:id/rules', async (req, res) => {
  const token = req.header('x-admin-token');
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken || token !== adminToken) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  const destination = await prisma.destination.findUnique({
    where: { id: req.params.id }
  });

  if (!destination) {
    return res.status(404).json({ success: false, error: 'not_found' });
  }

  const rules = await prisma.destinationRule.findMany({
    where: { destinationId: destination.id },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }]
  });

  return res.json({
    success: true,
    destinationId: destination.id,
    adapterKey: destination.adapterKey,
    rules
  });
});

adminRouter.get('/projects/:id/stages', async (req, res) => {
  const token = req.header('x-admin-token');
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken || token !== adminToken) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  const stages = await prisma.stageDefinition.findMany({
    where: { projectId: req.params.id },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
  });

  return res.json({
    success: true,
    projectId: req.params.id,
    stages
  });
});

export default adminRouter;
