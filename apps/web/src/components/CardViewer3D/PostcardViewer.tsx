"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";

import { useClickWithoutDrag } from "./useClickWithoutDrag";
import { useHoverCursor } from "./useHoverCursor";
import { useParallaxTilt } from "./useParallaxTilt";

const WIDTH = 3;
const HEIGHT = 2; // postcards are always landscape, 3:2

function CardMesh({
  frontUrl,
  backUrl,
  flipped,
  onToggle,
}: {
  frontUrl: string;
  backUrl: string;
  flipped: boolean;
  onToggle: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [frontTexture, backTexture] = useTexture([frontUrl, backUrl]);
  // useTexture doesn't set colorSpace itself; without this, sRGB-encoded PNG data gets
  // treated as linear and re-encoded on output, crushing contrast (most visible on the
  // low-contrast handwriting texture, which reads as washed-out pale gray instead of ink).
  frontTexture.colorSpace = THREE.SRGBColorSpace;
  backTexture.colorSpace = THREE.SRGBColorSpace;
  const hoverCursor = useHoverCursor();
  const clickHandlers = useClickWithoutDrag(onToggle);

  useFrame(() => {
    if (!groupRef.current) return;
    const target = flipped ? Math.PI : 0;
    groupRef.current.rotation.y += (target - groupRef.current.rotation.y) * 0.1;
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 0.005]} {...clickHandlers} {...hoverCursor}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshBasicMaterial map={frontTexture} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, Math.PI, 0]} position={[0, 0, -0.005]} {...clickHandlers} {...hoverCursor}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshBasicMaterial map={backTexture} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Scene({
  frontUrl,
  backUrl,
  flipped,
  onToggle,
}: {
  frontUrl: string;
  backUrl: string;
  flipped: boolean;
  onToggle: () => void;
}) {
  const parallaxRef = useRef<THREE.Group>(null);
  const isDraggingRef = useRef(false);
  useParallaxTilt(parallaxRef, true, isDraggingRef);

  return (
    <>
      <group ref={parallaxRef}>
        <Suspense fallback={null}>
          <CardMesh frontUrl={frontUrl} backUrl={backUrl} flipped={flipped} onToggle={onToggle} />
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
  onToggle: () => void;
};

/**
 * Flat rectangular mesh, 3:2 landscape, two faces (front = design, back =
 * writing face). Flip is controlled by the caller — via the toolbar button,
 * or by clicking the postcard directly. Click detection is hand-rolled via
 * useClickWithoutDrag rather than the mesh's built-in onClick, since react-
 * three-fiber's own click heuristic still fires during an orbit-rotate drag
 * that starts and ends over the same mesh — a drag-past-90° flip gesture
 * isn't implemented for the same reason, it would only compound the conflict
 * with OrbitControls' drag-to-orbit on the same canvas.
 */
export function PostcardViewer({ frontTextureUrl, backTextureUrl, flipped, onToggle }: Props) {
  return (
    <div className="fixed inset-0 h-dvh w-dvw touch-none overflow-hidden bg-muted">
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
        <Scene frontUrl={frontTextureUrl} backUrl={backTextureUrl} flipped={flipped} onToggle={onToggle} />
      </Canvas>
    </div>
  );
}
