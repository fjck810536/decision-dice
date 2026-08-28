import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import { FaceMarkingFactory } from '../src/render/face-markings.js';

const ATLAS_CELL = 128;
const FACE_OFFSET = 0.0125;
const INK = '#241d16';
const INK_EDGE = 'rgba(70,55,40,.82)';
const CUT_HIGHLIGHT = 'rgba(239,228,199,.24)';

// v4 scope rule:
// - single D10: production markings, untouched
// - D100 ones die: production markings, untouched
// - D100 tens die only: experimental art direction below

function drawEngravedGlyph(ctx, text, x, y, fontSize, {
  narrowZero = false,
  rotation = 0,
  stretchX = 0.96,
  stretchY = 1.13,
} = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  const zeroScale = narrowZero && text === '0' ? 0.84 : 1;
  ctx.scale(stretchX * zeroScale, stretchY);
  ctx.font = `700 ${fontSize}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

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

function tensGlyphRotation(value) {
  // GeometryRegistry assigns the physical d10-digit faces in two families:
  //   family A (indices 0–4): 20, 00, 40, 80, 60
  //   family B (indices 5–9): 50, 10, 30, 70, 90
  //
  // v3 incorrectly treated those families as an orientation rule. iPhone
  // inspection showed that face family and readable glyph orientation are not
  // the same thing. Encode the observed percentile faces explicitly by VALUE.
  //
  // Confirmed correct in v3: 00 / 20 / 40 / 80 = CCW 90°.
  // Corrective pass: 10 / 30 / 50 / 70 join that same orientation.
  // 60 / 90 were observed as reversed relative to each other, so 60 takes the
  // opposite quarter-turn while 90 takes the common orientation.
  if (value === 6) return Math.PI / 2;
  return -Math.PI / 2;
}

function drawTens(ctx, cell, value) {
  const label = String(value * 10).padStart(2, '0');
  const main = label[0];
  const zero = label[1];
  const rotation = tensGlyphRotation(value);

  // Approved percentile layout: large primary digit toward the blunt end,
  // smaller trailing zero toward the apex. Keep the v3 larger/elongated scale.
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

function makeTensAtlas(entry) {
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
    ctx.clearRect(0, 0, ATLAS_CELL, ATLAS_CELL);
    drawTens(ctx, ATLAS_CELL, face.value);
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

function buildTensGeometry(entry, cols, rows) {
  const positions = [];
  const uvs = [];
  const half = entry.radius * .322;

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
    this.production = new FaceMarkingFactory();
    this.tensCache = null;
  }

  getMesh(record) {
    const isTens = record.entry.key === 'd10-digit' && record.componentRole === 'tens';
    if (!isTens) {
      // Explicit rollback: single D10 and D100 ones are exactly the production
      // markings again. No v3 size/stretch/orientation experiments apply.
      return this.production.getMesh(record);
    }

    if (!this.tensCache) {
      const { texture, cols, rows } = makeTensAtlas(record.entry);
      const geometry = buildTensGeometry(record.entry, cols, rows);
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
      this.tensCache = { texture, geometry, material };
    }

    const mesh = new THREE.Mesh(this.tensCache.geometry, this.tensCache.material);
    mesh.renderOrder = 2;
    return mesh;
  }

  dispose() {
    this.production.dispose();
    if (this.tensCache) {
      this.tensCache.texture.dispose();
      this.tensCache.geometry.dispose();
      this.tensCache.material.dispose();
      this.tensCache = null;
    }
  }
}
