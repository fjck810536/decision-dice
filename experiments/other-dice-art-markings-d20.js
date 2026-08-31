import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import { OtherDiceArtMarkingFactory as LockedOtherDiceFactory } from './other-dice-art-markings.js';

const ATLAS_CELL = 128;
const FACE_OFFSET = 0.012;
const INK = '#241d16';
const INK_EDGE = 'rgba(70,55,40,.82)';
const CUT_HIGHLIGHT = 'rgba(239,228,199,.28)';

function drawD20Cell(ctx, cell, value) {
  const label = String(value);
  const compact = label.length >= 2;

  ctx.save();
  ctx.clearRect(0, 0, cell, cell);
  ctx.translate(cell * 0.50, cell * 0.50);
  ctx.scale(compact ? 0.94 : 0.98, 1.08);
  ctx.font = `700 ${Math.round(cell * (compact ? 0.67 : 0.86))}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // D20 pass 01: preserve the approved warm engraved language, but keep the
  // two-digit faces compact enough to survive the 360px product renderer.
  ctx.strokeStyle = CUT_HIGHLIGHT;
  ctx.lineWidth = Math.max(3, cell * 0.046);
  ctx.strokeText(label, 0, cell * 0.030);

  ctx.strokeStyle = INK_EDGE;
  ctx.lineWidth = Math.max(2, cell * 0.028);
  ctx.strokeText(label, 0, 0);

  ctx.fillStyle = INK;
  ctx.fillText(label, 0, 0);

  if (value === 6 || value === 9) {
    const width = cell * 0.30;
    ctx.fillRect(-width / 2, cell * 0.30, width, Math.max(4, cell * 0.040));
  }

  ctx.restore();
}

function makeAtlas(entry) {
  const count = entry.faces.length;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * ATLAS_CELL;
  canvas.height = rows * ATLAS_CELL;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  entry.faces.forEach((face, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    ctx.save();
    ctx.translate(col * ATLAS_CELL, row * ATLAS_CELL);
    drawD20Cell(ctx, ATLAS_CELL, face.value);
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
  const padU = 2 / (cols * ATLAS_CELL);
  const padV = 2 / (rows * ATLAS_CELL);
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

function buildGeometry(entry, cols, rows) {
  const positions = [];
  const uvs = [];
  const half = entry.radius * 0.31;
  const yAxis = new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3(1, 0, 0);

  entry.faces.forEach((face, index) => {
    const normal = new THREE.Vector3(...face.normal).normalize();
    const center = normal.clone().multiplyScalar(
      supportDistance(entry.visualGeometry, normal) + FACE_OFFSET,
    );

    const ref = Math.abs(normal.dot(yAxis)) > 0.88 ? xAxis : yAxis;
    const tangent = new THREE.Vector3().crossVectors(ref, normal).normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

    pushQuad(positions, uvs, center, tangent, bitangent, half, cellUv(index, cols, rows));
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

function makeD20Marking(entry) {
  const { texture, cols, rows } = makeAtlas(entry);
  const geometry = buildGeometry(entry, cols, rows);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.10,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  return { texture, geometry, material };
}

export class OtherDiceArtMarkingFactory {
  constructor() {
    // Wrapper rule: only d20 is new in this pass. D4/D6/D8 and D10/D100 are
    // delegated to their already-approved factories without modification.
    this.locked = new LockedOtherDiceFactory();
    this.d20Cache = null;
  }

  getMesh(record) {
    if (record.entry.key !== 'd20') return this.locked.getMesh(record);

    if (!this.d20Cache) this.d20Cache = makeD20Marking(record.entry);
    const mesh = new THREE.Mesh(this.d20Cache.geometry, this.d20Cache.material);
    mesh.renderOrder = 2;
    return mesh;
  }

  dispose() {
    this.locked.dispose();
    if (this.d20Cache) {
      this.d20Cache.texture.dispose();
      this.d20Cache.geometry.dispose();
      this.d20Cache.material.dispose();
      this.d20Cache = null;
    }
  }
}
