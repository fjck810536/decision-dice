import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import { D10D100ArtMarkingFactory as LockedTensV7Factory } from './d10-d100-art-markings.js';

const ONES_ATLAS_CELL = 96;
const FACE_OFFSET = 0.012;
const MARK_COLOR = '#20231c';

function displaySingleValue(entry, face) {
  // Single D10 is physically labelled 0–9 while the logical face value 10
  // still resolves as 10 in the engine. D100 ones already stores 0–9.
  if (entry.key === 'd10' && face.value === 10) return '0';
  return String(face.value);
}

function drawSingleCell(ctx, cell, label) {
  ctx.save();
  ctx.clearRect(0, 0, cell, cell);
  ctx.fillStyle = MARK_COLOR;

  // v9: intentionally huge single-digit markings. Keep the existing mono,
  // high-weight production character rather than introducing a new style.
  const fontSize = Math.round(cell * 0.74);
  ctx.font = `900 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cell / 2, cell / 2 + cell * 0.025);

  if (label === '6' || label === '9') {
    const width = cell * 0.34;
    ctx.fillRect(
      cell / 2 - width / 2,
      cell * 0.82,
      width,
      Math.max(4, cell * 0.052),
    );
  }

  ctx.restore();
}

function makeSingleAtlas(entry) {
  const count = entry.faces.length;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * ONES_ATLAS_CELL;
  canvas.height = rows * ONES_ATLAS_CELL;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  entry.faces.forEach((face, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    ctx.save();
    ctx.translate(col * ONES_ATLAS_CELL, row * ONES_ATLAS_CELL);
    drawSingleCell(ctx, ONES_ATLAS_CELL, displaySingleValue(entry, face));
    ctx.restore();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, cols, rows };
}

function supportDistance(geometry, normal) {
  const attr = geometry.getAttribute('position');
  let maxDot = -Infinity;
  for (let i = 0; i < attr.count; i += 1) {
    const dot = attr.getX(i) * normal.x + attr.getY(i) * normal.y + attr.getZ(i) * normal.z;
    if (dot > maxDot) maxDot = dot;
  }
  return maxDot;
}

function cellUv(index, cols, rows) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const padU = 2 / (cols * ONES_ATLAS_CELL);
  const padV = 2 / (rows * ONES_ATLAS_CELL);
  return {
    u0: col / cols + padU,
    u1: (col + 1) / cols - padU,
    v0: 1 - (row + 1) / rows + padV,
    v1: 1 - row / rows - padV,
  };
}

function pushQuad(positions, uvs, center, tangent, bitangent, half, uv) {
  const corners = [
    center.clone().addScaledVector(tangent, -half).addScaledVector(bitangent, -half),
    center.clone().addScaledVector(tangent, half).addScaledVector(bitangent, -half),
    center.clone().addScaledVector(tangent, half).addScaledVector(bitangent, half),
    center.clone().addScaledVector(tangent, -half).addScaledVector(bitangent, half),
  ];
  const tri = [0, 1, 2, 0, 2, 3];
  const uvCorners = [
    [uv.u0, uv.v0], [uv.u1, uv.v0], [uv.u1, uv.v1], [uv.u0, uv.v1],
  ];

  for (const idx of tri) {
    positions.push(corners[idx].x, corners[idx].y, corners[idx].z);
    uvs.push(...uvCorners[idx]);
  }
}

function buildSingleGeometry(entry, cols, rows) {
  const positions = [];
  const uvs = [];

  // Production is about .235–.245 radius. v8 tried .36 and was still barely
  // visible on iPhone. v9 deliberately jumps to .48 for a face-filling look.
  const half = entry.radius * 0.48;

  entry.faces.forEach((face, index) => {
    const normal = new THREE.Vector3(...face.normal).normalize();
    const center = normal.clone().multiplyScalar(
      supportDistance(entry.visualGeometry, normal) + FACE_OFFSET,
    );

    const bitangent = new THREE.Vector3(...face.markingUp).normalize();
    const tangent = new THREE.Vector3().crossVectors(bitangent, normal).normalize();
    bitangent.copy(new THREE.Vector3().crossVectors(normal, tangent).normalize());

    pushQuad(positions, uvs, center, tangent, bitangent, half, cellUv(index, cols, rows));
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

function makeSingleMarking(entry) {
  const { texture, cols, rows } = makeSingleAtlas(entry);
  const geometry = buildSingleGeometry(entry, cols, rows);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  return { texture, geometry, material };
}

export class D10D100ArtMarkingFactory {
  constructor() {
    // Frozen delegate: D100 tens remains exactly the approved v7 art.
    this.lockedV7 = new LockedTensV7Factory();
    this.singleCaches = new Map();
  }

  getMesh(record) {
    const isSingleD10 = record.entry.key === 'd10';
    const isD100Ones = record.entry.key === 'd10-digit' && record.componentRole === 'ones';

    if (!isSingleD10 && !isD100Ones) {
      // In particular, D100 tens always goes through the locked v7 factory.
      return this.lockedV7.getMesh(record);
    }

    // d10 and d10-digit use the same physical geometry but different face
    // values/labels, so keep separate atlases and caches.
    const cacheKey = isSingleD10 ? 'd10' : 'd100-ones';
    let cached = this.singleCaches.get(cacheKey);
    if (!cached) {
      cached = makeSingleMarking(record.entry);
      this.singleCaches.set(cacheKey, cached);
    }

    const mesh = new THREE.Mesh(cached.geometry, cached.material);
    mesh.renderOrder = 2;
    return mesh;
  }

  dispose() {
    this.lockedV7.dispose();
    for (const cached of this.singleCaches.values()) {
      cached.texture.dispose();
      cached.geometry.dispose();
      cached.material.dispose();
    }
    this.singleCaches.clear();
  }
}
