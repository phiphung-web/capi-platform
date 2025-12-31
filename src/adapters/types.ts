import { Prisma } from "@prisma/client";

export type AdapterContext = {
  event: Prisma.EventGetPayload<{}>;
  rule: Prisma.DestinationRuleGetPayload<{}>;
  destination: Prisma.DestinationGetPayload<{}>;
};

export type AdapterSendResult = {
  ok: boolean;
  status?: number;
  json?: unknown;
  errorText?: string | null;
};

export type AdapterCompileResult = {
  providerEventName: string;
  providerRequest: unknown;
  dropReason?: string | null;
};

export type AdapterValidationResult = {
  ok: boolean;
  errors?: string[];
};

export interface Adapter {
  key: string;
  validateConfig(config: unknown): AdapterValidationResult;
  validateRule(rule: Prisma.DestinationRuleGetPayload<{}>): AdapterValidationResult;
  compile(context: AdapterContext): AdapterCompileResult;
  send(request: unknown, config: unknown): Promise<AdapterSendResult>;
}
