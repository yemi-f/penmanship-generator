"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { DefaultStyleOption, SavedSampleOption } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SampleThumbnail } from "@/components/SampleThumbnail";

function selectKeyDown(e: React.KeyboardEvent, onSelect: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onSelect();
  }
}

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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);

    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("File must be PNG or JPEG.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_SAMPLE_BYTES) {
      setError("File must be 5MB or smaller.");
      e.target.value = "";
      return;
    }

    const resolvedLabel = label.trim() || file.name.replace(/\.[^.]+$/, "");

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("label", resolvedLabel);
      const res = await apiFetch("/api/samples", { method: "POST", body: formData });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const created = (await res.json()) as { sample_id: string };
      setLabel("");
      e.target.value = "";
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
              <div
                key={d.slug}
                role="button"
                tabIndex={0}
                onClick={() => onChange(value)}
                onKeyDown={(e) => selectKeyDown(e, () => onChange(value))}
                className={`w-40 cursor-pointer rounded-md border p-2 text-left ${selected ? "border-primary ring-2 ring-primary" : ""}`}
              >
                <SampleThumbnail src={d.preview_url} fullSrc={d.preview_url} alt={d.label} />
                <p className="mt-1 line-clamp-2 min-h-8 text-xs">{d.label}</p>
              </div>
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
                <div
                  key={s.sample_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onChange(value)}
                  onKeyDown={(e) => selectKeyDown(e, () => onChange(value))}
                  className={`w-40 cursor-pointer rounded-md border p-2 text-left ${selected ? "border-primary ring-2 ring-primary" : ""}`}
                >
                  <SampleThumbnail
                    src={s.sample_thumb_url ?? s.sample_url}
                    fullSrc={s.sample_url}
                    alt={s.label}
                    onImgError={(e) => {
                      if (e.currentTarget.src !== s.sample_url) {
                        e.currentTarget.src = s.sample_url;
                      }
                    }}
                  />
                  <p className="mt-1 line-clamp-2 min-h-8 text-xs">{s.label}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-sample-label">Label (optional)</Label>
          <Input
            id="new-sample-label"
            placeholder="My casual handwriting"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={uploading}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-sample-file">Upload new sample (PNG/JPEG, max 5MB)</Label>
          <Input
            id="new-sample-file"
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </div>
        {uploading && <p className="text-sm text-muted-foreground">Uploading…</p>}
      </div>
    </div>
  );
}
