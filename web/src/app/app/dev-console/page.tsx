"use client";

 "use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type EventResp = {
  success: boolean;
  event: any;
};

type DeliveriesResp = {
  success: boolean;
  deliveries: {
    id: string;
    status: string;
    errorMessage: string | null;
    destination: { id: string; type: string; healthStatus: string; isActive: boolean };
    createdAt: string;
    updatedAt: string;
  }[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/v1";
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN ?? "";

export default function DevConsolePage() {
  const { token } = useAuth();
  const { currentProjectId } = useCurrentProject();

  const [eventName, setEventName] = useState("Lead");
  const [eventId, setEventId] = useState(() => Date.now().toString());
  const [eventTime, setEventTime] = useState(() => Math.floor(Date.now() / 1000).toString());
  const [sourceTag, setSourceTag] = useState("local_test_ui");
  const [userJsonText, setUserJsonText] = useState(
    JSON.stringify(
      {
        email: "test@example.com",
        phone: "0987",
        ip: "1.2.3.4",
        ua: "Mozilla/5.0",
        fbp: "fb.1.123",
        fbc: "fb.1.456"
      },
      null,
      2
    )
  );
  const [dataJsonText, setDataJsonText] = useState(
    JSON.stringify({ value: 500000, currency: "VND" }, null, 2)
  );
  const [rawPayloadText, setRawPayloadText] = useState(
    JSON.stringify({ meta: { url: "https://example.com/landing" } }, null, 2)
  );

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<any>(null);
  const [eventInternalId, setEventInternalId] = useState<string | null>(null);

  const [processing, setProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState<number | null>(null);

  const [loadedEvent, setLoadedEvent] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<DeliveriesResp["deliveries"]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<string | null>(null);
  const [projectApiKey, setProjectApiKey] = useState<string | null>(null);
  const [loadingApiKey, setLoadingApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const storageKey = currentProjectId ? `capi_api_key_${currentProjectId}` : null;

  const parsedUserError = useMemo(() => {
    try {
      JSON.parse(userJsonText || "{}");
      return null;
    } catch (err: any) {
      return err?.message || "Invalid JSON";
    }
  }, [userJsonText]);

  const parsedDataError = useMemo(() => {
    try {
      JSON.parse(dataJsonText || "{}");
      return null;
    } catch (err: any) {
      return err?.message || "Invalid JSON";
    }
  }, [dataJsonText]);

  const parsedRawError = useMemo(() => {
    try {
      JSON.parse(rawPayloadText || "{}");
      return null;
    } catch (err: any) {
      return err?.message || "Invalid JSON";
    }
  }, [rawPayloadText]);

  const loadEventAndDeliveries = async (evtId: string) => {
    if (!token || !currentProjectId) return;
    setLoadError(null);
    const { data: eventData, error: eventErr } = await apiFetch<EventResp>(
      `/projects/${currentProjectId}/events/${evtId}`,
      { token }
    );
    if (eventErr || !eventData?.success) {
      setLoadError(eventErr ?? "Không tải được event");
    } else {
      setLoadedEvent(eventData.event);
    }

    const { data: delData, error: delErr } = await apiFetch<DeliveriesResp>(
      `/projects/${currentProjectId}/events/${evtId}/deliveries`,
      { token }
    );
    if (delErr || !delData?.success) {
      setLoadError((prev) => prev ?? delErr ?? "Không tải được deliveries");
    } else {
      setDeliveries(delData.deliveries);
    }
  };

  const handleSend = async () => {
    if (!token || !currentProjectId || !projectApiKey) return;
    if (parsedUserError || parsedDataError || parsedRawError) {
      setSendError("JSON không hợp lệ");
      return;
    }
    setSending(true);
    setSendError(null);
    setSendResult(null);
    setEventInternalId(null);
    setLoadedEvent(null);
    setDeliveries([]);
    try {
      const user = userJsonText ? JSON.parse(userJsonText) : {};
      const data = dataJsonText ? JSON.parse(dataJsonText) : {};
      const rawPayload = rawPayloadText ? JSON.parse(rawPayloadText) : {};
      const body = {
        mode: "direct",
        projectId: currentProjectId,
        event_name: eventName,
        event_id: eventId,
        event_time: Number(eventTime),
        source: sourceTag,
        user,
        data,
        raw_payload: rawPayload
      };
      const res = await fetch(`${API_BASE_URL}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": projectApiKey
        },
        body: JSON.stringify(body)
      });
      let json: any = null;
      try {
        json = await res.json();
      } catch {}
      if (!res.ok || !json?.success) {
        setSendError(json?.error ?? `Request failed ${res.status}`);
      } else {
        setSendResult(json);
        const evtId = json.event_internal_id || json.eventId || null;
        setEventInternalId(evtId);
        if (evtId) {
          await loadEventAndDeliveries(evtId);
        }
      }
    } catch (err: any) {
      setSendError(err?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    setProcessedCount(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/process-deliveries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": ADMIN_TOKEN
        }
      });
      let json: any = null;
      try {
        json = await res.json();
      } catch {}
      if (json?.success) {
        setProcessedCount(json.processed ?? 0);
        if (eventInternalId) {
          await loadEventAndDeliveries(eventInternalId);
        }
      } else {
        setSendError(json?.error ?? "Process failed");
      }
    } catch (err: any) {
      setSendError(err?.message || "Process failed");
    } finally {
      setProcessing(false);
    }
  };

  if (!token) return <div>Cần đăng nhập.</div>;
  if (!currentProjectId) return <div>Chưa chọn project.</div>;

  const handleCreateApiKey = async () => {
    if (!token || !currentProjectId) return;
    setApiKeyError(null);
    setLoadingApiKey(true);
    const { data, error } = await apiFetch<{
      success: boolean;
      apiKey: { id: string; name: string; prefix: string; key: string };
    }>(`/projects/${currentProjectId}/api-keys`, {
      method: "POST",
      token,
      body: JSON.stringify({ name: "Dev Console Key" })
    });
    setLoadingApiKey(false);
    if (error || !data?.success) {
      setApiKeyError(error ?? "Tạo API key thất bại");
    } else {
      setProjectApiKey(data.apiKey.key);
      setApiKeyStatus("API key ready");
      if (storageKey) {
        localStorage.setItem(storageKey, data.apiKey.key);
      }
    }
  };

  useEffect(() => {
    const loadApiKey = async () => {
      if (!token || !currentProjectId || !storageKey) return;
      setApiKeyError(null);
      setApiKeyStatus(null);
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        setProjectApiKey(cached);
        setApiKeyStatus("API key ready");
        return;
      }
      setLoadingApiKey(true);
      const { data, error } = await apiFetch<{
        success: boolean;
        apiKeys: { id: string; name: string; prefix: string; isActive: boolean }[];
      }>(`/projects/${currentProjectId}/api-keys`, { token });
      setLoadingApiKey(false);
      if (error || !data?.success) {
        setApiKeyError(error ?? "Không tải được API keys");
        return;
      }
      if (data.apiKeys.length === 0) {
        setApiKeyStatus("Chưa có API key");
      } else {
        setApiKeyStatus(
          "API key đã tồn tại nhưng không xem lại được. Tạo key mới để dùng Dev Console."
        );
      }
    };
    loadApiKey();
  }, [token, currentProjectId, storageKey]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dev Console</h1>
        <p className="text-sm text-slate-300">Gửi event test và xử lý deliveries.</p>
      </div>

      {sendError ? <Alert title="Error">{sendError}</Alert> : null}
      {loadError ? <Alert title="Error">{loadError}</Alert> : null}

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle>Send Event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <Input label="event_name" value={eventName} onChange={(e) => setEventName(e.target.value)} />
              <Input label="event_id" value={eventId} onChange={(e) => setEventId(e.target.value)} />
              <Input
                label="event_time (unix)"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
              />
              <Input label="source" value={sourceTag} onChange={(e) => setSourceTag(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200">user JSON</label>
              <Textarea
                value={userJsonText}
                onChange={(e) => setUserJsonText(e.target.value)}
                className={parsedUserError ? "border-rose-500" : ""}
                minLength={3}
              />
              {parsedUserError ? (
                <div className="text-xs text-rose-400">{parsedUserError}</div>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200">data JSON</label>
              <Textarea
                value={dataJsonText}
                onChange={(e) => setDataJsonText(e.target.value)}
                className={parsedDataError ? "border-rose-500" : ""}
              />
              {parsedDataError ? (
                <div className="text-xs text-rose-400">{parsedDataError}</div>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200">raw_payload JSON</label>
              <Textarea
                value={rawPayloadText}
                onChange={(e) => setRawPayloadText(e.target.value)}
                className={parsedRawError ? "border-rose-500" : ""}
              />
              {parsedRawError ? (
                <div className="text-xs text-rose-400">{parsedRawError}</div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={handleSend} disabled={sending || !projectApiKey}>
                {sending ? "Sending..." : "Send Event"}
              </Button>
              <Button onClick={handleProcess} disabled={processing}>
                {processing ? "Processing..." : "Process Deliveries"}
              </Button>
            </div>
            {processedCount !== null ? (
              <div className="text-sm text-slate-300">Processed: {processedCount}</div>
            ) : null}
            {sendResult ? (
              <div className="space-y-1">
                <div className="text-sm font-semibold">Send Result</div>
                <pre className="bg-slate-950 border border-slate-800 rounded-md p-3 text-xs overflow-auto max-h-56">
                  {JSON.stringify(sendResult, null, 2)}
                </pre>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle>Project API Key</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {apiKeyStatus ? <div>{apiKeyStatus}</div> : null}
              {apiKeyError ? <Alert title="Error">{apiKeyError}</Alert> : null}
              {projectApiKey ? (
                <div className="space-y-1">
                  <div className="text-xs text-slate-400">Lưu ý: key chỉ hiện tại client.</div>
                  <pre className="bg-slate-950 border border-slate-800 rounded-md p-2 text-xs break-all">
                    {projectApiKey}
                  </pre>
                </div>
              ) : (
                <Button onClick={handleCreateApiKey} disabled={loadingApiKey}>
                  {loadingApiKey ? "Creating..." : "Create API Key"}
                </Button>
              )}
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle>Event Detail</CardTitle>
            </CardHeader>
            <CardContent>
              {loadedEvent ? (
                <pre className="bg-slate-950 border border-slate-800 rounded-md p-3 text-xs overflow-auto max-h-80">
                  {JSON.stringify(loadedEvent, null, 2)}
                </pre>
              ) : (
                <div className="text-sm text-slate-400">Chưa có event.</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle>Delivery Logs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {deliveries.length === 0 ? (
                <div className="text-sm text-slate-400">Chưa có delivery logs.</div>
              ) : (
                <div className="space-y-3">
                  {deliveries.map((d) => (
                    <div
                      key={d.id}
                      className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm"
                    >
                      <div className="flex justify-between">
                        <div>
                          <div className="font-medium">{d.destination.type}</div>
                          <div className="text-xs text-slate-400">
                            {new Date(d.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-xs uppercase">{d.status}</div>
                      </div>
                      {d.errorMessage ? (
                        <pre className="mt-2 text-xs text-rose-300 whitespace-pre-wrap">
                          {d.errorMessage}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
