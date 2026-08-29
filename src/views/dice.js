import { DiceEngine } from '../dice/engine.js';
import { GeometryRegistry, PUBLIC_DIE_TYPES } from '../dice/geometry-registry.js';
import {
  clearSettlement,
  openDetailsSheet,
  playDiceSettlement,
} from '../result/settlement-presenter.js';

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

function diceMath(result) {
  const hasExplicitSubtotal = Number.isFinite(Number(result?.subtotal));
  const subtotal = hasExplicitSubtotal ? Number(result.subtotal) : Number(result?.total ?? 0);
  const modifier = Number.isFinite(Number(result?.modifier)) ? Number(result.modifier) : 0;
  const total = hasExplicitSubtotal
    ? (Number.isFinite(Number(result?.total)) ? Number(result.total) : subtotal + modifier)
    : subtotal + modifier;
  return { subtotal, modifier, total };
}

function diceDetailMarkup(result) {
  const { subtotal, modifier, total } = diceMath(result);
  return `
    <section class="result-panel">
      <p class="section-code">FINAL FACE / PROVENANCE</p>
      <div class="result-dice-list">${resultRows(result)}</div>
      <div class="choice-provenance">
        <span>骰子</span><strong>${subtotal}</strong>
        <span>修正</span><strong>${modifier >= 0 ? '+' : ''}${modifier}</strong>
      </div>
      <div class="total-line"><span>TOTAL</span><strong>${total}</strong></div>
      <p class="microcopy">最終值只由落定後的實體骰面讀取。詳細資料不會改變已完成的結算。</p>
    </section>`;
}

export function renderDiceMode(container, { state, onHome, onChoice }) {
  let engine = null;
  let rolling = false;
  let projectionMode = 'perspective';

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

  const renderSetup = () => {
    disposeEngine();

    const rows = PUBLIC_DIE_TYPES.map((type, index) => {
      const count = state.diceCounts[type];
      const description = type === 'd100' ? 'PERCENTILE / 2 BODY' : 'PHYSICAL DIE / 1 BODY';
      return `
        <div class="die-counter dice-module ${count > 0 ? 'is-loaded' : ''}" data-type="${type}" data-count="${count}">
          <div class="dice-module-head">
            <div class="die-counter-label">
              <strong>${typeLabel(type)}</strong>
              <span>${description}</span>
            </div>
            <span class="dice-module-state" aria-hidden="true">${count > 0 ? 'LOADED' : 'STANDBY'}</span>
          </div>

          <div class="dice-module-window" aria-hidden="true">
            <span class="dice-module-preview">
              <span class="die-preview-slot" data-die-preview="${type}" data-preview-variant="${index % 3}" data-preview-cycle="1"></span>
            </span>
          </div>

          <div class="stepper dice-module-stepper" aria-label="${typeLabel(type)} 數量">
            <button type="button" data-action="minus" aria-label="減少 ${typeLabel(type)}">−</button>
            <output aria-live="polite">${count}</output>
            <button type="button" data-action="plus" aria-label="增加 ${typeLabel(type)}">＋</button>
          </div>
        </div>`;
    }).join('');

    const physicalCount = physicalCountForCounts(state.diceCounts);
    const logicalCount = Object.values(state.diceCounts).reduce((a, b) => a + b, 0);
    const diceHistory = state.history.filter((entry) => entry.kind === 'dice');

    container.innerHTML = `
      <header class="mode-header">
        <div><span class="eyebrow">MODE 01 / DICE</span><h1>骰子</h1></div>
        <div class="mode-actions">
          <button type="button" class="text-button" id="switch-choice">切換至選擇</button>
        </div>
      </header>

      <section class="function-panel dice-rack-panel">
        <div class="dice-rack-heading">
          <p class="section-code">DICE RACK / LOADOUT</p>
          <span class="dice-rack-state">${logicalCount ? 'LOADED' : 'EMPTY'}</span>
        </div>
        <div class="die-counter-list dice-rack" id="die-counter-list">${rows}</div>
        <div class="pool-meter dice-rack-meter">
          <span>LOGICAL <strong>${logicalCount}</strong></span>
          <span>BODY <strong>${physicalCount}</strong> / ${PHYSICAL_LIMIT}</span>
        </div>
        <p class="microcopy">選擇要裝進物理運算室的骰子。D100 會佔用兩個實體骰體。</p>
      </section>

      <button type="button" class="primary-action dice-arm-action" id="confirm-pool" ${physicalCount === 0 ? 'disabled' : ''}>ARM DICE CHAMBER</button>

      <section class="history-block">
        <p class="section-code">HISTORY / ${diceHistory.length} OF 20</p>
        ${renderHistory(state.history)}
      </section>
    `;

    const rack = container.querySelector('.dice-rack');
    void import('../render/dice-preview.js')
      .then(({ hydrateDicePreviews }) => hydrateDicePreviews(rack))
      .catch(() => {});

    container.querySelector('#switch-choice').addEventListener('click', switchChoice);
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
        <div class="projection-ab" aria-label="鏡頭投影比較">
          <button type="button" data-projection="perspective" class="${projectionMode === 'perspective' ? 'active' : ''}">PERSPECTIVE</button>
          <button type="button" data-projection="orthographic" class="${projectionMode === 'orthographic' ? 'active' : ''}">ORTHO</button>
        </div>
        <div id="dice-settlement" class="settlement-overlay" hidden aria-live="polite"></div>
      </section>

      <div class="roll-control-row">
        <button type="button" class="primary-action roll-action" id="roll-button">ROLL</button>
        <button type="button" class="secondary-action" id="back-setup">修改骰池</button>
      </div>
      <div id="roll-error" aria-live="polite"></div>
    `;

    const back = container.querySelector('#back-setup');
    const switchButton = container.querySelector('#switch-choice');
    const rollButton = container.querySelector('#roll-button');
    const badge = container.querySelector('#stage-badge');
    const settlement = container.querySelector('#dice-settlement');
    const errorRegion = container.querySelector('#roll-error');
    const canvas = container.querySelector('#dice-canvas');
    const stage = container.querySelector('#dice-stage');
    const projectionControls = container.querySelector('.projection-ab');

    engine = new DiceEngine({ canvas, stage, rendererOptions: { projectionMode } });

    const syncProjectionButtons = () => {
      projectionControls.querySelectorAll('button[data-projection]').forEach((button) => {
        button.classList.toggle('active', button.dataset.projection === projectionMode);
      });
    };

    projectionControls.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-projection]');
      if (!button) return;
      projectionMode = engine.setProjectionMode(button.dataset.projection);
      syncProjectionButtons();
    });

    switchButton.addEventListener('click', switchChoice);
    back.addEventListener('click', () => {
      if (rolling) return;
      renderSetup();
    });

    rollButton.addEventListener('click', async () => {
      if (rolling) return;
      rolling = true;
      clearSettlement(settlement);
      errorRegion.innerHTML = '';
      back.disabled = true;
      switchButton.disabled = true;
      rollButton.disabled = true;
      badge.textContent = `ROLL / 0 OF ${physicalCount}`;

      try {
        const result = await engine.roll({
          pool,
          onProgress(progress) {
            badge.textContent = stageProgress(progress);
          },
        });

        badge.textContent = 'LOCKED';
        state.pushHistory({
          kind: 'dice',
          pool: pool.map((item) => ({ ...item })),
          poolLabel: poolText(pool),
          result,
          timestamp: Date.now(),
        });

        await playDiceSettlement({
          host: settlement,
          result,
          onDetails() {
            openDetailsSheet({ title: '骰子詳細資料', html: diceDetailMarkup(result) });
          },
        });

        rolling = false;
        back.disabled = false;
        switchButton.disabled = false;
        rollButton.disabled = false;
        badge.textContent = 'READY / RESULT LOCKED';
      } catch (error) {
        rolling = false;
        back.disabled = false;
        switchButton.disabled = false;
        rollButton.disabled = false;
        badge.textContent = 'ERROR';
        errorRegion.innerHTML = `<p class="error-box">${error.message}</p>`;
      }
    });
  };

  renderSetup();
}
