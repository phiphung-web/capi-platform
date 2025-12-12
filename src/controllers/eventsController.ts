import { Request, Response } from "express";
import * as eventsService from "../services/eventsService";

export const listEvents = async (_req: Request, res: Response) => {
  const events = await eventsService.listEvents();
  res.json({ events });
};

export const createEvent = async (req: Request, res: Response) => {
  try {
    const apiKeyHeader = req.header("x-api-key") || "";
    const authHeader = req.header("authorization") || req.header("Authorization") || "";
    let token = apiKeyHeader;
    if (!token && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }

    if (!token) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }

    const apiKey = await eventsService.getActiveApiKey(token);
    if (!apiKey) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }

    const result = (await eventsService.ingestEvent(
      apiKey.projectId,
      req.body
    )) as any;

    if (!result.success) {
      const status =
        typeof result.status === "number" && Number.isFinite(result.status)
          ? result.status
          : 400;

      return res.status(status).json({
        success: false,
        error: result.error ?? "unknown_error",
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("Error creating event", err);
    return res.status(500).json({ success: false, error: "internal_error" });
  }
};
