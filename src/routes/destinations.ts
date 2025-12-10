import { Router } from "express";
import { prisma } from "../config/database";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { requireProjectRole } from "../middleware/authorization";

const router = Router();

// GET /v1/projects/:projectId/destinations
router.get(
  "/:projectId/destinations",
  authMiddleware,
  requireProjectRole,
  async (req: AuthenticatedRequest, res) => {
    const { projectId } = req.params;

    const destinations = await prisma.destination.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      success: true,
      destinations: destinations.map((d) => ({
        id: d.id,
        type: d.type,
        isActive: d.isActive,
        healthStatus: d.healthStatus,
        createdAt: d.createdAt,
      })),
    });
  }
);

// POST /v1/projects/:projectId/destinations/facebook
router.post(
  "/:projectId/destinations/facebook",
  authMiddleware,
  requireProjectRole,
  async (req: AuthenticatedRequest, res) => {
    const { projectId } = req.params;

    if (!req.user) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }

    if (req.user.role !== "SUPER_ADMIN" && req.user.role !== "PROJECT_MANAGER") {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    const { pixelId, accessToken, testEventCode } = req.body as {
      pixelId?: string;
      accessToken?: string;
      testEventCode?: string;
    };

    if (!pixelId || !accessToken) {
      return res.status(400).json({ success: false, error: "missing_pixel_or_token" });
    }

    const config = {
      pixel_id: pixelId,
      access_token: accessToken,
      test_event_code: testEventCode ?? null,
    };

    const existing = await prisma.destination.findFirst({
      where: {
        projectId,
        type: "facebook",
      },
    });

    let destination;
    if (existing) {
      destination = await prisma.destination.update({
        where: { id: existing.id },
        data: {
          config,
          isActive: true,
          healthStatus: "OK",
        },
      });
    } else {
      destination = await prisma.destination.create({
        data: {
          projectId,
          type: "facebook",
          config,
          isActive: true,
          healthStatus: "OK",
        },
      });
    }

    return res.json({ success: true, destination });
  }
);

export default router;
