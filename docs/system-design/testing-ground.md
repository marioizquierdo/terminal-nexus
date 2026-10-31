# Terminal Nexus — the testing ground

_How a change to troops is tested before it is believed: which tool answers which question, the loop a change goes
through, the shape of a trial and how to extend each part of it, how to read one, how two builds are compared, the
maps, and the principles earlier rounds learned. Every unmarked statement is GUIDANCE._

A game like this is balanced by iteration: a new unit or Commander, a number tuned, a targeting or movement rule, how an
army arranges itself, a new class, a kind of ground. The engine resolves a battle in a fraction of a second with no
terminal, so the cheap way to know whether a change is good is to play it hundreds of times on the same grounds before
and after, read what moved, and watch the few battles that explain it. This page is the shape of that, not a catalogue:
the tool measures a few general things, and a session that needs another measure adds it, the same way the last one did
(section 4). A measure nobody reads any more is deleted.

## 1. Which tool answers which question

| The question | The tool |
| --- | --- |
| What happened in this one battle, tick by tick? | `grid <map> --headless --log-level info`, `--events` for the machine stream (the [`grid` skill](../../.claude/skills/grid/SKILL.md)) |
| Does it look right in motion? | `grid <map>` to watch; the `grid-screenshots` and `playtest` skills for pictures |
| Is this better, how often, how surely, at what cost? | a **trial**: `grid <map> --seeds 1-12 --swap` with a variant, or a trial file |
| What did my change move? | `grid <trial> --against HEAD --profile` |
| Did a refactor change no outcome at all? | `node scripts/profile-routes.ts --out <file>` before and after, then `diff` |
| How do whole armies play, with a Build Phase each round? | duels: `bin/duel.ts` with scripted players (`balanced`, `rush`, `turtle`) or a model ([`duels.md`](duels.md)); many with `measure run --parts duels` |
| How does the power curve play? | `measure run --spec quick` or `full`, `measure compare` ([`measurement.md`](measurement.md), the [`remeasure` skill](../../.claude/skills/remeasure/SKILL.md)) |
| Must this stay true? | a rule map and its test ([`testing.md`](testing.md)), or a trial file's `expect` run by a test |

Trials ask about troops: how units move, choose, arrange themselves and fight, on ground chosen to show it. Duels and
measurements ask about the game: what Build Phase choices do over rounds. A change to troops starts with trials and
ends with whatever duels its `remeasure` row asks for.

## 2. The loop

1. **Write the question**, and what would answer it: "units at a narrow pass change target less, and battles are not
   slower".
2. **Pick the bench**: a trial file that asks something close (`grid engage-bench`), or a map with a variant. A new map
   only for a new shape of ground.
3. **Make the change and compare** with the reference: `grid engage-bench --against HEAD --profile --jobs 4` plays the
   working tree beside the last commit.
4. **Read every table**, not only who won, and only the rows marked `*` as changed. A rule can win the same and cost four
   times the work, or stall fewer units by leaving them idle.
5. **Watch the battles worth watching** by the command the summary prints for each. A number says something happens;
   one battle watched says why.
6. **Keep what is worth asking again**: a trial file with what it expects, run by a test; the numbers in the pull request.

Recipes by kind of change, as starting points:

- **A unit's numbers**: `--tune <unit>.<field>=<n>` on the trials it fights in; then `--against HEAD` once written.
- **A new unit**: put it in an army, `--army-a trooper:6,<unit>:6` or `--set A.marksman=<unit>`; does its army win, and
  do its units ever reach the fight (struck, first strike)?
- **A targeting or movement rule**: the bench `--against HEAD --profile`; engagement and cost first, outcomes should
  move only on purpose; then the quick spec's duels.
- **How an army arranges itself**: mixed armies in several orders with `--army-a`; when the back of the army first
  strikes; `measure formations` for armies leaving their buildings.
- **A kind of ground**: `--terrain "#=scrub"` on the bench, or a new map of the shape.
- **A refactor**: fingerprints before and after; no line may differ.

## 3. The shape of a trial

```text
map file ──variant──▶ map for one battle ──engine──▶ states and events ──record──▶ battle record
 (scenarios/)  (pure)    (shuffled, mirrored)  (kernel and content,        (BattleRecorder:      │
                                                this build or another)      the same for duels)  │
                                                         ▲                                       ▼
                                                     meter: cost                  cells (map × variant): stats, marks
                                                  (clock, route work)                 │                │
                                                                              summary tables     expectations
                                                                              battles worth watching
```

| Part | Where | What it is |
| --- | --- | --- |
| Map | `scenarios/**/*.map.json`, `src/scenario/load-map-file.ts` | the ground, the armies, each side's target; found by id |
| Variant | `src/scenario/variant.ts` | a pure function of a map and its content to another: a unit, an army, a tune, a terrain, a target; and `shuffled` and `mirrored`, which make each seed's opening |
| Trial | `src/measure/trial.ts` | the spec (maps, seeds, variants, expectations), its runs in order, each played by an `Engine` and timed by a `Meter`, both passed in |
| Engine | `src/cli/engine.ts` | the kernel, content and scenario loader of a build's folder: this one, or another commit's checked out beside it |
| Record | `src/measure/battle.ts` | one battle in numbers, built from its states and events alone, the same for a trial, a duel and a campaign level |
| Cells | `src/measure/trial-cells.ts` | each map and variant's battles summed up: shares with intervals, medians, whether two differ beyond chance, expectations, battles worth watching |
| Summary | `src/measure/trial-summary.ts` | the printed tables and the command that replays a battle |
| Command | `src/cli/trial.ts`, `src/cli/trial-worker.ts`, `src/cli/profile.ts` | trial files and options, processes, `--against`, the clock and route counts |

Two things hold it together. **Nothing touches the kernel**: a variant is a different opening played by the same rules,
a record reads what the kernel already emits, and a profile wraps a class from outside, so a trial can never make a
battle differ from the game's. **Everything but the command is pure**: the same trial plays the same battles on every
machine, in one process or many, which is what lets two builds be compared at all.

## 4. Extending it

- **A measure** (a count a battle should report): add an optional field to `SideRecord` and count it in
  `BattleRecorder.observe` from the tick's events and state (`src/measure/battle.ts`); sum it in `armyCell`
  (`trial-cells.ts`); give it a name in `TRIAL_MEASURES` if a trial may expect it; add a column in `trialLines`
  (`trial-summary.ts`); and, if duels should show it, a phrase in `src/measure/summary.ts`. A record written before has
  no such field, so read it as absent, not zero. If no event says what you need, an event is declared in the kernel
  first (`src/events/types.ts`): that is a kernel change, with its own tests.
- **A variant** (another way to change a map): a pure function in `variant.ts`, a field of `Variant` applied in
  `applyVariant`, a command-line option in `variantFromArgs` and `VARIANT_OPTIONS` (`src/cli/trial.ts`), and its flags
  in `variantFlags` (`trial-summary.ts`) so a battle worth watching can be replayed with it. `tests/trial.test.ts` checks
  that variants compose with mirroring and shuffling.
- **A cost** (work the kernel does): wrap the class that does it in `routeCounter` (`src/cli/profile.ts`), add its count
  to `BattleCost` and `CostCell`. Counts the same on every machine are worth more than times.
- **A trial file**: `scenarios/trials/<id>.trial.json` (section 5). Give it `expect` and a test runs it.
- **A one-off question**: a probe script in the scratchpad is fine for a question asked once. Asked twice, it belongs in
  the tool; if a session finds itself rewriting a probe, that is the sign.

## 5. Trials and trial files

```text
grid engage-gap2-melee-vs-mix --seeds 1-12 --swap --shuffle --army-a trooper:6,skyraider:6
grid engage-bench                                    # a trial file; fails when what it expects does not hold
grid engage-bench --against HEAD --profile --jobs 4  # the working tree beside the last commit, with what a tick cost
```

| Option | What it does |
| --- | --- |
| `--seeds 1-12` | the seeds (`1,3,5`, `1-4,9`); twelve from both ends for a question, three for a look |
| `--swap` | each seed again with the map mirrored end for end and the sides swapped; rows name sides by army, so what an end gives cancels out |
| `--shuffle` | each side's units swapped among the places of units of their size and formation line by the seed |
| `--set A.t=raider` | a side's legend symbol, or every symbol of a content (`A.trooper=raider`), made another content |
| `--army-a trooper:6,skyraider:6` | a side's one-tile units replaced, front to back (`--army-b` for B) |
| `--tune trooper.maxHp=60` | a content's field changed (any field it has, or `vision`); a misspelt field is refused |
| `--terrain "#=scrub"` | a terrain symbol made another terrain |
| `--target-a x,y,w,h` | a side's target moved (`--target-b`) |
| `--profile` | what a tick cost: milliseconds, and route work (distance fields built, anchors settled) |
| `--jobs 4` | four processes; the same battles merged in order |
| `--against <ref>`, `--baseline <file>`, `--out <file>`, `--json` | section 7; `--json` prints the cells as data |

The variant options work on every `grid` action, so `grid <map> --seed 7 --swap --army-a ...` watches the battle a
trial pointed at. A trial file keeps a question:

```json
{
  "id": "engage-bench",
  "question": "How fast are battles decided, and do units engage, on each ground?",
  "notes": "What it is for and how it is set up, for a person.",
  "maps": ["engage-open-melee-vs-mix", "engage-gap2-melee-vs-mix"],
  "seeds": "1-12", "swap": true, "shuffle": true,
  "base": { "tune": { "trooper.maxHp": 50 } },
  "variants": { "as built": {}, "air mix": { "army": { "A": "trooper:6,skyraider:6" } } },
  "expect": [{ "map": "engage-gap2-melee-vs-mix", "variant": "as built", "measure": "winB", "atLeast": 0.9 }]
}
```

`variants` are played in order and each row is marked against the first (none: the maps as built). `base` is what
every variant starts from, and variant options on the command line go on top of it. `expect` names a measure from
`TRIAL_MEASURES` and a bound; `grid` fails when one does not hold, and `tests/engage-scenarios.test.ts` runs the bench's.

## 6. Reading a trial

```text
engage-gap2-melee-vs-mix
  outcome     A wins            decided  contact  lost A/B           supply A/B
  as built    0%  [0%–14%]      44.2s    5.4s     12.0/4.8 of 12/12  12/12
  engagement  struck A/B  first A/B    idle A/B  stalled A/B  switches A/B
  as built    67%/100%    12.6s/6.3s   0.0/0.0   5.0/0.2      2.8/1.2
  cost        ms/tick   fields/tick  settled/tick
  as built    0.518     9.8          489
```

- **Outcome**: the share side A's army won with its 95% interval (Wilson's: over 24 battles a 50% is anything from 31%
  to 69%); the median time to a result over battles that had one; the first strike; units lost; the supply each army
  took, the game's own price of a unit. Compare armies at equal supply.
- **Engagement**: the share of each army that ever struck, and the median second it first did (how long the back of an
  army waits); units **idle** (five seconds neither moving, striking nor blocked: standing at a target or holding a line,
  or given nothing to do) and **stalled** (five seconds blocked: trying, in vain), a battle; target **switches** a unit
  (a new target while the old one stood).
- **Cost** (`--profile`): milliseconds a tick are the machine's and its load's (compare them on one machine, at one
  `--jobs`); fields built and anchors settled a tick are the kernel's route work and **the same on every machine**, so they
  compare two algorithms.
- **Marks**: a `*` is a difference from the row compared with beyond chance (about 95%); a time or a cost must also move
  by a twentieth. No `*`, no claim.
- **Worth watching**: for each map and variant, the upset, the slowest battle and the most stalled, when one stands out,
  each with the command that replays it exactly (`tests/trial.test.ts` holds it to that).

## 7. Comparing two builds

- **`--against <ref>`**: the trial is played by that commit's kernel and content as well, in a temporary worktree removed
  after; the maps, trial and record are the working tree's, so both are asked the same question. `--against HEAD`
  compares uncommitted work with the last commit, `--against origin/main` a branch with main.
- **`--out` then `--baseline`**: the same by a file written before, when the change spans commits.
- **Fingerprints** (`scripts/profile-routes.ts --out`): every map's and some duels' event and state hashes; a refactor's
  proof is no line differing. `--detail` says where route time went, question by question.
- **Duels and campaign levels**: `measure run ... --out`, then `measure compare`.

## 8. The maps

| Folder | What its maps are for |
| --- | --- |
| `scenarios/rules/` | one rule each, as small as shows it |
| `scenarios/units/` | one unit's mechanic each, the proving grounds |
| `scenarios/movement/` | one shape a route must manage each |
| `scenarios/engage/` | **the bench**: twelve units a side on six grounds (open, gaps of six and two rows, a corridor, two lanes), each side's target the enemy Nexus, exactly symmetric |
| `scenarios/showcase/` | whole battles to look at |
| `scenarios/trials/` | trial files |

A map's id is its file name, and every command finds a map by it (RULE — `mapCatalog`). **Every side that fights has
somewhere to go**, its own target or an enemy Nexus, as in every battle the game plays (RULE — `sidesWithoutGoal`,
`tests/scenario.test.ts`). A new map for the bench is drawn at 48 by 16, mirrored exactly, each side's target the enemy
Nexus, and checked even before anything is read on it: the same army on both sides, `--swap`, a dozen seeds.

## 9. Principles

- **Set a battle up as the game sets it up.** A rule once seemed to cut blocked time by nine tenths: its units had
  stopped trying, on maps that gave no side a target. Hence the goal rule, and idle units counted beside stalled ones.
- **Check a map even before trusting it.** A bench drawn as mirrors gave one end 27 battles to 7: a Nexus placed by its
  corner. A mirror match from both ends shows it.
- **Vary the opening and play enough.** One layout turns on tie draws alone; both ends and a dozen seeds before a few
  percent means anything.
- **Read the whole row.** Better metrics find more problems: the first count of target switches found units at a narrow
  pass changing target every tick, at four times the route work, while their win rate gave no sign of it.
- **Watch one battle** before believing a number that moved a lot.
- **Scripted armies are not players**, and twelve units a side are not forty: confirm on duels and in the owner's games.
