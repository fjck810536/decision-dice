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

function drawD3Symbol(ctx, cell, value) {
  ctx.save();
  ctx.strokeStyle = MARK_COLOR;
  ctx.lineWidth = Math.max(4, cell * 0.065);
  ctx.lineCap = 'square';

  // Temporary symbolic d3 contract:
  // circle = 1, cross = 2, blank = 3.
  if (value === 1) {
    ctx.beginPath();
    ctx.arc(cell * 0.5, cell * 0.5, cell * 0.23, 0, Math.PI * 2);
    ctx.stroke();
  } else if (value === 2) {
    ctx.beginPath();
    ctx.moveTo(cell * 0.30, cell * 0.30);
    ctx.lineTo(cell * 0.70, cell * 0.70);
    ctx.moveTo(cell * 0.70, cell * 0.30);
    ctx.lineTo(cell * 0.30, cell * 0.70);
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
    drawD3Symbol(ctx, cell, face.value);
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
  const d10Family = entry.key === 'd10' || entry.key === 'd10-digit';
  const fontSize = d10Family
    ? Math.round(cell * (compact ? 0.39 : 0.50))
    : Math.round(cell * (compact ? 0.43 : 0.56));
  ctx.font = `900 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cell / 2, cell / 2 + cell * 0.02);

  if (/^(6|9|60|90)$/.test(label)) {
    const width = compact ? cell * 0.31 : cell * 0.20;
    ctx.fillRect(cell / 2 - width / 2, cell * 0.75, width, Math.max(2, cell * 0.035));
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
    case 'd10': return entry.radius * 0.245;
    case 'd10-digit': return entry.radius * 0.235;
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

    let tangent;
    let bitangent;
    if (face.markingUp) {
      // D10 family: text up follows the explicit local kite apex.
      // This keeps all percentile markings coherent around the die instead of
      // re-orienting them against world/local Y on alternating faces.
      bitangent = new THREE.Vector3(...face.markingUp).normalize();
      tangent = new THREE.Vector3().crossVectors(bitangent, normal).normalize();
      bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    } else {
      const ref = Math.abs(normal.dot(yAxis)) > 0.88 ? xAxis : yAxis;
      tangent = new THREE.Vector3().crossVectors(ref, normal).normalize();
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
