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
  dither: 'hybrid',
  shadow: 'real',
  floor: 'cuttingB',
  popIn: 'off',
};

const engine = new DiceEngine({
  canvas,
  stage,
  rendererOptions: {
    internalWidth: 360,
    projectionMode: 'perspective',
    labOptions: {
      enabled: true,
      dither: state.dither,
      shadow: state.shadow,
      floor: state.floor,
      wobble: 'low',
      popIn: state.popIn,
      fog: 'low',
    },
  },
});

let rolling = false;

function floorName(value) {
  if (value === 'cuttingA') return 'MAT A';
  if (value === 'cuttingC') return 'MAT C';
  return 'MAT B';
}

function shadowName(value) {
  return value === 'blob' ? 'BLOB' : 'REAL 128';
}

function updateReadout() {
  configReadout.textContent = [
    state.dither.toUpperCase(),
    shadowName(state.shadow),
    floorName(state.floor),
    `POP ${state.popIn.toUpperCase()}`,
    'WOBBLE LOW',
  ].join(' / ');
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

  if (key !== 'die') {
    engine.renderer.setLabOptions({ [key]: value });
  } else if (!rolling) {
    status.textContent = `NEXT / ${value.toUpperCase()}`;
  }
  updateReadout();
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
    status.textContent = 'LOCKED / SWITCH FILTERS';
  } catch (error) {
    status.textContent = 'ERROR';
    resultReadout.textContent = error?.message ?? String(error);
  } finally {
    rolling = false;
    rollButton.disabled = false;
  }
});

updateReadout();
