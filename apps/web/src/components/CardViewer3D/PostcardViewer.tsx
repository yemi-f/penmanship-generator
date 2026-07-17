"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";

import { useParallaxTilt } from "./useParallaxTilt";

const WIDTH = 3;
const HEIGHT = 2; // postcards are always landscape, 3:2

function CardMesh({
  frontUrl,
  backUrl,
  flipped,
}: {
  frontUrl: string;
  backUrl: string;
  flipped: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [frontTexture, backTexture] = useTexture([frontUrl, backUrl]);
  // useTexture doesn't set colorSpace itself; without this, sRGB-encoded PNG data gets
  // treated as linear and re-encoded on output, crushing contrast (most visible on the
  // low-contrast handwriting texture, which reads as washed-out pale gray instead of ink).
  frontTexture.colorSpace = THREE.SRGBColorSpace;
  backTexture.colorSpace = THREE.SRGBColorSpace;

  useFrame(() => {
    if (!groupRef.current) return;
    const target = flipped ? Math.PI : 0;
    groupRef.current.rotation.y += (target - groupRef.current.rotation.y) * 0.1;
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshBasicMaterial map={frontTexture} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, Math.PI, 0]} position={[0, 0, -0.005]}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshBasicMaterial map={backTexture} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Scene({ frontUrl, backUrl, flipped }: { frontUrl: string; backUrl: string; flipped: boolean }) {
  const parallaxRef = useRef<THREE.Group>(null);
  const isDraggingRef = useRef(false);
  useParallaxTilt(parallaxRef, true, isDraggingRef);

  return (
    <>
      <group ref={parallaxRef}>
        <Suspense fallback={null}>
          <CardMesh frontUrl={frontUrl} backUrl={backUrl} flipped={flipped} />
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
  frontTextureUrl: string;
  backTextureUrl: string;
  flipped: boolean;
};

/**
 * Flat rectangular mesh, 3:2 landscape, two faces (front = design, back =
 * writing face). Flip is controlled by the caller (drag-past-90° isn't
 * implemented — it would compete with OrbitControls' own drag-to-orbit
 * gesture on the same canvas).
 */
export function PostcardViewer({ frontTextureUrl, backTextureUrl, flipped }: Props) {
  return (
    <div className="fixed inset-0 h-dvh w-dvw touch-none overflow-hidden bg-muted">
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
        <Scene frontUrl={frontTextureUrl} backUrl={backTextureUrl} flipped={flipped} />
      </Canvas>
    </div>
  );
}
