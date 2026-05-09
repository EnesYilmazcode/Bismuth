import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  PerspectiveCamera,
  Stage,
  Environment,
} from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { useOpenSCAD } from '@/hooks/useOpenSCAD';
import OpenSCADError from '@/lib/OpenSCADError';

interface BenchmarkViewerProps {
  code: string;
  color?: string;
  /** Rotations per minute around the Y axis. 0 disables auto-rotation. */
  rotationRpm?: number;
}

// OpenSCAD WASM emits multi-line stderr on compile failure (a banner about
// "ERROR: Parser error" plus follow-up lines, plus warnings). Pull the
// first line that actually says something — usually the parser/eval line
// with the line number — so the user sees what broke instead of a
// generic "compile failed" string.
function firstUsefulErrorLine(err: unknown): string {
  if (err instanceof OpenSCADError && err.stdErr.length > 0) {
    const line = err.stdErr.find((l) => /ERROR|WARNING/i.test(l)) ?? err.stdErr[0];
    return line.replace(/^ERROR:\s*/i, '').trim();
  }
  if (err instanceof Error && err.message) return err.message;
  return 'OpenSCAD WASM rejected the source';
}

// Minimal 3D viewer for a single benchmark pane. Lighter than the parametric
// OpenSCADPreview — no DXF export, no error-fix button, no toolbar — so a
// 2×2 grid of these stays responsive. Each instance compiles OpenSCAD in its
// own worker (useOpenSCAD owns the worker lifecycle).
export function BenchmarkViewer({
  code,
  color = '#9CA3AF',
  rotationRpm = 4,
}: BenchmarkViewerProps) {
  // Drei's OrbitControls expresses speed in "amount per frame at 60fps".
  // 2π × rpm / 60s × (1/60fps) gives the per-frame radians, which the
  // control treats as the rotation speed parameter directly when scaled by
  // their internal constant of 60. In practice: speed ≈ rpm × 0.6.
  const autoRotateSpeed = rotationRpm * 0.6;
  const { compileScad, isCompiling, output, isError, error } = useOpenSCAD();
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const lastGeomRef = useRef<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!code) {
      setGeometry(null);
      return;
    }
    compileScad(code);
  }, [code, compileScad]);

  useEffect(() => {
    if (!(output instanceof Blob)) return;
    let cancelled = false;
    output
      .arrayBuffer()
      .then((buffer) => {
        if (cancelled) return;
        const loader = new STLLoader();
        const geom = loader.parse(buffer);
        geom.center();
        geom.computeVertexNormals();
        if (lastGeomRef.current) lastGeomRef.current.dispose();
        lastGeomRef.current = geom;
        setGeometry(geom);
      })
      .catch(() => {
        if (!cancelled) setGeometry(null);
      });
    return () => {
      cancelled = true;
    };
  }, [output]);

  useEffect(() => {
    return () => {
      if (lastGeomRef.current) {
        lastGeomRef.current.dispose();
        lastGeomRef.current = null;
      }
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <Canvas
        className="block h-full w-full"
        // frameloop=always so the auto-rotation animates without us needing
        // to drive invalidate() ourselves. Per-pane CPU cost is small at the
        // pane sizes the grid produces.
        frameloop={rotationRpm > 0 ? 'always' : 'demand'}
        gl={{ preserveDrawingBuffer: true }}
      >
        <color attach="background" args={['#3B3B3B']} />
        <PerspectiveCamera
          makeDefault
          position={[-100, 100, 100]}
          fov={45}
          near={0.1}
          far={1000}
          zoom={0.45}
        />
        <Stage environment={null} intensity={0.6} position={[0, 0, 0]}>
          <Environment files={`${import.meta.env.BASE_URL}/city.hdr`} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} castShadow />
          <directionalLight position={[-5, 5, 5]} intensity={0.2} />
          <directionalLight position={[-5, -5, -5]} intensity={0.6} />
          {geometry && (
            <mesh
              geometry={geometry}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0, 0]}
            >
              <meshStandardMaterial
                color={color}
                metalness={0.6}
                roughness={0.3}
                envMapIntensity={0.3}
              />
            </mesh>
          )}
        </Stage>
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          autoRotate={rotationRpm > 0}
          autoRotateSpeed={autoRotateSpeed}
        />
      </Canvas>
      {isCompiling && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-adam-neutral-700/30 backdrop-blur-sm">
          <span className="rounded bg-adam-neutral-950/80 px-2 py-1 font-mono text-[10.5px] uppercase tracking-wider text-adam-neutral-300">
            compiling
          </span>
        </div>
      )}
      {isError && !isCompiling && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-4 text-center">
          <span className="text-[11px] font-medium uppercase tracking-wider text-red-400">
            compile failed
          </span>
          <p className="line-clamp-3 max-w-[320px] font-mono text-[10.5px] leading-relaxed text-adam-neutral-300">
            {firstUsefulErrorLine(error)}
          </p>
        </div>
      )}
    </div>
  );
}
