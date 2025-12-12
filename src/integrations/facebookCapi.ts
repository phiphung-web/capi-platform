import fetch from "node-fetch";

export async function sendFacebookCapiEvent(params: {
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;
  payload: any;
}) {
  const url = `https://graph.facebook.com/v18.0/${params.pixelId}/events?access_token=${encodeURIComponent(
    params.accessToken
  )}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params.payload)
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // ignore parse errors
  }

  if (!res.ok) {
    return { ok: false, status: res.status, json, errorText: JSON.stringify(json ?? {}) };
  }

  return { ok: true, status: res.status, json, errorText: null };
}
