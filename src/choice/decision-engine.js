const DICE_CANDIDATES = [
  { die: 'd3', sides: 3 },
  { die: 'd4', sides: 4 },
  { die: 'd6', sides: 6 },
  { die: 'd8', sides: 8 },
  { die: 'd10', sides: 10 },
  { die: 'd20', sides: 20 },
];

const SLOT_THRESHOLD = 0.70;

function assertChoiceCount(choiceCount) {
  const count = Math.floor(Number(choiceCount));
  if (!Number.isFinite(count) || count < 2) throw new Error('選項數量至少要 2。');
  return count;
}

function rejectedOutcomes(validMax, sides) {
  const out = [];
  for (let value = validMax + 1; value <= sides; value += 1) out.push(value);
  return out;
}

function buildDiceCandidate(choiceCount, candidate) {
  if (candidate.sides < choiceCount) return null;
  const groupSize = Math.floor(candidate.sides / choiceCount);
  if (groupSize < 1) return null;
  const validMax = groupSize * choiceCount;
  return {
    die: candidate.die,
    sides: candidate.sides,
    groupSize,
    validRange: [1, validMax],
    rejectedOutcomes: rejectedOutcomes(validMax, candidate.sides),
    efficiency: validMax / candidate.sides,
  };
}

export class DecisionEngine {
  constructor({ slotThreshold = SLOT_THRESHOLD } = {}) {
    this.slotThreshold = slotThreshold;
  }

  getDicePlan(choiceCount) {
    const count = assertChoiceCount(choiceCount);
    const candidates = DICE_CANDIDATES
      .map((candidate) => buildDiceCandidate(count, candidate))
      .filter(Boolean)
      .sort((a, b) => (b.efficiency - a.efficiency) || (a.sides - b.sides));

    if (!candidates.length) return null;
    return { choiceCount: count, ...candidates[0] };
  }

  buildPlan(choiceCount, methodOverride = null) {
    const count = assertChoiceCount(choiceCount);
    const dice = this.getDicePlan(count);
    const recommended = dice && dice.efficiency >= this.slotThreshold ? 'dice' : 'slot';
    const method = methodOverride === 'dice' || methodOverride === 'slot'
      ? methodOverride
      : recommended;

    return {
      choiceCount: count,
      method,
      recommended,
      dice,
      efficiency: dice?.efficiency ?? 0,
    };
  }

  resolveDiceRoll(plan, rawValue) {
    if (!plan?.dice) throw new Error('DecisionPlan 沒有骰子方案。');
    const raw = Math.floor(Number(rawValue));
    if (!Number.isFinite(raw) || raw < 1 || raw > plan.dice.sides) {
      throw new Error(`無效的 ${plan.dice.die.toUpperCase()} 結果：${rawValue}`);
    }

    if (raw > plan.dice.validRange[1]) {
      return {
        accepted: false,
        raw,
        mappedIndex: null,
      };
    }

    const mappedIndex = Math.floor((raw - 1) / plan.dice.groupSize) + 1;
    return {
      accepted: true,
      raw,
      mappedIndex,
    };
  }

  drawSlotIndex(choiceCount) {
    const count = assertChoiceCount(choiceCount);
    const maxUint = 0x100000000;
    const limit = Math.floor(maxUint / count) * count;
    const array = new Uint32Array(1);

    do {
      crypto.getRandomValues(array);
    } while (array[0] >= limit);

    return (array[0] % count) + 1;
  }
}

export { DICE_CANDIDATES, SLOT_THRESHOLD };
