"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type Delivery = {
  id: string;
  status: string;
  errorMessage: string | null;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  providerStatusCode: number | null;
  destinationRuleId: string | null;
  adapterKey: string;
  destination: {
    id: string;
    type: string;
    adapterKey: string;
    isActive: boolean;
    isEnabled: boolean;
  };
  createdAt: string;
};

type DeliveryResp = {
  success: boolean;
  deliveries: Delivery[];
};

const statuses = ["PENDING", "PROCESSING", "RETRYING", "SUCCESS", "FAILED", "DEAD"];

export default function DeliveryLogsPage() {
  const { token } = useAuth();
  const { currentProjectId } = useCurrentProject();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [status, setStatus] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDeliveries = async () => {
    if (!token || !currentProjectId) return;
    setLoading(true);
    setError(null);
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (destinationId) query.set("destinationId", destinationId);
    if (ruleId) query.set("ruleId", ruleId);
    const { data, error } = await apiFetch<DeliveryResp>(
      `/projects/${currentProjectId}/delivery-logs?${query.toString()}`,
      { token }
    );
    setLoading(false);
    if (error || !data?.success) {
      setError(error ?? "Load delivery logs failed");
      return;
    }
    setDeliveries(data.deliveries);
  };

  useEffect(() => {
    loadDeliveries();
  }, [token, currentProjectId]);

  const handleRequeue = async (deliveryId: string) => {
    if (!token || !currentProjectId) return;
    await apiFetch(`/projects/${currentProjectId}/delivery-logs/${deliveryId}/requeue`, {
      method: "POST",
      token
    });
    await loadDeliveries();
  };

  const handleDisableDestination = async (destinationId: string) => {
    if (!token || !currentProjectId) return;
    await apiFetch(`/projects/${currentProjectId}/destinations/${destinationId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ isEnabled: false })
    });
    await loadDeliveries();
  };

  const handleDisableRule = async (destinationId: string, ruleId: string) => {
    if (!token || !currentProjectId) return;
    await apiFetch(`/projects/${currentProjectId}/destinations/${destinationId}/rules/${ruleId}`, {
      method: "PUT",
      token,
      body: JSON.stringify({ isEnabled: false })
    });
    await loadDeliveries();
  };

  if (!currentProjectId) return <div>No project selected.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Delivery Logs</h1>
        <p className="text-sm text-slate-300">Monitor delivery retries and outcomes.</p>
      </div>

      {error ? <Alert title="Error">{error}</Alert> : null}

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <select
              className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Input
              placeholder="Destination ID"
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
            />
            <Input
              placeholder="Rule ID"
              value={ruleId}
              onChange={(e) => setRuleId(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={loadDeliveries} disabled={loading}>
              {loading ? "Loading..." : "Apply Filters"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deliveries.length === 0 ? (
            <div className="text-sm text-slate-400">No delivery logs found.</div>
          ) : (
            deliveries.map((log) => (
              <div key={log.id} className="rounded border border-slate-800 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {log.destination.type} ({log.adapterKey})
                    </div>
                    <div className="text-xs text-slate-400">Status: {log.status}</div>
                  </div>
                  <div className="flex gap-2">
                    {log.status === "DEAD" ? (
                      <Button variant="secondary" onClick={() => handleRequeue(log.id)}>
                        Requeue
                      </Button>
                    ) : null}
                    {log.destination.isEnabled ? (
                      <Button
                        variant="secondary"
                        onClick={() => handleDisableDestination(log.destination.id)}
                      >
                        Disable Destination
                      </Button>
                    ) : null}
                    {log.destinationRuleId ? (
                      <Button
                        variant="secondary"
                        onClick={() => handleDisableRule(log.destination.id, log.destinationRuleId!)}
                      >
                        Disable Rule
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 grid md:grid-cols-2 gap-2 text-xs text-slate-400">
                  <div>Attempts: {log.attemptCount}</div>
                  <div>Next: {log.nextAttemptAt ? new Date(log.nextAttemptAt).toLocaleString() : "-"}</div>
                  <div>Last: {log.lastAttemptAt ? new Date(log.lastAttemptAt).toLocaleString() : "-"}</div>
                  <div>Provider Status: {log.providerStatusCode ?? "-"}</div>
                  <div>Rule: {log.destinationRuleId ?? "-"}</div>
                  <div>Destination: {log.destination.id}</div>
                </div>
                {log.errorMessage ? (
                  <pre className="mt-2 text-xs text-rose-300 whitespace-pre-wrap">
                    {log.errorMessage}
                  </pre>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
