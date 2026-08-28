import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import { D10D100ArtMarkingFactory as LockedD10D100Factory } from './d10-d100-art-markings-v8.js';

const ATLAS_CELL = 96;
const FACE_OFFSET = 0.012;
const INK = '#241d16';
const INK_EDGE = 'rgba(70,55,40,.82)';
const OLD_DICE_RED = '#96372f';
const CUT_HIGHLIGHT = 'rgba(239,228,199,.28)';

function pipPoints(value) {
  const p = {
    tl: [0.23, 0.23], tc: [0.50, 0.23], tr: [0.77, 0.23],
    ml: [0.23, 0.50], mc: [0.50, 0.50], mr: [0.77, 0.50],
    bl: [0.23, 0.77], bc: [0.50, 0.77], br: [0.77, 0.77],
  };
  const layouts = {
    1: ['mc'],
    2: ['tl', 'br'],
    3: ['tl', 'mc', 'br'],
    4: ['tl', 'tr', 'bl', 'br'],
    5: ['tl', 'tr', 'mc', 'bl', 'br'],
    6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br'],
  };
  return (layouts[value] ?? []).map((key) => p[key]);
}

function drawD6Cell(ctx, cell, value) {
  ctx.save();
  ctx.clearRect(0, 0, cell, cell);

  // Approved D6 treatment: large shallow engraved pips. The single pip on
  // face 1 uses a muted traditional dice red; every other face stays warm ink.
  const radius = cell * 0.112;
  const pipInk = value === 1 ? OLD_DICE_RED : INK;
  for (const [px, py] of pipPoints(value)) {
    const x = px * cell;
    const y = py * cell;

    ctx.fillStyle = CUT_HIGHLIGHT;
    ctx.beginPath();
    ctx.arc(x, y + cell * 0.025, radius * 1.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pipInk;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawD4Cell(ctx, cell, value) {
  ctx.save();
  ctx.clearRect(0, 0, cell, cell);
  ctx.translate(cell * 0.50, cell * 0.50);
  ctx.scale(0.96, 1.10);
  ctx.font = `700 ${Math.round(cell * 0.74)}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Same shallow engraved illusion as the approved D10/D100 language:
  // pale lower lip, dark cut edge, then warm-black fill.
  ctx.strokeStyle = CUT_HIGHLIGHT;
  ctx.lineWidth = Math.max(3, cell * 0.050);
  ctx.strokeText(String(value), 0, cell * 0.035);

  ctx.strokeStyle = INK_EDGE;
  ctx.lineWidth = Math.max(2, cell * 0.030);
  ctx.strokeText(String(value), 0, 0);

  ctx.fillStyle = INK;
  ctx.fillText(String(value), 0, 0);
  ctx.restore();
}

function makeAtlas(entry, drawCell) {
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
    drawCell(ctx, ATLAS_CELL, face.value);
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

function buildGeometry(entry, cols, rows, halfScale) {
  const positions = [];
  const uvs = [];
  const half = entry.radius * halfScale;
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

function makeMarking(entry, drawCell, halfScale) {
  const { texture, cols, rows } = makeAtlas(entry, drawCell);
  const geometry = buildGeometry(entry, cols, rows, halfScale);
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
    // D10/D100 remain frozen in their approved experiment. D6 is approved;
    // D4 is the current art pass. D8/D20 still delegate to production.
    this.locked = new LockedD10D100Factory();
    this.d6Cache = null;
    this.d4Cache = null;
  }

  getMesh(record) {
    if (record.entry.key === 'd6') {
      if (!this.d6Cache) this.d6Cache = makeMarking(record.entry, drawD6Cell, 0.39);
      const mesh = new THREE.Mesh(this.d6Cache.geometry, this.d6Cache.material);
      mesh.renderOrder = 2;
      return mesh;
    }

    if (record.entry.key === 'd4') {
      if (!this.d4Cache) this.d4Cache = makeMarking(record.entry, drawD4Cell, 0.34);
      const mesh = new THREE.Mesh(this.d4Cache.geometry, this.d4Cache.material);
      mesh.renderOrder = 2;
      return mesh;
    }

    return this.locked.getMesh(record);
  }

  dispose() {
    this.locked.dispose();
    for (const cached of [this.d6Cache, this.d4Cache]) {
      if (!cached) continue;
      cached.texture.dispose();
      cached.geometry.dispose();
      cached.material.dispose();
    }
    this.d6Cache = null;
    this.d4Cache = null;
  }
}
