"use client";

import { useEffect, useState } from "react";

const SAMPLE_SIZE = 48;
const QUANTIZE_STEP = 24; // groups nearby shades into one bucket so near-duplicate
// hues don't split the vote and let a minor color win
const ALPHA_THRESHOLD = 200; // ignore mostly-transparent pixels

/** Downsamples the image onto an offscreen canvas and returns the most frequent
 * quantized color bucket, averaged back to its true RGB. Returns null if the
 * image hasn't loaded, is empty, or the canvas read is blocked (cross-origin). */
function extractDominantColor(img: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
  } catch {
    return null;
  }

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_THRESHOLD) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${Math.round(r / QUANTIZE_STEP)}-${Math.round(g / QUANTIZE_STEP)}-${Math.round(b / QUANTIZE_STEP)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket;
  }
  if (!best) return null;

  const r = Math.round(best.r / best.count);
  const g = Math.round(best.g / best.count);
  const b = Math.round(best.b / best.count);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Loads `url` in a plain (non-Three) Image element and returns its dominant color
 * as an `rgb()` string, or null while loading / on failure. Relies on the same
 * CORS-clean texture URLs the 3D viewer already requires (see CLAUDE.md's "3D
 * Viewer Texture Loading" section) — a tainted canvas read fails closed to null. */
export function useDominantColor(url: string | undefined | null): string | null {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!cancelled) setColor(extractDominantColor(img));
    };
    img.onerror = () => {
      if (!cancelled) setColor(null);
    };
    img.src = url;

    return () => {
      cancelled = true;
      setColor(null);
    };
  }, [url]);

  return color;
}
