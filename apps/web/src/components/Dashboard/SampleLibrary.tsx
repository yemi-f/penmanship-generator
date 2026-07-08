"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type DefaultStyle = { slug: string; label: string; preview_url: string };
type SavedSample = {
  sample_id: string;
  label: string;
  sample_url: string;
  created_at: string;
};

const MAX_SAMPLE_BYTES = 5 * 1024 * 1024;

export function SampleLibrary() {
  const [defaults, setDefaults] = useState<DefaultStyle[]>([]);
  const [saved, setSaved] = useState<SavedSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch("/api/samples");
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = (await res.json()) as { defaults: DefaultStyle[]; saved: SavedSample[] };
      setDefaults(data.defaults);
      setSaved(data.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // refresh() only sets state after its internal `await`, never synchronously
    // on this first pass — standard fetch-on-mount, not a re-render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      setLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(sampleId: string) {
    setError(null);
    try {
      const res = await apiFetch(`/api/samples/${sampleId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">My Handwriting Samples</h2>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sample-label">Label</Label>
          <Input
            id="sample-label"
            placeholder="My casual handwriting"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sample-file">File (PNG/JPEG, max 5MB)</Label>
          <Input id="sample-file" type="file" accept="image/png,image/jpeg" ref={fileInputRef} />
        </div>
        <Button type="submit" disabled={uploading}>
          {uploading ? "Uploading…" : "Upload sample"}
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading samples…</p>
      ) : (
        <>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Default styles</h3>
            <div className="flex flex-wrap gap-3">
              {defaults.map((d) => (
                <div key={d.slug} className="w-40 rounded-md border p-2">
                  <img src={d.preview_url} alt={d.label} className="w-full rounded" />
                  <p className="mt-1 text-xs">{d.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">My samples</h3>
            {saved.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved samples yet.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {saved.map((s) => (
                  <div key={s.sample_id} className="w-40 rounded-md border p-2">
                    <img src={s.sample_url} alt={s.label} className="w-full rounded" />
                    <p className="mt-1 text-xs">{s.label}</p>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button type="button" variant="outline" size="sm" className="mt-1 w-full">
                            Delete
                          </Button>
                        }
                      />

                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete &quot;{s.label}&quot;?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the sample from your library. Cards you&apos;ve already
                            created with it are unaffected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(s.sample_id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
