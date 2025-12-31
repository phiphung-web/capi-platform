import { Adapter } from "./types";
import { facebookAdapter } from "./facebook";

const adapters: Record<string, Adapter> = {
  [facebookAdapter.key]: facebookAdapter
};

export const getAdapter = (key: string) => {
  return adapters[key];
};

export const listAdapters = () => Object.values(adapters);

export const registerAdapter = (adapter: Adapter) => {
  adapters[adapter.key] = adapter;
};
