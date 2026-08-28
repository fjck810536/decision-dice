import { DecisionEngine } from '../choice/decision-engine.js';
import { animateSlot } from '../choice/slot-presenter.js';
import {
  clearSettlement,
  escapeSettlementHtml,
  openDetailsSheet,
  playChoiceSettlement,
  playRejectionSettlement,
} from '../result/settlement-presenter.js';

const decisionEngine = new DecisionEngine();
const CHOICE_LIMIT = 20;

function pct(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function choiceLabel(state, index) {
  const label = state.getChoiceLabel(index).trim();
  return label || `選項 ${index}`;
}

function duplicateLabels(state, count) {
  const seen = new Map();
  const duplicates = new Set();
  for (let i = 1; i <= count; i += 1) {
    const label = state.getChoiceLabel(i).trim();
    if (!label) continue;
    if (seen.has(label)) duplicates.add(label);
    seen.set(label, i);
  }
  return [...duplicates];
}

function planSummary(plan) {
  const dice = plan.dice;
  if (plan.recommended === 'dice') {
    return `${dice.die.toUpperCase()} / VALID ${dice.validRange[0]}–${dice.validRange[1]} / ${pct(dice.efficiency)}`;
  }
  return `SLOT RECOMMENDED / ${dice.die.toUpperCase()} FALLBACK ${pct(dice.efficiency)}`;
}

function choiceHistory(history) {
  const entries = history.filter((entry) => entry.kind === 'choice');
  if (!entries.length) return '<p class="history-empty">本次 session 尚無選擇紀錄。</p>';
  return entries.map((entry, index) => {
    const raw = entry.method === 'dice'
      ? `RAW ${entry.rawRolls.join(' → ')} / REROLL ${entry.rerolls}`
      : `SLOT DRAW ${entry.mappedIndex}`;
    const displayLabel = entry.label || `選項 ${entry.mappedIndex}`;
    return `
      <details class="history-item" ${index === 0 ? 'open' : ''}>
        <summary><span>${entry.choiceCount} OPTIONS / ${entry.method.toUpperCase()}</span><strong>OPTION ${entry.mappedIndex}</strong></summary>
        <div class="history-detail">${escapeSettlementHtml(raw)}<br>${escapeSettlementHtml(displayLabel)}</div>
      </details>`;
  }).join('');
}

function labelsMarkup(state, count) {
  let rows = '';
  for (let i = 1; i <= count; i += 1) {
    const safe = escapeSettlementHtml(state.getChoiceLabel(i));
    rows += `
      <label class="choice-label-row">
        <span>${i}</span>
        <input type="text" data-choice-label="${i}" value="${safe}" maxlength="80" placeholder="選項 ${i}">
      </label>`;
  }
  return rows;
}

function choiceDetailMarkup({ method, plan, rawRolls, mappedIndex, label }) {
  const rawLine = method === 'dice'
    ? rawRolls.map((raw) => {
      const resolved = decisionEngine.resolveDiceRoll(plan, raw);
      return resolved.accepted ? `${raw}` : `${raw} [INVALID]`;
    }).join(' → ')
    : `${mappedIndex}`;
  const methodLine = method === 'dice'
    ? `${plan.dice.die.toUpperCase()} / ${Math.max(0, rawRolls.length - 1)} REROLL`
    : 'VISIBLE SLOT / CRYPTO DRAW';

  return `
    <section class="result-panel choice-result-panel">
      <p class="section-code">CHOICE / PROVENANCE</p>
      <div class="choice-provenance">
        <span>METHOD</span><strong>${escapeSettlementHtml(methodLine)}</strong>
        <span>RAW</span><strong>${escapeSettlementHtml(rawLine)}</strong>
        <span>OPTION</span><strong>${mappedIndex}</strong>
      </div>
      <div class="choice-final-label">${escapeSettlementHtml(label)}</div>
      <p class="microcopy">無效骰與重擲只保留在詳細資料；主結算只停留最終選項。</p>
    </section>`;
}

export function renderChoiceMode(container, { state, onHome, onDice }) {
  let engine = null;
  let rolling = false;
  let labelDrawerOpen = false;
  let projectionMode = 'perspective';

  const disposeEngine = () => {
    if (engine) {
      engine.dispose();
      engine = null;
    }
  };

  const switchDice = () => {
    if (rolling) return;
    disposeEngine();
    onDice();
  };

  const renderSetup = () => {
    disposeEngine();
    const choiceEntries = state.history.filter((entry) => entry.kind === 'choice');
    container.innerHTML = `
      <header class="mode-header">
        <div><span class="eyebrow">MODE 02 / CHOICE</span><h1>選擇</h1></div>
        <div class="mode-actions">
          <button type="button" class="text-button" id="switch-dice">切換至骰子</button>
        </div>
      </header>

      <section class="function-panel choice-count-panel">
        <p class="section-code">CHOICE COUNT</p>
        <label class="choice-count-label" for="choice-count">你有幾個選項？</label>
        <input id="choice-count" class="choice-count-input" type="number" inputmode="numeric" min="2" max="${CHOICE_LIMIT}" value="${state.choiceCount}">
        <p class="microcopy">v0.1 目前支援 2–${CHOICE_LIMIT} 個選項。第一階段只需要數量，不必先命名。</p>
        <p class="error-box" id="choice-count-error" hidden></p>
      </section>

      <button type="button" class="primary-action" id="confirm-choice-count">確認數量 / ARM</button>

      <section class="history-block">
        <p class="section-code">HISTORY / ${choiceEntries.length} OF 20</p>
        ${choiceHistory(state.history)}
      </section>
    `;

    container.querySelector('#switch-dice').addEventListener('click', switchDice);
    const input = container.querySelector('#choice-count');
    const error = container.querySelector('#choice-count-error');

    container.querySelector('#confirm-choice-count').addEventListener('click', () => {
      const next = Math.floor(Number(input.value));
      if (!Number.isFinite(next) || next < 2 || next > CHOICE_LIMIT) {
        error.hidden = false;
        error.textContent = `目前版本支援 2–${CHOICE_LIMIT} 個選項。`;
        return;
      }

      if (next !== state.choiceCount && Object.values(state.choiceLabels).some((label) => String(label).trim())) {
        const proceed = window.confirm('修改選項數量可能讓既有名稱的對應範圍改變。繼續嗎？');
        if (!proceed) return;
      }

      state.setChoiceCount(next);
      state.setChoiceMethodOverride(null);
      labelDrawerOpen = false;
      renderReady();
    });
  };

  const renderReady = () => {
    disposeEngine();
    const plan = decisionEngine.buildPlan(state.choiceCount, state.choiceMethodOverride);
    const dice = plan.dice;
    const selectedMethod = plan.method;
    const duplicates = duplicateLabels(state, state.choiceCount);
    const isDice = selectedMethod === 'dice';

    container.innerHTML = `
      <header class="mode-header">
        <div><span class="eyebrow">MODE 02 / ARMED</span><h1>選擇</h1></div>
        <div class="mode-actions">
          <button type="button" class="text-button" id="switch-dice">切換至骰子</button>
        </div>
      </header>

      <section class="roll-summary choice-plan-summary">
        <span>OPTIONS</span><strong>${state.choiceCount}</strong>
        <span>RECOMMEND</span><strong>${planSummary(plan)}</strong>
      </section>

      <section class="function-panel method-panel">
        <p class="section-code">METHOD / 可覆寫推薦</p>
        <div class="method-switch" id="method-switch">
          <button type="button" data-method="dice" class="${isDice ? 'active' : ''} ${plan.recommended === 'dice' ? 'recommended' : ''}">
            <strong>DICE</strong><span>${dice.die.toUpperCase()} / ${pct(dice.efficiency)}</span>
          </button>
          <button type="button" data-method="slot" class="${!isDice ? 'active' : ''} ${plan.recommended === 'slot' ? 'recommended' : ''}">
            <strong>SLOT</strong><span>1–${state.choiceCount}</span>
          </button>
        </div>
        <p class="microcopy">骰子方案：每 ${dice.groupSize} 個有效骰面對應一個選項；${dice.rejectedOutcomes.length ? `無效面 ${dice.rejectedOutcomes.join(', ')} 會公開重擲。` : '沒有無效面。'}</p>
      </section>

      <section class="choice-label-drawer ${labelDrawerOpen ? 'is-open' : ''}">
        <button type="button" class="choice-label-toggle" id="choice-label-toggle">${labelDrawerOpen ? '▼' : '▲'} 選項名稱 / OPTIONAL</button>
        <div id="choice-label-body" ${labelDrawerOpen ? '' : 'hidden'}>
          <div class="choice-label-list">${labelsMarkup(state, state.choiceCount)}</div>
          <p class="choice-duplicate-warning" id="duplicate-warning" ${duplicates.length ? '' : 'hidden'}>重複名稱：${escapeSettlementHtml(duplicates.join('、'))}。重複項目仍是不同 index，會形成實質加權。</p>
        </div>
      </section>

      ${isDice ? `
        <section class="dice-stage" id="choice-dice-stage" aria-label="選擇模式 3D 骰子舞台">
          <canvas id="choice-dice-canvas"></canvas>
          <div class="dither-layer" aria-hidden="true"></div>
          <div class="stage-badge" id="choice-stage-badge">READY / ${dice.die.toUpperCase()}</div>
          <div class="projection-ab" aria-label="鏡頭投影比較">
            <button type="button" data-projection="perspective" class="${projectionMode === 'perspective' ? 'active' : ''}">PERSPECTIVE</button>
            <button type="button" data-projection="orthographic" class="${projectionMode === 'orthographic' ? 'active' : ''}">ORTHO</button>
          </div>
          <div id="choice-settlement" class="settlement-overlay" hidden aria-live="polite"></div>
        </section>` : `
        <section class="slot-stage" id="slot-stage" aria-label="選擇模式拉霸">
          <span class="section-code">VISIBLE REEL</span>
          <strong class="slot-number" id="slot-number">${String(1).padStart(2, '0')}</strong>
          <small>1 — ${state.choiceCount}</small>
          <div id="choice-settlement" class="settlement-overlay" hidden aria-live="polite"></div>
        </section>`}

      <div class="choice-roll-control-row">
        <button type="button" class="primary-action roll-action" id="choice-roll">ROLL</button>
        <button type="button" class="secondary-action" id="edit-count">修改選項</button>
      </div>
      <div id="choice-error" aria-live="polite"></div>
    `;

    const switchButton = container.querySelector('#switch-dice');
    const editButton = container.querySelector('#edit-count');
    const methodSwitch = container.querySelector('#method-switch');
    const toggle = container.querySelector('#choice-label-toggle');
    const body = container.querySelector('#choice-label-body');
    const rollButton = container.querySelector('#choice-roll');
    const settlement = container.querySelector('#choice-settlement');
    const errorRegion = container.querySelector('#choice-error');
    const projectionControls = container.querySelector('.projection-ab');

    switchButton.addEventListener('click', switchDice);
    editButton.addEventListener('click', () => {
      if (!rolling) renderSetup();
    });

    methodSwitch.addEventListener('click', (event) => {
      if (rolling) return;
      const button = event.target.closest('button[data-method]');
      if (!button) return;
      state.setChoiceMethodOverride(button.dataset.method);
      renderReady();
    });

    toggle.addEventListener('click', () => {
      if (rolling) return;
      labelDrawerOpen = !labelDrawerOpen;
      body.hidden = !labelDrawerOpen;
      toggle.textContent = `${labelDrawerOpen ? '▼' : '▲'} 選項名稱 / OPTIONAL`;
    });

    body.addEventListener('input', (event) => {
      const input = event.target.closest('input[data-choice-label]');
      if (!input) return;
      state.setChoiceLabel(Number(input.dataset.choiceLabel), input.value);
      const dupes = duplicateLabels(state, state.choiceCount);
      const warning = container.querySelector('#duplicate-warning');
      warning.hidden = !dupes.length;
      warning.textContent = dupes.length
        ? `重複名稱：${dupes.join('、')}。重複項目仍是不同 index，會形成實質加權。`
        : '';
    });

    if (projectionControls) {
      projectionControls.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-projection]');
        if (!button) return;
        projectionMode = button.dataset.projection === 'orthographic' ? 'orthographic' : 'perspective';
        if (engine) engine.setProjectionMode(projectionMode);
        projectionControls.querySelectorAll('button[data-projection]').forEach((item) => {
          item.classList.toggle('active', item.dataset.projection === projectionMode);
        });
      });
    }

    const recordResult = ({ method, finalPlan, rawRolls = [], mappedIndex }) => {
      const label = choiceLabel(state, mappedIndex);
      const entry = {
        kind: 'choice',
        choiceCount: state.choiceCount,
        method,
        plan: finalPlan,
        rawRolls: rawRolls.slice(),
        acceptedRoll: rawRolls.length ? rawRolls[rawRolls.length - 1] : null,
        mappedIndex,
        label: state.getChoiceLabel(mappedIndex).trim(),
        rerolls: Math.max(0, rawRolls.length - 1),
        timestamp: Date.now(),
      };
      state.pushHistory(entry);
      return { entry, label };
    };

    const finishSettlement = async ({ method, finalPlan, rawRolls = [], mappedIndex, label }) => {
      await playChoiceSettlement({
        host: settlement,
        mappedIndex,
        label,
        onDetails() {
          openDetailsSheet({
            title: '選擇詳細資料',
            html: choiceDetailMarkup({ method, plan: finalPlan, rawRolls, mappedIndex, label }),
          });
        },
      });
      rolling = false;
      rollButton.disabled = false;
      editButton.disabled = false;
      switchButton.disabled = false;
    };

    rollButton.addEventListener('click', async () => {
      if (rolling) return;
      rolling = true;
      clearSettlement(settlement);
      errorRegion.innerHTML = '';
      labelDrawerOpen = false;
      body.hidden = true;
      toggle.textContent = '▲ 選項名稱 / OPTIONAL';
      rollButton.disabled = true;
      editButton.disabled = true;
      switchButton.disabled = true;

      const finalPlan = decisionEngine.buildPlan(state.choiceCount, selectedMethod);

      try {
        if (selectedMethod === 'slot') {
          const finalIndex = decisionEngine.drawSlotIndex(state.choiceCount);
          const recorded = recordResult({ method: 'slot', finalPlan, mappedIndex: finalIndex });
          const reel = container.querySelector('#slot-number');

          try {
            await animateSlot({
              choiceCount: state.choiceCount,
              finalIndex,
              onTick(value, info) {
                reel.textContent = String(value).padStart(2, '0');
                reel.dataset.final = info.final ? 'true' : 'false';
              },
            });
          } catch {
            reel.textContent = String(finalIndex).padStart(2, '0');
            reel.dataset.final = 'true';
          }

          await finishSettlement({
            method: 'slot',
            finalPlan,
            mappedIndex: finalIndex,
            label: recorded.label,
          });
          return;
        }

        const badge = container.querySelector('#choice-stage-badge');
        badge.textContent = 'ROLL';
        const { DiceEngine } = await import('../dice/engine.js');
        if (!engine) {
          engine = new DiceEngine({
            canvas: container.querySelector('#choice-dice-canvas'),
            stage: container.querySelector('#choice-dice-stage'),
            rendererOptions: { projectionMode },
          });
        }

        const rawRolls = [];
        let mappedIndex = null;
        while (mappedIndex === null) {
          const attempt = rawRolls.length + 1;
          badge.textContent = `${finalPlan.dice.die.toUpperCase()} / ROLL ${attempt}`;
          const rollResult = await engine.roll({
            pool: [{ type: finalPlan.dice.die, count: 1 }],
            onProgress(progress) {
              badge.textContent = String(progress.phase).startsWith('FEEDING') ? `ROLL ${attempt}` : `SETTLE ${attempt}`;
            },
          });
          const raw = rollResult.dice[0].value;
          rawRolls.push(raw);
          const resolved = decisionEngine.resolveDiceRoll(finalPlan, raw);

          if (!resolved.accepted) {
            badge.textContent = `${raw} / INVALID`;
            await playRejectionSettlement({
              host: settlement,
              dieType: finalPlan.dice.die,
              raw,
            });
            continue;
          }

          mappedIndex = resolved.mappedIndex;
          badge.textContent = 'LOCKED';
        }

        const recorded = recordResult({ method: 'dice', finalPlan, rawRolls, mappedIndex });
        await finishSettlement({
          method: 'dice',
          finalPlan,
          rawRolls,
          mappedIndex,
          label: recorded.label,
        });
      } catch (error) {
        rolling = false;
        rollButton.disabled = false;
        editButton.disabled = false;
        switchButton.disabled = false;
        errorRegion.innerHTML = `<p class="error-box">${escapeSettlementHtml(error.message)}</p>`;
      }
    });
  };

  renderSetup();
}
