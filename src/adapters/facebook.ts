import { Prisma } from "@prisma/client";
import { sha256Normalize, sha256Phone } from "../utils/hash";
import { sendFacebookCapiEvent } from "../integrations/facebookCapi";
import { Adapter, AdapterCompileResult, AdapterContext, AdapterValidationResult } from "./types";

type FacebookConfig = {
  pixel_id?: string;
  access_token?: string;
  test_event_code?: string | null;
};

type RuleAction = {
  providerEventName?: string;
  fieldMapping?: Record<string, string>;
  staticFields?: Record<string, unknown>;
  dropIfMissing?: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const getNestedValue = (obj: Record<string, unknown>, path: string) => {
  const parts = path.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
};

const setNestedValue = (obj: Record<string, unknown>, path: string, value: unknown) => {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      current[part] = value;
      return;
    }
    if (!isRecord(current[part])) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  });
};

const normalizeEventValue = (value: unknown, destPath: string) => {
  if (value instanceof Date) {
    if (destPath.endsWith("event_time") || destPath === "event_time") {
      return Math.floor(value.getTime() / 1000);
    }
    return value.toISOString();
  }
  if (typeof value === "string") {
    if (destPath.endsWith("event_time") || destPath === "event_time") {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return Math.floor(parsed / 1000);
      }
    }
  }
  return value;
};

const buildMappingContext = (event: Prisma.EventGetPayload<{}>) => {
  const valueAmount =
    typeof (event.valueAmount as any)?.toNumber === "function"
      ? (event.valueAmount as any).toNumber()
      : (event.valueAmount as any);

  return {
    eventName: event.eventName,
    event_name: event.eventName,
    eventId: event.eventId,
    event_id: event.eventId,
    eventTime: event.eventTime,
    event_time: event.eventTime,
    stage: event.stage,
    occurredAt: event.occurredAt,
    receivedAt: event.receivedAt,
    actor: {
      email: event.actorEmail,
      phone: event.actorPhone,
      external_id: event.actorExternalId,
      ip: event.actorIp,
      user_agent: event.actorUserAgent
    },
    object: {
      type: event.objectType,
      id: event.objectId
    },
    value: {
      amount: valueAmount,
      currency: event.valueCurrency
    },
    properties: event.dataJson ?? {},
    data: event.dataJson ?? {},
    user: event.userJson ?? {},
    raw: event.rawPayload ?? {}
  };
};

const applyFieldMapping = (
  context: Record<string, unknown>,
  fieldMapping: Record<string, string>,
  output: Record<string, unknown>
) => {
  for (const [destPath, sourcePath] of Object.entries(fieldMapping)) {
    const value = getNestedValue(context, sourcePath);
    if (value === undefined) {
      continue;
    }
    const normalized = normalizeEventValue(value, destPath);
    setNestedValue(output, destPath, normalized);
  }
};

const applyStaticFields = (
  staticFields: Record<string, unknown>,
  output: Record<string, unknown>
) => {
  for (const [destPath, value] of Object.entries(staticFields)) {
    setNestedValue(output, destPath, value);
  }
};

const applyDropIfMissing = (
  payload: Record<string, unknown>,
  dropIfMissing?: string[]
): string | null => {
  if (!dropIfMissing || dropIfMissing.length === 0) return null;
  for (const path of dropIfMissing) {
    const value = getNestedValue(payload, path);
    if (value === undefined || value === null || value === "") {
      return `missing_required_field:${path}`;
    }
  }
  return null;
};

const normalizeFacebookUserData = (payload: Record<string, unknown>) => {
  const userData = (payload.user_data as Record<string, unknown>) || {};
  if (typeof userData.em === "string") {
    userData.em = [sha256Normalize(userData.em)];
  } else if (Array.isArray(userData.em)) {
    userData.em = (userData.em as unknown[]).map((value) =>
      typeof value === "string" ? sha256Normalize(value) : value
    );
  }

  if (typeof userData.ph === "string") {
    userData.ph = [sha256Phone(userData.ph)];
  } else if (Array.isArray(userData.ph)) {
    userData.ph = (userData.ph as unknown[]).map((value) =>
      typeof value === "string" ? sha256Phone(value) : value
    );
  }

  payload.user_data = userData;
};

const buildLegacyPayload = (event: Prisma.EventGetPayload<{}>) => {
  const user = (event.userJson || {}) as any;
  const data = (event.dataJson || {}) as any;
  const raw = (event.rawPayload || {}) as any;

  const userData: Record<string, unknown> = {};
  if (typeof user.email === "string") userData.em = [sha256Normalize(user.email)];
  if (typeof user.phone === "string") userData.ph = [sha256Phone(user.phone)];
  if (typeof user.ip === "string") userData.client_ip_address = user.ip;
  if (typeof user.ua === "string") userData.client_user_agent = user.ua;
  if (typeof user.fbp === "string") userData.fbp = user.fbp;
  if (typeof user.fbc === "string") userData.fbc = user.fbc;

  const customData: Record<string, unknown> = {};
  if (data.value !== undefined) customData.value = data.value;
  if (data.currency !== undefined) customData.currency = data.currency;

  const url = raw?.meta?.url || data?.url || raw?.url || null;

  return {
    event_name: event.eventName,
    event_time: event.eventTime,
    event_id: event.eventId,
    action_source: "website",
    ...(url ? { event_source_url: url } : {}),
    user_data: userData,
    custom_data: customData
  };
};

export const facebookAdapter: Adapter = {
  key: "facebook",
  validateConfig(config: unknown): AdapterValidationResult {
    const errors: string[] = [];
    const cfg = (config || {}) as FacebookConfig;
    if (!cfg.pixel_id) errors.push("missing_pixel_id");
    if (!cfg.access_token) errors.push("missing_access_token");
    return { ok: errors.length === 0, errors };
  },
  validateRule(rule): AdapterValidationResult {
    const action = (rule.action || {}) as RuleAction;
    if (!action.fieldMapping && !action.staticFields) {
      return { ok: true };
    }
    if (action.fieldMapping && typeof action.fieldMapping !== "object") {
      return { ok: false, errors: ["invalid_field_mapping"] };
    }
    if (action.staticFields && typeof action.staticFields !== "object") {
      return { ok: false, errors: ["invalid_static_fields"] };
    }
    return { ok: true };
  },
  compile({ event, rule }: AdapterContext): AdapterCompileResult {
    const action = (rule.action || {}) as RuleAction;
    const providerEventName =
      typeof action.providerEventName === "string" && action.providerEventName.length > 0
        ? action.providerEventName
        : event.eventName;

    if (!action.fieldMapping && !action.staticFields) {
      const legacyPayload = buildLegacyPayload(event);
      return {
        providerEventName,
        providerRequest: { data: [legacyPayload] }
      };
    }

    const context = buildMappingContext(event) as Record<string, unknown>;
    const payload: Record<string, unknown> = {};

    if (action.staticFields && isRecord(action.staticFields)) {
      applyStaticFields(action.staticFields, payload);
    }
    if (action.fieldMapping && isRecord(action.fieldMapping)) {
      applyFieldMapping(context, action.fieldMapping, payload);
    }

    const dropReason = applyDropIfMissing(payload, action.dropIfMissing);
    if (dropReason) {
      return {
        providerEventName,
        providerRequest: { data: [payload] },
        dropReason
      };
    }

    normalizeFacebookUserData(payload);
    return {
      providerEventName,
      providerRequest: { data: [payload] }
    };
  },
  async send(request: unknown, config: unknown) {
    const cfg = (config || {}) as FacebookConfig;
    const payload = (request || {}) as Record<string, unknown>;
    if (cfg.test_event_code && !payload.test_event_code) {
      payload.test_event_code = cfg.test_event_code;
    }
    return sendFacebookCapiEvent({
      pixelId: cfg.pixel_id || "",
      accessToken: cfg.access_token || "",
      testEventCode: cfg.test_event_code ?? null,
      payload
    });
  }
};
