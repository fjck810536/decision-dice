import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

const DICE_GROUP = 1;
const ENV_GROUP = 2;

export class PhysicsWorld {
  constructor({ onCollision = null } = {}) {
    this.onCollision = typeof onCollision === 'function' ? onCollision : null;
    this.cage = {
      halfWidth: 5.8,
      floorY: -1.45,
      ceilingY: 7.4,
      slab: 2.5,
    };
    this.reset();
  }

  reset() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -12, 0) });
    this.world.allowSleep = true;
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.solver.iterations = 10;
    this.world.solver.tolerance = 0.001;

    this.dieMaterial = new CANNON.Material('die');
    this.envMaterial = new CANNON.Material('env');

    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.dieMaterial,
      this.envMaterial,
      {
        friction: 0.44,
        restitution: 0.26,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 4,
      },
    ));

    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.dieMaterial,
      this.dieMaterial,
      {
        friction: 0.30,
        restitution: 0.23,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 4,
      },
    ));

    this.#buildCage();
  }

  #addEnvironment(shape, position) {
    const body = new CANNON.Body({
      mass: 0,
      shape,
      material: this.envMaterial,
      collisionFilterGroup: ENV_GROUP,
      collisionFilterMask: DICE_GROUP,
    });
    body.position.copy(position);
    this.world.addBody(body);
    return body;
  }

  #buildCage() {
    const { halfWidth: W, floorY, ceilingY, slab: T } = this.cage;
    const span = W + T * 2;
    const midY = (floorY + ceilingY) / 2;
    const halfH = (ceilingY - floorY) / 2 + T * 2;

    this.#addEnvironment(
      new CANNON.Box(new CANNON.Vec3(span, T, span)),
      new CANNON.Vec3(0, floorY - T, 0),
    );
    this.#addEnvironment(
      new CANNON.Box(new CANNON.Vec3(span, T, span)),
      new CANNON.Vec3(0, ceilingY + T, 0),
    );
    this.#addEnvironment(
      new CANNON.Box(new CANNON.Vec3(T, halfH, span)),
      new CANNON.Vec3(-(W + T), midY, 0),
    );
    this.#addEnvironment(
      new CANNON.Box(new CANNON.Vec3(T, halfH, span)),
      new CANNON.Vec3(W + T, midY, 0),
    );
    this.#addEnvironment(
      new CANNON.Box(new CANNON.Vec3(span, halfH, T)),
      new CANNON.Vec3(0, midY, -(W + T)),
    );
    this.#addEnvironment(
      new CANNON.Box(new CANNON.Vec3(span, halfH, T)),
      new CANNON.Vec3(0, midY, W + T),
    );
  }

  createDynamicBody(entry, spawn, meta = {}) {
    const body = new CANNON.Body({
      mass: 1,
      shape: entry.createShape(),
      material: this.dieMaterial,
      linearDamping: 0.07,
      angularDamping: 0.08,
      allowSleep: true,
      sleepSpeedLimit: 0.16,
      sleepTimeLimit: 0.26,
      collisionFilterGroup: DICE_GROUP,
      collisionFilterMask: DICE_GROUP | ENV_GROUP,
    });

    body.position.set(spawn.position.x, spawn.position.y, spawn.position.z);
    body.quaternion.copy(spawn.quaternion);
    body.velocity.set(spawn.velocity.x, spawn.velocity.y, spawn.velocity.z);
    body.angularVelocity.set(spawn.angularVelocity.x, spawn.angularVelocity.y, spawn.angularVelocity.z);

    if (this.onCollision) {
      body.addEventListener('collide', (event) => {
        let impact = 0;
        try {
          impact = Math.abs(event.contact?.getImpactVelocityAlongNormal?.() ?? 0);
        } catch {
          impact = body.velocity.length();
        }
        this.onCollision({
          impact,
          physicalId: meta.physicalId,
          logicalType: meta.logicalType,
        });
      });
    }

    this.world.addBody(body);

    return {
      id: meta.physicalId,
      logicalId: meta.logicalId,
      logicalType: meta.logicalType,
      componentRole: meta.componentRole ?? null,
      entry,
      body,
      radius: entry.radius,
      frozen: false,
      frozenBy: null,
      targetFaceId: null,
      renderMesh: null,
    };
  }

  freezeRecord(record, frozenBy) {
    if (!record || record.frozen) return record;
    const oldBody = record.body;
    const fixed = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      shape: record.entry.createShape(),
      material: this.dieMaterial,
      collisionFilterGroup: DICE_GROUP,
      collisionFilterMask: DICE_GROUP | ENV_GROUP,
    });
    fixed.position.copy(oldBody.position);
    fixed.quaternion.copy(oldBody.quaternion);
    this.world.removeBody(oldBody);
    this.world.addBody(fixed);
    this.world.broadphase.dirty = true;
    record.body = fixed;
    record.frozen = true;
    record.frozenBy = frozenBy;
    return record;
  }

  step(dt) {
    this.world.step(1 / 60, Math.min(0.05, Math.max(0, dt)), 3);
  }

  isOutsideInnerBounds(record, margin = 0.4) {
    const { halfWidth: W, floorY, ceilingY } = this.cage;
    const p = record.body.position;
    return Math.abs(p.x) > W + margin
      || Math.abs(p.z) > W + margin
      || p.y < floorY - margin
      || p.y > ceilingY + margin;
  }
}

export { CANNON, DICE_GROUP, ENV_GROUP };
