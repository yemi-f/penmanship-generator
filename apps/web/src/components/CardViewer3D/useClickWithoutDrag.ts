"use client";

import { useCallback, useRef } from "react";

const DRAG_THRESHOLD_PX = 5; // beyond this, treat pointerdown->pointerup as a drag (e.g. orbit-rotate), not a click

/** Fires onClick only if the pointer barely moved between down and up — real click-vs-drag
 * disambiguation, since a rotate-drag that starts and ends over the same mesh can otherwise
 * still look like a "click" to react-three-fiber's own built-in click heuristic. */
export function useClickWithoutDrag(onClick: () => void) {
  const downPos = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((e: { clientX: number; clientY: number }) => {
    downPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPointerUp = useCallback(
    (e: { clientX: number; clientY: number; stopPropagation: () => void }) => {
      const start = downPos.current;
      downPos.current = null;
      if (!start) return;
      const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (dist < DRAG_THRESHOLD_PX) {
        e.stopPropagation();
        onClick();
      }
    },
    [onClick],
  );

  return { onPointerDown, onPointerUp };
}
