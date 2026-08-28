import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';

const MARK_COLOR = '#20231c';
const ATLAS_CELL = 64;
const FACE_OFFSET = 0.012;

function labelForFace(entry, face, componentRole) {
  const value = face.value;
  if (entry.key === 'd10-digit') {
    if (componentRole === 'tens') return String(value * 10).padStart(2, '0');
    return String(value);
  }
  return String(face.label ?? value);
}

function pipPoints(value) {
  const p = {
    tl: [0.27, 0.27], tc: [0.50, 0.27], tr: [0.73, 0.27],
    ml: [0.27, 0.50], mc: [0.50, 0.50], mr: [0.73, 0.50],
    bl: [0.27, 0.73], bc: [0.50, 0.73], br: [0.73, 0.73],
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

function drawRpsSymbol(ctx, cell, value) {
  ctx.save();
  ctx.strokeStyle = MARK_COLOR;
  ctx.fillStyle = MARK_COLOR;
  ctx.lineWidth = Math.max(3, cell * 0.055);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (value === 1) {
    // SCISSORS: two handles + crossed blades.
    ctx.beginPath();
    ctx.arc(cell * 0.34, cell * 0.68, cell * 0.10, 0, Math.PI * 2);
    ctx.arc(cell * 0.55, cell * 0.68, cell * 0.10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cell * 0.39, cell * 0.61);
    ctx.lineTo(cell * 0.76, cell * 0.25);
    ctx.moveTo(cell * 0.50, cell * 0.61);
    ctx.lineTo(cell * 0.22, cell * 0.29);
    ctx.stroke();
  } else if (value === 2) {
    // ROCK: deliberately angular pebble/fist-like mark.
    ctx.beginPath();
    ctx.moveTo(cell * 0.22, cell * 0.61);
    ctx.lineTo(cell * 0.27, cell * 0.38);
    ctx.lineTo(cell * 0.40, cell * 0.25);
    ctx.lineTo(cell * 0.61, cell * 0.28);
    ctx.lineTo(cell * 0.76, cell * 0.44);
    ctx.lineTo(cell * 0.72, cell * 0.67);
    ctx.lineTo(cell * 0.55, cell * 0.77);
    ctx.lineTo(cell * 0.34, cell * 0.73);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(cell * 0.37, cell * 0.39);
    ctx.lineTo(cell * 0.58, cell * 0.36);
    ctx.lineTo(cell * 0.66, cell * 0.49);
    ctx.stroke();
  } else {
    // PAPER: sheet with folded corner and two short lines.
    ctx.strokeRect(cell * 0.25, cell * 0.19, cell * 0.50, cell * 0.62);
    ctx.beginPath();
    ctx.moveTo(cell * 0.57, cell * 0.19);
    ctx.lineTo(cell * 0.75, cell * 0.37);
    ctx.lineTo(cell * 0.57, cell * 0.37);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cell * 0.34, cell * 0.51);
    ctx.lineTo(cell * 0.64, cell * 0.51);
    ctx.moveTo(cell * 0.34, cell * 0.63);
    ctx.lineTo(cell * 0.58, cell * 0.63);
    ctx.stroke();
  }

  ctx.restore();
}

function drawFaceCell(ctx, x, y, cell, entry, face, componentRole) {
  ctx.save();
  ctx.translate(x, y);
  ctx.clearRect(0, 0, cell, cell);
  ctx.fillStyle = MARK_COLOR;

  if (entry.key === 'd3') {
    drawRpsSymbol(ctx, cell, face.value);
    ctx.restore();
    return;
  }

  if (entry.key === 'd6') {
    const radius = cell * 0.075;
    for (const [px, py] of pipPoints(face.value)) {
      ctx.beginPath();
      ctx.arc(px * cell, py * cell, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  const label = labelForFace(entry, face, componentRole);
  const compact = label.length >= 2;
  const fontSize = compact ? Math.round(cell * 0.43) : Math.round(cell * 0.56);
  ctx.font = `900 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cell / 2, cell / 2 + cell * 0.02);

  if (/^(6|9|60|90)$/.test(label)) {
    const width = compact ? cell * 0.34 : cell * 0.22;
    ctx.fillRect(cell / 2 - width / 2, cell * 0.77, width, Math.max(2, cell * 0.035));
  }
  ctx.restore();
}

function makeAtlas(entry, componentRole) {
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
    drawFaceCell(ctx, col * ATLAS_CELL, row * ATLAS_CELL, ATLAS_CELL, entry, face, componentRole);
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

function faceScale(entry) {
  switch (entry.key) {
    case 'd4': return entry.radius * 0.24;
    case 'd8': return entry.radius * 0.31;
    case 'd20': return entry.radius * 0.19;
    case 'd10':
    case 'd10-digit': return entry.radius * 0.28;
    case 'd6':
    case 'd3': return entry.radius * 0.34;
    default: return entry.radius * 0.26;
  }
}

function cellUv(index, cols, rows) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const padU = 2 / (cols * ATLAS_CELL);
  const padV = 2 / (rows * ATLAS_CELL);
  const u0 = col / cols + padU;
  const u1 = (col + 1) / cols - padU;
  const v0 = 1 - (row + 1) / rows + padV;
  const v1 = 1 - row / rows - padV;
  return { u0, u1, v0, v1 };
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

function buildMarkingGeometry(entry, cols, rows) {
  const positions = [];
  const uvs = [];
  const half = faceScale(entry);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3(1, 0, 0);

  entry.faces.forEach((face, index) => {
    const normal = new THREE.Vector3(...face.normal).normalize();
    const distance = supportDistance(entry.visualGeometry, normal) + FACE_OFFSET;
    const center = normal.clone().multiplyScalar(distance);
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

export class FaceMarkingFactory {
  constructor() {
    this.cache = new Map();
  }

  #cacheKey(record) {
    const role = record.entry.key === 'd10-digit' ? (record.componentRole ?? 'ones') : 'default';
    return `${record.entry.key}:${role}`;
  }

  getMesh(record) {
    const key = this.#cacheKey(record);
    let cached = this.cache.get(key);
    if (!cached) {
      const { texture, cols, rows } = makeAtlas(record.entry, record.componentRole);
      const geometry = buildMarkingGeometry(record.entry, cols, rows);
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
      cached = { texture, geometry, material };
      this.cache.set(key, cached);
    }
    const mesh = new THREE.Mesh(cached.geometry, cached.material);
    mesh.renderOrder = 2;
    return mesh;
  }

  dispose() {
    for (const item of this.cache.values()) {
      item.texture.dispose();
      item.geometry.dispose();
      item.material.dispose();
    }
    this.cache.clear();
  }
}
