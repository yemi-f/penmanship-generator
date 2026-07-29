"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";

type SpringOptions = { stiffness?: number; damping?: number; mass?: number; axis?: "x" | "y" };

/** Damped spring-mass-damper on rotation[axis] (default "y"), semi-implicit Euler. Default ζ≈0.63 (slight overshoot). */
export function useHingeSpring(
  ref: RefObject<THREE.Object3D | null>,
  target: number,
  { stiffness = 90, damping = 12, mass = 1, axis = "y" }: SpringOptions = {},
) {
  const velocity = useRef(0);

  useFrame((_, rawDelta) => {
    const obj = ref.current;
    if (!obj) return;
    const dt = Math.min(rawDelta, 1 / 30);
    const current = obj.rotation[axis];
    const accel = (-stiffness * (current - target) - damping * velocity.current) / mass;
    velocity.current += accel * dt;
    obj.rotation[axis] = current + velocity.current * dt;
  });
}
