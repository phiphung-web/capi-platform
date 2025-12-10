"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { JsonEditor } from "@/components/json-editor";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type SourceResp = {
  success: boolean;
  source: {
    id: string;
    projectId: string;
    name: string;
    eventKey: string;
    type: string | null;
    mappingJson: any;
    seenFields: any;
  };
};

export default function SourceDetailPage() {
  const params = useParams<{ id: string }>();
  const { token } = useAuth();
  const [source, setSource] = useState<SourceResp["source"] | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [mappingText, setMappingText] = useState("{}");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!token || !params?.id) return;
      const { data, error } = await apiFetch<SourceResp>(`/sources/${params.id}`, {
        token,
      });
      if (error || !data?.success) {
        setError(error ?? "Load failed");
        return;
      }
      setSource(data.source);
      setName(data.source.name);
      setType(data.source.type ?? "");
      setMappingText(
        data.source.mappingJson ? JSON.stringify(data.source.mappingJson, null, 2) : "{}"
      );
    }
    load();
  }, [token, params]);

  const handleSave = async () => {
    if (!token || !params?.id) return;
    setError(null);
    let mappingParsed: any = {};
    try {
      mappingParsed = mappingText ? JSON.parse(mappingText) : {};
    } catch (err: any) {
      setError("Mapping JSON không hợp lệ");
      return;
    }

    setSaving(true);
    const { error } = await apiFetch(`/sources/${params.id}`, {
      method: "PUT",
      token,
      body: JSON.stringify({
        name,
        type: type || null,
        mappingJson: mappingParsed,
      }),
    });
    setSaving(false);
    if (error) {
      setError(error);
    } else {
      setError(null);
    }
  };

  if (!source) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Source detail</h1>
      {error ? <Alert title="Error">{error}</Alert> : null}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>{source.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Type</label>
              <Input value={type} onChange={(e) => setType(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Event Key</label>
              <Input value={source.eventKey} disabled />
            </div>
          </div>

          <JsonEditor
            label="mappingJson"
            value={mappingText}
            onChange={setMappingText}
            error={null}
            minHeight={220}
          />
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
