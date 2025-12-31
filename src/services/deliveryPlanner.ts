import { DeliveryStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { sha256Hex } from "../utils/hash";

type MatchCriteria = {
  stage?: string | string[];
  event_name?: string | string[];
  eventName?: string | string[];
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

const ruleMatchesEvent = (event: Prisma.EventGetPayload<{}>, match: MatchCriteria) => {
  const stageMatches = normalizeMatchList(match.stage);
  if (stageMatches && (!event.stage || !stageMatches.includes(event.stage))) {
    return false;
  }

  const eventNameMatches =
    normalizeMatchList(match.event_name) ?? normalizeMatchList(match.eventName);
  if (eventNameMatches && !eventNameMatches.includes(event.eventName)) {
    return false;
  }

  if (!stageMatches && !eventNameMatches) {
    return true;
  }

  return true;
};

export const planDeliveryLogsForEvent = async (
  event: Prisma.EventGetPayload<{}>
) => {
  const destinations = await prisma.destination.findMany({
    where: {
      projectId: event.projectId,
      isActive: true,
      isEnabled: true
    },
    select: { id: true, adapterKey: true }
  });

  if (destinations.length === 0) {
    return { created: 0, skippedDuplicates: 0, destinations: [] as { id: string; status: string }[] };
  }

  const destinationIds = destinations.map((d) => d.id);
  const rules = await prisma.destinationRule.findMany({
    where: { destinationId: { in: destinationIds }, isEnabled: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
  });

  const rulesByDestination = new Map<string, typeof rules>();
  for (const rule of rules) {
    const list = rulesByDestination.get(rule.destinationId) ?? [];
    list.push(rule);
    rulesByDestination.set(rule.destinationId, list);
  }

  const logsToCreate: Prisma.DeliveryLogCreateManyInput[] = [];
  const responseDestinations: { id: string; status: string }[] = [];

  for (const destination of destinations) {
    const destRules = rulesByDestination.get(destination.id) ?? [];
    const matchedRules = destRules.filter((rule) =>
      ruleMatchesEvent(event, rule.match as MatchCriteria)
    );

    if (matchedRules.length === 0) {
      continue;
    }

    responseDestinations.push({ id: destination.id, status: "PENDING" });

    for (const rule of matchedRules) {
      const action = (rule.action || {}) as Record<string, unknown>;
      const providerEventName =
        typeof action.providerEventName === "string" && action.providerEventName.length > 0
          ? action.providerEventName
          : event.eventName;
      const uniqueDeliveryKey = `sha256:${sha256Hex(
        `${destination.id}:${event.id}:${rule.id}:${providerEventName}`
      )}`;

      logsToCreate.push({
        eventId: event.id,
        destinationId: destination.id,
        status: DeliveryStatus.PENDING,
        attemptCount: 0,
        adapterKey: destination.adapterKey,
        destinationRuleId: rule.id,
        providerEventName,
        uniqueDeliveryKey
      });
    }
  }

  if (logsToCreate.length === 0) {
    return { created: 0, skippedDuplicates: 0, destinations: responseDestinations };
  }

  const result = await prisma.deliveryLog.createMany({
    data: logsToCreate,
    skipDuplicates: true
  });

  return {
    created: result.count,
    skippedDuplicates: Math.max(0, logsToCreate.length - result.count),
    destinations: responseDestinations
  };
};
