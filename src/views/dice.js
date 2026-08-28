import { DiceEngine } from '../dice/engine.js';
import { GeometryRegistry, PUBLIC_DIE_TYPES } from '../dice/geometry-registry.js';

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

function renderHistory(history) {
  if (!history.length) return '<p class="history-empty">本次 session 尚無紀錄。</p>';
  return history.map((entry, index) => {
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

export function renderDiceMode(container, { state, onHome }) {
  let engine = null;
  let rolling = false;

  const leaveMode = () => {
    if (rolling) return;
    if (engine) {
      engine.dispose();
      engine = null;
    }
    state.clearDiceMode();
    onHome();
  };

  const renderSetup = () => {
    if (engine) {
      engine.dispose();
      engine = null;
    }

    const rows = PUBLIC_DIE_TYPES.map((type) => `
      <div class="die-counter" data-type="${type}">
        <div class="die-counter-label">
          <strong>${typeLabel(type)}</strong>
          <span>${type === 'd100' ? '2 physical dice' : '1 physical die'}</span>
        </div>
        <div class="stepper">
          <button type="button" data-action="minus" aria-label="減少 ${typeLabel(type)}">−</button>
          <output>${state.diceCounts[type]}</output>
          <button type="button" data-action="plus" aria-label="增加 ${typeLabel(type)}">＋</button>
        </div>
      </div>`).join('');

    const physicalCount = physicalCountForCounts(state.diceCounts);
    const logicalCount = Object.values(state.diceCounts).reduce((a, b) => a + b, 0);

    container.innerHTML = `
      <header class="mode-header">
        <div><span class="eyebrow">MODE 01</span><h1>骰子</h1></div>
        <button type="button" class="text-button danger" id="leave-mode">清除並離開</button>
      </header>

      <section class="function-panel">
        <p class="section-code">DICE POOL SETUP</p>
        <div class="die-counter-list" id="die-counter-list">${rows}</div>
        <div class="pool-meter">
          <span>LOGICAL ${logicalCount}</span>
          <span>PHYSICAL ${physicalCount} / ${PHYSICAL_LIMIT}</span>
        </div>
        <p class="microcopy">D100 會以兩顆 D10 組成。單次正式測試上限為 50 個物理骰體。</p>
      </section>

      <button type="button" class="primary-action" id="confirm-pool" ${physicalCount === 0 ? 'disabled' : ''}>CONFIRM / 確認骰池</button>

      <section class="history-block">
        <p class="section-code">SESSION HISTORY / ${state.history.length} OF 20</p>
        ${renderHistory(state.history)}
      </section>
    `;

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
        <button type="button" class="text-button" id="back-setup">返回設定</button>
      </header>

      <section class="roll-summary">
        <span>POOL</span><strong>${poolText(pool)}</strong><small>${physicalCount} PHYSICAL BODIES</small>
      </section>

      <section class="dice-stage" id="dice-stage" aria-label="3D 骰子物理舞台">
        <canvas id="dice-canvas"></canvas>
        <div class="dither-layer" aria-hidden="true"></div>
        <div class="stage-hopper" aria-hidden="true">DICE IN</div>
        <div class="stage-badge" id="stage-badge">READY / ${physicalCount} BODIES</div>
      </section>

      <button type="button" class="primary-action roll-action" id="roll-button">ROLL</button>
      <div id="result-region" aria-live="polite"></div>
    `;

    const back = container.querySelector('#back-setup');
    const rollButton = container.querySelector('#roll-button');
    const badge = container.querySelector('#stage-badge');
    const resultRegion = container.querySelector('#result-region');
    const canvas = container.querySelector('#dice-canvas');
    const stage = container.querySelector('#dice-stage');

    engine = new DiceEngine({ canvas, stage });

    back.addEventListener('click', () => {
      if (rolling) return;
      renderSetup();
    });

    rollButton.addEventListener('click', async () => {
      if (rolling) return;
      rolling = true;
      back.disabled = true;
      rollButton.disabled = true;
      rollButton.textContent = 'ROLLING…';
      resultRegion.innerHTML = '';

      try {
        const result = await engine.roll({
          pool,
          onProgress(progress) {
            badge.textContent = `${progress.phase} / IN ${progress.spawned}/${progress.physicalCount} / FIX ${progress.frozen}`;
          },
        });

        badge.textContent = 'DONE / PHYSICAL POSE RESOLVED';
        state.pushHistory({
          kind: 'dice',
          pool: pool.map((item) => ({ ...item })),
          poolLabel: poolText(pool),
          result,
          timestamp: Date.now(),
        });

        resultRegion.innerHTML = `
          <section class="result-panel">
            <p class="section-code">ROLL RESULT / PHYSICAL FACE RESOLUTION</p>
            <div class="result-dice-list">${resultRows(result)}</div>
            <div class="total-line"><span>TOTAL</span><strong>${result.total}</strong></div>
            <p class="microcopy">結果在所有骰體停止／hard finalize 後，才由最終姿態讀取；沒有預抽指定面。</p>
            <button type="button" class="secondary-action" id="result-back">返回設定</button>
          </section>`;
        rollButton.hidden = true;
        resultRegion.querySelector('#result-back').addEventListener('click', () => {
          rolling = false;
          renderSetup();
        });
      } catch (error) {
        rolling = false;
        back.disabled = false;
        rollButton.disabled = false;
        rollButton.textContent = 'ROLL';
        badge.textContent = 'ERROR';
        resultRegion.innerHTML = `<p class="error-box">${error.message}</p>`;
      }
    });
  };

  renderSetup();
}
