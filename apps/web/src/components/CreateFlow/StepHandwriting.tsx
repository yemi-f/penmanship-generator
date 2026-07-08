"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { DefaultStyleOption, SavedSampleOption } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  handwritingStyle: string;
  onChange: (handwritingStyle: string) => void;
};

const MAX_SAMPLE_BYTES = 5 * 1024 * 1024;

export function StepHandwriting({ handwritingStyle, onChange }: Props) {
  const [defaults, setDefaults] = useState<DefaultStyleOption[]>([]);
  const [saved, setSaved] = useState<SavedSampleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch("/api/samples");
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = (await res.json()) as { defaults: DefaultStyleOption[]; saved: SavedSampleOption[] };
      setDefaults(data.defaults);
      setSaved(data.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; setState only ever fires after the internal await
    refresh();
  }, [refresh]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a PNG or JPEG file first.");
      return;
    }
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("File must be PNG or JPEG.");
      return;
    }
    if (file.size > MAX_SAMPLE_BYTES) {
      setError("File must be 5MB or smaller.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("label", label);
      const res = await apiFetch("/api/samples", { method: "POST", body: formData });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const created = (await res.json()) as { sample_id: string };
      setLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
      onChange(`saved:${created.sample_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading handwriting styles…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Handwriting style</h2>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Default styles</h3>
        <div className="flex flex-wrap gap-3">
          {defaults.map((d) => {
            const value = `default:${d.slug}`;
            const selected = handwritingStyle === value;
            return (
              <button
                key={d.slug}
                type="button"
                onClick={() => onChange(value)}
                className={`w-40 rounded-md border p-2 text-left ${selected ? "border-primary ring-2 ring-primary" : ""}`}
              >
                <img src={d.preview_url} alt={d.label} className="w-full rounded" />
                <p className="mt-1 text-xs">{d.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">My samples</h3>
        {saved.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved samples yet — upload one below.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {saved.map((s) => {
              const value = `saved:${s.sample_id}`;
              const selected = handwritingStyle === value;
              return (
                <button
                  key={s.sample_id}
                  type="button"
                  onClick={() => onChange(value)}
                  className={`w-40 rounded-md border p-2 text-left ${selected ? "border-primary ring-2 ring-primary" : ""}`}
                >
                  <img src={s.sample_url} alt={s.label} className="w-full rounded" />
                  <p className="mt-1 text-xs">{s.label}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-sample-label">Upload new sample — Label</Label>
          <Input
            id="new-sample-label"
            placeholder="My casual handwriting"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-sample-file">File (PNG/JPEG, max 5MB)</Label>
          <Input id="new-sample-file" type="file" accept="image/png,image/jpeg" ref={fileInputRef} />
        </div>
        <Button type="submit" disabled={uploading}>
          {uploading ? "Uploading…" : "Upload & select"}
        </Button>
      </form>
    </div>
  );
}
