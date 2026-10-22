# The Nexus fights back, measured

_Superseded on 2026-10-21 by the pathfinding milestone's wrap-up (the march, survivors home, the mortar's numbers): [the march, measured](2026-10-21-the-march.md)._

_2026-10-21. The whole spec ([`measurement.md`](../../system-design/measurement.md)) played again once every Grid
Nexus shoots and mends, beside the measurement the pathfinding milestone ended on. The result is
[`2026-10-21-nexus-fights-back.json`](../measurements/2026-10-21-nexus-fights-back.json); compare it with
`node bin/measure.ts compare docs/history/measurements/2026-10-20-routes-and-roofs.json
docs/history/measurements/2026-10-21-nexus-fights-back.json`._

The owner, 2026-10-21, on how to keep a duel's first two rounds from deciding it: "let's start with just saying the
Nexus have a single attack that deals enough damage to kill a trooper ... And perhaps we add like a little bit of
self-healing." Built as he said: one shot every three seconds, 40 at a marksman's reach, at units only; 40 of 400
mended between rounds; the Citizen and the Ravel Nexus alike. Breaching came in after this was played, so these numbers
are the Nexus's alone.

## What changed

| | Before | With the Nexus fighting back |
| --- | --- | --- |
| Duels over in round 1 | 13 of 162 | 1 |
| Duels over by the end of round 2 | 35 | 4 |
| Duels over by the end of round 3 | 75 | 44 |
| Duels ended by a Nexus falling | 90 | 77 |
| Rounds a duel lasted, on average | 5.1 | 5.9 |
| The side ahead after round 2 won | 54 of 54 | 51 of 54 |
| The luckier first two hands won | 55% | 58% |
| Mirror duels, west end against east | 28 to 26 | 28 to 26 |

**The opening no longer ends a match.** A forward army that marched straight on an unguarded Nexus used to finish a
duel in round 1 or 2 more than one time in five; now it almost never does, and duels last most of a round longer.

**An early lead still decides.** Of the duels still undecided after round 2, the side ahead then won 51 of 54. The
Nexus stops the knockout; it does not stop the runaway. The power curve's other parts (later tiers worth more, the
answers in the tree) are what should turn a lead over, and the armies' next pass is where that is measured.

## The Commanders

| Pairing, over 36 duels each | Before | Now |
| --- | --- | --- |
| Averno against Dob | 24 to 12 | 21 to 15 |
| Averno against Vasse | 23 to 13 | 24 to 12 |
| Vasse against Dob | 24 to 12 | 24 to 12 |

Dob, who wins when he holds, gains a little: a defence now has a gun at its heart.

## The campaign

Every level by its plans plays to the same verdict as before but one: **Averno's level with nothing built is now won**
(it was lost in round 5): his Nexus shoots down the raiders that reach it in rounds 4 and 5. Vasse's sixth-round level with nothing built
is still lost, in round 6. With nothing built, the Nexus first fires in PERIMETER's last round (three of the raid shot
down) and in the later rounds of the curve level and Averno's; in the first rounds the squads stop each raid before it
comes within the Nexus's reach.

## So

The Nexus's shot does what it was asked to: a round-1 march no longer ends a duel. What it does not do is make the side
behind after round 2 come back; that is the armies' work, and the question stays open in that narrower form for their
next pass.
