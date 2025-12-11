"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type SourcesResp = {
  success: boolean;
  sources: {
    id: string;
    name: string;
    eventKey: string;
    type: string | null;
    createdAt: string;
  }[];
};

export default function SourcesPage() {
  const { token } = useAuth();
  const { currentProjectId } = useCurrentProject();
  const [sources, setSources] = useState<SourcesResp["sources"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", eventKey: "", type: "" });

  const loadSources = async () => {
    if (!currentProjectId || !token) return;
    const { data, error } = await apiFetch<SourcesResp>(
      `/projects/${currentProjectId}/sources`,
      { token }
    );
    if (error) setError(error);
    if (data?.success) setSources(data.sources);
  };

  useEffect(() => {
    setError(null);
    loadSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId, token]);

  const handleCreate = async () => {
    if (!currentProjectId || !token) return;
    setCreating(true);
    setError(null);
    const { error } = await apiFetch(`/projects/${currentProjectId}/sources`, {
      method: "POST",
      token,
      body: JSON.stringify({
        name: form.name,
        eventKey: form.eventKey,
        type: form.type || undefined
      })
    });
    setCreating(false);
    if (error) {
      setError(error);
    } else {
      setForm({ name: "", eventKey: "", type: "" });
      loadSources();
    }
  };

  if (!currentProjectId) return <div>Chưa có project.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sources</h1>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Tạo Source</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            placeholder="eventKey"
            value={form.eventKey}
            onChange={(e) => setForm((f) => ({ ...f, eventKey: e.target.value }))}
          />
          <Input
            placeholder="type (optional)"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          />
          <Button onClick={handleCreate} disabled={creating || !form.name || !form.eventKey}>
            {creating ? "Creating..." : "Create"}
          </Button>
        </CardContent>
      </Card>

      {error ? <Alert title="Error">{error}</Alert> : null}

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Danh sách Sources</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Event Key</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sources.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 pr-4">{s.name}</td>
                  <td className="py-2 pr-4 font-mono">{s.eventKey}</td>
                  <td className="py-2 pr-4">{s.type ?? "-"}</td>
                  <td className="py-2 pr-4">{new Date(s.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <Link className="text-blue-400 underline" href={`/app/sources/${s.id}`}>
                      Chi tiết
                    </Link>
                  </td>
                </tr>
              ))}
              {sources.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-400" colSpan={5}>
                    Chưa có source.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
