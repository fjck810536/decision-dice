function clonePose(body) {
  return {
    position: { x: body.position.x, y: body.position.y, z: body.position.z },
    quaternion: { x: body.quaternion.x, y: body.quaternion.y, z: body.quaternion.z, w: body.quaternion.w },
  };
}

export function assembleRollResult({ logicalDice, records, faceResolver, startedAt, completedAt }) {
  const byLogicalId = new Map();
  records.forEach((record) => {
    const list = byLogicalId.get(record.logicalId) ?? [];
    list.push(record);
    byLogicalId.set(record.logicalId, list);
  });

  const dice = logicalDice.map((logical) => {
    const components = byLogicalId.get(logical.logicalId) ?? [];

    if (logical.type === 'd100') {
      const tensRecord = components.find((record) => record.componentRole === 'tens');
      const onesRecord = components.find((record) => record.componentRole === 'ones');
      if (!tensRecord || !onesRecord) throw new Error(`Incomplete d100: ${logical.logicalId}`);
      const tensFace = faceResolver.resolve(tensRecord);
      const onesFace = faceResolver.resolve(onesRecord);
      const tens = tensFace.value * 10;
      const ones = onesFace.value;
      const value = tens === 0 && ones === 0 ? 100 : tens + ones;
      return {
        dieId: logical.logicalId,
        type: 'd100',
        value,
        componentResults: [
          { role: 'tens', digit: tensFace.value, displayValue: tens, faceId: tensFace.faceId, alignment: tensFace.alignment, finalPose: clonePose(tensRecord.body), frozenBy: tensRecord.frozenBy },
          { role: 'ones', digit: onesFace.value, displayValue: ones, faceId: onesFace.faceId, alignment: onesFace.alignment, finalPose: clonePose(onesRecord.body), frozenBy: onesRecord.frozenBy },
        ],
        finalPose: null,
        frozenBy: [tensRecord.frozenBy, onesRecord.frozenBy],
      };
    }

    const record = components[0];
    if (!record) throw new Error(`Missing physical die: ${logical.logicalId}`);
    const face = faceResolver.resolve(record);
    return {
      dieId: logical.logicalId,
      type: logical.type,
      value: face.value,
      componentResults: null,
      finalPose: clonePose(record.body),
      frozenBy: record.frozenBy,
      faceId: face.faceId,
      alignment: face.alignment,
    };
  });

  return {
    dice,
    total: dice.reduce((sum, die) => sum + die.value, 0),
    startedAt,
    completedAt,
  };
}
