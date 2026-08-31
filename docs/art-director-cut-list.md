# Art Director Cut List

This file tracks visual-integration cuts that are agreed but not yet completed.
It exists so visual decisions do not get lost across iterative HOME / DICE / CHOICE passes.

## Locked / keep

- HOME marquee motion and current three-part composition: top strip + dim background field + main Z band.
- Choice slot interaction timing and basic stage rhythm. It is currently the strongest interaction reference.
- Production Dice Art face rules and M6.2A renderer rules remain locked unless explicitly reopened.
- Dice Roll stays the only place that runs the full physics simulation.
- HOME logo typography / line-break problems remain intentionally open; do not fold them into panel / chassis cleanup.

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

## Macro Chassis v1

- [x] Introduce a macro-level HOME cabinet instead of treating the page background as the final visual world.
- [x] Add one recessed `home-main-stage` aperture behind the locked HOME marquee / logo composition so those elements read as display content.
- [x] Keep marquee count, cadence and major composition locked while changing their physical context from page content to screen content.
- [x] Recompose HOME toward a large display + thick lower control bay while leaving logo-specific typography issues for a later dedicated pass.
- [x] Separate Display World (marquee / logo / dice imagery) from Hardware World (mode keys / cabinet / service key).
- [x] Remove the full HOME system dock from the primary surface: HOME and MUTE are hidden there; SET remains as one small service-hatch key and sound remains available inside Settings.
- [x] Extend the same outer-cabinet side rails, crown plate, display aperture depth and lower control-bay grammar to Dice / Choice function screens.
- [x] Visually mount Dice ARMED `POOL / BODY / MOD` into the chamber display instead of letting it read as an independent card above the instrument; defer the literal DOM move until cleanup after visual acceptance.
- [x] Mount Choice `填寫選項`, Dice Setup selector/workspace, ROLL controls and the fixed Dice confirmation rail as auxiliary / lower bays of the same cabinet rather than unrelated panels.
- [x] Keep function-mode service keys available but mount their rail into the cabinet crown instead of treating it as a separate website toolbar.
- [ ] iPhone acceptance: confirm HOME, Dice and Choice now read as one cabinet family; verify embedded Dice readout clearance, Choice drawer-to-stage joint, and lower control-bay proportions.
- [ ] Re-evaluate whether Dice / Choice need any persistent external system rail after real-device acceptance.

## Settlement stage takeover

- [x] Remove the generic floating-card reading from Dice / Choice settlement.
- [x] Make the parent instrument enter explicit RESULT / REJECTION states while preserving existing settlement sequencing and data.
- [x] Dim the physical chamber / reel underneath rather than visually stacking another unrelated card above it.
- [x] Make Dice TOTAL and Choice final index / label occupy the square instrument aperture itself.
- [x] Preserve rejection visibility and give it a temporary fault-state treatment instead of a separate modal design.
- [x] Pin `查看詳細資料` to a fixed bottom-right chassis position so variable result height cannot move the control.
- [ ] iPhone acceptance: confirm the result now feels like the instrument changing state and the fixed Details key does not collide with result copy.

## System chassis

- [x] Mount HOME / MUTE / SET on one shared fixed service rail instead of presenting three unrelated web buttons.
- [x] Reuse hard planes, chamfer logic, standing shadow and physical press travel from the mature control-deck language.
- [x] Keep HOME as an acid-biased navigation control; keep MUTE neutral until muted, then shift it to the rust fault family.
- [x] Turn Settings into a service hatch using the same chassis material rather than a generic floating popover.
- [x] Preserve current system-control behavior, 44px+ touch targets, audio state, clear-mode behavior and reset-session behavior.
- [ ] iPhone acceptance: confirm the fixed controls now feel bolted to the device rather than overlaid by the website.

## Current cut: Dice / Choice interface cleanup

- [x] Add a final subtraction pass after the art-direction layers instead of inventing another decorative system.
- [x] Preserve die descriptions and the 3D specimen-window hierarchy requested during review.
- [x] Split Dice Setup into three work areas: `選骰子 3～20`, `選骰子 100`, and `調整值`.
- [x] Keep `選骰子 3～20` active by default; isolate D100 into its own larger specimen bay.
- [x] Add a real Dice modifier to SessionState with a stored system limit of ±9999 while exposing only ±99 in the current UI.
- [x] Apply the modifier after physical dice settle so settlement / history / details all share `subtotal + modifier = TOTAL`.
- [x] Fix a viewport-level Dice Setup rail so `加總 +N`, pool/body summary, and `確認` stay visible during all setup scrolling.
- [x] Choice Setup reduces to count → ARM, with version/help copy removed from the primary surface.
- [x] Remove the Choice ARMED summary / method-card stack from above the instrument.
- [x] Embed `OPTIONS` as a compact numeric readout in the active Choice instrument itself.
- [x] Replace DICE / SLOT tabs with one physical left-right `骰子 / 滾輪` switch mounted inside the instrument.
- [x] Preserve method recommendation only as a tiny indicator light instead of another text label.
- [x] Rebuild the optional naming control as a larger physical drawer with a visible pull handle / arrow and recessed tray.
- [x] Rename the naming drawer to `填寫選項` so it reads as optional labeling rather than the act of making the decision.
- [x] Keep the Choice method switch above RESULT after settlement; only lock it during the temporary INVALID → REROLL fault sequence.
- [x] History remains available but is visually subordinate and height-limited so it cannot dominate setup.
- [ ] iPhone acceptance: judge Dice tab sizes / fixed rail clearance, Choice switch size, drawer physicality, OPTIONS placement, and whether a second DOM-deletion cleanup is still useful.

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
- [ ] Verify the fixed bottom Dice rail clears Safari safe-area / browser chrome while scrolling every setup tab.
- [ ] Remove dead flat-relief CSS after the 3D specimen-window language is accepted.
- [ ] Move the visually embedded Dice ARMED data strip into the stage DOM after its composition is accepted.
- [ ] If the interface-cleanup pass is accepted, remove now-hidden redundant status markup and dead selectors instead of leaving them as permanent overrides.

### 3. HOME asset cleanup

- [ ] Remove obsolete P1 / P2 experimental HOME CSS files only after the current Art Director HOME pass is accepted and no rollback is needed.
- [ ] Retire the failed html2canvas render probe from the product path; keep only if useful as an archived experiment.

## Product-level visual rule

Treat the product as a late-1990s dedicated decision-assistance machine:

- object-level age: low-poly dice, hard bevels, limited colors, physical controls;
- display-level age: hard pixel separation, low-resolution 3D, stepped motion where appropriate;
- macro-level age: one physical cabinet must contain screens and controls instead of allowing every interface layer to occupy the same flat world;
- avoid decorative retro noise: no gratuitous glitch, scanline, HUD text, black-grain overlays, or REC/SYS clutter unless it has a machine function.

Shared color semantics:

- cream: content / primary read value / object surface;
- acid yellow-green: READY / valid / selected / primary action;
- rust red: warning / invalid / secondary material bias;
- olive-black: chassis;
- grey-green: engraved / inactive / secondary information.
