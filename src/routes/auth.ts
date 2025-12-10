import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../config/database";
import { signToken } from "../config/auth";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";

const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ success: false, error: "missing_credentials" });
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, error: "invalid_credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ success: false, error: "invalid_credentials" });
  }

  const token = signToken({ userId: user.id, role: user.role });

  return res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
});

authRouter.get("/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: req.user.id },
    include: {
      project: true,
    },
  });

  return res.json({
    success: true,
    user: req.user,
    projects: memberships.map((m) => ({
      projectId: m.projectId,
      projectName: m.project.name,
      projectRole: m.projectRole,
    })),
  });
});

export default authRouter;
