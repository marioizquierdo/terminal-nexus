# Stalls, formation and targets, measured

_2026-10-29. Mario asked for ideas to balance the formation's slowing against units that stall, and thought targeting
changes were behind the stalls ("tuning the ways units flank and find new targets will keep the fight going"); then for
a wider, creative round: scenarios built to test battle speed and engagement, how other games solve it, whether the
original targeting had advantages, new ways to engage, better roaming and flanking, army mixes that suit and do not suit
the ground, and a re-read of the spec for simplicity. What was tried, on scripted duels and on a new arena, what was
built, and **what this report first said that was wrong**. The scripts were scratch work and are not kept; the numbers
are what they printed._

## A correction first

The first version of this report (and the rule it described, "march on past a fight you cannot reach") rested on two
measurements that did not hold:

1. **The movement scenarios' blocked-tick gains were units standing idle.** `route-breach` blocked 333 unit-ticks before
   and 49 after, `route-falling-building` 394 and 8. Those scenarios give no side a target, and a unit told to march on
   with nowhere to march stands idle, which `move.blocked` never records. The honest numbers for them are the unchanged
   ones.
2. **The first arena, built to test battle speed, had the same flaw.** With no target for either side, "march on" meant
   "freeze", and it looked as if standing beside the fight decided battles 9 points sooner (61% decided within a
   round against 54%). With each side given the enemy Nexus as its target, as a duel's attack stance does, every variant
   comes out the same.

What did hold: the duel numbers (a duel side always has a target area), the stall diagnosis, and the formation findings
above. The rule was changed to what the fair measurements support, and the measure tool's spec now says why
([`measurement.md`](../../system-design/measurement.md)).



## The question and how it was asked

Scripted players (the balanced and the rush script) played the three Commanders against each other, every ordered pair
and the three mirrors, eight rounds of 30 seconds, on two maps: **the Crossing** (a ridge down the middle with one gap
eight rows wide) and **the Pocket** (a small open field). A unit **stalled** when it stood blocked for five seconds or
more in one run. Each variant played the same 72 duels (about 540 rounds on the Crossing, 260 to 300 on the Pocket);
a stall count has a standard error of about 0.3 a round on the Crossing, so only a gap well beyond that means anything.

## The formation's slowing

Ranged and area units walk at half speed while a unit that should be ahead of them is in sight. Variants, 54 duels, the
first round being the true march (later rounds start from the regroup):

| Variant | Round 1: ranged behind melee, in columns | Ranged-melee pairs in the wrong order | Stalled units a round | Longest slowed in a row |
| --- | --- | --- | --- | --- |
| No slowing | −1.3 (ranged ahead) | 34% | 2.12 | n/a |
| As built | 2.9 | 11% | 2.03 | 13 s |
| Slow only while the higher unit is under 4 columns ahead | 1.9 | 12% | 1.76 | 13 s |
| Timed ramp: half, then quarter after 2½ s, full after 6 s | 3.1 | 11% | 2.13 | 6 s |
| As built, plus 20% for a unit held up behind a lower one | 2.6 | 11% | 2.15 | n/a |

The slowing is what sorts the army, and it is not what stalls it: switched off, the stalls are the same. The timed ramp
sorts as well and caps the slowdown, at the price of a timer in the state; the 20% boost does nothing. The median
slowdown is 0.3 seconds (mostly the edge of sight); one in a hundred lasts 12. Not built.

## Where the stalls are

Almost none in rounds 1 to 4 (0.00 to 0.04 a round) and about 4.5 a round in rounds 5 to 8 on the Crossing; about 0.1 a
round on the Pocket. Of the late ones, 97% were melee units, 82% blocked by a unit and 18% with no route; following who
held up whom to the head of the queue, **60% ended at a unit with no route**, 21% at a friendly unit walking to its
target, 11% in a ring of waiters. Half of the stalled units held an enemy unit as their target, half held none (they were
marching). The ridge's gap is the queue's cause in part: only so many units strike along it.

## Targeting variants (duels, 72 a map, four seeds)

| Variant | Crossing: stalled a round | blocked unit-ticks | no-route ticks | Pocket: stalled a round | blocked | no-route |
| --- | --- | --- | --- | --- | --- | --- |
| Main before this branch (commitment, nothing else) | 1.86 ± 0.30 | 1525 | 141 | 0.13 ± 0.04 | 171 | 36 |
| Drop a held target that cannot be reached | 1.98 | 1515 | 112 | | | |
| March on at once when nothing can be reached | 1.96 ± 0.24 | 1486 | 89 | 0.14 ± 0.04 | 141 | 15 |
| March on after a second | 1.46 ± 0.19 | 1368 | 81 | 0.11 ± 0.04 | 133 | 12 |
| March on after a second, as built with a counter in the state | 1.80 ± 0.25 | 1516 | 72 | 0.24 ± 0.08 | 183 | 28 |
| **Drop, look further afield, else stand as near as possible (built)** | 1.80 ± 0.28 | 1452 | 102 | 0.11 ± 0.04 | 132 | 11 |
| Patience 12 ticks (1 s) | 1.56 ± 0.19 | 1231 | 124 | 0.47 ± 0.15 | 272 | 71 |
| Patience 18 ticks | 2.36 | 1531 | 152 | | | |
| Spread attackers over targets | 1.83 | 1847 | 119 | 0.11 | 172 | 34 |
| The original targeting (no commitment, no drop, shorter walk) | 1.81 | 1226 | 170 | 0.73 ± 0.23 | 299 | 98 |

No variant moves stalls beyond noise. The original targeting is the one that is clearly worse: on the open Pocket it
jams (stalls five times as many, no-route standing nearly three times) and fewer duels end by a Nexus falling. What
commitment lost on the Crossing it did not lose on speed (below).

## The arena: speed and engagement on six kinds of ground

Eight army mixes (melee, mixed, ranged, melee against ranged, melee against mixed, flyers, troopers with flyers, heavies)
on eight grounds: open, a gap eight rows wide, four, two, one, two lanes, a corridor and a pillar field; each side given
the enemy Nexus as its target; the starting layout drawn by the seed; twelve seeds; 768 battles a variant. A battle's
speed is the tick one army is wiped out or a Nexus falls; "within a round" is by tick 360 (30 seconds).

| Variant (fair arena) | Median ticks to a decision | Decided within a round | Units that strike within 20 s |
| --- | --- | --- | --- |
| Main-like (commitment only) | 317 | 62% | 88% |
| Drop and look further afield (built) | 315 | 61% | 89% |
| March on at once | 320 | 62% | 89% |
| March on after a second | 313 | 63% | 89% |
| Commit only while striking | 314 | 62% | 90% |
| Hysteresis before turning to a nearer enemy | 315 | 61% | 90% |
| Patience that waits for an alternative | 316 | 61% | 90% |
| A closing charge, a quarter faster | 309 | 62% | 90% |
| Attack-position field (every free tile beside any enemy), commitment as built | 308 | 63% | 90% |
| The same, with no commitment | 306 | 64% | 90% |
| Higher cost for tiles held by blocked allies | 314 | 61% | 89% |
| The original targeting | 316 | 60% | 90% |
| Without the 6-column band along the central path | 327 | 56% | 89% |

Everything lands within 5% on speed. The one clear loss is removing the band: the pillar field's median goes from 302 to
417 ticks, since the army no longer gathers along its way. The tile swap between a blade and a slower unit in its way
changes nothing in these battles (armies start sorted here, so it is hardly exercised).

By ground (share of battles decided within a round, built rule): open 56%, a gap eight rows wide 83%, four rows 80%, two
69%, one tile 53%, lanes 31%, corridor 58%, pillars 60%. The ground decides speed far more than any rule.

**Which army the ground suits** (attacker wins / health left, out of 100, minus the defender's; the defender is nine
troopers and nine marksmen; built rule, 12 seeds):

| | Open | Gap 8 | Gap 4 | Gap 2 | Gap 1 | Lanes | Corridor | Pillars |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 18 troopers | 100% / +21 | 100% / +22 | 8% / −33 | 0% / −54 | 0% / −68 | 75% / −5 | 8% / −16 | 92% / +18 |
| 9 troopers, 9 flyers | 100% / +45 | 100% / +48 | 100% / +42 | 92% / +23 | 25% / −16 | 100% / +21 | 100% / +54 | 100% / +42 |
| 18 flyers | 100% / +59 | | 100% / +60 | 100% / +60 | 100% / +60 | 100% / +58 | 100% / +66 | |

The all-melee army loses at every short pass, whichever rule it follows (the same rows under marching on and under the
original: −25 to −33, −51 to −54, −66 to −68). Flyers do not queue and win nearly everywhere: a question for the roster,
now in the register.

## How other games solve it

A research agent could read search-result summaries but not most of the pages themselves, so the claims below are
leads, marked as such in the notes it left (`research-engagement.md`, scratch). What it found:

- **Real RTS games do not reserve attack slots**; units collide and steer round each other. Reserved slots appear in
  action-game AI as tokens, to cap attackers on a player, which is the opposite of an army battle.
- **A one-tile target has four faces with four-way steps**, so a queue behind the front rank is arithmetic: the fix is a
  second target or another way round, not more slots.
- **Gloomhaven and its imitators pick the destination tile first**: the cheapest path to a legal attack position decides
  which enemy is closest, and with none reachable they re-evaluate with unlimited movement, or walk to the reachable tile
  nearest the closest enemy. That is a field seeded at every free tile beside any enemy, with a fallback, and it was built
  and measured here (above, "every free tile beside any enemy"): about 4% quicker, within noise, and as many rules.
  "Look further afield, else stand as near as possible" is the same fallback.
- **Acquisition range above attack range, and a no-run-around rule** (Legion TD 2); aggro assist when an ally is struck
  (Warcraft III's guard distance); sticky targets that fail when the target is surrounded (an AoE II melee unit switches
  to the nearer by design; StarCraft II's Thor flickers when surrounded). The patience timer and the walled-in drop are
  this game's answer to the failure the reports describe.
- **Air units collide with nothing on the ground** (Warcraft III removed air-air collision; StarCraft II stacks air). No
  source on capping air density on a small board was found.

## What was built, and what was left out

Built: the walled-in drop, the wider search (up to four times its sight) and standing as near as it can get; the engage
scenarios. Left out, each measured above: marching on past the fight (at once, after a second, and with a counter in the
state), a shorter patience, spreading attackers, a charge, hysteresis, a higher cost for held-up allies, the
attack-position field as the way every troop walks. Kept because removing it hurts: the band.

## Pinned tests that moved

A run's rounds (a win in round 3 where it was round 2, and in round 8 where it was round 7), the placeholder Pulse's last
tick (202 where it was 214), the mortar scenario's hashes and the curve level's opening share for Barracks alone (0.54 to
0.60) moved with the first version and stand; PERIMETER's first round, which a version of the rule moved, is byte for
byte what it was.

## What is left

The queue behind a fight at a gap, mostly geometry: more ways round, and ranged and area units behind the front. Pacing
at a one- or two-row door (about five units a battle of thirty-six), the same without these rules. The formation's gap
rule and a six-second cap on a slowdown, if the long slowdowns are ever seen. What holds flyers back, if anything.
