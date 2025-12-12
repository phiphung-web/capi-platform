import prisma from "../config/database";
import { sendFacebookCapiEvent } from "../integrations/facebookCapi";
import { sha256Normalize, sha256Phone } from "../utils/hash";

export async function processPendingDeliveries(limit = 20): Promise<number> {
  const logs = await prisma.deliveryLog.findMany({
    where: {
      status: "pending"
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      event: true,
      destination: true
    }
  });

  let processed = 0;

  for (const log of logs) {
    const { destination, event } = log;

    if (destination.type !== "facebook") {
      continue;
    }

    const config = destination.config as any;
    const pixelId = config?.pixel_id;
    const accessToken = config?.access_token;
    const testEventCode = config?.test_event_code;

    if (!pixelId || !accessToken) {
      await prisma.deliveryLog.update({
        where: { id: log.id },
        data: {
          status: "failed",
          attempts: log.attempts + 1,
          lastError: "missing_pixel_config"
        }
      });
      processed += 1;
      continue;
    }

    const user = (event.userJson || {}) as any;
    const data = (event.dataJson || {}) as any;
    const raw = (event.rawPayload || {}) as any;

    const userData: Record<string, unknown> = {};
    if (typeof user.email === "string") {
      userData.em = [sha256Normalize(user.email)];
    }
    if (typeof user.phone === "string") {
      userData.ph = [sha256Phone(user.phone)];
    }
    if (typeof user.ip === "string") {
      userData.client_ip_address = user.ip;
    }
    if (typeof user.ua === "string") {
      userData.client_user_agent = user.ua;
    }
    if (typeof user.fbp === "string") {
      userData.fbp = user.fbp;
    }
    if (typeof user.fbc === "string") {
      userData.fbc = user.fbc;
    }

    const customData: Record<string, unknown> = {};
    if (data.value !== undefined) customData.value = data.value;
    if (data.currency !== undefined) customData.currency = data.currency;

    const url =
      raw?.meta?.url ||
      data?.url ||
      raw?.url ||
      null;

    const fbPayload = {
      data: [
        {
          event_name: event.eventName,
          event_time: event.eventTime,
          event_id: event.eventId,
          action_source: "website",
          ...(url ? { event_source_url: url } : {}),
          user_data: userData,
          custom_data: customData
        }
      ],
      ...(testEventCode ? { test_event_code: testEventCode } : {})
    };

    const result = await sendFacebookCapiEvent({
      pixelId,
      accessToken,
      testEventCode,
      payload: fbPayload
    });

    await prisma.deliveryLog.update({
      where: { id: log.id },
      data: {
        status: result.ok ? "success" : "failed",
        attempts: log.attempts + 1,
        lastResponse: result.json ?? null,
        lastError: result.errorText ? result.errorText.slice(0, 2000) : null
      }
    });

    processed += 1;
  }

  return processed;
}
