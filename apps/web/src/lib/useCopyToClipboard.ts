"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const RESET_DELAY_MS = 2000;

/** Tracks which copy-button (by caller-supplied id) most recently succeeded, clearing after 2s. */
export function useCopyToClipboard() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopiedId(null), RESET_DELAY_MS);
    });
  }, []);

  return { copiedId, copy };
}
