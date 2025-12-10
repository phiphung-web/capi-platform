"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EventsResp = {
  success: boolean;
  events: {
    id: string;
    eventName: string;
    eventTime: number;
    sourceTag: string;
    qualityScore: number;
    createdAt: string;
  }[];
  nextCursor: string | null;
};

export default function EventsPage() {
  const { token } = useAuth();
  const { projectId } = useProject();
  const [events, setEvents] = useState<EventsResp["events"]>([]);

  useEffect(() => {
    async function load() {
      if (!token || !projectId) return;
      const { data } = await apiFetch<EventsResp>(`/projects/${projectId}/events?limit=50`, {
        token
      });
      if (data?.success) setEvents(data.events);
    }
    load();
  }, [token, projectId]);

  if (!projectId) return <div>Chưa có project.</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Events</h1>
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Danh sách Events</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 pr-4">Event</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Quality</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-4">{e.eventName}</td>
                  <td className="py-2 pr-4">{e.sourceTag}</td>
                  <td className="py-2 pr-4">{e.qualityScore}</td>
                  <td className="py-2 pr-4">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <Link className="text-blue-400 underline" href={`/app/events/${e.id}`}>
                      Chi tiết
                    </Link>
                  </td>
                </tr>
              ))}
              {events.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-400" colSpan={5}>
                    Chưa có event.
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
