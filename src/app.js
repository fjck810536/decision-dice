import { SessionState } from './state/session-state.js';
import { renderHome } from './views/home.js';

const root = document.getElementById('app');
const state = new SessionState();

let navigationToken = 0;
let diceModulePromise = null;

function showHome() {
  navigationToken += 1;
  state.setMode('home');
  root.className = 'app-shell home-view';
  renderHome(root, {
    onDice() {
      showDice();
    },
  });
}

function renderModeLoading(label, token) {
  root.className = 'app-shell function-view';
  root.innerHTML = `
    <header class="mode-header">
      <div><span class="eyebrow">MODULE LOAD</span><h1>${label}</h1></div>
      <button type="button" class="text-button" id="loading-home">HOME</button>
    </header>
    <section class="function-panel" aria-live="polite">
      <p class="section-code">LOADING FUNCTION MODULE…</p>
      <p class="microcopy">正在載入 3D / physics 模組。首頁本身不等待 DiceEngine、Three.js 或 cannon-es。</p>
    </section>
  `;
  root.querySelector('#loading-home').addEventListener('click', () => {
    if (token === navigationToken) showHome();
  });
}

async function showDice() {
  const token = ++navigationToken;
  state.setMode('dice');
  renderModeLoading('骰子', token);

  try {
    diceModulePromise ??= import('./views/dice.js');
    const { renderDiceMode } = await diceModulePromise;
    if (token !== navigationToken) return;

    root.className = 'app-shell function-view';
    renderDiceMode(root, {
      state,
      onHome: showHome,
    });
  } catch (error) {
    if (token !== navigationToken) return;
    root.className = 'app-shell function-view';
    root.innerHTML = `
      <header class="mode-header">
        <div><span class="eyebrow">MODULE ERROR</span><h1>骰子</h1></div>
        <button type="button" class="text-button" id="error-home">HOME</button>
      </header>
      <p class="error-box">DICE MODULE LOAD FAILED<br>${error?.message ?? 'Unknown module error'}</p>
    `;
    root.querySelector('#error-home').addEventListener('click', showHome);
    diceModulePromise = null;
  }
}

showHome();
