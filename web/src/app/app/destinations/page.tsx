"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type DestResp = {
  success: boolean;
  destinations: {
    id: string;
    type: string;
    isActive: boolean;
    healthStatus: string;
    createdAt: string;
  }[];
};

export default function DestinationsPage() {
  const { token } = useAuth();
  const { currentProjectId } = useCurrentProject();
  const [destinations, setDestinations] = useState<DestResp["destinations"]>([]);
  const [pixelId, setPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token || !currentProjectId) return;
      setLoading(true);
      setError(null);
      const { data, error } = await apiFetch<DestResp>(
        `/projects/${currentProjectId}/destinations`,
        { token }
      );
      setLoading(false);
      if (error || !data?.success) {
        setError(error ?? "Load destinations failed");
        return;
      }
      setDestinations(data.destinations);
    };
    load();
  }, [token, currentProjectId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentProjectId) return;
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    const { error } = await apiFetch(`/projects/${currentProjectId}/destinations/facebook`, {
      method: "POST",
      token,
      body: JSON.stringify({
        pixelId,
        accessToken,
        testEventCode: testEventCode || undefined
      })
    });
    setSaving(false);
    if (error) {
      setError(error);
    } else {
      setSavedMessage("Đã lưu cấu hình Pixel.");
      setAccessToken("");
      // reload destinations
      const { data } = await apiFetch<DestResp>(
        `/projects/${currentProjectId}/destinations`,
        { token }
      );
      if (data?.success) setDestinations(data.destinations);
    }
  };

  if (!currentProjectId) return <div>Chưa chọn project.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-2">Destinations</h1>
        <p className="text-sm text-slate-300">
          Cấu hình nơi hệ thống gửi sự kiện (Facebook Pixel, TikTok,...)
        </p>
      </div>

      {loading ? <div>Đang tải destinations...</div> : null}
      {error ? <Alert title="Error">{error}</Alert> : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Danh sách destinations</h2>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="divide-y divide-slate-800">
            {destinations.length === 0 ? (
              <div className="py-3 text-sm text-slate-400">Chưa có destination.</div>
            ) : (
              destinations.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{d.type}</div>
                    <div className="text-xs text-slate-400">
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
      </section>

      <section className="space-y-3 max-w-xl">
        <h2 className="text-sm font-semibold">Facebook Pixel</h2>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Pixel ID"
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value)}
            />
            <Input
              placeholder="Access Token"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
            <Input
              placeholder="Test Event Code (optional)"
              value={testEventCode}
              onChange={(e) => setTestEventCode(e.target.value)}
            />
          </div>
          {savedMessage ? (
            <div className="text-sm text-emerald-400">{savedMessage}</div>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Lưu cấu hình Facebook Pixel"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
