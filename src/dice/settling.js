import { CANNON } from './physics-world.js';

const WORLD_UP = new CANNON.Vec3(0, 1, 0);

export class SettlingController {
  constructor({ physicsWorld, faceResolver }) {
    this.physicsWorld = physicsWorld;
    this.faceResolver = faceResolver;
    this.naturalWindow = 0.25;
    this.hardDeadline = 4.5;
  }

  reset(records) {
    records.forEach((record) => {
      record.targetFaceId = null;
    });
  }

  #getFaceById(record, faceId) {
    return record.entry.faces.find((face) => face.id === faceId) ?? null;
  }

  #lockTarget(record) {
    const { face } = this.faceResolver.getTopFace(record);
    if (face) record.targetFaceId = face.id;
    return face;
  }

  #targetInfo(record) {
    const face = this.#getFaceById(record, record.targetFaceId) ?? this.#lockTarget(record);
    if (!face) return null;
    const local = new CANNON.Vec3(face.normal[0], face.normal[1], face.normal[2]);
    const world = new CANNON.Vec3();
    record.body.quaternion.vmult(local, world);
    return { face, normal: world, dot: world.dot(WORLD_UP) };
  }

  update(records, afterFeedSeconds) {
    if (afterFeedSeconds <= this.naturalWindow) {
      return { done: false, phase: 'POST-FEED / NATURAL' };
    }

    const t = afterFeedSeconds - this.naturalWindow;
    const assist = 1 - Math.pow(0.5, t / 0.125);

    for (const record of records) {
      if (record.frozen) continue;
      const body = record.body;

      if (body.sleepState === CANNON.Body.SLEEPING) {
        this.physicsWorld.freezeRecord(record, 'sleep');
        continue;
      }

      if (!record.targetFaceId) this.#lockTarget(record);
      body.linearDamping = 0.07 + assist * 0.28;
      body.angularDamping = 0.08 + assist * 0.42;

      const speed = body.velocity.length();
      const spin = body.angularVelocity.length();
      const top = this.#targetInfo(record);

      if (top && speed < 2.0 && spin < 4.8) {
        const axis = top.normal.cross(WORLD_UP);
        if (axis.lengthSquared() > 1e-8) {
          axis.normalize();
          const angle = Math.acos(Math.max(-1, Math.min(1, top.dot)));
          const k = 3.0 * assist * angle;
          body.torque.x += axis.x * k;
          body.torque.y += axis.y * k;
          body.torque.z += axis.z * k;
        }
        body.torque.x -= body.angularVelocity.x * (0.88 * assist);
        body.torque.y -= body.angularVelocity.y * (0.88 * assist);
        body.torque.z -= body.angularVelocity.z * (0.88 * assist);
      }

      if (top && t > 0.30 && top.dot > 0.965 && speed < 0.32 && spin < 0.48) {
        this.physicsWorld.freezeRecord(record, 'stable');
        continue;
      }
      if (top && t > 0.95 && top.dot > 0.93 && speed < 0.50 && spin < 0.75) {
        this.physicsWorld.freezeRecord(record, 'relaxed');
        continue;
      }
      if (t > 1.65 && speed < 0.72 && spin < 1.0) {
        this.physicsWorld.freezeRecord(record, 'late');
      }
    }

    if (afterFeedSeconds >= this.hardDeadline) {
      records.forEach((record) => {
        if (!record.frozen) this.physicsWorld.freezeRecord(record, 'deadline');
      });
    }

    const frozenCount = records.filter((record) => record.frozen).length;
    return {
      done: records.length > 0 && frozenCount === records.length,
      phase: afterFeedSeconds >= this.hardDeadline ? 'HARD FINALIZE' : 'SETTLING / PER-DIE FREEZE',
      frozenCount,
    };
  }
}
