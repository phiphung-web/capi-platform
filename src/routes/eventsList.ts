import { Router } from "express";
import { prisma } from "../config/database";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { requireProjectRole } from "../middleware/authorization";

const router = Router();

// GET /v1/projects/:projectId/events
router.get(
  "/:projectId/events",
  authMiddleware,
  requireProjectRole,
  async (req: AuthenticatedRequest, res) => {
    const { projectId } = req.params;
    const { eventName, limit = "50", cursor } = req.query as {
      eventName?: string;
      limit?: string;
      cursor?: string;
    };

    const take = Math.min(parseInt(limit, 10) || 50, 200);

    const where: any = { projectId };
    if (eventName) {
      where.eventName = eventName;
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: take + 1,
      cursor: cursor ? { id: cursor } : undefined,
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
        eventTime: e.eventTime,
        sourceTag: e.sourceTag,
        qualityScore: e.qualityScore,
        createdAt: e.createdAt,
      })),
      nextCursor,
    });
  }
);

// GET /v1/projects/:projectId/events/:eventId
router.get(
  "/:projectId/events/:eventId",
  authMiddleware,
  requireProjectRole,
  async (req: AuthenticatedRequest, res) => {
    const { projectId, eventId } = req.params;

    const event = await prisma.event.findFirst({
      where: { id: eventId, projectId },
    });

    if (!event) {
      return res.status(404).json({ success: false, error: "not_found" });
    }

    return res.json({
      success: true,
      event,
    });
  }
);

export default router;
