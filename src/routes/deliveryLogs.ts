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
        destination: {
          id: d.destination.id,
          type: d.destination.type,
          healthStatus: d.destination.healthStatus,
          isActive: d.destination.isActive
        },
        createdAt: d.createdAt,
        updatedAt: d.updatedAt
      }))
    });
  }
);

export default router;
