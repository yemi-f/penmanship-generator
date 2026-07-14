"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";

const PANEL_HEIGHT = 2;

// Both panels pivot around the shared spine at x=0.
// Closed: right panel faces the camera flat (0°), left panel folds a full
// 180° behind it (hidden) — together they read as a single closed cover.
// Open: each panel rotates in by 15° from the fully-flat (180° apart)
// reference, giving a ~150° dihedral angle, per spec.
const CLOSED_RIGHT = 0;
const OPEN_RIGHT = -Math.PI / 12;
const CLOSED_LEFT = Math.PI;
const OPEN_LEFT = Math.PI / 12;

function RightPanel({
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
  const pivotRef = useRef<THREE.Group>(null);
  const [designTexture, writingTexture] = useTexture([designUrl, writingUrl]);
  // See PostcardViewer.tsx for why colorSpace must be set explicitly.
  designTexture.colorSpace = THREE.SRGBColorSpace;
  writingTexture.colorSpace = THREE.SRGBColorSpace;

  useFrame(() => {
    if (!pivotRef.current) return;
    const target = isOpen ? OPEN_RIGHT : CLOSED_RIGHT;
    pivotRef.current.rotation.y += (target - pivotRef.current.rotation.y) * 0.1;
  });

  return (
    <group ref={pivotRef}>
      {/* Camera-facing side: design when closed (front cover), writing when open (inside page). */}
      <mesh position={[panelWidth / 2, 0, 0.005]}>
        <planeGeometry args={[panelWidth, PANEL_HEIGHT]} />
        <meshBasicMaterial map={isOpen ? writingTexture : designTexture} toneMapped={false} />
      </mesh>
      {/* Reverse side: always blank — this leaf's other face (inside-left when closed,
          outside-back when open) never carries the design image; the design lives on
          LeftPanel's reverse instead (see below). */}
      <mesh rotation={[0, Math.PI, 0]} position={[panelWidth / 2, 0, -0.01]}>
        <planeGeometry args={[panelWidth, PANEL_HEIGHT]} />
        <meshStandardMaterial color="white" />
      </mesh>
    </group>
  );
}

function LeftPanel({
  panelWidth,
  designUrl,
  isOpen,
}: {
  panelWidth: number;
  designUrl: string;
  isOpen: boolean;
}) {
  const pivotRef = useRef<THREE.Group>(null);
  const designTexture = useTexture(designUrl);
  designTexture.colorSpace = THREE.SRGBColorSpace;

  useFrame(() => {
    if (!pivotRef.current) return;
    const target = isOpen ? OPEN_LEFT : CLOSED_LEFT;
    pivotRef.current.rotation.y += (target - pivotRef.current.rotation.y) * 0.1;
  });

  return (
    <group ref={pivotRef}>
      {/* Camera-facing side when open: blank inside-left page. */}
      <mesh position={[-panelWidth / 2, 0, 0.005]}>
        <planeGeometry args={[panelWidth, PANEL_HEIGHT]} />
        <meshStandardMaterial color="white" />
      </mesh>
      {/* Reverse side: the design/front-cover image — this leaf's outward face, revealed
          by orbiting around the open card from the blank (left) side, i.e. the side that
          doesn't have the writing. */}
      <mesh rotation={[0, Math.PI, 0]} position={[-panelWidth / 2, 0, -0.003]}>
        <planeGeometry args={[panelWidth, PANEL_HEIGHT]} />
        <meshBasicMaterial map={designTexture} toneMapped={false} />
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
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[2, 2, 3]} intensity={0.6} />
      <Suspense fallback={null}>
        <RightPanel panelWidth={panelWidth} designUrl={designUrl} writingUrl={writingUrl} isOpen={isOpen} />
        <LeftPanel panelWidth={panelWidth} designUrl={designUrl} isOpen={isOpen} />
      </Suspense>
      <OrbitControls enablePan={false} minDistance={2.5} maxDistance={8} />
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
