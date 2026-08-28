import { SessionState } from './state/session-state.js';
import { renderHome } from './views/home.js';
import { audioEngine } from './audio/audio-engine.js';
import { mountSystemControls } from './ui/system-controls.js';

const root = document.getElementById('app');
const state = new SessionState();

let navigationToken = 0;
let diceModulePromise = null;
let choiceModulePromise = null;
let systemControls = null;

function showHome() {
  navigationToken += 1;
  state.setMode('home');
  systemControls?.closeSettings();
  systemControls?.sync();
  root.className = 'app-shell home-view';
  renderHome(root, {
    onDice: showDice,
    onChoice: showChoice,
  });
}

function renderModeLoading(label, token, note = '正在載入功能模組。首頁本身不等待 3D / physics。') {
  root.className = 'app-shell function-view';
  root.innerHTML = `
    <header class="mode-header">
      <div><span class="eyebrow">MODULE LOAD</span><h1>${label}</h1></div>
      <button type="button" class="text-button" id="loading-home">HOME</button>
    </header>
    <section class="function-panel" aria-live="polite">
      <p class="section-code">LOADING FUNCTION MODULE…</p>
      <p class="microcopy">${note}</p>
    </section>
  `;
  root.querySelector('#loading-home').addEventListener('click', () => {
    if (token === navigationToken) showHome();
  });
}

function renderModeError(label, token, error, retry) {
  if (token !== navigationToken) return;
  root.className = 'app-shell function-view';
  root.innerHTML = `
    <header class="mode-header">
      <div><span class="eyebrow">MODULE ERROR</span><h1>${label}</h1></div>
      <button type="button" class="text-button" id="error-home">HOME</button>
    </header>
    <p class="error-box">${label.toUpperCase()} MODULE LOAD FAILED<br>${error?.message ?? 'Unknown module error'}</p>
  `;
  root.querySelector('#error-home').addEventListener('click', showHome);
  retry();
}

async function showDice() {
  const token = ++navigationToken;
  state.setMode('dice');
  systemControls?.closeSettings();
  systemControls?.sync();
  renderModeLoading('骰子', token, '正在載入 DiceEngine / Three.js / cannon-es。首頁不等待 physics。');

  try {
    diceModulePromise ??= import('./views/dice.js');
    const { renderDiceMode } = await diceModulePromise;
    if (token !== navigationToken) return;

    root.className = 'app-shell function-view';
    renderDiceMode(root, {
      state,
      onHome: showHome,
      onChoice: showChoice,
    });
  } catch (error) {
    renderModeError('骰子', token, error, () => { diceModulePromise = null; });
  }
}

async function showChoice() {
  const token = ++navigationToken;
  state.setMode('choice');
  systemControls?.closeSettings();
  systemControls?.sync();
  renderModeLoading('選擇', token, '正在載入 DecisionEngine。若使用 SLOT，不會載入 DiceEngine；選 DICE 並按 ROLL 後才載入 physics。');

  try {
    choiceModulePromise ??= import('./views/choice.js');
    const { renderChoiceMode } = await choiceModulePromise;
    if (token !== navigationToken) return;

    root.className = 'app-shell function-view';
    renderChoiceMode(root, {
      state,
      onHome: showHome,
      onDice: showDice,
    });
  } catch (error) {
    renderModeError('選擇', token, error, () => { choiceModulePromise = null; });
  }
}

systemControls = mountSystemControls({
  state,
  audioEngine,
  onRefreshMode(mode) {
    if (mode === 'dice') showDice();
    else if (mode === 'choice') showChoice();
  },
});

showHome();
