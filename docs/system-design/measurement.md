# Terminal Nexus — measurement

_How a battle is measured, so that a result taken before a rule changes and one taken after compare like with like: what a battle's record holds, which battles are played, over which seeds, how a result is written down, what the numbers can say, and the command. Every unmarked statement is GUIDANCE._

The owner, 2026-10-20, when pathfinding was planned: "We should also invalidate the older maps and the data we have
on them that decide what something is better than another thing. Maybe this is time to write a summary in some design
file, a spec, and just forget about that old data." Every result before the pathfinding milestone was measured on units
that stood behind rocks; they are kept in [one history report](../history/reports/2026-10-20-measured-before-routing.md)
and no current document states them as fact. This is the spec every later result is measured by.

## 1. What a battle's record holds

**One record for every battle, from its states and events alone** (RULE — `src/measure/battle.ts`,
`tests/measure.test.ts`). A scenario, a campaign level's round and a duel's round are recorded the same way, by
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

- **The route scenarios** (`scenarios/route-*.map.json`), each made to show one shape a route must manage, on every
  seed of the spec:

  | Scenario | What it shows | Done when |
  | --- | --- | --- |
  | `route-dead-end` | a trooper straight above its goal, a long wall between | it walks round the wall and the Nexus falls |
  | `route-pocket` | a trooper at the bottom of a cup of rock, its goal beyond the bottom | it climbs out and round |
  | `route-ridge-gap` | six troopers, a ridge the whole height of the map, one gap far off the straight line | the squad files through the gap |
  | `route-wide-gap` | a raider three tiles wide above a gap two wide, a gap three wide further off | it walks to the wide gap |
  | `route-crowd` | eight troopers in a file against one Grid Nexus | they spread round it and strike together |
  | `route-corridor` | two squads, one corridor, each side's Nexus beyond it | the battle never stands still for good |
  | `route-falling-building` | a building closing the one gap in a ridge | the troopers break it and go through |

- **Every other map** in `scenarios/` on its own seed (the full spec): the rule fixtures and the bench, so a change of
  routes that moves one is seen.
- **Duels** ([`duels.md`](duels.md)): every ordered pair of the Commanders, mirrors included, so each plays from both
  ends of the map; each scripted player on both sides; on the Crossing, eight rounds at most. Each round records its
  battle, the rarity of every card dealt and of the card kept, and each Nexus's health when the battle ended.
- **Every campaign level** played to its end by fixed plans: **nothing built**, and **a defended base** (a Barracks
  and a Supply Depot near the Grid Nexus each round, as far as the credits go). Each round records its battle.

## 3. Seeds and specs

| Spec | Seeds | Maps | Duel players | Levels |
| --- | --- | --- | --- | --- |
| `full` | 1 to 6 | every map | balanced, rush, turtle | every level, both plans |
| `quick` | 1 and 2 | the route scenarios | balanced | every level, both plans |

The full spec is what a step that changes routes is measured by; the quick one is for a look while working.

**Formations** are measured on their own (`node bin/measure.ts formations [--seeds 1-6] [--exit route|ground]`,
`src/measure/formations.ts`): an open field, four Barracks a side built as a block, set apart or in a line, every
shape against every shape from both ends and each against a blast, saying how tight each army meets the enemy and who
wins. The first run is [a report of its own](../history/reports/2026-10-20-formations.md).

## 4. How a result is written down

`node bin/measure.ts run --spec full --routing "<the rule, in a few words>" --out <file>` writes one JSON file: the
spec, the build (the commit it ran on), the date, the routing it measured, the milliseconds a tick took on that
machine, and every battle's record. Results kept for the record go in
[`docs/history/measurements/`](../history/measurements/README.md), named by date and what they measured, with a line
in its table. `measure show <file>` prints what one says; `measure compare <before> <after>` prints two, the older
first.

## 5. What the numbers say, and what they cannot

- **Plain words first.** The summary says, per scenario, how often side A won, how long a run took, when A first
  struck and how long units stood blocked; per pair of Commanders, who won; for mirrors, how often each end won; for
  each level and plan, the verdict, the round it ended, the rounds its Commander fell and what it lost.
- **The catch-up measure** (Commander Armies' last step): of the duels where the two sides' first two kept cards
  differ in rarity, how often the luckier side won; and of those where one side was ahead after round 2 (more of its
  Nexus left, then more damage dealt), how often it won. A lucky early hand that wins nearly always is the runaway
  the power curve is built against.
- **How tight armies meet**: the average spread at first contact, over every battle, and per scenario.
- **Scripted players are not players.** A script that attacks every round tells which army spends its curve better
  when attacking, not which is stronger; model players and Mario's own games say more ([`duels.md`](duels.md)).
- **A tick's time is the machine's.** It compares two runs on one machine, never two machines.

## 6. The battles the tests pin

Some tests hold one battle's outcome or hash, so a change that moves it is seen. A step that changes routes re-pins
them knowingly, each with a line saying why it moved, and drops a claim that only held for the old rule:

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
| `tests/fairness.test.ts`, `tests/route-scenarios.test.ts` | mirrors split evenly between the two ends; the route scenarios are walked |
