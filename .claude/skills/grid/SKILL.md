---
name: grid
description: Working with grid, the engine, editor and replay tool (bin/grid.ts): the report grammar, the log levels, the testing save format and how to author one that exercises one rule. Use when running or reading a battle, adding a testing save, or debugging a kernel rule.
---
# Working with `grid`

`grid` is not the game: it is the tool the game gets built and tested with, a testing save (`skirmish-testing/`)
plus a CLI that places entities on a Grid, resolves a deterministic Pulse from a seed, and reports
what happened (design: [`docs/system-design/runtime.md`](../../../docs/system-design/runtime.md)). It
grew out of the first milestone's Pulse Playground and is permanent infrastructure. If a change
touches a rule, a testing save is how you prove it, and how the next session proves it again.

## Running it

The testing save is the first argument, by path or id; the suffix is optional. There is no subcommand: the default action is
watch, `--headless` resolves without a terminal and prints the levelled log, `--verify` re-resolves
(10 runs by default, `--runs N`) and fails if any run's hashes disagree. The full command line and
the options both programs share are in [`DEVELOPMENT.md`](../../../DEVELOPMENT.md) section 1.
`./bin/grid.ts <save> ...` and `npm run grid -- <save> ...` are the same. `npm run maps` runs every
testing save (`ls skirmish-testing/*/*.save.json | wc -l` counts them). A bare `grid` with no map is
reserved for the map editor and is a usage error today.

## Reading the report

One output stream, closed by a report line — a second stream for the summary turned out not to earn
its keep. `grid <save> --headless > run.log` captures the whole thing; by default it prints to the
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
  "battle": "melee-kill", "seed": 40961, "ticks": 49, "endedEarly": true,
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
4. `grid <save> --verify` after any kernel change — determinism is the one property nothing else in
   the test suite can substitute for.

Only watch it (`grid <save>`, the default action) once the headless report already makes sense — the
view answers "is this legible," not "is this correct."

## Trials: a map over many seeds

When the question is not "what happened in this battle" but "is this army, unit, number or rule better, and how
surely", play a trial ([`docs/system-design/testing-ground.md`](../../../docs/system-design/testing-ground.md)):

```text
grid engage-gap2-melee-vs-mix --seeds 1-12 --swap --shuffle --army-a trooper:6,skyraider:6   # as built vs a variant
grid engage-bench                                  # a trial file from skirmish-testing/trials/, failing if what it expects fails
grid engage-bench --tune trooper.maxHp=50          # every variant of a trial file with a unit tuned
grid engage-bench --against HEAD --profile --jobs 4   # uncommitted work beside the last commit, with what a tick cost
grid engage-bench --out before.json                # or before a change spanning commits ...
grid engage-bench --baseline before.json           # ... and after it, each row marked where it moved
```

Each summary has three tables a map (outcome; engagement; cost with `--profile`, the route counts the same on every
machine) and the battles worth watching, each with the command that replays it. When a question needs a number the
summary does not show, add it to the tool rather than to a scratch script: the spec's "Extending it" says where
each part lives (a measure, a variant, a column, a profile hook).

`--swap` plays each seed again mirrored with the sides swapped (always, for which army is better); `--shuffle` swaps
units of a formation line among their places by the seed. The variant options (`--set`, `--army-a`, `--army-b`,
`--tune`, `--terrain`, `--target-a`, `--target-b`) work on every action, so the one battle a trial points at can be
watched (`grid <save> --seed 7 --swap --army-a ...`). Read a `*` as "beyond chance"; no `*`, no claim. Compare armies at
the same supply (the last column).

## Writing a testing save

The battles `grid` plays are **testing saves**: Skirmish saves in `skirmish-testing/` that open on a Battle Round written
by hand ([`docs/system-design/skirmish-saves.md`](../../../docs/system-design/skirmish-saves.md), the `start`). They live
in a folder for what they are for: `rules/`, `units/`, `movement/`, `engage/` (the bench), `showcase/`, with the trial
files in `trials/`; the id is the file name and every command finds a save by it. **Give each side that fights a goal**:
a `target` in its start, or an enemy Nexus to head for — `tests/testing-saves.test.ts` refuses a checked-in save without
one, since the game never plays such a battle. A question about troops usually needs a variant of an engage save, not a
new save. `skirmish --load <save> --battle` plays the same Battle Round and prints the same report.

Every rule gets a named, checked-in testing save — that is the regression suite and the documentation at once. It is a
save like any other, read by the same loader (`readSave`, every problem at once), with a map drawn inline, both slots
`script:idle`, one round, and a `start` for each slot:

```json
{
  "format": "terminal-nexus.save/1",
  "name": "Melee kill - two troopers close on one",
  "notes": "What this save exists to prove, in one sentence.",
  "setup": {
    "map": {
      "id": "melee-kill",
      "rows": [ "one character per tile, one string per row, north to south" ],
      "legend": { ".": "terrain.plain", ",": "terrain.scrub" }
    },
    "seed": 40961, "goal": "elimination", "modifiers": [], "rounds": 1, "roundTicks": 180,
    "slots": { "p1": { "controller": "script:idle" }, "p2": { "controller": "script:idle" } }
  },
  "start": {
    "p1": {
      "at": {"x":5,"y":5},
      "rows": [ "t" ],
      "legend": { "t": {"content":"unit.citizen.trooper"} },
      "target": {"x":6,"y":5,"width":1,"height":1}
    },
    "p2": {
      "at": {"x":6,"y":5},
      "rows": [ "t d" ],
      "legend": {
        "t": {"content":"unit.citizen.trooper"},
        "d": {"content":"unit.citizen.trooper","hp":25}
      }
    }
  }
}
```

The map's `legend` may be left out when the rows use only `.` open, `#` rock and `*` a deposit; its size is its rows'.
`p1` is the engine's side A (west), `p2` side B. A slot's start places what it has on the Grid when the round opens:
`at` is where its `rows[0][0]` sits, so `rows` only needs to cover the tiles that slot places, not the whole Grid —
write a tight box around one side's squad. A symbol marks a unit's **centre tile**: for a 1×1 unit that's the only tile
it has, but for a multi-tile unit (`skirmish-testing/showcase/heavies-clash.save.json` is the checked-in example, a 3×3
colossus and a 5×2 leviathan) the symbol sits on the footprint's middle tile and the opening derives the anchor from it
(`footprintCentre`, `src/grid/coords.ts`). A legend entry is `{ "content": "..." }`, or `{ "content": "...", "hp": 12 }`
to start it already damaged — `hp` must fall inside `1..maxHp` for the content. `target` is where the slot's troops head.

`(0,0)` is the north-west tile; rows read north to south, exactly how they draw. The opening fails loudly — wrong
dimensions, an undefined legend key, an overlapping footprint (within a slot or **across** the two — a tile both claim,
even on different layers, is always an error), an off-Grid placement, an out-of-range `hp` — naming the slot, symbol and
tile, so a broken save is obvious immediately rather than a mysterious kernel failure later. A **Grid is capped at
10,000 tiles** (`src/skirmish/opening/open.ts`, `MAX_DECLARED_GRID_TILES`) — a sanity bound, not a real map-size limit;
raise it deliberately if a save genuinely needs to be bigger. JSON has no comments: put anything worth explaining in
`notes`.

## Testing

After adding a testing save run `./scripts/run-tests.sh bun`, not only `npm test`: Bun enforces a 5000 ms
per-test timeout that Node does not, and a test that loops over every testing save needs an explicit
`{ timeout }` ([`DEVELOPMENT.md`](../../../DEVELOPMENT.md) section 2).

## Where things live

`src/pulse` — the kernel (imports nothing presentation- or clock-related; `tests/architecture.test.ts`
enforces the import graph). `src/content` — unit/structure definitions, the Citizen and Ravel fixture
rosters and the Proving Grounds bench roster (`proving-grounds.ts`), all disposable. `src/skirmish` — the save format
(`save.ts`), a save's `start` (`start.ts`), the testing saves found by id (`testing-saves.ts`) and the opening the
kernel starts from (`opening/open.ts`, which validates it). `src/report`
— the levelled log and summary. `src/view` — the ASCII compositor and terminal backends. `src/cli` —
this tool's own entry points. `skirmish-testing/*/*.save.json` — the testing saves themselves, by folder; `skirmish-testing/trials/` — the
trial files. `src/skirmish/opening/variant.ts`, `src/measure/trial.ts`, `src/cli/trial.ts` — variants and trials.

## Related

- [`grid-screenshots`](../grid-screenshots/SKILL.md) — capturing PNG screenshots of the ASCII view
  for visual judgment, a narrower and different workflow from this one.
- [`../../../AGENTS.md`](../../../AGENTS.md) — the operating contract this skill is a companion to.
- [`docs/system-design/runtime.md`](../../../docs/system-design/runtime.md) — the design of the tool, and
  [`docs/history/milestones/milestone-01-grid-battles.md`](../../../docs/history/milestones/milestone-01-grid-battles.md)
  — the first milestone, which built it.
- [`docs/system-design/replay-format.md`](../../../docs/system-design/replay-format.md) — the designed-but-unbuilt
  `.replay.json` format this tool will eventually read and write, one layer above a single map.
