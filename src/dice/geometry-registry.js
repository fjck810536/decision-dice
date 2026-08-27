import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

const TARGET_RADIUS = 0.82;

function vecLength(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function normalizeVertices(vertices, targetRadius = TARGET_RADIUS) {
  const maxRadius = Math.max(...vertices.map(vecLength));
  const scale = targetRadius / maxRadius;
  return vertices.map(([x, y, z]) => [x * scale, y * scale, z * scale]);
}

function faceCenter(vertices, face) {
  const center = [0, 0, 0];
  face.forEach((idx) => {
    center[0] += vertices[idx][0];
    center[1] += vertices[idx][1];
    center[2] += vertices[idx][2];
  });
  return center.map((v) => v / face.length);
}

function rawFaceNormal(vertices, face) {
  const a = vertices[face[0]], b = vertices[face[1]], c = vertices[face[2]];
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const normal = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  const length = Math.hypot(...normal) || 1;
  return normal.map((v) => v / length);
}

function orientFaces(vertices, faces) {
  return faces.map((face) => {
    const normal = rawFaceNormal(vertices, face);
    const center = faceCenter(vertices, face);
    const outward = normal[0] * center[0] + normal[1] * center[1] + normal[2] * center[2];
    return outward >= 0 ? face.slice() : face.slice().reverse();
  });
}

function makeThreeGeometry(vertices, faces) {
  const positions = [];
  faces.forEach((face) => {
    for (let i = 1; i < face.length - 1; i += 1) {
      [face[0], face[i], face[i + 1]].forEach((idx) => positions.push(...vertices[idx]));
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function makeConvexShape(vertices, faces) {
  return new CANNON.ConvexPolyhedron({
    vertices: vertices.map(([x, y, z]) => new CANNON.Vec3(x, y, z)),
    faces: faces.map((face) => face.slice()),
  });
}

function extractTrianglePoly(geometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = source.attributes.position.array;
  const vertices = [];
  const map = new Map();
  const faces = [];
  const key = (x, y, z) => `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;

  for (let i = 0; i < p.length; i += 9) {
    const face = [];
    for (let j = 0; j < 9; j += 3) {
      const x = p[i + j], y = p[i + j + 1], z = p[i + j + 2];
      const k = key(x, y, z);
      let idx = map.get(k);
      if (idx === undefined) {
        idx = vertices.length;
        map.set(k, idx);
        vertices.push([x, y, z]);
      }
      face.push(idx);
    }
    if (new Set(face).size === 3) faces.push(face);
  }

  const scaled = normalizeVertices(vertices);
  return { vertices: scaled, faces: orientFaces(scaled, faces) };
}

function assignSequentialFaces(vertices, faces, values) {
  const order = faces
    .map((face, idx) => ({ idx, normal: rawFaceNormal(vertices, face) }))
    .sort((a, b) => (b.normal[1] - a.normal[1]) || (b.normal[0] - a.normal[0]) || (b.normal[2] - a.normal[2]));
  const out = Array(faces.length);
  order.forEach((item, i) => { out[item.idx] = values[i]; });
  return out;
}

function assignOppositePairs(vertices, faces, lowValue, highValue) {
  const normals = faces.map((face) => rawFaceNormal(vertices, face));
  const remaining = new Set(faces.map((_, i) => i));
  const values = Array(faces.length);
  let low = lowValue;
  let high = highValue;

  while (remaining.size) {
    const ordered = [...remaining].sort((a, b) => {
      const na = normals[a], nb = normals[b];
      return (nb[1] - na[1]) || (nb[0] - na[0]) || (nb[2] - na[2]);
    });
    const a = ordered[0];
    remaining.delete(a);

    if (!remaining.size) {
      values[a] = low;
      break;
    }

    let opposite = null;
    let minDot = Infinity;
    for (const candidate of remaining) {
      const na = normals[a], nb = normals[candidate];
      const dot = na[0] * nb[0] + na[1] * nb[1] + na[2] * nb[2];
      if (dot < minDot) {
        minDot = dot;
        opposite = candidate;
      }
    }

    values[a] = low;
    values[opposite] = high;
    remaining.delete(opposite);
    low += 1;
    high -= 1;
  }

  return values;
}

function makePolyEntry(key, poly, values, options = {}) {
  const { vertices, faces } = poly;
  const semanticFaces = poly.semanticFaces ?? faces;
  const visualGeometry = makeThreeGeometry(vertices, faces);
  const faceMeta = semanticFaces.map((face, i) => ({
    id: `${key}-f${i}`,
    value: values[i],
    label: String(values[i]),
    normal: rawFaceNormal(vertices, face),
  }));

  return {
    key,
    publicType: options.publicType ?? key,
    radius: options.radius ?? TARGET_RADIUS,
    visualGeometry,
    faces: faceMeta,
    color: options.color ?? 0xb9b48f,
    createShape: () => makeConvexShape(vertices, faces),
  };
}

function makeBoxEntry(key, faceDefs, options = {}) {
  const half = 0.475;
  const side = half * 2;
  return {
    key,
    publicType: options.publicType ?? key,
    radius: Math.sqrt(3) * half,
    visualGeometry: new THREE.BoxGeometry(side, side, side),
    color: options.color ?? 0xc0bba0,
    faces: faceDefs.map((face, i) => ({
      id: `${key}-f${i}`,
      value: face.value,
      label: String(face.label ?? face.value),
      normal: face.normal,
    })),
    createShape: () => new CANNON.Box(new CANNON.Vec3(half, half, half)),
  };
}

function makeD10Poly() {
  const vertices = [[0, 0, 1], [0, 0, -1]];
  for (let i = 0; i < 10; i += 1) {
    const angle = (i * Math.PI * 2) / 10;
    vertices.push([
      -Math.cos(angle),
      -Math.sin(angle),
      0.105 * (i % 2 ? 1 : -1),
    ]);
  }

  const topFaces = [];
  const bottomFaces = [];
  for (let i = 0; i < 10; i += 1) {
    const a = 2 + i;
    const b = 2 + ((i + 1) % 10);
    topFaces.push([0, a, b]);
    bottomFaces.push([1, b, a]);
  }

  const scaled = normalizeVertices(vertices);
  const oriented = orientFaces(scaled, [...topFaces, ...bottomFaces]);

  return {
    vertices: scaled,
    faces: oriented,
    semanticFaces: oriented.slice(0, 10),
  };
}

const d3Faces = [
  { normal: [0, 1, 0], value: 1 }, { normal: [0, -1, 0], value: 1 },
  { normal: [1, 0, 0], value: 2 }, { normal: [-1, 0, 0], value: 2 },
  { normal: [0, 0, 1], value: 3 }, { normal: [0, 0, -1], value: 3 },
];

const d6Faces = [
  { normal: [0, 1, 0], value: 1 }, { normal: [0, -1, 0], value: 6 },
  { normal: [1, 0, 0], value: 2 }, { normal: [-1, 0, 0], value: 5 },
  { normal: [0, 0, 1], value: 3 }, { normal: [0, 0, -1], value: 4 },
];

const tetra = extractTrianglePoly(new THREE.TetrahedronGeometry(1, 0));
const octa = extractTrianglePoly(new THREE.OctahedronGeometry(1, 0));
const icosa = extractTrianglePoly(new THREE.IcosahedronGeometry(1, 0));
const d10Poly = makeD10Poly();
const d10Semantic = d10Poly.semanticFaces;

const entries = new Map();
entries.set('d3', makeBoxEntry('d3', d3Faces, { color: 0xb8b69d }));
entries.set('d4', makePolyEntry('d4', tetra, assignSequentialFaces(tetra.vertices, tetra.faces, [1, 2, 3, 4]), { color: 0xc0b69b }));
entries.set('d6', makeBoxEntry('d6', d6Faces, { color: 0xbab79c }));
entries.set('d8', makePolyEntry('d8', octa, assignOppositePairs(octa.vertices, octa.faces, 1, 8), { color: 0xb2b69c }));
entries.set('d10', makePolyEntry('d10', d10Poly, assignOppositePairs(d10Poly.vertices, d10Semantic, 1, 10), { color: 0xbeb196 }));
entries.set('d10-digit', makePolyEntry('d10-digit', d10Poly, assignOppositePairs(d10Poly.vertices, d10Semantic, 0, 9), { publicType: 'd100', color: 0xb3ad93 }));
entries.set('d20', makePolyEntry('d20', icosa, assignOppositePairs(icosa.vertices, icosa.faces, 1, 20), { color: 0xb5b296 }));

export const PUBLIC_DIE_TYPES = ['d3', 'd4', 'd6', 'd8', 'd10', 'd20', 'd100'];

export class GeometryRegistry {
  get(type) {
    const entry = entries.get(type);
    if (!entry) throw new Error(`Unknown die type: ${type}`);
    return entry;
  }

  has(type) {
    return type === 'd100' || entries.has(type);
  }

  getPhysicalEntry(logicalType) {
    if (logicalType === 'd100') return this.get('d10-digit');
    return this.get(logicalType);
  }

  getPhysicalCount(pool) {
    return pool.reduce((sum, item) => sum + item.count * (item.type === 'd100' ? 2 : 1), 0);
  }
}
