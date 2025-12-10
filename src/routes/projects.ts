import { Router } from "express";
import { prisma } from "../config/database";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { requireProjectRole } from "../middleware/authorization";

const router = Router();

// GET /v1/projects - list project user có thể thấy
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  if (req.user.role === "SUPER_ADMIN") {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json({
      success: true,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt,
      })),
    });
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: req.user.id },
    include: { project: true },
  });

  return res.json({
    success: true,
    projects: memberships.map((m) => ({
      id: m.project.id,
      name: m.project.name,
      description: m.project.description,
      projectRole: m.projectRole,
    })),
  });
});

// POST /v1/projects - chỉ SUPER_ADMIN
router.post("/", authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  if (req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ success: false, error: "forbidden" });
  }

  const { name, description, domain } = req.body as {
    name?: string;
    description?: string;
    domain?: string;
  };

  if (!name) {
    return res.status(400).json({ success: false, error: "missing_name" });
  }

  const project = await prisma.project.create({
    data: {
      name,
      description: description ?? null,
      domain: domain ?? null,
    },
  });

  return res.json({ success: true, project });
});

// GET /v1/projects/:projectId - thông tin basic + destination health
router.get(
  "/:projectId",
  authMiddleware,
  requireProjectRole,
  async (req: AuthenticatedRequest, res) => {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        destinations: true,
      },
    });

    if (!project) {
      return res.status(404).json({ success: false, error: "not_found" });
    }

    return res.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        domain: project.domain,
        createdAt: project.createdAt,
        destinations: project.destinations.map((d) => ({
          id: d.id,
          type: d.type,
          isActive: d.isActive,
          healthStatus: d.healthStatus,
        })),
      },
    });
  }
);

export default router;
