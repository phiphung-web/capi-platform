"use client";

import { useMemo, useState } from "react";
import { Play, Rocket, Zap, Wand2 } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { JsonEditor } from "./json-editor";
import { Badge } from "./ui/badge";
import { Alert } from "./ui/alert";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/v1";

type ResponseState = {
  status?: number;
  timeMs?: number;
  body?: unknown;
};

type DirectForm = {
  event_name: string;
  event_id: string;
  event_time: string;
  source: string;
  userJsonText: string;
  dataJsonText: string;
};

type MappedForm = {
  event_key: string;
  payloadText: string;
};

const pretty = (val: unknown) => {
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
};

export function ApiTester() {
  const [apiKey, setApiKey] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [baseUrl, setBaseUrl] = useState(API_BASE_URL);
  const [mode, setMode] = useState<"direct" | "mapped">("direct");
  const [directForm, setDirectForm] = useState<DirectForm>({
    event_name: "Lead",
    event_id: "",
    event_time: "",
    source: "local_test_ui",
    userJsonText: JSON.stringify({ email: "test@example.com", phone: "0987" }, null, 2),
    dataJsonText: JSON.stringify({ value: 500000, currency: "VND" }, null, 2)
  });
  const [mappedForm, setMappedForm] = useState<MappedForm>({
    event_key: "ladipage_lp_a",
    payloadText: JSON.stringify(
      {
        email: "test@example.com",
        phone_number: "0987",
        price: 1000000,
        utm_source: "facebook"
      },
      null,
      2
    )
  });
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const directJsonErrors = useMemo(() => {
    const errors: { user?: string; data?: string } = {};
    try {
      JSON.parse(directForm.userJsonText || "{}");
    } catch {
      errors.user = "Invalid JSON";
    }
    try {
      JSON.parse(directForm.dataJsonText || "{}");
    } catch {
      errors.data = "Invalid JSON";
    }
    return errors;
  }, [directForm.userJsonText, directForm.dataJsonText]);

  const mappedJsonError = useMemo(() => {
    try {
      JSON.parse(mappedForm.payloadText || "{}");
      return null;
    } catch (err: any) {
      return err?.message || "Invalid JSON";
    }
  }, [mappedForm.payloadText]);

  const sendRequest = async (path: string, init: RequestInit) => {
    const started = performance.now();
    const res = await fetch(path, init);
    const timeMs = Math.round(performance.now() - started);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    setResponse({ status: res.status, timeMs, body });
    return res;
  };

  const handleSendDirect = async () => {
    setErrorMessage(null);
    if (directJsonErrors.user || directJsonErrors.data) {
      setErrorMessage("User/Data JSON không hợp lệ.");
      return;
    }
    if (!apiKey) {
      setErrorMessage("Vui lòng nhập API Key.");
      return;
    }

    try {
      const user = directForm.userJsonText ? JSON.parse(directForm.userJsonText) : {};
      const data = directForm.dataJsonText ? JSON.parse(directForm.dataJsonText) : {};

      const body: any = {
        mode: "direct",
        event_name: directForm.event_name,
        source: directForm.source || "local_test_ui",
        user,
        data
      };

      if (directForm.event_id) body.event_id = directForm.event_id;
      if (directForm.event_time) body.event_time = Number(directForm.event_time);

      setLoading(true);
      await sendRequest(`${baseUrl}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });
    } catch (err: any) {
      setErrorMessage(err?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMapped = async () => {
    setErrorMessage(null);
    if (mappedJsonError) {
      setErrorMessage("Payload JSON không hợp lệ.");
      return;
    }
    if (!apiKey) {
      setErrorMessage("Vui lòng nhập API Key.");
      return;
    }
    try {
      const payload = mappedForm.payloadText ? JSON.parse(mappedForm.payloadText) : {};

      const body = {
        mode: "mapped" as const,
        event_key: mappedForm.event_key,
        payload
      };

      setLoading(true);
      await sendRequest(`${baseUrl}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });
    } catch (err: any) {
      setErrorMessage(err?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleProcessDeliveries = async () => {
    setErrorMessage(null);
    if (!adminToken) {
      setErrorMessage("Vui lòng nhập Admin Token.");
      return;
    }
    try {
      setLoading(true);
      await sendRequest(`${baseUrl}/admin/process-deliveries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken
        }
      });
    } catch (err: any) {
      setErrorMessage(err?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const statusVariant =
    response?.status && response.status >= 200 && response.status < 300
      ? "success"
      : response?.status && response.status >= 400 && response.status < 500
      ? "warning"
      : response?.status
      ? "error"
      : "default";

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-6">
      <header className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-4 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">
          <Wand2 className="h-3 w-3" /> Dev Console
        </div>
        <h1 className="text-3xl font-semibold text-white">CAPI Dev Console</h1>
        <p className="text-slate-400">Test events & deliveries for CAPI platform</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Nhập API key và admin token để gọi backend.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-1">
            <label className="text-sm text-slate-200">API Key</label>
            <Input
              placeholder="sk_live_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-1">
            <label className="text-sm text-slate-200">Admin Token</label>
            <Input
              placeholder="admin token"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-1">
            <label className="text-sm text-slate-200">API Base URL</label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">
            <Zap className="mr-2 h-4 w-4" /> Test Events
          </TabsTrigger>
          <TabsTrigger value="deliveries">
            <Rocket className="mr-2 h-4 w-4" /> Process Deliveries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Send Event</CardTitle>
              <CardDescription>Thử gửi event mode direct hoặc mapped.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm text-slate-200">Mode</label>
                <div className="inline-flex gap-2">
                  <Button
                    type="button"
                    variant={mode === "direct" ? "primary" : "secondary"}
                    onClick={() => setMode("direct")}
                  >
                    Direct
                  </Button>
                  <Button
                    type="button"
                    variant={mode === "mapped" ? "primary" : "secondary"}
                    onClick={() => setMode("mapped")}
                  >
                    Mapped
                  </Button>
                </div>
              </div>

              {mode === "direct" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-200">event_name</label>
                      <Input
                        value={directForm.event_name}
                        onChange={(e) =>
                          setDirectForm((f) => ({ ...f, event_name: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-200">event_id (optional)</label>
                      <Input
                        value={directForm.event_id}
                        onChange={(e) =>
                          setDirectForm((f) => ({ ...f, event_id: e.target.value }))
                        }
                        placeholder="auto if blank"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-200">event_time (unix, optional)</label>
                      <Input
                        type="number"
                        value={directForm.event_time}
                        onChange={(e) =>
                          setDirectForm((f) => ({ ...f, event_time: e.target.value }))
                        }
                        placeholder={`${Math.floor(Date.now() / 1000)}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-200">source</label>
                      <Input
                        value={directForm.source}
                        onChange={(e) =>
                          setDirectForm((f) => ({ ...f, source: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <JsonEditor
                    label="user JSON"
                    value={directForm.userJsonText}
                    onChange={(val) => setDirectForm((f) => ({ ...f, userJsonText: val }))}
                    error={directJsonErrors.user || null}
                  />
                  <JsonEditor
                    label="data JSON"
                    value={directForm.dataJsonText}
                    onChange={(val) => setDirectForm((f) => ({ ...f, dataJsonText: val }))}
                    error={directJsonErrors.data || null}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleSendDirect}
                      disabled={loading}
                      className="gap-2"
                    >
                      <Play className="h-4 w-4" /> Send Event (direct)
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-200">event_key</label>
                    <Input
                      value={mappedForm.event_key}
                      onChange={(e) =>
                        setMappedForm((f) => ({ ...f, event_key: e.target.value }))
                      }
                    />
                  </div>
                  <JsonEditor
                    label="payload JSON"
                    value={mappedForm.payloadText}
                    onChange={(val) => setMappedForm((f) => ({ ...f, payloadText: val }))}
                    error={mappedJsonError}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleSendMapped}
                      disabled={loading}
                      className="gap-2"
                    >
                      <Play className="h-4 w-4" /> Send Event (mapped)
                    </Button>
                  </div>
                </div>
              )}

              {errorMessage ? <Alert title="Lỗi">{errorMessage}</Alert> : null}

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-slate-200">Response</h3>
                  {response?.status !== undefined ? (
                    <Badge variant={statusVariant as any}>
                      HTTP {response.status}
                    </Badge>
                  ) : null}
                  {response?.timeMs !== undefined ? <Badge>~{response.timeMs} ms</Badge> : null}
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <pre className="max-h-80 overflow-auto text-sm text-slate-100">
                    {response?.body ? pretty(response.body) : "No response yet."}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliveries">
          <Card>
            <CardHeader>
              <CardTitle>Process Deliveries</CardTitle>
              <CardDescription>
                Gọi POST /v1/admin/process-deliveries với header x-admin-token.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-200">Admin Token</label>
                <Input
                  value={adminToken}
                  onChange={(e) => setAdminToken(e.target.value)}
                  placeholder="admin token"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleProcessDeliveries}
                  disabled={loading}
                  className="gap-2"
                >
                  <Rocket className="h-4 w-4" /> Run Worker Once
                </Button>
              </div>

              {errorMessage ? <Alert title="Lỗi">{errorMessage}</Alert> : null}

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-slate-200">Response</h3>
                  {response?.status !== undefined ? (
                    <Badge variant={statusVariant as any}>HTTP {response.status}</Badge>
                  ) : null}
                  {response?.timeMs !== undefined ? <Badge>~{response.timeMs} ms</Badge> : null}
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <pre className="max-h-80 overflow-auto text-sm text-slate-100">
                    {response?.body ? pretty(response.body) : "No response yet."}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
