import { DiceEngine } from '../dice/engine.js';
import { GeometryRegistry, PUBLIC_DIE_TYPES } from '../dice/geometry-registry.js';
import {
  clearSettlement,
  openDetailsSheet,
  playDiceSettlement,
} from '../result/settlement-presenter.js';

const registry = new GeometryRegistry();
const PHYSICAL_LIMIT = 50;
const DICE_MODIFIER_UI_LIMIT = 99;

function typeLabel(type) {
  return type.toUpperCase();
}

function poolText(pool) {
  return pool.map((item) => `${item.count}${item.type}`).join(' + ');
}

function formatModifier(value) {
  const number = Math.trunc(Number(value) || 0);
  return `${number >= 0 ? '+' : ''}${number}`;
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
    const modifier = Number(entry.result?.modifier) || 0;
    const modifierText = modifier ? ` / MOD ${formatModifier(modifier)}` : '';
    return `
      <details class="history-item" ${index === 0 ? 'open' : ''}>
        <summary><span>${entry.poolLabel}${modifierText}</span><strong>TOTAL ${entry.result.total}</strong></summary>
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
        <span>調整值</span><strong>${formatModifier(modifier)}</strong>
      </div>
      <div class="total-line"><span>TOTAL</span><strong>${total}</strong></div>
      <p class="microcopy">骰面先落定，再套用調整值；詳細資料不會改變已完成的結算。</p>
    </section>`;
}

export function renderDiceMode(container, { state, onHome, onChoice }) {
  let engine = null;
  let rolling = false;
  let projectionMode = 'perspective';
  let setupPanel = 'standard';

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
    container.classList.add('dice-setup-active');

    const moduleMarkup = (type, index) => {
      const count = state.diceCounts[type];
      const description = type === 'd100' ? 'PERCENTILE / 2 BODY' : 'PHYSICAL DIE / 1 BODY';
      return `
        <div class="die-counter dice-module ${count > 0 ? 'is-loaded' : ''}" data-type="${type}" data-count="${count}">
          <div class="dice-module-head">
            <div class="die-counter-label">
              <strong>${typeLabel(type)}</strong>
              <span>${description}</span>
            </div>
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
    };

    const standardTypes = PUBLIC_DIE_TYPES.filter((type) => type !== 'd100');
    const standardRows = standardTypes.map((type, index) => moduleMarkup(type, index)).join('');
    const d100Index = Math.max(0, PUBLIC_DIE_TYPES.indexOf('d100'));
    const d100Row = moduleMarkup('d100', d100Index);
    const physicalCount = physicalCountForCounts(state.diceCounts);
    const diceHistory = state.history.filter((entry) => entry.kind === 'dice');

    container.innerHTML = `
      <header class="mode-header">
        <div><span class="eyebrow">MODE 01 / DICE</span><h1>骰子</h1></div>
        <div class="mode-actions">
          <button type="button" class="text-button" id="switch-choice">切換至選擇</button>
        </div>
      </header>

      <nav class="dice-setup-tabs" aria-label="骰子設定區">
        <button type="button" data-setup-panel="standard" class="${setupPanel === 'standard' ? 'active' : ''}" aria-selected="${setupPanel === 'standard'}">
          <span>選骰子</span><strong>3～20</strong>
        </button>
        <button type="button" data-setup-panel="percentile" class="${setupPanel === 'percentile' ? 'active' : ''}" aria-selected="${setupPanel === 'percentile'}">
          <span>選骰子</span><strong>100</strong>
        </button>
        <button type="button" data-setup-panel="modifier" class="${setupPanel === 'modifier' ? 'active' : ''}" aria-selected="${setupPanel === 'modifier'}">
          <span>調整值</span><strong id="modifier-tab-value">${formatModifier(state.diceModifier)}</strong>
        </button>
      </nav>

      <section class="dice-setup-workspace">
        <section class="dice-setup-panel" data-panel="standard" ${setupPanel === 'standard' ? '' : 'hidden'}>
          <div class="die-counter-list dice-rack" data-dice-rack>${standardRows}</div>
        </section>

        <section class="dice-setup-panel dice-setup-panel--percentile" data-panel="percentile" ${setupPanel === 'percentile' ? '' : 'hidden'}>
          <div class="die-counter-list dice-rack dice-rack-single" data-dice-rack>${d100Row}</div>
        </section>

        <section class="dice-setup-panel dice-setup-panel--modifier" data-panel="modifier" ${setupPanel === 'modifier' ? '' : 'hidden'}>
          <div class="dice-modifier-bay">
            <div class="dice-modifier-head">
              <span>調整值</span>
              <small>目前 ±${DICE_MODIFIER_UI_LIMIT} / SYSTEM ±9999</small>
            </div>
            <div class="dice-modifier-control">
              <button type="button" data-modifier-delta="-1" aria-label="調整值減一">−</button>
              <input id="dice-modifier-input" type="number" inputmode="numeric" min="-${DICE_MODIFIER_UI_LIMIT}" max="${DICE_MODIFIER_UI_LIMIT}" value="${state.diceModifier}" aria-label="骰子調整值">
              <button type="button" data-modifier-delta="1" aria-label="調整值加一">＋</button>
            </div>
            <div class="dice-modifier-shortcuts" aria-label="快速調整">
              <button type="button" data-modifier-delta="-10">−10</button>
              <button type="button" data-modifier-value="0">RESET</button>
              <button type="button" data-modifier-delta="10">＋10</button>
            </div>
          </div>
        </section>
      </section>

      <div class="pool-meter dice-rack-meter">
        <span>BODY <strong id="dice-rack-physical">${physicalCount}</strong> / ${PHYSICAL_LIMIT}</span>
      </div>

      <section class="history-block">
        <p class="section-code">HISTORY / ${diceHistory.length} OF 20</p>
        ${renderHistory(state.history)}
      </section>

      <div class="dice-setup-lockbar" aria-label="骰子設定確認列">
        <div class="dice-setup-sum">
          <span>加總</span>
          <strong id="dice-setup-modifier-summary">${formatModifier(state.diceModifier)}</strong>
          <small id="dice-setup-pool-summary">${poolText(state.getDicePool()).toUpperCase() || 'NO DICE'} · ${physicalCount} BODY</small>
        </div>
        <button type="button" class="primary-action" id="confirm-pool" ${physicalCount === 0 ? 'disabled' : ''}>確認</button>
      </div>
    `;

    const tabs = [...container.querySelectorAll('.dice-setup-tabs button[data-setup-panel]')];
    const panels = [...container.querySelectorAll('.dice-setup-panel[data-panel]')];
    const confirm = container.querySelector('#confirm-pool');
    const physicalMeter = container.querySelector('#dice-rack-physical');
    const modifierTabValue = container.querySelector('#modifier-tab-value');
    const modifierSummary = container.querySelector('#dice-setup-modifier-summary');
    const poolSummary = container.querySelector('#dice-setup-pool-summary');
    const modifierInput = container.querySelector('#dice-modifier-input');

    void import('../render/dice-preview.js')
      .then(({ hydrateDicePreviews }) => {
        container.querySelectorAll('[data-dice-rack]').forEach((rack) => hydrateDicePreviews(rack));
      })
      .catch(() => {});

    container.querySelector('#switch-choice').addEventListener('click', switchChoice);

    const activatePanel = (name) => {
      setupPanel = name;
      tabs.forEach((tab) => {
        const active = tab.dataset.setupPanel === name;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.panel !== name;
      });
    };

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => activatePanel(tab.dataset.setupPanel));
    });

    const syncSetupSummary = () => {
      const nextPhysicalCount = physicalCountForCounts(state.diceCounts);
      const pool = state.getDicePool();
      physicalMeter.textContent = String(nextPhysicalCount);
      modifierTabValue.textContent = formatModifier(state.diceModifier);
      modifierSummary.textContent = formatModifier(state.diceModifier);
      poolSummary.textContent = `${poolText(pool).toUpperCase() || 'NO DICE'} · ${nextPhysicalCount} BODY`;
      confirm.disabled = nextPhysicalCount === 0;
    };

    container.querySelector('.dice-setup-workspace').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const row = button.closest('.die-counter');
      if (!row) return;
      const type = row.dataset.type;
      const current = state.diceCounts[type];
      let next = current + (button.dataset.action === 'plus' ? 1 : -1);
      next = Math.max(0, next);

      const candidate = { ...state.diceCounts, [type]: next };
      const nextPhysicalCount = physicalCountForCounts(candidate);
      if (nextPhysicalCount > PHYSICAL_LIMIT) return;

      state.setDieCount(type, next);
      row.dataset.count = String(next);
      row.classList.toggle('is-loaded', next > 0);
      row.querySelector('output').textContent = String(next);
      syncSetupSummary();
    });

    const setUiModifier = (value) => {
      const next = Math.max(-DICE_MODIFIER_UI_LIMIT, Math.min(DICE_MODIFIER_UI_LIMIT, Math.trunc(Number(value) || 0)));
      state.setDiceModifier(next);
      modifierInput.value = String(next);
      syncSetupSummary();
    };

    container.querySelector('.dice-modifier-bay').addEventListener('click', (event) => {
      const deltaButton = event.target.closest('button[data-modifier-delta]');
      const valueButton = event.target.closest('button[data-modifier-value]');
      if (deltaButton) {
        setUiModifier(state.diceModifier + Number(deltaButton.dataset.modifierDelta));
      } else if (valueButton) {
        setUiModifier(Number(valueButton.dataset.modifierValue));
      }
    });

    modifierInput.addEventListener('change', () => setUiModifier(modifierInput.value));
    modifierInput.addEventListener('blur', () => setUiModifier(modifierInput.value));

    confirm.addEventListener('click', () => {
      const pool = state.getDicePool();
      if (!pool.length) return;
      renderRollStage(pool);
    });
  };

  const renderRollStage = (pool) => {
    container.classList.remove('dice-setup-active');
    const physicalCount = registry.getPhysicalCount(pool);
    const modifier = Number(state.diceModifier) || 0;
    container.innerHTML = `
      <header class="mode-header">
        <div><span class="eyebrow">MODE 01 / ARMED</span><h1>骰子</h1></div>
        <div class="mode-actions">
          <button type="button" class="text-button" id="switch-choice">切換至選擇</button>
        </div>
      </header>

      <section class="roll-summary">
        <span>POOL</span><strong>${poolText(pool)}</strong><small>${physicalCount} PHYSICAL BODY · MOD ${formatModifier(modifier)}</small>
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
        const physicsResult = await engine.roll({
          pool,
          onProgress(progress) {
            badge.textContent = stageProgress(progress);
          },
        });
        const subtotal = Number(physicsResult.total) || 0;
        const result = {
          ...physicsResult,
          subtotal,
          modifier,
          total: subtotal + modifier,
        };

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
