---
name: grid
description: Work with `grid`, the Terminal Nexus engine/editor/replay CLI — run or watch a scenario, read the levelled report and the JSONL event stream, write or debug a scenario fixture, or run determinism verification. Use whenever a task touches the kernel (src/pulse), content (src/content), scenarios (src/scenario, scenarios/*.ts), the report (src/report), or the ASCII view (src/view), or whenever you need to actually resolve a battle rather than read about one.
---

# Working with `grid`

`grid` is not the game — it is the tool the game gets built and tested with: a scenario file plus a
CLI that places entities on a Grid, resolves a deterministic Pulse from a seed, and reports what
happened (`engine.md` Section 11). It grew out of Milestone 1's Pulse Playground and kept growing;
treat it as permanent infrastructure, not a spike. If a change touches a rule, a scenario is how you
prove it, and a scenario is how the next session proves it again.

## The three subcommands

```text
grid run    <scenario.ts> [--seed 0xABCD] [--ticks 120] [--log-level info]
                          [--events events.jsonl] [--json]
grid watch  <scenario.ts> [--seed] [--ticks] [--speed 1] [--tile-width 1|2]
                          [--capability monochrome|color16|color256|truecolor]
                          [--theme dark|light] [--glyphs ascii|unicode]
                          [--no-effects] [--reduced-motion] [--cosmetic-seed 0x1234]
                          [--backend auto|ansi|opentui]
grid verify <scenario.ts> [--runs 20] [--seed] [--ticks]
```

`run` resolves headlessly and prints the report — this is the fast loop, and the one to reach for
first. `watch` drives the same resolution through the ASCII view in a real terminal. `verify`
re-resolves the same scenario `--runs` times (default 20) and fails if any run's hashes disagree —
the determinism check, and what CI-equivalent means here.

`./bin/grid.ts <subcommand> ...` runs it directly; `npm run grid -- <subcommand> ...` works too.
`npm run scenarios` lists the checked-in fixtures (21 today, in `scenarios/*.ts`). `npm run play`,
`play:mono`, `play:cascade`, `play:plain`, `play:light`, `play:parade`, and `play:grand`
(`package.json`) are pre-built `watch` invocations worth knowing rather than retyping.

## Reading the report

Two outputs, deliberately split: a **levelled log on stderr** (the story) and a **summary on
stdout** (the outcome and the hashes). `grid run x.ts > report.txt 2> run.log` separates them; by
default both interleave in the terminal.

```text
[0000] INFO  spawn    A:trooper#1   at (10,5)
[0001] INFO  engage   A:trooper#1   -> B:trooper#2    dist 3  score 3.0
[0013] INFO  attack   A:trooper#1   -> B:trooper#2    melee  dmg 7  hp 40->33
[0049] INFO  death    B:trooper#2   at (12,5)  by A:trooper#1
[0049] INFO  victory  A             reason: annihilation
```

Fixed-column and greppable on purpose — `grep engage`, `grep death`, `grep "A:trooper#1"` all work.
Levels are cumulative, default `INFO`, `--log-level` picks the ceiling:

| Level | Adds |
| --- | --- |
| `ERROR` | Invariant violations, load failures — any `ERROR` fails the run |
| `WARN` | Suspicious but survivable: a stuck actor, arbitration hitting its pass bound, a vanished target |
| `INFO` | The story: spawns, first engagement, every attack that landed, every death, victory |
| `DEBUG` | Per-tick mechanics: target scoring, movement intents, arbitration winners/losers |
| `TRACE` | Per-entity, per-tick full state. Enormous on purpose — reach for it only when you need it |

`--json` gives the same summary as data, useful for scripting or for comparing two runs precisely:

```json
{
  "scenario": "melee-kill", "seed": 40961, "ticks": 49, "endedEarly": true,
  "outcome": { "winner": "A", "reason": "annihilation" },
  "losses": { "A": { "lost": 0, "started": 2 }, "B": { "lost": 1, "started": 1 } },
  "stateHash": "94dfe7aa...", "eventsHash": "0e9f9a6d...",
  "engineVersion": "0.1.0-gate1a", "contentLock": "62154869...", "events": 38
}
```

## The machine surface

The log is for a human and for story-level assertions. When a test needs structure, use
`--events <file>` — the ordered `DomainEvent` stream as JSONL, one canonical event per line
(`src/events/serialize.ts`, `src/events/types.ts` for the full kind union). This is what a test
should assert on, and what a scenario's determinism actually hashes
(`resolvePulse`'s `stateHash`/`eventsHash`, `src/pulse/resolve.ts`) — the log can change its wording
without changing a hash; the event stream is the real machine surface underneath it.

## Debugging a rule

The fast loop is text before pixels — a `run` costs nothing and answers most questions:

1. Reproduce with `--seed` fixed and `--log-level DEBUG` (or `TRACE` for full per-tick state) to see
   the mechanical decision, not just its outcome.
2. `grep` the log for the entity or event kind in question — the column grammar is
   `[tick] LEVEL kind subject [-> object] detail…`, stable across every scenario.
3. Compare `--json` output (or `--events`) across two runs or two versions of a change when "did the
   outcome actually change" needs a precise answer rather than a read of the log.
4. `grid verify x.ts --runs 20` after any kernel change — determinism is the one property nothing
   else in the gate can substitute for.

Only watch it (`grid watch`) once the headless report already makes sense — the view answers "is this
legible," not "is this correct."

## Writing a scenario

Every rule gets a named, checked-in scenario file — that is the regression suite and the
documentation at once (`AGENTS.md`, `milestone-1-spike-battle.md` 3.5). A scenario is plain
TypeScript, does no work at import time, and is safe to import from a test:

```ts
import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "melee-kill",
  name: "Melee kill - two troopers close on one",
  notes: "What this fixture exists to prove, in one sentence.",
  grid: { preset: "small-wide" },   // or { width, height } for a custom size
  seed: 0x0000a001,
  pulseTicks: 180,
  terrain: [ /* one character per row, north to south, rows == grid height */ ],
  terrainLegend: { ".": "terrain.plain", "#": "terrain.rock", "*": "terrain.deposit" },
  placements: [ /* same dimensions, a space means nothing here */ ],
  placementLegend: { t: { player: "A", content: "unit.citizen.trooper" } },
})
```

`(0,0)` is the north-west tile; rows read north to south, exactly how they draw. The loader fails
loudly — wrong dimensions, an undefined legend key, an overlapping footprint, an off-Grid placement —
naming the row and column, so a broken fixture is obvious immediately rather than a mysterious
kernel failure later. A **custom grid is capped at 10,000 tiles** (`src/scenario/load.ts`,
`MAX_DECLARED_GRID_TILES`) — a declared-mode sanity bound, not a real map-size limit; raise it
deliberately if a scenario genuinely needs to be bigger.

## Testing

`npm test` runs everything under Node; `npm run test:bun` runs the same files under Bun, one file at
a time. **Bun enforces a 5000ms default per-test timeout Node's runner does not** — any test whose
cost scales with the scenario count needs an explicit `{ timeout }` third argument, or it silently
approaches that ceiling as scenarios are added. `DEVELOPMENT.md` has the full pattern and both times
it has already bitten this project; run `./scripts/run-tests.sh bun` (not just `npm test`) after
adding a scenario file, not only after touching the kernel.

## Where things live

`src/pulse` — the kernel (imports nothing presentation- or clock-related; `tests/architecture.test.ts`
enforces the import graph). `src/content` — unit/structure definitions, currently the disposable
Citizen and Ravel bench fixtures. `src/scenario` — the file format and loader. `src/report` — the
levelled log and summary. `src/view` — the ASCII compositor and terminal backends. `src/cli` — this
tool's own entry points. `scenarios/*.ts` — the fixtures themselves.

## Related

- [`grid-screenshots`](../grid-screenshots/SKILL.md) — capturing PNG screenshots of the ASCII view
  for visual judgment, a narrower and different workflow from this one.
- [`../../../AGENTS.md`](../../../AGENTS.md) — the operating contract this skill is a companion to.
- [`../../../specs/engine.md`](../../../specs/engine.md) Section 11, and
  [`../../../specs/milestone-1-spike-battle.md`](../../../specs/milestone-1-spike-battle.md)
  Section 3 — the canon this tool implements.
- [`../../../specs/replay-format.md`](../../../specs/replay-format.md) — the designed-but-unbuilt
  `.replay.json` format this tool will eventually read and write.
