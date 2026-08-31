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
    const y = cell * 0.30;
    ctx.strokeStyle = CUT_HIGHLIGHT;
    ctx.lineWidth = Math.max(5, cell * 0.060);
    ctx.beginPath();
    ctx.moveTo(-width / 2, y + cell * 0.022);
    ctx.lineTo(width / 2, y + cell * 0.022);
    ctx.stroke();
    ctx.strokeStyle = INK_EDGE;
    ctx.lineWidth = Math.max(4, cell * 0.047);
    ctx.beginPath();
    ctx.moveTo(-width / 2, y);
    ctx.lineTo(width / 2, y);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(3, cell * 0.034);
    ctx.beginPath();
    ctx.moveTo(-width / 2, y);
    ctx.lineTo(width / 2, y);
    ctx.stroke();
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

function faceVertices(entry, faceIndex) {
  const attr = entry.visualGeometry.getAttribute('position');
  const base = faceIndex * 3;
  return [0, 1, 2].map((offset) => new THREE.Vector3(
    attr.getX(base + offset),
    attr.getY(base + offset),
    attr.getZ(base + offset),
  ));
}

function pickBaseAndApex(vertices, normal) {
  // Project a stable local reference onto the face, then call the vertex most
  // strongly aligned with that direction the apex. The opposite edge becomes
  // the visual baseline for the numeral. All three triangle edges are equal;
  // this simply gives every face one deterministic bottom edge.
  let reference = new THREE.Vector3(0, 1, 0);
  let projected = reference.clone().addScaledVector(normal, -reference.dot(normal));
  if (projected.lengthSq() < 1e-6) {
    reference = new THREE.Vector3(1, 0, 0);
    projected = reference.clone().addScaledVector(normal, -reference.dot(normal));
  }
  projected.normalize();

  let apexIndex = 0;
  let best = -Infinity;
  vertices.forEach((vertex, index) => {
    const score = vertex.dot(projected);
    if (score > best) {
      best = score;
      apexIndex = index;
    }
  });

  const apex = vertices[apexIndex];
  const base = vertices.filter((_, index) => index !== apexIndex);
  return { apex, baseA: base[0], baseB: base[1] };
}

function buildVariantGeometry(entry, cols, rows, variant) {
  const positions = [];
  const uvs = [];
  const half = entry.radius * 0.31;
  // A deliberately sits above the centroid toward the apex. B deliberately
  // sits below the centroid toward the baseline. Everything else is identical.
  const medianT = variant === 'A' ? 0.47 : 0.27;

  entry.faces.forEach((face, index) => {
    const normal = new THREE.Vector3(...face.normal).normalize();
    const vertices = faceVertices(entry, index);
    const { apex, baseA, baseB } = pickBaseAndApex(vertices, normal);
    const baseMid = baseA.clone().add(baseB).multiplyScalar(0.5);
    const center = baseMid.clone().lerp(apex, medianT).addScaledVector(normal, FACE_OFFSET);

    let tangent = baseB.clone().sub(baseA).normalize();
    const towardApex = apex.clone().sub(baseMid).normalize();
    let bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    if (bitangent.dot(towardApex) < 0) {
      tangent.negate();
      bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    }

    pushQuad(positions, uvs, center, tangent, bitangent, half, cellUv(index, cols, rows));
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

function makeD20Cache(entry) {
  const { texture, cols, rows } = makeAtlas(entry);
  const geometryA = buildVariantGeometry(entry, cols, rows, 'A');
  const geometryB = buildVariantGeometry(entry, cols, rows, 'B');
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
  return { texture, geometryA, geometryB, material };
}

export class D20LayoutCompareFactory {
  constructor() {
    this.locked = new LockedOtherDiceFactory();
    this.variant = 'A';
    this.d20Cache = null;
  }

  #geometryForVariant() {
    if (!this.d20Cache) return null;
    return this.variant === 'B' ? this.d20Cache.geometryB : this.d20Cache.geometryA;
  }

  getMesh(record) {
    if (record.entry.key !== 'd20') return this.locked.getMesh(record);
    if (!this.d20Cache) this.d20Cache = makeD20Cache(record.entry);
    const mesh = new THREE.Mesh(this.#geometryForVariant(), this.d20Cache.material);
    mesh.renderOrder = 2;
    return mesh;
  }

  setVariant(renderer, variant) {
    this.variant = variant === 'B' ? 'B' : 'A';
    if (!this.d20Cache) return this.variant;

    const geometry = this.#geometryForVariant();
    for (const record of renderer.records ?? []) {
      if (record.entry.key !== 'd20') continue;
      const group = renderer.meshById?.get(record.id);
      const markingMesh = group?.children?.[1];
      if (markingMesh) markingMesh.geometry = geometry;
    }
    renderer.lastRenderAt = 0;
    renderer.render(renderer.records, performance.now(), true);
    return this.variant;
  }

  dispose() {
    this.locked.dispose();
    if (this.d20Cache) {
      this.d20Cache.texture.dispose();
      this.d20Cache.geometryA.dispose();
      this.d20Cache.geometryB.dispose();
      this.d20Cache.material.dispose();
      this.d20Cache = null;
    }
  }
}
