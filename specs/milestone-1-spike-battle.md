# Milestone 1 — the Pulse Playground

**Document role:** Start-here implementation contract
**Status:** CURRENT
**Active gate:** 1B — quality and effects (built; viewed, encouraging response, not yet formally accepted)
**Canon version:** 2.7
**Updated:** 2026-08-23
**License:** Apache-2.0; authored creative treatments are CC BY-SA 4.0

> **Where this stands, canon 2.6.** Both gates are **built and merged**, and both evidence reports
> conclude PASS on every check a test can answer. The human half has now happened at least once: Mario
> watched a legibility pass and responded well — "This looks really amazing. Great job" — then gave a
> large, explicit list of follow-up work rather than accepting the milestone outright. Encouraging is
> not the same as accepted; treat that list as the current authorisation (`AGENTS.md` Section 2), not
> as permission to call this milestone done. A new session's authorised work is whatever the owner's
> most recent feedback asks for — **not** new scope. Milestone 2's contracts are locked and waiting; it
> opens when this milestone is accepted, which has not happened yet.

## 1. What this milestone builds

> **Put units and buildings on a small Grid, run a full Pulse, and watch them move around obstacles,
> shoot each other, and die. Make it deterministic from a seed, make it report what happened, and
> make it worth looking at.**

The **Pulse Playground** is the thing being built. It is a spike, and it is also the foundation the
engine grows from, and it is also the bench where every future unit gets tested. That third role is
why the code quality bar is higher than "spike": this is not scaffolding to be thrown away.

Two things happen at once, and they are **not** separate gates:

- **The headless run** is how an agent iterates. It resolves a scenario with no terminal, prints a
  report, and logs every event at a chosen level. An agent can run it, grep the log, and assert on
  what happened — which is the fastest feedback loop this project will ever have.
- **The ASCII view** is how Mario sees it. Without motion on a screen, nobody can tell whether any of
  this is any good, and the headless report will never answer that question.

Building them together is deliberate. Each one catches what the other hides.

| Gate | Question | Status |
| --- | --- | --- |
| **1A — the Pulse Playground** | Do units move around obstacles, fight, and die — identically from a seed, legibly on screen? | **BUILT** — [`evidence/report.md`](../evidence/report.md) concludes PASS; owner viewing outstanding |
| **1B — quality and effects** | Do render tiers and an effect vocabulary turn a legible Pulse into one worth watching? | **BUILT** — [`evidence/gate-1b-report.md`](../evidence/gate-1b-report.md) concludes PASS on everything a test can answer; owner viewing outstanding |

**What "outstanding" means here.** Both gates pass every automated check they set themselves, and
both reports refuse to claim the experiential half. Section 3.10 asks that Mario watch a mirror
skirmish, and watch one in monochrome and be able to follow it; Section 4.3 asks that a viewer be
shown the same scenario with effects on and off and say which they would watch again. Until someone
has, those questions are open, and `project-governance.md` Section 2 forbids treating a test — or a
screenshot — as an answer to them.

**Not in this milestone:** the Build Phase, base construction, the upgrade draft, campaigns, AI beyond
"advance and engage," multiplayer, packaging, SSH, browser delivery, and every faction except
Citizens. A **mirror Citizen fight** is the whole content scope, so nothing that happens can be blamed
on balance.

**Not in Gate 1A specifically:** selection, inspection, and scrolling. Gate 1A uses a **small Grid
that fits the viewport entirely**, so none of that is needed yet. They arrive with the Build Phase.

## 2. Read before coding

1. [`terminal-nexus-concept.md`](terminal-nexus-concept.md)
2. [`engine.md`](engine.md) **Section 0 first** — the authority markers, and take them literally.
   Then Sections 1, 3, and 4: the three worlds, the Grid, and the Pulse.
3. this document
4. [`open-questions.md`](open-questions.md) Section 4
5. For the view: [`engine.md`](engine.md) Section 9. For Gate 1B:
   [`ascii-effects.md`](ascii-effects.md)
6. `AGENTS.md`, then existing source, tests, and evidence

Copy [`templates/gate-report.md`](templates/gate-report.md) into the spike and fill in its first
section before writing code.

Most of `engine.md` is **GUIDANCE**. You are not building the content interfaces in its Section 8.
You are building the smallest thing that resolves a fight and shows it.

---

## 3. Gate 1A — the Pulse Playground (CURRENT)

### 3.1 Decision to earn

> **Does a scenario file plus a seed resolve into a byte-identical report every time, and can a person
> watch that same Pulse and follow what happened?**

Allowed outcomes: **PASS**, **REVISE** (one named contract needs changing), **STOP/BLOCKED**.

### 3.2 Shape

```text
src/
  grid/         coordinates, layers, footprints, collision masks, distance
  content/      the fixture units and structures in 3.6 — plain data
  pulse/        the tick loop, movement credit, arbitration, attacks, damage
  rng/          one named seeded PRNG with test vectors
  events/       the DomainEvent union and canonical serialization
  report/       the log, its levels, and the run summary
  scenario/     the scenario file format and its loader
  view/         cell frame, band compositor, the minimal ASCII view
  cli/
scenarios/
tests/
```

`src/pulse` must not import `src/view`. Assert it in a test rather than trusting it.

`src/report` derives everything it prints from the **event stream and the final state** — never from
kernel internals. Assert that import direction too. A report that reads the kernel's private state
can narrate a story the events do not contain, and because the log is only ever compared with itself,
every other check in Section 3.9 would still pass. The same rule makes the log and the view
guaranteed to be describing the same fight.

**Agree these five things before splitting work across sessions**, because they are what the modules
meet through: the coordinate convention ([`engine.md`](engine.md) 3.5), the `DomainEvent` union and
its serialization, the scenario module API, the log line grammar of 3.3, and the `CellStyle` role
vocabulary. The first four are written down; the role list is not, and whoever opens the gate should
commit it — even if it is eight strings — before a second session starts.

### 3.3 The report — build this early, it is the feedback loop

`grid`'s headless output (`--headless`) is **one levelled log**, closed by a `report` line rather than
a separate summary stream — a second stream turned out not to earn its keep once the whole story fits
in one place. By default it prints to the terminal; `--save-log <file>` writes the same lines to a
file in any action, including `watch`.

**Log levels**, default `WARN`:

| Level | Carries |
| --- | --- |
| `ERROR` | Invariant violations, map load failures. Any `ERROR` fails the run |
| `WARN` | Suspicious but survivable: an actor stuck for many ticks, arbitration hitting its pass bound, a target that vanished — **plus the closing `report` line**, so a bare `--headless` run still ends with the outcome even at the default level |
| `INFO` | **The story.** Spawns, first engagement, every attack that landed, every death, every structure destroyed, victory |
| `DEBUG` | Per-tick decisions: target selection with its score, movement intents, arbitration winners and losers, credit state |
| `TRACE` | Per-entity, per-tick full state. Expect it to be enormous |

**Lines are fixed-column and greppable.** That is not cosmetic — it is what lets an agent assert on
behaviour without parsing prose:

The victory and report lines below are samples that are **not** fixed-column — their subject is not
padded like every other line's. The columns won, since this same section calls them the point.

```text
[0000] INFO  spawn    A:trooper#1   at (2,1)
[0018] INFO  engage   A:trooper#1   -> B:marksman#9   dist 5  score 5.0
[0021] INFO  attack   B:marksman#9  -> A:trooper#1    ranged dmg 6  hp 40->34
[0044] INFO  attack   A:trooper#1   -> B:marksman#9   melee  dmg 7  hp 24->17
[0056] INFO  death    B:marksman#9  at (13,7)  by A:trooper#1
[0071] WARN  stuck    A:worker#4    at (3,9)  no legal step for 24 ticks
[0180] INFO  victory  A  reason: annihilation
[0180] WARN  report   citizen-mirror-skirmish  seed 0x5EED0001  ticks 180 of 240 (ended early:
       annihilation)  outcome A wins  losses A: 2 of 7  B: 7 of 7  state sha256:4f2a...  events sha256:9b17...
```

Options: `--log-level`, `--seed`, `--ticks`, `--turn <tick>` (seek straight to that tick, dropping
earlier lines other than `ERROR`s and the report), `--json` for a machine-readable summary instead of
the log, `--save-log <file>`, and `--events <file>` for the ordered event log as JSONL.

**The line grammar is `[tick] LEVEL kind subject [-> object] detail…`**, and it is part of the report
module's tested surface. It grows by **adding kinds, never by reshaping columns** — every `grep` an
agent writes today has to keep working when salvage, production, and capture arrive. When a test
needs structure rather than a story, it asserts on `--events` JSONL, which is the real machine
surface; the log is for humans and for story-level assertions.

Write the report before the rules get complicated. Every rule added after it is one you can watch
arrive in the log, and every bug is one you can grep for.

### 3.4 The CLI

No subcommand: the first positional argument is always the map, and the default action is `watch`.

```bash
grid <map.map.json>                                 # watch — the ASCII view (the default)
grid <map.map.json> --seed 0xABCD --ticks 120 --turn 90 --speed 2
grid <map.map.json> --headless                       # resolve headlessly, print the levelled log
grid <map.map.json> --headless --log-level debug
grid <map.map.json> --headless --events events.jsonl
grid <map.map.json> --verify                         # 10 runs by default — same hashes every time?
grid <map.map.json> --verify --runs 20
```

`<map>` names a `.map.json` file; the suffix is optional. `--verify` is also headless.

### 3.5 The map file

A `.map.json` file — plain JSON, and the project's most important tool — is how humans *and* agents
pose questions to the simulation from here on. Same shape a checked-in test fixture, a campaign
level, and a map-editor-authored map will all eventually share (`specs/replay-format.md`'s
`ReplaySetup.map` is the same idea one layer up, for a whole replay).

```json
// scenarios/citizen-mirror-skirmish.map.json
{
  "id": "citizen-mirror-skirmish",
  "name": "Citizen mirror — open field",
  "notes": "Two matched squads across open ground. The baseline everything else compares to.",

  "grid": { "preset": "small-wide" },
  "seed": 1592590337,
  "pulseTicks": 240,

  "terrain": [
    "........................",
    "........................",
    "....##..............##..",
    "....##..............##..",
    "........................",
    "..........*..*..........",
    "..........*..*..........",
    "........................",
    "....##..............##..",
    "....##..............##..",
    "........................",
    "........................"
  ],
  "terrainLegend": { ".": "terrain.plain", "#": "terrain.rock", "*": "terrain.deposit" },

  "placements": [
    "                        ",
    "  m                  M  ",
    "  m                  M  ",
    "  r                  R  ",
    "  w                  W  ",
    "                        ",
    "                        ",
    "                        ",
    "  w                  W  ",
    "  r                  R  ",
    "  m                  M  ",
    "                        "
  ],
  "placementLegend": {
    "m": { "player": "A", "content": "unit.citizen.trooper" },
    "r": { "player": "A", "content": "unit.citizen.marksman" },
    "w": { "player": "A", "content": "unit.citizen.worker" },
    "M": { "player": "B", "content": "unit.citizen.trooper" },
    "R": { "player": "B", "content": "unit.citizen.marksman" },
    "W": { "player": "B", "content": "unit.citizen.worker" }
  }
}
```

Rules for the format:

- **Two ASCII overlays plus two legends.** Diffable, reviewable in a pull request, writable by a
  human or an agent with no tool.
- **Legend characters are authoring conveniences and have nothing to do with render glyphs.** Using
  case to separate sides is for the author's eyes only; the simulation never sees these characters.
- **A multi-tile entity is placed by its anchor character**, once. Its footprint comes from its
  definition. The loader **fails loudly** if the footprint overlaps anything in its placement mask or
  leaves the Grid.
- **Validation lives in the loader, not a later linter.** Dimension mismatch, unknown legend key,
  overlapping footprint, and unknown content id all fail with the offending line and column.
- JSON has no comments, which is the one thing the old TypeScript-module format could carry that this
  one cannot — put anything worth explaining in `notes` instead.
- `src/scenario/types.ts`'s `defineScenario` still exists for TypeScript-authored content that
  compiles down to a `.map.json` file; nothing in the checked-in fixtures uses it that way today.

### 3.6 Fixture content — disposable, tuned for legibility not balance

Not a Commander Army, not canon. [`commander-armies.md`](commander-armies.md) forbids production
rosters before Milestone 4; saying these are throwaway is what keeps them throwaway. Change them
freely if the fight is boring — that is what `grid` is for.

| Id | Layer | Footprint | HP | Move | Speed tier | Attack | Range | Damage | Cooldown |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| `unit.citizen.worker` | `workers` | 1 × 1 | 20 | `1/1` | 2 | — | — | — | — |
| `unit.citizen.trooper` | `units` | 1 × 1 | 40 | `3/4` | 2 | melee | 1 | 7 | 12 |
| `unit.citizen.marksman` | `units` | 1 × 1 | 24 | `3/4` | 1 | ranged | 5 | 6 | 24 |
| `unit.citizen.hauler` | `units` | 3 × 1 | 90 | `1/2` | 3 | melee | 1 | 10 | 18 |
| `structure.citizen.nexus` | `obstacles` | 3 × 2 | 400 | — | — | — | — | — | — |
| `structure.citizen.barracks` | `obstacles` | 3 × 2 | 120 | — | — | — | — | — | — |

Lower speed tier resolves first, so the marksman fires before the trooper swings.

The numbers make the relationship **visible without a spreadsheet**:

- A trooper crossing a marksman's five tiles takes about 6.7 seconds and eats three shots, arriving at
  22 of 40 health. It then kills the marksman while taking **one** more. **One trooper beats one
  marksman and finishes at 16 of 40** — measured, in `scenarios/trooper-versus-marksman.map.json`. The
  first half of that sentence is exact; the ending was a shot out, and this is the corrected number.
- Two marksmen land six shots during that same approach. **The trooper arrives at 4 health and dies.**
  Exact, and asserted in `tests/scenario.test.ts`.

Melee wins the charge; ranged wins when massed. A viewer can learn that by watching twice.

**`unit.citizen.hauler` is the multi-tile mover**, and it is in the fixture on purpose. A three-tile
unit squeezing between rock formations is the case that breaks a collision system written for
one-tile actors, and finding that out in Gate 1A costs an afternoon. Finding it out in Milestone 4
costs a week.

### 3.7 Rules in scope

- the Grid, its five layers, and **collision masks composed from layers**
  ([`engine.md`](engine.md) 3.4.1) — not a per-layer occupancy rule;
- placement with anchor, footprint, and facing; multi-tile movers testing their **whole footprint**
  against their mask; facing derived from movement or target, and read by no rule;
- eight-way movement, uniform step cost, Chebyshev distance;
- the integer movement credit of [`engine.md`](engine.md) 4.2, including the cap and the
  keep-credit-when-blocked rule;
- the tick order of [`engine.md`](engine.md) 4.3, with economy and production as **empty phases that
  exist and do nothing** — the slot matters, the content does not;
- target selection: nearest enemy by Chebyshev distance across every hostile layer, ties broken by
  entity id. That is the whole scoring function, and resisting the urge to improve it is part of the
  gate;
- **movement around obstacles**: enough routing that units do not stall against a rock. A greedy step
  with a deterministic sidestep is the floor; if that visibly fails in the mirror scenario, a small
  deterministic A* over the mover's collision mask is authorized — and the report must say which one
  shipped and why;
- melee as an attempt to enter a tile blocked by an enemy; ranged as an attack resolved at a tick,
  with the flight window recorded on the event;
- simultaneous damage within a speed tier, computed against the state at tier start;
- worker flight: when a hostile attacker is within `range + 2`, move away from it toward the friendly
  Grid Nexus; **when the scenario places no friendly Nexus — as the mirror skirmish does not — flee
  directly away from the nearest threat** (Q13);
- death, structure destruction, salvage dropped as ground items;
- victory: enemy Grid Nexus destroyed, one side annihilated, or the tick count runs out.
  **"Annihilated" means every entity on `workers`, `units`, and `air` is dead** (Q13) — workers
  count, which is why the summary in 3.3 reports 7 of 7.

**Not in scope:** economy, production, supply enforcement, upgrades, the Commander, visibility
filtering, the Build Phase, selection, inspection, scrolling.

### 3.8 The view

The smallest thing that shows a Pulse honestly. It is the real presentation stack from
[`engine.md`](engine.md) Section 9, just barely populated — not a debug printer that will be thrown
away.

- `ReadonlyCellFrame`, roles rather than colours, and the band compositor with the Grid layers mapped
  onto bands;
- a `small-wide` Grid at one column per tile, fitting 80 × 24 with no scrolling and no cursor;
- movement interpolated between tiles across the tick; **the simulation never learns about the
  in-between position**;
- 12 logical ticks per second, 30 frames per second;
- `snapshotAt(timeMs, capability, tileWidth)` is pure — same arguments, same frame;
- controls: pause, resume, step one frame, step one tick, speed, restart, quit;
- **the resize gate**, because [`engine.md`](engine.md) 9.6 makes it a RULE and a terminal is a thing
  people drag: below the composition size, show the gate and freeze presentation time; resizing back
  resumes **from the same presentation time**. Scrolling stays out of scope — the Grid fits — so this
  is the gate and nothing more;
- **one idempotent disposer** for `q`, `SIGINT`, `SIGTERM`, setup failure, and caught render failure.
  Calling it twice is harmless. Non-TTY prints one line and no escapes. A renderer that leaves the
  terminal in raw mode is a reason to reject it.

**Backend: adopt the OpenTUI imperative core** on the evidence in Section 5, behind the
`TerminalBackend` interface, with direct ANSI as a fallback that stays a half-day's work. If OpenTUI
fails exact cell control, 30 fps on a 24 × 12 Grid, the lifecycle above, or a version pin that holds
still for the gate — that is a REVISE with the criterion named, not a re-plan.

### 3.9 Automated acceptance

**Determinism — the point of the gate**

- twenty runs of a scenario produce identical state hashes, event hashes, and `INFO` logs;
- resolving in one call equals resolving tick by tick;
- the kernel calls no clock and no `Math.random`, and imports nothing from `src/view` — assert it;
- the named PRNG matches its published test vectors;
- changing only the cosmetic seed changes nothing about state, events, or the log;
- `parse(serialize(state))` hashes identically;
- **`grid --verify` produces identical hashes under Bun and under Node** for every checked-in
  map. Both runtimes are already present (Section 5), and cross-runtime agreement is the only
  cheap test of the serialization and iteration assumptions that twenty runs on one machine can never
  catch — it is also what makes "library and runtime are independent choices" true rather than hoped.

**Grid and collision**

- an entity never overlaps another in a mask that includes both their layers, at any tick;
- a worker and a ground unit *may* share a tile, and a test asserts this rather than forbidding it;
- a ground unit is blocked by a structure on a different layer — cross-layer collision works;
- a 3 × 1 hauler cannot enter a two-tile gap, and can enter a three-tile one;
- multi-tile footprints never leave the Grid and are destroyed as one entity;
- range to a multi-tile target measures to its nearest occupied tile;
- arbitration terminates under a bounded pass count with a strictly decreasing progress measure,
  tested with a deliberately jammed corridor.

**Rules**

- movement credit reproduces the cadence table in [`engine.md`](engine.md) 4.1 exactly, at every rate;
- a blocked actor keeps its credit and steps the tick the tile frees; credit never exceeds one step;
- two equal-speed actors that kill each other on the same tick **both die**;
- a named scenario file exercises each of: melee kill, ranged kill, mutual kill, worker flight,
  multi-tile movement through a gap, obstacle routing, structure destruction, salvage drop,
  annihilation victory, tick-limit draw.

**The view**

- frames are exactly the composition size; every glyph is terminal width one;
- identical arguments produce identical frames, and skipping frames changes no later frame;
- 30 fps sustained over 60 seconds, p95 recorded;
- every lifecycle path runs the same disposer;
- resizing below the composition size shows the gate and freezes presentation time; resizing back
  resumes from the same presentation time;
- **the view shows the fight the kernel actually resolved**: at a frame sampled exactly on a tick
  boundary, every entity's glyph stands on its authoritative tile, asserted against the event stream
  for at least one scenario. Every other check in this list is about the view agreeing with *itself*
  — a compositor with a transposed axis or an off-by-one band passes all of them and draws a
  deterministic, pure, correctly-sized picture of the wrong fight;
- **`grid` (watch) and `grid --headless` agree**: for the same map, seed, and tick count the
  view computes the same state and event hashes as the headless run, prints them on exit, and a test
  asserts they match. Otherwise Mario can approve a fight the test suite never ran;
- monochrome mode renders every scenario without error, and no cell depends on colour to exist.
  Whether monochrome is *legible* is a human check, in 3.10 — an automated test cannot answer it.

**Every rule is a scenario file** — checked in, named, runnable. That is the regression suite and the
documentation at the same time.

### 3.10 Definition of done

- [ ] every check in 3.9 passes;
- [ ] `grid`'s default action (`watch`), `--headless`, and `--verify` all work from a clean checkout;
- [ ] at least ten scenario files exist, one per rule fixture, plus the mirror skirmish;
- [ ] `grid --verify --runs 20` is green on all of them;
- [ ] the log at `INFO` reads as a story a designer can follow, and an agent asserts on it in tests;
- [ ] `./scripts/check-repository.sh` passes;
- [ ] install, test, and run commands recorded verbatim in the gate report and promoted into
      `DEVELOPMENT.md`;
- [ ] `evidence/report.md` ends with **PASS / REVISE / STOP / BLOCKED**;
- [ ] Mario has watched a mirror skirmish run;
- [ ] **Mario has watched one in monochrome and could follow it** — who moved, who shot whom, who
      died. This is a human check on purpose: legibility is an experiential claim, and governance
      Section 2 forbids treating an automated test as proof of one;
- [ ] new questions are rows in [`open-questions.md`](open-questions.md), each with a recommendation.

Then stop. Gate 1B is where it gets to look good.

---

## 4. Gate 1B — quality and effects (GATED)

### 4.1 Question

> **Do render tiers and an effect vocabulary turn a legible Pulse into one worth watching again — and
> does that survive monochrome and reduced motion?**

### 4.2 What gets built

**Render tiers.** The same Pulse at every capability: monochrome ASCII, 16-colour, 256-colour,
truecolor, and an optional Unicode glyph pack. Selectable at runtime and snapshot-tested against each
other. Monochrome is the floor, not the degraded mode.

**The effect system.** The pure `EffectRecipe` contract, the cosmetic random stream, and the ten
effects of [`ascii-effects.md`](ascii-effects.md), each in all three required forms — full,
reduced-motion, monochrome.

Author them in order of diminishing returns: `fx.move.trail`, `fx.ranged.telegraph`,
`fx.ranged.tracer`, `fx.impact.burst`, `fx.death.collapse`, `fx.damage.flash`, `fx.melee.wind`,
`fx.melee.clash`, `fx.structure.collapse`, `fx.nexus.critical`.

`fx.move.trail` first, and take it seriously — it is what makes a letter read as moving rather than
teleporting between tiles, and it changes the feel more than the other nine combined.

### 4.3 Acceptance

Automated: every effect pure in absolute time; nothing emitted outside its window, band, or the Grid
clip; every glyph width one; all three forms exist and emit at the impact beat; the cosmetic stream
never touches the gameplay stream — assert it; composed-frame snapshots stable at fixed timestamps
across every render tier.

Human, and this is the real gate: **show the same scenario to a fresh viewer with effects on and
off.** Ask which they would watch again, and why. Then show the reduced-motion form and confirm they
can still tell what hit what. Then show monochrome.

Revise or stop if effects obscure their own targets, if the busiest frame becomes noise, if causality
needs colour, or if reduced motion loses the story.

---

## 5. Standing evidence

Measured 2026-08-20 on Linux x64 in a Claude Code container. **Indicative, not gate evidence** —
single cold samples, no TTY. Re-measure anything you cite.

| Finding | Why it matters |
| --- | --- |
| `@opentui/core@0.5.4`, MIT, published 2026-08-18 | Current pin candidate |
| **318 published versions, 141 semver releases since 2025-08-13** | ~12 releases/month. Pin exactly; expect the pin to age during the gate |
| Repository is `anomalyco/opentui`; older links point at `sst/opentui` | It has moved once. Verify before citing |
| Ships an explicit `node` export; imports cleanly on Node 22.22.2 | Library and runtime are independent choices |
| Native core ships as 8 prebuilt platform packages | No Zig toolchain needed to consume |
| `bun add` resolved in 1.53 s; `node_modules` 84 MB; `libopentui.so` 21 MB | Heavy for a game that draws characters. Not disqualifying |
| `OptimizedBuffer.setCell(x, y, char, fg, bg, attributes)` | `ReadonlyCellFrame` maps to a direct `setCell` loop |
| `CliRenderer(stdin, stdout, width, height, config)` takes arbitrary streams | Keeps a deferred remote path open at no cost |
| `@opentui/core/testing` exports `ManualClock`, `TestRecorder`, mock keys and mouse | A deterministic TTY-free snapshot harness already exists — much of 3.9's view testing can be assembled rather than written |
| Bun 1.3.11 and Node 22.22.2 present in the web container; **Deno is not** | Deno is out of this milestone |
| **Measured 2026-08-21 at 0.5.6: the native core loads under Bun and refuses under Node 22.22.2** | Corrects the row above it. The package's `node` export imports cleanly — which is all the original measurement showed — and then throws `"OpenTUI native FFI is not available for this runtime yet"` when a renderer is constructed. OpenTUI is a Bun-only backend today; direct ANSI carries Node, and the adapter boundary is what keeps "library and runtime are independent choices" true |

## 6. Milestone completion

Milestone 1 passes when both gates are accepted. Durable outputs — and note that most of these are
**foundation, not spike residue**:

- the Pulse Playground: scenario format, deterministic kernel, levelled report, ASCII view, CLI;
- the Grid, its layers, collision masks, and multi-tile placement, proven by fixtures;
- a pinned backend behind the `TerminalBackend` interface;
- a composition that works at 80 × 24 in monochrome;
- an effect vocabulary earned from watching people watch it;
- an answer to Q9 in [`open-questions.md`](open-questions.md), plus any new questions the gates
  raised, each registered with a recommendation. **Not Q7** — workers-carry-versus-produce-in-place
  needs an economy, and this milestone deliberately has none;
- the confirmed or corrected 12 Hz hypothesis and movement-credit rules, promoted into
  [`engine.md`](engine.md) Section 4 as RULE;
- explicit authorization — or refusal — to begin the Build Phase.

## 7. Working notes from this session — personal, not canon

Not RULE, not GUIDANCE, not Section 5's evidence. The owner asked for personal notes on this file
directly, so this is that: a few things worth remembering that don't fit the document's own voice.

**`grid` stopped being a spike tool for me somewhere in this session, not just on paper.** The
document already claims "foundation, not spike residue" (Section 3.6, and the governance ledger), but
I felt it rather than just read it: I used `grid run ... | grep engage` to settle whether Q17's tie
problem still existed, empirically, faster than reasoning about it would have been. A tool that
answers a canon question quicker than the person maintaining the canon can argue about it is doing
exactly the job the owner described this session — "the backbone of all development" — and I don't
think that was hyperbole from where I was sitting.

**I had a wrong performance model in my own head, and a review caught it.** I'd described
`OccupancyIndex` in an earlier session's commit messages as sparse, never materializing a full grid.
It isn't — it allocates four dense arrays sized to the map's area, every tick. Nothing was broken by
this; the mistake lived in my prose, not the code. But it is a caution worth keeping: a confident
performance claim written into a commit message under time pressure is exactly the kind of thing that
quietly becomes someone else's assumption later, unless something forces a second look. This session,
a scalability review was that second look. It should not have to be a special occasion.

**The canon can drift from code it was written to describe, and the closest doc comments are not
enough to catch it.** `engine.md` Section 3.6 kept describing eight-way movement and Chebyshev
distance for a full session after the kernel actually moved to four-way and Manhattan — the doc
comments nearest the change got updated at the time, the canonical section three steps further out
did not, and nothing caught it until this session went looking specifically because the owner asked
for a spec-accuracy pass. The habit worth forming: when a kernel behavior changes, grep the canon for
the old name, not just the file the change happened to touch.

**Most of what this session produced is words, not capability, and that is the correct shape of it —
but it is worth saying plainly.** Section 11.1's scaling assessment, Q20, and
[`replay-format.md`](replay-format.md) are design, not code; the only behavior changes this session
made were two hash-neutral optimizations and one new load-time validation. That is exactly what "we
don't have to implement everything now" asked for, but a reader skimming the diff stats later should
not mistake a lot of careful prose for a lot of shipped simulation.

**Writing the engagement-detection algorithm down precisely was harder than describing it loosely
would have been, on purpose.** "First attack in an area after a cooldown" sounds simple until you ask
when an engagement *ends* — which needs lookahead past the cooldown window, meaning it can only be
computed after a Pulse has fully resolved, never live. That single constraint decided where the
feature has to live (a post-hoc pass over the canonical event log, never inside the kernel). It is a
small thing, and it is exactly why "make sure the format is sound" was the right ask instead of "just
sketch it" — the soundness problems were not in the parts that looked hard.
