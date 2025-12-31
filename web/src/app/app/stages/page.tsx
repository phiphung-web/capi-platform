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

type Stage = {
  id: string;
  key: string;
  displayName: string;
  description?: string | null;
  order: number;
  isDefault: boolean;
  inferenceRules: any;
};

type StagesResp = {
  success: boolean;
  stages: Stage[];
};

export default function StagesPage() {
  const { token } = useAuth();
  const { currentProjectId } = useCurrentProject();
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [keyValue, setKeyValue] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [order, setOrder] = useState("0");
  const [isDefault, setIsDefault] = useState(false);
  const [rulesJson, setRulesJson] = useState(
    JSON.stringify({ event_name_equals: ["lead_created"] }, null, 2)
  );

  const rulesError = useMemo(() => {
    try {
      JSON.parse(rulesJson || "{}");
      return null;
    } catch (err: any) {
      return err?.message || "Invalid JSON";
    }
  }, [rulesJson]);

  const loadStages = async () => {
    if (!token || !currentProjectId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await apiFetch<StagesResp>(
      `/projects/${currentProjectId}/stages`,
      { token }
    );
    setLoading(false);
    if (error || !data?.success) {
      setError(error ?? "Load stages failed");
      return;
    }
    setStages(data.stages);
  };

  useEffect(() => {
    loadStages();
  }, [token, currentProjectId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentProjectId || rulesError) return;
    setSaving(true);
    setError(null);
    const inferenceRules = JSON.parse(rulesJson || "{}");
    const { error } = await apiFetch(`/projects/${currentProjectId}/stages`, {
      method: "POST",
      token,
      body: JSON.stringify({
        key: keyValue,
        displayName,
        order: Number(order) || 0,
        isDefault,
        inferenceRules
      })
    });
    setSaving(false);
    if (error) {
      setError(error);
      return;
    }
    setKeyValue("");
    setDisplayName("");
    setIsDefault(false);
    await loadStages();
  };

  const handleSetDefault = async (stage: Stage) => {
    if (!token || !currentProjectId) return;
    await apiFetch(`/projects/${currentProjectId}/stages/${stage.id}`, {
      method: "PUT",
      token,
      body: JSON.stringify({ isDefault: true })
    });
    await loadStages();
  };

  const handleDelete = async (stage: Stage) => {
    if (!token || !currentProjectId) return;
    await apiFetch(`/projects/${currentProjectId}/stages/${stage.id}`, {
      method: "DELETE",
      token
    });
    await loadStages();
  };

  if (!currentProjectId) return <div>No project selected.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Stages</h1>
        <p className="text-sm text-slate-300">Define stages and inference rules.</p>
      </div>

      {loading ? <div>Loading stages...</div> : null}
      {error ? <Alert title="Error">{error}</Alert> : null}

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Existing Stages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stages.length === 0 ? (
            <div className="text-sm text-slate-400">No stages yet.</div>
          ) : (
            stages.map((stage) => (
              <div key={stage.id} className="rounded border border-slate-800 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{stage.displayName}</div>
                    <div className="text-xs text-slate-400">
                      Key: {stage.key} | Order: {stage.order}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => handleSetDefault(stage)}
                      disabled={stage.isDefault}
                    >
                      {stage.isDefault ? "Default" : "Set Default"}
                    </Button>
                    <Button variant="secondary" onClick={() => handleDelete(stage)}>
                      Delete
                    </Button>
                  </div>
                </div>
                <pre className="mt-2 bg-slate-950 border border-slate-800 rounded-md p-2 text-xs overflow-auto">
                  {JSON.stringify(stage.inferenceRules, null, 2)}
                </pre>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Create Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <Input
                placeholder="Key (e.g. LEAD)"
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
              />
              <Input
                placeholder="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Input
                placeholder="Order"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                Default stage
              </label>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Inference rules JSON</label>
              <Textarea
                value={rulesJson}
                onChange={(e) => setRulesJson(e.target.value)}
                className={rulesError ? "border-rose-500" : ""}
              />
              {rulesError ? <div className="text-xs text-rose-400">{rulesError}</div> : null}
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !keyValue || !displayName}>
                {saving ? "Saving..." : "Create Stage"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
