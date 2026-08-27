import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

const TARGET_RADIUS = 0.82;

function vecLength(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function normalizeVertices(vertices, targetRadius = TARGET_RADIUS) {
  const maxRadius = Math.max(...vertices.map(vecLength));
  const s = targetRadius / maxRadius;
  return vertices.map(([x, y, z]) => [x * s, y * s, z * s]);
}

function faceCenter(vertices, face) {
  const c = [0, 0, 0];
  face.forEach((idx) => {
    c[0] += vertices[idx][0];
    c[1] += vertices[idx][1];
    c[2] += vertices[idx][2];
  });
  return c.map((v) => v / face.length);
}

function rawFaceNormal(vertices, face) {
  const a = vertices[face[0]], b = vertices[face[1]], c = vertices[face[2]];
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  const len = Math.hypot(...n) || 1;
  return n.map((v) => v / len);
}

function orientFaces(vertices, faces) {
  return faces.map((face) => {
    const n = rawFaceNormal(vertices, face);
    const c = faceCenter(vertices, face);
    const outward = n[0] * c[0] + n[1] * c[1] + n[2] * c[2];
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
  const g = geometry.toNonIndexed();
  const p = g.attributes.position.array;
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
    .map((face, idx) => ({ idx, n: rawFaceNormal(vertices, face) }))
    .sort((a, b) => (b.n[1] - a.n[1]) || (b.n[0] - a.n[0]) || (b.n[2] - a.n[2]));
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
  const visualGeometry = makeThreeGeometry(vertices, faces);
  const faceMeta = faces.map((face, i) => ({
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
  const visualGeometry = new THREE.BoxGeometry(side, side, side);
  return {
    key,
    publicType: options.publicType ?? key,
    radius: Math.sqrt(3) * half,
    visualGeometry,
    color: options.color ?? 0xc0bba0,
    faces: faceDefs.map((f, i) => ({
      id: `${key}-f${i}`,
      value: f.value,
      label: String(f.label ?? f.value),
      normal: f.normal,
    })),
    createShape: () => new CANNON.Box(new CANNON.Vec3(half, half, half)),
  };
}

function makeD10Poly() {
  const r = 1;
  const y = 0.38;
  const vertices = [[0, 1.45, 0], [0, -1.45, 0]];
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    vertices.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  for (let i = 0; i < 5; i += 1) {
    const a = ((i + 0.5) / 5) * Math.PI * 2;
    vertices.push([Math.cos(a) * r, -y, Math.sin(a) * r]);
  }
  const faces = [];
  for (let i = 0; i < 5; i += 1) {
    const a0 = 2 + i;
    const a1 = 2 + ((i + 1) % 5);
    const b0 = 7 + i;
    const b1 = 7 + ((i + 1) % 5);
    faces.push([0, a0, b0, a1]);
    faces.push([1, b1, a1, b0]);
  }
  const scaled = normalizeVertices(vertices);
  return { vertices: scaled, faces: orientFaces(scaled, faces) };
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

const entries = new Map();
entries.set('d3', makeBoxEntry('d3', d3Faces, { color: 0xb8b69d }));
entries.set('d4', makePolyEntry('d4', tetra, assignSequentialFaces(tetra.vertices, tetra.faces, [1, 2, 3, 4]), { color: 0xc0b69b }));
entries.set('d6', makeBoxEntry('d6', d6Faces, { color: 0xbab79c }));
entries.set('d8', makePolyEntry('d8', octa, assignOppositePairs(octa.vertices, octa.faces, 1, 8), { color: 0xb2b69c }));
entries.set('d10', makePolyEntry('d10', d10Poly, assignOppositePairs(d10Poly.vertices, d10Poly.faces, 1, 10), { color: 0xbeb196 }));
entries.set('d10-digit', makePolyEntry('d10-digit', d10Poly, assignOppositePairs(d10Poly.vertices, d10Poly.faces, 0, 9), { publicType: 'd100', color: 0xb3ad93 }));
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

  getPhysicalEntry(logicalType, componentRole = null) {
    if (logicalType === 'd100') return this.get('d10-digit');
    return this.get(logicalType);
  }

  getPhysicalCount(pool) {
    return pool.reduce((sum, item) => sum + item.count * (item.type === 'd100' ? 2 : 1), 0);
  }
}
