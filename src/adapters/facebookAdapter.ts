import fetch from 'node-fetch';
import crypto from 'crypto';
import { Destination, Event } from '@prisma/client';

export type AdapterResultStatus = 'success' | 'retry' | 'failed';

export interface AdapterResult {
  status: AdapterResultStatus;
  response?: any;
  errorMessage?: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hashSha256 = (value: string) =>
  crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');

export async function sendFacebookEvent(
  event: Event,
  destination: Destination
): Promise<AdapterResult> {
  const config = (isObject(destination.config) ? destination.config : {}) as Record<
    string,
    unknown
  >;

  const pixelId = typeof config.pixel_id === 'string' ? config.pixel_id.trim() : '';
  const accessToken =
    typeof config.access_token === 'string' ? config.access_token.trim() : '';
  const testEventCode =
    typeof config.test_event_code === 'string' ? config.test_event_code.trim() : undefined;

  if (!pixelId || !accessToken) {
    return { status: 'failed', errorMessage: 'Missing pixel_id or access_token' };
  }

  const userDataRaw = isObject(event.userJson) ? { ...event.userJson } : {};
  const customDataRaw = isObject(event.dataJson) ? { ...event.dataJson } : {};

  const userData: Record<string, unknown> = { ...userDataRaw };

  const emailRaw = typeof userDataRaw.email === 'string' ? userDataRaw.email : null;
  const phoneRaw = typeof userDataRaw.phone === 'string' ? userDataRaw.phone : null;
  const ipRaw = typeof userDataRaw.ip === 'string' ? userDataRaw.ip : null;
  const userAgentRaw = typeof userDataRaw.user_agent === 'string' ? userDataRaw.user_agent : null;

  if (emailRaw) {
    userData.em = [hashSha256(emailRaw)];
    delete userData.email;
  }

  if (phoneRaw) {
    userData.ph = [hashSha256(phoneRaw)];
    delete userData.phone;
  }

  if (ipRaw) {
    userData.client_ip_address = ipRaw;
    delete userData.ip;
  }

  if (userAgentRaw) {
    userData.client_user_agent = userAgentRaw;
    delete userData.user_agent;
  }

  const customData: Record<string, unknown> = {};

  if (customDataRaw.value !== undefined) {
    customData.value = customDataRaw.value as unknown;
  }
  if (customDataRaw.currency !== undefined) {
    customData.currency = customDataRaw.currency as unknown;
  }
  if (customDataRaw.order_id !== undefined) {
    customData.order_id = customDataRaw.order_id as unknown;
  }

  Object.entries(customDataRaw).forEach(([key, value]) => {
    if (key === 'value' || key === 'currency' || key === 'order_id') {
      return;
    }
    customData[`meta_${key}`] = value;
  });

  const body = {
    data: [
      {
        event_name: event.eventName,
        event_time: event.eventTime,
        event_id: event.eventId,
        user_data: userData,
        custom_data: customData,
        action_source: 'website'
      }
    ],
    ...(testEventCode ? { test_event_code: testEventCode } : {})
  };

  const url = `https://graph.facebook.com/v17.0/${encodeURIComponent(
    pixelId
  )}/events?access_token=${encodeURIComponent(accessToken)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    let parsed: any;
    try {
      parsed = await response.json();
    } catch {
      parsed = await response.text();
    }

    if (response.ok && parsed && typeof parsed === 'object' && parsed.events_received > 0) {
      return { status: 'success', response: parsed };
    }

    if (response.status >= 500 && response.status <= 599) {
      return { status: 'retry', errorMessage: 'temporary_error', response: parsed };
    }

    return { status: 'failed', errorMessage: 'client_error', response: parsed };
  } catch (err: any) {
    return {
      status: 'retry',
      errorMessage: 'temporary_error',
      response: err?.message || err
    };
  }
}
