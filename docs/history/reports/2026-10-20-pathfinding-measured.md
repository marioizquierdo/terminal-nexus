# Pathfinding, measured

_Superseded on 2026-10-21, when every Grid Nexus came to shoot and mend: the routes below still stand, but the duels'
and levels' numbers are history. The current measurement is [the Nexus fights back](2026-10-21-nexus-fights-back.md)._

_2026-10-20, the pathfinding milestone's last step. The whole spec ([`measurement.md`](../../system-design/measurement.md))
run on the new routes, beside the baseline the milestone began with, and the checks Commander Armies left for it. The
result is [`2026-10-20-routes-and-roofs.json`](../measurements/2026-10-20-routes-and-roofs.json); read it with
`node bin/measure.ts show <file>`, and the baseline beside it with `node bin/measure.ts compare
docs/history/measurements/2026-10-20-baseline-greedy.json docs/history/measurements/2026-10-20-routes-and-roofs.json`._

The owner, when he closed Commander Armies: "close up with full commander deck duels", and "use the pending commander
checks as part of pathfinding validation at the end".

## What was played

Every map in `scenarios/`, the route scenarios on seeds 1 to 6; 162 duels on the Crossing, every Commander (Vasse,
Averno, Dob) against every other and itself from both ends, each with three scripted players (balanced, rush,
turtle), on seeds 1 to 6, drafting from their whole decks for up to eight rounds; every campaign level played to its
end with nothing built and with a defended base. Played as four processes side by side, one per player and one for
the maps and levels; a tick took about 2 ms on average on this machine with all four running.

## Routes

| | Before (the greedy step) | Now |
| --- | --- | --- |
| Route scenarios that reach their goal | 2 of 7 | all 11, on every seed |
| Unit-ticks spent wanting a step and not getting one, in the duels | 18.2 million | 1.4 million |
| Units standing blocked five seconds or more, in the duels | 34,078 | 2,393 |
| Mirror duels, west end against east end | 16 to 28, 10 drawn | 28 to 26, none drawn |
| Duels ended by a Nexus falling | 23 of 162 | 90 of 162 |
| Rounds a duel lasted, on average | 7.4 | 5.1 |
| How far an army stood from its middle when it met the enemy | 9.1 columns | 7.9 |

Units find their way: every route scenario is walked, a unit stands blocked a twelfth as long as before, and a duel
ends with a Nexus falling more than half the time, where before it mostly ran out of rounds. Neither end of the map
wins more mirrors. What blocking is left is mostly units waiting behind their own front line in a fight, and the
`route-falling-building` troopers waiting for the building in the gap to fall, as they should.

**A tick's cost grows with the army.** On the Crossing a tick costs under a millisecond with 30 units and about 14 ms
at 200, so a duel's eighth round, with both armies grown, takes a few seconds to resolve when Start Battle Round is
pressed. Campaign rounds, with a few dozen units, resolve in well under a second. The cost is in working out routes
for many units that cannot reach what they want; it was 20 ms at 200 units before this step's last change.

## The Commanders

| Pairing, over 36 duels each | Wins |
| --- | --- |
| Averno against Dob | 24 to 12 |
| Averno against Vasse | 23 to 13 |
| Vasse against Dob | 24 to 12 |

By scripted player: balanced, Vasse 28, Averno 20, Dob 6; rush, Averno 27, Vasse 21, Dob 6; turtle, Dob 30, Averno 18,
Vasse 6. **Averno still wins most** (65% of his duels), now without draws; **Dob wins mostly when he holds**, and his
Ravel buildings, which train about half the strength a credit Citizen ones do by health times damage, lose most
duels that attack. Dob still has no campaign. These three findings wait on Mario's word as before; none is a broken
level, so none is retuned.

## The catch-up measure

- **Luck**: an early hand is now judged by how the cards it kept did in every other duel (the Nexus Pulse deals both
  sides the same rarities each round, so rarity could not tell two hands apart). The side with the luckier first
  two hands won **58 of 106** duels where they differed: **55%, little better than a coin**. A lucky early hand does
  not decide a duel.
- **An early lead**: 35 duels were over by the end of round 2, 13 of them in round 1, a Nexus falling to an army
  that marched straight on it. Of the duels that went on and were decided, the side that dealt more damage in the
  first two rounds won **all 19**. Where the design wants the last moves to be the most decisive, on these routes the
  first moves are: what is ahead early stays ahead. That is the runaway the power curve is built against, and it is
  put to Mario as a question with a recommendation (a catch-up for the side behind), not built.

## The Commander checks

- **The curve level** (six rounds), played by its two plans: both win in round 6. Climbing the tree fields a last army
  1.13 times the first tier's (about a third stronger before routes); what the first three rounds bought is still
  more than half the last army (0.55 climbing the tree, 0.56 on Barracks alone) where the design expects a fifth,
  because on this level early units mostly live.
- **Averno beside Vasse**, the same curve, a Barracks and a Supply Depot a round: he clears his rounds faster (round 1
  at tick 159 to her 166, round 2 at 167 to her 192) and falls in rounds 1 and 5; she never falls. They read apart in
  the first round, where before routes it took two.
- **Every level by its plans** plays as on the baseline: the same verdict in all eight, PERIMETER held with nothing
  built (its Nexus at 21 of 400 in the last round) as before. Commanders fall less and later: Vasse's sixth-round level
  with nothing built, in rounds 4 and 5 rather than 3 to 6.

## So

Routes work, mirrors are fair, battles end, and every level plays as it did. Averno is still the strongest Commander
and Dob a defender; an early lead decides a duel almost every time. The armies' next pass (Mario: "we will iterate on
the armies later") has its starting numbers here, and `measure run --spec full` to measure each change by.
