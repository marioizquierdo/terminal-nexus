# Terminal Nexus — measurement

_How a battle is measured, so that a result taken before a rule changes and one taken after compare like with like: what a battle's record holds, which battles are played, over which seeds, how a result is written down, what the numbers can say, how Story levels are played, and the command. Every unmarked statement is GUIDANCE._

**Where to measure what.** The game's gameplay and balance are measured in Skirmish (the duels below, and the
`skirmish` command), the ground that tests the real game: the Grid Nexus, credits, rounds, who wins. A sandbox measures one
rule on a slice of the Grid ([sandboxes and trials](sandboxes.md)). Story levels are played by fixed plans only so a rule change is seen
on them too; they serve Story's puzzles and intros, built on what Skirmish settles (section 7). How to start a change
from its measurement is in `DEVELOPMENT.md`, "Developing and testing a change".

The owner, 2026-10-20, when pathfinding was planned: "We should also invalidate the older maps and the data we have
on them that decide what something is better than another thing. Maybe this is time to write a summary in some design
file, a spec, and just forget about that old data." Every result before the pathfinding milestone was measured on units
that stood behind rocks; they are kept in [one history report](../history/reports/2026-10-20-measured-before-routing.md)
and no current document states them as fact. This page is the spec every later result is measured by.

## 1. What a battle's record holds

**One record for every battle, from its states and events alone** (RULE — `src/measure/battle.ts`,
`tests/measure.test.ts`). A sandbox, a mission's round and a duel's round are recorded the same way, by
whatever rule the kernel walks by. For the battle: the ticks it ran, who won, and why it ended (a Nexus fell, a side
was wiped out, time ran out). For each side:

| What | Read from |
| --- | --- |
| Units fielded, units lost, buildings lost | the units that stood at any moment; `entity.died` and `structure.destroyed` |
| When its Commander fell | her `entity.died` |
| Its first contact | the first tick one of its units struck or shot (a heal is not contact) |
| How tight it stood then | the average distance of its fighting units from their middle at that tick, in columns, a row counting two: small is a tight army, large a loose one |
| How long its units stood blocked | every `move.blocked` added up; the longest run of them one unit had, tick after tick; and the units with a run of 60 ticks (five seconds) or more, **stalled**: standing for good in all but name |
| Damage it dealt | `damage.applied` with it as the source, to units, buildings and Nexus |

## 2. What is played

- **The route saves** (`sandboxes/movement/route-*.save.json`), each made to show one shape a route must manage, on every
  seed of the spec:

  | Sandbox | What it shows | Done when |
  | --- | --- | --- |
  | `route-dead-end` | a trooper straight above its goal, a long wall between | it walks round the wall and the Nexus falls |
  | `route-pocket` | a trooper at the bottom of a cup of rock, its goal beyond the bottom | it climbs out and round |
  | `route-ridge-gap` | six troopers, a ridge the whole height of the map, one gap far off the straight line | the squad files through the gap |
  | `route-wide-gap` | a raider three tiles wide above a gap two wide, a gap three wide further off | it walks to the wide gap |
  | `route-crowd` | eight troopers in a file against one Grid Nexus | they spread round it and strike together |
  | `route-corridor` | two squads, one corridor, each side's Nexus beyond it | the battle never stands still for good |
  | `route-falling-building` | a building closing the one gap in a ridge | the troopers break it and go through |

- **The engage saves** (`sandboxes/engage/`, the full spec, not the quick one): the same armies on ground that is
  open, a gap six rows wide, a gap two rows wide, a corridor and two lanes, twelve units a side, each side given the
  enemy's Nexus as its target, each played to a result. They are the bench for how fast battles are decided and how many
  units ever strike; what they show, how to put another army or unit on them, and the trial that holds them to it
  (`engage-bench`) belong to [sandboxes and trials](sandboxes.md).
- **Every other map** under `sandboxes/` on its own seed (the full spec): the rule fixtures and the bench, so a change of
  routes that moves one is seen.
- **Duels** ([`battles.md`](battles.md)): every ordered pair of the Commanders, mirrors included, so each plays from both
  ends of the map; each scripted player on both sides; on the Crossing, eight rounds at most. Each round records its
  battle, the rarity of every card dealt and of the card kept, and each Nexus's health when the battle ended. A duel
  is played as a Skirmish, by the same steps the `skirmish` command and the game's screen take (a new battle's save,
  each slot seated with `script:<player>`, every round played by `playOn`, `src/skirmish/play.ts`), so what a
  measurement says of a battle is what `skirmish --p1 script:<player> --p2 script:<player> --play-to end` plays.
  Every map is played the way `grid` plays it (`playSandboxRound`, `src/skirmish/sandbox-round.ts`).
- **Every Story level** played to its end by two fixed plans, **nothing built** and **a defended base**, each round
  recording its battle (section 7).

## 3. Seeds and specs

| Spec | Seeds | Maps | Duel players | Levels |
| --- | --- | --- | --- | --- |
| `full` | 1 to 6 | every map | balanced, rush, turtle | every level, both plans |
| `quick` | 1 and 2 | the route saves | balanced | every level, both plans |

The full spec is what a power-curve change or a step that changes routes is measured by; the quick one is for a look
while working. Which to play for which kind of change is the `remeasure` skill's first table.

**Formations** are measured on their own (`node bin/measure.ts formations [--seeds 1-6] [--exit route|ground]`,
`src/measure/formations.ts`): an open field, four Barracks a side built as a block, set apart or in a line, every
shape against every shape from both ends and each against a blast, saying how tight each army meets the enemy and who
wins. The first run is [a report of its own](../history/reports/2026-10-20-formations.md).

**Formations in a duel** (`--formations`, `src/measure/spec.ts`, `tests/battle-formation.test.ts`): the same question
asked of whole duels, where each scripted player builds its army's buildings by a formation ([`battles.md`](battles.md),
formations). `measure run --parts duels --players rush --formations block,apart` plays every ordered pair of two different
formations named (`rush-block` on side A against `rush-apart` on side B, then the other way round) over every pair of
Commanders and every seed; one formation named, both sides play it, as `--players rush-block` does. The summary says,
for each two players that met, who won and how many by a Nexus falling, and for each player how tight its army met the
enemy and what it lost a battle. A spec naming no formation plays each player by its bare name against itself, so the
quick spec's duels replay byte for byte.

## 4. How a result is written down

`node bin/measure.ts run --spec full --routing "<the rules, in a few words>" --question "<what it must answer>"
--out <file>` writes one JSON file: the spec, the build (the commit it ran on, ending `+uncommitted` when the code,
armies, stories or maps differed from it), the date, the rules it measured, the question it was played to answer,
the milliseconds a tick took on that machine, and every battle's record. `measure show <file>` prints what one says; `measure compare
<before> <after>` prints two, the older first. How much to play for which kind of change, and the rest of the
procedure, is the [`remeasure`](../../.claude/skills/remeasure/SKILL.md) skill.

**Played in parallel, written down as one** (`src/measure/merge.ts`, `tests/measure-process.test.ts`). `--jobs N`
plays a spec as up to N processes at once (each scripted player's duels for each Commander on side A on each seed,
since one seed's duels can take several times another's; the missions; the maps) and merges what they wrote in
the order one process plays it, so the file holds the same battles in the same order either way; it records how many
processes played at once, since a tick takes longer on a loaded machine. `measure merge <file>... --out <file>` does
the same for parts played by hand with `--parts`, `--players`, `--west` (the Commanders on side A) and `--seeds`, and
refuses parts of two builds, two specs or two sets of rules.

**What one unit did** (`src/measure/who.ts`): `measure who <content id> [--plan nothing|defended|both]
[--levels <id>,<id>]` plays the missions by the plans and says, for each round, that unit's or building's hits
on the enemy, their damage, its kills and the second of its first hit, on each side it stood. It is what a sentence
that tells the owner to watch something happen in a round is checked against.

## 5. When a measurement goes stale

Results kept for the record go in [`docs/history/measurements/`](../history/measurements/README.md), named by date
and what they measured, with a row in its index: the build, the rules it measured, its report and its **status**.

- **current**: the latest result on the rules now built.
- **current, short of** a change: a later change moved part of what it measured (a movement rule after a full run)
  and those parts have not been played again.
- **superseded by** a later file: the rules it measured have changed under it — a power-curve change (the Grid
  Nexus, supply, credits, income, a tier, the Nexus Pulse's hand) supersedes every result before it.

A superseded result's report gets one line at its top saying so and linking what replaced it. Nothing is deleted
and no number is edited; a current design document never quotes a superseded number. The validator refuses a
measurement file with no row in the index.

## 6. What the numbers say, and what they cannot

- **Plain words first.** The summary says, per sandbox, how often side A won, how long a run took, when A first
  struck and how long units stood blocked; per pair of Commanders, who won; for mirrors, how often each end won; for
  each level and plan, the verdict, the round it ended, the rounds its Commander fell and what it lost.
- **How soon duels end**: how many were over by the end of rounds 1, 2 and 3. An opening that ends a match is what
  the Grid Nexus's own shot was built against.
- **The catch-up measure** (Commander Armies' last step): of the duels where the two sides' first two kept cards
  differ in rarity, how often the luckier side won; and of those where one side was ahead after round 2 (more of its
  Nexus left, then more damage dealt), how often it won. A lucky early hand that wins nearly always is the runaway
  the power curve is built against.
- **How tight armies meet**: the average spread at first contact, over every battle, and per sandbox; with players
  set against each other (`--formations`), who won between each two and each one's spread.
- **Scripted players are not players.** A script that attacks every round tells which army spends its curve better
  when attacking, not which is stronger; model players and Mario's own games say more ([`battles.md`](battles.md)).
- **A battle must be set up as the game sets it up, and a count of waiting counts only units that try.** A measurement
  of how long units stood blocked once said a rule had cut it by nine tenths on three sandboxes: the units had stopped
  trying to move at all. Those sandboxes gave no side a target, and a unit told to march on with nowhere to march stands
  idle, which `move.blocked` never records. Give each side what the game gives it (a duel's attack stance gives the
  enemy Nexus as the target), read one battle's log by eye before trusting a number, and set a count of blocked units
  beside one of units that struck.
- **Seeded layouts and enough battles.** A mirrored army with one layout turns on tie draws alone; vary the starting
  layout by seed and play each from both ends (a trial's `--shuffle` and `--swap`, [the testing
  ground](sandboxes.md)), twelve seeds or more, since differences between targeting rules are a few percent and a
  stall count has a standard error of about 0.3 a round.
- **A tick's time is the machine's.** It compares two runs on one machine, played the same way (one process, or the
  same number side by side), never two machines.

## 7. Story levels and the curve planner

Story levels are scripted missions: Story's puzzles and intros, built on the battle Skirmish tests. Balance and
gameplay are not settled on them, which is why the duels carry that weight and a level is measured only to see a rule
change reach it. Their code lives with the command-line layer (`src/cli/levels.ts`, `src/cli/curve-measure.ts`) and
`src/measure/` imports from it (a type and the planner): a layering break, known and accepted for now.

- **A level** (`PlayableLevel`, `src/cli/levels.ts`): the mission a route's `story?mission=<id>` names, with its
  rounds, its first Build Phase and how a round's Pulse starts and the next round opens (`levelById`, `openRound`).
  `LEVELS` is every level of every shipped story, in story order. A Skirmish is also a `PlayableLevel` for the screen,
  but only story levels are in that list, and only they are measured here.
- **The curve planner** (`planRound`, `src/cli/curve-measure.ts`): a scripted player's Build Phase. A `CurvePlan` lists
  what it buys round by round (content ids of the build menu's rows; the last list serves every later round) and the
  tile `near` it builds. In turn it takes the next row on the round's list that the level's menu offers, that is
  unlocked and that the round's credits afford, places it on the legal tile nearest `near` (a row counts two columns),
  and goes on until nothing fits. A row the menu does not offer or has not unlocked is skipped without a word.
- **The two fixed plans** (`LEVEL_PLANS`, `src/measure/spec.ts`): *nothing built*, and *a defended base* (a Barracks and a
  Supply Depot each round, as far as the credits go), each near the centre of the level's Grid Nexus. `measureLevel`
  (`src/measure/suites.ts`) plays a level by one: plan, start the Pulse, record the round's battle, open the next
  round. It says how the level ended: the round, and the mission's verdict (`won` or `lost`; `none` when the rounds ran
  out with the mission undecided; `unplayed` when no round ran).
- **The curve level** (`vasse-test-3`, six rounds; `measureCurve`, `src/cli/curve-measure.ts`, played by
  `tests/curve-level.test.ts` and `tests/averno.test.ts`, never by `measure run`): the same loop, counting each round's
  army by the round that bought its units. A unit's strength is its health times its damage a tick, the Commander
  left out since she is not bought; a unit counts for the round its building was bought, or, with no building, the
  round it first stood. The number to watch is the opening's share: what the first three rounds bought, of the last
  round's army. What the design expects of it and what was measured are in
  [`commander-armies.md`](../game-design/commander-armies.md), the expected power curve.

## 8. The battles the tests pin

Some tests hold one battle's outcome or hash, so a change that moves it is seen. A change that moves them re-pins
them knowingly, each with a clause in its comment saying why it moved, and drops a claim that only held for the old
rule; a test whose premise the change broke gets a fixture that isolates its rule instead (the `remeasure` skill sorts
the failures):

| Test | What it claims |
| --- | --- |
| `tests/aid-station.test.ts` | the Aid Station's battle and the bench medic's hash the same every run |
| `tests/commander.test.ts` | the Commander's level, round by round, whatever she sits out |
| `tests/production.test.ts` | PERIMETER's first round with the Barracks's wave |
| `tests/pulse-run.test.ts` | the first placeholder Pulse's winning plan: its hashes, its length, and that it wins |
| `tests/rows.test.ts` | the battle with the most rules in it (the Citizens against the Ravels) |
| `tests/curve-level.test.ts` | the curve level by its plans: the opening's share of the last army |
| `tests/averno.test.ts` | Averno beside Vasse: they read apart within two rounds, by who falls |
| `tests/mission.test.ts`, `tests/mission-loop.test.ts` | PERIMETER: who wins and loses it with which plan |
| `tests/lifecycle-build-phase.test.ts`, `tests/playtest.test.ts` | how long PERIMETER's first round runs with the defence plan, on the clock the screen shows |
| `tests/fairness.test.ts`, `tests/route-saves.test.ts` | mirrors split evenly between the two ends; the route saves are walked |
| `tests/engage-bench.test.ts` | the engage bench's trial holds what it expects ([sandboxes and trials](sandboxes.md)) |
