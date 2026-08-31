# M6 Dice Art Locks

This file records the final visual lock state for the M6.2B dice-art pass.

## Locked — do not change without explicit reopening

### D3
- Existing cube body and paired-face `1 / 2 / 3` semantics remain unchanged.
- `1` = oversized dark circle engraving.
- `2` = oversized muted-red cross engraving.
- `3` = centered square groove about 70% of the face width.
- The `3` square has **no ink and no fill**: transparent marking pixels expose the actual die-body color; only a faint offset highlight/shadow pair suggests the recessed groove.

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
- Physical markings display `0–9`; the face displayed as physical `0` still resolves logically as `10`.
- Approved oversized single-digit layout and orientation.
- `6 / 9` keep underlines.
- Shallow engraved highlight + dark cut-edge treatment.

### D20
- Layout A is the production layout.
- Numeral baseline is parallel to one deterministic triangle base edge.
- Numeral center uses the approved `medianT = 0.47`, standing higher toward the opposite apex.
- Approved numeral size, warm dark ink, shallow engraved treatment, and `6 / 9` orientation marks remain unchanged.
- Layout B was comparison-only and is not production art.

### D100
- Uses two physical D10-family bodies.
- Tens layout: large main digit toward the blunt end, smaller `0` toward the pointed end.
- Tens orientation is locked and has no `6 / 9` underline.
- Ones layout matches the approved oversized single-D10 style.
- Ones `6 / 9` keep underlines.
- Tens and ones both include shallow engraved treatment.
- Result semantics remain unchanged: `00 + 0 = 100`.

## Production promotion

All seven approved dice-art paths are now implemented in `src/render/face-markings.js`.
The formal renderer no longer needs experiment factories for these markings.
The experiment files remain as visual-development history and comparison references only.

## Scope rule

D3 / D4 / D6 / D8 / D10 / D20 / D100 are all visually locked. Do not alter their marking layout, size, color, orientation, or engraving treatment without explicit reopening.
