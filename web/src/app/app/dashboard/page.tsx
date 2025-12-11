"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type StatsResp = {
  success: boolean;
  stats: {
    totalEvents: number;
    totalSuccessDeliveries: number;
    totalFailedDeliveries: number;
  };
};

type DestinationsResp = {
  success: boolean;
  destinations: {
    id: string;
    type: string;
    isActive: boolean;
    healthStatus: string;
    createdAt: string;
  }[];
};

export default function DashboardPage() {
  const { token, user, projects, refreshMe } = useAuth();
  const { currentProjectId } = useCurrentProject();
  const [stats, setStats] = useState<StatsResp["stats"] | null>(null);
  const [destinations, setDestinations] = useState<DestinationsResp["destinations"]>([]);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!currentProjectId || !token) return;
      const { data: statsData } = await apiFetch<StatsResp>(
        `/projects/${currentProjectId}/stats/overview`,
        { token }
      );
      if (statsData?.success) setStats(statsData.stats);

      const { data: destData } = await apiFetch<DestinationsResp>(
        `/projects/${currentProjectId}/destinations`,
        { token }
      );
      if (destData?.success) setDestinations(destData.destinations);
    }
    load();
  }, [currentProjectId, token]);

  const handleCreateProject = async () => {
    if (!token) return;
    setCreating(true);
    setError(null);
    const { error } = await apiFetch(`/projects`, {
      method: "POST",
      token,
      body: JSON.stringify({
        name,
        domain: domain || undefined,
        description: description || undefined
      })
    });
    setCreating(false);
    if (error) {
      setError(error);
    } else {
      setName("");
      setDomain("");
      setDescription("");
      await refreshMe();
    }
  };

  if (!projects || projects.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Chưa có project nào được gán.</h1>
        <p className="text-slate-400">
          Tạo project đầu tiên cho tài khoản {user?.email ?? "user"}.
        </p>
        {error ? <Alert title="Error">{error}</Alert> : null}
        <div className="grid gap-3 md:grid-cols-3 max-w-2xl">
          <Input
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Domain (optional)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <Button onClick={handleCreateProject} disabled={creating || !name}>
          {creating ? "Creating..." : "Tạo Project"}
        </Button>
      </div>
    );
  }

  if (!currentProjectId) {
    return <div>Đã có {projects.length} project.</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle>Total Events</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {stats ? stats.totalEvents : "-"}
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle>Success Deliveries</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-emerald-400">
            {stats ? stats.totalSuccessDeliveries : "-"}
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle>Failed Deliveries</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-rose-400">
            {stats ? stats.totalFailedDeliveries : "-"}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Destinations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {destinations.length === 0 ? (
            <div className="text-sm text-slate-400">Chưa có destination.</div>
          ) : (
            destinations.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm"
              >
                <div className="space-y-1">
                  <div className="font-medium">{d.type}</div>
                  <div className="text-slate-400 text-xs">
                    Created: {new Date(d.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant={d.isActive ? "success" : "warning"}>
                    {d.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge>{d.healthStatus}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
