import { GeometryRegistry } from './geometry-registry.js';
import { PhysicsWorld } from './physics-world.js';
import { FaceResolver } from './face-resolver.js';
import { DiceFeeder } from './feeder.js';
import { SettlingController } from './settling.js';
import { assembleRollResult } from './result.js';
import { RetroRenderer } from '../render/retro-renderer.js';
import { audioEngine } from '../audio/audio-engine.js';

const PRODUCT_RENDERER_PROFILE = Object.freeze({
  enabled: true,
  dither: 'ordered',
  shadow: 'real',
  floor: 'cuttingA',
  wobble: 'low',
  popIn: 'off',
  fog: 'low',
});

const PRODUCT_LIGHTING = Object.freeze({
  ambientColor: 0xc8cbbb,
  ambientIntensity: 0.78,
  keyColor: 0xfff1d8,
  keyIntensity: 1.62,
});

function expandPool(pool) {
  const logicalDice = [];
  const units = [];
  let logicalCounter = 0;
  let physicalCounter = 0;

  for (const item of pool) {
    for (let i = 0; i < item.count; i += 1) {
      logicalCounter += 1;
      const logicalId = `${item.type}-${logicalCounter}`;
      logicalDice.push({ logicalId, type: item.type });

      if (item.type === 'd100') {
        ['tens', 'ones'].forEach((componentRole) => {
          physicalCounter += 1;
          units.push({
            physicalId: `p-${physicalCounter}`,
            logicalId,
            logicalType: 'd100',
            componentRole,
          });
        });
      } else {
        physicalCounter += 1;
        units.push({
          physicalId: `p-${physicalCounter}`,
          logicalId,
          logicalType: item.type,
          componentRole: null,
        });
      }
    }
  }

  return { logicalDice, units };
}

export class DiceEngine {
  constructor({ canvas, stage, rendererOptions = {} }) {
    this.registry = new GeometryRegistry();
    this.physicsWorld = new PhysicsWorld({
      onCollision({ impact }) {
        audioEngine.playCollision(impact);
      },
    });
    this.faceResolver = new FaceResolver();
    this.feeder = new DiceFeeder({ physicsWorld: this.physicsWorld, registry: this.registry });
    this.settling = new SettlingController({ physicsWorld: this.physicsWorld, faceResolver: this.faceResolver });

    // Product default = the M6.2A renderer profile confirmed on iPhone.
    // Experiments can still supply an explicit labOptions object to override it.
    const hasExplicitLabOptions = Object.prototype.hasOwnProperty.call(rendererOptions, 'labOptions');
    const resolvedRendererOptions = hasExplicitLabOptions
      ? rendererOptions
      : {
          ...rendererOptions,
          labOptions: { ...PRODUCT_RENDERER_PROFILE },
        };

    this.renderer = new RetroRenderer({ canvas, stage, ...resolvedRendererOptions });

    if (!hasExplicitLabOptions) {
      // ORDERED+ v2.1: same 4x4 ordered screen as ORDERED BASE, with only a
      // restrained warm-key / cool-neutral-fill separation.
      this.renderer.ambient.color.set(PRODUCT_LIGHTING.ambientColor);
      this.renderer.ambient.intensity = PRODUCT_LIGHTING.ambientIntensity;
      this.renderer.sun.color.set(PRODUCT_LIGHTING.keyColor);
      this.renderer.sun.intensity = PRODUCT_LIGHTING.keyIntensity;
      this.renderer.lastRenderAt = 0;
    }

    this.running = false;
  }

  setProjectionMode(mode) {
    return this.renderer.setProjectionMode(mode);
  }

  getProjectionMode() {
    return this.renderer.getProjectionMode();
  }

  validatePool(pool) {
    const cleaned = pool
      .filter((item) => item && this.registry.has(item.type))
      .map((item) => ({ type: item.type, count: Math.max(0, Math.floor(Number(item.count) || 0)) }))
      .filter((item) => item.count > 0);
    const physicalCount = this.registry.getPhysicalCount(cleaned);
    if (!cleaned.length) throw new Error('骰池是空的。');
    if (physicalCount > 50) throw new Error('目前單次最多 50 個物理骰體。');
    return cleaned;
  }

  async roll({ pool, onProgress = () => {} }) {
    if (this.running) throw new Error('DiceEngine is already rolling.');
    const cleanPool = this.validatePool(pool);
    const { logicalDice, units } = expandPool(cleanPool);

    await audioEngine.unlock();
    audioEngine.playRollCue();

    this.running = true;
    this.physicsWorld.reset();
    this.renderer.reset();
    this.renderer.setPhysicalCount(units.length);

    const startedAt = performance.now();
    this.feeder.start(units, startedAt);
    this.settling.reset(this.feeder.records);

    return new Promise((resolve, reject) => {
      let lastFrame = startedAt;

      const loop = (now) => {
        try {
          if (!this.running) return;
          const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
          lastFrame = now;

          const spawned = this.feeder.update(now);
          if (spawned) this.renderer.addRecord(spawned);

          let phase = 'FEEDING / FAST RANDOM';
          let frozenCount = this.feeder.records.filter((r) => r.frozen).length;
          let done = false;

          if (this.feeder.done && this.feeder.records.length) {
            const afterFeed = (now - this.feeder.lastSpawnAt) / 1000;
            const settlingState = this.settling.update(this.feeder.records, afterFeed);
            phase = settlingState.phase;
            frozenCount = settlingState.frozenCount ?? frozenCount;
            done = settlingState.done;
          }

          this.physicsWorld.step(dt);
          this.renderer.render(this.feeder.records, now);

          onProgress({
            phase,
            spawned: this.feeder.spawnedCount,
            physicalCount: units.length,
            frozen: frozenCount,
            defers: this.feeder.defers,
          });

          if (done) {
            const completedAt = performance.now();
            this.renderer.render(this.feeder.records, completedAt, true);
            const result = assembleRollResult({
              logicalDice,
              records: this.feeder.records,
              faceResolver: this.faceResolver,
              startedAt,
              completedAt,
            });
            this.running = false;
            resolve(result);
            return;
          }

          requestAnimationFrame(loop);
        } catch (error) {
          this.running = false;
          reject(error);
        }
      };

      requestAnimationFrame(loop);
    });
  }

  dispose() {
    this.running = false;
    this.renderer.dispose();
  }
}
