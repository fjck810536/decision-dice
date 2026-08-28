import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';

// M6.2B production face markings.
// These values are promoted from the user-approved art labs. Keep each die's
// layout isolated: visual changes to one die must not silently alter another.
const FACE_OFFSET = 0.012;
const INK = '#241d16';
const INK_EDGE = 'rgba(70,55,40,.82)';
const OLD_DICE_RED = '#96372f';
const CROSS_RED = '#96372f';
const CROSS_RED_EDGE = 'rgba(105,40,36,.88)';
const CUT_HIGHLIGHT = 'rgba(239,228,199,.28)';
const TENS_CUT_HIGHLIGHT = 'rgba(239,228,199,.24)';
const BODY_GROOVE_SHADOW = 'rgba(48,43,34,.16)';
const BODY_GROOVE_HIGHLIGHT = 'rgba(239,228,199,.20)';

function makeCanvasAtlas(entry, cell, drawCell) {
  const count = entry.faces.length;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  entry.faces.forEach((face, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    ctx.save();
    ctx.translate(col * cell, row * cell);
    drawCell(ctx, cell, face, index);
    ctx.restore();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, cols, rows, cell };
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

function cellUv(index, cols, rows, cell) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const padU = 2 / (cols * cell);
  const padV = 2 / (rows * cell);
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

function makeMaterial(texture, alphaTest = 0.10) {
  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

function finishGeometry(positions, uvs) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

function buildCenteredGeometry(entry, cols, rows, cell, halfScale) {
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
    pushQuad(positions, uvs, center, tangent, bitangent, half, cellUv(index, cols, rows, cell));
  });

  return finishGeometry(positions, uvs);
}

// ---------------------------------------------------------------------------
// D3 — oversized circle / red cross / body-color square groove.

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
  ctx.moveTo(cell * 0.15, cell * 0.15 + yOffset);
  ctx.lineTo(cell * 0.85, cell * 0.85 + yOffset);
  ctx.moveTo(cell * 0.85, cell * 0.15 + yOffset);
  ctx.lineTo(cell * 0.15, cell * 0.85 + yOffset);
  ctx.stroke();
}

function strokeHollowSquare(ctx, cell, strokeStyle, lineWidth, yOffset = 0) {
  const side = cell * 0.70;
  const inset = (cell - side) / 2;
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'square';
  ctx.strokeRect(inset, inset + yOffset, side, side);
  ctx.restore();
}

function drawD3Cell(ctx, cell, face) {
  const value = face.value;
  ctx.clearRect(0, 0, cell, cell);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const highlightWidth = cell * 0.145;
  const edgeWidth = cell * 0.108;
  const inkWidth = cell * 0.076;
  const cutOffset = cell * 0.028;

  if (value === 1) {
    const radius = cell * 0.355;
    strokeCircle(ctx, cell * 0.5, cell * 0.5, radius, CUT_HIGHLIGHT, highlightWidth, cutOffset);
    strokeCircle(ctx, cell * 0.5, cell * 0.5, radius, INK_EDGE, edgeWidth);
    strokeCircle(ctx, cell * 0.5, cell * 0.5, radius, INK, inkWidth);
  } else if (value === 2) {
    strokeCross(ctx, cell, CUT_HIGHLIGHT, highlightWidth, cutOffset);
    strokeCross(ctx, cell, CROSS_RED_EDGE, edgeWidth);
    strokeCross(ctx, cell, CROSS_RED, inkWidth);
  } else if (value === 3) {
    // No ink and no fill: transparent atlas pixels expose the actual die body.
    strokeHollowSquare(ctx, cell, BODY_GROOVE_SHADOW, cell * 0.050, -cell * 0.018);
    strokeHollowSquare(ctx, cell, BODY_GROOVE_HIGHLIGHT, cell * 0.050, cell * 0.018);
  }
}

function makeD3Marking(entry) {
  const atlas = makeCanvasAtlas(entry, 96, drawD3Cell);
  return {
    texture: atlas.texture,
    geometry: buildCenteredGeometry(entry, atlas.cols, atlas.rows, atlas.cell, 0.47),
    material: makeMaterial(atlas.texture),
  };
}

// ---------------------------------------------------------------------------
// D6 — large pips, muted-red one pip.

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

function drawD6Cell(ctx, cell, face) {
  ctx.clearRect(0, 0, cell, cell);
  const radius = cell * 0.112;
  const pipInk = face.value === 1 ? OLD_DICE_RED : INK;
  for (const [px, py] of pipPoints(face.value)) {
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
}

function makeD6Marking(entry) {
  const atlas = makeCanvasAtlas(entry, 96, drawD6Cell);
  return {
    texture: atlas.texture,
    geometry: buildCenteredGeometry(entry, atlas.cols, atlas.rows, atlas.cell, 0.39),
    material: makeMaterial(atlas.texture),
  };
}

// ---------------------------------------------------------------------------
// D4 — traditional vertex read, 111 / 222 / 333 / 444 around each vertex.

function drawD4Glyph(ctx, cell, value) {
  ctx.clearRect(0, 0, cell, cell);
  ctx.save();
  ctx.translate(cell * 0.50, cell * 0.50);
  ctx.scale(0.98, 1.15);
  ctx.font = `700 ${Math.round(cell * 0.94)}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = CUT_HIGHLIGHT;
  ctx.lineWidth = Math.max(3, cell * 0.052);
  ctx.strokeText(String(value), 0, cell * 0.035);
  ctx.strokeStyle = INK_EDGE;
  ctx.lineWidth = Math.max(2, cell * 0.032);
  ctx.strokeText(String(value), 0, 0);
  ctx.fillStyle = INK;
  ctx.fillText(String(value), 0, 0);
  ctx.restore();
}

function makeD4Atlas(entry) {
  const values = [...new Set(entry.faces.map((face) => face.value))].sort((a, b) => a - b);
  const cell = 96;
  const cols = 2;
  const rows = 2;
  const canvas = document.createElement('canvas');
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const valueIndex = new Map();

  values.forEach((value, index) => {
    valueIndex.set(value, index);
    const col = index % cols;
    const row = Math.floor(index / cols);
    ctx.save();
    ctx.translate(col * cell, row * cell);
    drawD4Glyph(ctx, cell, value);
    ctx.restore();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, cols, rows, cell, valueIndex };
}

function buildD4VertexGeometry(entry, atlas) {
  const positions = [];
  const uvs = [];
  const half = entry.radius * 0.34;
  const cornerPull = 0.67;

  entry.faces.forEach((hostFace, hostIndex) => {
    const hostNormal = new THREE.Vector3(...hostFace.normal).normalize();
    const planeCenter = hostNormal.clone().multiplyScalar(
      supportDistance(entry.visualGeometry, hostNormal),
    );

    entry.faces.forEach((resultFace, resultIndex) => {
      if (resultIndex === hostIndex) return;
      const vertex = new THREE.Vector3(...resultFace.normal).normalize().multiplyScalar(-entry.radius);
      const towardVertex = vertex.clone().sub(planeCenter).normalize();
      const center = planeCenter.clone().lerp(vertex, cornerPull).addScaledVector(hostNormal, FACE_OFFSET);
      const bitangent = towardVertex;
      const tangent = new THREE.Vector3().crossVectors(bitangent, hostNormal).normalize();
      const correctedUp = new THREE.Vector3().crossVectors(hostNormal, tangent).normalize();
      pushQuad(
        positions,
        uvs,
        center,
        tangent,
        correctedUp,
        half,
        cellUv(atlas.valueIndex.get(resultFace.value), atlas.cols, atlas.rows, atlas.cell),
      );
    });
  });

  return finishGeometry(positions, uvs);
}

function makeD4Marking(entry) {
  const atlas = makeD4Atlas(entry);
  return {
    texture: atlas.texture,
    geometry: buildD4VertexGeometry(entry, atlas),
    material: makeMaterial(atlas.texture),
  };
}

// ---------------------------------------------------------------------------
// D8 — one large engraved numeral per triangle.

function drawD8Cell(ctx, cell, face) {
  const value = face.value;
  ctx.clearRect(0, 0, cell, cell);
  ctx.save();
  ctx.translate(cell * 0.50, cell * 0.50);
  ctx.scale(0.98, 1.10);
  ctx.font = `700 ${Math.round(cell * 0.88)}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = CUT_HIGHLIGHT;
  ctx.lineWidth = Math.max(3, cell * 0.050);
  ctx.strokeText(String(value), 0, cell * 0.035);
  ctx.strokeStyle = INK_EDGE;
  ctx.lineWidth = Math.max(2, cell * 0.030);
  ctx.strokeText(String(value), 0, 0);
  ctx.fillStyle = INK;
  ctx.fillText(String(value), 0, 0);
  if (value === 6) {
    const width = cell * 0.34;
    ctx.fillRect(-width / 2, cell * 0.31, width, Math.max(4, cell * 0.045));
  }
  ctx.restore();
}

function makeD8Marking(entry) {
  const atlas = makeCanvasAtlas(entry, 96, drawD8Cell);
  return {
    texture: atlas.texture,
    geometry: buildCenteredGeometry(entry, atlas.cols, atlas.rows, atlas.cell, 0.38),
    material: makeMaterial(atlas.texture),
  };
}

// ---------------------------------------------------------------------------
// D10 single + D100 ones — huge mono digits, physical 0 / logical 10 on D10.

function displaySingleValue(entry, face) {
  if (entry.key === 'd10' && face.value === 10) return '0';
  return String(face.value);
}

function drawSingleD10Cell(ctx, cell, face, entry) {
  const label = displaySingleValue(entry, face);
  ctx.clearRect(0, 0, cell, cell);
  const fontSize = Math.round(cell * 0.74);
  const x = cell / 2;
  const y = cell / 2 + cell * 0.025;
  ctx.font = `900 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = TENS_CUT_HIGHLIGHT;
  ctx.lineWidth = Math.max(2, fontSize * 0.045);
  ctx.strokeText(label, x, y + 2);
  ctx.strokeStyle = INK_EDGE;
  ctx.lineWidth = Math.max(2, fontSize * 0.032);
  ctx.strokeText(label, x, y);
  ctx.fillStyle = '#20231c';
  ctx.fillText(label, x, y);

  if (label === '6' || label === '9') {
    const width = cell * 0.34;
    const underlineY = cell * 0.82;
    const thickness = Math.max(4, cell * 0.052);
    const underlineX = cell / 2 - width / 2;
    ctx.fillStyle = TENS_CUT_HIGHLIGHT;
    ctx.fillRect(underlineX, underlineY + 2, width, thickness * 1.12);
    ctx.fillStyle = '#20231c';
    ctx.fillRect(underlineX, underlineY, width, thickness);
  }
}

function makeSingleD10Atlas(entry) {
  return makeCanvasAtlas(entry, 96, (ctx, cell, face) => drawSingleD10Cell(ctx, cell, face, entry));
}

function buildSingleD10Geometry(entry, atlas) {
  const positions = [];
  const uvs = [];
  const half = entry.radius * 0.48;

  entry.faces.forEach((face, index) => {
    const normal = new THREE.Vector3(...face.normal).normalize();
    const center = normal.clone().multiplyScalar(
      supportDistance(entry.visualGeometry, normal) + FACE_OFFSET,
    );
    let bitangent = new THREE.Vector3(...face.markingUp).normalize();
    const tangent = new THREE.Vector3().crossVectors(bitangent, normal).normalize();
    bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    pushQuad(
      positions,
      uvs,
      center,
      tangent,
      bitangent,
      half,
      cellUv(index, atlas.cols, atlas.rows, atlas.cell),
    );
  });

  return finishGeometry(positions, uvs);
}

function makeSingleD10Marking(entry) {
  const atlas = makeSingleD10Atlas(entry);
  return {
    texture: atlas.texture,
    geometry: buildSingleD10Geometry(entry, atlas),
    material: makeMaterial(atlas.texture, 0.12),
  };
}

// ---------------------------------------------------------------------------
// D100 tens — locked v7 blunt-end main digit + smaller zero toward the tip.

function drawEngravedGlyph(ctx, text, x, y, fontSize, {
  narrowZero = false,
  rotation = 0,
  stretchX = 0.96,
  stretchY = 1.13,
  fontWeight = 700,
  strokeBoost = 1,
} = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  const zeroScale = narrowZero && text === '0' ? 0.84 : 1;
  ctx.scale(stretchX * zeroScale, stretchY);
  ctx.font = `${fontWeight} ${fontSize}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = TENS_CUT_HIGHLIGHT;
  ctx.lineWidth = Math.max(2, fontSize * 0.045 * strokeBoost);
  ctx.strokeText(text, 0, 2);
  ctx.strokeStyle = INK_EDGE;
  ctx.lineWidth = Math.max(2, fontSize * 0.032 * strokeBoost);
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = INK;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawD100TensCell(ctx, cell, face) {
  ctx.clearRect(0, 0, cell, cell);
  const label = String(face.value * 10).padStart(2, '0');
  const rotation = -Math.PI / 2;
  drawEngravedGlyph(ctx, label[0], cell * 0.48, cell * 0.78, Math.round(cell * 0.89), {
    narrowZero: true,
    rotation,
    stretchX: 0.96,
    stretchY: 1.20,
    fontWeight: 700,
    strokeBoost: 1.06,
  });
  drawEngravedGlyph(ctx, label[1], cell * 0.51, cell * 0.42, Math.round(cell * 0.64), {
    rotation,
    stretchX: 0.90,
    stretchY: 1.28,
    fontWeight: 800,
    strokeBoost: 1.30,
  });
}

function buildD100TensGeometry(entry, atlas) {
  const positions = [];
  const uvs = [];
  const half = entry.radius * 0.334;

  entry.faces.forEach((face, index) => {
    const normal = new THREE.Vector3(...face.normal).normalize();
    let bitangent = new THREE.Vector3(...face.markingUp).normalize();
    const tangent = new THREE.Vector3().crossVectors(bitangent, normal).normalize();
    bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    const center = normal.clone().multiplyScalar(
      supportDistance(entry.visualGeometry, normal) + 0.0125,
    );
    center.addScaledVector(bitangent, -entry.radius * 0.065);
    pushQuad(
      positions,
      uvs,
      center,
      tangent,
      bitangent,
      half,
      cellUv(index, atlas.cols, atlas.rows, atlas.cell),
    );
  });

  return finishGeometry(positions, uvs);
}

function makeD100TensMarking(entry) {
  const atlas = makeCanvasAtlas(entry, 128, drawD100TensCell);
  return {
    texture: atlas.texture,
    geometry: buildD100TensGeometry(entry, atlas),
    material: makeMaterial(atlas.texture),
  };
}

// ---------------------------------------------------------------------------
// D20 — approved layout A: baseline parallel to one deterministic edge and
// numeral center at medianT=.47 toward the opposite apex.

function drawD20Cell(ctx, cell, face) {
  const value = face.value;
  const label = String(value);
  const compact = label.length >= 2;
  ctx.clearRect(0, 0, cell, cell);
  ctx.save();
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

function buildD20Geometry(entry, atlas) {
  const positions = [];
  const uvs = [];
  const half = entry.radius * 0.31;
  const medianT = 0.47; // approved A layout

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
    pushQuad(
      positions,
      uvs,
      center,
      tangent,
      bitangent,
      half,
      cellUv(index, atlas.cols, atlas.rows, atlas.cell),
    );
  });

  return finishGeometry(positions, uvs);
}

function makeD20Marking(entry) {
  const atlas = makeCanvasAtlas(entry, 128, drawD20Cell);
  return {
    texture: atlas.texture,
    geometry: buildD20Geometry(entry, atlas),
    material: makeMaterial(atlas.texture),
  };
}

// ---------------------------------------------------------------------------

export class FaceMarkingFactory {
  constructor() {
    this.cache = new Map();
  }

  #cacheKey(record) {
    if (record.entry.key === 'd10-digit') {
      return `d10-digit:${record.componentRole === 'tens' ? 'tens' : 'ones'}`;
    }
    return record.entry.key;
  }

  #build(record) {
    switch (record.entry.key) {
      case 'd3': return makeD3Marking(record.entry);
      case 'd4': return makeD4Marking(record.entry);
      case 'd6': return makeD6Marking(record.entry);
      case 'd8': return makeD8Marking(record.entry);
      case 'd10': return makeSingleD10Marking(record.entry);
      case 'd20': return makeD20Marking(record.entry);
      case 'd10-digit':
        return record.componentRole === 'tens'
          ? makeD100TensMarking(record.entry)
          : makeSingleD10Marking(record.entry);
      default:
        throw new Error(`No face marking art for die type: ${record.entry.key}`);
    }
  }

  getMesh(record) {
    const key = this.#cacheKey(record);
    let cached = this.cache.get(key);
    if (!cached) {
      cached = this.#build(record);
      this.cache.set(key, cached);
    }
    const mesh = new THREE.Mesh(cached.geometry, cached.material);
    mesh.renderOrder = 2;
    return mesh;
  }

  dispose() {
    for (const cached of this.cache.values()) {
      cached.texture.dispose();
      cached.geometry.dispose();
      cached.material.dispose();
    }
    this.cache.clear();
  }
}
