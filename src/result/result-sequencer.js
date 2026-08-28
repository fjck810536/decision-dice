const reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function shouldSkipTiming() {
  return document.hidden || Boolean(reducedMotionQuery?.matches);
}

function waitForPresentation(ms) {
  if (!ms || shouldSkipTiming()) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      resolve();
    };
    const onVisibility = () => {
      if (document.hidden) finish();
    };
    const timer = setTimeout(finish, ms);
    document.addEventListener('visibilitychange', onVisibility, { passive: true });
  });
}

function renderStep(step, index) {
  const tone = step.tone ? ` is-${step.tone}` : '';
  return `
    <div class="result-sequence-step${tone}" data-sequence-index="${index}">
      <span>${escapeHtml(step.label ?? '')}</span>
      <strong>${escapeHtml(step.value ?? '')}</strong>
      ${step.detail ? `<small>${escapeHtml(step.detail)}</small>` : ''}
    </div>`;
}

/**
 * Presentation-only staged reveal. The caller must compute and persist the
 * actual result before invoking this function. If the page is backgrounded,
 * timing is skipped so Safari timer throttling cannot strand the UI midway.
 */
export async function playResultSequence({
  target,
  steps,
  title = 'RESULT SEQUENCE',
  holdMs = 360,
  finalHoldMs = 220,
  transient = false,
}) {
  if (!target) return;
  const safeSteps = Array.isArray(steps) ? steps.filter(Boolean) : [];

  target.innerHTML = `
    <section class="result-sequence-panel${transient ? ' is-transient' : ''}">
      <p class="section-code">${escapeHtml(title)}</p>
      <div class="result-sequence-stack"></div>
    </section>`;

  const stack = target.querySelector('.result-sequence-stack');
  for (let i = 0; i < safeSteps.length; i += 1) {
    stack.insertAdjacentHTML('beforeend', renderStep(safeSteps[i], i));
    const row = stack.lastElementChild;
    requestAnimationFrame(() => row?.classList.add('is-visible'));
    const delay = safeSteps[i].holdMs ?? holdMs;
    await waitForPresentation(delay);
  }

  await waitForPresentation(finalHoldMs);
}

export function compactDiceValues(result, limit = 6) {
  const dice = result?.dice ?? [];
  if (dice.length > limit) return `${dice.length} DICE / SEE DETAIL`;
  return dice.map((die) => `${String(die.type).toUpperCase()} ${die.value}`).join(' / ');
}
