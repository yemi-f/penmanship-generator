"use client";

import { Suspense, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";

import { Button } from "@/components/ui/button";

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
  const [autoRotate, setAutoRotate] = useState(true);
  return (
    <>
      <Suspense fallback={null}>
        <CardMesh frontUrl={frontUrl} backUrl={backUrl} flipped={flipped} />
      </Suspense>
      <OrbitControls
        autoRotate={autoRotate}
        autoRotateSpeed={1.2}
        onStart={() => setAutoRotate(false)}
        enablePan={false}
        minDistance={2.5}
        maxDistance={8}
      />
    </>
  );
}

type Props = {
  frontTextureUrl: string;
  backTextureUrl: string;
};

/**
 * Flat rectangular mesh, 3:2 landscape, two faces (front = design, back =
 * writing face). Flip via button (drag-past-90° isn't implemented — it would
 * compete with OrbitControls' own drag-to-orbit gesture on the same canvas).
 */
export function PostcardViewer({ frontTextureUrl, backTextureUrl }: Props) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-[3/2] w-full touch-none overflow-hidden rounded-md border bg-muted">
        <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
          <Scene frontUrl={frontTextureUrl} backUrl={backTextureUrl} flipped={flipped} />
        </Canvas>
      </div>
      <Button type="button" variant="outline" onClick={() => setFlipped((f) => !f)}>
        Flip
      </Button>
    </div>
  );
}
