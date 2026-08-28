# M6 Dice Art Locks

This file records the current visual lock state for the M6.2B dice-art pass.

## Locked — do not change without explicit reopening

### D4
- Traditional vertex-read layout.
- Result is carried by the bottom face and read from the opposite top vertex.
- Each vertex is surrounded by three identical numerals: `111 / 222 / 333 / 444`.
- All three copies point toward the corresponding vertex.
- Approved oversized corner numerals: large decal, slightly pulled back toward face center.
- Warm dark ink + shallow engraved highlight/edge treatment.

### D6
- Large traditional pips.
- Face `1` uses muted old-dice red.
- Faces `2–6` use warm dark ink.
- Shallow engraved highlight treatment.

### D8
- One large centered numeral per triangular face.
- Warm dark ink + shallow engraved treatment.
- `6` keeps an underline for orientation.

### D10
- Physical faces display `0–9`; physical `0` resolves logically as `10`.
- Approved oversized single-digit layout and orientation.
- `6 / 9` keep underlines.
- Shallow engraved highlight + dark cut-edge treatment is now included.

### D20
- Layout A is approved and locked.
- Numeral baseline is parallel to the selected triangle base edge.
- Numeral stands higher toward the opposite apex rather than lower toward the base edge.
- Approved numeral size, warm dark ink, shallow engraved treatment, and `6 / 9` orientation marks remain unchanged.
- Layout B was comparison-only and is not the selected production direction.

### D100
- Uses two physical D10-family bodies.
- Tens layout is locked: large main digit toward the blunt end, smaller `0` toward the pointed end.
- Tens orientation is locked and has no `6 / 9` underline.
- Ones layout matches the approved oversized single-D10 style.
- Ones `6 / 9` keep underlines.
- Tens and ones both include shallow engraved treatment.
- Result semantics remain unchanged: `00 + 0 = 100`.

## Pending

### D3
- Semantic contract remains `circle = 1`, `cross = 2`, `hollow square cut = 3` on the existing cube body.
- Current v2 art pass is in `experiments/d3-art-lab.html`.
- Circle and cross are oversized, heavier shallow engravings.
- Value `3` uses a centered hollow square engraving about 70% of the face width.
- The square is outline-only: its interior and the surrounding face retain the body color with no fill.

## Scope rule

When working on the remaining D3 experiment, do not refactor or visually alter locked D4 / D6 / D8 / D10 / D20 / D100 code paths. Promote art into production only after the D3 decision is explicitly approved.
