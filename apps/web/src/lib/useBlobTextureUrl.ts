"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

/**
 * WebGL texture loading requires the image response to carry CORS headers.
 * B2's presigned URLs don't (confirmed: no Access-Control-Allow-Origin, and
 * OPTIONS preflight returns 403) — so authenticated card textures are fetched
 * via our own API (which does have CORS configured) and converted to a
 * same-origin blob: URL, which sidesteps the cross-origin restriction entirely.
 */
export function useBlobTextureUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    apiFetch(path)
      .then((res) => {
        if (!res.ok) throw new Error(`texture fetch failed (${res.status})`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [path]);

  return url;
}
