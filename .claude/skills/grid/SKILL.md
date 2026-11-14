---
name: grid
description: Grid, the engine tool (bin/grid.ts): run, read or debug a battle, check determinism, play a trial, or write a sandbox that exercises one rule. Use when a kernel rule changes, when a battle's report or log is the question, and when adding a sandbox.
---
# Working with `grid`

`grid` is not the game: it is the tool the game is built and tested with. It plays a sandbox (`sandboxes/`), a testing
ground like a unit test's context: a slice of the Grid for one rule, effect, movement or ability, with no Nexus power,
credits or round count, measuring what happens in the slice, not who wins (that is the `skirmish` command). Every unit
and building stands in one alone (`tests/sandbox-spawn.test.ts`). It is a sandbox plus a CLI that
resolves a deterministic Pulse from a seed and reports what happened (design:
[`runtime.md`](../../../docs/system-design/runtime.md)). A change to a rule is proved by a sandbox, and the next session
proves it again the same way.

## Running it

`./bin/grid.ts <save> ...` and `npm run grid -- <save> ...` are the same; `--help` is the full command line. The
sandbox is the first argument, by path or id, suffix optional. There is no subcommand: the default action is watch,
`--headless` resolves without a terminal and prints the levelled log, `--verify` re-resolves (10 runs, `--runs N`) and
fails if any run's hashes disagree. `npm run sandboxes` lists every sandbox. The options both programs share are in
[`DEVELOPMENT.md`](../../../DEVELOPMENT.md), "Toolchain and commands".

## Debugging a rule

Text before pixels: a headless run costs nothing and answers most questions. Done when the log or event stream shows
the decision that produced the outcome, and `--verify` is green.

1. Reproduce with `--seed` fixed and `--log-level DEBUG` (`TRACE` for full per-tick state).
2. `grep` the log for the entity or event kind (`grep engage`, `grep "A:trooper#1"`).
3. Compare `--json` or `--events` across two runs or two versions when "did the outcome change" needs a precise answer.
4. `grid <save> --verify` after any kernel change: determinism is the one property nothing else in the suite can
   substitute for.

Watch it (`grid <save>`) once the headless report makes sense: the view answers "is this legible", not "is this correct".

## Reading the report

One stream, closed by a `report` line. `grid <save> --headless > run.log` captures it.

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

Columns are fixed: `[tick] LEVEL kind subject [-> object] detail`. Levels are cumulative, default `WARN`, picked
with `--log-level`:

| Level | Adds |
| --- | --- |
| `ERROR` | Invariant violations, load failures; any `ERROR` fails the run |
| `WARN` | A stuck actor, arbitration hitting its pass bound, a vanished target, and the closing `report` line, always |
| `INFO` | Spawns, first engagement, every attack that landed, every death, victory |
| `DEBUG` | Target scoring, movement intents, arbitration winners and losers, per tick |
| `TRACE` | Per-entity, per-tick full state: enormous on purpose |

- `--json` gives the report's summary (battle, seed, ticks, outcome, losses, hashes, versions) as data: for scripts and
  for comparing two runs.
- `--events <file>` writes the ordered `DomainEvent` stream as JSONL (`src/events/types.ts` has the kind union): a test
  asserts on this, and `--verify` hashes it. The log can reword without changing a hash.
- `--save-log <file>` writes the levelled log in any action, `watch` included.
- `--from-tick <tick>` seeks there in every action: `watch` starts playback at it (free, the states are already
  resolved); `--headless` drops log lines before it, keeping `ERROR`s and the report; `--verify` also compares a
  state-hash snapshot at that tick across runs, which bisects where nondeterminism first appears.

## Trials: a map over many seeds

When the question is "is this army, unit, number or rule better, and how surely", play a trial
([`sandboxes.md`](../../../docs/system-design/sandboxes.md)):

```text
# grid is `npm run grid --` (or ./bin/grid.ts)
grid engage-gap2-melee-vs-mix --seeds 1-12 --swap --shuffle --army-a trooper:6,skyraider:6   # as built vs a variant
grid engage-bench                                  # a trial file from sandboxes/trials/, failing if what it expects fails
grid engage-bench --tune trooper.maxHp=50          # every variant of a trial file with a unit tuned
grid engage-bench --against HEAD --profile --jobs 4   # uncommitted work beside the last commit, with what a tick cost
grid engage-bench --out before.json                # or before a change spanning commits ...
grid engage-bench --baseline before.json           # ... and after it, each row marked where it moved
```

The summary has an outcome table, an engagement table, a cost table with `--profile`, and the battles worth watching,
each with the command that replays it. A number the summary lacks is added to the tool, not to a scratch script (the
sandboxes page, "Extending it", says where each part lives). The variant options (`--set`, `--army-a`, `--army-b`,
`--tune`, `--terrain`, `--target-a`, `--target-b`, `--swap`, `--shuffle`) work on every action, so a trial's one battle
can be watched. Read a `*` as "beyond chance"; no `*`, no claim. Compare armies at the same supply (the last column).

## Writing a sandbox

A sandbox is a Skirmish save in `sandboxes/<folder>/` (`rules/`, `units/`, `movement/`, `engage/`, `showcase/`, trial
files in `trials/`) whose `start` writes a Battle Round by hand; the id is the file name and every command finds a
save by it. Every rule gets a named, checked-in sandbox: the regression suite and the documentation at once. The
format is [`skirmish-saves.md`](../../../docs/system-design/skirmish-saves.md); the sandbox page says what each folder is for.
A sandbox is in the Battle Round unless `start.phase` says `build-phase`: then nothing attacks, spawns or trains, a
Nexus mends and units in a fight step back; a headless run ends with each entity's hp and tile, start to end, and refuses `--ticks` ([`sandboxes.md`](../../../docs/system-design/sandboxes.md), Build Phase or Battle Round).

1. Copy the nearest checked-in sandbox (`sandboxes/rules/melee-kill.save.json` is the smallest template; a multi-tile
   unit is `sandboxes/showcase/heavies-clash.save.json`), and put in `notes` the one sentence the save exists to prove
   (JSON has no comments).
2. Draw only what the rule needs: a map inline, both slots `script:idle`, one round, a tight box of units per slot.
   A symbol marks a unit's centre tile; `(0,0)` is the north-west tile; `p1` is side A (west).
3. Give each side that fights a goal: a `target` in its start, or an enemy Nexus to head for. `tests/sandboxes.test.ts`
   refuses a checked-in save without one. A question about troops usually needs a variant of an engage save, not a
   new save.
4. Run `grid <save> --headless --log-level INFO`; the opening fails loudly (naming slot, symbol and tile) on a wrong
   dimension, an undefined legend key, an overlapping or off-Grid footprint, an out-of-range `hp`. Done when the log
   shows the rule firing and `grid <save> --verify` is green.
5. Run `./scripts/run-tests.sh bun` as well as `npm test`: Bun enforces a 5000 ms per-test timeout that Node does not,
   and a test that loops over every sandbox needs an explicit `{ timeout }`
   ([`DEVELOPMENT.md`](../../../DEVELOPMENT.md), "Testing").

`skirmish --load <save> --play-to next` plays the same Battle Round and prints the same report. A Grid is capped at
10,000 tiles (`MAX_DECLARED_GRID_TILES`, `src/skirmish/opening/open.ts`), a sanity bound to raise deliberately.

## Related

- [`grid-screenshots`](../grid-screenshots/SKILL.md): PNG screenshots of the ASCII view, for visual judgment.
- [`AGENTS.md`](../../../AGENTS.md), "Where things are": where the kernel, content, skirmish and view code live;
  `tests/architecture.test.ts` enforces the kernel's import graph.
- [`runtime.md`](../../../docs/system-design/runtime.md): the tool's design; [`replay-format.md`](../../../docs/system-design/replay-format.md):
  the designed, unbuilt `.replay.json`.
