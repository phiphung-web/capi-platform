import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../config/auth";
import { prisma } from "../config/database";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.header("Authorization") || req.header("authorization") || "";
  const [, token] = authHeader.split(" ");

  if (!token) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  try {
    const payload = verifyToken(token) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (err) {
    console.error("authMiddleware error", err);
    return res.status(401).json({ success: false, error: "unauthorized" });
  }
}
