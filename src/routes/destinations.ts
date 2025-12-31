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
      adapterKey: d.adapterKey,
      isActive: d.isActive,
      isEnabled: d.isEnabled,
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
        isEnabled: true,
        adapterKey: "facebook",
        healthStatus: "OK"
      }
    });
  } else {
    destination = await prisma.destination.create({
      data: {
        projectId,
        type: "facebook",
        adapterKey: "facebook",
        config,
        isActive: true,
        isEnabled: true,
        healthStatus: "OK"
      }
    });
  }

  return res.json({
    success: true,
    destination: {
      id: destination.id,
      type: destination.type,
      adapterKey: destination.adapterKey,
      isActive: destination.isActive,
      isEnabled: destination.isEnabled,
      healthStatus: destination.healthStatus,
      createdAt: destination.createdAt,
      updatedAt: destination.updatedAt
    }
  });
});

// PATCH /v1/projects/:projectId/destinations/:destinationId
router.patch("/:projectId/destinations/:destinationId", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { projectId, destinationId } = req.params;

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

  const destination = await prisma.destination.findFirst({
    where: { id: destinationId, projectId }
  });
  if (!destination) {
    return res.status(404).json({ success: false, error: "not_found" });
  }

  const { isEnabled, isActive } = req.body || {};

  const updated = await prisma.destination.update({
    where: { id: destinationId },
    data: {
      isEnabled: typeof isEnabled === "boolean" ? isEnabled : undefined,
      isActive: typeof isActive === "boolean" ? isActive : undefined
    }
  });

  return res.json({
    success: true,
    destination: {
      id: updated.id,
      type: updated.type,
      adapterKey: updated.adapterKey,
      isActive: updated.isActive,
      isEnabled: updated.isEnabled,
      healthStatus: updated.healthStatus,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    }
  });
});

export default router;
