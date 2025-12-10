import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./authMiddleware";
import { prisma } from "../config/database";

export function requireSuperAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user || req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ success: false, error: "forbidden" });
  }
  return next();
}

export async function requireProjectRole(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const projectId =
    (req.params.projectId as string) ||
    (req.query.projectId as string) ||
    (req.body && (req.body.projectId as string));

  if (!req.user) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  if (!projectId) {
    return res.status(400).json({ success: false, error: "missing_project_id" });
  }

  if (req.user.role === "SUPER_ADMIN") {
    return next();
  }

  const member = await prisma.projectMember.findFirst({
    where: {
      userId: req.user.id,
      projectId,
    },
  });

  if (!member) {
    return res.status(403).json({ success: false, error: "forbidden" });
  }

  return next();
}
