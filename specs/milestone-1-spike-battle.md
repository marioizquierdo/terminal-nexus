# Milestone 1 — the Pulse spike

**Document role:** Start-here implementation contract
**Status:** CURRENT
**Active gate:** 1A — headless Pulse
**Canon version:** 2.2
**Updated:** 2026-08-20
**License:** Apache-2.0; authored creative treatments are CC BY-SA 4.0

## 1. What this milestone proves

> **Put a few units on a Grid, let them fight without anyone steering them, and watch. Is it
> deterministic, is it legible, and is it good?**

Those are three questions, and they have to be answered in that order, because each one is worthless
without the one before it. A battle that looks great and does not replay identically is a demo. A
battle that replays identically and cannot be read is a log file.

| Gate | Question | Runnable output | Status |
| --- | --- | --- | --- |
| **1A — headless Pulse** | Does a scenario resolve into the same events and the same final state, every time, with no terminal involved? | `pulse run` prints a summary and a hash | **CURRENT** |
| **1B — watch the Pulse** | Can you see what happened, at 30 fps, in 80 × 24, in monochrome? | `pulse watch` plays it | GATED on 1A |
| **1C — make it hit** | Do particles and effects turn a legible battle into one worth watching? | `pulse watch` with the effect vocabulary | GATED on 1B |

**Deferred out of this milestone entirely:** packaging, standalone binaries, SSH, PTY, browser
terminals, and remote delivery. None of it is needed to answer any of the three questions, and it was
previously blocking them. It returns as its own milestone when Terminal Nexus needs to run somewhere
it was not built.

Also excluded: the Build Phase, base construction, the upgrade draft, campaigns, AI opponents beyond
"walk at the enemy," multiplayer, and every faction except Citizens. A **mirror Citizen fight** is the
whole content scope. Both sides get the same three units, so nothing that happens can be blamed on
balance.

## 2. Read before coding

1. [`terminal-nexus-concept.md`](terminal-nexus-concept.md)
2. [`engine.md`](engine.md) Section 0 (authority markers), then Sections 1, 3, and 4 — **the Grid,
   its layers, and the Pulse are what you are building**
3. this document, through the active gate
4. [`open-questions.md`](open-questions.md) Section 4
5. For Gate 1B: [`engine.md`](engine.md) Section 9. For Gate 1C: [`ascii-effects.md`](ascii-effects.md)
6. `AGENTS.md`, then existing source, tests, and evidence

Copy [`templates/gate-report.md`](templates/gate-report.md) into the spike and fill in its first
section before writing code.

**Read `engine.md` Section 0 first and take it literally.** Most of that document is GUIDANCE, not
instructions. You are not building the content interfaces in its Section 8. You are building the
smallest thing that resolves a fight.

---

## 3. Gate 1A — headless Pulse (CURRENT)

### 3.1 Decision to earn

> **Does a scenario file, a seed, and a tick count resolve into a byte-identical event log and final
> state hash, on every run and every machine — with the rules kernel importing nothing that knows
> what a terminal is?**

Allowed outcomes: **PASS**, **REVISE** (one named contract needs changing), **STOP/BLOCKED**.

There is no renderer in this gate. If you find yourself wanting to see it, that impulse is correct
and it is Gate 1B — write a text dump instead and keep going.

### 3.2 What gets built

```text
src/
  grid/        coordinates, layers, footprints, occupancy, distance
  content/     the fixture units and structures in 4.4 — plain data
  pulse/       the tick loop, movement credit, arbitration, attacks, damage
  rng/         one named seeded PRNG with test vectors
  events/      the DomainEvent union and canonical serialization
  scenario/    the scenario file format and its loader
  cli/         pulse run | events | verify
scenarios/
  citizen-mirror-skirmish.ts
  ...
tests/
```

No renderer, no `TerminalBackend`, no cell frame, no colour, no glyphs. **If the word "glyph" appears
outside `content/`, something has gone wrong.**

### 3.3 The scenario file — GUIDANCE, but build it first

A scenario is a TypeScript module. It is the project's most important tool, because it is how humans
*and* agents will pose questions to the simulation for the next year. Everything else in this gate
exists to run one.

```ts
// scenarios/citizen-mirror-skirmish.ts
import { defineScenario } from "../src/scenario"

export default defineScenario({
  id: "citizen-mirror-skirmish",
  name: "Citizen mirror — open field",
  notes: "Two matched squads across open ground. The baseline everything else is compared to.",

  grid: { preset: "small-wide" },        // 24 x 12; see engine.md 3.1
  seed: 0x5EED0001,
  pulseTicks: 240,                        // 20 simulation seconds at 12 ticks/s

  // One character per tile. Height and width must match the grid preset.
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
    "#": "terrain.rock",                  // obstacles layer, immutable
    "*": "terrain.deposit",
  },

  // A second overlay, same dimensions. Space means nothing here.
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

- **Two ASCII overlays plus two legends.** Terrain and placements. Diffable, reviewable in a pull
  request, and writable by a human or an agent without a tool.
- **Legend characters are authoring conveniences and have nothing to do with render glyphs.** Using
  case to separate sides is a habit for the author's eyes only. The simulation never sees these
  characters.
- **A multi-tile entity is placed by its anchor character**, once. Its footprint comes from its
  definition, extends from the anchor, and the loader **fails loudly** if it overlaps anything on its
  layer or leaves the Grid.
- **Validation is part of the loader, not a later linter.** Dimension mismatch, unknown legend key,
  unreachable start, overlapping footprint, and unknown content id all fail with the offending line
  and column.
- `defineScenario` is typed and returns a frozen value. It does no work — loading and validating is a
  separate function, so a scenario file is safe to import from a test.

### 3.4 Fixture content — disposable, tuned for legibility not balance

This is **not** a Commander Army and it is not canon.
[`commander-armies.md`](commander-armies.md) forbids production rosters before Milestone 4; these are
throwaway fixture numbers, and saying so here is what keeps them throwaway. Change them freely if the
fight is boring.

| Id | Layer | Footprint | HP | Supply | Move | Speed tier | Attack | Range | Damage | Cooldown |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| `unit.citizen.worker` | `workers` | 1 × 1 | 20 | 1 | `1/1` | 2 | — | — | — | — |
| `unit.citizen.trooper` | `units` | 1 × 1 | 40 | 1 | `3/4` | 2 | melee | 1 | 7 | 12 |
| `unit.citizen.marksman` | `units` | 1 × 1 | 24 | 1 | `3/4` | 1 | ranged | 5 | 6 | 24 |
| `structure.citizen.nexus` | `obstacles` | 3 × 2 | 400 | — | — | — | — | — | — | — |
| `structure.citizen.barracks` | `obstacles` | 3 × 2 | 120 | — | — | — | — | — | — | — |

Lower speed tier resolves first, so the marksman fires before the trooper swings.

The numbers are chosen so the relationship is **visible without a spreadsheet**:

- A trooper crossing a marksman's five tiles takes about 6.7 seconds and eats three shots, arriving
  at 22 of 40 health. It then kills the marksman in four seconds while taking two more. **One trooper
  beats one marksman, and finishes at a quarter health.**
- Two marksmen land six shots during that same approach. **The trooper arrives at 4 health and dies.**

Melee wins the charge; ranged wins when massed. That is a relationship a viewer can learn by watching
twice, which is the entire point of the fixture.

The Nexus and barracks exist in this gate only as **multi-tile targets** — they do not produce
anything yet. They are here because a footprint loop written on day one costs nothing and a footprint
loop retrofitted in Milestone 4 costs a week.

### 3.5 Rules in scope

Implement exactly this, and nothing adjacent:

- the Grid, its five layers, and the occupancy law — collisions within a layer, never across
  ([`engine.md`](engine.md) 3.4);
- placement with anchor, footprint, and facing; facing derived from movement or target, and read by
  nothing;
- eight-way movement, uniform step cost, Chebyshev distance;
- the integer movement credit of [`engine.md`](engine.md) 4.2, including the cap and the
  keep-credit-when-blocked rule;
- the tick order of [`engine.md`](engine.md) 4.3, with economy and production as **empty phases that
  exist and do nothing** — the slot matters, the content does not;
- target selection: nearest enemy by Chebyshev distance on any hostile layer, ties broken by entity
  id. That is the whole scoring function for now, and resisting the urge to make it clever is part of
  the gate;
- melee as an attempt to enter an enemy tile on the same layer; ranged as an attack resolved at a
  tick with an authored flight window recorded on the event;
- simultaneous damage within a speed tier, computed against the state at tier start;
- worker flight: when a hostile attacker is within `range + 2`, move away from it toward the friendly
  Nexus; otherwise hold;
- death, structure destruction, and salvage dropped as `ground-items`;
- victory: enemy Grid Nexus destroyed, or one side annihilated, or the tick count runs out.

**Not in scope:** pathfinding around obstacles beyond a greedy step with a sidestep on block; the
Commander; production; economy; upgrades; supply enforcement; the Build Phase; visibility filtering.
Greedy movement will get units stuck on rock. **That is an acceptable, reportable result** — write it
down in Section 7 of the gate report rather than building A* to hide it.

### 3.6 The CLI

```bash
pulse run     scenarios/citizen-mirror-skirmish.ts        # resolve; print summary + hashes
pulse run     <scenario> --ticks 120 --seed 0xABCD        # override
pulse events  <scenario> -o events.jsonl                  # ordered event log
pulse verify  <scenario> --runs 20                        # same hash every time?
pulse dump    <scenario> --tick 96                        # ASCII text dump of one tick, for eyes
```

`pulse dump` is the pressure valve. It is a text dump for a human debugging the kernel, **not** a
renderer, and it must stay ugly enough that nobody mistakes it for one.

### 3.7 Automated acceptance

Every item is a test that fails loudly.

**Determinism — the point of the gate**

- twenty runs of one scenario produce identical final-state hashes and identical event hashes;
- resolving in one call equals resolving tick by tick;
- the kernel never calls `Math.random`, never reads a clock, and imports nothing from a renderer —
  assert this with a real check, not a convention;
- the named PRNG matches its published test vectors;
- changing only the cosmetic seed changes nothing about state or events;
- serialization round-trips: `parse(serialize(state))` hashes identically.

**Grid and occupancy**

- no two entities ever occupy one tile **on the same layer**, at any tick;
- a worker and a unit *may* share a tile, and a test asserts this rather than forbidding it;
- multi-tile footprints never overlap, never leave the Grid, and are destroyed as a unit;
- range to a multi-tile target measures to its nearest occupied tile;
- arbitration terminates: a bounded pass count with a strictly decreasing progress measure, tested
  with a deliberately jammed corridor.

**Rules**

- movement credit reproduces the cadence table in [`engine.md`](engine.md) 4.1 exactly, at every rate;
- a blocked actor keeps its credit and steps the tick the tile frees;
- credit never exceeds one step's cost;
- two actors of equal speed that kill each other on the same tick **both die** — iteration order is
  not allowed to save either;
- a fixture scenario for each of: melee kill, ranged kill, mutual kill, worker flight, structure
  destruction, salvage drop, annihilation victory, tick-limit draw.

**Every one of those is a scenario file**, checked in, named, and runnable. That is the regression
suite and it is also the documentation.

### 3.8 Definition of done

- [ ] every check in 3.7 passes;
- [ ] `pulse run`, `events`, `verify`, and `dump` all work from a clean checkout;
- [ ] at least eight scenario files exist, one per rule fixture, plus the mirror skirmish;
- [ ] `pulse verify --runs 20` is green on all of them;
- [ ] `./scripts/check-repository.sh` passes;
- [ ] install, test, and run commands are recorded verbatim in the gate report and promoted into
      `DEVELOPMENT.md`;
- [ ] `evidence/report.md` ends with **PASS / REVISE / STOP / BLOCKED**;
- [ ] new questions are rows in [`open-questions.md`](open-questions.md), each with a recommendation.

Then **stop.** Do not start Gate 1B because the fight is invisible and that is frustrating. It is
supposed to be. The whole value of 1B is that it renders a simulation already known to be correct.

---

## 4. Gate 1B — watch the Pulse (GATED)

### 4.1 Question

> **Can a viewer follow a Pulse they did not simulate — who moved, who shot whom, who died — at
> 30 fps, in 80 × 24, with colour switched off?**

### 4.2 What gets built

The presentation stack of [`engine.md`](engine.md) Section 9: `ReadonlyCellFrame`, the band
compositor, the Grid layers mapped onto bands, the Pulse composition (thin chrome — nothing is being
selected during a Pulse, so the Grid takes the screen), playback controls, and one terminal backend
behind the `TerminalBackend` interface.

**The backend is chosen, not competed for.** Adopt the **OpenTUI imperative core** on the measured
evidence in Section 6, behind the interface, and keep direct ANSI as a fallback that stays a
half-day's work rather than a gate of its own. If OpenTUI fails a named criterion below, that is a
REVISE with the criterion recorded — not a re-plan.

Named criteria OpenTUI must meet, or the fallback ships instead: exact cell control at both tile
widths; the full lifecycle in 4.4; 30 fps with margin on a 48 × 16 Grid; and a version pin that holds
still for the length of the gate.

### 4.3 Presentation rules

- logical 12 Hz, presentation 30 fps — 2.5 frames per tick, deliberately not an integer;
- movement interpolates between tile positions across the tick; **the simulation never learns about
  the in-between position**;
- `snapshotAt(timeMs, capability, tileWidth, reducedMotion)` is pure — same arguments, same frame;
- both tile widths render from the same code; **80 × 24 at one column per tile is the acceptance
  target**, the wide composition is the bonus;
- a stacked tile draws the highest layer and marks the cell as stacked
  ([`engine.md`](engine.md) 3.4);
- controls: pause, resume, step one frame, step one tick, speed, restart, capability mode, tile width,
  reduced motion, help, quit.

### 4.4 Terminal lifecycle — the part that actually matters

`q`, `SIGINT`, `SIGTERM`, setup failure, and an injected caught render failure all run **one
idempotent disposer**. Calling it twice is harmless. Non-TTY launch prints one line and no escapes.
Resize below minimum shows a gate and freezes presentation time; resizing back resumes from the same
time. Diagnostics buffer and print after cleanup.

A renderer that drops frames is a tuning problem. A renderer that leaves the terminal in raw mode is a
reason to reject it.

### 4.5 Acceptance

Automated: frame size exact at both widths; every glyph terminal-width one; identical frames for
identical arguments; identical frames whether or not intervening frames rendered; 30 fps sustained
over 60 seconds with p95 recorded; every lifecycle path exercised; monochrome snapshots differ from
colour snapshots only in style.

Human: **a person who has not seen the scenario watches it once and narrates what happened.** They
should get the sides, who engaged whom, who died, and the outcome — with no legend and no event log.
Run it in monochrome. If it only works in colour, that is a REVISE.

---

## 5. Gate 1C — make it hit (GATED)

### 5.1 Question

> **Do anticipation, impact, and debris turn a legible battle into one that is satisfying to watch —
> and does that survive monochrome and reduced motion?**

### 5.2 What gets built

The effect system and the starter vocabulary in [`ascii-effects.md`](ascii-effects.md): the pure
`EffectRecipe` contract, the cosmetic random stream, and the ten effects, each in all three required
forms.

Author them in this order, because it is the order of diminishing returns: `fx.move.trail`,
`fx.ranged.telegraph`, `fx.ranged.tracer`, `fx.impact.burst`, `fx.death.collapse`, `fx.damage.flash`,
`fx.melee.wind`, `fx.melee.clash`, `fx.structure.collapse`, `fx.nexus.critical`.

`fx.move.trail` first, and take it seriously. It is what makes a letter read as moving rather than
teleporting between tiles, and it changes the feel of the whole game more than the other nine
combined.

### 5.3 Acceptance

Automated: every effect is pure in absolute time; emits nothing outside its window, its band, or the
Grid clip; every glyph is width one; all three forms exist and all emit at the impact beat; the
cosmetic stream never touches the gameplay stream — assert it, do not assume it; composed-frame
snapshots at fixed timestamps are stable.

Human, and this is the real gate: **show the same scenario to a fresh viewer with effects on and
off.** Ask which one they would watch again, and why. Then show the reduced-motion form and confirm
they can still tell what hit what.

Revise or stop if effects obscure their own targets, if the busiest frame becomes noise, if causality
needs colour, or if the reduced-motion form loses the story.

---

## 6. Standing evidence

Measured 2026-08-20 on Linux x64 in a Claude Code container. **Indicative, not gate evidence** —
single cold samples, no TTY. Re-measure anything you cite.

| Finding | Why it matters |
| --- | --- |
| `@opentui/core@0.5.4`, MIT, published 2026-08-18 | Current pin candidate |
| **318 published versions, 141 semver releases since 2025-08-13** | ~12 releases/month. Pin exactly, and expect the pin to age during the gate |
| Repository is `anomalyco/opentui`; older links point at `sst/opentui` | It has moved once. Verify before citing |
| Ships an explicit `node` export; imports cleanly on Node 22.22.2 | Library and runtime are independent choices |
| Native core ships as 8 prebuilt platform packages | No Zig toolchain needed to consume |
| `bun add` resolved in 1.53 s; `node_modules` 84 MB; `libopentui.so` 21 MB | Heavy for a game that draws characters. Not disqualifying |
| `OptimizedBuffer.setCell(x, y, char, fg, bg, attributes)` | `ReadonlyCellFrame` maps to a direct `setCell` loop |
| `CliRenderer(stdin, stdout, width, height, config)` takes arbitrary streams | Keeps the deferred remote path open at no cost now |
| `@opentui/core/testing` exports `ManualClock`, `TestRecorder`, mock keys and mouse | A deterministic TTY-free snapshot harness already exists — most of Gate 1B's automated acceptance can be assembled rather than written |
| Bun 1.3.11 and Node 22.22.2 present in the web container; **Deno is not** | Deno is out of this milestone |

## 7. Milestone completion

Milestone 1 passes when all three gates are accepted. Durable outputs:

- a deterministic Pulse kernel with a replayable event log, and the scenario format that drives it;
- the Grid, its layers, and multi-tile placement, proven by fixtures;
- a pinned backend behind the `TerminalBackend` interface;
- a composition that works at 80 × 24 in monochrome;
- an effect vocabulary earned from watching people watch it;
- answers to Q3, Q7, and Q9 in [`open-questions.md`](open-questions.md);
- the confirmed or corrected 12 Hz hypothesis and movement-credit rules, promoted into
  [`engine.md`](engine.md) Section 4 as LAW;
- explicit authorization — or refusal — to begin the Build Phase.
