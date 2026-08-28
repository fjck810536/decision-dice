import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import { FaceMarkingFactory } from './face-markings.js';

export class RetroRenderer {
  constructor({ canvas, stage }) {
    this.canvas = canvas;
    this.stage = stage;
    this.records = [];
    this.meshById = new Map();
    this.edgeGeometryCache = new Map();
    this.faceMarkings = new FaceMarkingFactory();
    this.lastRenderAt = 0;
    this.renderInterval = 1000 / 12;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x11130f);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 7.3, 10.8);
    this.camera.lookAt(0, 0.9, 0);

    this.scene.add(new THREE.AmbientLight(0xd8d1b9, 1.16));
    const sun = new THREE.DirectionalLight(0xffffff, 1.35);
    sun.position.set(4, 10, 5);
    this.scene.add(sun);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(11.6, 11.6),
      new THREE.MeshLambertMaterial({ color: 0x1a1d17, flatShading: true }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.26;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(11.6, 12, 0x42483b, 0x282c24);
    grid.position.y = -1.245;
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

  resize() {
    const rect = this.stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const internalWidth = 240;
    const internalHeight = Math.max(1, Math.round(internalWidth * rect.height / rect.width));
    this.renderer.setSize(internalWidth, internalHeight, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.lastRenderAt = 0;
  }

  setPhysicalCount(count) {
    if (count <= 10) {
      this.camera.position.set(0, 7.3, 10.8);
    } else if (count <= 20) {
      this.camera.position.set(0, 8.2, 12.5);
    } else {
      this.camera.position.set(0, 9.6, 15.4);
    }
    this.camera.lookAt(0, 0.75, 0);
    this.camera.updateProjectionMatrix();
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
