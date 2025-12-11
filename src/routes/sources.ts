import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { requireProjectRole } from "../middleware/authorization";

const router = Router();

// helper check membership
const ensureProjectAccess = async (userId: string, projectId: string, role: string) => {
  if (role === "SUPER_ADMIN") return true;
  const member = await prisma.projectMember.findFirst({
    where: { userId, projectId }
  });
  return !!member;
};

// GET /v1/projects/:projectId/sources
router.get("/projects/:projectId/sources", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { projectId } = req.params;

  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
  if (!allowed) {
    return res.status(403).json({ success: false, error: "forbidden" });
  }

  const sources = await prisma.source.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" }
  });

  return res.json({
    success: true,
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      eventKey: s.eventKey,
      type: s.type,
      createdAt: s.createdAt
    }))
  });
});

// POST /v1/projects/:projectId/sources
router.post("/projects/:projectId/sources", authMiddleware, async (req: AuthenticatedRequest, res) => {
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

  const { name, eventKey, type } = req.body as {
    name?: string;
    eventKey?: string;
    type?: string;
  };

  if (!name || !eventKey) {
    return res.status(400).json({ success: false, error: "missing_name_or_eventKey" });
  }

  const existing = await prisma.source.findUnique({
    where: { eventKey }
  });

  if (existing) {
    return res.status(400).json({ success: false, error: "eventKey_already_exists" });
  }

  const source = await prisma.source.create({
    data: {
      projectId,
      name,
      eventKey,
      type: type ?? null
    }
  });

  return res.json({ success: true, source });
});

// GET /v1/sources/:sourceId
router.get("/sources/:sourceId", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { sourceId } = req.params;

  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  const source = await prisma.source.findUnique({
    where: { id: sourceId }
  });

  if (!source) {
    return res.status(404).json({ success: false, error: "not_found" });
  }

  const allowed = await ensureProjectAccess(req.user.id, source.projectId, req.user.role);
  if (!allowed) {
    return res.status(403).json({ success: false, error: "forbidden" });
  }

  return res.json({
    success: true,
    source: {
      id: source.id,
      projectId: source.projectId,
      name: source.name,
      eventKey: source.eventKey,
      type: source.type,
      mappingJson: source.mappingJson,
      seenFields: source.seenFields,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt
    }
  });
});

// PUT /v1/sources/:sourceId - update mappingJson, name, type
router.put("/sources/:sourceId", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { sourceId } = req.params;

  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  const source = await prisma.source.findUnique({
    where: { id: sourceId }
  });

  if (!source) {
    return res.status(404).json({ success: false, error: "not_found" });
  }

  const allowed = await ensureProjectAccess(req.user.id, source.projectId, req.user.role);
  if (!allowed) {
    return res.status(403).json({ success: false, error: "forbidden" });
  }

  if (!["SUPER_ADMIN", "PROJECT_MANAGER", "OPERATOR"].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: "forbidden" });
  }

  const { name, type, mappingJson } = req.body as {
    name?: string;
    type?: string;
    mappingJson?: unknown;
  };

  const dataToUpdate: Prisma.SourceUpdateInput = {};

  if (typeof name !== "undefined") {
    dataToUpdate.name = name;
  }
  if (typeof type !== "undefined") {
    dataToUpdate.type = type;
  }

  if (typeof mappingJson !== "undefined") {
    dataToUpdate.mappingJson = mappingJson as Prisma.InputJsonValue;
  }

  const updated = await prisma.source.update({
    where: { id: sourceId },
    data: dataToUpdate,
  });

  return res.json({ success: true, source: updated });
});

export default router;
