import { Camera as CameraIcon } from 'lucide-react';
import { Canvas, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  GizmoHelper,
  GizmoViewcube,
  Grid,
  Stage,
  Environment,
  OrthographicCamera,
  PerspectiveCamera,
} from '@react-three/drei';
import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import { OrthographicPerspectiveToggle } from '@/components/viewer/OrthographicPerspectiveToggle';
import { cn } from '@/lib/utils';

type CameraPreset = 'iso' | 'front' | 'top' | 'right';
const CAMERA_PRESET_POSITIONS: Record<CameraPreset, [number, number, number]> = {
  iso: [-100, 100, 100],
  front: [0, 0, 150],
  top: [0, 150, 0],
  right: [150, 0, 0],
};

function CameraPresetApplier({
  preset,
  onApplied,
}: {
  preset: CameraPreset | null;
  onApplied: () => void;
}) {
  const { camera, controls } = useThree();
  useEffect(() => {
    if (!preset) return;
    const [x, y, z] = CAMERA_PRESET_POSITIONS[preset];
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    // Drei's OrbitControls registers itself as the default `controls` when
    // makeDefault is set, exposing `target` + `update()` here.
    const c = controls as unknown as
      | { target: THREE.Vector3; update: () => void }
      | null;
    if (c?.target && typeof c.update === 'function') {
      c.target.set(0, 0, 0);
      c.update();
    }
    onApplied();
  }, [preset, camera, controls, onApplied]);
  return null;
}

interface ThreeSceneProps {
  geometry: THREE.BufferGeometry | null;
  color: string;
  isMobile?: boolean;
  backgroundColor?: string;
  coloredGroup?: THREE.Group | null;
}

export function ThreeScene({
  geometry,
  color,
  isMobile = false,
  backgroundColor = '#3B3B3B',
  coloredGroup,
}: ThreeSceneProps) {
  const [isOrthographic, setIsOrthographic] = useState(true);
  const [pendingPreset, setPendingPreset] = useState<CameraPreset | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  // Cycle the canvas backdrop between dark / studio / light. Driven entirely
  // here — `backgroundColor` from the parent is treated as the dark default.
  const [bgMode, setBgMode] = useState<'dark' | 'studio' | 'light'>('dark');
  const effectiveBg =
    bgMode === 'studio'
      ? '#1B1B1B'
      : bgMode === 'light'
        ? '#E8E8EC'
        : backgroundColor;
  const cycleBg = () =>
    setBgMode((m) =>
      m === 'dark' ? 'studio' : m === 'studio' ? 'light' : 'dark',
    );

  // Store the initial isMobile value to prevent position changes during resize
  const [initialIsMobile] = useState(isMobile);

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const handleSnapshot = () => {
    const canvas =
      canvasContainerRef.current?.querySelector('canvas') ?? null;
    if (!canvas) return;
    // preserveDrawingBuffer keeps the framebuffer readable on the next paint;
    // without it, toDataURL can return a blank image right after a render.
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `bismuth-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // The colored group's meshes sit at their raw OpenSCAD coordinates.
  // Offset so the combined bounds are centered at origin, mirroring the
  // STL path's geom.center() behavior.
  const groupCenterOffset = useMemo(() => {
    if (!coloredGroup) return null;
    const box = new THREE.Box3().setFromObject(coloredGroup);
    if (box.isEmpty()) return new THREE.Vector3();
    return box.getCenter(new THREE.Vector3()).negate();
  }, [coloredGroup]);

  return (
    <div ref={canvasContainerRef} className="relative h-full w-full overflow-hidden">
      <Canvas
        className="block h-full w-full"
        gl={{ preserveDrawingBuffer: true }}
      >
        <color attach="background" args={[effectiveBg]} />
        {isOrthographic ? (
          <OrthographicCamera
            makeDefault
            position={initialIsMobile ? [-100, 150, 100] : [-100, 100, 100]}
            zoom={40}
            near={0.1}
            far={1000}
          />
        ) : (
          <PerspectiveCamera
            makeDefault
            position={initialIsMobile ? [-100, 150, 100] : [-100, 100, 100]}
            fov={45}
            near={0.1}
            far={1000}
            zoom={0.4}
          />
        )}
        <Stage environment={null} intensity={0.6} position={[0, 0, 0]}>
          <Environment files={`${import.meta.env.BASE_URL}/city.hdr`} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} castShadow />
          <directionalLight position={[-5, 5, 5]} intensity={0.2} />
          <directionalLight position={[-5, 5, -5]} intensity={0.2} />
          <directionalLight position={[0, 5, 0]} intensity={0.2} />
          <directionalLight position={[-5, -5, -5]} intensity={0.6} />
          {coloredGroup && groupCenterOffset ? (
            <group rotation={[-Math.PI / 2, 0, 0]}>
              <primitive
                object={coloredGroup}
                position={groupCenterOffset.toArray()}
              />
            </group>
          ) : geometry ? (
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
          ) : null}
        </Stage>
        {showGrid && (
          <>
            <Grid
              position={[0, -0.01, 0]}
              cellSize={10}
              cellThickness={0.5}
              cellColor="#5a5a5a"
              sectionSize={50}
              sectionColor="#888"
              sectionThickness={0.8}
              fadeDistance={600}
              fadeStrength={1.2}
              followCamera={false}
              infiniteGrid={true}
            />
            <axesHelper args={[80]} />
          </>
        )}
        <OrbitControls makeDefault enableDamping={true} dampingFactor={0.05} />
        <CameraPresetApplier
          preset={pendingPreset}
          onApplied={() => setPendingPreset(null)}
        />
        {!initialIsMobile && (
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewcube />
          </GizmoHelper>
        )}
      </Canvas>

      <div
        className={cn(
          'absolute flex flex-col items-center',
          initialIsMobile ? 'bottom-2 right-2' : 'bottom-2 right-9',
        )}
      >
        <div className="flex items-center gap-2">
          <OrthographicPerspectiveToggle
            isOrthographic={isOrthographic}
            onToggle={setIsOrthographic}
          />
        </div>
      </div>

      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-adam-neutral-700/60 bg-adam-neutral-950/70 px-1 py-0.5 backdrop-blur-sm">
        {(['iso', 'front', 'top', 'right'] as const).map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setPendingPreset(preset)}
            aria-label={`${preset} view`}
            title={`${preset.charAt(0).toUpperCase()}${preset.slice(1)} view`}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-adam-neutral-300 transition-colors hover:bg-adam-neutral-800 hover:text-adam-text-primary"
          >
            {preset}
          </button>
        ))}
        <span className="mx-0.5 h-3 w-px bg-adam-neutral-700/60" />
        <button
          type="button"
          onClick={() => setShowGrid((v) => !v)}
          aria-pressed={showGrid}
          aria-label="Toggle grid and axes"
          title="Toggle grid and axes"
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors',
            showGrid
              ? 'bg-adam-blue/30 text-adam-text-primary'
              : 'text-adam-neutral-300 hover:bg-adam-neutral-800 hover:text-adam-text-primary',
          )}
        >
          grid
        </button>
        <button
          type="button"
          onClick={cycleBg}
          aria-label={`Background: ${bgMode}, click to change`}
          title={`Background: ${bgMode}`}
          className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-adam-neutral-300 transition-colors hover:bg-adam-neutral-800 hover:text-adam-text-primary"
        >
          {bgMode}
        </button>
        <button
          type="button"
          onClick={handleSnapshot}
          aria-label="Download viewer as PNG"
          title="Download as PNG"
          className="flex items-center rounded px-1 py-0.5 text-adam-neutral-300 transition-colors hover:bg-adam-neutral-800 hover:text-adam-text-primary"
        >
          <CameraIcon size={12} />
        </button>
      </div>
    </div>
  );
}
