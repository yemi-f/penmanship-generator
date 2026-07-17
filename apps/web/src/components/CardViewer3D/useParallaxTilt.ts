"use client";

import type { RefObject } from "react";
import { useFrame, type RootState } from "@react-three/fiber";
import * as THREE from "three";

const PARALLAX_MAX_Y = THREE.MathUtils.degToRad(6);
const PARALLAX_MAX_X = THREE.MathUtils.degToRad(4);
const PARALLAX_LAMBDA = 5;

/** Subtle tilt toward the cursor while `active` and not orbit-dragging; eases back to flat otherwise. */
export function useParallaxTilt(
  ref: RefObject<THREE.Group | null>,
  active: boolean,
  isDraggingRef: RefObject<boolean>,
) {
  useFrame((state: RootState, rawDelta) => {
    const group = ref.current;
    if (!group) return;
    const dt = Math.min(rawDelta, 1 / 30);
    const tiltActive = active && !isDraggingRef.current;
    const targetY = tiltActive ? state.pointer.x * PARALLAX_MAX_Y : 0;
    const targetX = tiltActive ? -state.pointer.y * PARALLAX_MAX_X : 0;
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetY, PARALLAX_LAMBDA, dt);
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, targetX, PARALLAX_LAMBDA, dt);
  });
}
