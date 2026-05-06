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

interface BenchmarkViewerProps {
  code: string;
  color?: string;
}

// Minimal 3D viewer for a single benchmark pane. Lighter than the parametric
// OpenSCADPreview — no DXF export, no error-fix button, no toolbar — so a
// 2×2 grid of these stays responsive. Each instance compiles OpenSCAD in its
// own worker (useOpenSCAD owns the worker lifecycle).
export function BenchmarkViewer({
  code,
  color = '#9CA3AF',
}: BenchmarkViewerProps) {
  const { compileScad, isCompiling, output, isError } = useOpenSCAD();
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
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
      </Canvas>
      {isCompiling && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-adam-neutral-700/30 backdrop-blur-sm">
          <span className="rounded bg-adam-neutral-950/80 px-2 py-1 font-mono text-[10.5px] uppercase tracking-wider text-adam-neutral-300">
            compiling
          </span>
        </div>
      )}
      {isError && !isCompiling && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-red-400">
          OpenSCAD compile failed
        </div>
      )}
    </div>
  );
}
