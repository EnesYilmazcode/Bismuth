/**
 * Minimal OFF (Object File Format) parser that preserves per-face colors.
 *
 * OpenSCAD's 2025.x WASM build emits OFF files where each face line may end
 * with RGBA bytes (0-255) after the vertex indices — that's how we recover
 * the colors the user declared via `color()` in their SCAD source.
 *
 * Format:
 *   OFF
 *   <numVertices> <numFaces> <numEdges>
 *   <x> <y> <z>                             (numVertices lines)
 *   ...
 *   <n> <v1> <v2> ... <vn> [r g b a]        (numFaces lines)
 *   ...
 */

export type OffFace = {
  vertices: [number, number, number];
  // RGBA in 0-1 range; null if the face had no color data.
  color: [number, number, number, number] | null;
};

export type ParsedOff = {
  vertices: [number, number, number][];
  faces: OffFace[];
};

export function parseColoredOff(text: string): ParsedOff {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (lines.length === 0) throw new Error('Empty OFF file');

  let headerLine: string;
  let cursor = 0;
  if (/^OFF(\s|$)/.test(lines[0])) {
    const rest = lines[0].substring(3).trim();
    if (rest.length > 0) {
      headerLine = rest;
      cursor = 1;
    } else {
      headerLine = lines[1];
      cursor = 2;
    }
  } else {
    throw new Error('Missing OFF header');
  }

  const [numVertices, numFaces] = headerLine.split(/\s+/).map(Number);
  if (!Number.isFinite(numVertices) || !Number.isFinite(numFaces)) {
    throw new Error('Invalid OFF header: vertex/face counts unreadable');
  }
  // A truncated file would blow up with a confusing TypeError deep in the
  // per-line split — fail fast with a clear message instead.
  if (lines.length < cursor + numVertices + numFaces) {
    throw new Error(
      `OFF file truncated: expected ${cursor + numVertices + numFaces} non-blank lines, got ${lines.length}`,
    );
  }

  const vertices: [number, number, number][] = new Array(numVertices);
  for (let i = 0; i < numVertices; i++) {
    const parts = lines[cursor + i].split(/\s+/).map(Number);
    vertices[i] = [parts[0], parts[1], parts[2]];
  }
  cursor += numVertices;

  const faces: OffFace[] = [];
  for (let i = 0; i < numFaces; i++) {
    const parts = lines[cursor + i].split(/\s+/).map(Number);
    const n = parts[0];
    const verts = parts.slice(1, n + 1);
    const trailing = parts.slice(n + 1);
    // OFF color is optionally r g b [a] (0-255) after the vertex indices.
    // OpenSCAD's manifold backend emits RGB (3 trailing values); some OFF
    // producers emit RGBA (4). Accept either.
    let color: [number, number, number, number] | null = null;
    if (trailing.length >= 4) {
      color = [
        trailing[0] / 255,
        trailing[1] / 255,
        trailing[2] / 255,
        trailing[3] / 255,
      ];
    } else if (trailing.length >= 3) {
      color = [trailing[0] / 255, trailing[1] / 255, trailing[2] / 255, 1];
    }

    // Guard against malformed OFF files: skip faces whose vertex count
    // doesn't match the declared size, or whose indices aren't integers in
    // range. Bad lines would otherwise produce phantom triangles referring
    // to undefined vertices downstream.
    if (
      verts.length !== n ||
      verts.some((v) => !Number.isInteger(v) || v < 0 || v >= numVertices)
    ) {
      continue;
    }

    if (n === 3) {
      faces.push({ vertices: [verts[0], verts[1], verts[2]], color });
    } else if (n > 3) {
      // Fan-triangulate from vertex 0. Correct only for convex polygons —
      // concave faces would self-intersect. OpenSCAD's manifold backend (our
      // only producer) emits triangles exclusively, so n > 3 is effectively a
      // defensive branch; if another OFF source ever feeds in non-convex
      // n-gons we'd need earcut here.
      for (let j = 1; j < n - 1; j++) {
        faces.push({
          vertices: [verts[0], verts[j], verts[j + 1]],
          color,
        });
      }
    }
  }

  return { vertices, faces };
}
