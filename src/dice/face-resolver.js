import { CANNON } from './physics-world.js';

const WORLD_UP = new CANNON.Vec3(0, 1, 0);

export class FaceResolver {
  #getExtremeFace(record, pickBottom = false) {
    let best = null;
    let bestDot = pickBottom ? Infinity : -Infinity;
    const worldNormal = new CANNON.Vec3();

    for (const face of record.entry.faces) {
      const local = new CANNON.Vec3(face.normal[0], face.normal[1], face.normal[2]);
      record.body.quaternion.vmult(local, worldNormal);
      const dot = worldNormal.dot(WORLD_UP);
      const better = pickBottom ? dot < bestDot : dot > bestDot;
      if (better) {
        bestDot = dot;
        best = face;
      }
    }

    return {
      face: best,
      alignment: pickBottom ? -bestDot : bestDot,
    };
  }

  getTopFace(record) {
    return this.#getExtremeFace(record, false);
  }

  getBottomFace(record) {
    return this.#getExtremeFace(record, true);
  }

  getResultFace(record) {
    // Traditional tetrahedral d4s are read from the upper vertex, not from a
    // single upper face. A stable pose has one face flat on the floor and the
    // opposite vertex on top, so the bottom face is the unambiguous 1–4 result
    // carrier. Every other die keeps the existing top-face contract.
    if (record.entry.key === 'd4') return this.getBottomFace(record);
    return this.getTopFace(record);
  }

  resolve(record) {
    const { face, alignment } = this.getResultFace(record);
    if (!face) throw new Error(`No resolvable face for ${record.id}`);
    return {
      faceId: face.id,
      value: face.value,
      label: face.label,
      alignment,
    };
  }
}
