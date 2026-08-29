import { SessionState } from './state/session-state.js';
import { renderHome } from './views/home.js';
import { audioEngine } from './audio/audio-engine.js';
import { mountSystemControls } from './ui/system-controls.js';
import { installDoubleTapZoomGuard } from './ui/mobile-gesture-guard.js';

installDoubleTapZoomGuard();

const root = document.getElementById('app');
const bootLoader = document.getElementById('boot-loader');
const state = new SessionState();
const bootStartedAt = performance.now();
const MIN_BOOT_MS = 560;

let navigationToken = 0;
let diceModulePromise = null;
let choiceModulePromise = null;
let systemControls = null;

function dismissBootLoader() {
  if (!bootLoader || bootLoader.dataset.dismissed === '1') return;
  bootLoader.dataset.dismissed = '1';
  const wait = Math.max(0, MIN_BOOT_MS - (performance.now() - bootStartedAt));
  window.setTimeout(() => {
    bootLoader.classList.add('is-leaving');
    window.setTimeout(() => bootLoader.remove(), 170);
  }, wait);
}

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
  dismissBootLoader();
}

function renderModeLoading(label, token, note = '正在載入功能模組。首頁本身不等待 3D / physics。') {
  root.className = 'app-shell function-view';
  root.innerHTML = `
    <header class="mode-header">
      <div><span class="eyebrow">MODULE LOAD</span><h1>${label}</h1></div>
      <button type="button" class="text-button" id="loading-home">HOME</button>
    </header>
    <section class="module-loader" aria-live="polite">
      <div class="module-loader-inner">
        <div class="boot-d20" aria-hidden="true"></div>
        <div class="module-loader-copy">
          <strong>LOADING FUNCTION MODULE</strong>
          <span>${note}</span>
        </div>
      </div>
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
  renderModeLoading('骰子', token, '正在載入 DiceEngine / Three.js / cannon-es。');

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
  renderModeLoading('選擇', token, '正在載入 DecisionEngine。SLOT 本身不等待 DiceEngine。');

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
  onHome: showHome,
  onRefreshMode(mode) {
    if (mode === 'dice') showDice();
    else if (mode === 'choice') showChoice();
  },
});

showHome();
