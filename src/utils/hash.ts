import crypto from "crypto";

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function sha256Normalize(value: string): string {
  const normalized = value.trim().toLowerCase();
  return sha256Hex(normalized);
}

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/\s+/g, "");
}

export function sha256Phone(phone: string): string {
  return sha256Normalize(normalizePhone(phone));
}
