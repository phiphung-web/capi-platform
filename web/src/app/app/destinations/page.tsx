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
    config?: any;
  }[];
};

export default function DestinationsPage() {
  const { token } = useAuth();
  const { currentProjectId } = useCurrentProject();
  const [destinations, setDestinations] = useState<DestResp["destinations"]>([]);
  const [form, setForm] = useState({ pixelId: "", accessToken: "", testEventCode: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!currentProjectId || !token) return;
    const { data, error } = await apiFetch<DestResp>(`/projects/${currentProjectId}/destinations`, {
      token
    });
    if (error) setError(error);
    if (data?.success) {
      setDestinations(data.destinations);
    }
  };

  useEffect(() => {
    load();
  }, [currentProjectId, token]);

  useEffect(() => {
    const fb = destinations.find((d) => d.type === "facebook");
    if (fb?.config) {
      setForm({
        pixelId: fb.config.pixel_id || "",
        accessToken: fb.config.access_token || "",
        testEventCode: fb.config.test_event_code || ""
      });
    }
  }, [destinations]);

  const handleSave = async () => {
    if (!currentProjectId || !token) return;
    setSaving(true);
    setError(null);
    const { error } = await apiFetch(`/projects/${currentProjectId}/destinations/facebook`, {
      method: "POST",
      token,
      body: JSON.stringify({
        pixelId: form.pixelId,
        accessToken: form.accessToken,
        testEventCode: form.testEventCode || undefined
      })
    });
    setSaving(false);
    if (error) setError(error);
    else load();
  };

  if (!currentProjectId) return <div>Chưa có project.</div>;

  const facebook = destinations.find((d) => d.type === "facebook");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Destinations</h1>
      {error ? <Alert title="Error">{error}</Alert> : null}

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Facebook Pixel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {facebook ? (
              <>
                <Badge variant={facebook.isActive ? "success" : "warning"}>
                  {facebook.isActive ? "Active" : "Inactive"}
                </Badge>
                <Badge>{facebook.healthStatus}</Badge>
              </>
            ) : (
              <span className="text-slate-400">Chưa cấu hình</span>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Pixel ID"
              value={form.pixelId}
              onChange={(e) => setForm((f) => ({ ...f, pixelId: e.target.value }))}
            />
            <Input
              placeholder="Access Token"
              value={form.accessToken}
              onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
            />
            <Input
              placeholder="Test Event Code (optional)"
              value={form.testEventCode}
              onChange={(e) => setForm((f) => ({ ...f, testEventCode: e.target.value }))}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
