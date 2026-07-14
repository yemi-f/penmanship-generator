"use client";

import { Suspense, useEffect, useRef, type RefObject } from "react";
import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";

import { useHingeSpring } from "./useHingeSpring";

const PANEL_HEIGHT = 2;
const PANEL_THICKNESS = 0.015;
const RIGHT_STATIC_Z = PANEL_THICKNESS / 2;
const LEFT_STATIC_Z = -PANEL_THICKNESS / 2;

// Both panels pivot around the shared spine at x=0.
// Closed: right panel faces the camera flat (0°), left panel folds a full
// 180° behind it (hidden) — together they read as a single closed cover.
// Open: each panel rotates in by 30° from the fully-flat (180° apart)
// reference, giving a ~120° dihedral angle — pronounced enough to read as
// clearly open even with both panels now plain white.
const CLOSED_RIGHT = 0;
const OPEN_RIGHT = -Math.PI / 6;
const CLOSED_LEFT = Math.PI;
const OPEN_LEFT = Math.PI / 6;

const LIFT_PEAK = 0.06;
const LIFT_STIFFNESS = 260;
const LIFT_DAMPING = 30; // ζ≈0.93, near-critical — pops and resolves before the hinge spring settles

const PARALLAX_MAX_Y = THREE.MathUtils.degToRad(6);
const PARALLAX_MAX_X = THREE.MathUtils.degToRad(4);
const PARALLAX_LAMBDA = 5;

/** One-shot position kick on every isOpen flip, eased back to 0 by a stiff spring — the
 * "breaking contact" beat that precedes the (slower, overshooting) hinge swing. */
function useLiftPulse(isOpen: boolean) {
  const value = useRef(0);
  const velocity = useRef(0);
  const prevIsOpen = useRef(isOpen);

  useEffect(() => {
    if (prevIsOpen.current !== isOpen) {
      value.current = LIFT_PEAK;
      velocity.current = 0;
      prevIsOpen.current = isOpen;
    }
  }, [isOpen]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 30);
    const accel = -LIFT_STIFFNESS * value.current - LIFT_DAMPING * velocity.current;
    velocity.current += accel * dt;
    value.current += velocity.current * dt;
  });

  return value;
}

/** Subtle tilt toward the cursor while closed and not orbit-dragging; eases back to flat otherwise. */
function useParallaxTilt(
  ref: RefObject<THREE.Group | null>,
  isOpen: boolean,
  isDraggingRef: RefObject<boolean>,
) {
  useFrame((state: RootState, rawDelta) => {
    const group = ref.current;
    if (!group) return;
    const dt = Math.min(rawDelta, 1 / 30);
    const active = !isOpen && !isDraggingRef.current;
    const targetY = active ? state.pointer.x * PARALLAX_MAX_Y : 0;
    const targetX = active ? -state.pointer.y * PARALLAX_MAX_X : 0;
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetY, PARALLAX_LAMBDA, dt);
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, targetX, PARALLAX_LAMBDA, dt);
  });
}

function RightPanel({
  panelWidth,
  designUrl,
  writingUrl,
  isOpen,
  liftRef,
}: {
  panelWidth: number;
  designUrl: string;
  writingUrl: string;
  isOpen: boolean;
  liftRef: RefObject<number>;
}) {
  const pivotRef = useRef<THREE.Group>(null);
  const [designTexture, writingTexture] = useTexture([designUrl, writingUrl]);
  designTexture.colorSpace = THREE.SRGBColorSpace;
  writingTexture.colorSpace = THREE.SRGBColorSpace;

  useHingeSpring(pivotRef, isOpen ? OPEN_RIGHT : CLOSED_RIGHT);
  useFrame(() => {
    if (pivotRef.current) pivotRef.current.position.z = RIGHT_STATIC_Z + liftRef.current;
  });

  return (
    <group ref={pivotRef}>
      <mesh position={[panelWidth / 2, 0, 0]}>
        <boxGeometry args={[panelWidth, PANEL_HEIGHT, PANEL_THICKNESS]} />
        <meshBasicMaterial attach="material-0" color="white" toneMapped={false} />
        <meshBasicMaterial attach="material-1" color="white" toneMapped={false} />
        <meshBasicMaterial attach="material-2" color="white" toneMapped={false} />
        <meshBasicMaterial attach="material-3" color="white" toneMapped={false} />
        {/* +Z, camera-facing at rest: design when closed (front cover), writing when open (inside page). */}
        <meshBasicMaterial attach="material-4" map={isOpen ? writingTexture : designTexture} toneMapped={false} />
        {/* -Z: always blank — this leaf's other face (inside-left when closed, outside-back when
            open) never carries the design image; the design lives on LeftPanel's -Z face instead. */}
        <meshBasicMaterial attach="material-5" color="white" toneMapped={false} />
      </mesh>
    </group>
  );
}

function LeftPanel({
  panelWidth,
  designUrl,
  isOpen,
  liftRef,
}: {
  panelWidth: number;
  designUrl: string;
  isOpen: boolean;
  liftRef: RefObject<number>;
}) {
  const pivotRef = useRef<THREE.Group>(null);
  const designTexture = useTexture(designUrl);
  designTexture.colorSpace = THREE.SRGBColorSpace;

  useHingeSpring(pivotRef, isOpen ? OPEN_LEFT : CLOSED_LEFT);
  useFrame(() => {
    if (pivotRef.current) pivotRef.current.position.z = LEFT_STATIC_Z + liftRef.current;
  });

  return (
    <group ref={pivotRef}>
      <mesh position={[-panelWidth / 2, 0, 0]}>
        <boxGeometry args={[panelWidth, PANEL_HEIGHT, PANEL_THICKNESS]} />
        <meshBasicMaterial attach="material-0" color="white" toneMapped={false} />
        <meshBasicMaterial attach="material-1" color="white" toneMapped={false} />
        <meshBasicMaterial attach="material-2" color="white" toneMapped={false} />
        <meshBasicMaterial attach="material-3" color="white" toneMapped={false} />
        {/* +Z, camera-facing when open: blank inside-left page. */}
        <meshBasicMaterial attach="material-4" color="white" toneMapped={false} />
        {/* -Z: the design/front-cover image — this leaf's outward face, revealed by orbiting
            around the open card from the blank (left) side, i.e. the side without the writing. */}
        <meshBasicMaterial attach="material-5" map={designTexture} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Scene({
  panelWidth,
  designUrl,
  writingUrl,
  isOpen,
}: {
  panelWidth: number;
  designUrl: string;
  writingUrl: string;
  isOpen: boolean;
}) {
  const parallaxRef = useRef<THREE.Group>(null);
  const isDraggingRef = useRef(false);
  const liftRef = useLiftPulse(isOpen);
  useParallaxTilt(parallaxRef, isOpen, isDraggingRef);

  return (
    <>
      <group ref={parallaxRef}>
        <Suspense fallback={null}>
          <RightPanel
            panelWidth={panelWidth}
            designUrl={designUrl}
            writingUrl={writingUrl}
            isOpen={isOpen}
            liftRef={liftRef}
          />
          <LeftPanel panelWidth={panelWidth} designUrl={designUrl} isOpen={isOpen} liftRef={liftRef} />
        </Suspense>
      </group>
      <OrbitControls
        enablePan={false}
        minDistance={2.5}
        maxDistance={8}
        onStart={() => {
          isDraggingRef.current = true;
        }}
        onEnd={() => {
          isDraggingRef.current = false;
        }}
      />
    </>
  );
}

type Props = {
  orientation: "landscape" | "portrait";
  designTextureUrl: string;
  writingTextureUrl: string;
  isOpen: boolean;
};

/**
 * Open-book greeting card. Closed: single panel, outside front = design
 * image. Open: ~150° dihedral, right panel = writing face, left = blank.
 * Open/close state is controlled by the caller.
 */
export function GreetingCardViewer({ orientation, designTextureUrl, writingTextureUrl, isOpen }: Props) {
  const panelWidth = orientation === "portrait" ? PANEL_HEIGHT * (1200 / 1800) : PANEL_HEIGHT * (1800 / 1200);

  return (
    <div className="relative left-1/2 right-1/2 -mx-[50vw] h-[85vh] w-screen touch-none overflow-hidden bg-muted">
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
        <Scene panelWidth={panelWidth} designUrl={designTextureUrl} writingUrl={writingTextureUrl} isOpen={isOpen} />
      </Canvas>
    </div>
  );
}
