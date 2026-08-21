# Milestone 2 — completing the Pulse

**Document role:** Future milestone contract; expand before implementation
**Status:** GATED
**Canon version:** 2.3
**Updated:** 2026-08-20
**License:** Apache-2.0

## Question

> **The spike proved a fight can resolve deterministically. Can it carry an economy, real routing, and
> hidden information — and stay that way under property tests and soak runs?**

Milestone 1 Gate 1A deliberately builds a *partial* kernel: greedy movement, nearest-enemy targeting,
no economy, no production, no supply enforcement, no visibility filtering. It answers whether the
core resolves identically every time. It does not answer whether the real thing does.

This milestone finishes what the spike deferred, and hardens it.

## What the spike deferred, and this milestone owns

- **Routing.** Real pathfinding around obstacles: weighted terrain, routes to a legal attack position
  rather than to an occupied tile, temporary danger cost for fleeing workers, deterministic
  tie-breaking, and bounded recalculation when a contested destination changes. The spike's greedy
  step will strand units on rock; this is where that stops being acceptable.
- **Economy and production.** The empty tick phases get their content: worker jobs, deposits, storage,
  salvage, supply cap, and the seeded production-contention process from
  [`engine.md`](engine.md) Section 5.3.
- **Target scoring.** Something better than nearest-enemy, with the score and reason carried on the
  event so presentation and players can both explain a choice.
- **Visibility projection.** `PlayerView` and visible-event filtering, so hidden plans stay hidden.
  Untested until something is hidden.
- **Replay format.** The full game log of [`engine.md`](engine.md) Section 4.4: content locks, hashes,
  versions, and a `verify` path that re-simulates recorded inputs.

## Contracts to lock before implementation

Expand this document first. Several of these are promoted from Milestone 1 rather than invented — if
the spike confirmed them, say so and cite its evidence.

- the named PRNG and its published test vectors;
- stable entity ordering and every tie-break;
- canonical serialization and hashing;
- the exact normative tick and event order;
- the recalculation progress measure and its bound;
- **12 Hz and the movement-credit rules** — promoted from
  [`engine.md`](engine.md) Section 4.2 to RULE if Milestone 1 confirmed them, corrected if it did not;
- replay input, authority, and verification;
- mutual-destruction and victory ordering.

## Intended pass evidence

Replaying a complete recorded input produces identical final-state and ordered-event hashes.

Property tests over generated Grids and seeds find no duplicate occupancy within a layer, no illegal
settled cell, no unresolved claim, no unbounded recalculation, no presentation dependency, and no
cosmetic draw taken from the gameplay stream.

Soak runs over many maps and seeds terminate, stay within a time budget, and never deadlock a
contested corridor.

Answers to Q5 and Q7 in [`open-questions.md`](open-questions.md), earned rather than assumed.

## Not in this milestone

The Build Phase, base construction, the upgrade draft, a full roster, campaigns, or any terminal work
beyond keeping `pulse watch` running. Those belong to Milestone 3 and later.
