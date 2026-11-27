# Army groups, measured — 2026-11-27

**The question**: do army groups (the half-speed rule within an army group, an army group forming up when it
arrives at its rally point, the regroup by army group with reinforcement units) leave the game as fair as it was,
and do they put an arriving army in ranks?

**The thresholds, written before the code**: on both maps, `steady` against `steady`, every Commander pairing, seeds
1-12, 8 rounds, neither end of the map wins more than 65% and every battle ends within its rounds; and a mixed army
group that arrives at its rally point stands with every melee unit no further back than any ranged unit
(`sandboxes/movement/army-group-forms-up.save.json`, held by `tests/march.test.ts`).

Before is `d04ab7d2` (the rally point session merged); after is `760f8ae5` for the tallies and sandboxes and
`d054a8b2` (the same battles byte for byte, only faster) for the kept runs.

## The whole game: both thresholds held

```bash
node bin/skirmish.ts --map <crossing|pocket> --p1 script:steady --p2 script:steady --commanders all --seeds 1-12 --rounds 8 --play-to end
```

| | West won | East won | By a Nexus falling | Rounds on average |
| --- | --- | --- | --- | --- |
| The Crossing, before | 36 | 36 | 54 of 72 | 6.3 |
| The Crossing, after | 35 | 37 | 48 of 72 | 6.7 |
| The Pocket, before | 39 | 33 | 72 of 72 | 3.6 |
| The Pocket, after | 34 | 38 | 72 of 72 | 3.4 |

By pairing (every battle both ways round):

| Pairing | Crossing before | Crossing after | Pocket before | Pocket after |
| --- | --- | --- | --- | --- |
| Vasse against Averno | 4-20 | 3-21 | 11-13 | 12-12 |
| Vasse against Dob | 24-0 | 24-0 | 16-8 | 21-3 |
| Averno against Dob | 24-0 | 24-0 | 22-2 | 21-3 |

No battle ran past its 8 rounds and none was drawn. On the Crossing fewer battles end with a Nexus falling (Vasse
against Averno: 3 of 24, from 8), so more are decided on Nexus health after round 8. On the Pocket Dob wins fewer. No
balance is changed here (the owner's word, F341: UX first); the pairings are leads for later, not results.

## The quick spec and the full spec's maps

```bash
node bin/measure.ts compare docs/history/measurements/2026-11-26-before-army-groups-quick.json docs/history/measurements/2026-11-27-army-groups-quick.json
node bin/measure.ts compare docs/history/measurements/2026-11-27-before-army-groups-maps.json docs/history/measurements/2026-11-27-army-groups-maps.json
```

- **Duels** (18, the Crossing): every pairing's winner the same (Averno 4-0 Dob, Averno 4-0 Vasse, Vasse 4-0 Dob), the
  mirrors the same (west 2, east 4). 9 ended by a Nexus falling, from 10; 6.9 rounds on average, from 6.6.
- **Route sandboxes**: every one byte for byte as before.
- **Missions**: one verdict moved. Averno's test level with nothing built is now lost in round 5 (won before); its
  defended base still wins, with 5,052 unit-ticks blocked, from 761. Story leaves the game in the next pull request
  (F325), so this is recorded, not chased; the cleanup queue's "curve levels' empty-base walk" item said this level was
  the one closest to tipping.
- **The full spec's maps**: 21 of 60 sandboxes play differently; three change their result. `march-lines` now ends
  with B's Nexus falling (the closed-up ranks arrive sooner). In `mortar-burning-ground` the block's army group arrives
  at its target just before the first shell, starts toward its ranks and stands a row looser when the fire lands, so
  one trooper outlives the round (a draw, from a win at tick 200). In `bench-sky-ground-asymmetry` the flak trooper and
  the grunt march as one army group, the flak trooper waiting for the grunt to get ahead, so the skyraider meets them
  in another order and kills the flak trooper (a draw, from a loss at tick 80). The rule each sandbox is about holds,
  and its test passes.
- **The engage sandboxes** (`sandboxes/engage/`): every winner the same, losses within one unit.

## Cost

A tick took 0.88 ms on average with 4 processes side by side, from 0.73 ms (+21%). The first build was twice as slow
over three battles (6.5 s against 2.8 s); working out an army group's arrival, its forward line and its nearest enemy
group once a tick brought it to 3.8 s, part of which is battles that now last longer. The routing timing test still
passes.

## What changed on screen

Round 1 on the Crossing, nine seconds in: before, the army stands in a clump round its rally point, a marksman in
front; after, it has arrived and stands in ranks on the rally point facing the enemy, troopers and Vasse in front,
marksmen a rank behind, and the round fast-forwards. A side that held at home all round needs no walk between rounds:
the regroup lays out the slots it already stands on.

## Found while building

- **"Engaged" by sight alone let a group form up under fire.** A mortar shells from beyond a unit's vision; the block
  counted as arrived, and every trooper that burned to death changed its membership, so the ranks were laid out again
  and the block kept shuffling in the fire ("stuck, circling"). An army group is now also engaged while a member stands
  where an enemy's attack reaches it.
- **A rally point on a building** (a Nexus) put the front rank inside the building: the front rank now stands on the
  ring just in front of it.

## What scripted players cannot say

Whether ranks that form up on arrival read as an army holding ground, and whether reinforcement units falling back to
their building read as sensible, is the owner's to judge by playing.
