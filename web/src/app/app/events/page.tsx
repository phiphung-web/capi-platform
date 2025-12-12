"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type EventsResp = {
  success: boolean;
  events: {
    id: string;
    eventName: string;
    eventTime: number;
    sourceTag: string;
    qualityScore: number | null;
    createdAt: string;
  }[];
  nextCursor: string | null;
};

export default function EventsPage() {
  const { token } = useAuth();
  const { currentProjectId } = useCurrentProject();
  const [events, setEvents] = useState<EventsResp["events"]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async (cursor?: string, append = false) => {
    if (!token || !currentProjectId) return;
    const query = cursor ? `?limit=50&cursor=${cursor}` : "?limit=50";
    const { data, error } = await apiFetch<EventsResp>(
      `/projects/${currentProjectId}/events${query}`,
      { token }
    );
    if (error || !data?.success) {
      setError(error ?? "Không tải được events");
      return;
    }
    if (append) {
      setEvents((prev) => [...prev, ...data.events]);
    } else {
      setEvents(data.events);
    }
    setNextCursor(data.nextCursor);
  };

  useEffect(() => {
    setError(null);
    setEvents([]);
    setNextCursor(null);
    if (!token || !currentProjectId) return;
    setLoading(true);
    fetchEvents().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentProjectId]);

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    await fetchEvents(nextCursor, true);
    setLoadingMore(false);
  };

  if (!currentProjectId) return <div>Chưa chọn project.</div>;
  if (loading) return <div>Đang tải events...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Events</h1>
      {error ? <Alert title="Error">{error}</Alert> : null}
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
                  <td className="py-2 pr-4">{e.qualityScore ?? "-"}</td>
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
      {nextCursor ? (
        <div className="flex justify-center">
          <Button onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? "Đang tải..." : "Tải thêm"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
