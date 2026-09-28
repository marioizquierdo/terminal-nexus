# Gate report — Milestone 5, Gate 5I: placement juice

**Document role:** Gate evidence report for Gate 5I
**Status:** COMPLETE — PASS, awaiting the owner's look
**Canon version:** 2.23
**Updated:** 2026-09-28
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.23. The building session did not edit `specs/`, `AGENTS.md`, `milestones/` or
  `docs/feedback/`; it proposes their text in Section 9 for the orchestrating session to apply.
- **Milestone and gate:** Milestone 5 — Build Phase, gate 5I, placement juice (feedback F9).
- **Question this gate answers:** can placing a building feel like something happened — a short run of
  frames of its own as it goes up, a brief light on its characters, a few sparks around it — while
  staying pure presentation (the plan identical with every effect on or off, every instant a function
  of the time since placement), legible in every colour tier and theme, calm under reduced motion,
  and with every number a Debug Mode flag the owner can switch off?
- **Smallest artifact that can answer it:** the existing `terminal-nexus --spike` screen and the
  browser playtest page (same loop), with: placement frames authored as data beside the structure art
  for the three menu structures, plus a generic fallback; one new effect recipe for the sparks, in the
  `effects` band, hashed from the placement's identity; one new style field — a role pulled toward
  another role — resolved per tier by the renderers; the live loop timing each placement from the
  frame that first drew it; and four Debug Mode flags.
- **Automated evidence planned:** frame, light and spark tests against a named elapsed time; undo,
  removal and a second placement mid-animation; the corruption law over a whole run; the hash being
  of identity not time; the plan identical with every flag changed by keys; every tier drawing
  identical frames; keyboard and mouse animating identically; the tint's resolution per tier and on
  the canvas; a frame-budget measurement with every effect at its heaviest; the existing effect
  contract suite (purity, bands, three forms) over the new recipe.
- **Human observation planned:** the owner, at his next playtest: place each building at the defaults,
  then flip Lighting to rainbow, Particles to many, and Build animation to its slowest and off, and
  say what stays. This session looked at every new image itself (Section 5).
- **Explicit exclusions:** no removal or undo animation (a follow-up); no placement juice outside the
  Build Phase; no new Pulse effects; nothing in `src/pulse` or `src/state`; no sound.
- **Stop conditions:** the reducer needing a clock; an effect replacing a building's glyph; the frame
  budget broken; a tier showing different glyphs from another.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux 6.18.44 x86_64 (the cloud session's container) |
| Runtime and exact version | Node 22.22.2; Bun 1.3.11 |
| Dependencies and exact versions | `typescript` 7.0.2, `@types/node` 22.20.1, `@opentui/core` 0.5.6, `gifenc` 1.0.3, `pngjs` 7.0.0 (unchanged from gate 5H); tmux for one live-terminal check |
| Hardware, if it affects measurements | the frame-budget figures are wall-clock on a shared container; everything else is tested against a named time |
| Date measured | 2026-09-28 |

Commands, in the order they were run for this report:

```bash
./scripts/check-repository.sh
npm run typecheck
node --test tests/build-placement.test.ts
npm test
npm run test:bun
bun scripts/build-web.mjs
node scripts/capture-spike-screenshots.mjs
```

## 3. What was built

- **Placement frames as content** — `PLACEMENT_ART` in `src/content/art.ts` (CC BY-SA 4.0 like the
  rest of the art), the frames *before* the finished building, foundation first; a space is "nothing
  standing here yet". Authored for the Barracks (footings `._.`, walls, roof beam `[ ]`, then `[b]`),
  the Hatchery (grown, not built: seeds, a swelling `()` sac, the peak splitting `/\`, then the egg
  sac) and the Turret (`.` `:` `|`, then `!`). Anything without frames gets a generic run derived from
  its own finished art: footings along the bottom row, then its rows revealed from the ground up
  (`placementRun`, `src/view/placement.ts`).
- **The timeline** (`src/view/placement.ts`): frames for "Build animation" ms, drawn plain (a
  scaffold); then the finished building, bold as always, lit and throwing sparks for "Glow time" ms;
  then exactly the still frame. At the defaults (450 + 400) it is over in 850 ms.
- **Light as a style-role operation** — `CellStyle.tint: { role, amount }` (`src/view/frame.ts`,
  resolved in `src/view/roles.ts`): the cell's own role pulled toward another role. Truecolor blends
  the two roles' RGB exactly; 256 colours blends then takes the nearest palette entry (cached);
  16 colours has no blend, so it is a step — the other role's own ANSI hue from half up; monochrome
  shows nothing, and the plain-scaffold-to-bold-building change carries it there. "Light" pulls toward
  `fx.flash`, the theme's strongest ink (white on dark, near-black on light), with a fast fall and slow
  settle. "Rainbow" pulls toward six new roles, `fx.hue.red` … `fx.hue.magenta`, each with its own
  RGB and ANSI hue per theme, stepping every 60 ms in a diagonal wave across the footprint and fading
  back. The direct-ANSI encoder (and so every PNG), OpenTUI and the browser page's canvas all pass the
  tint through the same resolver.
- **Sparks** — `fx.structure.place`, a new recipe in `src/view/effects/recipes.ts` under the same
  contract as the Pulse's effects: a handful of `*` sparks launched from the ring one tile outside the
  footprint, flying outward (`'` up, `,` down, `+` sideways) and thinning to dim `.` dust. Randomness
  is `cosmeticHash` of the plan ordinal, the structure id and the anchor — never of the moment placed,
  never a stream. Six for "few", fourteen for "many"; in rainbow mode each spark takes a hue. Reduced
  motion: a still `+` at the four corners outside the footprint for the glow. The Build Phase view
  drops any spark on a tile a building stands on — standing, planned, or still going up (the corruption
  law, enforced where the Build view composes, as the Pulse compositor does).
- **The clock** — `BuildAnimation.placementsAt` (`src/view/build-live.ts`) notes, per plan ordinal
  and structure-and-anchor, the time of the first frame that drew it, forgets it the moment it leaves
  the plan, and hands the view `{ ordinal, elapsedMs }`; the frame timer runs while any is animating.
  Whatever is already planned on the very first frame is not animated. The reducer is untouched.
- **Debug Mode, first four rows** (`src/build/debug.ts`): Build animation (off / 200 / 300 / 450 /
  600 / 900 ms, default 450), Lighting (light / rainbow / off, default light), Particles (few / many /
  off, default few), Glow time (off / 150 / 250 / 400 / 600 / 900 ms, default 400). All apply at once.
  The list is now twenty-four flags.
- **Reduced motion** (the player's own setting, `settings.reducedMotion`, passed to the live loop and
  the view): no frames, no light, the finished building at once; sparks become the still corner mark.
- **Evidence tooling** — `placementGif` and `placementSheet` in `scripts/capture-spike-screenshots.mjs`
  step `BuildAnimation` with a fake clock (like 5H's `slideGif`); the sheet puts a window of the Grid
  at seven instants side by side, readable on a phone without playing anything.
- **Docs** — `docs/ui-patterns.md` Section 7b, `DEVELOPMENT.md`, and the playtest skill (new Debug
  Mode order, how to draw an instant of a placement).

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| `./scripts/check-repository.sh` | passes; canon 2.23, gate 5I | run verbatim |
| `npm run typecheck` (Node and web configs) | clean | run verbatim |
| `npm test` | 493 tests, 493 pass, 0 fail | run verbatim |
| `npm run test:bun` | every file passes under Bun 1.3.11 | run verbatim |
| `bun scripts/build-web.mjs` | `dist/terminal-nexus-playtest.html`, 157 KB, 82 source files; the "no Node module reachable" build check holds | run verbatim |
| Placement frames match their footprints; the three menu structures have their own | pass | `tests/build-placement.test.ts` |
| Generic fallback for an undrawn structure (Citizen Nexus, Ravel den) | pass | same |
| Barracks plays its three frames, then `[b]`/`|_|`; scaffold plain, finished bold; lit at 1.0 at the impact, partway at half the glow, and the settled frame is byte-identical (ANSI) to the still frame | pass | same |
| Rainbow uses all six hue roles and fades | pass | same |
| Build animation off + lighting off: finished and unlit at t = 0 | pass | same |
| Reduced motion: finished at once, no tint, a still mark identical across the glow | pass | same |
| Sparks: never on a building tile at any 10 ms step of a "many" run; some are drawn | pass | same |
| Sparks hash identity, not time: the same placement placed at clock 1 000 and 91 000 gives the same clocks; another ordinal scatters differently | pass | same |
| Live clock: timed from first draw; `busyUntil` covers the whole run; stops when settled; already-planned on first frame not animated | pass | same |
| Undo mid-animation is exactly the one-building frame at that instant; a stale clock draws nothing; removing the last stops everything; put back later starts over; two placements keep two clocks | pass | same |
| The plan is identical with all four flags changed by Debug Mode keys | pass | same |
| All four tiers compose identical frames mid-animation (rainbow on) | pass | same |
| Keyboard and mouse placements animate identically, tile for tile | pass | same |
| Tint resolution: exact truecolor midpoint; 256 changes; 16 steps at 0.5; monochrome none; OpenTUI/canvas 16-colour mirrors; zero tint is none; light theme pulls darker | pass | same |
| The canvas paints the lit colour the resolver gives | pass | same |
| Effect contract over `fx.structure.place` (purity, window, band, ASCII width, declared roles, all three forms at impact) | pass | `tests/effects.test.ts` |
| The placement module and the live loop name no clock | pass | `tests/architecture.test.ts` (placement.ts added) |
| Every earlier "same plan, every adapter" and still-frame test | unchanged, pass | `npm test` |

Measurements:

| Metric | Value | Method | Samples |
| --- | --- | --- | --- |
| Build Phase frame, compose + truecolor encode, 104x32, three buildings animating, many sparks, rainbow | p50 3.5 ms, p95 6.4–8.1 ms (two runs) | `tests/build-placement.test.ts`, last test; `performance.now()` | 200 frames per run |
| The live loop's frame interval | 16 ms | `FRAME_MS` | — |
| Default placement run | 850 ms (450 frames + 400 glow) | `placementTiming` | — |
| New GIFs | 181–194 KB each (budget ~1 MB) | `ls -la evidence/screenshots/build-place*` | 7 files |

## 5. Human observations

**The owner has not looked at it yet.** This session looked at every new image with its own eyes
before trusting it:

- `build-place-sheet-barracks.png`: footings, walls, roof beam, a white `[b]` at 450 ms, sparks above
  and below at 500–600 ms, settled orange by 750 ms. Reads as "built", not as a glitch. The Barracks
  the smart cursor chooses sits between the Grid Nexus and the standing Barracks, so the sparks can
  only go up and down — the corruption rule is visibly doing its job.
- `build-place-sheet-hatchery.png`: the grown-not-built sequence reads; the finished egg sac is lit
  white, then orange. Its first frame (`.,` seeds) is close to the ground lattice's own dots — quiet,
  perhaps too quiet.
- `build-place-sheet-turret.png`: dot, stack, mast, alarm. At one tile the frames are small but legible.
- `build-place-sheet-rainbow.png`: the hues sweep diagonally across `[b]`/`|_|` and the sparks are
  multicoloured; it is loud, which is what a rainbow is for.
- `build-place-sheet-light.png`: on the light theme "light" pulls the rust toward near-black, so the
  building reads as ink setting rather than a glow. Legible, but not what "light" means on a dark
  terminal — see Q64.
- `build-place-sheet-16.png`: the step is clear — bright white, then back. (It also shows that the
  16-colour capture renders the Citizens' ANSI 33 as yellow, not rust; that was true before this gate.)
- `build-place-sheet-monochrome.png`: plain scaffold, then bold building; the sparks are there. The
  light itself is invisible, as chosen.
- `build-place-reduced-motion.png`: finished Barracks, four `+` at the corners, nothing else moving.
- `build-debug-80x24.png`: the popup opens on "Build animation 450 ms" with its question underneath;
  "v 19 more".
- A live `terminal-nexus --spike` in tmux (80x24, truecolor): 150 ms after Space the pane showed the
  `._.` footings; 1.2 s later the finished `[b]`. The loop settles and stops drawing.

## 6. Interpretation

The whole of F9's ask is connected end to end — frames, particles, light, rainbow — on the terminal and
the browser page, and the defaults are a first guess for the owner to feel. The one real choice made
without him is what "light" means on the light theme; it is registered rather than argued (Q64). The
monochrome answer — the light is simply not there, and the frames' plain-to-bold step carries the
moment — is honest: an inverse flash would have been louder but spends "reserved visual weight"
(craft rule 4) on something that happens every few seconds in a Build Phase.

The frame budget is not a worry: the heaviest case costs under half the live loop's 16 ms at p95.

## 7. Failures, surprises, and discarded approaches

- **Shell edits refused in the isolated worktree.** A `python3 - <<EOF` heredoc followed by another
  command in the same Bash call was refused as "too complex to verify stays inside the worktree"; the
  debug.ts edit silently did not happen the first time (caught by a `grep -c`). Writing the Python to
  the scratchpad and running it as its own call works.
- **The effect vocabulary test counts recipes.** `tests/effects.test.ts` asserts the exact number of
  recipes, on purpose (ascii-effects.md 5.1: a new effect is a decision). Updated it and added the
  recipe to the shared contract fixtures rather than hiding the sparks outside `EFFECT_RECIPES`; the
  canon table needs a row (Section 9).
- **Hash identity, not start time.** The Pulse recipes hash `startMs`; for a placement that would make
  the scatter depend on when the player pressed Space. The recipe hashes ordinal, content and anchor
  instead and passes 0 where the start time would go.
- **A Debug Mode restart numbers the plan from 1 again,** so the live clock keys each ordinal together
  with its structure and anchor; a same-ordinal different placement starts over.
- **Keyboard vs mouse comparison of whole frames failed for reasons unrelated to juice**: a click
  moves the camera differently and leaves the keyboard on the Grid (so the cursor is drawn). The test
  compares tiles around the building, in view in both, with focus set to the menu.
- **Discarded: animating inside the scripted playtest runner.** Frames right after the placing key
  would have been at t = 0 (footings), changing what every existing flow test and screenshot shows.
  Script frames stay finished; the capture script steps a fake clock for animation evidence.
- **Discarded: a monochrome inverse flash.** See Section 6.
- **Noticed, not fixed:** dust `.` shares a glyph with the ground lattice; in colour it is warmer, in
  monochrome it merges. It reads as dust settling into the ground, which may be fine.

## 8. Decision

> **PASS**

Every item in gate 5I's definition of done is built and connected — frames with a generic fallback,
undo/removal correct at once, sparks in the effects band under the corruption law with identity-hashed
randomness, a style-role light resolved per tier and theme with a rainbow value, every effect a pure
function of time since placement, off under reduced motion, and each a Debug Mode flag with an off
value; the reducer has no clock and the plan is identical with every effect on or off; the terminal
and the browser page draw it, inside the frame budget. What is left is the owner's feel.

## 9. Canon impact

Proposed for the orchestrating session to apply (GUIDANCE unless marked):

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| `CellStyle.tint?: { role, amount }` — a foreground role pulled toward another role; truecolor blends, 256 blends then quantizes, 16 steps onto the other role's hue at ≥ 0.5, monochrome ignores it; applied before `fade`. Scope: placement light only | `engine.md` 9.1 (RULE, like `fade`) | this gate |
| Six hue roles `fx.hue.*` for the rainbow, per theme like any role | `engine.md` 9.1 / roles table | this gate |
| Placement frames are content: an optional per-structure list of frames before the finished art, footprint-sized, a space is empty ground; a generic fallback derived from the finished art so no content blocks | `engine.md` 9.6 (beside "the simulation never knows a glyph") and `ascii-effects.md` | this gate |
| `fx.structure.place` joins the vocabulary: Build Phase, `effects` band, IMPACT + DECAY of a placement; reduced form a still corner mark | `ascii-effects.md` Section 5 table | this gate |
| Placement juice is presentation only: timed by the live loop from the first frame that drew it, drawn as a function of (plan, time since placement), forgotten when the placement leaves the plan | `engine.md` 9.2 / `ui-patterns.md` (done) | this gate |
| Placement sparks hash the placement's identity (ordinal, structure, anchor), never its start time | `ascii-effects.md` Section 1 rule 3, as a note | this gate |

Questions raised (for the orchestrator to register):

| ID | Question | Recommendation |
| --- | --- | --- |
| Q64 | On the light theme, should a building's "light" pull toward the theme's darkest ink (built: it reads as ink setting) or toward a warm glow role of its own (amber on both themes)? | Keep the darkest ink until the owner plays the light theme; a warm `fx.glow` role is one table row per theme if he wants it |
| Q65 | Should undo and Backspace get a short removal animation too (the reverse frames, a puff of dust)? | Yes, but as its own small gate after the owner has felt placement; removal must stay correct at once, so it would be an effect over empty ground, not a delayed disappearance |

## 10. Next authorized action

The owner places buildings with the defaults, then flips Lighting, Particles and Build animation in
Debug Mode and says which values stay; the orchestrating session carries on through the feedback log.
