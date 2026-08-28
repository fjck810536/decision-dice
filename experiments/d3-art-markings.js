import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import { OtherDiceArtMarkingFactory as LockedOtherDiceFactory } from './other-dice-art-markings.js';

const ATLAS_CELL = 96;
const FACE_OFFSET = 0.012;
const INK = '#241d16';
const INK_EDGE = 'rgba(70,55,40,.82)';
const CUT_HIGHLIGHT = 'rgba(239,228,199,.28)';

function strokeCircle(ctx, x, y, radius, strokeStyle, lineWidth, yOffset = 0) {
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(x, y + yOffset, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function strokeCross(ctx, cell, strokeStyle, lineWidth, yOffset = 0) {
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(cell * 0.24, cell * 0.24 + yOffset);
  ctx.lineTo(cell * 0.76, cell * 0.76 + yOffset);
  ctx.moveTo(cell * 0.76, cell * 0.24 + yOffset);
  ctx.lineTo(cell * 0.24, cell * 0.76 + yOffset);
  ctx.stroke();
}

function drawD3Cell(ctx, cell, value) {
  ctx.save();
  ctx.clearRect(0, 0, cell, cell);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // D3 visual contract remains symbolic: circle = 1, cross = 2, blank = 3.
  // Value 3 intentionally draws nothing at all in this first art pass.
  if (value === 1) {
    const radius = cell * 0.285;
    strokeCircle(ctx, cell * 0.5, cell * 0.5, radius, CUT_HIGHLIGHT, cell * 0.115, cell * 0.026);
    strokeCircle(ctx, cell * 0.5, cell * 0.5, radius, INK_EDGE, cell * 0.084);
    strokeCircle(ctx, cell * 0.5, cell * 0.5, radius, INK, cell * 0.058);
  } else if (value === 2) {
    strokeCross(ctx, cell, CUT_HIGHLIGHT, cell * 0.115, cell * 0.026);
    strokeCross(ctx, cell, INK_EDGE, cell * 0.084);
    strokeCross(ctx, cell, INK, cell * 0.058);
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
    drawD3Cell(ctx, ATLAS_CELL, face.value);
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
  const half = entry.radius * 0.43;
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

function makeD3Marking(entry) {
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

export class D3ArtMarkingFactory {
  constructor() {
    this.locked = new LockedOtherDiceFactory();
    this.d3Cache = null;
  }

  getMesh(record) {
    if (record.entry.key !== 'd3') return this.locked.getMesh(record);
    if (!this.d3Cache) this.d3Cache = makeD3Marking(record.entry);
    const mesh = new THREE.Mesh(this.d3Cache.geometry, this.d3Cache.material);
    mesh.renderOrder = 2;
    return mesh;
  }

  dispose() {
    this.locked.dispose();
    if (this.d3Cache) {
      this.d3Cache.texture.dispose();
      this.d3Cache.geometry.dispose();
      this.d3Cache.material.dispose();
      this.d3Cache = null;
    }
  }
}
