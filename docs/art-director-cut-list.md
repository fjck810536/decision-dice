# Art Director Cut List

This file tracks visual-integration cuts that are agreed but not yet completed.
It exists so visual decisions do not get lost across iterative HOME / DICE / CHOICE passes.

## Locked / keep

- HOME marquee motion and current three-part composition: top strip + dim background field + main Z band.
- Choice slot interaction timing and basic stage rhythm. It is currently the strongest interaction reference.
- Production Dice Art face rules and M6.2A renderer rules remain locked unless explicitly reopened.
- Dice Roll stays the only place that runs the full physics simulation.

## Current cut: shared low-cost 3D dice language

- [x] Replace HOME fake polygon icons with textless low-resolution 3D dice sprites.
- [x] Replace Dice Setup flat relief icons with the same 3D dice sprites.
- [x] HOME / Setup previews render once at tiny resolution, cache to images, then release the WebGL context.
- [x] Keep HOME independent from DiceEngine / physics.

## Next cuts

### 1. Unify ARMED chassis

- [ ] Make Dice ARMED and Choice ARMED read as two instruments installed in the same machine chassis.
- [ ] Preserve their different organs: Dice = physical chamber; Choice = electronic reel / slot display.
- [ ] Align stage frame, summary placement, ROLL zone, secondary-action placement, status readout, and spacing rhythm.
- [ ] Do not flatten Choice into Dice styling; preserve the slot's current clarity and feel.

### 2. Rebuild HOME mode keys from the mature chassis language

- [ ] Stop inventing a separate HOME button material.
- [ ] Derive `骰子` / `選擇` entrance controls from the finalized ARMED control hardware.
- [ ] Keep HOME scale exaggerated, but reuse the same highlight plane, dark plane, press travel, color semantics, and edge logic.

### 3. Integrate Settlement into the instrument stage

- [ ] Reduce generic modal/card feeling.
- [ ] Make Dice TOTAL and Choice final index feel like the machine's result display taking over the active stage.
- [ ] Preserve existing settlement timing, result semantics, Details flow, and rejection visibility rules.

### 4. Unify system controls

- [ ] Make HOME / MUTE / SET feel like fixed chassis hardware rather than a separate web overlay system.
- [ ] Preserve touch targets and current settings behavior.

### 5. Dice Setup second pass

- [ ] Review rack spacing after 3D preview replacement.
- [ ] Decide whether D100 pair needs a stronger two-body visual cue.
- [ ] Remove dead flat-relief CSS after the new 3D preview language is accepted.
- [ ] Reassess microcopy / rack labels so the 3D objects stay dominant.

### 6. HOME asset cleanup

- [ ] Remove obsolete P1 / P2 experimental HOME CSS files only after the current Art Director HOME pass is accepted and no rollback is needed.
- [ ] Retire the failed html2canvas render probe from the product path; keep only if useful as an archived experiment.

## Product-level visual rule

Treat the product as a late-1990s dedicated decision-assistance machine:

- object-level age: low-poly dice, hard bevels, limited colors, physical controls;
- display-level age: hard pixel separation, low-resolution 3D, stepped motion where appropriate;
- avoid decorative retro noise: no gratuitous glitch, scanline, HUD text, black-grain overlays, or REC/SYS clutter unless it has a machine function.

Shared color semantics:

- cream: content / primary read value / object surface;
- acid yellow-green: READY / valid / selected / primary action;
- rust red: warning / invalid / secondary material bias;
- olive-black: chassis;
- grey-green: engraved / inactive / secondary information.
