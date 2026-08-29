import { PUBLIC_DIE_TYPES } from '../dice/public-types.js';

const DICE_MODIFIER_LIMIT = 9999;

export class SessionState {
  constructor() {
    this.mode = 'home';
    this.diceCounts = Object.fromEntries(PUBLIC_DIE_TYPES.map((type) => [type, type === 'd6' ? 1 : 0]));
    this.diceModifier = 0;
    this.choiceCount = 3;
    this.choiceLabels = {};
    this.choiceMethodOverride = null;
    this.history = [];
  }

  setMode(mode) {
    this.mode = mode;
  }

  setDieCount(type, count) {
    if (!(type in this.diceCounts)) return;
    this.diceCounts[type] = Math.max(0, Math.floor(Number(count) || 0));
  }

  setDiceModifier(value) {
    const next = Math.trunc(Number(value) || 0);
    this.diceModifier = Math.max(-DICE_MODIFIER_LIMIT, Math.min(DICE_MODIFIER_LIMIT, next));
  }

  getDicePool() {
    return Object.entries(this.diceCounts)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({ type, count }));
  }

  clearDiceMode() {
    Object.keys(this.diceCounts).forEach((type) => { this.diceCounts[type] = 0; });
    this.diceCounts.d6 = 1;
    this.diceModifier = 0;
  }

  setChoiceCount(count) {
    const next = Math.max(2, Math.floor(Number(count) || 2));
    this.choiceCount = next;
  }

  setChoiceLabel(index, label) {
    const key = String(Math.max(1, Math.floor(Number(index) || 1)));
    this.choiceLabels[key] = String(label ?? '');
  }

  getChoiceLabel(index) {
    return this.choiceLabels[String(index)] ?? '';
  }

  setChoiceMethodOverride(method) {
    this.choiceMethodOverride = method === 'dice' || method === 'slot' ? method : null;
  }

  clearChoiceMode() {
    this.choiceCount = 3;
    this.choiceLabels = {};
    this.choiceMethodOverride = null;
  }

  pushHistory(entry) {
    this.history.unshift(entry);
    this.history = this.history.slice(0, 20);
  }
}
