"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const { token } = useAuth();
  const { projectId } = useProject();
  const [stats, setStats] = useState<StatsResp["stats"] | null>(null);
  const [destinations, setDestinations] = useState<DestinationsResp["destinations"]>([]);

  useEffect(() => {
    async function load() {
      if (!projectId || !token) return;
      const { data: statsData } = await apiFetch<StatsResp>(
        `/projects/${projectId}/stats/overview`,
        { token }
      );
      if (statsData?.success) setStats(statsData.stats);

      const { data: destData } = await apiFetch<DestinationsResp>(
        `/projects/${projectId}/destinations`,
        { token }
      );
      if (destData?.success) setDestinations(destData.destinations);
    }
    load();
  }, [projectId, token]);

  if (!projectId) {
    return <div>Chưa có project nào được gán.</div>;
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
                  <div className="text-slate-400 text-xs">Created: {new Date(d.createdAt).toLocaleString()}</div>
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
