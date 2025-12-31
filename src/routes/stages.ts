import { Router } from "express";
import { Prisma } from "@prisma/client";
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

// GET /v1/projects/:projectId/stages
router.get("/:projectId/stages", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { projectId } = req.params;
  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
  if (!allowed) {
    return res.status(403).json({ success: false, error: "forbidden" });
  }

  const stages = await prisma.stageDefinition.findMany({
    where: { projectId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }]
  });

  return res.json({ success: true, projectId, stages });
});

// POST /v1/projects/:projectId/stages
router.post("/:projectId/stages", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { projectId } = req.params;
  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
  if (!allowed) {
    return res.status(403).json({ success: false, error: "forbidden" });
  }

  const { key, displayName, description, order, isDefault, inferenceRules } = req.body || {};
  if (!key || !displayName) {
    return res.status(400).json({ success: false, error: "missing_fields" });
  }

  const result = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.stageDefinition.updateMany({
        where: { projectId },
        data: { isDefault: false }
      });
    }
    return tx.stageDefinition.create({
      data: {
        projectId,
        key,
        displayName,
        description: description ?? null,
        order: typeof order === "number" ? order : 0,
        isDefault: Boolean(isDefault),
        inferenceRules: (inferenceRules ?? {}) as Prisma.InputJsonValue
      }
    });
  });

  return res.json({ success: true, stage: result });
});

// PUT /v1/projects/:projectId/stages/:stageId
router.put("/:projectId/stages/:stageId", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { projectId, stageId } = req.params;
  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
  if (!allowed) {
    return res.status(403).json({ success: false, error: "forbidden" });
  }

  const stage = await prisma.stageDefinition.findFirst({
    where: { id: stageId, projectId }
  });
  if (!stage) {
    return res.status(404).json({ success: false, error: "not_found" });
  }

  const { key, displayName, description, order, isDefault, inferenceRules } = req.body || {};

  const result = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.stageDefinition.updateMany({
        where: { projectId },
        data: { isDefault: false }
      });
    }
    return tx.stageDefinition.update({
      where: { id: stageId },
      data: {
        key: key ?? undefined,
        displayName: displayName ?? undefined,
        description: description ?? undefined,
        order: typeof order === "number" ? order : undefined,
        isDefault: typeof isDefault === "boolean" ? isDefault : undefined,
        inferenceRules: inferenceRules ?? undefined
      }
    });
  });

  return res.json({ success: true, stage: result });
});

// DELETE /v1/projects/:projectId/stages/:stageId
router.delete("/:projectId/stages/:stageId", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { projectId, stageId } = req.params;
  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
  if (!allowed) {
    return res.status(403).json({ success: false, error: "forbidden" });
  }

  const stage = await prisma.stageDefinition.findFirst({
    where: { id: stageId, projectId }
  });
  if (!stage) {
    return res.status(404).json({ success: false, error: "not_found" });
  }

  await prisma.stageDefinition.delete({ where: { id: stageId } });

  return res.json({ success: true });
});

export default router;
