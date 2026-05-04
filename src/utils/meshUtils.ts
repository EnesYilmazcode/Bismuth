import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three-stdlib';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Mesh } from '@shared/types';

export interface BoundingBox {
  x: number;
  y: number;
  z: number;
}

/**
 * Parse an STL file and extract geometry with bounding box
 */
export async function parseSTL(
  file: File,
): Promise<{ geometry: THREE.BufferGeometry; boundingBox: BoundingBox }> {
  const buffer = await file.arrayBuffer();
  const loader = new STLLoader();
  const geometry = loader.parse(buffer);

  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;

  const boundingBox: BoundingBox = {
    x: Math.round((box.max.x - box.min.x) * 100) / 100,
    y: Math.round((box.max.y - box.min.y) * 100) / 100,
    z: Math.round((box.max.z - box.min.z) * 100) / 100,
  };

  geometry.center();
  geometry.computeVertexNormals();

  return { geometry, boundingBox };
}

/**
 * Render a geometry from multiple camera angles for AI analysis
 */
export async function renderMultipleAngles(
  geometry: THREE.BufferGeometry,
  boundingBox: BoundingBox,
): Promise<Blob[]> {
  const cameraAngles = [
    { position: [1, 1, 1], name: 'isometric' },
    { position: [0, 0, 1], name: 'top' },
    { position: [0, -1, 0], name: 'front' },
    { position: [1, 0, 0], name: 'right' },
  ];

  const renders: Blob[] = [];
  const size = 512;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });

  renderer.setSize(size, size);
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f5f5);

  const geometryClone = geometry.clone();

  const material = new THREE.MeshStandardMaterial({
    color: 0x00a6ff,
    metalness: 0.3,
    roughness: 0.5,
  });
  const mesh = new THREE.Mesh(geometryClone, material);

  mesh.rotation.set(-Math.PI / 2, 0, 0);
  scene.add(mesh);

  scene.add(new THREE.AmbientLight(0xffffff, 0.8));

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight1.position.set(5, 5, 5);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.2);
  dirLight2.position.set(-5, 5, 5);
  scene.add(dirLight2);

  const dirLight3 = new THREE.DirectionalLight(0xffffff, 0.2);
  dirLight3.position.set(-5, 5, -5);
  scene.add(dirLight3);

  const maxDim = Math.max(boundingBox.x, boundingBox.y, boundingBox.z);
  const safeDim = maxDim > 0 ? maxDim : 1;
  const cameraDistance = safeDim * 2.5;

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, safeDim * 10);

  try {
    for (const angle of cameraAngles) {
      camera.position.set(
        angle.position[0] * cameraDistance,
        angle.position[1] * cameraDistance,
        angle.position[2] * cameraDistance,
      );
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) {
              resolve(b);
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          },
          'image/png',
          0.9,
        );
      });
      renders.push(blob);
    }
  } finally {
    renderer.dispose();
    geometryClone.dispose();
    material.dispose();
  }

  return renders;
}

/**
 * Validate that a file is a valid STL
 */
export function isValidSTL(file: File): boolean {
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension !== 'stl') {
    return false;
  }

  const validMimeTypes = [
    'model/stl',
    'application/sla',
    'application/vnd.ms-pki.stl',
    'application/octet-stream',
    '',
  ];

  return validMimeTypes.includes(file.type) || file.type === '';
}

export const generatePreview = async (
  mesh: Blob,
  fileType: Mesh['fileType'] = 'glb',
) => {
  const arrayBuffer = await mesh.arrayBuffer();

  let scene: THREE.Scene;

  if (fileType === 'stl') {
    // Handle STL files
    const loader = new STLLoader();
    const geometry = loader.parse(arrayBuffer);

    // Center the geometry
    geometry.center();
    geometry.computeVertexNormals();

    // Create a mesh with the STL geometry
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.6,
      roughness: 0.3,
    });
    const mesh = new THREE.Mesh(geometry, material);

    // Create scene and add the mesh
    scene = new THREE.Scene();
    scene.add(mesh);
  } else if (fileType === 'obj') {
    // Handle OBJ files
    const loader = new OBJLoader();
    const objText = new TextDecoder().decode(arrayBuffer);
    const objGroup = loader.parse(objText);

    // Create scene and add the OBJ group
    scene = new THREE.Scene();
    scene.add(objGroup);
  } else {
    // Handle GLB files (original logic)
    const loader = new GLTFLoader();
    const gltf = await new Promise<GLTF>((resolve, reject) => {
      loader.parse(arrayBuffer, '', resolve, reject);
    });

    scene = new THREE.Scene();
    scene.add(gltf.scene);
  }

  const box = new THREE.Box3().setFromObject(scene);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  // Calculate the diagonal of the bounding box
  const diagonal = Math.sqrt(
    size.x * size.x + size.y * size.y + size.z * size.z,
  );

  // Calculate the minimum distance needed to fit the object
  // We use a larger factor (1.5) to ensure the object is comfortably visible
  const fov = 75 * (Math.PI / 180); // Using default FOV of 75
  const distance = (diagonal / 2 / Math.tan(fov / 2)) * 1.5;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(1000, 1000);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setPixelRatio(window.devicePixelRatio);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  // const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  camera.position.set(center.x, center.y, center.z + distance);
  camera.lookAt(center);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);

  const renderScene = new THREE.Scene();

  renderScene.background = new THREE.Color(0x3b3b3b);
  renderScene.environment = pmremGenerator.fromScene(
    new RoomEnvironment(),
    0.04,
  ).texture;

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(1, 1, 1);
  renderScene.add(directionalLight);

  renderScene.add(scene);

  renderer.render(renderScene, camera);

  const image = renderer.domElement.toDataURL('image/png');

  pmremGenerator.dispose();
  renderer.dispose();

  return image;
};

export const applyMaterialAdjustments = (
  material: THREE.MeshStandardMaterial,
  actualBrightness: number,
  actualRoughness: number,
  actualNormalIntensity?: number,
) => {
  // Apply brightness to color
  if ('color' in material && material.color instanceof THREE.Color) {
    const colorMat = material;
    const origColor = colorMat.color.clone();
    const r = Math.min(1, Math.max(0, origColor.r * actualBrightness));
    const g = Math.min(1, Math.max(0, origColor.g * actualBrightness));
    const b = Math.min(1, Math.max(0, origColor.b * actualBrightness));
    colorMat.color.setRGB(r, g, b);
  }

  // Apply emissive for brightness (if actualNormalIntensity provided, we're in full mode)
  if (
    actualNormalIntensity !== undefined &&
    'emissive' in material &&
    material.emissive instanceof THREE.Color
  ) {
    const emissiveMat = material;
    const intensity = Math.max(0, (actualBrightness - 1) * 0.2);
    emissiveMat.emissive.setRGB(intensity, intensity, intensity);
  }

  // Apply roughness
  if ('roughness' in material) {
    material.roughness = actualRoughness;
  }

  // Apply normal map intensity (only if provided)
  if (
    actualNormalIntensity !== undefined &&
    'normalMap' in material &&
    'normalScale' in material
  ) {
    const pbrMat = material;
    if (pbrMat.normalMap && pbrMat.normalScale) {
      pbrMat.normalScale = new THREE.Vector2(
        actualNormalIntensity,
        actualNormalIntensity,
      );
    }
  }

  // Ensure material updates
  material.needsUpdate = true;
};
