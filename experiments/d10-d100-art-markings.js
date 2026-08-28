import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';

const ATLAS_CELL = 128;
const FACE_OFFSET = 0.0125;
const INK = '#241d16';
const INK_EDGE = 'rgba(70,55,40,.82)';
const CUT_HIGHLIGHT = 'rgba(239,228,199,.24)';

function displayLabel(entry, face, componentRole) {
  if (entry.key === 'd10') return face.value === 10 ? '0' : String(face.value);
  if (entry.key === 'd10-digit') {
    if (componentRole === 'tens') return String(face.value * 10).padStart(2, '0');
    return String(face.value);
  }
  return String(face.label ?? face.value);
}

function drawEngravedGlyph(ctx, text, x, y, fontSize, {
  narrowZero = false,
  rotation = 0,
  stretchX = 0.96,
  stretchY = 1.13,
} = {}) {
  ctx.save();
  ctx.translate(x, y);
  // Important: rotate only the glyph around its own anchor. Do not rotate the
  // percentile layout itself; the big-digit/blunt + small-zero/apex relation
  // was already approved in v2.
  ctx.rotate(rotation);
  const zeroScale = narrowZero && text === '0' ? 0.84 : 1;
  ctx.scale(stretchX * zeroScale, stretchY);
  ctx.font = `700 ${fontSize}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Tiny warm highlight + dark cut edge: a cheap shallow-carving illusion,
  // while the actual implementation remains a decal for readability/perf.
  ctx.strokeStyle = CUT_HIGHLIGHT;
  ctx.lineWidth = Math.max(2, fontSize * .045);
  ctx.strokeText(text, 0, 2);
  ctx.strokeStyle = INK_EDGE;
  ctx.lineWidth = Math.max(2, fontSize * .032);
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = INK;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function underline(ctx, cx, cy, width, thickness, rotation = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.strokeStyle = INK;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(-width / 2, 0);
  ctx.lineTo(width / 2, 0);
  ctx.stroke();
  ctx.restore();
}

function drawSingle(ctx, cell, label, rotation) {
  // v3: larger, slightly elongated and visibly biased toward the blunt half.
  // This is based on the supplied commercial d10 / percentile references.
  const fontSize = Math.round(cell * .79);
  const cx = cell * .50;
  const cy = cell * .64;
  drawEngravedGlyph(ctx, label, cx, cy, fontSize, {
    narrowZero: true,
    rotation,
    stretchX: .94,
    stretchY: 1.14,
  });
  if (label === '6' || label === '9') {
    // Underline rotates with the glyph, rather than staying screen-horizontal.
    const offset = cell * .28;
    const ux = cx + Math.sin(rotation) * offset;
    const uy = cy + Math.cos(rotation) * offset;
    underline(ctx, ux, uy, cell * .39, Math.max(4, cell * .038), rotation);
  }
}

function drawTens(ctx, cell, label, rotation) {
  // Percentile contract confirmed in v2:
  // large primary digit toward the blunt end, trailing 0 smaller toward apex.
  // v3 moves the whole pair farther toward the blunt half, enlarges it, and
  // rotates each glyph in place without rotating this spatial relationship.
  const main = label[0];
  const zero = label[1];
  const mainX = cell * .48;
  const mainY = cell * .70;
  const zeroX = cell * .51;
  const zeroY = cell * .25;

  drawEngravedGlyph(ctx, main, mainX, mainY, Math.round(cell * .80), {
    narrowZero: true,
    rotation,
    stretchX: .93,
    stretchY: 1.15,
  });
  drawEngravedGlyph(ctx, zero, zeroX, zeroY, Math.round(cell * .45), {
    narrowZero: true,
    rotation,
    stretchX: .91,
    stretchY: 1.13,
  });

  if (main === '6' || main === '9') {
    const offset = cell * .28;
    const ux = mainX + Math.sin(rotation) * offset;
    const uy = mainY + Math.cos(rotation) * offset;
    underline(ctx, ux, uy, cell * .39, Math.max(4, cell * .036), rotation);
  }
}

function faceGlyphRotation(index) {
  // Production D10 geometry is built as two five-face families:
  // indices 0–4 meet one axial tip, indices 5–9 meet the opposite tip.
  // iPhone reference check on the d100 ones die:
  //   face carrying 4 (first family) needed CCW 90°
  //   face carrying 7 (second family) needed CW 90°
  // Canvas positive rotation is clockwise, so encode that observation directly.
  return index < 5 ? -Math.PI / 2 : Math.PI / 2;
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
    const ox = col * ATLAS_CELL;
    const oy = row * ATLAS_CELL;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.clearRect(0, 0, ATLAS_CELL, ATLAS_CELL);
    const label = displayLabel(entry, face, componentRole);
    const rotation = faceGlyphRotation(i);
    if (entry.key === 'd10-digit' && componentRole === 'tens') drawTens(ctx, ATLAS_CELL, label, rotation);
    else drawSingle(ctx, ATLAS_CELL, label, rotation);
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

function faceHalfScale(entry, componentRole) {
  if (entry.key === 'd10-digit' && componentRole === 'tens') return entry.radius * .322;
  if (entry.key === 'd10' || entry.key === 'd10-digit') return entry.radius * .302;
  return entry.radius * .26;
}

function buildGeometry(entry, componentRole, cols, rows) {
  const positions = [];
  const uvs = [];
  const half = faceHalfScale(entry, componentRole);

  entry.faces.forEach((face, index) => {
    const normal = new THREE.Vector3(...face.normal).normalize();
    const center = normal.clone().multiplyScalar(supportDistance(entry.visualGeometry, normal) + FACE_OFFSET);
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
    this.cache = new Map();
  }

  #key(record) {
    const role = record.entry.key === 'd10-digit' ? (record.componentRole ?? 'ones') : 'single';
    return `${record.entry.key}:${role}:art-v3`;
  }

  getMesh(record) {
    const key = this.#key(record);
    let cached = this.cache.get(key);
    if (!cached) {
      const { texture, cols, rows } = makeAtlas(record.entry, record.componentRole);
      const geometry = buildGeometry(record.entry, record.componentRole, cols, rows);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: .10,
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
