import { Router } from "express";
import { prisma } from "../config/database";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();

// GET /v1/projects
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  if (req.user.role === "SUPER_ADMIN") {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" }
    });
    return res.json({
      success: true,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt
      }))
    });
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: req.user.id },
    include: { project: true }
  });

  return res.json({
    success: true,
    projects: memberships.map((m) => ({
      id: m.project.id,
      name: m.project.name,
      description: m.project.description,
      projectRole: m.projectRole,
      createdAt: m.project.createdAt
    }))
  });
});

// POST /v1/projects
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
      domain: domain ?? null
    }
  });

  await prisma.projectMember.create({
    data: {
      userId: req.user.id,
      projectId: project.id,
      projectRole: "PROJECT_MANAGER"
    }
  });

  return res.json({
    success: true,
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      domain: project.domain,
      createdAt: project.createdAt
    }
  });
});

export default router;
