"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

type EventResp = {
  success: boolean;
  event: {
    id: string;
    eventName: string;
    eventId: string;
    eventTime: number;
    sourceTag: string | null;
    qualityScore: number | null;
    userJson: any;
    dataJson: any;
    rawPayload: any;
    createdAt: string;
  };
};

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const { token } = useAuth();
  const { currentProjectId } = useCurrentProject();
  const [event, setEvent] = useState<EventResp["event"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!currentProjectId || !token || !params?.id) return;
      setLoading(true);
      setError(null);
      const { data, error } = await apiFetch<EventResp>(
        `/projects/${currentProjectId}/events/${params.id}`,
        { token }
      );
      setLoading(false);
      if (error || !data?.success) {
        setError(error ?? "Không tải được event");
        return;
      }
      setEvent(data.event);
    };
    load();
  }, [currentProjectId, token, params]);

  if (!currentProjectId) return <div>Chưa chọn project.</div>;
  if (loading) return <div>Đang tải event...</div>;
  if (error) return <Alert title="Error">{error}</Alert>;
  if (!event) return <div>Không tìm thấy event.</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Event detail</h1>
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>{event.eventName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>ID: {event.id}</div>
          <div>Event ID: {event.eventId}</div>
          <div>Source: {event.sourceTag ?? "-"}</div>
          <div>Event Time: {new Date(event.eventTime * 1000).toLocaleString()}</div>
          <div>Quality: {event.qualityScore ?? "-"}</div>
          <div>Created: {new Date(event.createdAt).toLocaleString()}</div>

          <div className="space-y-2">
            <div className="font-semibold">User JSON</div>
            <pre className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 overflow-auto max-h-64">
              {JSON.stringify(event.userJson, null, 2)}
            </pre>
          </div>
          <div className="space-y-2">
            <div className="font-semibold">Data JSON</div>
            <pre className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 overflow-auto max-h-64">
              {JSON.stringify(event.dataJson, null, 2)}
            </pre>
          </div>
          <div className="space-y-2">
            <div className="font-semibold">Raw Payload</div>
            <pre className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 overflow-auto max-h-64">
              {JSON.stringify(event.rawPayload, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
