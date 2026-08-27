import { PUBLIC_DIE_TYPES } from '../dice/geometry-registry.js';

export class SessionState {
  constructor() {
    this.mode = 'home';
    this.diceCounts = Object.fromEntries(PUBLIC_DIE_TYPES.map((type) => [type, type === 'd6' ? 1 : 0]));
    this.history = [];
  }

  setMode(mode) {
    this.mode = mode;
  }

  setDieCount(type, count) {
    if (!(type in this.diceCounts)) return;
    this.diceCounts[type] = Math.max(0, Math.floor(Number(count) || 0));
  }

  getDicePool() {
    return Object.entries(this.diceCounts)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({ type, count }));
  }

  clearDiceMode() {
    Object.keys(this.diceCounts).forEach((type) => { this.diceCounts[type] = 0; });
    this.diceCounts.d6 = 1;
  }

  pushHistory(entry) {
    this.history.unshift(entry);
    this.history = this.history.slice(0, 20);
  }
}
