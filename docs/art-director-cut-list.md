# Art Director Cut List

This file tracks visual-integration cuts that are agreed but not yet completed.
It exists so visual decisions do not get lost across iterative HOME / DICE / CHOICE passes.

## Locked / keep

- HOME marquee motion and current three-part composition: top strip + dim background field + main Z band.
- Choice slot interaction timing and basic stage rhythm. It is currently the strongest interaction reference.
- Production Dice Art face rules and M6.2A renderer rules remain locked unless explicitly reopened.
- Dice Roll stays the only place that runs the full physics simulation.

## Shared low-cost 3D dice language

- [x] Replace HOME fake polygon icons with textless low-resolution 3D dice sprites.
- [x] Replace Dice Setup flat relief icons with the same 3D dice sprites.
- [x] HOME / Setup previews render once at tiny resolution, cache to images, then release the WebGL context.
- [x] Keep HOME independent from DiceEngine / physics.
- [x] Recompose Dice Setup modules as `name + description → 3D specimen window → − count +`.
- [x] Give Setup previews a deliberately low-frame three-angle turntable using cached sprites, not live WebGL.
- [x] Keep die descriptions visible as product nameplates instead of removing them for minimalism.
- [x] Give D100 a larger full-width two-body specimen window.
- [x] Fix turntable frame overlap and keep +/- updates local so preview animations are not rebuilt on every count change.

## ARMED chassis integration

- [x] Implement a shared chassis pass for Dice ARMED and Choice ARMED.
- [x] Preserve different organs: Dice = physical chamber; Choice = electronic reel / slot display.
- [x] Align data-strip treatment, square instrument frame, stage readout language, ROLL hardware, secondary-action hardware, and spacing rhythm.
- [x] Keep Choice reel typography and reel-guide behavior intact instead of flattening it into Dice styling.
- [ ] iPhone acceptance: confirm Choice still feels as comfortable as before and Dice now reads as the same machine.

## HOME mode hardware

- [x] Stop inventing a separate HOME button material.
- [x] Derive `骰子` / `選擇` entrance controls from the ARMED control-deck hardware language.
- [x] Keep HOME scale exaggerated while reusing hard highlight planes, dark planes, chamfer logic, press travel, and the same cream / acid / rust material family.
- [x] Avoid adding decorative HUD labels; the hardware form itself must carry the late-1990s machine character.
- [ ] iPhone acceptance: confirm the two HOME entrance keys finally feel like enlarged controls from the same machine rather than separate retro tiles.

## Settlement stage takeover

- [x] Remove the generic floating-card reading from Dice / Choice settlement.
- [x] Make the parent instrument enter explicit RESULT / REJECTION states while preserving existing settlement sequencing and data.
- [x] Dim the physical chamber / reel underneath rather than visually stacking another unrelated card above it.
- [x] Make Dice TOTAL and Choice final index / label occupy the square instrument aperture itself.
- [x] Keep Details available as small chassis hardware at the stage edge.
- [x] Preserve rejection visibility and give it a temporary fault-state treatment instead of a separate modal design.
- [ ] iPhone acceptance: confirm the result now feels like the instrument changing state rather than a card appearing on top.

## Current cut: system chassis

- [x] Mount HOME / MUTE / SET on one shared fixed service rail instead of presenting three unrelated web buttons.
- [x] Reuse hard planes, chamfer logic, standing shadow and physical press travel from the mature control-deck language.
- [x] Keep HOME as an acid-biased navigation control; keep MUTE neutral until muted, then shift it to the rust fault family.
- [x] Turn Settings into a service hatch using the same chassis material rather than a generic floating popover.
- [x] Preserve current system-control behavior, 44px+ touch targets, audio state, clear-mode behavior and reset-session behavior.
- [ ] iPhone acceptance: confirm the fixed controls now feel bolted to the device rather than overlaid by the website.

## Remaining cuts / cleanup

### 1. Loading / transition sprite art

- [x] Add a prebaked 10-frame low-resolution D20 rotation strip to the repo for true boot loading.
- [x] Play it as discrete CSS frames so it is available before Three.js or WebGL initializes.
- [x] Reuse the same loading object for Dice / Choice module-loading transitions.
- [x] Keep the animation deliberately low-frame and object-focused; no generic spinner or fake percentage progress.
- [ ] Re-grill the exact D20 frame art against the production D20 geometry / face language now that the chassis is mostly unified.

### 2. Dice Setup acceptance / cleanup

- [ ] Review two-column specimen-window spacing on iPhone.
- [ ] Check whether the low-frame turntable feels intentional rather than merely flickery.
- [ ] Remove dead flat-relief CSS after the 3D specimen-window language is accepted.
- [ ] Reassess rack-level microcopy only after the object hierarchy is visually accepted.

### 3. HOME asset cleanup

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
