import { Router } from "express";
import { prisma } from "../config/database";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();

const ensureProjectAccess = async (userId: string, projectId: string, role: string) => {
  if (role === "SUPER_ADMIN") return true;
  const member = await prisma.projectMember.findFirst({
    where: { userId, projectId }
  });
  return !!member;
};

// GET /v1/projects/:projectId/events/:eventId/deliveries
router.get(
  "/:projectId/events/:eventId/deliveries",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const { projectId, eventId } = req.params;

    if (!req.user) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }

    const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
    if (!allowed) {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    const deliveries = await prisma.deliveryLog.findMany({
      where: { eventId, event: { projectId } },
      include: { destination: true },
      orderBy: { createdAt: "asc" }
    });

    return res.json({
      success: true,
      deliveries: deliveries.map((d) => ({
        id: d.id,
        status: d.status,
        errorMessage: d.lastError,
        attemptCount: d.attemptCount,
        nextAttemptAt: d.nextAttemptAt,
        lastAttemptAt: d.lastAttemptAt,
        providerStatusCode: d.providerStatusCode,
        destinationRuleId: d.destinationRuleId,
        adapterKey: d.adapterKey,
        destination: {
          id: d.destination.id,
          type: d.destination.type,
          adapterKey: d.destination.adapterKey,
          healthStatus: d.destination.healthStatus,
          isActive: d.destination.isActive,
          isEnabled: d.destination.isEnabled
        },
        createdAt: d.createdAt,
        updatedAt: d.updatedAt
      }))
    });
  }
);

// GET /v1/projects/:projectId/delivery-logs
router.get(
  "/:projectId/delivery-logs",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const { projectId } = req.params;
    const { status, destinationId, ruleId, limit = "50" } = req.query as {
      status?: string;
      destinationId?: string;
      ruleId?: string;
      limit?: string;
    };

    if (!req.user) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }

    const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
    if (!allowed) {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    const take = Math.min(parseInt(limit, 10) || 50, 200);
    const where: any = { event: { projectId } };
    if (status) {
      where.status = status;
    }
    if (destinationId) {
      where.destinationId = destinationId;
    }
    if (ruleId) {
      where.destinationRuleId = ruleId;
    }

    const deliveries = await prisma.deliveryLog.findMany({
      where,
      include: { destination: true },
      orderBy: { createdAt: "desc" },
      take
    });

    return res.json({
      success: true,
      deliveries: deliveries.map((d) => ({
        id: d.id,
        status: d.status,
        errorMessage: d.lastError,
        attemptCount: d.attemptCount,
        nextAttemptAt: d.nextAttemptAt,
        lastAttemptAt: d.lastAttemptAt,
        providerStatusCode: d.providerStatusCode,
        destinationRuleId: d.destinationRuleId,
        adapterKey: d.adapterKey,
        destination: {
          id: d.destination.id,
          type: d.destination.type,
          adapterKey: d.destination.adapterKey,
          healthStatus: d.destination.healthStatus,
          isActive: d.destination.isActive,
          isEnabled: d.destination.isEnabled
        },
        createdAt: d.createdAt,
        updatedAt: d.updatedAt
      }))
    });
  }
);

// POST /v1/projects/:projectId/delivery-logs/:deliveryId/requeue
router.post(
  "/:projectId/delivery-logs/:deliveryId/requeue",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const { projectId, deliveryId } = req.params;

    if (!req.user) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }

    const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
    if (!allowed) {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    const log = await prisma.deliveryLog.findFirst({
      where: { id: deliveryId, event: { projectId } }
    });
    if (!log) {
      return res.status(404).json({ success: false, error: "not_found" });
    }

    const updated = await prisma.deliveryLog.update({
      where: { id: deliveryId },
      data: {
        status: "RETRYING",
        nextAttemptAt: new Date(),
        processingLockId: null,
        processingLockedAt: null
      }
    });

    return res.json({ success: true, delivery: updated });
  }
);

export default router;
