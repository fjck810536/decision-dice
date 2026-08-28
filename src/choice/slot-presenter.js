import { audioEngine } from '../audio/audio-engine.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function animateSlot({
  choiceCount,
  finalIndex,
  onTick = () => {},
  durationMs = 920,
}) {
  await audioEngine.unlock();
  const startedAt = performance.now();
  let tick = 0;

  while (performance.now() - startedAt < durationMs) {
    const elapsed = performance.now() - startedAt;
    const progress = Math.min(1, elapsed / durationMs);
    const delay = 34 + Math.round(progress * progress * 105);
    const decoy = ((finalIndex + tick * 7 + Math.floor(elapsed / 37)) % choiceCount) + 1;
    onTick(decoy, { final: false, progress });
    audioEngine.playSlotTick({ final: false });
    tick += 1;
    await sleep(delay);
  }

  onTick(finalIndex, { final: true, progress: 1 });
  audioEngine.playSlotTick({ final: true });
  return finalIndex;
}
