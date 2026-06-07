import { publicAssetUrl } from '../../publicAssetUrl';
import { loadMtl, resolveDiffuseTextureUrl } from './loadMtl';
import type { MtlMaterial } from './loadMtl';
import { floatsPerVertex } from './vertexLayout';

export interface ObjMaterialGroup {
  materialName: string;
  objectName: string;
  diffuseTextureUrl: string | null;
  diffuseColor: [number, number, number];
  alpha: number;
  vertexArray: Float32Array;
  vertexCount: number;
  rotateAroundY: boolean;
}

export interface ObjMesh {
  groups: ObjMaterialGroup[];
  fanPivot: [number, number, number] | null;
}

interface FaceCorner {
  positionIndex: number;
  uvIndex: number | null;
  normalIndex: number | null;
}

interface Triangle {
  objectName: string;
  materialName: string;
  corners: [FaceCorner, FaceCorner, FaceCorner];
}

function groupKey(objectName: string, materialName: string): string {
  return `${objectName}\u0000${materialName}`;
}

export async function loadObj(url: string): Promise<ObjMesh> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load OBJ (${response.status}): ${url}`);
  }
  const source = await response.text();
  const materials = await loadMaterialsForObj(url, source);
  return buildMesh(source, materials);
}

export function parseObj(
  source: string,
  materials: Map<string, MtlMaterial> = new Map(),
): ObjMesh {
  return buildMesh(source, materials);
}

async function loadMaterialsForObj(
  objUrl: string,
  source: string,
): Promise<Map<string, MtlMaterial>> {
  const mtllib = findMtllib(source);
  if (!mtllib) {
    return new Map();
  }

  const mtlUrls = new Set<string>();
  if (!objUrl.startsWith('blob:')) {
    mtlUrls.add(resolveSiblingAssetUrl(objUrl, mtllib));
  }
  mtlUrls.add(publicAssetUrl(`assets/models/${mtllib}`));

  let lastError: unknown;
  for (const mtlUrl of mtlUrls) {
    try {
      return await loadMtl(mtlUrl);
    } catch (error) {
      lastError = error;
    }
  }

  console.warn(`Could not load MTL "${mtllib}" for ${objUrl}`, lastError);
  return new Map();
}

function findMtllib(source: string): string | null {
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('mtllib ')) {
      return line.slice('mtllib '.length).trim();
    }
  }

  return null;
}

function resolveSiblingAssetUrl(baseUrl: string, relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.startsWith('/')) {
    return normalized;
  }

  const baseDirectory = baseUrl.slice(0, baseUrl.lastIndexOf('/') + 1);
  return `${baseDirectory}${normalized}`;
}

function isFanObject(name: string): boolean {
  return name.toLowerCase() === 'fan';
}

function buildMesh(
  source: string,
  materials: Map<string, MtlMaterial>,
): ObjMesh {
  const positions: [number, number, number][] = [];
  const uvs: [number, number][] = [];
  const normals: [number, number, number][] = [];
  const triangles: Triangle[] = [];
  let currentMaterial = '';
  let currentObject = '';

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    const keyword = parts[0];

    if (keyword === 'v') {
      positions.push([
        Number(parts[1]),
        Number(parts[2]),
        Number(parts[3]),
      ]);
      continue;
    }

    if (keyword === 'vt') {
      uvs.push([Number(parts[1]), Number(parts[2])]);
      continue;
    }

    if (keyword === 'vn') {
      normals.push([
        Number(parts[1]),
        Number(parts[2]),
        Number(parts[3]),
      ]);
      continue;
    }

    if (keyword === 'o' || keyword === 'g') {
      currentObject = parts.slice(1).join(' ');
      continue;
    }

    if (keyword === 'usemtl') {
      currentMaterial = parts.slice(1).join(' ');
      continue;
    }

    if (keyword === 'f') {
      const corners = parts.slice(1).map(parseFaceCorner);
      for (let i = 1; i < corners.length - 1; i++) {
        triangles.push({
          objectName: currentObject,
          materialName: currentMaterial,
          corners: [corners[0], corners[i], corners[i + 1]],
        });
      }
    }
  }

  if (positions.length === 0 || triangles.length === 0) {
    throw new Error('OBJ file contains no usable geometry');
  }

  const { positions: normalizedPositions, normals: normalizedNormals } =
    normalizeMesh(positions, normals);
  const grouped = new Map<
    string,
    {
      objectName: string;
      materialName: string;
      interleaved: number[];
    }
  >();

  const fanCornerPositions: [number, number, number][] = [];

  for (const triangle of triangles) {
    const key = groupKey(triangle.objectName, triangle.materialName);
    const bucket = grouped.get(key) ?? {
      objectName: triangle.objectName,
      materialName: triangle.materialName,
      interleaved: [],
    };
    grouped.set(key, bucket);

    const faceNormal = computeFaceNormal(
      triangle.corners,
      normalizedPositions,
      normalizedNormals,
    );

    for (const corner of triangle.corners) {
      const position = normalizedPositions[corner.positionIndex];
      if (!position) {
        throw new Error(`Invalid position index in face: ${corner.positionIndex}`);
      }

      if (isFanObject(triangle.objectName)) {
        fanCornerPositions.push(position);
      }

      const normal = corner.normalIndex === null
        ? faceNormal
        : normalizedNormals[corner.normalIndex] ?? faceNormal;

      const uv = corner.uvIndex === null
        ? sphericalUv(position)
        : uvs[corner.uvIndex] ?? sphericalUv(position);

      bucket.interleaved.push(
        position[0],
        position[1],
        position[2],
        1,
        normal[0],
        normal[1],
        normal[2],
        0,
        uv[0],
        1 - uv[1],
      );
    }
  }

  const groups: ObjMaterialGroup[] = [];

  for (const bucket of grouped.values()) {
    const material = materials.get(bucket.materialName);
    const diffuseTextureUrl = material?.diffuseMap
      ? resolveDiffuseTextureUrl(material.diffuseMap)
      : null;

    groups.push({
      materialName: bucket.materialName,
      objectName: bucket.objectName,
      diffuseTextureUrl,
      diffuseColor: material?.diffuseColor ?? [1, 1, 1],
      alpha: material?.alpha ?? 1,
      vertexArray: new Float32Array(bucket.interleaved),
      vertexCount: bucket.interleaved.length / floatsPerVertex,
      rotateAroundY: isFanObject(bucket.objectName),
    });
  }

  const fanPivot = fanCornerPositions.length > 0
    ? computeCentroid(fanCornerPositions)
    : null;

  return { groups, fanPivot };
}

function computeCentroid(
  positions: [number, number, number][],
): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;

  for (const [px, py, pz] of positions) {
    x += px;
    y += py;
    z += pz;
  }

  const count = positions.length;
  return [x / count, y / count, z / count];
}

function parseFaceCorner(token: string): FaceCorner {
  const [positionToken, uvToken, normalToken] = token.split('/');
  const positionIndex = Number(positionToken) - 1;
  const uvIndex = uvToken ? Number(uvToken) - 1 : null;
  const normalIndex = normalToken ? Number(normalToken) - 1 : null;

  return { positionIndex, uvIndex, normalIndex };
}

function computeFaceNormal(
  corners: [FaceCorner, FaceCorner, FaceCorner],
  positions: [number, number, number][],
  normals: [number, number, number][],
): [number, number, number] {
  const hasNormals = corners.every(
    (corner) =>
      corner.normalIndex !== null && normals[corner.normalIndex] !== undefined,
  );
  if (hasNormals) {
    const [a, b, c] = corners.map((corner) => normals[corner.normalIndex!]);
    return normalizeVec3([
      (a[0] + b[0] + c[0]) / 3,
      (a[1] + b[1] + c[1]) / 3,
      (a[2] + b[2] + c[2]) / 3,
    ]);
  }

  const p0 = positions[corners[0].positionIndex];
  const p1 = positions[corners[1].positionIndex];
  const p2 = positions[corners[2].positionIndex];
  const ux = p1[0] - p0[0];
  const uy = p1[1] - p0[1];
  const uz = p1[2] - p0[2];
  const vx = p2[0] - p0[0];
  const vy = p2[1] - p0[1];
  const vz = p2[2] - p0[2];
  return normalizeVec3([
    uy * vz - uz * vy,
    uz * vx - ux * vz,
    ux * vy - uy * vx,
  ]);
}

function normalizeVec3(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function normalizeMesh(
  positions: [number, number, number][],
  normals: [number, number, number][],
): {
  positions: [number, number, number][];
  normals: [number, number, number][];
} {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const [x, y, z] of positions) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;
  const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  const scale = extent > 0 ? 2 / extent : 1;

  return {
    positions: positions.map(([x, y, z]) => [
      (x - centerX) * scale,
      (y - centerY) * scale,
      (z - centerZ) * scale,
    ]),
    normals: normals.map(([x, y, z]) => normalizeVec3([x, y, z])),
  };
}

function sphericalUv(position: [number, number, number]): [number, number] {
  const [x, y, z] = position;
  const length = Math.hypot(x, y, z) || 1;
  const nx = x / length;
  const ny = y / length;
  const nz = z / length;
  const u = Math.atan2(nx, nz) / (2 * Math.PI) + 0.5;
  const v = Math.asin(Math.max(-1, Math.min(1, ny))) / Math.PI + 0.5;
  return [u, v];
}
