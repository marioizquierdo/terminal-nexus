# The Barracks trains (step 6C), 2026-10-01

The Barracks card said "Trains troopers" and trained nothing. Now a building with a production recipe
trains its unit on an interval during a Pulse, and PERIMETER's Barracks has one.

## What was built, and what was left out

- **The recipe** is content (`ProductionRecipe`, `src/content/types.ts`): what it trains, how many each
  time, the interval, and a cap a Pulse. **No content carries one**: a mission lists the buildings that
  train (`trains`), and the Pulse runs on the registry with those recipes added. That keeps every
  checked-in `grid` scenario with a barracks byte-identical, and every hash the suite already asserted.
- **The kernel's production phase** (`src/pulse/production.ts`) counts down, trains on reaching zero
  through the spawner's own `spawnOneNear`, and starts again; a boxed-in building waits at zero instead
  of losing its turn. The two timers live on the producer's state only, so a state without a producer
  serializes as before and `SCHEMA_VERSION` did not move.
- **Left out on purpose**: cost, supply, storage, workers, a second resource, and the seeded contention
  process. With nothing to pay and nothing to supply, two producers on one tick never compete, so the
  contention process would have nothing to decide.
- **Recall** sends a trained trooper home to the nearest Barracks and resets the timers; the next opening
  re-reads them from the recipe that Pulse runs, so a pace changed in Settings between rounds is felt
  at once.

## PERIMETER with the Barracks training, a plan that builds nothing

Measured with the match layer alone (no screen), at every pace the
Experiments offer. "Lost" is the Nexus falling in round 3; "won" is round 3 ending with it standing.

| Pace | Trained in rounds 1, 2, 3 | Mission |
| --- | --- | --- |
| no training (6B) | 0, 0, 0 | lost |
| every 4 s | 1-2, 1-6, 0-2 | lost at 2 or 3 a round, won at 1, 4 or 6 |
| every 6 s | 1, 1-4, 0-1 | lost |
| every 8 s | 1, 0, 1 | won |
| every 10 s (the default) | 1, 1, 0 | lost |
| every 15 s | 0, 0, 0 | lost |

Two things stand out. **Rounds are short**: round 1 ends at about eleven seconds when the probe is wiped
out, and round 2 at five to twenty-eight seconds when the player's side is, so a round rarely trains its
cap; the pace matters far more than the cap. And **the wins are not defence**: in each, a trooper trained
after round 3 opened happened to be standing when the raid's reserve arrived, which makes the mission
runner count the player as having fielded units; when that trooper died the round ended by
annihilation with the Nexus standing, and holding to the end of round 3 is the win. That is the open
question about a side with a standing Nexus losing, with a timing edge added; it is noted there.

The default, a trooper every ten seconds and three a round, is the pace at which a plan that builds
nothing still loses, as step 6B tuned the waves.
