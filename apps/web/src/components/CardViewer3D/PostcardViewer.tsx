"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";

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

  useFrame(() => {
    if (!groupRef.current) return;
    const target = flipped ? Math.PI : 0;
    groupRef.current.rotation.y += (target - groupRef.current.rotation.y) * 0.1;
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshBasicMaterial map={frontTexture} />
      </mesh>
      <mesh rotation={[0, Math.PI, 0]} position={[0, 0, -0.005]}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshBasicMaterial map={backTexture} />
      </mesh>
    </group>
  );
}

function Scene({ frontUrl, backUrl, flipped }: { frontUrl: string; backUrl: string; flipped: boolean }) {
  return (
    <>
      <Suspense fallback={null}>
        <CardMesh frontUrl={frontUrl} backUrl={backUrl} flipped={flipped} />
      </Suspense>
      <OrbitControls enablePan={false} minDistance={2.5} maxDistance={8} />
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
    <div className="relative left-1/2 right-1/2 -mx-[50vw] h-[85vh] w-screen touch-none overflow-hidden bg-muted">
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
        <Scene frontUrl={frontTextureUrl} backUrl={backTextureUrl} flipped={flipped} />
      </Canvas>
    </div>
  );
}
