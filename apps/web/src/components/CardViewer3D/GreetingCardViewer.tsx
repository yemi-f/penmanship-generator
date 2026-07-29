"use client";

import { Suspense, useEffect, useRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, useTexture } from "@react-three/drei";
import * as THREE from "three";

import { useDominantColor } from "./useDominantColor";
import { useHingeSpring } from "./useHingeSpring";
import { useClickWithoutDrag } from "./useClickWithoutDrag";
import { useHoverCursor } from "./useHoverCursor";
import { useParallaxTilt } from "./useParallaxTilt";

const PANEL_HEIGHT = 2;
const PANEL_THICKNESS = 0.015;
// WritingPanel always shows the writing texture — never swapped. CoverPanel is the one that
// carries the design texture on its reverse face, which its own 180° closed-rotation
// naturally brings around to face the camera (see CoverPanel below). For that reveal to be
// visible rather than hidden, CoverPanel must be the panel *closer* to the camera when the
// two coincide (closed), hence COVER > WRITING here.
const WRITING_STATIC_Z = -PANEL_THICKNESS / 2;
const COVER_STATIC_Z = PANEL_THICKNESS / 2;

// Both panels pivot around the shared spine (a vertical line at x=0 for portrait/book-style
// cards, rotating around Y; a horizontal line at y=0 for landscape/top-hinged cards, rotating
// around X — see hingeAxis). Closed: writing panel faces the camera flat (0°), cover panel
// folds a full 180° behind it (hidden) — together they read as a single closed cover.
// Open: each panel rotates in by 30° from the fully-flat (180° apart) reference, giving a
// ~120° dihedral angle — pronounced enough to read as clearly open even with both panels now
// plain white. Same numeric angles work for both hinge axes (verified algebraically).
const CLOSED_WRITING = 0;
const OPEN_WRITING = -Math.PI / 6;
const CLOSED_COVER = Math.PI;
const OPEN_COVER = Math.PI / 6;

const LIFT_PEAK = 0.06;
const LIFT_STIFFNESS = 260;
const LIFT_DAMPING = 30; // ζ≈0.93, near-critical — pops and resolves before the hinge spring settles

const IMPRINT_TEXT = "MADE JUST FOR YOU AT PENMANSHIP.ME";
const IMPRINT_Y = -PANEL_HEIGHT * 0.31; // bottom third of the panel, matching a real card's back imprint

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

function WritingPanel({
  panelWidth,
  writingUrl,
  isOpen,
  liftRef,
  onToggle,
  hingeAxis,
}: {
  panelWidth: number;
  writingUrl: string;
  isOpen: boolean;
  liftRef: RefObject<number>;
  onToggle: () => void;
  hingeAxis: "x" | "y";
}) {
  const pivotRef = useRef<THREE.Group>(null);
  const writingTexture = useTexture(writingUrl);
  writingTexture.colorSpace = THREE.SRGBColorSpace;
  const hoverCursor = useHoverCursor();
  const clickHandlers = useClickWithoutDrag(onToggle);

  useHingeSpring(pivotRef, isOpen ? OPEN_WRITING : CLOSED_WRITING, { axis: hingeAxis });
  useFrame(() => {
    if (pivotRef.current) pivotRef.current.position.z = WRITING_STATIC_Z + liftRef.current;
  });

  // Panel's own face-center, relative to the shared pivot: offset along the axis
  // perpendicular to the hinge (X for a side spine, -Y for a top spine).
  const meshOffset: [number, number, number] =
    hingeAxis === "y" ? [panelWidth / 2, 0, 0] : [0, -PANEL_HEIGHT / 2, 0];
  // On a top hinge the closed card's vertical span sits entirely below the pivot
  // (spine at the card's top edge) — shift the pivot up by half the card height so
  // the closed card is vertically centered in view instead of hanging below center.
  const pivotY = hingeAxis === "x" ? PANEL_HEIGHT / 2 : 0;

  return (
    <group ref={pivotRef} position={[0, pivotY, 0]}>
      <mesh position={meshOffset} {...clickHandlers} {...hoverCursor}>
        <boxGeometry args={[panelWidth, PANEL_HEIGHT, PANEL_THICKNESS]} />
        <meshBasicMaterial attach="material-0" color="white" toneMapped={false} />
        <meshBasicMaterial attach="material-1" color="white" toneMapped={false} />
        <meshBasicMaterial attach="material-2" color="white" toneMapped={false} />
        <meshBasicMaterial attach="material-3" color="white" toneMapped={false} />
        {/* +Z: always the inside writing page — never swapped. When closed, this sits
            behind CoverPanel (see WRITING_STATIC_Z/COVER_STATIC_Z) and is fully hidden by
            CoverPanel's own reverse face, which rotates into view instead. */}
        <meshBasicMaterial attach="material-4" map={writingTexture} toneMapped={false} />
        {/* -Z: always blank. */}
        <meshBasicMaterial attach="material-5" color="white" toneMapped={false} />
      </mesh>
      {/* Outside-back imprint, printed on the same -Z face as the blank material above.
          rotation.y=π turns the text to face -Z (outward, away from the writing side) while
          keeping it unmirrored for a viewer who has orbited around to look at the card's back. */}
      <Text
        position={[meshOffset[0], meshOffset[1] + IMPRINT_Y, -PANEL_THICKNESS / 2 - 0.003]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.035}
        letterSpacing={0.05}
        color="#2b2b2b"
        anchorX="center"
        anchorY="middle"
        textAlign="center"
        maxWidth={panelWidth * 0.5}
      >
        {IMPRINT_TEXT}
      </Text>
    </group>
  );
}

function CoverPanel({
  panelWidth,
  designUrl,
  isOpen,
  liftRef,
  onToggle,
  hingeAxis,
}: {
  panelWidth: number;
  designUrl: string;
  isOpen: boolean;
  liftRef: RefObject<number>;
  onToggle: () => void;
  hingeAxis: "x" | "y";
}) {
  const pivotRef = useRef<THREE.Group>(null);
  const designTexture = useTexture(designUrl);
  designTexture.colorSpace = THREE.SRGBColorSpace;
  // The closed reference (CLOSED_COVER = 180°) reaches the camera-facing -Z face via a
  // rotation around hingeAxis. Around Y that only mirrors X (which the box's default -Z
  // UV already accounts for); around X it instead flips Y (vertical) — so on a top hinge
  // the design would render upside down unless we counter that with a vertical texture flip.
  if (hingeAxis === "x") {
    designTexture.flipY = false;
    designTexture.needsUpdate = true;
  }
  const hoverCursor = useHoverCursor();
  const clickHandlers = useClickWithoutDrag(onToggle);

  // CoverPanel swings through ~150° (vs. WritingPanel's ~30°) — the default spring's ~7.7%
  // overshoot is subtle in absolute degrees on a small swing but reads as a visible
  // slide-past-and-back on this much larger arc, since the mesh sits offset from its pivot.
  // Higher damping (ζ≈1.05, just past critical) keeps it snappy with no overshoot.
  useHingeSpring(pivotRef, isOpen ? OPEN_COVER : CLOSED_COVER, { damping: 20, axis: hingeAxis });
  useFrame(() => {
    if (pivotRef.current) pivotRef.current.position.z = COVER_STATIC_Z + liftRef.current;
  });

  const meshOffset: [number, number, number] =
    hingeAxis === "y" ? [-panelWidth / 2, 0, 0] : [0, PANEL_HEIGHT / 2, 0];
  // Must match WritingPanel's pivotY exactly — both panels share one spine position.
  const pivotY = hingeAxis === "x" ? PANEL_HEIGHT / 2 : 0;

  return (
    <group ref={pivotRef} position={[0, pivotY, 0]}>
      <mesh position={meshOffset} {...clickHandlers} {...hoverCursor}>
        <boxGeometry args={[panelWidth, PANEL_HEIGHT, PANEL_THICKNESS]} />
        <meshBasicMaterial attach="material-0" color="white" toneMapped={false} />
        <meshBasicMaterial attach="material-1" color="white" toneMapped={false} />
        <meshBasicMaterial attach="material-2" color="white" toneMapped={false} />
        <meshBasicMaterial attach="material-3" color="white" toneMapped={false} />
        {/* +Z, camera-facing when open: blank inside page. */}
        <meshBasicMaterial attach="material-4" color="white" toneMapped={false} />
        {/* -Z: the design/front-cover image — this leaf's outward face, revealed by orbiting
            around the open card from the blank side, i.e. the side without the writing. */}
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
  onToggle,
  hingeAxis,
}: {
  panelWidth: number;
  designUrl: string;
  writingUrl: string;
  isOpen: boolean;
  onToggle: () => void;
  hingeAxis: "x" | "y";
}) {
  const parallaxRef = useRef<THREE.Group>(null);
  const isDraggingRef = useRef(false);
  const liftRef = useLiftPulse(isOpen);
  useParallaxTilt(parallaxRef, !isOpen, isDraggingRef);

  return (
    <>
      <group ref={parallaxRef}>
        <Suspense fallback={null}>
          <WritingPanel
            panelWidth={panelWidth}
            writingUrl={writingUrl}
            isOpen={isOpen}
            liftRef={liftRef}
            onToggle={onToggle}
            hingeAxis={hingeAxis}
          />
          <CoverPanel
            panelWidth={panelWidth}
            designUrl={designUrl}
            isOpen={isOpen}
            liftRef={liftRef}
            onToggle={onToggle}
            hingeAxis={hingeAxis}
          />
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
  onToggle: () => void;
};

/**
 * Open-book greeting card. Closed: single panel, outside front = design
 * image. Open: ~150° dihedral, writing panel static-ish, cover panel = blank
 * reverse face. Portrait hinges on a vertical side spine (book-style);
 * landscape hinges on a horizontal top spine (flip-top/tent-card style).
 * Open/close state is controlled by the caller — via the toolbar button, or
 * by clicking the card directly (either panel's mesh has an onClick).
 */
export function GreetingCardViewer({ orientation, designTextureUrl, writingTextureUrl, isOpen, onToggle }: Props) {
  const panelWidth = orientation === "portrait" ? PANEL_HEIGHT * (1200 / 1800) : PANEL_HEIGHT * (1800 / 1200);
  const hingeAxis = orientation === "landscape" ? "x" : "y";
  const dominantColor = useDominantColor(designTextureUrl);

  return (
    <div
      className="fixed inset-0 h-dvh w-dvw touch-none overflow-hidden bg-muted transition-colors duration-500"
      style={isOpen && dominantColor ? { backgroundColor: dominantColor } : undefined}
    >
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
        <Scene
          panelWidth={panelWidth}
          designUrl={designTextureUrl}
          writingUrl={writingTextureUrl}
          isOpen={isOpen}
          onToggle={onToggle}
          hingeAxis={hingeAxis}
        />
      </Canvas>
    </div>
  );
}
