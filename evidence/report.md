# Gate report — Milestone 1A, the Pulse Playground

**Document role:** Gate evidence report for Gate 1A
**Status:** Complete, awaiting owner acceptance
**Canon version:** 2.5
**Updated:** 2026-08-21
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.5
- **Milestone and gate:** Milestone 1 — the Pulse Playground; Gate 1A (CURRENT).
- **Question this gate answers:** Does a scenario file plus a seed resolve into a byte-identical
  report every time, and can a person watch that same Pulse and follow what happened?
- **Smallest artifact that can answer it:** one TypeScript source tree with no build step, holding a
  deterministic rules kernel (Grid, collision masks, tick loop, movement credit, arbitration,
  attacks, damage, victory), a scenario file format and loader, a levelled report derived only from
  events plus state, a minimal ASCII view over `ReadonlyCellFrame`, and a `playground` CLI with
  `run`, `watch`, and `verify`. Plus one scenario per rule in `scenarios/`, and the tests of
  Section 3.9.
- **Automated evidence planned:**
  - determinism: 20-run hash equality per scenario; one-call resolve equals tick-by-tick; kernel
    touches no clock and no `Math.random` and imports nothing from `src/view`; PRNG matches
    published vectors; cosmetic seed changes nothing; `parse(serialize())` hashes identically;
    **identical hashes under Bun 1.3.11 and Node 22.22.2**;
  - Grid and collision: no overlap in any mask including both layers at any tick; worker and ground
    unit may share a tile; cross-layer blocking by a structure; the 3x1 hauler refused a two-tile
    gap and admitted to a three-tile one; footprints never leave the Grid; range to the nearest
    occupied tile; arbitration bounded with a strictly decreasing progress measure;
  - rules: the movement-credit cadence table at every rate; blocked actors keep credit; mutual kills
    kill both; one named scenario file per rule;
  - view: exact composition size, width-one glyphs, pure `snapshotAt`, frame-skip independence,
    30 fps over 60 s with p95, one disposer on every lifecycle path, resize gate, **glyphs on
    authoritative tiles asserted against the event stream**, `watch` and `run` agreeing on hashes,
    monochrome rendering without error.
- **Human observation planned:** Mario watches `playground watch scenarios/citizen-mirror-skirmish.ts`
  in colour and again in monochrome, and is asked: could you follow who moved, who shot whom, and
  who died? The monochrome answer is the gate's legibility check and no automated test substitutes
  for it (governance Section 2).
- **Explicit exclusions:** Gate 1B render tiers and effects; economy, production, supply, upgrades,
  the Commander, visibility filtering, the Build Phase, selection, inspection, scrolling; every
  faction except Citizens; packaging, SSH, browser delivery, multiplayer, sound, mod loading; any
  Rust or Go migration. Economy and production exist as **empty tick phases** only.
- **Stop conditions:**
  - the same seed and scenario produce different hashes on one machine, or between Bun and Node, and
    the cause is not fixable inside this gate — **STOP**, since every later question depends on it;
  - the ASCII view cannot show a mirror skirmish legibly at 80x24 in monochrome — **REVISE** on the
    composition, named;
  - OpenTUI fails exact cell control, 30 fps on a 24x12 Grid, the lifecycle of Section 3.8, or a
    version pin that holds still for the gate — **REVISE with that criterion named**, per
    Section 3.8, and ship the direct-ANSI fallback;
  - a named contract in the milestone turns out to be wrong — **REVISE** naming the contract, which
    the milestone explicitly calls a good result.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux 6.18.44-fc-v21, x86_64, Claude Code web container (Debian-based) |
| Runtime and exact version | Node.js **v22.22.2** and Bun **1.3.11**. Both execute the TypeScript sources with no build step |
| Dependencies and exact versions | `@opentui/core` **0.5.6** (MIT), `typescript` **7.0.2**, `@types/node` **22.20.1**. All pinned exactly; a test asserts no range specifiers exist |
| Hardware, if it affects measurements | Container CPU, shared. Frame-time and resolve-time numbers are indicative of this container only and were re-measured on both runtimes |
| Date measured | 2026-08-21 |

Commands, copy-pasteable, in the order a stranger would run them:

```bash
# install — needed only for type checking and the OpenTUI backend.
# run, watch and verify work from a clean checkout with no dependencies at all.
npm install

# build
# there is none: Node 22.18+ and Bun 1.3+ run the TypeScript sources directly

# test
npm run typecheck          # tsc --noEmit
npm test                   # node --test over tests/*.test.ts
npm run test:bun           # the same suite under Bun, one file at a time
./scripts/check-repository.sh

# run
./bin/playground.ts run    scenarios/citizen-mirror-skirmish.ts
./bin/playground.ts run    scenarios/citizen-mirror-skirmish.ts --log-level debug --ticks 120
./bin/playground.ts run    scenarios/citizen-mirror-skirmish.ts --events events.jsonl --json
./bin/playground.ts watch  scenarios/citizen-mirror-skirmish.ts
./bin/playground.ts watch  scenarios/citizen-mirror-skirmish.ts --capability monochrome
./bin/playground.ts verify scenarios/citizen-mirror-skirmish.ts --runs 20

# evidence artifacts in this directory
node scripts/capture-frames.mjs citizen-mirror-skirmish 0 112 160 240
node scripts/capture-screenshots.mjs           # drives a real PTY and writes evidence/screenshots
./bin/playground.ts run scenarios/citizen-mirror-skirmish.ts \
  > evidence/citizen-mirror-skirmish-summary.txt 2> evidence/citizen-mirror-skirmish-info.txt
```

## 3. What was built

About 4,500 lines of source and 1,900 lines of tests, in the module shape Section 3.2 sketched plus
one addition.

- **`src/grid`** — coordinates (`(0,0)` north-west, `x` east, `y` south, `n` toward `y-1`), the five
  layers, footprints, Chebyshev distance, and collision masks.
- **`src/state`** — *the addition*. `MatchState`, the canonical serialization, and the hashing that
  every comparison in this report runs through. It exists because both `src/report` and `src/view`
  need the state type while being forbidden to import the kernel, and engine.md Section 2 wants
  shared contracts to be leaves of the import graph. Section 3.2's tree did not name it.
- **`src/rng`** — PCG32, one named PRNG with serialisable state.
- **`src/content`** — the six fixture definitions of Section 3.6, as plain data.
- **`src/events`** — the fifteen-member `DomainEvent` union and its JSONL serialization.
- **`src/scenario`** — `defineScenario`, the preset matrix, and a loader that validates.
- **`src/pulse`** — the nine phases of engine.md 4.3 in order, including the two empty economy
  phases; movement credit; arbitration; simultaneous per-tier damage; victory.
- **`src/report`** — log levels, the fixed-column line grammar, the run summary, and a replay that
  rebuilds the cast from events alone.
- **`src/view`** — the style-role vocabulary, `ReadonlyCellFrame`, the band compositor, the 80x24
  composition, a pure `snapshotAt`, the playback clock and its resize gate, and two backends behind
  `TerminalBackend`.
- **`src/cli`** and **`bin/playground.ts`** — `run`, `watch`, `verify`, and the timeline builder that
  is the one place the kernel and the presentation meet.
- **`scenarios/`** — fifteen files: the mirror skirmish plus fourteen single-rule fixtures.

Four decisions the canon left to the spike, recorded because the milestone asks for them:

**Collision-mask caching (engine.md 3.4.1 deliberately does not prescribe it).** Masks are never
materialised. One `OccupancyIndex` holds, per entity layer, an `Int32Array` of `ordinal + 1` per
tile; it is built when a tick begins and mutated in place when a move settles. A `CollisionMask` is
a lazy view over it — a layer list, a terrain rule, an ignore set — so constructing one is O(1) and
allocates nothing, and composing a fresh mask per query is cheap enough that nothing is tempted to
cache one. Arbitration writes granted claims into a `ClaimOverlay` layered on the same index, so a
query made later in the same phase sees tiles claimed earlier in it. There is no window in which a
mask answers from stale data, because there is no copy to go stale. The cost is one indexed lookup
per layer per query; at Gate 1A sizes it does not appear in a measurement.

**Vacated tiles do not free within the same tick.** Every phase reads the state settled at the end
of the previous phase, so a mover's origin tile still blocks while it moves. A unit following
another therefore steps one tick behind rather than in lockstep. This keeps "no two entities ever
overlap" true by construction and keeps arbitration's progress measure simple.

**Annihilation needs a roster.** Q13 defines annihilation as "every entity on `workers`, `units` and
`air` is dead", which is vacuously true for a side that never had one — a structures-only fixture
would end on tick 1. The kernel therefore records, from the initial state, whether each side started
with a Grid Nexus and whether it started with anything mobile, and only applies each victory
condition to a side that could lose it that way.

**Routing shipped as greedy plus a deterministic sidestep**, the floor the milestone names. It was
not upgraded to A\*, because the mirror skirmish never showed a unit stalling against a rock: steps
are ranked by the distance they achieve, then by turn cost, then by a fixed compass order, and a
sidestep that holds distance level is legal — which is what carries an actor along an obstacle's
face and around it. `obstacle-routing` demonstrates a trooper rounding a six-tile spine. What greedy
cannot do is reach a gap that lies *behind* the mover; `hauler-two-tile-gap` shows that failure
deliberately, and Q15 records it.

## 4. Automated results

`npm test` — **98 tests, 98 passing, 0 failing** on Node 22.22.2. `npm run test:bun` — the same
files, all passing, under Bun 1.3.11. `npx tsc --noEmit` — clean. `./scripts/check-repository.sh` —
passes.

| Check | Result | Evidence |
| --- | --- | --- |
| Twenty runs, identical state hash, event hash and `INFO` log, all 15 scenarios | PASS | `tests/determinism.test.ts`; `playground verify --runs 20` |
| Resolving in one call equals resolving tick by tick, all 15 scenarios | PASS | `tests/determinism.test.ts` |
| Kernel calls no clock and no `Math.random` | PASS | `tests/determinism.test.ts` (runtime traps) and `tests/architecture.test.ts` (static scan) |
| `src/pulse` never reaches `src/view`, `src/report` or `src/cli` | PASS | `tests/architecture.test.ts`, transitive import graph |
| `src/report` never reaches `src/pulse` or `src/view` | PASS | `tests/architecture.test.ts` |
| PRNG matches published test vectors | PASS | `tests/rng.test.ts` against `imneme/pcg-c` `check-pcg32.out` |
| Cosmetic seed changes nothing about state, events or log | PASS | `tests/determinism.test.ts` |
| `parse(serialize(state))` hashes identically, all 15 scenarios | PASS | `tests/determinism.test.ts` |
| The JSONL event stream round-trips to the same hash and the same bytes | PASS | `tests/determinism.test.ts`; every kind emitted is a declared kind, and the only declared kind no scenario emits is `arbitration.bounded`, the warning that fires when arbitration hits its pass bound |
| **Identical hashes under Bun and under Node**, all 15 scenarios | PASS | `tests/cli.test.ts` spawns both runtimes and compares `--json` |
| No two entities overlap in a mask including both layers, at any tick | PASS | `tests/grid.test.ts`, every tick of every scenario |
| A worker and a ground unit may share a tile | PASS | `tests/grid.test.ts`; `share-tile-worker-unit` at tick 64, tile (6,5) |
| A ground unit is blocked by a structure on another layer | PASS | `tests/grid.test.ts` |
| An air entity may share a tile with a ground entity (Q8) | PASS | `tests/grid.test.ts`, using a test-only definition — no air content authored |
| 3x1 hauler refused a two-tile gap, admitted a three-tile one | PASS | `tests/grid.test.ts`, mask and scenario both |
| Multi-tile footprints never leave the Grid; destroyed as one entity | PASS | `tests/grid.test.ts`; the 3x2 Nexus emits exactly one destruction |
| Range measures to the nearest occupied tile | PASS | `tests/grid.test.ts` |
| Arbitration bounded, progress measure strictly decreasing | PASS | `tests/rules.test.ts` over `jammed-corridor`; no `arbitration.bounded` event ever emitted |
| Movement credit reproduces the cadence table at every rate | PASS | `tests/rules.test.ts`, all eight rates of engine.md 4.1 |
| Blocked actor keeps credit and steps the tick the tile frees | PASS | `tests/rules.test.ts` |
| Two equal-speed actors that kill each other both die | PASS | `tests/rules.test.ts`; `mutual-kill` ends at tick 61 with zero survivors |
| Speed tier is initiative, lower first | PASS | `tests/rules.test.ts` |
| Flight window is read by no rule | PASS | `tests/rules.test.ts`: changing projectile speed changes the event and not the state hash |
| A named, runnable scenario per rule | PASS | 15 files; `tests/scenario.test.ts` asserts one behaviour each |
| Loader fails loudly with line and column | PASS | `tests/scenario.test.ts`, nine failure cases |
| Frames are exactly the composition size, both tile widths | PASS | `tests/view.test.ts`: 80x24 and 128x24 |
| Every glyph is one printable ASCII cell | PASS | `tests/view.test.ts`, four sample times per scenario, both capabilities |
| Identical arguments produce identical frames; skipping frames changes nothing | PASS | `tests/view.test.ts`, forwards, backwards and after 400 intervening frames |
| **At a tick boundary every entity stands on its authoritative tile** | PASS | `tests/view.test.ts`, asserted against the event stream, not the compositor's inputs |
| `watch` and `run` agree on hashes | PASS | `tests/view.test.ts` (in process) and `tests/cli.test.ts` (across processes) |
| Monochrome renders every scenario; no cell depends on colour | PASS | `tests/view.test.ts`: identical glyphs in both modes, no colour SGR in monochrome |
| Resize gate below the composition size | PASS | `tests/view.test.ts` |
| **Resize freezes presentation time and resumes from the same instant** | PASS | `tests/playback.test.ts`, driving a whole session with no TTY |
| Controls: pause, resume, step one frame, step one tick, speed, restart, quit | PASS | `tests/playback.test.ts`, including the key map |
| One idempotent disposer on every lifecycle path | PASS | `tests/lifecycle.test.ts` drives `q`, the raw-mode interrupt byte, SIGINT, SIGTERM and a thrown render through `watchPulse` itself; each restores the alternate screen, the cursor and raw mode, and a second stop writes nothing |
| **The ANSI backend runs on a real terminal** | PASS | `scripts/capture-screenshots.mjs` drives the binary inside a tmux PTY: the alternate screen, raw-mode input, pause, step-a-tick, `q`, and the restore on exit all behave, on eight captures across three scenarios |
| **The resize gate appears on a real terminal below the composition** | PASS | `evidence/screenshots/resize-gate.png`, captured at 64x18 |
| `run`, `watch` and `verify` work from a clean checkout | PASS | All three run with `node_modules` deleted: the kernel, the report and the view have no runtime dependency, and the OpenTUI backend is imported lazily behind a fallback |
| Non-TTY prints one line and no escapes | PASS | `tests/cli.test.ts`, `tests/lifecycle.test.ts` |
| Structured-cell snapshots identical across backends | PASS | `tests/backend-opentui.test.ts` under Bun: OpenTUI's captured characters equal the compositor's |
| OpenTUI exact cell control | PASS | Same test |
| **OpenTUI under Node** | **FAIL — see Section 6** | `@opentui/core@0.5.6` throws "OpenTUI native FFI is not available for this runtime yet" |

Measurements:

| Metric | Value | Method | Samples |
| --- | --- | --- | --- |
| Frame compose + ANSI serialize, Node | p50 **0.52 ms**, p95 **1.15 ms**, p99 1.65 ms, max 3.75 ms | `tests/performance.test.ts`, mirror skirmish at 30 fps | 1800 frames (60 s) |
| Frame compose + ANSI serialize, Bun | p50 **0.79 ms**, p95 **2.72 ms**, p99 4.04 ms, max 6.17 ms | same | 1800 frames (60 s) |
| Frames over the 33.33 ms budget | **0** | same | 1800 per runtime |
| Output bytes per frame | 3,433 | same, 16-colour, 80x24 | 1800 |
| Resolve 240 ticks, 14 entities | 15.9–37.7 ms (Node), 51 ms (Bun, cold) | `tests/performance.test.ts` | repeated |
| Mirror skirmish event count | 397 events, 82 `INFO` lines | `--json`, `evidence/citizen-mirror-skirmish-info.txt` | 1 |
| `node_modules` after `npm install` | 103 MB (OpenTUI's prebuilt native core dominates) | `du -sh` | 1 |

Scenario outcomes, all reproducible from the seed in each file:

| Scenario | Result |
| --- | --- |
| `annihilation-victory` | 300 of 480 (annihilation) → A wins |
| `citizen-mirror-skirmish` | 240 of 240 (full pulse) → draw (tick limit) |
| `hauler-three-tile-gap` | 240 of 240 → draw; the hauler crosses the wall |
| `hauler-two-tile-gap` | 240 of 240 → draw; the hauler never crosses, and is reported stuck |
| `jammed-corridor` | 480 of 480 → draw; 11 contested claims, no pass-bound warning |
| `melee-kill` | 40 of 180 (annihilation) → A wins |
| `mutual-kill` | 61 of 120 (annihilation) → draw, both dead on tick 61 |
| `obstacle-routing` | 360 of 360 → draw; the trooper rounds the spine |
| `ranged-kill` | 136 of 240 (annihilation) → A wins |
| `salvage-drop` | 44 of 240 (annihilation) → A wins |
| `share-tile-worker-unit` | 204 of 240 (annihilation) → A wins |
| `structure-destruction` | 404 of 480 (nexus destroyed) → A wins |
| `tick-limit-draw` | 120 of 120 → draw; no attack ever launched |
| `trooper-versus-marksman` | 116 of 240 (annihilation) → A wins |
| `worker-flight` | 265 of 480 (annihilation) → A wins |

Mirror skirmish hashes, seed `0x5EED0001`, 240 ticks:

```text
state       sha256:4dc11d15a082a2bb0c65e53055a71e676aa29fffb1981e41d6667701105cdadc
events      sha256:823d088a02e091e92b6f0a03bfcd79330254c3e316fec9d32a4349da3f615ab8
contentLock sha256:5384b38dbf7e5f021ef94cddbfd213b0a094360d2335d7b303fb76d8f1946408
```

## 5. Human observations

**Nobody has watched it in motion.** That claim is unchanged, and it is still the gate's remaining
work. What now exists is one step short of it: **eight screenshots of the real thing running in a
real terminal**, in `evidence/screenshots/`, captured by driving the binary inside a tmux
pseudo-terminal, pausing it, and stepping to an exact tick so each frame lands where it was meant
to rather than wherever the wall clock reached.

| Screenshot | What it shows |
| --- | --- |
| `mirror-open.png` | Tick 0, both squads placed |
| `mirror-first-shots.png` | Tick 112, the marksmen opening fire at range five |
| `mirror-melee.png` | Tick 160, troopers in contact, salvage on the ground |
| `mirror-monochrome.png` | The same tick at the acceptance floor |
| `mirror-wide.png` | 128 columns at two columns per tile |
| `nexus-falls.png` | Tick 404, the Grid Nexus destroyed and the Pulse over |
| `hauler-gap.png` | The 3x1 hauler one row past its three-tile opening |
| `resize-gate.png` | A 64x18 terminal, gated |

Also in this directory: four plain-text frames in `evidence/frames/`, and the full `INFO` log of the
mirror run in `evidence/citizen-mirror-skirmish-info.txt`.

What the stills show, offered as observations rather than as the experiential claim they cannot make:

- **The composition holds at both widths.** Nothing overflows, nothing wraps, the frame closes on
  all four sides, and every readout fits its pane at 80 and at 128 columns.
- **Ownership survives monochrome.** Lower case against upper case is doing the work that colour
  does in the 16-colour frame; the two captures carry identical glyphs. Units and terrain are close
  in weight, though — making units bold in monochrome is a Gate 1B render-tier lever worth pulling.
- **Two columns per tile fixes the aspect ratio.** Tiles read as roughly square instead of squashed
  2:1, which is what Q1's answer was for. It also spaces a multi-tile body out: the hauler becomes
  `(  h  )`, and whether its second column should extend the body is a Gate 1B question.
- **The Grid floats.** A 24 x 12 Grid inside the 48 x 16 pane leaves twelve blank columns on each
  side — about a third of an 80-column frame. Registered as **Q16**.
- **Structures read as buildings.** A 3x2 barracks as a solid `BBB / BBB` block, and the Nexus the
  same, are legible as objects rather than as letters.
- **The feed carries causality.** Without effects, `160 Am5>Bt2 shot 6` in the side panel is the
  only thing saying who shot whom; on the stills it reads well, and Gate 1B's tracer should make it
  a redundancy rather than the sole carrier.

The two checks still owed, both explicitly human in Section 3.10: **Mario has watched a mirror
skirmish run**, and **Mario has watched one in monochrome and could follow it**. Governance
Section 2 forbids treating an automated test — or a screenshot — as proof of either.

## 6. Interpretation

**Determinism is not in doubt.** Fifteen scenarios, twenty runs each, byte-identical state hashes,
event hashes and `INFO` logs; one-call resolution equal to tick-by-tick; and — the check that
actually earns confidence — identical hashes on two different JavaScript engines. Cross-runtime
agreement was worth more than the twenty-run loop: a single machine can only prove that nothing
random leaked in, while two engines also test the serialization and iteration assumptions
underneath. Both were cheap, and neither has ever disagreed.

**The report is the reason the rest went quickly.** Building the levelled log before the rules got
complicated was the single highest-return instruction in the milestone. Two bugs were found by
reading it rather than by a test: targets were being reported lost one tick late and named by bare
ordinal, and workers were escaping every attacker. The rule that `src/report` may only read events
and final state paid for itself immediately — the replay that rebuilds the cast from events alone is
now a test, and it proves the event stream is complete rather than merely self-consistent.

**The view is legible in monochrome, as far as a still frame can show.** Ownership is carried by
letter case rather than colour, so the monochrome and colour frames hold identical glyphs — the
automated half of "colour never carries ownership alone". Without effects, "who shot whom" is
carried by the side panel's event feed rather than by tracers; that is a deliberate, minimal
addition, and Gate 1B's `fx.ranged.tracer` should make it redundant. Whether the fight is *followable*
in motion is Mario's call, and it is the one thing this report cannot claim.

**OpenTUI is adopted, with one measured limitation.** It does exactly what the milestone hoped for
cell control: a frame written through `OptimizedBuffer.setCell` comes back out of the test harness
character-for-character identical to the compositor's own text. But its native core loads only under
Bun. Node 22.22.2 imports the package cleanly — which is what the milestone's standing evidence
measured — and then throws when a renderer is constructed. That is a correction to Section 5's
inference that "library and runtime are independent choices", not to the architecture: the adapter
boundary is precisely what keeps that invariant true, and `selectBackend("auto")` falls back to the
direct-ANSI backend, which passes the whole lifecycle suite.

None of the four criteria Section 3.8 names for a REVISE failed. Exact cell control: passed. 30 fps
on a 24x12 Grid: passed, with 60 seconds of frames and a p95 of 1.15 ms against a 33.33 ms budget on
Node. The lifecycle: passed on the ANSI backend, which is the one that runs everywhere; **not
verified for OpenTUI**, because a TTY-free container cannot prove that alternate-screen and raw-mode
restore work, and this project does not label an untested platform supported. The version pin: held
for the gate, but 0.5.4 (the milestone's candidate, published 2026-08-18) was already two releases
stale by 2026-08-21, which is the churn Section 5 predicted.

**The mirror skirmish is fair, and its arithmetic is nearly right.** Swapping which player owns which
side flips the result exactly, so nothing favours a player identity. Across seeds the mirror lands
3-3, 4-4, 4-4, 5-1, 4-4 — the lopsided run is variance. The fixture's own documented arithmetic held
where it matters: two marksmen land exactly six shots during the trooper's approach and it arrives at
exactly 4 health, as milestone 3.6 predicts. One number is out: 3.6 says a trooper that beats a
marksman one-on-one "finishes at a quarter health" after "taking two more" shots; measured, it takes
one more and finishes at 16 of 40. The first checkpoint in the same sentence — "arriving at 22 of 40
health" — is exact.

**What the fixture makes visible, and did not intend to.** A Citizen worker moves at `1/1` and every
attacker in the fixture moves at `3/4` or slower, so a fleeing worker on open ground is never caught.
That is why the mirror never reaches annihilation and always runs its full 240 ticks, and it is
direct evidence for Q13's warning about a worker-hunt anticlimax. It is fixture tuning, not a rule
problem, and it is the sort of thing the Playground exists to surface.

## 7. Failures, surprises, and discarded approaches

**Arbitration's first design was wrong in a way only a crash revealed.** The first version let a
mover that lost a contest recalculate immediately against the claims granted *so far*, then granted
its new claim in the next pass without re-checking. A loser in the first conflict group could
therefore pick a tile that a later group claimed in the same pass, and the occupancy index — which
refuses a double occupancy rather than silently allowing one — threw during settle. The fix is that
every pass re-ranks every unresolved mover against the current overlay before any claim is granted,
so a claim is never granted from a stale ranking. Making the index refuse conflicts loudly turned a
subtle overlap bug into an immediate crash on the first full run; it would otherwise have been
invisible until some later gate.

**Conflict groups have to be unions, not first-match buckets.** The first grouping assigned an
intent to the first group whose tile it touched. A three-tile hauler can bridge two one-tile claims
that do not touch each other, so it belonged to both, and the second group never learned about it.
Grouping is now a union-find over destination tiles.

**Greedy routing needs a static goal before a fixture can test it.** Three fixtures appeared to fail
— `obstacle-routing`, `jammed-corridor` and both hauler gaps — and none of them was a routing bug.
Two movers each rounding an obstacle drag each other's targets around, so the fixtures measured an
orbit rather than a route. Giving each of them a stationary structure to walk toward made every one
of them demonstrate its rule on the first attempt. A fixture for a movement rule should have exactly
one thing moving.

**A blocked mover circles instead of stopping, and the stuck warning missed it.** The `stuck` warning
was written for the case the milestone's sample line shows — an actor with no legal step for many
ticks. A hauler that cannot fit a gap always *has* a legal step: two of them, either side of where it
wants to be, and it paces between them forever. The log now watches net progress as well as blocked
ticks, which is a report-level heuristic computed from `entity.moved` events and needs nothing from
the kernel. Registered as Q15.

**The milestone's own sample log is not fixed-column on one line.** Five of the six sample lines in
Section 3.3 agree on exact columns — level at 7, kind at 13, subject at 22, object at 36, detail at
54 — and the formatter reproduces all five byte-for-byte, which is asserted in `tests/report.test.ts`.
The sixth, `[0180] INFO  victory  A  reason: annihilation`, does not pad its subject to the same
width. The fixed columns won, since the same section calls them the point; the victory line the
Playground prints is `victory  A             reason: annihilation`.

**Two attackers on one target share one health transition in the log.** Damage inside a speed tier is
computed against the state at tier start and applied together, so the tick has one `damage.applied`
per target, not one per attacker. Both attack lines therefore print the same `hp 12->0`. It is
accurate — that *is* the transition — but a reader may briefly think one attacker did all of it. The
per-attacker number is on the same line as `dmg`, and the `--events` stream carries both separately.

**Bun's `node:test` shim needs handling, twice.** `bun test` loads every file into one process and
rejects a `test()` registered while another file's tests are still running, so `./scripts/run-tests.sh
bun` drives one file at a time. And `t.skip()` is not implemented, so a test that applies to one
runtime is registered conditionally rather than skipped — which turned out better anyway: on Node the
OpenTUI test now *asserts* that the native core refuses to load, so the day that changes, a test says
so instead of the report quietly going stale.

**Non-ASCII crept in through authored data, not through code.** The scenario name "Citizen mirror —
open field" contains an em dash, and the compositor happily placed it in a cell, breaking the
one-column-per-glyph rule that `offendingGlyph` checks. Text drawn into a frame is now transliterated
and any remaining non-printable becomes `?`. Authored strings reach the screen; they cannot be
trusted to be ASCII just because the source file is.

**The resize gate was untestable until it was moved out of the loop.** Freezing and resuming
presentation time started life inside `watch`'s interval callback, which needs a TTY, so the rule
engine.md 9.6 states as RULE had no evidence behind it. Pulling the clock, the controls and the gate
into `src/view/playback.ts` — where advancing is a pure function of the elapsed time handed in —
made a whole session drivable from a test in a few lines, including the part that matters: after a
gate goes up and five seconds pass twice, playback resumes at exactly the instant it froze.

**A real terminal found an input bug that no test would have.** The key handler compared the whole
chunk read from stdin against a single key, so ten step-a-tick presses arriving in one ten-byte
chunk — which is what a script driving a pseudo-terminal produces, and what a fast typist or a paste
produces too — were silently dropped in their entirety. Input is now split into keys, with an escape
sequence kept whole so an arrow key stays one key rather than three. Found in the first minute of
driving the thing for screenshots; it would have survived the whole gate otherwise.

**The panel and the footer contradicted each other.** With playback paused the side panel showed
`[hold]` while the footer still read `pulse running`. Both were true — one describes playback, the
other the match — but read together they look like a bug. The footer now says `paused at tick 0160`
while held. It took a screenshot to notice; in text form the two lines are forty rows apart.

**Speculative helpers were written and then deleted.** A pass over the exports found a dozen
functions nothing called — `opponentOf`, `sameCoord`, `vectorOf`, `entityByOrdinal`, `isStructure`,
a `renderStill`, a `survivorsOf`. They were all written in the first hour, when it felt obvious that
something would want them. Nothing did. They are gone, and the three constants worth keeping earned
their place by being asserted in a test instead: the default preset is the 48x16 the composition is
derived from, the event union declares exactly the kinds the kernel emits, and the JSONL machine
surface round-trips to the same bytes.

**Discarded: putting movement credit only in the kernel.** The milestone wants credit state at
`DEBUG`, and the report may not read kernel internals. Rather than weaken that rule, credit and step
cost were added to the `move.intended` and `move.blocked` events, where they are genuinely semantic —
they are why an actor is or is not stepping. `TRACE` still cannot show credit for an actor that made
no movement decision that tick, and that is the honest limit of deriving a report from events.

## 8. Decision

> **PASS**

The gate asked whether a scenario file plus a seed resolves into a byte-identical report every time,
and whether a person can watch that same Pulse and follow what happened. The first half is answered
without qualification: fifteen scenarios, twenty runs each, identical state hashes, event hashes and
logs, identical again across two JavaScript engines, with the kernel proven — not assumed — to touch
no clock, no `Math.random`, and nothing downstream of itself. The second half is answered as far as
an automated check can answer it: the view is exactly 80x24, every glyph is one ASCII cell, frames
are pure functions of presentation time, monochrome loses no information because ownership is
carried by letter case, and the picture is asserted against the event stream rather than against
itself. None of the four criteria Section 3.8 names for a REVISE failed.

Two things keep this from being a complete PASS on its own, and both are named rather than hidden.
**Nobody has watched it**, so the experiential claim in Section 3.10 is still owed and this report
does not make it. And **OpenTUI's native core does not load under Node**, which contradicts an
inference in the milestone's standing evidence — a correction to Section 5, not a failed criterion,
since the adapter boundary already carries it and the ANSI fallback passes the full lifecycle suite.

## 9. Canon impact

**Nothing here is applied. All of it waits for Mario to accept the gate.**

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| The 12 Hz tick rate and the movement-credit rules of 4.2 — the cap and keep-credit-when-blocked — become RULE | `engine.md` Section 4.1, 4.2 | The cadence table reproduces exactly at all eight rates; blocked actors demonstrably resume on the tick a tile frees |
| Speed tier as initiative, lower first, in both arbitration and attacks | `engine.md` Section 4.3, already stated; promote from GUIDANCE to RULE | Exercised in every fixture; marksmen resolve before troopers on shared ticks |
| Collision masks are lazy views over one incrementally maintained occupancy index, with a claim overlay for arbitration | `engine.md` Section 3.4.1, as the recorded answer to the caching question it leaves open | Section 3 above; no overlap in any mask across every tick of fifteen scenarios |
| A mover's origin tile does not free within the same tick | `engine.md` Section 4.3 | Section 3 above |
| Annihilation applies only to a side that started with mobile entities | `milestone-1-spike-battle.md` 3.7 / `engine.md` Section 5, extending Q13 | A structures-only fixture is otherwise won on tick 1 |
| The flight-window formula: `ceil(distance / projectileTilesPerTick)`, minimum 1, on the event, read by no rule | `engine.md` Section 4.3 | `tests/rules.test.ts` proves changing it moves no state |
| The Gate 1A style-role vocabulary: twelve roles, listed in `src/view/roles.ts` | `engine.md` Section 9.1 | Committed before the compositor was written, per milestone 3.2; a test asserts nothing else is emitted |
| Correct the fixture prose: a trooper beating a marksman one-on-one finishes at **16 of 40**, not a quarter, taking one more shot rather than two | `milestone-1-spike-battle.md` 3.6 | `scenarios/trooper-versus-marksman.ts` and its test |
| Correct the standing evidence: `@opentui/core` imports on Node but its native core does not load there; it is Bun-only as of 0.5.6 | `milestone-1-spike-battle.md` Section 5 | Section 4 above; asserted by `tests/backend-opentui.test.ts` |
| The sample victory line in the log grammar should pad its subject like every other line | `milestone-1-spike-battle.md` 3.3 | Section 7 above |
| Toolchain: no build step; Node 22.18+ and Bun 1.3+ run the sources directly; relative imports carry `.ts`; erasable-syntax TypeScript only | `DEVELOPMENT.md`, already updated | Both runtimes run the same files and agree on every hash |

Questions raised, each already added to [`../specs/open-questions.md`](../specs/open-questions.md)
with a recommendation:

| ID | Question | Recommendation |
| --- | --- | --- |
| Q14 | Should the movement tie-break be mirror-fair, or is a fixed compass order enough? | Keep the compass order for Gate 1A; decide in Milestone 2, which owns routing |
| Q15 | What should a mover with no route do: circle, or stop? | Leave it and report it now; park the actor as a stopgap if watching shows circling reads as broken |
| Q16 | When the Grid is smaller than the viewport, where does the leftover space go? | Keep centring it for Gate 1A; decide when the Build Phase gives the side panel real content |

Evidence bearing on a question already open: **Q13**. Workers move at `1/1` and every fixture
attacker at `3/4` or slower, so a fleeing worker on open ground is never caught and the mirror never
reaches annihilation. That is the anticlimax Q13's option A accepts, now measured rather than
predicted.

## 10. Next authorized action

Watch `./bin/playground.ts watch scenarios/citizen-mirror-skirmish.ts` in colour and then with
`--capability monochrome`, answer whether the fight is followable, and accept or revise this gate —
**not** begin Gate 1B, which the milestone gates on that answer.
