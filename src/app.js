import { SessionState } from './state/session-state.js';
import { renderHome } from './views/home.js';
import { renderDiceMode } from './views/dice.js';

const root = document.getElementById('app');
const state = new SessionState();

function showHome() {
  state.setMode('home');
  root.className = 'app-shell home-view';
  renderHome(root, {
    onDice() {
      showDice();
    },
  });
}

function showDice() {
  state.setMode('dice');
  root.className = 'app-shell function-view';
  renderDiceMode(root, {
    state,
    onHome: showHome,
  });
}

showHome();
