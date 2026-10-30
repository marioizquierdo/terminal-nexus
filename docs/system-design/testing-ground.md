# Terminal Nexus — the testing ground

_How a change to troops is tested before it is believed: a new unit or Commander, a number tuned, a targeting or
movement algorithm, how an army arranges itself, a new class or priority, a kind of ground, a building. Which tool
answers which question, the loop every change goes through, a recipe for each kind of change, the maps, trials and
what they measure (cost included), how two builds are compared, and the patterns earlier sessions repeated by hand
that the tools now do. Every unmarked statement is GUIDANCE._

A game like this is balanced by iteration, and iteration is only as fast as its tests. The engine resolves a battle in
a fraction of a second with no terminal, so the cheap way to know whether a change is good is to play it hundreds of
times on the same grounds before and after, read what moved, and watch the few battles that explain it. This page is
the shared way of doing that, so each session starts from it instead of from scratch scripts.

## 1. Which tool answers which question

| The question | The tool |
| --- | --- |
| What happened in this one battle, tick by tick? | `grid <map> --headless --log-level info` (or `debug`), `--events` for the machine stream; the [`grid` skill](../../.claude/skills/grid/SKILL.md) |
| Does it look right in motion? | `grid <map>` to watch, the `grid-screenshots` skill for pictures, the `playtest` skill for the Build Phase screen |
| Is this better, how often, and how surely? | a **trial**: `grid <map> --seeds 1-12 --swap` with a variant, or a trial file (sections 4 to 6) |
| What did my change move, and what did it cost? | `grid <trial> --against HEAD --profile` (section 7) |
| Did a refactor change no outcome at all? | `node scripts/profile-routes.ts --out before.txt` before and after, then `diff`: every battle's fingerprint (section 7) |
| How do whole armies play, with a Build Phase each round? | duels: `bin/duel.ts`, scripted players more or less aggressive (`balanced`, `rush`, `turtle`) or a model a side ([`duels.md`](duels.md)); many at once with `measure run --parts duels` |
| How does the power curve play: the campaign, a full spec? | `measure run --spec quick` or `full`, `measure compare` ([`measurement.md`](measurement.md)); the [`remeasure` skill](../../.claude/skills/remeasure/SKILL.md) says how much |
| What does one unit do in each campaign level? | `measure who <content id>` |
| Is it deterministic? | `grid <map> --verify`, `npm run verify-maps` |
| Must this stay true from now on? | a rule map and its test ([`testing.md`](testing.md)), or a trial file's `expect` run by a test |

Maps and trials are for questions about troops: how units move, choose, arrange themselves and fight, on ground
chosen to show it. Duels and measurements are for questions about the game: what Build Phase choices do over rounds.
A change to troops starts with trials and ends with the duels its `remeasure` row asks for.

## 2. The loop

1. **Write the question** in a sentence, and what would answer it: "units at a narrow pass switch targets less, and
   battles are not slower".
2. **Pick the bench**: the trial that already asks something close (`grid engage-bench`), or a map and a variant
   (sections 3 to 5). Make a new map only for a new shape of ground.
3. **Take the reference**: nothing to do with `--against HEAD`, which plays the committed code beside the working tree;
   or `--out before.json` when the change spans commits.
4. **Make the change** and play the same trial against the reference, with `--profile` when the change touches how units
   move or choose: `grid engage-bench --against HEAD --profile --jobs 4`.
5. **Read the marks.** A `*` is a difference beyond chance; no `*`, no claim. Read every table, not only who won: a rule
   can win the same and cost four times the route work, or stall fewer units by making them idle.
6. **Watch the battles worth watching** the summary lists, by the command it prints for each. A number says something
   happens; one battle watched says why. Read one battle's log by eye before trusting any number that moved a lot.
7. **Keep what is worth asking again**: a trial file with what it expects, so a later change that breaks it fails a
   test; and the result in the pull request, or for the record in [`docs/history/measurements/`](../history/measurements/README.md).

## 3. A recipe for each kind of change

| The change | Play | Read |
| --- | --- | --- |
| A unit's numbers (health, damage, range, speed, vision) | `grid <trial> --tune <unit>.<field>=<n>` on the trials it fights in; `--against HEAD` once written into its army | its army's outcome and how soon; whether it now wins where it never did, or everywhere |
| A new unit | put it in an army on the bench: `--army-a trooper:6,<unit>:6` or `--set A.marksman=<unit>`; a round robin (`army-round-robin`) with an army of it added | how its army stands among the others ground by ground; its struck share and first strike (does it ever reach the fight?); a rule map for its mechanic if it has one |
| A new Commander or army | duels first (`bin/duel.ts`, every player); a trial with its units for how they fight | duels' summary; the trial's engagement table |
| A targeting rule | `grid engage-bench --against HEAD --profile` | switches a unit, struck share, first strike, idle and stalled, what stalls queue behind; the cost table: choosing targets that need routes costs fields |
| A movement or route algorithm | the same, and `node scripts/profile-routes.ts --detail` before and after | the cost table first (fields and anchors settled a tick are the same on every machine), then blocked seconds and stalls; outcomes should move only on purpose |
| How an army arranges itself (formation priorities, a new class, the regroup) | the bench with mixed armies, `--army-a` in several orders; `measure formations` for armies leaving their buildings | first strike of the back of the army, stalled behind "an ally striking" or "walking to its target", spread at contact (duels) |
| A kind of ground | `--terrain "#=scrub"` on the bench, or a new map of the shape | decided time, struck share, which army leads |
| A building | a rule map for it, then duels | its own events in the log; duels' outcomes |
| A refactor that must change nothing | `profile-routes.ts --out` before and after, `diff` | no line differs; the cost table for speed |

## 4. The maps

Every checked-in map is a `.map.json` file under `scenarios/`, in a folder for what it is for. **A map's id is its file
name**, unique across the folders, and every command finds a map by its id alone (`grid melee-kill`), so a map moves
between folders without anything that names it changing (RULE — `mapCatalog`, `src/scenario/load-map-file.ts`).

| Folder | What its maps are for | Read by |
| --- | --- | --- |
| `scenarios/rules/` | One rule each, as small as shows it: a kill, a death's salvage, the end of a battle, an aura, a bounty, burning ground | `tests/scenario.test.ts`, `tests/rules.test.ts` and the rule's own tests |
| `scenarios/units/` | One unit's mechanic each, the proving grounds' bench: a ram that prefers buildings, a spawner, a shove, a split | `tests/proving-grounds.test.ts` |
| `scenarios/movement/` | One shape a route must manage each: a dead end, a pocket, a gap, a crowd, a corridor, a falling wall, slow ground, workers fleeing, footprints through gaps | `tests/route-scenarios.test.ts`, `tests/march.test.ts`, `tests/grid.test.ts` |
| `scenarios/engage/` | **The bench**: twelve units a side on six grounds, each side's target the enemy Nexus, played to a result | the trials, `tests/engage-scenarios.test.ts` |
| `scenarios/showcase/` | Whole battles to look at: the mirror skirmish, Citizens against Ravels, the grand battle, the heavies | screenshots, the browser page, performance |
| `scenarios/trials/` | Trial files (section 5) | `grid`, `tests/engage-scenarios.test.ts` |

**Every side that fights has somewhere to go** (RULE — `sidesWithoutGoal`, `src/scenario/goals.ts`;
`tests/scenario.test.ts`): its own target, or an enemy Nexus to head for, as every side of the game has one. A battle
where a side has neither is one the game never plays (its units fall back on the nearest enemy wherever it is), so a
checked-in map without a goal is refused and `grid` warns of a hand-written one. A rule map with no Nexus gives each
side the rectangle the enemy starts in.

**The engage maps** are exactly symmetric: side B's places are side A's mirrored end for end, each side's target is the
enemy Nexus's footprint, and only the armies differ.

| Map | Ground | Side A | Side B |
| --- | --- | --- | --- |
| `engage-open-melee-vs-mix` | open | twelve troopers | six troopers, six marksmen |
| `engage-gap6-mix-mirror` | a ridge with a gap six rows wide, the Crossing's shape small | the mixed army | the same |
| `engage-gap2-melee-vs-mix` | a gap two rows wide | twelve troopers | the mix |
| `engage-gap2-airmix-vs-mix` | the same gap | six troopers, six skyraiders | the mix |
| `engage-corridor-melee-vs-mix` | a corridor four rows wide and twenty long | twelve troopers | the mix |
| `engage-lanes-melee-vs-mix` | two gaps three rows wide | twelve troopers | the mix |

A question about troops rarely needs a new map: a variant puts another army, unit, number, ground or target on one of
these. A new shape of ground earns a map: draw it at 48 by 16 (the engine tool's pane), mirror it exactly, give each
side the enemy Nexus as its target, check it even (the same army on both sides, `--swap`, a dozen seeds: a mirror draws
every battle), and add it to the bench with what it is expected to show.

## 5. Trials

A trial is the same map played over many seeds, as it is and as variants change it, every battle recorded the way a
measurement records one ([`measurement.md`](measurement.md), what a battle's record holds), and summed up.

```text
grid engage-gap2-melee-vs-mix --seeds 1-12 --swap --shuffle --army-a trooper:6,skyraider:6
grid engage-bench                                    # a trial file, failing when what it expects does not hold
grid engage-bench --against HEAD --profile --jobs 4  # the working tree beside the last commit, with what a tick cost
```

- **`--swap`**: each seed is played again with the map mirrored end for end and the sides swapped
  (`mirrored`, `src/scenario/variant.ts`). Rows name sides by army, not by end, so whatever an end or the order units
  are read in gives a side cancels out. Use it for every question of which is better.
- **`--shuffle`**: each side's units swapped among the places of units of their size and formation line by the seed
  (`shuffled`): the same army in the same shape, ranged behind melee as a player sets them. Units all alike shuffle
  to the same opening; the seed still changes the battle's own draws.
- **`--seeds`**: `1-12`, `1,3,5`, `1-4,9`. Twelve from both ends is the default for a question; three for a look.
- **`--jobs N`**: the trial split across N processes (`src/cli/trial-worker.ts`), the same battles merged in order; about
  ten battles a second a process.
- **`--json`**: the cells, the battles worth watching and any unmet expectation as data; **`--out <file>`** every
  battle's record.

**Variants** change a map without writing one, and work on every `grid` action, so the one battle a trial points at can
be watched or read with the same options:

| Option | What it does |
| --- | --- |
| `--set A.t=raider` | side A's legend symbol `t` made another content; `A.trooper=raider` makes every trooper side A places one |
| `--army-a trooper:6,skyraider:6` | side A's one-tile units replaced, front (the column nearest the enemy) to back, top to bottom in each column; `--army-b` for B |
| `--tune trooper.maxHp=60` | a content's field changed for the trial (`attack.range`, `speedTier`, `vision` and any it has), refused when it has no such field |
| `--terrain "#=scrub"` | every tile of a terrain symbol made another terrain |
| `--target-a x,y,w,h` | side A's target moved; `--target-b` for B |
| `--ticks 1200` | how long a battle may run |

Content is named by its id or its last part (`trooper`); a name two contents share is refused with both. A variant is
a pure function of a map and its content, outside the kernel: a different opening played by the same rules.

**Trial files** (`scenarios/trials/<id>.trial.json`) keep the questions worth asking again:

```json
{
  "id": "engage-bench",
  "question": "How fast are battles decided, and do units engage, on each ground?",
  "notes": "What it is for and how it is set up, for a person.",
  "maps": ["engage-open-melee-vs-mix", "engage-gap2-melee-vs-mix"],
  "seeds": "1-12", "swap": true, "shuffle": true,
  "base": { "tune": { "runner.maxHp": 28 } },
  "variants": { "as built": {}, "air mix": { "army": { "A": "trooper:6,skyraider:6" } } },
  "expect": [{ "map": "engage-gap2-melee-vs-mix", "variant": "as built", "measure": "winB", "atLeast": 0.9 }]
}
```

- **`variants`**, by name, in order; each row is marked against the first. Each holds any of `set`, `army`, `tune`,
  `terrain`, `targets` and `ticks`. None: the maps as built.
- **`armies`** instead: a round robin, every army against every other on each map (`"melee": "trooper:12"`), ranked
  by points (a win one, a draw half) with what each beat; `--cells` prints every pairing's own tables. It is how a new
  unit's army is set among the others, ground by ground.
- **`base`**: what every variant starts from; variant options on the command line go on top of it, so one command
  plays a whole trial with a unit tuned.
- **`expect`**: what the trial must show, as a measure (section 6) of the cells it names, at least or at most a value.
  `grid` fails when one does not hold, so a trial is a test (`tests/engage-scenarios.test.ts` plays the bench's).

| Trial | What it asks |
| --- | --- |
| `engage-bench` | how fast battles are decided and whether units engage on six grounds, with what was measured as expectations |
| `pick-for-the-ground` | six armies of twelve supply against the same mixed one on five grounds |
| `army-round-robin` | seven armies of the factions' units, every one against every other on five grounds |

## 6. What a trial measures

For each map, a row per variant in three tables, then what stalled units were queued behind, then the battles worth
watching with the command for each:

```text
engage-gap2-melee-vs-mix
  outcome     A wins            decided  contact  lost A/B           supply A/B
  as built    0%  [0%–24%]      45.3s    5.4s     12.0/4.8 of 12/12  12/12
  engagement  struck A/B  first A/B    idle A/B  stalled A/B  switches A/B  blocked A/B
  as built    60%/100%    13.9s/6.3s   0.0/0.0   4.8/0.0      67.4/24.2     92s/33s
  cost        ms/tick   fields/tick  settled/tick  route calls/tick
  as built    0.450     9.3          471           73.6
  stalled behind (as built): settling after a step 52%, no route to its enemy 16%, a ring of waiters 16%, ...
```

| Measure | What it is | Expectation name |
| --- | --- | --- |
| A wins | the share side A's army won, and its 95% interval (Wilson's): over 24 battles a 50% is anything from 31% to 69% | `winA`, `winB`, `draws`, `imbalance` |
| decided | the median time to a result, over the battles that had one; "ran out of time" counts the rest | `decidedSeconds`, `timeouts` |
| contact | the median second of a battle's first strike | `contactSeconds` |
| lost, supply | units lost a battle of those fielded; the supply each army took, the game's own price of a unit (a pikeman takes two). Compare armies at equal supply | — |
| struck | the share of an army's units that ever struck or shot (a heal is not a strike) | `struckA`, `struckB` |
| first | the median second an army's striking units first struck: how long the back of an army waits | `firstStrikeA`, `firstStrikeB` |
| idle | units a battle that stood five seconds or more neither moving, striking nor blocked: standing at a target, or given nothing to do. A count of blocked units never sees them | `idleA`, `idleB` |
| stalled | units a battle blocked five seconds or more in one run: trying, in vain | `stalledA`, `stalledB` |
| switches | targets chosen a unit while the one it held still stood: how much an army changes its mind | `switchesA`, `switchesB` |
| blocked | seconds a battle an army's units stood wanting a step | — |
| stalled behind | each stall's queue followed from waiter to waiter, to what it ends at: an ally striking, an ally walking to its target, an ally with no target, an enemy, a building, no route to its enemy, settling after a step, terrain or the edge, a ring of waiters | — |
| ms/tick | the wall clock a tick took (`--profile`): the machine's, and the load's — compare it only on one machine at one `--jobs` | `msPerTick` |
| fields, settled, route calls a tick | the kernel's route work (`--profile`): distance fields built, anchors they settled, route questions asked. **The same on every machine**, so they compare two algorithms where the clock compares two runs | `fieldsPerTick` |

With `--profile` the summary ends with where the route time went: each route question's calls and inclusive
milliseconds over every battle (`src/cli/profile.ts`, which `scripts/profile-routes.ts --detail` shares).

A **`*`** marks a win rate, a time or a cost that differs from the row it is compared with by more than chance (about
95%); a time or a cost must also differ by a twentieth or more, since seeds that play alike make a small change certain
and still not worth attention. **Worth watching** lists, for each map and variant, the upset (the winner against the
majority), the slowest battle, the most stalled and the one with the most switches when they stand out, each with the
`grid` command that plays that very battle (`tests/trial.test.ts` holds it to that).

## 7. Comparing two builds

- **`--against <ref>`**: the trial is played by that commit's kernel and content as well as by the working tree's, each
  row set beside its reference, marked where it moved. The ref is checked out in a temporary worktree and removed after
  (`src/cli/engine.ts`); the maps, the trial and the record are the working tree's, so both are asked the same question
  the same way. `--against HEAD` compares uncommitted work with the last commit; `--against origin/main` a branch with
  main. A ref older than this tool works, as long as its kernel loads the maps.
- **`--out` then `--baseline`**: the same, by a file written before, when the change spans commits or machines (the
  file's times are its machine's).
- **Fingerprints**: `node scripts/profile-routes.ts --out before.txt` writes every map's and some duels' event and state
  hashes; after a refactor, `diff` says which battle moved, if any. A refactor's proof is no line differing.
- **Duels and campaign levels**: `measure run ... --out`, then `measure compare` ([`measurement.md`](measurement.md));
  their summaries count blocked, stalled and idle units and target switches too.

## 8. What earlier sessions did by hand

The testing ground is what the troop movement rounds kept rebuilding as scratch scripts. When a session finds itself
writing one of these again, the tool is missing something, and adding it is part of the work.

| By hand | Now |
| --- | --- |
| an arena script generating grounds and armies, a results file per variant, an aggregation script | variants (`--army-a`, `--terrain`, `--set`) on the engage maps, trial files, the summary's tables |
| a worktree per rule variant and an environment switch read by an edited kernel | `--against HEAD` on the working tree |
| a script following stalled units' blockers to the head of each queue | "stalled behind" in every summary |
| a script counting how often units change target, and whether the old one still stood | switches in every summary |
| a loop over seeds to find one where a fixture shows its rule | `grid <map> --seeds 1-20 --json` |
| timing ticks with a wrapped kernel | `--profile` |
| playing the same duels for every Commander pair and player | `measure run --parts duels --players balanced,rush,turtle` |

And the lessons those rounds learned the hard way, which the tools now enforce or show:

- **Set a battle up as the game sets it up.** A rule once seemed to cut blocked time by nine tenths: its units had
  stopped trying, on maps that gave no side a target. Every map now gives each side a goal, and idle units are counted
  beside stalled ones.
- **Check a map even before trusting it.** The engage maps were drawn as mirrors and measured for a round before a mirror
  match found one end winning 27 battles to 7: a three-wide Nexus placed by its corner. `--swap` and a mirror army show it.
- **Vary the opening and play enough.** A mirrored army with one layout turns on tie draws alone; play both ends and a
  dozen seeds before a few percent means anything.
- **Read the whole row.** The first look at target switches found units at a narrow pass changing target 67 times each
  a battle, flipping between two walled-in enemies every tick and building four times the route fields of open ground,
  while their win rate gave no sign of it.

## 9. Examples

- **The wrong army for the ground** (`engage-bench`): twelve troopers through a gap two rows wide lose all 24 battles to
  the mixed army; two in five never strike, and the ones that do wait 14 seconds. Half of them as flyers win all 24. The
  same ridge as slow scrub instead of rock (`--terrain "#=scrub"`) lets the troopers through, and they win every one.
- **A unit tuned** (`army-round-robin --tune runner.maxHp=28,runner.attack.damage=7`): twelve runners go from beating no
  army anywhere to leading the open ground and the corridor.
- **A targeting rule, before and after** (`engage-bench --against HEAD --profile`): a unit let go of a walled-in target
  only when it can reach another, rather than every tick it is walled in. Target switches at the two-row gap fell from 69
  a unit to 2.8, in the corridor from 15 to 1.5; no outcome moved beyond chance; every expectation held. Not built: a rule
  change is its own pull request, and the numbers wait for the owner's word.
- **A rule change that cost time** (commitment off, `--baseline`): the two-lanes battle decided 22% sooner, the other
  grounds within a second and a half.

## 10. What a trial cannot say

- **Scripted armies are not players.** A trial's armies stand where a map puts them and march on the enemy Nexus; a
  player builds, picks a stance and answers the last round. Duels and the owner's own games say more.
- **Twelve units a side.** Queues, flanks and crowds grow with numbers; a result on the bench may shrink or grow on the
  Crossing with forty. Confirm on duels.
- **Supply is part of a price.** The buildings and cards that make and change units cost credits a fixed map does not spend.
- **Alike units shuffle alike.** An army of one melee and one ranged kind starts the same on every seed; on a symmetric
  map with the same army on both sides that is a draw every time.
- **A trial is not the record.** A result kept for the record is a measurement, with its build and its rules.

## 11. Where it is

| Path | What |
| --- | --- |
| `src/scenario/variant.ts`, `src/scenario/goals.ts` | the variants; the goal check |
| `src/measure/battle.ts` | a battle's record: outcome, contact, blocked and stalled, idle, switches, stall heads |
| `src/measure/trial.ts` | a trial: its spec, its runs, playing them by an engine, measured by a meter |
| `src/measure/trial-cells.ts` | what the battles say: cells, intervals, marks, expectations, battles worth watching |
| `src/measure/trial-summary.ts` | the printed tables, the watch commands, a round robin's standings |
| `src/cli/trial.ts`, `src/cli/trial-worker.ts`, `src/cli/engine.ts`, `src/cli/profile.ts` | trial files and the command line; a process's share; another build's engine; the clock and route counts |
| `scripts/profile-routes.ts` | fingerprints of every battle, and tick times by army size |
| `tests/trial.test.ts`, `tests/engage-scenarios.test.ts` | the variants, the record's new counts, splitting and watching; the bench's expectations |
