import { Router } from "express";
import crypto from "crypto";
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

// GET /v1/projects/:projectId/api-keys
router.get("/:projectId/api-keys", authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }
  const { projectId } = req.params;

  const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
  if (!allowed) {
    return res.status(403).json({ success: false, error: "forbidden" });
  }

  const keys = await prisma.apiKey.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      isActive: true,
      createdAt: true,
      lastUsedAt: true
    }
  });

  return res.json({ success: true, apiKeys: keys });
});

// POST /v1/projects/:projectId/api-keys
router.post("/:projectId/api-keys", authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }
  const { projectId } = req.params;
  const { name } = req.body as { name?: string };

  const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
  if (!allowed || (req.user.role !== "SUPER_ADMIN" && req.user.role !== "PROJECT_MANAGER")) {
    return res.status(403).json({ success: false, error: "forbidden" });
  }

  const rawKey = crypto.randomBytes(32).toString("hex");
  const prefix = rawKey.slice(0, 8);

  const apiKey = await prisma.apiKey.create({
    data: {
      projectId,
      name: name ?? "API Key",
      key: rawKey,
      prefix,
      isActive: true
    }
  });

  return res.json({
    success: true,
    apiKey: {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      key: rawKey,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt
    }
  });
});

// POST /v1/projects/:projectId/api-keys/:id/revoke
router.post(
  "/:projectId/api-keys/:id/revoke",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }
    const { projectId, id } = req.params;

    const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
    if (!allowed || (req.user.role !== "SUPER_ADMIN" && req.user.role !== "PROJECT_MANAGER")) {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    const apiKey = await prisma.apiKey.findFirst({
      where: { id, projectId }
    });

    if (!apiKey) {
      return res.status(404).json({ success: false, error: "not_found" });
    }

    const updated = await prisma.apiKey.update({
      where: { id },
      data: { isActive: false }
    });

    return res.json({
      success: true,
      apiKey: {
        id: updated.id,
        name: updated.name,
        prefix: updated.prefix,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        lastUsedAt: updated.lastUsedAt
      }
    });
  }
);

export default router;
