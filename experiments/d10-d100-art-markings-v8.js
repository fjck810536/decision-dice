import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import { D10D100ArtMarkingFactory as LockedTensV7Factory } from './d10-d100-art-markings.js';

const ONES_ATLAS_CELL = 64;
const FACE_OFFSET = 0.012;
const MARK_COLOR = '#20231c';

function drawOnesCell(ctx, cell, value) {
  ctx.save();
  ctx.clearRect(0, 0, cell, cell);
  ctx.fillStyle = MARK_COLOR;

  // Match the production d10-digit typography exactly; this experiment only
  // changes how large that marking sits on the physical face.
  const fontSize = Math.round(cell * 0.50);
  ctx.font = `900 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), cell / 2, cell / 2 + cell * 0.02);

  if (value === 6 || value === 9) {
    const width = cell * 0.20;
    ctx.fillRect(
      cell / 2 - width / 2,
      cell * 0.75,
      width,
      Math.max(2, cell * 0.035),
    );
  }

  ctx.restore();
}

function makeOnesAtlas(entry) {
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
    drawOnesCell(ctx, ONES_ATLAS_CELL, face.value);
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

function buildOnesGeometry(entry, cols, rows) {
  const positions = [];
  const uvs = [];

  // Production d10-digit uses radius * .235. v8 intentionally makes the
  // single-digit marking dramatically larger without changing orientation,
  // font, underline rules, or face semantics.
  const half = entry.radius * 0.36;

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

export class D10D100ArtMarkingFactory {
  constructor() {
    // This delegate freezes all v7 behavior, especially the approved D100 tens
    // die. v8 only intercepts the D100 ones component.
    this.lockedV7 = new LockedTensV7Factory();
    this.onesCache = null;
  }

  getMesh(record) {
    const isD100Ones = record.entry.key === 'd10-digit' && record.componentRole === 'ones';

    if (!isD100Ones) {
      // Locked v7 tens and production single-D10 behavior pass through intact.
      return this.lockedV7.getMesh(record);
    }

    if (!this.onesCache) {
      const { texture, cols, rows } = makeOnesAtlas(record.entry);
      const geometry = buildOnesGeometry(record.entry, cols, rows);
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
      this.onesCache = { texture, geometry, material };
    }

    const mesh = new THREE.Mesh(this.onesCache.geometry, this.onesCache.material);
    mesh.renderOrder = 2;
    return mesh;
  }

  dispose() {
    this.lockedV7.dispose();
    if (this.onesCache) {
      this.onesCache.texture.dispose();
      this.onesCache.geometry.dispose();
      this.onesCache.material.dispose();
      this.onesCache = null;
    }
  }
}
