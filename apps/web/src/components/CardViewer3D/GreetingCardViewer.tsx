"use client";

import { Suspense, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";

import { Button } from "@/components/ui/button";

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

  useFrame(() => {
    if (!pivotRef.current) return;
    const target = isOpen ? OPEN_RIGHT : CLOSED_RIGHT;
    pivotRef.current.rotation.y += (target - pivotRef.current.rotation.y) * 0.1;
  });

  return (
    <group ref={pivotRef}>
      <mesh position={[panelWidth / 2, 0, 0.005]}>
        <planeGeometry args={[panelWidth, PANEL_HEIGHT]} />
        <meshBasicMaterial map={isOpen ? writingTexture : designTexture} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function LeftPanel({ panelWidth, isOpen }: { panelWidth: number; isOpen: boolean }) {
  const pivotRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!pivotRef.current) return;
    const target = isOpen ? OPEN_LEFT : CLOSED_LEFT;
    pivotRef.current.rotation.y += (target - pivotRef.current.rotation.y) * 0.1;
  });

  return (
    <group ref={pivotRef}>
      <mesh position={[-panelWidth / 2, 0, 0.005]}>
        <planeGeometry args={[panelWidth, PANEL_HEIGHT]} />
        <meshStandardMaterial color="white" side={THREE.DoubleSide} />
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
        <LeftPanel panelWidth={panelWidth} isOpen={isOpen} />
      </Suspense>
      <OrbitControls enablePan={false} minDistance={2.5} maxDistance={8} />
    </>
  );
}

type Props = {
  orientation: "landscape" | "portrait";
  designTextureUrl: string;
  writingTextureUrl: string;
};

/**
 * Open-book greeting card. Closed: single panel, outside front = design
 * image. Open: ~150° dihedral, right panel = writing face, left = blank.
 */
export function GreetingCardViewer({ orientation, designTextureUrl, writingTextureUrl }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const panelWidth = orientation === "portrait" ? PANEL_HEIGHT * (1200 / 1800) : PANEL_HEIGHT * (1800 / 1200);

  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-[3/2] w-full touch-none overflow-hidden rounded-md border bg-muted">
        <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
          <Scene
            panelWidth={panelWidth}
            designUrl={designTextureUrl}
            writingUrl={writingTextureUrl}
            isOpen={isOpen}
          />
        </Canvas>
      </div>
      <Button type="button" variant="outline" onClick={() => setIsOpen((o) => !o)}>
        {isOpen ? "Close" : "Open"}
      </Button>
    </div>
  );
}
