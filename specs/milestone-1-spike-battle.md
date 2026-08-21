# Milestone 1 — the Pulse Playground

**Document role:** Start-here implementation contract
**Status:** CURRENT
**Active gate:** 1A — the Pulse Playground
**Canon version:** 2.3
**Updated:** 2026-08-20
**License:** Apache-2.0; authored creative treatments are CC BY-SA 4.0

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
| **1A — the Pulse Playground** | Do units move around obstacles, fight, and die — identically from a seed, legibly on screen? | **CURRENT** |
| **1B — quality and effects** | Do render tiers and an effect vocabulary turn a legible Pulse into one worth watching? | GATED on 1A |

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

### 3.3 The report — build this early, it is the feedback loop

The Playground's output is a **log on stderr** and a **summary on stdout**. Splitting them is what
makes `playground run x.ts > report.txt 2> run.log` work, and by default both land in the terminal
interleaved, which is what a human wants.

**Log levels**, default `INFO`:

| Level | Carries |
| --- | --- |
| `ERROR` | Invariant violations, scenario load failures. Any `ERROR` fails the run |
| `WARN` | Suspicious but survivable: an actor stuck for many ticks, arbitration hitting its pass bound, a target that vanished |
| `INFO` | **The story.** Spawns, first engagement, every attack that landed, every death, every structure destroyed, victory. This is the default because it is what a designer and an agent both want |
| `DEBUG` | Per-tick decisions: target selection with its score, movement intents, arbitration winners and losers, credit state |
| `TRACE` | Per-entity, per-tick full state. Expect it to be enormous |

**Lines are fixed-column and greppable.** That is not cosmetic — it is what lets an agent assert on
behaviour without parsing prose:

```text
[0000] INFO  spawn    A:trooper#1   at (2,1)
[0018] INFO  engage   A:trooper#1   -> B:marksman#9   dist 5  score 5.0
[0021] INFO  attack   B:marksman#9  -> A:trooper#1    ranged dmg 6  hp 40->34
[0044] INFO  attack   A:trooper#1   -> B:marksman#9   melee  dmg 7  hp 24->17
[0056] INFO  death    B:marksman#9  at (13,7)  by A:trooper#1
[0071] WARN  stuck    A:worker#4    at (3,9)  no legal step for 24 ticks
[0180] INFO  victory  A  reason: annihilation
```

The **summary** on stdout closes the run:

```text
scenario   citizen-mirror-skirmish
seed       0x5EED0001
ticks      180 of 240 (ended early: annihilation)
outcome    A wins
losses     A: 2 of 8    B: 8 of 8
state      sha256:4f2a...    events  sha256:9b17...
```

Options: `--log-level`, `--seed`, `--ticks`, `--json` for a machine-readable summary, and
`--events <file>` for the ordered event log as JSONL.

Write the report before the rules get complicated. Every rule added after it is one you can watch
arrive in the log, and every bug is one you can grep for.

### 3.4 The CLI

```bash
playground run    scenarios/citizen-mirror-skirmish.ts
playground run    <scenario> --seed 0xABCD --ticks 120 --log-level debug
playground run    <scenario> --events events.jsonl
playground watch  <scenario>                    # the ASCII view
playground verify <scenario> --runs 20          # same hashes every time?
```

### 3.5 The scenario file

A TypeScript module, and the project's most important tool — it is how humans *and* agents pose
questions to the simulation from here on.

```ts
// scenarios/citizen-mirror-skirmish.ts
import { defineScenario } from "../src/scenario"

export default defineScenario({
  id: "citizen-mirror-skirmish",
  name: "Citizen mirror — open field",
  notes: "Two matched squads across open ground. The baseline everything else compares to.",

  grid: { preset: "small-wide" },        // 24 x 12, fits the viewport with no scrolling
  seed: 0x5EED0001,
  pulseTicks: 240,                        // 20 simulation seconds at 12 ticks/s

  // One character per tile. Dimensions must match the grid.
  terrain: [
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
    "........................",
  ],
  terrainLegend: {
    ".": "terrain.plain",
    "#": "terrain.rock",                  // impassable, not attackable
    "*": "terrain.deposit",
  },

  // Second overlay, same dimensions. Space means nothing here.
  placements: [
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
    "                        ",
  ],
  placementLegend: {
    m: { player: "A", content: "unit.citizen.trooper" },
    r: { player: "A", content: "unit.citizen.marksman" },
    w: { player: "A", content: "unit.citizen.worker" },
    M: { player: "B", content: "unit.citizen.trooper" },
    R: { player: "B", content: "unit.citizen.marksman" },
    W: { player: "B", content: "unit.citizen.worker" },
  },
})
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
- `defineScenario` is typed and does no work, so a scenario file is safe to import from a test.

### 3.6 Fixture content — disposable, tuned for legibility not balance

Not a Commander Army, not canon. [`commander-armies.md`](commander-armies.md) forbids production
rosters before Milestone 4; saying these are throwaway is what keeps them throwaway. Change them
freely if the fight is boring — that is what the Playground is for.

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
  22 of 40 health. It then kills the marksman in four seconds while taking two more. **One trooper
  beats one marksman and finishes at a quarter health.**
- Two marksmen land six shots during that same approach. **The trooper arrives at 4 health and dies.**

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
  Nexus; otherwise hold;
- death, structure destruction, salvage dropped as ground items;
- victory: enemy Grid Nexus destroyed, one side annihilated, or the tick count runs out.

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
- `parse(serialize(state))` hashes identically.

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
- the Pulse is legible in monochrome.

**Every rule is a scenario file** — checked in, named, runnable. That is the regression suite and the
documentation at the same time.

### 3.10 Definition of done

- [ ] every check in 3.9 passes;
- [ ] `playground run`, `watch`, and `verify` work from a clean checkout;
- [ ] at least ten scenario files exist, one per rule fixture, plus the mirror skirmish;
- [ ] `playground verify --runs 20` is green on all of them;
- [ ] the log at `INFO` reads as a story a designer can follow, and an agent asserts on it in tests;
- [ ] `./scripts/check-repository.sh` passes;
- [ ] install, test, and run commands recorded verbatim in the gate report and promoted into
      `DEVELOPMENT.md`;
- [ ] `evidence/report.md` ends with **PASS / REVISE / STOP / BLOCKED**;
- [ ] Mario has watched a mirror skirmish run;
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

## 6. Milestone completion

Milestone 1 passes when both gates are accepted. Durable outputs — and note that most of these are
**foundation, not spike residue**:

- the Pulse Playground: scenario format, deterministic kernel, levelled report, ASCII view, CLI;
- the Grid, its layers, collision masks, and multi-tile placement, proven by fixtures;
- a pinned backend behind the `TerminalBackend` interface;
- a composition that works at 80 × 24 in monochrome;
- an effect vocabulary earned from watching people watch it;
- answers to Q7 and Q9 in [`open-questions.md`](open-questions.md);
- the confirmed or corrected 12 Hz hypothesis and movement-credit rules, promoted into
  [`engine.md`](engine.md) Section 4 as RULE;
- explicit authorization — or refusal — to begin the Build Phase.
