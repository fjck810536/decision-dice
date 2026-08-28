import { DiceEngine } from '../src/dice/engine.js';
import { installDoubleTapZoomGuard } from '../src/ui/mobile-gesture-guard.js';

installDoubleTapZoomGuard();
document.addEventListener('dblclick', (event) => event.preventDefault(), { capture: true });

const stage = document.getElementById('lab-stage');
const canvas = document.getElementById('lab-canvas');
const rollButton = document.getElementById('lab-roll');
const status = document.getElementById('lab-status');
const configReadout = document.getElementById('lab-config');
const resultReadout = document.getElementById('lab-result');
const controls = document.querySelector('.lab-controls');

const state = {
  die: 'd6',
  tone: 'plus',
};

const engine = new DiceEngine({
  canvas,
  stage,
  rendererOptions: {
    internalWidth: 360,
    projectionMode: 'perspective',
    labOptions: {
      enabled: true,
      dither: 'ordered',
      shadow: 'real',
      floor: 'cuttingA',
      wobble: 'low',
      popIn: 'off',
      fog: 'low',
    },
  },
});

let rolling = false;

function applyTone(mode) {
  if (mode === 'plus') {
    // ORDERED+ v1: preserve the exact ordered-dither screen, but widen the
    // visible face-to-face colour separation with a warm key and grey-green
    // ambient fill. This is intentionally renderer-language work, not final
    // ivory material art direction.
    engine.renderer.ambient.color.set(0xb1b79e);
    engine.renderer.ambient.intensity = 0.70;
    engine.renderer.sun.color.set(0xffe1ad);
    engine.renderer.sun.intensity = 1.78;
    configReadout.textContent = 'ORDERED+ / REAL 128 / MAT A / POP OFF';
  } else {
    engine.renderer.ambient.color.set(0xd8d1b9);
    engine.renderer.ambient.intensity = 0.82;
    engine.renderer.sun.color.set(0xffffff);
    engine.renderer.sun.intensity = 1.55;
    configReadout.textContent = 'ORDERED BASE / REAL 128 / MAT A / POP OFF';
  }
  engine.renderer.lastRenderAt = 0;
  engine.renderer.render(engine.renderer.records, performance.now(), true);
}

function poolFor(type) {
  if (type === 'd100') return [{ type, count: 2 }];
  if (type === 'd10') return [{ type, count: 3 }];
  if (type === 'd20') return [{ type, count: 3 }];
  return [{ type: 'd6', count: 3 }];
}

function resultText(result) {
  const groups = new Map();
  for (const die of result.dice) {
    const key = die.type.toUpperCase();
    const values = groups.get(key) ?? [];
    values.push(die.value);
    groups.set(key, values);
  }
  return [...groups.entries()].map(([type, values]) => `${type} ${values.join(' ')}`).join(' / ');
}

function setActive(group, value) {
  group.querySelectorAll('button[data-value]').forEach((button) => {
    button.classList.toggle('active', button.dataset.value === value);
  });
}

controls.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-value]');
  if (!button) return;
  const group = button.closest('[data-control]');
  const key = group?.dataset.control;
  const value = button.dataset.value;
  if (!key || !(key in state)) return;

  state[key] = value;
  setActive(group, value);

  if (key === 'tone') {
    applyTone(value);
    status.textContent = value === 'plus' ? 'ORDERED+ / SAME POSE' : 'ORDERED BASE / SAME POSE';
  } else if (!rolling) {
    status.textContent = `NEXT / ${value.toUpperCase()}`;
  }
});

rollButton.addEventListener('click', async () => {
  if (rolling) return;
  rolling = true;
  rollButton.disabled = true;
  resultReadout.textContent = '—';
  status.textContent = `ROLL / ${state.die.toUpperCase()}`;

  try {
    const result = await engine.roll({
      pool: poolFor(state.die),
      onProgress(progress) {
        if (String(progress.phase).startsWith('FEEDING')) {
          status.textContent = `FEED / ${progress.spawned} OF ${progress.physicalCount}`;
        } else {
          status.textContent = `SETTLE / ${progress.frozen} OF ${progress.physicalCount}`;
        }
      },
    });
    resultReadout.textContent = resultText(result);
    status.textContent = 'LOCKED / A-B TONE ON SAME POSE';
    applyTone(state.tone);
  } catch (error) {
    status.textContent = 'ERROR';
    resultReadout.textContent = error?.message ?? String(error);
  } finally {
    rolling = false;
    rollButton.disabled = false;
  }
});

applyTone('plus');
