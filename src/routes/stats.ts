import { Router } from "express";
import { prisma } from "../config/database";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { requireProjectRole } from "../middleware/authorization";

const router = Router();

// GET /v1/projects/:projectId/stats/overview
router.get(
  "/:projectId/stats/overview",
  authMiddleware,
  requireProjectRole,
  async (req: AuthenticatedRequest, res) => {
    const { projectId } = req.params;

    const [totalEvents, totalSuccessLogs, totalFailedLogs] = await Promise.all([
      prisma.event.count({ where: { projectId } }),
      prisma.deliveryLog.count({
        where: { event: { projectId }, status: "success" },
      }),
      prisma.deliveryLog.count({
        where: { event: { projectId }, status: "failed" },
      }),
    ]);

    return res.json({
      success: true,
      stats: {
        totalEvents,
        totalSuccessDeliveries: totalSuccessLogs,
        totalFailedDeliveries: totalFailedLogs,
      },
    });
  }
);

export default router;
