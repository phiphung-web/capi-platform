type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

const normalizeForStableJson = (value: unknown): JsonValue => {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForStableJson(item));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();
    const normalized: Record<string, JsonValue> = {};
    for (const key of sortedKeys) {
      normalized[key] = normalizeForStableJson(record[key]);
    }
    return normalized;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
};

export const stableStringify = (value: unknown): string => {
  return JSON.stringify(normalizeForStableJson(value));
};
