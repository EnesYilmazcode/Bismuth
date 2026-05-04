import * as THREE from 'three';
import { GLTF, STLExporter, STLExporterOptionsBinary } from 'three-stdlib';

// Print processing constants
const PRINT_CONSTANTS = {
  // Size requirements for Mandarin3D
  BASE_MINIMUM_SIZE_MM: 100, // 100mm (10cm) minimum dimension
  BASE_MINIMUM_BOUNDING_RADIUS_MM: 80, // 80mm radius
  GUARANTEED_MINIMUM_OUTPUT_MM: 20, // 20mm (2cm) minimum dimension
  WARNING_SIZE_THRESHOLD_MM: 50, // Warn if smaller than 50mm

  // Geometry tolerances
  VERTEX_MERGE_TOLERANCE: 0.0001,
  GROUND_INTERSECTION_OFFSET: 0.001,

  // Advanced mesh repair tolerances
  DUPLICATE_VERTEX_PRECISION: 1e-6, // Precision for duplicate vertex detection
  DEGENERATE_TRIANGLE_AREA_THRESHOLD: 1e-10, // Minimum triangle area to keep
  VERTEX_WELD_DISTANCE: 1e-5, // Distance for welding nearby vertices

  // Model type thresholds
  HIGH_ASPECT_RATIO_THRESHOLD: 5,
  SMALL_VOLUME_THRESHOLD_CM3: 100,
  SMALL_RADIUS_THRESHOLD_MM: 100, // Separate threshold for radius comparison
  LARGE_MODEL_THRESHOLD_MM: 1000,

  // Scaling multipliers
  THIN_MODEL_SCALE_MULTIPLIER: 1.1,
  SMALL_DETAILED_SCALE_MULTIPLIER: 1.3,
  STANDARD_SCALE_MULTIPLIER: 1.05,

  // Unit conversion
  M_TO_MM: 1000, // Converts meters to millimeters
} as const;

// const DEBUG = true;
const DEBUG = false;

/**
 * Helper function to ensure the model has valid, printable geometry
 */
export const ensureValidPrintableGeometry = (meshes: THREE.Mesh[]): boolean => {
  let isValid = true;

  // Check each mesh for printability issues
  meshes.forEach((mesh, index) => {
    if (!mesh.geometry) {
      if (DEBUG) {
        console.error(`Mesh ${index} has no geometry`);
      }
      isValid = false;
      return;
    }

    const position = mesh.geometry.attributes.position;
    if (!position) {
      if (DEBUG) {
        console.error(`Mesh ${index} has no position attribute`);
      }
      isValid = false;
      return;
    }

    // Check if the mesh has enough vertices to form valid triangles
    if (position.count < 3) {
      if (DEBUG) {
        console.error(`Mesh ${index} has too few vertices (${position.count})`);
      }
      isValid = false;
      return;
    }

    // Check if mesh is too small (near-zero volume)
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);

    const volume = size.x * size.y * size.z;
    if (volume < 1e-8) {
      if (DEBUG) {
        console.error(`Mesh ${index} has near-zero volume`);
      }
      isValid = false;
    }
  });

  return isValid;
};

/**
 * Helper function to ensure the model makes proper contact with the print bed
 */
export const ensureFirstLayerExtrusion = (scene: THREE.Scene): void => {
  // Find the lowest point in the model
  const box = new THREE.Box3().setFromObject(scene);

  // Check if the bottom of the model is exactly at y=0
  if (Math.abs(box.min.y) > 0.001) {
    if (DEBUG) {
      console.log(
        `Adjusting model position. Current bottom: ${box.min.y.toFixed(6)}`,
      );
    }

    // Move the model so the bottom is at y=0 (plus a tiny bit to ensure contact)
    const adjustment = -box.min.y + 0.001;
    scene.position.y += adjustment;

    // Verify the adjustment worked
    const newBox = new THREE.Box3().setFromObject(scene);
    if (DEBUG) {
      console.log(`Model bottom after adjustment: ${newBox.min.y.toFixed(6)}`);
    }
  }

  // Check for model parts that might not be connected to the base
  // This helps identify potential islands that won't adhere to the print bed
  scene.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      const meshBox = new THREE.Box3().setFromObject(node);
      if (meshBox.min.y > 0.1) {
        // More than 100mm above the ground
        if (DEBUG) {
          console.warn(
            `Detected mesh part ${node.uuid.slice(0, 8)} floating ${meshBox.min.y.toFixed(2)}m above ground`,
          );
        }
      }
    }
  });
};

/**
 * Advanced non-manifold edge repair functions
 */

/**
 * Remove degenerate triangles (zero area triangles) that cause non-manifold issues
 */
const removeDegenerateTriangles = (geometry: THREE.BufferGeometry): void => {
  if (!geometry.index || !geometry.attributes.position) return;

  const position = geometry.attributes.position.array;
  const indices = geometry.index.array;
  const newIndices: number[] = [];

  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i < indices.length; i += 3) {
    const i1 = indices[i] * 3;
    const i2 = indices[i + 1] * 3;
    const i3 = indices[i + 2] * 3;

    v1.set(position[i1], position[i1 + 1], position[i1 + 2]);
    v2.set(position[i2], position[i2 + 1], position[i2 + 2]);
    v3.set(position[i3], position[i3 + 1], position[i3 + 2]);

    // Calculate triangle area using cross product
    edge1.subVectors(v2, v1);
    edge2.subVectors(v3, v1);
    normal.crossVectors(edge1, edge2);

    const area = normal.length() * 0.5;

    // Only keep triangles with area > threshold
    if (area > PRINT_CONSTANTS.DEGENERATE_TRIANGLE_AREA_THRESHOLD) {
      newIndices.push(indices[i], indices[i + 1], indices[i + 2]);
    }
  }

  geometry.setIndex(newIndices);
  if (DEBUG) {
    console.log(
      `Removed ${(indices.length - newIndices.length) / 3} degenerate triangles`,
    );
  }
};

/**
 * Fix non-manifold edges by identifying and resolving topology issues
 */
const fixNonManifoldEdges = (geometry: THREE.BufferGeometry): void => {
  if (!geometry.index || !geometry.attributes.position) return;

  const indices = geometry.index.array;

  // Build edge-face adjacency map
  const edgeToFaces = new Map<string, number[]>();
  const faceCount = indices.length / 3;

  // Create edge key from two vertex indices (smaller index first for consistency)
  const makeEdgeKey = (v1: number, v2: number): string => {
    return v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;
  };

  // Build edge-face adjacency
  for (let face = 0; face < faceCount; face++) {
    const i1 = indices[face * 3];
    const i2 = indices[face * 3 + 1];
    const i3 = indices[face * 3 + 2];

    // Add each edge of the triangle
    const edges = [
      makeEdgeKey(i1, i2),
      makeEdgeKey(i2, i3),
      makeEdgeKey(i3, i1),
    ];

    edges.forEach((edgeKey) => {
      if (!edgeToFaces.has(edgeKey)) {
        edgeToFaces.set(edgeKey, []);
      }
      edgeToFaces.get(edgeKey)!.push(face);
    });
  }

  // Find non-manifold edges (shared by more than 2 faces)
  const nonManifoldEdges: string[] = [];
  const boundaryEdges: string[] = [];

  edgeToFaces.forEach((faces, edgeKey) => {
    if (faces.length > 2) {
      nonManifoldEdges.push(edgeKey);
    } else if (faces.length === 1) {
      boundaryEdges.push(edgeKey);
    }
  });

  if (DEBUG) {
    console.log(`Found ${nonManifoldEdges.length} non-manifold edges`);
    console.log(`Found ${boundaryEdges.length} boundary edges`);
  }

  // For now, we'll remove faces that create non-manifold edges
  // This is a conservative approach that may remove some geometry but ensures manifold mesh
  if (nonManifoldEdges.length > 0) {
    const facesToRemove = new Set<number>();

    nonManifoldEdges.forEach((edgeKey) => {
      const faces = edgeToFaces.get(edgeKey)!;
      // Remove all but the first two faces sharing this edge
      for (let i = 2; i < faces.length; i++) {
        facesToRemove.add(faces[i]);
      }
    });

    const newIndices: number[] = [];
    for (let face = 0; face < faceCount; face++) {
      if (!facesToRemove.has(face)) {
        newIndices.push(
          indices[face * 3],
          indices[face * 3 + 1],
          indices[face * 3 + 2],
        );
      }
    }

    geometry.setIndex(newIndices);
    if (DEBUG) {
      console.log(
        `Removed ${facesToRemove.size} faces to fix non-manifold edges`,
      );
    }
  }
};

/**
 * Remove duplicate vertices with more sophisticated checking
 */
const removeAdvancedDuplicateVertices = (
  geometry: THREE.BufferGeometry,
): void => {
  if (!geometry.attributes.position) return;

  const position = geometry.attributes.position.array;
  const vertexCount = position.length / 3;
  const precision = PRINT_CONSTANTS.DUPLICATE_VERTEX_PRECISION;

  // Build vertex hash map for fast duplicate detection
  const vertexMap = new Map<string, number>();
  const vertexRemapping: number[] = [];
  const newPositions: number[] = [];
  let newVertexCount = 0;

  for (let i = 0; i < vertexCount; i++) {
    const x = position[i * 3];
    const y = position[i * 3 + 1];
    const z = position[i * 3 + 2];

    // Create hash key with precision
    const key = `${Math.round(x / precision)},${Math.round(y / precision)},${Math.round(z / precision)}`;

    if (vertexMap.has(key)) {
      // Duplicate found, map to existing vertex
      vertexRemapping[i] = vertexMap.get(key)!;
    } else {
      // New vertex
      vertexMap.set(key, newVertexCount);
      vertexRemapping[i] = newVertexCount;
      newPositions.push(x, y, z);
      newVertexCount++;
    }
  }

  // Only update if we actually removed duplicates
  if (newVertexCount < vertexCount) {
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(newPositions, 3),
    );

    // Update indices if they exist
    if (geometry.index) {
      const indices = geometry.index.array;
      for (let i = 0; i < indices.length; i++) {
        indices[i] = vertexRemapping[indices[i]];
      }
    }

    if (DEBUG) {
      console.log(`Removed ${vertexCount - newVertexCount} duplicate vertices`);
    }
  }
};

/**
 * Fix face orientation inconsistencies that cause non-manifold issues
 */
const fixFaceOrientations = (geometry: THREE.BufferGeometry): void => {
  if (!geometry.index || !geometry.attributes.position) return;

  const indices = geometry.index.array;
  const faceCount = indices.length / 3;

  // Build face adjacency and track orientations
  const adjacency = new Map<
    string,
    { face1: number; face2: number; consistent: boolean }
  >();

  const makeEdgeKey = (v1: number, v2: number): string => {
    return v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;
  };

  const getEdgeOrientation = (
    face: number,
    v1: number,
    v2: number,
  ): boolean => {
    const faceIndices = [
      indices[face * 3],
      indices[face * 3 + 1],
      indices[face * 3 + 2],
    ];

    // Find the indices in the face
    const idx1 = faceIndices.indexOf(v1);
    const idx2 = faceIndices.indexOf(v2);

    // Check if edge is counter-clockwise in the face
    return (idx2 - idx1 + 3) % 3 === 1;
  };

  // Build adjacency information
  for (let face = 0; face < faceCount; face++) {
    const i1 = indices[face * 3];
    const i2 = indices[face * 3 + 1];
    const i3 = indices[face * 3 + 2];

    const edges = [
      { v1: i1, v2: i2 },
      { v1: i2, v2: i3 },
      { v1: i3, v2: i1 },
    ];

    edges.forEach(({ v1, v2 }) => {
      const edgeKey = makeEdgeKey(v1, v2);

      if (!adjacency.has(edgeKey)) {
        adjacency.set(edgeKey, { face1: face, face2: -1, consistent: true });
      } else {
        const adj = adjacency.get(edgeKey)!;
        adj.face2 = face;

        // Check if orientations are consistent (should be opposite)
        const orientation1 = getEdgeOrientation(adj.face1, v1, v2);
        const orientation2 = getEdgeOrientation(face, v1, v2);
        adj.consistent = orientation1 !== orientation2;
      }
    });
  }

  // Count inconsistent edges
  let inconsistentCount = 0;
  adjacency.forEach((adj) => {
    if (adj.face2 !== -1 && !adj.consistent) {
      inconsistentCount++;
    }
  });

  if (DEBUG) {
    console.log(`Found ${inconsistentCount} inconsistent face orientations`);
  }

  // For now, we'll just report the issues. A full solution would involve
  // graph traversal to consistently orient faces, which is complex.
  // The mergeVertices and normal computation will help with most cases.
};

/**
 * Remove isolated vertices that don't belong to any face
 */
const removeIsolatedVertices = (geometry: THREE.BufferGeometry): void => {
  if (!geometry.index || !geometry.attributes.position) return;

  const position = geometry.attributes.position.array;
  const indices = geometry.index.array;
  const vertexCount = position.length / 3;

  // Track which vertices are used
  const usedVertices = new Set<number>();
  for (let i = 0; i < indices.length; i++) {
    usedVertices.add(indices[i]);
  }

  // If all vertices are used, no work needed
  if (usedVertices.size === vertexCount) {
    return;
  }

  // Create new vertex array with only used vertices
  const newPositions: number[] = [];
  const vertexRemapping: number[] = [];
  let newVertexIndex = 0;

  for (let i = 0; i < vertexCount; i++) {
    if (usedVertices.has(i)) {
      vertexRemapping[i] = newVertexIndex;
      newPositions.push(
        position[i * 3],
        position[i * 3 + 1],
        position[i * 3 + 2],
      );
      newVertexIndex++;
    }
  }

  // Update geometry
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(newPositions, 3),
  );

  // Update indices
  for (let i = 0; i < indices.length; i++) {
    indices[i] = vertexRemapping[indices[i]];
  }

  if (DEBUG) {
    console.log(`Removed ${vertexCount - newVertexIndex} isolated vertices`);
  }
};

/**
 * Helper to make the model watertight (essential for proper 3D printing)
 * Basic version for display compatibility - preserves textures
 */
export const makeModelWatertight = (container: THREE.Group): void => {
  container.traverse((node) => {
    if (node instanceof THREE.Mesh && node.geometry?.attributes.position) {
      const geometry = node.geometry;

      // Step 1: Find and fix non-manifold edges
      try {
        if (hasGeometryMergeVertices(geometry)) {
          geometry.mergeVertices(PRINT_CONSTANTS.VERTEX_MERGE_TOLERANCE);
        }
      } catch (e) {
        console.warn('Could not merge vertices', e);
      }

      // Step 2: Ensure all faces are outward-facing (consistent normals)
      try {
        geometry.computeVertexNormals();
      } catch (e) {
        console.warn('Could not compute normals', e);
      }

      // Step 3: Ensure mesh has proper indices
      if (!geometry.index && geometry.attributes.position) {
        try {
          const position = geometry.attributes.position;
          const indices = [];

          for (let i = 0; i < position.count; i += 3) {
            indices.push(i, i + 1, i + 2);
          }

          geometry.setIndex(indices);
        } catch (e) {
          console.warn('Could not create indices', e);
        }
      }
    }
  });
};

/**
 * Advanced mesh repair for STL downloads only
 * Includes non-manifold edge repair but destroys texture coordinates
 */
const makeModelWatertightForSTL = (container: THREE.Group): void => {
  if (DEBUG) {
    console.log('Starting advanced mesh repair for STL download...');
  }

  container.traverse((node) => {
    if (node instanceof THREE.Mesh && node.geometry?.attributes.position) {
      const geometry = node.geometry;
      if (DEBUG) {
        console.log(
          `Repairing mesh with ${geometry.attributes.position.count} vertices`,
        );
      }

      // Step 1: Remove isolated vertices first
      try {
        removeIsolatedVertices(geometry);
      } catch (e) {
        if (DEBUG) {
          console.warn('Could not remove isolated vertices:', e);
        }
      }

      // Step 2: Remove degenerate triangles
      try {
        removeDegenerateTriangles(geometry);
      } catch (e) {
        if (DEBUG) {
          console.warn('Could not remove degenerate triangles:', e);
        }
      }

      // Step 3: Advanced duplicate vertex removal
      try {
        removeAdvancedDuplicateVertices(geometry);
      } catch (e) {
        if (DEBUG) {
          console.warn('Could not remove advanced duplicate vertices:', e);
        }
      }

      // Step 4: Fix non-manifold edges (the main repair)
      try {
        fixNonManifoldEdges(geometry);
      } catch (e) {
        if (DEBUG) {
          console.warn('Could not fix non-manifold edges:', e);
        }
      }

      // Step 5: Check and report face orientation issues
      try {
        fixFaceOrientations(geometry);
      } catch (e) {
        if (DEBUG) {
          console.warn('Could not check face orientations:', e);
        }
      }

      // Step 6: Final cleanup - merge vertices with original tolerance
      try {
        if (hasGeometryMergeVertices(geometry)) {
          geometry.mergeVertices(PRINT_CONSTANTS.VERTEX_MERGE_TOLERANCE);
        }
      } catch (e) {
        if (DEBUG) {
          console.warn('Could not merge vertices in final cleanup:', e);
        }
      }

      // Step 7: Ensure all faces are outward-facing (consistent normals)
      try {
        geometry.computeVertexNormals();
      } catch (e) {
        if (DEBUG) {
          console.warn('Could not compute normals:', e);
        }
      }

      // Step 8: Ensure mesh has proper indices
      if (!geometry.index && geometry.attributes.position) {
        try {
          const position = geometry.attributes.position;
          const indices = [];

          for (let i = 0; i < position.count; i += 3) {
            indices.push(i, i + 1, i + 2);
          }

          geometry.setIndex(indices);
        } catch (e) {
          if (DEBUG) {
            console.warn('Could not create indices:', e);
          }
        }
      }

      if (DEBUG) {
        console.log(
          `Mesh repair complete. Final vertex count: ${geometry.attributes.position.count}`,
        );
      }
    }
  });

  if (DEBUG) {
    console.log('Advanced mesh repair completed for all meshes');
  }
};

/**
 * Extract all valid meshes from a GLTF scene
 */
const extractValidMeshes = (scene: THREE.Object3D): THREE.Mesh[] => {
  const meshes: THREE.Mesh[] = [];
  scene.traverse((node) => {
    if (
      node instanceof THREE.Mesh &&
      node.geometry &&
      node.geometry.attributes.position
    ) {
      meshes.push(node);
    }
  });
  return meshes;
};

/**
 * Calculate model dimensions in millimeters
 */
const calculateModelDimensions = (boundingBox: THREE.Box3) => {
  const modelSize = new THREE.Vector3();
  boundingBox.getSize(modelSize);

  return {
    width: modelSize.x * PRINT_CONSTANTS.M_TO_MM,
    height: modelSize.y * PRINT_CONSTANTS.M_TO_MM,
    depth: modelSize.z * PRINT_CONSTANTS.M_TO_MM,
  };
};

/**
 * Clone and position meshes in a container
 * Deep clones geometry and materials to avoid affecting the original display model
 */
const createMeshContainer = (meshes: THREE.Mesh[]): THREE.Group => {
  const container = new THREE.Group();

  meshes.forEach((originalMesh) => {
    // Deep clone the geometry to avoid modifying the original
    const clonedGeometry = originalMesh.geometry.clone();

    // Clone the material(s) to avoid modifying the original
    let clonedMaterial;
    if (Array.isArray(originalMesh.material)) {
      clonedMaterial = originalMesh.material.map((mat) => mat.clone());
    } else {
      clonedMaterial = originalMesh.material.clone();
    }

    // Create a new mesh with cloned geometry and material
    const mesh = new THREE.Mesh(clonedGeometry, clonedMaterial);

    // Calculate world matrix for this mesh
    originalMesh.updateWorldMatrix(true, false);
    const worldMatrix = originalMesh.matrixWorld.clone();

    // Apply the world matrix to position it correctly
    mesh.matrix.copy(worldMatrix);
    mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);

    container.add(mesh);
  });

  return container;
};

/**
 * Type guard to check if geometry has mergeVertices method
 */
type GeometryWithMergeVertices = THREE.BufferGeometry & {
  mergeVertices: (tolerance: number) => void;
};
const hasGeometryMergeVertices = (
  geometry: THREE.BufferGeometry,
): geometry is GeometryWithMergeVertices => {
  return (
    'mergeVertices' in geometry &&
    typeof (geometry as GeometryWithMergeVertices).mergeVertices === 'function'
  );
};

/**
 * Apply final geometry fixes to all meshes in a scene
 * Basic version that preserves texture coordinates
 */
const applyFinalGeometryFixes = (scene: THREE.Scene): void => {
  scene.traverse((node) => {
    if (node instanceof THREE.Mesh && node.geometry?.attributes.position) {
      try {
        if (hasGeometryMergeVertices(node.geometry)) {
          node.geometry.mergeVertices(PRINT_CONSTANTS.VERTEX_MERGE_TOLERANCE);
        }
      } catch (e) {
        if (DEBUG) {
          console.warn('Could not merge vertices in final pass', e);
        }
      }

      try {
        node.geometry.computeVertexNormals();
      } catch (e) {
        if (DEBUG) {
          console.warn('Could not compute normals in final pass', e);
        }
      }
    }
  });
};

/**
 * Apply basic geometry fixes to preserve texture coordinates for OBJ downloads
 */
const applyBasicGeometryFixes = (scene: THREE.Scene): void => {
  scene.traverse((node) => {
    if (node instanceof THREE.Mesh && node.geometry?.attributes.position) {
      try {
        if (hasGeometryMergeVertices(node.geometry)) {
          node.geometry.mergeVertices(PRINT_CONSTANTS.VERTEX_MERGE_TOLERANCE);
        }
      } catch (e) {
        if (DEBUG) {
          console.warn('Could not merge vertices in basic pass', e);
        }
      }

      try {
        node.geometry.computeVertexNormals();
      } catch (e) {
        if (DEBUG) {
          console.warn('Could not compute normals in basic pass', e);
        }
      }
    }
  });
};

/**
 * Apply final scaling safeguard if model is too small
 */
const applyFinalScalingSafeguard = (scene: THREE.Scene): void => {
  const finalVerificationBox = new THREE.Box3().setFromObject(scene);
  const finalVerificationSize = new THREE.Vector3();
  finalVerificationBox.getSize(finalVerificationSize);

  const currentSmallestDimMm = Math.min(
    finalVerificationSize.x,
    finalVerificationSize.y,
    finalVerificationSize.z,
  );

  if (DEBUG) {
    console.log(
      `Pre-safeguard smallest dimension: ${currentSmallestDimMm.toFixed(2)}mm (Target: ${PRINT_CONSTANTS.GUARANTEED_MINIMUM_OUTPUT_MM}mm)`,
    );
  }

  if (
    currentSmallestDimMm > 0 &&
    currentSmallestDimMm < PRINT_CONSTANTS.GUARANTEED_MINIMUM_OUTPUT_MM
  ) {
    const finalSafeguardScale =
      PRINT_CONSTANTS.GUARANTEED_MINIMUM_OUTPUT_MM / currentSmallestDimMm;
    if (DEBUG) {
      console.warn(
        `APPLYING FINAL SAFEGUARD SCALING: Model too small (${currentSmallestDimMm.toFixed(2)}mm). Scaling by ${finalSafeguardScale.toFixed(2)}x to reach ${PRINT_CONSTANTS.GUARANTEED_MINIMUM_OUTPUT_MM}mm.`,
      );
    }
    scene.scale.multiplyScalar(finalSafeguardScale);

    // Log size after safeguard
    const postSafeguardBox = new THREE.Box3().setFromObject(scene);
    const postSafeguardSize = new THREE.Vector3();
    postSafeguardBox.getSize(postSafeguardSize);
    if (DEBUG) {
      console.log(
        `Post-safeguard dimensions: X:${postSafeguardSize.x.toFixed(2)}mm, Y:${postSafeguardSize.y.toFixed(2)}mm, Z:${postSafeguardSize.z.toFixed(2)}mm`,
      );
    }
  } else if (currentSmallestDimMm <= 0) {
    if (DEBUG) {
      console.warn(
        'Cannot apply final safeguard scaling: current smallest dimension is zero or negative.',
      );
    }
  }
};

/**
 * Common processing logic shared between print and download functions
 * Returns a processed scene with scaling and positioning applied
 */
const processUserModelCore = (
  gltf: GLTF | null,
  repairFunction: (container: THREE.Group) => void,
  logPrefix: string = 'processing',
): THREE.Scene => {
  if (!gltf || !gltf.scene) {
    throw new Error('Model not available');
  }

  // 1. Extract and validate meshes
  const userMeshes = extractValidMeshes(gltf.scene);
  if (userMeshes.length === 0) {
    throw new Error('No valid geometry found in the model');
  }

  // 2. Analyze model dimensions
  const modelBoundingBox = new THREE.Box3().setFromObject(gltf.scene);
  const modelCenter = new THREE.Vector3();
  modelBoundingBox.getCenter(modelCenter);
  const modelBottom = modelBoundingBox.min.y;

  const sizeInMm = calculateModelDimensions(modelBoundingBox);
  if (DEBUG) {
    console.log('Original model dimensions (mm):', sizeInMm);
  }

  // 3. Validate geometry for printing
  const hasValidGeometry = ensureValidPrintableGeometry(userMeshes);
  if (!hasValidGeometry) {
    if (DEBUG) {
      console.warn('Model geometry requires significant repair for printing');
    }
  }

  // 4. Create processed model container
  const container = createMeshContainer(userMeshes);

  // 5. Calculate scaling requirements
  const MINIMUM_SIZE_MM = PRINT_CONSTANTS.BASE_MINIMUM_SIZE_MM;
  const MINIMUM_BOUNDING_RADIUS_MM =
    PRINT_CONSTANTS.BASE_MINIMUM_BOUNDING_RADIUS_MM;

  const boundingSphere = new THREE.Sphere();
  modelBoundingBox.getBoundingSphere(boundingSphere);
  const boundingRadiusMm = boundingSphere.radius * PRINT_CONSTANTS.M_TO_MM;
  const smallestDimensionMm = Math.min(
    sizeInMm.width,
    sizeInMm.height,
    sizeInMm.depth,
  );

  const { scaleFactor, reason } = getAppropriateScalingFactor(
    sizeInMm,
    boundingRadiusMm,
    smallestDimensionMm,
    MINIMUM_SIZE_MM,
    MINIMUM_BOUNDING_RADIUS_MM,
  );

  if (DEBUG) {
    console.log(`Model-aware scaling: ${scaleFactor.toFixed(2)}x - ${reason}`);
    console.log(
      `- Smallest dimension: ${smallestDimensionMm.toFixed(2)}mm, target: ${MINIMUM_SIZE_MM}mm`,
    );
    console.log(
      `- Bounding radius: ${boundingRadiusMm.toFixed(2)}mm, target: ${MINIMUM_BOUNDING_RADIUS_MM}mm`,
    );
  }

  // 6. Apply scaling and positioning
  container.scale.set(scaleFactor, scaleFactor, scaleFactor);
  const scaledBottom = modelBottom * scaleFactor;

  container.position.set(
    -modelCenter.x * scaleFactor,
    -scaledBottom + PRINT_CONSTANTS.GROUND_INTERSECTION_OFFSET,
    -modelCenter.z * scaleFactor,
  );

  if (DEBUG) {
    console.log(
      `Model positioned with bottom at y=0 to ensure first layer extrusion`,
    );
  }

  // 7. Apply repair function (different for print vs download)
  repairFunction(container);
  const processedScene = new THREE.Scene();
  processedScene.add(container);

  // 8. Verify final dimensions and log results
  const finalBoundingBox = new THREE.Box3().setFromObject(processedScene);
  const finalSize = new THREE.Vector3();
  finalBoundingBox.getSize(finalSize);

  const finalSizeInMm = calculateModelDimensions(finalBoundingBox);
  if (DEBUG) {
    console.log('Final model dimensions (mm):', finalSizeInMm);
  }

  // Verify size appropriateness
  const isTooSmall = Object.values(finalSizeInMm).some(
    (dim) => dim < PRINT_CONSTANTS.WARNING_SIZE_THRESHOLD_MM,
  );
  if (isTooSmall) {
    if (DEBUG) {
      console.warn(
        `Model may be small for large format printing. Dimensions: ${finalSizeInMm.width.toFixed(1)}x${finalSizeInMm.height.toFixed(1)}x${finalSizeInMm.depth.toFixed(1)}mm`,
      );
    }
  } else {
    if (DEBUG) {
      console.log(
        `Model size appropriate for ${logPrefix}: ${finalSizeInMm.width.toFixed(1)}x${finalSizeInMm.height.toFixed(1)}x${finalSizeInMm.depth.toFixed(1)}mm`,
      );
    }
  }

  // 9. Apply final processing steps
  ensureFirstLayerExtrusion(processedScene);
  applyFinalScalingSafeguard(processedScene);

  return processedScene;
};

/**
 * Process the user's model to ensure it works with Mandarin3D
 * Uses advanced mesh repair that may destroy texture coordinates
 */
export const processUserModelForPrint = async (
  gltf: GLTF | null,
  generateFilename: () => string,
): Promise<File> => {
  // Use core processing with advanced repair for STL
  const processedScene = processUserModelCore(
    gltf,
    makeModelWatertightForSTL,
    'Mandarin3D',
  );

  // Apply final geometry fixes for STL
  applyFinalGeometryFixes(processedScene);

  // Export to STL
  const exporter = new STLExporter();
  const result = exporter.parse(processedScene, {
    binary: true,
  } as STLExporterOptionsBinary);

  const blob = new Blob([result], { type: 'application/octet-stream' });
  const file = new File([blob], `${generateFilename()}_PRINTABLE.stl`, {
    type: 'application/octet-stream',
  });

  if (DEBUG) {
    console.log(
      `Created STL file from user's model: ${file.name}, size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
    );
    console.log(
      `Model is positioned to ensure first layer extrusion without a platform`,
    );
  }

  return file;
};

/**
 * Apply the same scaling logic used for Mandarin3D to ensure proper size
 * Returns a properly scaled and positioned THREE.Scene
 * Uses basic mesh repair to preserve texture coordinates for OBJ downloads
 */
export const processUserModelForDownload = async (
  gltf: GLTF | null,
): Promise<THREE.Scene> => {
  // Use core processing with basic repair to preserve textures
  const processedScene = processUserModelCore(
    gltf,
    makeModelWatertight,
    'download',
  );

  // Apply basic geometry fixes to preserve textures
  applyBasicGeometryFixes(processedScene);

  return processedScene;
};

/**
 * Helper function to repair a single mesh.
 * Basic version that preserves texture coordinates for display compatibility.
 */
export const repairSingleMesh = (
  mesh: THREE.Mesh,
  debugName: string,
): THREE.Mesh => {
  if (DEBUG) {
    console.log(`Repairing mesh: ${debugName}`);
  }

  // Clone the geometry to avoid modifying the original
  const geometry = mesh.geometry.clone();

  // Get material (clone if it exists)
  let material: THREE.Material;
  if (Array.isArray(mesh.material)) {
    material = mesh.material[0].clone();
  } else {
    material = mesh.material.clone();
  }

  // 1. Check if the geometry is empty or invalid
  if (
    !geometry.attributes.position ||
    geometry.attributes.position.count === 0
  ) {
    if (DEBUG) {
      console.error(
        `Mesh ${debugName} has invalid geometry. Attributes:`,
        geometry.attributes,
      );
    }
    throw new Error('Invalid geometry - no position attribute');
  }

  // 2. Merge vertices that are very close to each other (helps with non-manifold edges)
  if (hasGeometryMergeVertices(geometry)) {
    if (DEBUG) {
      console.log(`${debugName}: Merging vertices`);
    }
    try {
      geometry.mergeVertices(PRINT_CONSTANTS.VERTEX_MERGE_TOLERANCE);
    } catch (error) {
      if (DEBUG) {
        console.warn(`Merge vertices failed for ${debugName}:`, error);
      }
    }
  }

  // 3. Compute vertex normals if they don't exist or recompute them
  try {
    if (DEBUG) {
      console.log(`${debugName}: Computing normals`);
    }
    geometry.computeVertexNormals();
  } catch (error) {
    if (DEBUG) {
      console.warn(`Computing normals failed for ${debugName}:`, error);
    }
  }

  // 4. Make sure indices are present
  if (!geometry.index && geometry.attributes.position) {
    if (DEBUG) {
      console.log(`${debugName}: Creating index buffer`);
    }
    try {
      const indices = [];
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i += 3) {
        indices.push(i, i + 1, i + 2);
      }
      geometry.setIndex(indices);
    } catch (error) {
      if (DEBUG) {
        console.warn(`Creating indices failed for ${debugName}:`, error);
      }
    }
  }

  // 5. Center the geometry for better printing
  try {
    if (DEBUG) {
      console.log(`${debugName}: Centering geometry`);
    }
    geometry.center();
  } catch (error) {
    if (DEBUG) {
      console.warn(`Centering failed for ${debugName}:`, error);
    }
  }

  // 6. Handle non-triangle faces (STL requires triangles)
  try {
    if (geometry.index && geometry.index.count % 3 !== 0) {
      if (DEBUG) {
        console.warn(`${debugName}: Non-triangle faces detected, fixing...`);
      }
      const indices = [];
      for (let i = 0; i < geometry.index.count; i += 3) {
        if (i + 2 < geometry.index.count) {
          indices.push(
            geometry.index.getX(i),
            geometry.index.getX(i + 1),
            geometry.index.getX(i + 2),
          );
        }
      }
      geometry.setIndex(indices);
    }
  } catch (error) {
    if (DEBUG) {
      console.warn(`Fixing non-triangle faces failed for ${debugName}:`, error);
    }
  }

  // Create and return the repaired mesh
  return new THREE.Mesh(geometry, material);
};

/**
 * Most basic repair for fallback, primarily computes vertex normals.
 */
export const basicRepair = (
  mesh: THREE.Mesh,
  debugName: string,
): THREE.Mesh => {
  if (DEBUG) {
    console.log(`Basic repair for mesh: ${debugName}`);
  }
  const geometry = mesh.geometry.clone();

  let material: THREE.Material;
  if (Array.isArray(mesh.material)) {
    material = mesh.material[0].clone();
  } else {
    material = mesh.material.clone();
  }

  try {
    geometry.computeVertexNormals();
  } catch (_e) {
    if (DEBUG) {
      console.warn('Could not compute normals');
    }
  }

  return new THREE.Mesh(geometry, material);
};

/**
 * Repairs an entire scene by processing each mesh individually.
 * Uses repairSingleMesh and falls back to basicRepair.
 */
export const repairMeshHierarchy = (
  inputScene: THREE.Object3D,
): THREE.Scene => {
  if (DEBUG) {
    console.log('Repairing mesh hierarchy...');
  }

  // Create a new scene for the repaired mesh
  const repairedScene = new THREE.Scene();

  // Collect all meshes from the scene
  const meshes: THREE.Mesh[] = [];
  inputScene.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      meshes.push(node);
    }
  });

  if (DEBUG) {
    console.log(`Found ${meshes.length} meshes to repair`);
  }

  if (meshes.length === 0) {
    if (DEBUG) {
      console.warn('No meshes found to repair!');
    }
    // If no meshes found, just clone the input scene
    inputScene.traverse((node) => {
      if (node.type !== 'Scene') {
        // Avoid cloning the scene object itself if inputScene is a Scene
        const clone = node.clone();
        repairedScene.add(clone);
      }
    });
    // if inputScene is already a Scene and empty, we return an empty scene.
    // if inputScene is a Group and empty, we return an empty scene with that group's potentially non-empty children (if any other than meshes).
    // This is a bit nuanced. If inputScene was a Group, we might want to return a Group.
    // For now, always returning a Scene for simplicity as STLExporter expects a Scene or Mesh.
    return repairedScene;
  }

  // Process each mesh individually
  meshes.forEach((mesh, index) => {
    try {
      // Repair the mesh
      const repairedMesh = repairSingleMesh(mesh, `mesh-${index}`);
      repairedScene.add(repairedMesh);
    } catch (error) {
      if (DEBUG) {
        console.error(`Error repairing mesh ${index}:`, error);
      }

      // If repair fails, try basic repair
      try {
        const basicRepairedMesh = basicRepair(mesh, `fallback-${index}`);
        repairedScene.add(basicRepairedMesh);
      } catch (fallbackError) {
        if (DEBUG) {
          console.error(
            `Even fallback repair failed for mesh ${index}:`,
            fallbackError,
          );
        }
        // Last resort: just clone the original
        repairedScene.add(mesh.clone());
      }
    }
  });

  if (DEBUG) {
    console.log('Mesh repair complete');
  }
  return repairedScene;
};

const getAppropriateScalingFactor = (
  modelSize: { width: number; height: number; depth: number },
  radiusMm: number,
  smallestDimensionMm: number,
  MINIMUM_SIZE_MM: number,
  MINIMUM_BOUNDING_RADIUS_MM: number,
): { scaleFactor: number; reason: string } => {
  // Analyze model proportions to determine model type
  const aspectRatio = Math.max(
    modelSize.width / modelSize.height,
    modelSize.height / modelSize.width,
    modelSize.width / modelSize.depth,
    modelSize.depth / modelSize.width,
  );

  // Calculate volume in cubic cm
  const volumeCm3 =
    (modelSize.width * modelSize.height * modelSize.depth) /
    PRINT_CONSTANTS.M_TO_MM;

  // Classify model type
  const isThinModel = aspectRatio > PRINT_CONSTANTS.HIGH_ASPECT_RATIO_THRESHOLD;
  const isSmallDetailed =
    volumeCm3 < PRINT_CONSTANTS.SMALL_VOLUME_THRESHOLD_CM3 &&
    radiusMm < PRINT_CONSTANTS.SMALL_RADIUS_THRESHOLD_MM;
  const isAlreadyLarge =
    smallestDimensionMm > PRINT_CONSTANTS.LARGE_MODEL_THRESHOLD_MM ||
    radiusMm > PRINT_CONSTANTS.LARGE_MODEL_THRESHOLD_MM;

  // Calculate base scaling factors
  const dimensionScaleFactor = MINIMUM_SIZE_MM / smallestDimensionMm;
  const radiusScaleFactor = MINIMUM_BOUNDING_RADIUS_MM / radiusMm;

  // Base scaling to meet minimum requirements
  let scaleFactor = Math.max(dimensionScaleFactor, radiusScaleFactor);
  let reason = 'Base scaling to meet printing requirements';

  // Apply model-specific scaling adjustments
  if (isThinModel) {
    scaleFactor *= PRINT_CONSTANTS.THIN_MODEL_SCALE_MULTIPLIER;
    reason = `Thin model: applying ${PRINT_CONSTANTS.THIN_MODEL_SCALE_MULTIPLIER}x minimal extra scaling to prevent brittleness`;
  } else if (isSmallDetailed) {
    scaleFactor *= PRINT_CONSTANTS.SMALL_DETAILED_SCALE_MULTIPLIER;
    reason = `Small detailed model: applying ${PRINT_CONSTANTS.SMALL_DETAILED_SCALE_MULTIPLIER}x scaling to preserve details`;
  } else if (isAlreadyLarge) {
    // Model is already large, reduce scaling to avoid excessive size
    scaleFactor = Math.min(scaleFactor, 1.0);
    reason = 'Already large model: limiting scaling to avoid excessive size';
  } else {
    scaleFactor *= PRINT_CONSTANTS.STANDARD_SCALE_MULTIPLIER;
    reason = `Standard model: applying ${PRINT_CONSTANTS.STANDARD_SCALE_MULTIPLIER}x minimal safety margin`;
  }

  return { scaleFactor, reason };
};
