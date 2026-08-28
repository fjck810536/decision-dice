import { DiceEngine } from '../dice/engine.js';
import { GeometryRegistry, PUBLIC_DIE_TYPES } from '../dice/geometry-registry.js';
import { compactDiceValues, playResultSequence } from '../result/result-sequencer.js';

const registry = new GeometryRegistry();
const PHYSICAL_LIMIT = 50;

function typeLabel(type) {
  return type.toUpperCase();
}

function poolText(pool) {
  return pool.map((item) => `${item.count}${item.type}`).join(' + ');
}

function physicalCountForCounts(counts) {
  return registry.getPhysicalCount(
    Object.entries(counts).map(([type, count]) => ({ type, count })),
  );
}

function stageProgress(progress) {
  if (String(progress.phase).startsWith('FEEDING')) {
    return `ROLL / ${progress.spawned} OF ${progress.physicalCount}`;
  }
  return `SETTLE / ${progress.frozen} OF ${progress.physicalCount}`;
}

function renderHistory(history) {
  const entries = history.filter((entry) => entry.kind === 'dice');
  if (!entries.length) return '<p class="history-empty">本次 session 尚無骰子紀錄。</p>';
  return entries.map((entry, index) => {
    const values = entry.result.dice.map((die) => `${die.type}:${die.value}`).join(' / ');
    return `
      <details class="history-item" ${index === 0 ? 'open' : ''}>
        <summary><span>${entry.poolLabel}</span><strong>TOTAL ${entry.result.total}</strong></summary>
        <div class="history-detail">${values}</div>
      </details>`;
  }).join('');
}

function resultRows(result) {
  return result.dice.map((die, index) => {
    let component = '';
    if (die.type === 'd100' && die.componentResults) {
      const tens = String(die.componentResults[0].displayValue).padStart(2, '0');
      const ones = die.componentResults[1].displayValue;
      component = `<small>${tens} + ${ones}</small>`;
    }
    return `
      <div class="result-die">
        <span>${die.type.toUpperCase()} #${index + 1}</span>
        ${component}
        <strong>${die.value}</strong>
      </div>`;
  }).join('');
}

export function renderDiceMode(container, { state, onHome, onChoice }) {
  let engine = null;
  let rolling = false;

  const disposeEngine = () => {
    if (engine) {
      engine.dispose();
      engine = null;
    }
  };

  const switchChoice = () => {
    if (rolling) return;
    disposeEngine();
    onChoice();
  };

  const leaveMode = () => {
    if (rolling) return;
    disposeEngine();
    state.clearDiceMode();
    onHome();
  };

  const renderSetup = () => {
    disposeEngine();

    const rows = PUBLIC_DIE_TYPES.map((type) => `
      <div class="die-counter" data-type="${type}">
        <div class="die-counter-label">
          <strong>${typeLabel(type)}</strong>
          <span>${type === 'd100' ? 'PERCENTILE / 2 BODY' : 'PHYSICAL DIE / 1 BODY'}</span>
        </div>
        <div class="stepper">
          <button type="button" data-action="minus" aria-label="減少 ${typeLabel(type)}">−</button>
          <output>${state.diceCounts[type]}</output>
          <button type="button" data-action="plus" aria-label="增加 ${typeLabel(type)}">＋</button>
        </div>
      </div>`).join('');

    const physicalCount = physicalCountForCounts(state.diceCounts);
    const logicalCount = Object.values(state.diceCounts).reduce((a, b) => a + b, 0);
    const diceHistory = state.history.filter((entry) => entry.kind === 'dice');

    container.innerHTML = `
      <header class="mode-header">
        <div><span class="eyebrow">MODE 01 / DICE</span><h1>骰子</h1></div>
        <div class="mode-actions">
          <button type="button" class="text-button" id="switch-choice">切換至選擇</button>
          <button type="button" class="text-button danger" id="leave-mode">清除並離開</button>
        </div>
      </header>

      <section class="function-panel">
        <p class="section-code">DICE POOL</p>
        <div class="die-counter-list" id="die-counter-list">${rows}</div>
        <div class="pool-meter">
          <span>DICE ${logicalCount}</span>
          <span>BODY ${physicalCount} / ${PHYSICAL_LIMIT}</span>
        </div>
        <p class="microcopy">D100 由兩顆 D10 組成。單次最多 50 個物理骰體。</p>
      </section>

      <button type="button" class="primary-action" id="confirm-pool" ${physicalCount === 0 ? 'disabled' : ''}>確認骰池 / ARM</button>

      <section class="history-block">
        <p class="section-code">HISTORY / ${diceHistory.length} OF 20</p>
        ${renderHistory(state.history)}
      </section>
    `;

    container.querySelector('#switch-choice').addEventListener('click', switchChoice);
    container.querySelector('#leave-mode').addEventListener('click', leaveMode);
    const confirm = container.querySelector('#confirm-pool');

    container.querySelector('#die-counter-list').addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const row = button.closest('.die-counter');
      const type = row.dataset.type;
      const current = state.diceCounts[type];
      let next = current + (button.dataset.action === 'plus' ? 1 : -1);
      next = Math.max(0, next);

      const candidate = { ...state.diceCounts, [type]: next };
      if (physicalCountForCounts(candidate) > PHYSICAL_LIMIT) return;
      state.setDieCount(type, next);
      renderSetup();
    });

    confirm.addEventListener('click', () => {
      const pool = state.getDicePool();
      if (!pool.length) return;
      renderRollStage(pool);
    });
  };

  const renderRollStage = (pool) => {
    const physicalCount = registry.getPhysicalCount(pool);
    container.innerHTML = `
      <header class="mode-header">
        <div><span class="eyebrow">MODE 01 / ARMED</span><h1>骰子</h1></div>
        <div class="mode-actions">
          <button type="button" class="text-button" id="switch-choice">切換至選擇</button>
          <button type="button" class="text-button" id="back-setup">修改骰池</button>
        </div>
      </header>

      <section class="roll-summary">
        <span>POOL</span><strong>${poolText(pool)}</strong><small>${physicalCount} PHYSICAL BODY</small>
      </section>

      <section class="dice-stage" id="dice-stage" aria-label="3D 骰子物理舞台">
        <canvas id="dice-canvas"></canvas>
        <div class="dither-layer" aria-hidden="true"></div>
        <div class="stage-hopper" aria-hidden="true">PHYSICAL DICE</div>
        <div class="stage-badge" id="stage-badge">READY / ${physicalCount} BODY</div>
      </section>

      <button type="button" class="primary-action roll-action" id="roll-button">ROLL</button>
      <div id="result-region" aria-live="polite"></div>
    `;

    const back = container.querySelector('#back-setup');
    const switchButton = container.querySelector('#switch-choice');
    const rollButton = container.querySelector('#roll-button');
    const badge = container.querySelector('#stage-badge');
    const resultRegion = container.querySelector('#result-region');
    const canvas = container.querySelector('#dice-canvas');
    const stage = container.querySelector('#dice-stage');

    engine = new DiceEngine({ canvas, stage });

    switchButton.addEventListener('click', switchChoice);
    back.addEventListener('click', () => {
      if (rolling) return;
      renderSetup();
    });

    rollButton.addEventListener('click', async () => {
      if (rolling) return;
      rolling = true;
      back.disabled = true;
      switchButton.disabled = true;
      rollButton.disabled = true;
      rollButton.textContent = 'ROLLING…';
      resultRegion.innerHTML = '';

      try {
        const result = await engine.roll({
          pool,
          onProgress(progress) {
            badge.textContent = stageProgress(progress);
          },
        });

        badge.textContent = 'LOCKED / FACE RESOLVED';
        state.pushHistory({
          kind: 'dice',
          pool: pool.map((item) => ({ ...item })),
          poolLabel: poolText(pool),
          result,
          timestamp: Date.now(),
        });

        rollButton.hidden = true;
        await playResultSequence({
          target: resultRegion,
          title: 'ROLL RESULT',
          holdMs: result.dice.length > 6 ? 220 : 340,
          steps: [
            { label: 'STATUS', value: 'LOCKED' },
            { label: 'DICE', value: compactDiceValues(result) },
            { label: 'TOTAL', value: result.total, tone: 'final' },
          ],
        });

        resultRegion.innerHTML = `
          <section class="result-panel">
            <p class="section-code">DETAIL / FINAL FACE</p>
            <div class="result-dice-list">${resultRows(result)}</div>
            <div class="total-line"><span>TOTAL</span><strong>${result.total}</strong></div>
            <p class="microcopy">最終值只由落定後的實體骰面讀取。</p>
            <button type="button" class="secondary-action" id="result-back">返回骰池</button>
          </section>`;
        resultRegion.querySelector('#result-back').addEventListener('click', () => {
          rolling = false;
          renderSetup();
        });
      } catch (error) {
        rolling = false;
        back.disabled = false;
        switchButton.disabled = false;
        rollButton.disabled = false;
        rollButton.hidden = false;
        rollButton.textContent = 'ROLL';
        badge.textContent = 'ERROR';
        resultRegion.innerHTML = `<p class="error-box">${error.message}</p>`;
      }
    });
  };

  renderSetup();
}
