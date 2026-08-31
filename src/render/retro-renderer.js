import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import { FaceMarkingFactory } from './face-markings.js';

const LAB_DEFAULTS = Object.freeze({
  enabled: false,
  dither: 'off',
  shadow: 'none',
  floor: 'default',
  wobble: 'off',
  popIn: 'off',
  fog: 'off',
});

function makeFloorTexture(mode) {
  if (mode === 'default') return null;

  const specs = {
    cuttingA: { base: '#2d5547', line: '#99a08d', lineAlpha: 0.58, spacing: 64, minor: 16, noise: 20 },
    cuttingB: { base: '#3c5549', line: '#9da18e', lineAlpha: 0.42, spacing: 48, minor: 12, noise: 17 },
    cuttingC: { base: '#172a24', line: '#788276', lineAlpha: 0.24, spacing: 40, minor: 10, noise: 12 },
  };
  const spec = specs[mode] ?? specs.cuttingB;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, size, size);

  // Deterministic low-resolution surface variation: cutting-mat inspired,
  // not a photographic texture.
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const n = ((x * 17 + y * 31 + (x * y) % 53) % 37) / 36;
      if (n > 0.72) {
        ctx.fillStyle = `rgba(235,224,197,${(n - 0.72) * spec.noise / 100})`;
        ctx.fillRect(x, y, 2, 2);
      } else if (n < 0.18) {
        ctx.fillStyle = `rgba(0,0,0,${(0.18 - n) * spec.noise / 90})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  const major = spec.spacing;
  const minor = spec.minor;
  for (let i = 0; i <= size; i += minor) {
    const isMajor = i % major === 0;
    ctx.strokeStyle = isMajor
      ? `rgba(218,213,191,${spec.lineAlpha})`
      : `rgba(218,213,191,${spec.lineAlpha * 0.20})`;
    ctx.lineWidth = isMajor ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(i + 0.5, 0);
    ctx.lineTo(i + 0.5, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i + 0.5);
    ctx.lineTo(size, i + 0.5);
    ctx.stroke();
  }

  // A few faint wear tracks prevent the floor from reading as a perfect UI grid.
  ctx.strokeStyle = 'rgba(235,224,197,.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 9; i += 1) {
    const y = 19 + i * 27;
    ctx.beginPath();
    ctx.moveTo(7 + (i % 3) * 11, y);
    ctx.lineTo(210 + (i % 4) * 7, y + 13 - (i % 2) * 20);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function applyVertexSnap(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLabWobble = uniforms.wobble;
    shader.uniforms.uLabSnap = uniforms.snap;
    shader.vertexShader = `
      uniform float uLabWobble;
      uniform float uLabSnap;
    ${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      if (uLabWobble > 0.5) {
        float safeW = max(abs(gl_Position.w), 0.0001);
        vec2 ndc = gl_Position.xy / safeW;
        ndc = floor(ndc * uLabSnap + 0.5) / uLabSnap;
        gl_Position.xy = ndc * safeW;
      }`,
    );
  };
  material.customProgramCacheKey = () => 'decision-dice-lab-vertex-snap-v1';
  material.needsUpdate = true;
}

function applyLabBodyShader(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLabWobble = uniforms.wobble;
    shader.uniforms.uLabSnap = uniforms.snap;
    shader.uniforms.uLabDither = uniforms.dither;
    shader.vertexShader = `
      uniform float uLabWobble;
      uniform float uLabSnap;
    ${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      if (uLabWobble > 0.5) {
        float safeW = max(abs(gl_Position.w), 0.0001);
        vec2 ndc = gl_Position.xy / safeW;
        ndc = floor(ndc * uLabSnap + 0.5) / uLabSnap;
        gl_Position.xy = ndc * safeW;
      }`,
    );

    shader.fragmentShader = `
      uniform float uLabDither;
      float labBayer4(vec2 pixel) {
        vec2 p = mod(floor(pixel), 4.0);
        float x = p.x;
        float y = p.y;
        float v = 0.0;
        if (y < 1.0) {
          if (x < 1.0) v = 0.0; else if (x < 2.0) v = 8.0; else if (x < 3.0) v = 2.0; else v = 10.0;
        } else if (y < 2.0) {
          if (x < 1.0) v = 12.0; else if (x < 2.0) v = 4.0; else if (x < 3.0) v = 14.0; else v = 6.0;
        } else if (y < 3.0) {
          if (x < 1.0) v = 3.0; else if (x < 2.0) v = 11.0; else if (x < 3.0) v = 1.0; else v = 9.0;
        } else {
          if (x < 1.0) v = 15.0; else if (x < 2.0) v = 7.0; else if (x < 3.0) v = 13.0; else v = 5.0;
        }
        return (v + 0.5) / 16.0;
      }
      vec3 labQuantize(vec3 c, float levels, float bias) {
        return clamp(floor(c * levels + bias) / levels, 0.0, 1.0);
      }
    ${shader.fragmentShader}`.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      if (uLabDither > 0.5) {
        float threshold = labBayer4(gl_FragCoord.xy);
        if (uLabDither < 1.5) {
          // ORDERED: 15/16-bit-like channel quantization with a 4x4 matrix.
          gl_FragColor.rgb = labQuantize(gl_FragColor.rgb, 31.0, threshold);
        } else if (uLabDither < 2.5) {
          // HALFTONE: coarse screen-space dots modulate luminance while preserving hue.
          float luma = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
          vec2 cell = fract(gl_FragCoord.xy / 5.0) - 0.5;
          float radius = mix(0.10, 0.52, 1.0 - luma);
          float dotMask = 1.0 - step(radius, length(cell));
          float shade = mix(1.0, 0.70, dotMask * (1.0 - luma));
          gl_FragColor.rgb = labQuantize(gl_FragColor.rgb * shade, 23.0, 0.45);
        } else {
          // HYBRID: ordered quantization plus a restrained round-dot shadow screen.
          vec3 q = labQuantize(gl_FragColor.rgb, 31.0, threshold);
          float luma = dot(q, vec3(0.299, 0.587, 0.114));
          vec2 cell = fract(gl_FragCoord.xy / 6.0) - 0.5;
          float radius = mix(0.04, 0.40, max(0.0, 0.62 - luma) / 0.62);
          float dotMask = 1.0 - step(radius, length(cell));
          gl_FragColor.rgb = clamp(q * mix(1.0, 0.79, dotMask), 0.0, 1.0);
        }
      }`,
    );
  };
  material.customProgramCacheKey = () => 'decision-dice-lab-body-shader-v2';
  material.needsUpdate = true;
}

export class RetroRenderer {
  constructor({
    canvas,
    stage,
    internalWidth = 360,
    inspectionMode = false,
    projectionMode = 'perspective',
    labOptions = null,
  }) {
    this.canvas = canvas;
    this.stage = stage;
    this.internalWidth = internalWidth;
    this.inspectionMode = inspectionMode;
    this.records = [];
    this.meshById = new Map();
    this.edgeGeometryCache = new Map();
    this.faceMarkings = new FaceMarkingFactory();
    this.lastRenderAt = 0;
    this.renderInterval = 1000 / 12;
    this.cageHalfWidth = 5.8;
    this.floorY = -1.26;
    this.projectionMode = projectionMode === 'orthographic' ? 'orthographic' : 'perspective';
    this.labOptions = { ...LAB_DEFAULTS, ...(labOptions ?? {}) };
    this.labEnabled = Boolean(this.labOptions.enabled);
    this.labUniformsById = new Map();
    this.blobById = new Map();
    this.labOwnedMaterials = new Set();
    this.floorTexture = null;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x11130f);

    this.perspectiveCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.orthographicCamera = new THREE.OrthographicCamera(-5.8, 5.8, 5.8, -5.8, 0.1, 100);
    this.#configureTopDownCameras();
    this.camera = this.projectionMode === 'orthographic' ? this.orthographicCamera : this.perspectiveCamera;

    this.ambient = new THREE.AmbientLight(0xd8d1b9, this.labEnabled ? 0.82 : 1.16);
    this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight(0xffffff, this.labEnabled ? 1.55 : 1.35);
    this.sun.position.set(4, 10, 5);
    this.scene.add(this.sun);

    this.floorMaterial = new THREE.MeshLambertMaterial({ color: 0x1a1d17, flatShading: true });
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(11.6, 11.6),
      this.floorMaterial,
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = this.floorY;
    this.scene.add(this.floor);

    this.grid = new THREE.GridHelper(11.6, 12, 0x42483b, 0x282c24);
    this.grid.position.y = this.floorY + 0.015;
    this.scene.add(this.grid);

    this.blobGeometry = new THREE.CircleGeometry(0.56, 12);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'default',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(1);

    this.#applyLabEnvironment();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(stage);
    this.resize();
  }

  #configureTopDownCameras() {
    const W = this.cageHalfWidth;
    const fovRad = THREE.MathUtils.degToRad(this.perspectiveCamera.fov / 2);
    const distance = W / Math.tan(fovRad);

    this.perspectiveCamera.position.set(0, this.floorY + distance, 0);
    this.perspectiveCamera.up.set(0, 0, -1);
    this.perspectiveCamera.lookAt(0, this.floorY, 0);
    this.perspectiveCamera.updateProjectionMatrix();

    this.orthographicCamera.position.set(0, this.floorY + 20, 0);
    this.orthographicCamera.up.set(0, 0, -1);
    this.orthographicCamera.lookAt(0, this.floorY, 0);
    this.orthographicCamera.updateProjectionMatrix();
  }

  #ditherValue() {
    if (this.labOptions.dither === 'ordered') return 1;
    if (this.labOptions.dither === 'halftone') return 2;
    if (this.labOptions.dither === 'hybrid') return 3;
    return 0;
  }

  #applyFloor() {
    if (this.floorTexture) {
      this.floorTexture.dispose();
      this.floorTexture = null;
    }
    this.floorTexture = makeFloorTexture(this.labOptions.floor);
    this.floorMaterial.map = this.floorTexture;
    this.floorMaterial.color.set(this.floorTexture ? 0xffffff : 0x1a1d17);
    this.floorMaterial.needsUpdate = true;
    this.grid.visible = !this.floorTexture;
  }

  #applyShadowMode() {
    const real = this.labEnabled && this.labOptions.shadow === 'real';
    const blob = this.labEnabled && this.labOptions.shadow === 'blob';
    this.renderer.shadowMap.enabled = real;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.sun.castShadow = real;
    this.sun.shadow.mapSize.set(128, 128);
    this.sun.shadow.camera.left = -6.4;
    this.sun.shadow.camera.right = 6.4;
    this.sun.shadow.camera.top = 6.4;
    this.sun.shadow.camera.bottom = -6.4;
    this.sun.shadow.camera.near = 0.1;
    this.sun.shadow.camera.far = 24;
    this.sun.shadow.bias = -0.002;
    this.floor.receiveShadow = real;

    for (const record of this.records) {
      const group = this.meshById.get(record.id);
      const body = group?.children?.[0];
      if (body) body.castShadow = real;
      const blobMesh = this.blobById.get(record.id);
      if (blobMesh) blobMesh.visible = blob;
    }
    this.renderer.shadowMap.needsUpdate = true;
  }

  #applyLabEnvironment() {
    if (!this.labEnabled) {
      this.scene.fog = null;
      this.#applyFloor();
      this.#applyShadowMode();
      return;
    }
    this.ambient.intensity = 0.82;
    this.sun.intensity = 1.55;
    this.scene.fog = this.labOptions.fog === 'low'
      ? new THREE.Fog(0x11130f, 8.5, 17.5)
      : null;
    this.#applyFloor();
    this.#applyShadowMode();
  }

  #makeLabUniforms(record) {
    const bodyUniforms = {
      wobble: { value: this.labOptions.wobble === 'low' ? 1 : 0 },
      snap: { value: record?.frozen ? 920 : 260 },
      dither: { value: this.#ditherValue() },
    };
    const markingUniforms = {
      wobble: { value: this.labOptions.wobble === 'low' ? 1 : 0 },
      snap: { value: record?.frozen ? 980 : 290 },
    };
    return { bodyUniforms, markingUniforms };
  }

  #makeBlob(record) {
    if (!this.labEnabled || this.blobById.has(record.id)) return;
    const material = new THREE.MeshBasicMaterial({
      color: 0x080a07,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const blob = new THREE.Mesh(this.blobGeometry, material);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = this.floorY + 0.022;
    blob.renderOrder = 1;
    blob.visible = this.labOptions.shadow === 'blob';
    this.scene.add(blob);
    this.blobById.set(record.id, blob);
    this.labOwnedMaterials.add(material);
  }

  setLabOptions(next = {}) {
    if (!this.labEnabled) return { ...this.labOptions };
    this.labOptions = { ...this.labOptions, ...next, enabled: true };
    this.#applyLabEnvironment();

    for (const [id, uniforms] of this.labUniformsById.entries()) {
      const record = this.records.find((item) => item.id === id);
      uniforms.bodyUniforms.wobble.value = this.labOptions.wobble === 'low' ? 1 : 0;
      uniforms.bodyUniforms.dither.value = this.#ditherValue();
      uniforms.markingUniforms.wobble.value = this.labOptions.wobble === 'low' ? 1 : 0;
      if (record) {
        uniforms.bodyUniforms.snap.value = record.frozen ? 920 : 260;
        uniforms.markingUniforms.snap.value = record.frozen ? 980 : 290;
      }
      const blob = this.blobById.get(id);
      if (blob) blob.visible = this.labOptions.shadow === 'blob';
    }

    this.lastRenderAt = 0;
    this.render(this.records, performance.now(), true);
    return { ...this.labOptions };
  }

  getLabOptions() {
    return { ...this.labOptions };
  }

  resize() {
    const rect = this.stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const internalWidth = this.internalWidth;
    const internalHeight = Math.max(1, Math.round(internalWidth * rect.height / rect.width));
    this.renderer.setSize(internalWidth, internalHeight, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';

    const aspect = rect.width / rect.height;
    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();

    const W = this.cageHalfWidth;
    this.orthographicCamera.left = -W * aspect;
    this.orthographicCamera.right = W * aspect;
    this.orthographicCamera.top = W;
    this.orthographicCamera.bottom = -W;
    this.orthographicCamera.updateProjectionMatrix();
    this.lastRenderAt = 0;
  }

  setProjectionMode(mode) {
    this.projectionMode = mode === 'orthographic' ? 'orthographic' : 'perspective';
    this.camera = this.projectionMode === 'orthographic' ? this.orthographicCamera : this.perspectiveCamera;
    this.lastRenderAt = 0;
    this.render(this.records, performance.now(), true);
    return this.projectionMode;
  }

  getProjectionMode() {
    return this.projectionMode;
  }

  setPhysicalCount() {
    // P0 camera contract: the cage is the frame. Do not zoom per die count.
    this.#configureTopDownCameras();
    this.resize();
  }

  reset() {
    for (const mesh of this.meshById.values()) this.scene.remove(mesh);
    this.meshById.clear();
    for (const blob of this.blobById.values()) this.scene.remove(blob);
    this.blobById.clear();
    this.labUniformsById.clear();
    this.records = [];
    this.lastRenderAt = 0;
    this.renderer.render(this.scene, this.camera);
  }

  addRecord(record) {
    const group = new THREE.Group();
    const material = new THREE.MeshLambertMaterial({ color: record.entry.color, flatShading: true });
    const bodyMesh = new THREE.Mesh(record.entry.visualGeometry, material);
    const cacheKey = record.entry.key;
    let edgeGeometry = this.edgeGeometryCache.get(cacheKey);
    if (!edgeGeometry) {
      edgeGeometry = new THREE.EdgesGeometry(record.entry.visualGeometry);
      this.edgeGeometryCache.set(cacheKey, edgeGeometry);
    }
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x26291f, transparent: true, opacity: 0.74 });
    const edgeMesh = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    bodyMesh.add(edgeMesh);
    group.add(bodyMesh);

    const markingMesh = this.faceMarkings.getMesh(record);

    if (this.labEnabled) {
      // Lab baseline: warm ivory body. Per-die material art direction happens in M6.2B.
      material.color.set(0xd1c5a2);
      const uniforms = this.#makeLabUniforms(record);
      applyLabBodyShader(material, uniforms.bodyUniforms);
      applyVertexSnap(edgeMaterial, uniforms.bodyUniforms);

      // FaceMarkingFactory caches its material; clone it so the lab can alter
      // vertex projection without mutating the product renderer.
      markingMesh.material = markingMesh.material.clone();
      applyVertexSnap(markingMesh.material, uniforms.markingUniforms);
      this.labOwnedMaterials.add(markingMesh.material);
      this.labUniformsById.set(record.id, uniforms);
      bodyMesh.castShadow = this.labOptions.shadow === 'real';
      this.#makeBlob(record);
    }

    group.add(markingMesh);
    this.scene.add(group);
    this.meshById.set(record.id, group);
    record.renderMesh = group;
    this.records.push(record);
  }

  sync(records = this.records) {
    records.forEach((record) => {
      const mesh = this.meshById.get(record.id);
      if (!mesh) return;
      mesh.position.copy(record.body.position);
      mesh.quaternion.copy(record.body.quaternion);

      if (this.labEnabled) {
        const uniforms = this.labUniformsById.get(record.id);
        if (uniforms) {
          const resting = Boolean(record.frozen);
          uniforms.bodyUniforms.snap.value = resting ? 920 : 260;
          uniforms.markingUniforms.snap.value = resting ? 980 : 290;
        }

        const popHidden = this.labOptions.popIn === 'low' && record.body.position.y > 3.82;
        mesh.visible = !popHidden;

        const blob = this.blobById.get(record.id);
        if (blob) {
          const height = Math.max(0, record.body.position.y - this.floorY);
          blob.position.x = record.body.position.x;
          blob.position.z = record.body.position.z;
          const scale = THREE.MathUtils.clamp(0.82 + height * 0.045, 0.82, 1.15);
          blob.scale.setScalar(scale);
          blob.material.opacity = THREE.MathUtils.clamp(0.34 - height * 0.035, 0.08, 0.30);
          blob.visible = !popHidden && this.labOptions.shadow === 'blob';
        }
      }
    });
  }

  render(records = this.records, now = performance.now(), force = false) {
    if (!force && now - this.lastRenderAt < this.renderInterval) return;
    this.sync(records);
    this.renderer.render(this.scene, this.camera);
    this.lastRenderAt = now;
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.reset();
    for (const geometry of this.edgeGeometryCache.values()) geometry.dispose();
    this.edgeGeometryCache.clear();
    for (const material of this.labOwnedMaterials) material.dispose();
    this.labOwnedMaterials.clear();
    if (this.floorTexture) this.floorTexture.dispose();
    this.floor.geometry.dispose();
    this.floorMaterial.dispose();
    this.blobGeometry.dispose();
    this.faceMarkings.dispose();
    this.renderer.dispose();
  }
}
