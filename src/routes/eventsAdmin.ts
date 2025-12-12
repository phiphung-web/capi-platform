import { Router } from "express";
import { prisma } from "../config/database";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";

const eventsAdminRouter = Router();

const ensureProjectAccess = async (userId: string, projectId: string, role: string) => {
  if (role === "SUPER_ADMIN") return true;
  const member = await prisma.projectMember.findFirst({
    where: { userId, projectId }
  });
  return !!member;
};

// GET /v1/projects/:projectId/events
eventsAdminRouter.get("/:projectId/events", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { projectId } = req.params;
  const { eventName, limit = "50", cursor } = req.query as {
    eventName?: string;
    limit?: string;
    cursor?: string;
  };

  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
  if (!allowed) {
    return res.status(403).json({ success: false, error: "forbidden" });
  }

  const take = Math.min(parseInt(limit, 10) || 50, 200);
  const where: any = { projectId };
  if (eventName) {
    where.eventName = eventName;
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined
  });

  let nextCursor: string | null = null;
  if (events.length > take) {
    const nextItem = events.pop();
    nextCursor = nextItem ? nextItem.id : null;
  }

  return res.json({
    success: true,
    events: events.map((e) => ({
      id: e.id,
      eventName: e.eventName,
      eventId: e.eventId,
      eventTime: e.eventTime,
      sourceTag: e.sourceTag,
      qualityScore: e.qualityScore,
      createdAt: e.createdAt
    })),
    nextCursor
  });
});

// GET /v1/projects/:projectId/events/:eventId
eventsAdminRouter.get(
  "/:projectId/events/:eventId",
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

    const event = await prisma.event.findFirst({
      where: { id: eventId, projectId }
    });

    if (!event) {
      return res.status(404).json({ success: false, error: "not_found" });
    }

    return res.json({
      success: true,
      event
    });
  }
);

// GET /v1/projects/:projectId/stats/overview
eventsAdminRouter.get(
  "/:projectId/stats/overview",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const { projectId } = req.params;

    if (!req.user) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }

    const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
    if (!allowed) {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    const [totalEvents, totalSuccessDeliveries, totalFailedDeliveries, totalPendingDeliveries] =
      await Promise.all([
        prisma.event.count({ where: { projectId } }),
        prisma.deliveryLog.count({
          where: { event: { projectId }, status: "success" }
        }),
        prisma.deliveryLog.count({
          where: { event: { projectId }, status: "failed" }
        }),
        prisma.deliveryLog.count({
          where: { event: { projectId }, status: "pending" }
        })
      ]);

    return res.json({
      success: true,
      stats: {
        totalEvents,
        totalSuccessDeliveries,
        totalFailedDeliveries,
        totalPendingDeliveries
      }
    });
  }
);

export default eventsAdminRouter;
