import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';

const TYPES = ['d3', 'd4', 'd6', 'd8', 'd10', 'd20', 'd100'];
const VARIANTS = [0, 1, 2];
const spriteCache = new Map();
let readyPromise = null;

const COLORS = {
  d3: 0xb8b69d,
  d4: 0xc0b69b,
  d6: 0xbab79c,
  d8: 0xb2b69c,
  d10: 0xbeb196,
  d20: 0xb5b296,
};

function normalizeVertices(vertices, radius = 0.86) {
  const maxRadius = Math.max(...vertices.map(([x, y, z]) => Math.hypot(x, y, z)));
  const scale = radius / maxRadius;
  return vertices.map(([x, y, z]) => [x * scale, y * scale, z * scale]);
}

function faceNormal(vertices, face) {
  const a = vertices[face[0]];
  const b = vertices[face[1]];
  const c = vertices[face[2]];
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
}

function faceCenter(vertices, face) {
  const out = [0, 0, 0];
  face.forEach((index) => {
    out[0] += vertices[index][0];
    out[1] += vertices[index][1];
    out[2] += vertices[index][2];
  });
  return out.map((value) => value / face.length);
}

function orientFaces(vertices, faces) {
  return faces.map((face) => {
    const normal = faceNormal(vertices, face);
    const center = faceCenter(vertices, face);
    const dot = normal[0] * center[0] + normal[1] * center[1] + normal[2] * center[2];
    return dot >= 0 ? face.slice() : face.slice().reverse();
  });
}

function polyGeometry(vertices, faces) {
  const positions = [];
  faces.forEach((face) => {
    for (let i = 1; i < face.length - 1; i += 1) {
      [face[0], face[i], face[i + 1]].forEach((index) => positions.push(...vertices[index]));
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function d10Geometry() {
  const ringRadius = 1;
  const beltOffset = 0.10;
  const poleHeight = beltOffset * 9.47213595499958;
  const vertices = [
    [0, 0, poleHeight],
    [0, 0, -poleHeight],
  ];

  for (let i = 0; i < 10; i += 1) {
    const angle = (i * Math.PI * 2) / 10;
    vertices.push([
      ringRadius * Math.cos(angle),
      ringRadius * Math.sin(angle),
      i % 2 === 0 ? beltOffset : -beltOffset,
    ]);
  }

  const faces = [];
  for (let i = 1; i < 10; i += 2) {
    faces.push([0, 2 + ((i + 9) % 10), 2 + i, 2 + ((i + 1) % 10)]);
  }
  for (let i = 0; i < 10; i += 2) {
    faces.push([1, 2 + ((i + 9) % 10), 2 + i, 2 + ((i + 1) % 10)]);
  }

  const normalized = normalizeVertices(vertices);
  return polyGeometry(normalized, orientFaces(normalized, faces));
}

function geometryFor(type) {
  switch (type) {
    case 'd3':
    case 'd6':
      return new THREE.BoxGeometry(1.16, 1.16, 1.16);
    case 'd4':
      return new THREE.TetrahedronGeometry(0.94, 0);
    case 'd8':
      return new THREE.OctahedronGeometry(0.92, 0);
    case 'd10':
      return d10Geometry();
    case 'd20':
      return new THREE.IcosahedronGeometry(0.92, 0);
    default:
      return new THREE.BoxGeometry(1, 1, 1);
  }
}

function addDie(group, type, { x = 0, scale = 1, color = null, variant = 0 } = {}) {
  const geometry = geometryFor(type);
  const material = new THREE.MeshLambertMaterial({
    color: color ?? COLORS[type] ?? 0xb9b48f,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.x = x;
  mesh.scale.setScalar(scale);
  mesh.rotation.set(
    0.52 + variant * 0.31,
    -0.68 + variant * 0.53,
    0.17 - variant * 0.21,
  );
  group.add(mesh);

  const edges = new THREE.EdgesGeometry(geometry, 17);
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x34382e, transparent: true, opacity: 0.72 });
  const lines = new THREE.LineSegments(edges, lineMaterial);
  lines.position.copy(mesh.position);
  lines.rotation.copy(mesh.rotation);
  lines.scale.copy(mesh.scale);
  group.add(lines);
}

function makeGroup(type, variant) {
  const group = new THREE.Group();
  if (type === 'd100') {
    addDie(group, 'd10', { x: -0.46, scale: 0.72, color: 0xbdb79d, variant });
    addDie(group, 'd10', { x: 0.46, scale: 0.72, color: 0x94977d, variant: (variant + 1) % 3 });
    group.rotation.z = variant === 1 ? -0.12 : 0.08;
  } else {
    addDie(group, type, { variant });
  }
  return group;
}

function quantize(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const bayer = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5,
  ];
  const levels = 20;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const i = (y * canvas.width + x) * 4;
      if (data[i + 3] < 12) continue;
      const threshold = (bayer[(y % 4) * 4 + (x % 4)] - 7.5) / 16;
      for (let c = 0; c < 3; c += 1) {
        const normalized = data[i + c] / 255;
        const q = Math.max(0, Math.min(1, Math.floor(normalized * levels + 0.5 + threshold * 0.36) / levels));
        data[i + c] = Math.round(q * 255);
      }
    }
  }

  ctx.putImageData(image, 0, 0);
}

function renderAllSprites() {
  const webglCanvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas: webglCanvas,
    alpha: true,
    antialias: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xc8cbbb, 0.78));
  const sun = new THREE.DirectionalLight(0xfff1d8, 1.62);
  sun.position.set(3.2, 4.6, 4.8);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 20);
  camera.position.set(0, 0, 4.2);
  camera.lookAt(0, 0, 0);

  TYPES.forEach((type) => {
    VARIANTS.forEach((variant) => {
      const width = type === 'd100' ? 80 : 58;
      const height = 58;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const group = makeGroup(type, variant);
      scene.add(group);
      renderer.clear();
      renderer.render(scene, camera);

      const out = document.createElement('canvas');
      out.width = width;
      out.height = height;
      const ctx = out.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(webglCanvas, 0, 0, width, height);
      quantize(out);
      spriteCache.set(`${type}:${variant}`, out.toDataURL('image/png'));

      scene.remove(group);
      group.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
        else object.material?.dispose?.();
      });
    });
  });

  renderer.dispose();
  renderer.forceContextLoss?.();
}

function ensureSprites() {
  if (!readyPromise) {
    readyPromise = Promise.resolve().then(renderAllSprites);
  }
  return readyPromise;
}

function makeImage(src, className = '') {
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  if (className) img.className = className;
  return img;
}

export async function hydrateDicePreviews(root) {
  if (!root) return;
  await ensureSprites();
  const slots = root.querySelectorAll('[data-die-preview]');
  slots.forEach((slot) => {
    if (!slot.isConnected || slot.dataset.previewReady === '1') return;
    const type = slot.dataset.diePreview;
    const startVariant = Number(slot.dataset.previewVariant || 0) % 3;
    const cycle = slot.dataset.previewCycle === '1';

    if (cycle) {
      const frames = VARIANTS.map((_, offset) => {
        const variant = (startVariant + offset) % 3;
        const src = spriteCache.get(`${type}:${variant}`);
        return src ? makeImage(src, `die-preview-frame die-preview-frame-${offset}`) : null;
      }).filter(Boolean);
      slot.classList.add('is-turntable');
      slot.replaceChildren(...frames);
    } else {
      const src = spriteCache.get(`${type}:${startVariant}`);
      if (!src) return;
      slot.replaceChildren(makeImage(src));
    }

    slot.dataset.previewReady = '1';
  });
}
