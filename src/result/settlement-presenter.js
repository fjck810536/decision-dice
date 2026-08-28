const reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

function shouldSkipTiming() {
  return Boolean(document.hidden || reducedMotionQuery?.matches);
}

function wait(ms) {
  if (shouldSkipTiming() || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    let timer = null;
    const finish = () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      resolve();
    };
    const onVisibility = () => {
      if (document.hidden) finish();
    };
    document.addEventListener('visibilitychange', onVisibility);
    timer = setTimeout(finish, ms);
  });
}

export function escapeSettlementHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function groupedDiceRows(result) {
  const groups = [];
  const byType = new Map();
  for (const die of result?.dice ?? []) {
    const type = String(die.type ?? '').toUpperCase();
    let group = byType.get(type);
    if (!group) {
      group = { type, values: [] };
      byType.set(type, group);
      groups.push(group);
    }
    group.values.push(die.value);
  }
  return groups;
}

function diceGroupMarkup(result) {
  return groupedDiceRows(result).map((group) => `
    <div class="settlement-dice-row">
      <span>${escapeSettlementHtml(group.type)}</span>
      <strong>${group.values.map(escapeSettlementHtml).join('&nbsp;&nbsp;')}</strong>
    </div>`).join('');
}

function subtotalValues(result) {
  const hasExplicitSubtotal = Number.isFinite(Number(result?.subtotal));
  const subtotal = hasExplicitSubtotal ? Number(result.subtotal) : Number(result?.total ?? 0);
  const modifier = Number.isFinite(Number(result?.modifier)) ? Number(result.modifier) : 0;
  const total = hasExplicitSubtotal
    ? (Number.isFinite(Number(result?.total)) ? Number(result.total) : subtotal + modifier)
    : subtotal + modifier;
  return { subtotal, modifier, total };
}

export async function playDiceSettlement({ host, result, onDetails = null, holdMs = 390 } = {}) {
  if (!host) return;
  const { subtotal, modifier, total } = subtotalValues(result);
  host.hidden = false;
  host.className = 'settlement-overlay settlement-overlay--dice is-active';
  host.innerHTML = `
    <div class="settlement-card" role="status">
      <div class="settlement-phase settlement-phase--individual is-visible">
        ${diceGroupMarkup(result)}
      </div>
      <div class="settlement-phase settlement-phase--math" hidden>
        <div class="settlement-math-row"><span>骰子</span><strong>${escapeSettlementHtml(subtotal)}</strong></div>
        <div class="settlement-math-row"><span>修正</span><strong>${modifier >= 0 ? '+' : ''}${escapeSettlementHtml(modifier)}</strong></div>
      </div>
      <div class="settlement-total" hidden>
        <span>TOTAL</span><strong>${escapeSettlementHtml(total)}</strong>
      </div>
      <button type="button" class="settlement-details" hidden>查看詳細資料</button>
    </div>`;

  await wait(holdMs);

  const individual = host.querySelector('.settlement-phase--individual');
  const math = host.querySelector('.settlement-phase--math');
  individual.hidden = true;
  math.hidden = false;
  requestAnimationFrame(() => math.classList.add('is-visible'));

  await wait(holdMs);

  const card = host.querySelector('.settlement-card');
  const totalNode = host.querySelector('.settlement-total');
  math.classList.add('is-compact');
  card.classList.add('has-total');
  totalNode.hidden = false;
  requestAnimationFrame(() => totalNode.classList.add('is-visible'));

  await wait(holdMs);

  const details = host.querySelector('.settlement-details');
  details.hidden = false;
  requestAnimationFrame(() => details.classList.add('is-visible'));
  if (onDetails) details.addEventListener('click', onDetails);
}

export async function playChoiceSettlement({ host, mappedIndex, label, onDetails = null, holdMs = 390 } = {}) {
  if (!host) return;
  host.hidden = false;
  host.className = 'settlement-overlay settlement-overlay--choice is-active';
  host.innerHTML = `
    <div class="settlement-card settlement-card--choice" role="status">
      <div class="choice-settlement-index is-visible">${escapeSettlementHtml(mappedIndex)}</div>
      <div class="choice-settlement-label" hidden>${escapeSettlementHtml(label)}</div>
      <button type="button" class="settlement-details" hidden>查看詳細資料</button>
    </div>`;

  await wait(holdMs);
  const index = host.querySelector('.choice-settlement-index');
  const labelNode = host.querySelector('.choice-settlement-label');
  index.classList.add('is-compact');
  labelNode.hidden = false;
  requestAnimationFrame(() => labelNode.classList.add('is-visible'));

  await wait(holdMs);
  const details = host.querySelector('.settlement-details');
  details.hidden = false;
  requestAnimationFrame(() => details.classList.add('is-visible'));
  if (onDetails) details.addEventListener('click', onDetails);
}

export async function playRejectionSettlement({ host, dieType, raw, holdMs = 300 } = {}) {
  if (!host) return;
  host.hidden = false;
  host.className = 'settlement-overlay settlement-overlay--rejection is-active';
  host.innerHTML = `
    <div class="settlement-card settlement-card--rejection" role="status">
      <div class="rejection-raw"><span>${escapeSettlementHtml(String(dieType).toUpperCase())}</span><strong>${escapeSettlementHtml(raw)}</strong></div>
      <div class="rejection-word">INVALID</div>
      <div class="rejection-next">REROLL</div>
    </div>`;
  await wait(holdMs * 2);
  host.hidden = true;
  host.innerHTML = '';
}

export function clearSettlement(host) {
  if (!host) return;
  host.hidden = true;
  host.className = 'settlement-overlay';
  host.innerHTML = '';
}

export function openDetailsSheet({ title = '詳細資料', html = '' } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'details-sheet-backdrop';
  backdrop.innerHTML = `
    <section class="details-sheet" role="dialog" aria-modal="true" aria-label="${escapeSettlementHtml(title)}">
      <header class="details-sheet-head">
        <div><span>DETAIL</span><strong>${escapeSettlementHtml(title)}</strong></div>
        <button type="button" data-close aria-label="關閉詳細資料">×</button>
      </header>
      <div class="details-sheet-body">${html}</div>
    </section>`;

  const close = () => backdrop.remove();
  backdrop.querySelector('[data-close]').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  document.body.appendChild(backdrop);
  backdrop.querySelector('[data-close]').focus();
  return close;
}
