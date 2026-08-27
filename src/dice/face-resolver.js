import { CANNON } from './physics-world.js';

const WORLD_UP = new CANNON.Vec3(0, 1, 0);

export class FaceResolver {
  getTopFace(record) {
    let best = null;
    let bestDot = -Infinity;
    const worldNormal = new CANNON.Vec3();

    for (const face of record.entry.faces) {
      const local = new CANNON.Vec3(face.normal[0], face.normal[1], face.normal[2]);
      record.body.quaternion.vmult(local, worldNormal);
      const dot = worldNormal.dot(WORLD_UP);
      if (dot > bestDot) {
        bestDot = dot;
        best = face;
      }
    }

    return {
      face: best,
      alignment: bestDot,
    };
  }

  resolve(record) {
    const { face, alignment } = this.getTopFace(record);
    if (!face) throw new Error(`No resolvable face for ${record.id}`);
    return {
      faceId: face.id,
      value: face.value,
      label: face.label,
      alignment,
    };
  }
}
