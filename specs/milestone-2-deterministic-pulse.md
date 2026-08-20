# Milestone 2 — deterministic Nexus Pulse

**Status:** GATED
**Canon version:** 2.0
**License:** Apache-2.0

## Question

Can combat look simultaneous while remaining deterministic, explainable, and replayable?

## Smallest intended artifact

A headless TypeScript kernel for integer-grid movement intents, destination claims, melee hostile-cell entry, speed tiers, equal-speed simultaneous damage, worker flight, building destruction, and bounded seeded recalculation.

Before implementation, this document must be expanded to lock:

- named PRNG and test vectors;
- stable entity ordering;
- canonical serialization and hashing;
- exact tick/event order;
- recalculation progress measure and bound;
- 12 Hz and movement-credit behavior;
- replay input and authority;
- mutual-destruction and victory ordering.

## Intended pass evidence

Replaying the same complete input produces identical final-state and ordered-event hashes. Property tests find no duplicate occupancy, illegal settled cell, unresolved claim, unbounded recalculation, presentation dependency, or cosmetic RNG use.

This milestone has no economy, builder, draft, full roster, campaign, or polished terminal UI unless separately authorized after Milestone 1.
