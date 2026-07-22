"use client";

import { useCallback } from "react";

/** Swaps the document cursor to a pointer while hovering a clickable mesh. */
export function useHoverCursor() {
  const onPointerOver = useCallback(() => {
    document.body.style.cursor = "pointer";
  }, []);
  const onPointerOut = useCallback(() => {
    document.body.style.cursor = "auto";
  }, []);
  return { onPointerOver, onPointerOut };
}
