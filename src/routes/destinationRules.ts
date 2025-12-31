import { Router } from "express";
import { prisma } from "../config/database";
import { getAdapter } from "../adapters";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();

const ensureProjectAccess = async (userId: string, projectId: string, role: string) => {
  if (role === "SUPER_ADMIN") return true;
  const member = await prisma.projectMember.findFirst({
    where: { userId, projectId }
  });
  return !!member;
};

const findDestination = async (projectId: string, destinationId: string) => {
  return prisma.destination.findFirst({
    where: { id: destinationId, projectId }
  });
};

const normalizeMatchList = (value: unknown): string[] | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return [value];
  }
  if (Array.isArray(value)) {
    const filtered = value.filter((item) => typeof item === "string") as string[];
    return filtered.length > 0 ? filtered : null;
  }
  return null;
};

const ruleMatchesEvent = (event: { eventName: string; stage: string | null }, match: any) => {
  const stageMatches = normalizeMatchList(match?.stage);
  if (stageMatches && (!event.stage || !stageMatches.includes(event.stage))) {
    return false;
  }

  const eventNameMatches =
    normalizeMatchList(match?.event_name) ?? normalizeMatchList(match?.eventName);
  if (eventNameMatches && !eventNameMatches.includes(event.eventName)) {
    return false;
  }

  if (!stageMatches && !eventNameMatches) {
    return true;
  }

  return true;
};

// GET /v1/projects/:projectId/destinations/:destinationId/rules
router.get(
  "/:projectId/destinations/:destinationId/rules",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const { projectId, destinationId } = req.params;
    if (!req.user) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }

    const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
    if (!allowed) {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    const destination = await findDestination(projectId, destinationId);
    if (!destination) {
      return res.status(404).json({ success: false, error: "not_found" });
    }

    const rules = await prisma.destinationRule.findMany({
      where: { destinationId },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
    });

    return res.json({
      success: true,
      destinationId,
      adapterKey: destination.adapterKey,
      rules
    });
  }
);

// POST /v1/projects/:projectId/destinations/:destinationId/rules
router.post(
  "/:projectId/destinations/:destinationId/rules",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const { projectId, destinationId } = req.params;
    if (!req.user) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }

    const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
    if (!allowed) {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    const destination = await findDestination(projectId, destinationId);
    if (!destination) {
      return res.status(404).json({ success: false, error: "not_found" });
    }

    const { name, isEnabled, priority, match, action } = req.body || {};
    if (!name || !match || !action) {
      return res.status(400).json({ success: false, error: "missing_fields" });
    }

    const rule = await prisma.destinationRule.create({
      data: {
        destinationId,
        name,
        isEnabled: typeof isEnabled === "boolean" ? isEnabled : true,
        priority: typeof priority === "number" ? priority : 100,
        match,
        action
      }
    });

    return res.json({ success: true, rule });
  }
);

// POST /v1/projects/:projectId/destinations/:destinationId/rules/preview
router.post(
  "/:projectId/destinations/:destinationId/rules/preview",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const { projectId, destinationId } = req.params;
    const { eventId } = req.body || {};

    if (!req.user) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }

    const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
    if (!allowed) {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    const destination = await findDestination(projectId, destinationId);
    if (!destination) {
      return res.status(404).json({ success: false, error: "not_found" });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, projectId }
    });
    if (!event) {
      return res.status(404).json({ success: false, error: "event_not_found" });
    }

    const rules = await prisma.destinationRule.findMany({
      where: { destinationId, isEnabled: true },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
    });

    const adapter = getAdapter(destination.adapterKey);
    if (!adapter) {
      return res.status(400).json({ success: false, error: "unknown_adapter" });
    }

    const matches = rules
      .filter((rule) => ruleMatchesEvent(event, rule.match))
      .map((rule) => {
        const compile = adapter.compile({ event, rule, destination });
        return {
          id: rule.id,
          name: rule.name,
          providerEventName: compile.providerEventName,
          providerRequest: compile.providerRequest,
          dropReason: compile.dropReason ?? null
        };
      });

    return res.json({
      success: true,
      destinationId,
      eventId,
      matches
    });
  }
);

// PUT /v1/projects/:projectId/destinations/:destinationId/rules/:ruleId
router.put(
  "/:projectId/destinations/:destinationId/rules/:ruleId",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const { projectId, destinationId, ruleId } = req.params;
    if (!req.user) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }

    const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
    if (!allowed) {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    const destination = await findDestination(projectId, destinationId);
    if (!destination) {
      return res.status(404).json({ success: false, error: "not_found" });
    }

    const rule = await prisma.destinationRule.findFirst({
      where: { id: ruleId, destinationId }
    });
    if (!rule) {
      return res.status(404).json({ success: false, error: "not_found" });
    }

    const { name, isEnabled, priority, match, action } = req.body || {};

    const updated = await prisma.destinationRule.update({
      where: { id: ruleId },
      data: {
        name: name ?? undefined,
        isEnabled: typeof isEnabled === "boolean" ? isEnabled : undefined,
        priority: typeof priority === "number" ? priority : undefined,
        match: match ?? undefined,
        action: action ?? undefined
      }
    });

    return res.json({ success: true, rule: updated });
  }
);

// DELETE /v1/projects/:projectId/destinations/:destinationId/rules/:ruleId
router.delete(
  "/:projectId/destinations/:destinationId/rules/:ruleId",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const { projectId, destinationId, ruleId } = req.params;
    if (!req.user) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }

    const allowed = await ensureProjectAccess(req.user.id, projectId, req.user.role);
    if (!allowed) {
      return res.status(403).json({ success: false, error: "forbidden" });
    }

    const destination = await findDestination(projectId, destinationId);
    if (!destination) {
      return res.status(404).json({ success: false, error: "not_found" });
    }

    const rule = await prisma.destinationRule.findFirst({
      where: { id: ruleId, destinationId }
    });
    if (!rule) {
      return res.status(404).json({ success: false, error: "not_found" });
    }

    await prisma.destinationRule.delete({ where: { id: ruleId } });

    return res.json({ success: true });
  }
);

export default router;
