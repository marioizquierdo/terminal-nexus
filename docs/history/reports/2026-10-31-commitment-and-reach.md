# Commitment and reach, measured on the full spec

_2026-10-31. Measured at 431869c (the kernel of 63fbc99, after the flip-flop fix merged; 431869c adds only a log
record, nothing the rules read). Kept as
[2026-10-31-commitment-and-reach.json](../measurements/2026-10-31-commitment-and-reach.json). Compared with the commit
before the flip-flop fix (0421143), played the same way on the same machine, four processes side by side._

## The question

Troop movement changed how every common unit chooses what to fight. A unit keeps its target until the target falls or
it has gone 2½ seconds unable to strike it. It lets go of a target it cannot reach at once, for a further one it can.
And a unit that can reach no enemy keeps the walled-in one it holds, instead of turning between two of them every tick.

The quick spec was measured after each half. A change to how common units choose is owed the full spec:
- every map;
- the three scripted players' duels on six seeds;
- every campaign level, by its plans.

Does the fix change who wins, and how much fidgeting does it take out?

## Before and after the fix

| Measure | Before the fix (0421143) | After (431869c) |
| --- | --- | --- |
| Duels (162 on the Crossing) ended by a Nexus falling | 22 | 21 |
| Rounds a duel lasted, on average | 7.7 | 7.7 |
| Averno against Dob | 13 to 23 | 14 to 22 |
| Averno against Vasse | 31 to 5 | 33 to 3 |
| Dob against Vasse | 23 to 13 | 23 to 13 |
| Mirrors won by the west side | 25 of 54 | 24 of 54 |
| The side ahead after round 2 won | 32 of 54 (59%) | 35 of 54 (65%) |
| Target switches, every duel battle | 183,681 | 43,392 (−76%) |
| Stalled units, every duel battle | 2,062 | 1,587 (−23%) |
| Blocked unit-ticks, every duel battle | 1,443,378 | 1,351,079 (−6%) |
| Where armies met, columns from the middle | 8.3 | 8.3 |
| Campaign levels | every verdict, round and fall the same | the same, number for number |

On the maps, each played on its own seed, the fix moves only those where units are walled off from each other:

| Map | Target switches before → after | Other changes |
| --- | --- | --- |
| engage-gap2-melee-vs-mix | 1,187 → 49 | blocked 1,218 → 1,504 unit-ticks, stalled units 4 → 6, same winner |
| engage-corridor-melee-vs-mix | 178 → 23 | over in 483 ticks, not 556 |
| engage-gap2-airmix-vs-mix | 116 → 13 | blocked 118 → 149 unit-ticks |
| engage-lanes-melee-vs-mix | 59 → 14 | over in 566 ticks, not 706 |
| route-corridor (six seeds) | 830 → 121 | side A won 2 of 6, was 4 of 6 |
| route-breach (six seeds) | 254 → 48 | blocked 728 → 1,020 unit-ticks |
| route-falling-building | 1,152 → 72 | nothing else moved |
| march-mirror | 88 → 18 | nothing else moved |

Every other map plays exactly as before.

## What moved and what did not

- **The fidgeting is gone, and the game is unchanged.**
  - Target switches fall by three quarters in the duels, and by up to twenty-four times on the gap and corridor maps.
  - Who beats whom moved by one or two duels in thirty-six, inside what a seed decides.
  - The campaign levels did not move at all.
- **Fewer units stall in the duels (−23%), but a few more on the tight maps.** Units that used to turn between two
  walled-in enemies now stand still in front of the one they hold, so they count as blocked where they used to count
  as moving. This is the queue at a gap that the chapter keeps under "To smooth later", not a new problem.
- **The corridor's winner moved on two seeds of six.** route-corridor forces a lone line through a corridor. It is the
  map most sensitive to who reaches the head of the queue first, so watch it if the queue is worked on.
- **Battles through a corridor or lanes end sooner**, by a tenth to a fifth, since units stop walking back and forth.

## What scripted players cannot say

They cannot say whether the steadier units *read* better. A unit standing still at a door may look more stuck to a
player than one pacing did. The Activity Logs' new Movement filter records every unit going from marching to battle and
back, so a playtest round can show where that happens.

## How to see it again

```bash
node bin/measure.ts show docs/history/measurements/2026-10-31-commitment-and-reach.json
node bin/measure.ts compare docs/history/measurements/2026-10-21-the-march.json docs/history/measurements/2026-10-31-commitment-and-reach.json
```

The before run was played from an export of 0421143 and is not kept: its record names the build it was played beside,
not its own.
