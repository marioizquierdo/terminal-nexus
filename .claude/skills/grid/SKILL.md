# Working with `grid`

`grid` is not the game — it is the tool the game gets built and tested with: a `.map.json` map file
plus a CLI that places entities on a Grid, resolves a deterministic Pulse from a seed, and reports
what happened (`engine.md` Section 11). It grew out of Milestone 1's Pulse Playground and kept
growing; treat it as permanent infrastructure, not a spike. If a change touches a rule, a map is how
you prove it, and a map is how the next session proves it again.

## No subcommand — the map is the first argument

```text
grid <map>                                  [--seed 0xABCD] [--ticks 120] [--turn 90]
                                             [--speed 1] [--tile-width 1|2]
                                             [--capability monochrome|color16|color256|truecolor]
                                             [--theme dark|light] [--glyphs ascii|unicode]
                                             [--no-effects] [--reduced-motion] [--cosmetic-seed 0x1234]
                                             [--backend auto|ansi|opentui] [--save-log <file>]
    the ASCII view (the default action) — watches the map resolve live

grid <map> --headless [--seed] [--ticks] [--turn 90] [--log-level info]
                       [--events events.jsonl] [--json] [--save-log <file>]
    resolves without a terminal and prints the levelled log

grid <map> --verify [--runs 10] [--seed] [--ticks] [--turn 90]
    re-resolves 10 times by default and fails if any run's hashes disagree — also headless
```

`<map>` is a path to a `.map.json` file; the suffix is optional (`grid scenarios/melee-kill` and
`grid scenarios/melee-kill.map.json` are the same file). There is no `run`/`watch`/`verify`
subcommand any more — the default action is `watch`, and `--headless`/`--verify` switch it.

`./bin/grid.ts <map> ...` runs it directly; `npm run grid -- <map> ...` works too. `npm run maps`
lists the checked-in fixtures (21 today, in `scenarios/*.map.json`). A bare `grid` with no map is
reserved for the map editor — not built yet, so today it's a usage error.

## Reading the report

One output stream, closed by a report line — a second stream for the summary turned out not to earn
its keep. `grid <map> --headless > run.log` captures the whole thing; by default it prints to the
terminal.

```text
[0000] INFO  spawn    A:trooper#1   at (10,5)
[0001] INFO  engage   A:trooper#1   -> B:trooper#2    dist 3  score 3.0
[0013] INFO  attack   A:trooper#1   -> B:trooper#2    melee  dmg 7  hp 40->33
[0049] INFO  death    B:trooper#2   at (12,5)  by A:trooper#1
[0049] INFO  victory  A             reason: annihilation
[0049] WARN  report   melee-kill    seed 0x0000A001  ticks 49 of 180 (ended early: annihilation)
                                    outcome A wins  losses A: 0 of 2  B: 1 of 1
                                    state sha256:...  events sha256:...
```

Fixed-column and greppable on purpose — `grep engage`, `grep death`, `grep "A:trooper#1"` all work.
Levels are cumulative, default **`WARN`**, `--log-level` picks the ceiling:

| Level | Adds |
| --- | --- |
| `ERROR` | Invariant violations, load failures — any `ERROR` fails the run |
| `WARN` | Suspicious but survivable: a stuck actor, arbitration hitting its pass bound, a vanished target — **plus the closing `report` line**, always, so a bare `--headless` run still ends with the outcome even at the default level |
| `INFO` | The story: spawns, first engagement, every attack that landed, every death, victory |
| `DEBUG` | Per-tick mechanics: target scoring, movement intents, arbitration winners/losers |
| `TRACE` | Per-entity, per-tick full state. Enormous on purpose — reach for it only when you need it |

`--json` gives the same summary as data instead of the log, useful for scripting or for comparing two
runs precisely:

```json
{
  "scenario": "melee-kill", "seed": 40961, "ticks": 49, "endedEarly": true,
  "outcome": { "winner": "A", "reason": "annihilation" },
  "losses": { "A": { "lost": 0, "started": 2 }, "B": { "lost": 1, "started": 1 } },
  "stateHash": "94dfe7aa...", "eventsHash": "0e9f9a6d...",
  "engineVersion": "0.1.0-gate1a", "contentLock": "62154869...", "events": 38
}
```

`--save-log <file>` writes the levelled log to a file in **any** action, including `watch` — no need
to give up the ASCII view to keep a record of what happened.

## Jumping to a tick

`--turn <tick>` seeks straight to that tick instead of playing from the start, in all three actions:

- `watch` starts playback there instead of at tick 0 — the states are already resolved, so this is
  free, not a re-simulation;
- `--headless` drops every log line before that tick, keeping `ERROR`s and the closing report
  regardless, so you can jump straight to the moment a bug report is about;
- `--verify` additionally compares a state-hash snapshot at that tick across every run, which is how
  you bisect *where* a nondeterminism first appears rather than only knowing the final hashes disagree.

## The machine surface

The log is for a human and for story-level assertions. When a test needs structure, use
`--events <file>` — the ordered `DomainEvent` stream as JSONL, one canonical event per line
(`src/events/serialize.ts`, `src/events/types.ts` for the full kind union). This is what a test
should assert on, and what `--verify` actually hashes
(`resolvePulse`'s `stateHash`/`eventsHash`, `src/pulse/resolve.ts`) — the log can change its wording
without changing a hash; the event stream is the real machine surface underneath it.

## Debugging a rule

The fast loop is text before pixels — a headless run costs nothing and answers most questions:

1. Reproduce with `--seed` fixed and `--log-level DEBUG` (or `TRACE` for full per-tick state) to see
   the mechanical decision, not just its outcome.
2. `grep` the log for the entity or event kind in question — the column grammar is
   `[tick] LEVEL kind subject [-> object] detail…`, stable across every map.
3. Compare `--json` output (or `--events`) across two runs or two versions of a change when "did the
   outcome actually change" needs a precise answer rather than a read of the log.
4. `grid <map> --verify` after any kernel change — determinism is the one property nothing else in
   the gate can substitute for.

Only watch it (`grid <map>`, the default action) once the headless report already makes sense — the
view answers "is this legible," not "is this correct."

## Writing a map

Every rule gets a named, checked-in `.map.json` file — that is the regression suite and the
documentation at once (`AGENTS.md`, `milestone-1-spike-battle.md` 3.5). A map is plain JSON, the same
shape a campaign level and a map-editor-authored map will eventually share:

```json
{
  "id": "melee-kill",
  "name": "Melee kill - two troopers close on one",
  "notes": "What this fixture exists to prove, in one sentence.",
  "grid": { "preset": "small-wide" },
  "seed": 40961,
  "pulseTicks": 180,
  "terrain": [ "one character per tile, one string per row, north to south" ],
  "terrainLegend": { ".": "terrain.plain", "#": "terrain.rock", "*": "terrain.deposit" },
  "placements": {
    "A": {
      "at": { "x": 5, "y": 5 },
      "rows": [ "t" ],
      "legend": { "t": { "content": "unit.citizen.trooper" } }
    },
    "B": {
      "at": { "x": 6, "y": 5 },
      "rows": [ "t d" ],
      "legend": {
        "t": { "content": "unit.citizen.trooper" },
        "d": { "content": "unit.citizen.trooper", "hp": 25 }
      }
    }
  }
}
```

One placement block per player — `placements.A`, `placements.B`, a future player its own key. A
block's `at` is where its `rows[0][0]` sits, so `rows` only needs to cover the tiles that block
actually places, not the whole Grid — write a tight box around one player's squad, not a
Grid-sized overlay with everyone else blank. A placement symbol marks a unit's **centre tile**: for
a 1×1 unit that's the only tile it has, but for a multi-tile unit (`scenarios/heavies-clash.map.json`
is the checked-in example, a 3×3 colossus and a 5×2 leviathan) the symbol sits on the footprint's
middle tile and the loader derives the anchor from it (`footprintCentre`, `src/grid/coords.ts`). A
legend entry is `{ "content": "..." }`, or `{ "content": "...", "hp": 12 }` to start that placement
already damaged — `hp` must fall inside `1..maxHp` for the content or the loader rejects it.

`(0,0)` is the north-west tile; rows read north to south, exactly how they draw. The loader fails
loudly — wrong dimensions, an undefined legend key, an overlapping footprint (within a block or
**across** the two players — a tile two players both claim, even on different layers, is always an
error now that each has its own block), an off-Grid placement, an out-of-range `hp` — naming the
block, symbol, and tile, so a broken fixture is obvious immediately rather than a mysterious kernel
failure later. A **custom grid is capped at 10,000 tiles** (`src/scenario/load.ts`,
`MAX_DECLARED_GRID_TILES`) — a declared-mode sanity bound, not a real map-size limit; raise it
deliberately if a map genuinely needs to be bigger.

JSON has no comments, which is the one thing the old TypeScript-module format could carry and this
one can't — put anything worth explaining in `notes` instead. `src/scenario/types.ts`'s
`defineScenario` still exists for TypeScript-authored content that compiles down to a `.map.json`
file; nothing checked in uses it that way today, so `.map.json` files are written and read directly.

## Testing

`npm test` runs everything under Node; `npm run test:bun` runs the same files under Bun, one file at
a time. **Bun enforces a 5000ms default per-test timeout Node's runner does not** — any test whose
cost scales with the map count needs an explicit `{ timeout }` third argument, or it silently
approaches that ceiling as maps are added. `DEVELOPMENT.md` has the full pattern and both times it
has already bitten this project; run `./scripts/run-tests.sh bun` (not just `npm test`) after adding
a map file, not only after touching the kernel.

## Where things live

`src/pulse` — the kernel (imports nothing presentation- or clock-related; `tests/architecture.test.ts`
enforces the import graph). `src/content` — unit/structure definitions, currently the disposable
Citizen and Ravel bench fixtures. `src/scenario` — the map format and loader (`load.ts` validates the
shape once parsed; `loadMapFile.ts` reads and parses a `.map.json` path, suffix optional). `src/report`
— the levelled log and summary. `src/view` — the ASCII compositor and terminal backends. `src/cli` —
this tool's own entry points. `scenarios/*.map.json` — the fixtures themselves.

## Related

- [`grid-screenshots`](../grid-screenshots/SKILL.md) — capturing PNG screenshots of the ASCII view
  for visual judgment, a narrower and different workflow from this one.
- [`../../../AGENTS.md`](../../../AGENTS.md) — the operating contract this skill is a companion to.
- [`../../../specs/engine.md`](../../../specs/engine.md) Section 11, and
  [`../../../specs/milestone-1-spike-battle.md`](../../../specs/milestone-1-spike-battle.md)
  Section 3 — the canon this tool implements.
- [`../../../specs/replay-format.md`](../../../specs/replay-format.md) — the designed-but-unbuilt
  `.replay.json` format this tool will eventually read and write, one layer above a single map.
