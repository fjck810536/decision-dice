import { CANNON } from './physics-world.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class DiceFeeder {
  constructor({ physicsWorld, registry }) {
    this.physicsWorld = physicsWorld;
    this.registry = registry;
    this.reset();
  }

  reset() {
    this.units = [];
    this.records = [];
    this.nextIndex = 0;
    this.startedAt = 0;
    this.lastSpawnAt = 0;
    this.nextSpawnAt = 0;
    this.defers = 0;
  }

  start(units, now = performance.now()) {
    this.reset();
    this.units = units.slice();
    this.startedAt = now;
    this.lastSpawnAt = now;
    this.nextSpawnAt = now;
  }

  get done() {
    return this.nextIndex >= this.units.length;
  }

  get spawnedCount() {
    return this.records.length;
  }

  nextGap() {
    return Math.random() < 0.08 ? rand(65, 95) : rand(22, 50);
  }

  #candidatePosition() {
    return {
      x: rand(-3.45, 3.45),
      y: 4.45,
      z: rand(-0.55, 0.55),
    };
  }

  #isClear(position, radius) {
    for (const record of this.records) {
      const p = record.body.position;
      if (p.y < 3.25) continue;
      const dx = p.x - position.x;
      const dz = p.z - position.z;
      const dy = (p.y - position.y) * 0.65;
      const clearance = radius + record.radius + 0.10;
      if (Math.hypot(dx, dz, dy) < clearance) return false;
    }
    return true;
  }

  #findPosition(radius) {
    for (let attempt = 0; attempt < 9; attempt += 1) {
      const position = this.#candidatePosition();
      if (this.#isClear(position, radius)) return position;
    }
    return null;
  }

  #randomQuaternion() {
    const q = new CANNON.Quaternion();
    q.setFromEuler(
      rand(0, Math.PI * 2),
      rand(0, Math.PI * 2),
      rand(0, Math.PI * 2),
      'XYZ',
    );
    return q;
  }

  #spawn(unit, entry) {
    const angularVelocity = new CANNON.Vec3(rand(-9, 9), rand(-9, 9), rand(-9, 9));
    if (angularVelocity.length() < 5) {
      angularVelocity.set(rand(5, 9), rand(-9, -5), rand(5, 9));
    }

    const position = this.#findPosition(entry.radius);
    if (!position) return null;

    return this.physicsWorld.createDynamicBody(entry, {
      position,
      quaternion: this.#randomQuaternion(),
      velocity: { x: rand(-0.85, 0.85), y: rand(-5.8, -4.6), z: rand(-0.85, 0.85) },
      angularVelocity,
    }, unit);
  }

  update(now = performance.now()) {
    if (this.done || now < this.nextSpawnAt) return null;

    const unit = this.units[this.nextIndex];
    const entry = this.registry.getPhysicalEntry(unit.logicalType, unit.componentRole);
    const record = this.#spawn(unit, entry);

    if (!record) {
      this.defers += 1;
      this.nextSpawnAt = now + 22;
      return null;
    }

    this.records.push(record);
    this.nextIndex += 1;
    this.lastSpawnAt = now;
    this.nextSpawnAt = now + this.nextGap();
    return record;
  }
}
