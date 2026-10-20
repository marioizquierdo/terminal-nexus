# Measured before routing

_2026-10-20. Every result the project measured on battles before the pathfinding milestone, set aside in one place,
and the baseline the milestone measures its steps against._

Until the pathfinding milestone, a unit took a step only if it brought it strictly closer to its goal, so units stood
behind rocks, at the bottom of pockets and in queues behind each other. Every number below was measured on that rule.
The owner, 2026-10-20: "We should also invalidate the older maps and the data we have on them that decide what
something is better than another thing ... and just forget about that old data." They are kept here, not deleted;
the documents they came from now say what is designed, and that its numbers wait for the new routes. The new spec is
[`measurement.md`](../../system-design/measurement.md).

## What was set aside, and where it was

**The power curve** (the Commander Armies design, its expected power curve). On the six-round curve level a scripted
player that climbed the tree fielded a last army about a third stronger than one that stayed on Barracks; for both,
what the first three rounds bought was close to half of the last round's army (0.47 and 0.45), not the fifth the
design expects; a cheaper Garrison barely moved it (0.42 at 40 credits). With the supply cap and depots in both plans:
Barracks alone 0.40, climbing the tree 0.54, its last army still about a quarter stronger.
(`tests/curve-level.test.ts` keeps pinning these numbers as a check on the curve level; the pathfinding milestone's
last step re-pins them on the new routes.)

**Averno beside Vasse** (the Commander Armies design). On her curve level with him in her place: in round 1 her side
cleared the raid at tick 152 against his 174 and lost one unit against his two (138 against 157 before ties went by
what a unit faces); in round 2 he fell and she did not; in round 3 his side, without him, lost four units to her
three. With nothing built, an empty base held his round 4 with little to spare and could not hold her round 6.

**The duels** (the next steps and the duels document). Averno won all four of his model games and most benches; a
mirror duel went to one end of the map most of the time until 2026-10-19, and split about evenly after.

**By the Book's strength per plan** (the open questions, the Commander's aura). On PERIMETER's last round, beside the
level's target: off, a Hatchery or a Barracks alone lost; 10% less, a single Turret lost; 25% less, nothing built lost
and one building placed toward the raid held; 40% less, nearly every plan held, nothing built still lost, by a second.

**The campaign files' notes.** PERIMETER's muster: listed last, Vasse stood at the squads' edge and fell in round 2
behind every Turret plan measured. PERIMETER's line: a plan that built nothing lost the last round at every strength of
her aura and every health from 20 to 100. The cadence level's raid: with two raiders alone she fell on the round's last
tick at her first health and lived at more; with the runners she falls in round 1 at every health and aura, and the
line finishes the raid at all but her least health with the weakest aura. Averno's level: with nothing built he falls
in round 4 and, filed a round late, misses round 5, so an empty base cannot hold to her round 6. The curve level's raid
sizes were first guesses measured against a scripted plan.

**Older reports** stay as they were and say what they measured on: the first routing work
([the pulse playground](2026-08-21-pulse-playground.md)), the unit architecture spike
([its report](2026-09-10-unit-architecture-spike.md)), the movement feel round ([its report](2026-09-28-movement-feel.md)).

## The baseline: the greedy step, measured by the spec

Measured once on the old rule with the full spec, kept only to compare each step of the milestone with
([the result](../measurements/2026-10-20-baseline-greedy.json)):

```text
measurement "full" on 2026-10-20, build 8331d55, routes: the greedy step (before pathfinding)
a tick took 1.102 ms on average on this machine

Scenarios (how often side A won, the ticks a run took, A's first strike, how long units stood blocked):
  aid-station-repair               A won 0/1, lost 0; 240 ticks; first contact 1; blocked 0 unit-ticks, longest 0, stalled units 0
  air-crossing                     A won 0/1, lost 1; 26 ticks; first contact 15; blocked 0 unit-ticks, longest 0, stalled units 0
  annihilation-victory             A won 1/1, lost 0; 98 ticks; first contact 21; blocked 25 unit-ticks, longest 25, stalled units 0
  aura-by-the-book                 A won 1/1, lost 0; 77 ticks; first contact 1; blocked 0 unit-ticks, longest 0, stalled units 0
  bench-beamturret-focus           A won 0/1, lost 1; 265 ticks; first contact 241; blocked 0 unit-ticks, longest 0, stalled units 0
  bench-hatchery-spawn             A won 0/1, lost 0; 300 ticks; first contact 50; blocked 0 unit-ticks, longest 0, stalled units 0
  bench-hog-saboteur-bomber        A won 0/1, lost 1; 103 ticks; first contact 39; blocked 22 unit-ticks, longest 22, stalled units 0
  bench-medic-support              A won 1/1, lost 0; 131 ticks; first contact 33; blocked 42 unit-ticks, longest 42, stalled units 0
  bench-ram-preference             A won 0/1, lost 1; 248 ticks; first contact 248; blocked 0 unit-ticks, longest 0, stalled units 0
  bench-shardgiant-split           A won 0/1, lost 1; 73 ticks; first contact 46; blocked 8 unit-ticks, longest 7, stalled units 0
  bench-siegecrawler-windup        A won 1/1, lost 0; 118 ticks; first contact 58; blocked 67 unit-ticks, longest 66, stalled units 1
  bench-sky-ground-asymmetry       A won 1/1, lost 0; 137 ticks; first contact 20; blocked 0 unit-ticks, longest 0, stalled units 0
  bench-sniper-crossfire           A won 0/1, lost 1; 73 ticks; first contact 41; blocked 0 unit-ticks, longest 0, stalled units 0
  bench-spitter-contact            A won 0/1, lost 1; 25 ticks; first contact 25; blocked 0 unit-ticks, longest 0, stalled units 0
  bench-wallsegment-blockade       A won 0/1, lost 0; 260 ticks; first contact 33; blocked 248 unit-ticks, longest 89, stalled units 2
  citizen-mirror-skirmish          A won 0/1, lost 0; 240 ticks; first contact 37; blocked 130 unit-ticks, longest 34, stalled units 0
  citizens-versus-ravels           A won 0/1, lost 0; 720 ticks; first contact 42; blocked 671 unit-ticks, longest 421, stalled units 1
  colossus-two-tile-gap            A won 0/1, lost 0; 240 ticks; first contact 240; blocked 181 unit-ticks, longest 181, stalled units 1
  dob-bounty                       A won 1/1, lost 0; 58 ticks; first contact 20; blocked 57 unit-ticks, longest 17, stalled units 0
  grand-battle                     A won 1/1, lost 0; 327 ticks; first contact 29; blocked 381 unit-ticks, longest 92, stalled units 1
  hauler-three-tile-gap            A won 0/1, lost 0; 240 ticks; first contact 97; blocked 0 unit-ticks, longest 0, stalled units 0
  hauler-two-tile-gap              A won 0/1, lost 0; 240 ticks; first contact 240; blocked 177 unit-ticks, longest 177, stalled units 1
  heavies-clash                    A won 1/1, lost 0; 338 ticks; first contact 61; blocked 84 unit-ticks, longest 18, stalled units 0
  jammed-corridor                  A won 1/1, lost 0; 104 ticks; first contact 98; blocked 168 unit-ticks, longest 31, stalled units 0
  kill-then-hold                   A won 0/1, lost 1; 58 ticks; first contact 1; blocked 1 unit-ticks, longest 1, stalled units 0
  melee-kill                       A won 1/1, lost 0; 33 ticks; first contact 5; blocked 0 unit-ticks, longest 0, stalled units 0
  mutual-kill                      A won 0/1, lost 0; 61 ticks; first contact 1; blocked 0 unit-ticks, longest 0, stalled units 0
  nexus-stands                     A won 0/1, lost 1; 319 ticks; first contact 21; blocked 0 unit-ticks, longest 0, stalled units 0
  obstacle-routing                 A won 0/1, lost 0; 360 ticks; first contact 77; blocked 0 unit-ticks, longest 0, stalled units 0
  on-axis-deadlock                 A won 0/1, lost 0; 240 ticks; first contact 240; blocked 475 unit-ticks, longest 238, stalled units 2
  raider-tail-crowded              A won 0/1, lost 0; 180 ticks; first contact 180; blocked 176 unit-ticks, longest 176, stalled units 1
  ranged-kill                      A won 1/1, lost 0; 89 ticks; first contact 13; blocked 0 unit-ticks, longest 0, stalled units 0
  ravel-cascade                    A won 1/1, lost 0; 25 ticks; first contact 9; blocked 42 unit-ticks, longest 8, stalled units 0
  ravel-mirror-skirmish            A won 0/1, lost 0; 240 ticks; first contact 28; blocked 157 unit-ticks, longest 31, stalled units 0
  route-corridor                   A won 0/6, lost 0; 2400 ticks; first contact 2400; blocked 113424 unit-ticks, longest 2365, stalled units 48
  route-crowd                      A won 6/6, lost 0; 785 ticks; first contact 101; blocked 28644 unit-ticks, longest 681, stalled units 42
  route-dead-end                   A won 0/6, lost 0; 1200 ticks; first contact 1200; blocked 7062 unit-ticks, longest 1177, stalled units 6
  route-falling-building           A won 6/6, lost 0; 546 ticks; first contact 53; blocked 5184 unit-ticks, longest 334, stalled units 12
  route-pocket                     A won 0/6, lost 0; 1200 ticks; first contact 1200; blocked 7158 unit-ticks, longest 1193, stalled units 6
  route-ridge-gap                  A won 0/6, lost 0; 1800 ticks; first contact 1800; blocked 62532 unit-ticks, longest 1737, stalled units 36
  route-wide-gap                   A won 0/6, lost 0; 1800 ticks; first contact 1800; blocked 10506 unit-ticks, longest 1751, stalled units 6
  salvage-drop                     A won 1/1, lost 0; 25 ticks; first contact 9; blocked 0 unit-ticks, longest 0, stalled units 0
  settle-delay                     A won 0/1, lost 0; 80 ticks; first contact 17; blocked 52 unit-ticks, longest 52, stalled units 0
  share-tile-worker-unit           A won 1/1, lost 0; 96 ticks; first contact 36; blocked 1 unit-ticks, longest 1, stalled units 0
  small-multicell-skirmish         A won 1/1, lost 0; 146 ticks; first contact 72; blocked 44 unit-ticks, longest 21, stalled units 0
  speed-parade                     A won 1/1, lost 0; 375 ticks; first contact 138; blocked 559 unit-ticks, longest 204, stalled units 3
  structure-destruction            A won 1/1, lost 0; 209 ticks; first contact 37; blocked 0 unit-ticks, longest 0, stalled units 0
  target-head-engage-stand         A won 0/1, lost 0; 240 ticks; first contact 25; blocked 3 unit-ticks, longest 2, stalled units 0
  tick-limit-draw                  A won 0/1, lost 0; 120 ticks; first contact 120; blocked 170 unit-ticks, longest 89, stalled units 2
  trooper-versus-marksman          A won 1/1, lost 0; 61 ticks; first contact 25; blocked 0 unit-ticks, longest 0, stalled units 0
  worker-flight                    A won 1/1, lost 0; 74 ticks; first contact 1; blocked 0 unit-ticks, longest 0, stalled units 0

Duels: 162 on crossing, each pairing from both ends
  23 ended by a Nexus falling; 7.4 rounds on average
  averno v dob: averno 20, dob 16, draw 0
  averno v vasse: averno 20, vasse 8, draw 8
  dob v vasse: dob 15, vasse 20, draw 1
  mirrors: 54, side A (west) won 16, side B (east) 28, draws 10
  the luckier first two hands won 0 of 0 duels they differed in (-)
  the side ahead after round 2 won 18 of 27 (67%)
  1198 battles: blocked 18180324 unit-ticks, longest 598, stalled units 34078
  armies met the enemy 9.1 columns from their middle on average

Campaign levels (verdict, round it ended, the Commander's falls by round, units lost):
  vasse-test-1     nothing built    won in round 3; falls 3; lost 14; blocked 3250 unit-ticks, longest 186, stalled units 14
  vasse-test-1     a defended base  won in round 3; falls none; lost 25; blocked 7699 unit-ticks, longest 295, stalled units 27
  vasse-test-2     nothing built    won in round 3; falls 1; lost 5; blocked 685 unit-ticks, longest 93, stalled units 5
  vasse-test-2     a defended base  won in round 3; falls 1; lost 3; blocked 790 unit-ticks, longest 87, stalled units 3
  vasse-test-3     nothing built    lost in round 6; falls 3, 4, 5, 6; lost 19; blocked 2038 unit-ticks, longest 146, stalled units 7
  vasse-test-3     a defended base  won in round 6; falls none; lost 43; blocked 16287 unit-ticks, longest 357, stalled units 60
  averno-test-1    nothing built    lost in round 5; falls 2, 4; lost 13; blocked 1096 unit-ticks, longest 182, stalled units 4
  averno-test-1    a defended base  won in round 5; falls 2; lost 25; blocked 7802 unit-ticks, longest 270, stalled units 38
```

What it says, in short: of the seven route scenarios, five never reached their goal on any seed and the two that did
queued (the crowd's Nexus stood until tick 785); in the duels units spent eighteen million ticks, about fifteen
thousand a battle, wanting a step they could not take, most of them stalled at the Crossing's ridge; and the east end won more
mirrors than the west (28 to 16) even after every tie went by what a unit faces. The catch-up line reads nothing yet:
scripts keep the same rarity a round on both sides, so the luck of a hand needs a measure of its own (the milestone's
last step).
