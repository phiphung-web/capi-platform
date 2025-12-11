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

// GET /v1/projects/:projectId/destinations
router.get("/:projectId/destinations", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { projectId } = req.params;

  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
  if (!allowed) {
    return res.status(403).json({ success: false, error: "forbidden" });
  }

  const destinations = await prisma.destination.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" }
  });

  return res.json({
    success: true,
    destinations: destinations.map((d) => ({
      id: d.id,
      type: d.type,
      isActive: d.isActive,
      healthStatus: d.healthStatus,
      createdAt: d.createdAt
    }))
  });
});

// POST /v1/projects/:projectId/destinations/facebook
router.post("/:projectId/destinations/facebook", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { projectId } = req.params;

  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
  if (!allowed) {
    return res.status(403).json({ success: false, error: "forbidden" });
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
    test_event_code: testEventCode ?? null
  };

  const existing = await prisma.destination.findFirst({
    where: {
      projectId,
      type: "facebook"
    }
  });

  let destination;
  if (existing) {
    destination = await prisma.destination.update({
      where: { id: existing.id },
      data: {
        config,
        isActive: true,
        healthStatus: "OK"
      }
    });
  } else {
    destination = await prisma.destination.create({
      data: {
        projectId,
        type: "facebook",
        config,
        isActive: true,
        healthStatus: "OK"
      }
    });
  }

  return res.json({
    success: true,
    destination: {
      id: destination.id,
      type: destination.type,
      isActive: destination.isActive,
      healthStatus: destination.healthStatus,
      createdAt: destination.createdAt,
      updatedAt: destination.updatedAt
    }
  });
});

export default router;
