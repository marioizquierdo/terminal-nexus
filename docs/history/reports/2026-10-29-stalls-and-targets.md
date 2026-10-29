# Stalls, formation and targets, measured

_2026-10-29. Mario asked for ideas to balance the formation's slowing against units that stall, and thought targeting
changes were behind the stalls ("tuning the ways units flank and find new targets will keep the fight going"). What was
tried, on scripted duels, and what was built. The scripts were scratch work and are not kept; the numbers are what
they printed._

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

## Targeting variants

| Variant | Crossing: stalled a round | blocked unit-ticks | no-route ticks | Pocket: stalled a round | blocked | no-route |
| --- | --- | --- | --- | --- | --- | --- |
| As built | 1.86 ± 0.30 | 1525 | 141 | 0.13 ± 0.04 | 171 | 36 |
| Drop a held target that cannot be reached | 1.98 | 1515 | 112 | | | |
| March on when nothing can be reached | 1.96 | 1573 | 120 | | | |
| **Both** | 1.96 ± 0.24 | 1486 | 89 | 0.14 ± 0.04 | 141 | 15 |
| Patience 12 ticks (1 s) | 1.56 ± 0.19 | 1231 | 124 | 0.47 ± 0.15 | 272 | 71 |
| Patience 18 ticks | 2.36 | 1531 | 152 | | | |
| Both, patience 12 | 1.71 | 1234 | 99 | 0.58 | 319 | 51 |
| Spread attackers over targets | 1.83 | 1847 | 119 | 0.11 | 172 | 34 |

- **Built: both, at the patience of 2½ seconds.** No-route standing falls by 37% and 58%, blocked time on the Pocket by
  18%, and the movement scenarios improve most (below). Stalls on the Crossing do not move beyond noise.
- **Not built: a shorter patience.** It looked best on the Crossing within noise and made stalls 3.6 times as many on the
  open field: units churn through targets.
- **Not built: spreading attackers.** No change on either map, and slightly less damage dealt.
- Attacks landed and damage dealt a round were flat across every variant: the fight's size is set by how many can strike
  along the front, not by the queue behind it.

## What the build changed, on the quick spec of the `measure` command

The movement scenarios, the shapes built to test exactly this: `route-breach` blocked 333 unit-ticks before and 49 after,
`route-corridor` 622 and 194 (stalled units 2 and 0), `route-falling-building` 394 and 8 (stalled units 4 and 0); the other
seven are unchanged. Duels: stalled units 420 over 121 battles before, 340 over 123 after; Nexus falls 9 and 7; blocked
unit-ticks 313,930 and 325,283. One campaign level, the curve level's defended base, blocked 2,412 and 2,940 unit-ticks
(one stalled unit); another, the second Averno level's, 1,246 and 532. A tick costs about the same (0.56 and 0.61 ms at 25
to 49 units). Pinned tests moved with a reason each: a battle's last-round ticks, a run's rounds (a win in round 3 where
it was round 2, and one in round 6 where it was round 7), the mortar scenario's hashes, and the curve level's opening
share for Barracks alone (0.54 to 0.60).

## What is left

The queue behind a fight at a gap, mostly geometry: a wider gap or more ways round, and ranged and area units behind the
front. And the two formation rules above, the gap rule and the 6-second cap, if the long slowdowns are ever seen.
