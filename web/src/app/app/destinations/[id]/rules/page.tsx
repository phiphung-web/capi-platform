"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";

type Rule = {
  id: string;
  name: string;
  isEnabled: boolean;
  priority: number;
  match: any;
  action: any;
  createdAt: string;
};

type RulesResp = {
  success: boolean;
  destinationId: string;
  adapterKey: string;
  rules: Rule[];
};

type PreviewResp = {
  success: boolean;
  matches: {
    id: string;
    name: string;
    providerEventName: string;
    providerRequest: any;
    dropReason: string | null;
  }[];
};

export default function DestinationRulesPage({ params }: { params: { id: string } }) {
  const { token } = useAuth();
  const { currentProjectId } = useCurrentProject();
  const destinationId = params.id;
  const [rules, setRules] = useState<Rule[]>([]);
  const [adapterKey, setAdapterKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [priority, setPriority] = useState("100");
  const [matchJson, setMatchJson] = useState('{"stage":["LEAD"]}');
  const [actionJson, setActionJson] = useState(
    JSON.stringify(
      {
        providerEventName: "Lead",
        fieldMapping: {
          event_time: "occurredAt",
          event_name: "eventName",
          "user_data.em": "actor.email",
          "user_data.ph": "actor.phone",
          "custom_data.value": "value.amount",
          "custom_data.currency": "value.currency"
        }
      },
      null,
      2
    )
  );

  const [eventId, setEventId] = useState("");
  const [preview, setPreview] = useState<PreviewResp["matches"]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const matchError = useMemo(() => {
    try {
      JSON.parse(matchJson || "{}");
      return null;
    } catch (err: any) {
      return err?.message || "Invalid JSON";
    }
  }, [matchJson]);

  const actionError = useMemo(() => {
    try {
      JSON.parse(actionJson || "{}");
      return null;
    } catch (err: any) {
      return err?.message || "Invalid JSON";
    }
  }, [actionJson]);

  const loadRules = async () => {
    if (!token || !currentProjectId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await apiFetch<RulesResp>(
      `/projects/${currentProjectId}/destinations/${destinationId}/rules`,
      { token }
    );
    setLoading(false);
    if (error || !data?.success) {
      setError(error ?? "Load rules failed");
      return;
    }
    setRules(data.rules);
    setAdapterKey(data.adapterKey);
  };

  useEffect(() => {
    loadRules();
  }, [token, currentProjectId, destinationId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentProjectId) return;
    if (matchError || actionError) return;
    setSaving(true);
    setError(null);
    const match = JSON.parse(matchJson || "{}");
    const action = JSON.parse(actionJson || "{}");
    const { error } = await apiFetch(
      `/projects/${currentProjectId}/destinations/${destinationId}/rules`,
      {
        method: "POST",
        token,
        body: JSON.stringify({
          name,
          priority: Number(priority) || 100,
          isEnabled: true,
          match,
          action
        })
      }
    );
    setSaving(false);
    if (error) {
      setError(error);
      return;
    }
    setName("");
    await loadRules();
  };

  const handleToggle = async (rule: Rule) => {
    if (!token || !currentProjectId) return;
    await apiFetch(
      `/projects/${currentProjectId}/destinations/${destinationId}/rules/${rule.id}`,
      {
        method: "PUT",
        token,
        body: JSON.stringify({ isEnabled: !rule.isEnabled })
      }
    );
    await loadRules();
  };

  const handlePreview = async () => {
    if (!token || !currentProjectId || !eventId) return;
    setPreviewError(null);
    const { data, error } = await apiFetch<PreviewResp>(
      `/projects/${currentProjectId}/destinations/${destinationId}/rules/preview`,
      {
        method: "POST",
        token,
        body: JSON.stringify({ eventId })
      }
    );
    if (error || !data?.success) {
      setPreviewError(error ?? "Preview failed");
      setPreview([]);
      return;
    }
    setPreview(data.matches || []);
  };

  if (!currentProjectId) return <div>No project selected.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Destination Rules</h1>
        <p className="text-sm text-slate-300">
          Configure rules for adapter: {adapterKey ?? "-"}
        </p>
      </div>

      {loading ? <div>Loading rules...</div> : null}
      {error ? <Alert title="Error">{error}</Alert> : null}

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Existing Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 ? (
            <div className="text-sm text-slate-400">No rules yet.</div>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="rounded border border-slate-800 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{rule.name}</div>
                    <div className="text-xs text-slate-400">Priority: {rule.priority}</div>
                  </div>
                  <Button variant="secondary" onClick={() => handleToggle(rule)}>
                    {rule.isEnabled ? "Disable" : "Enable"}
                  </Button>
                </div>
                <div className="mt-2 grid md:grid-cols-2 gap-3">
                  <pre className="bg-slate-950 border border-slate-800 rounded-md p-2 text-xs overflow-auto">
                    {JSON.stringify(rule.match, null, 2)}
                  </pre>
                  <pre className="bg-slate-950 border border-slate-800 rounded-md p-2 text-xs overflow-auto">
                    {JSON.stringify(rule.action, null, 2)}
                  </pre>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Create Rule</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <Input
                placeholder="Rule name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                placeholder="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-300">Match JSON</label>
                <Textarea
                  value={matchJson}
                  onChange={(e) => setMatchJson(e.target.value)}
                  className={matchError ? "border-rose-500" : ""}
                />
                {matchError ? <div className="text-xs text-rose-400">{matchError}</div> : null}
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-300">Action JSON</label>
                <Textarea
                  value={actionJson}
                  onChange={(e) => setActionJson(e.target.value)}
                  className={actionError ? "border-rose-500" : ""}
                />
                {actionError ? <div className="text-xs text-rose-400">{actionError}</div> : null}
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !name}>
                {saving ? "Saving..." : "Create Rule"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Event ID"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            />
            <Button onClick={handlePreview} disabled={!eventId}>
              Preview
            </Button>
          </div>
          {previewError ? <Alert title="Error">{previewError}</Alert> : null}
          {preview.length === 0 ? (
            <div className="text-sm text-slate-400">No matches yet.</div>
          ) : (
            preview.map((match) => (
              <div key={match.id} className="rounded border border-slate-800 p-3 text-sm">
                <div className="font-medium">{match.name}</div>
                <div className="text-xs text-slate-400">Event: {match.providerEventName}</div>
                {match.dropReason ? (
                  <div className="text-xs text-rose-400">Drop: {match.dropReason}</div>
                ) : null}
                <pre className="mt-2 bg-slate-950 border border-slate-800 rounded-md p-2 text-xs overflow-auto">
                  {JSON.stringify(match.providerRequest, null, 2)}
                </pre>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
