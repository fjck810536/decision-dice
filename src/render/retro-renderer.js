import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import { FaceMarkingFactory } from './face-markings.js';

export class RetroRenderer {
  constructor({ canvas, stage, internalWidth = 360, inspectionMode = false, projectionMode = 'perspective' }) {
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

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x11130f);

    this.perspectiveCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.orthographicCamera = new THREE.OrthographicCamera(-5.8, 5.8, 5.8, -5.8, 0.1, 100);
    this.#configureTopDownCameras();
    this.camera = this.projectionMode === 'orthographic' ? this.orthographicCamera : this.perspectiveCamera;

    this.scene.add(new THREE.AmbientLight(0xd8d1b9, 1.16));
    const sun = new THREE.DirectionalLight(0xffffff, 1.35);
    sun.position.set(4, 10, 5);
    this.scene.add(sun);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(11.6, 11.6),
      new THREE.MeshLambertMaterial({ color: 0x1a1d17, flatShading: true }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = this.floorY;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(11.6, 12, 0x42483b, 0x282c24);
    grid.position.y = this.floorY + 0.015;
    this.scene.add(grid);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'default',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(1);

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
    bodyMesh.add(new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineBasicMaterial({ color: 0x26291f, transparent: true, opacity: 0.74 }),
    ));
    group.add(bodyMesh);
    group.add(this.faceMarkings.getMesh(record));

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
    this.faceMarkings.dispose();
    this.renderer.dispose();
  }
}
