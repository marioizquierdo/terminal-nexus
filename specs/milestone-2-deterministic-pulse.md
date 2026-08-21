# Milestone 2 — completing the Pulse

**Document role:** Future milestone contract; expand before implementation
**Status:** GATED
**Canon version:** 2.6
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

## Contracts locked by Milestone 1

These were promoted rather than invented: each one is a thing the Playground built, ran and asserted,
and each is now RULE in the document that owns it. **Do not re-litigate them; build on them.** The
citation is where the evidence lives.

| Contract | Locked as | Evidence |
| --- | --- | --- |
| **The named PRNG and its published vectors** | PCG32, the `pcg_setseq_64_xsh_rr_32` variant. Streams separated by `initseq` | [`engine.md`](engine.md) 4.4; `tests/rng.test.ts` checks it against `imneme/pcg-c`'s own expected output, seeded 42/54 |
| **Stable entity ordering and every tie-break** | An entity's ordinal is assigned at scenario load, scanning north to south then west to east, and never reused. All iteration and every tie-break uses it. Contested claims resolve by speed tier, then by **one** draw from the seeded stream. Ordinals order event emission, never outcomes | [`engine.md`](engine.md) 4.3; `tests/rules.test.ts`, `tests/determinism.test.ts` |
| **Canonical serialization and hashing** | Keys sorted at every depth, integers only — a non-integer is refused rather than rounded — then sha256. Events are one canonical JSON object per line | [`engine.md`](engine.md) 4.4; `parse(serialize(state))` hashes identically for every scenario, and Bun and Node agree on every hash |
| **The exact normative tick and event order** | The nine phases of [`engine.md`](engine.md) 4.3, now RULE. Economy and production are phases 2 and 3 and are **empty**; this milestone fills them without moving them | [`engine.md`](engine.md) 4.3 |
| **The recalculation progress measure and its bound** | The number of unresolved movers, which strictly decreases every pass because each conflict group yields exactly one winner. The bound is the intent count plus one, and reaching it emits a `WARN` | [`engine.md`](engine.md) 4.3; `tests/rules.test.ts` drives a jammed corridor and asserts the bound is never reached |
| **12 Hz and the movement-credit rules** | **Confirmed and promoted to RULE.** The cadence table reproduces exactly at all eight rates; credit is capped at one step's cost; a blocked step keeps its credit and moves the tick the tile frees | [`engine.md`](engine.md) 4.1 and 4.2; `tests/rules.test.ts` |
| **Mutual destruction and victory ordering** | Attacks resolve by speed tier, lowest first; within a tier every attack is computed against the state at tier start and applied together, so two actors that kill each other both die. Victory is checked in phase 9 in this order: Grid Nexus destroyed, annihilation, tick limit. A side is only eligible to lose a condition it could have lost — a side that never had a mobile entity is not "annihilated" at tick one | [`engine.md`](engine.md) 4.3 and 5; `tests/rules.test.ts`, `tests/scenario.test.ts` |
| **Death is a queue, and it can cascade** | Where content detonates on death, the blast damages friend and foe and anything reduced to zero joins the queue. Bounded because an entity can only die once, so the cascade settles inside its own tick | [`engine.md`](engine.md) 4.3; `tests/ravel.test.ts` |
| **Collision masks** | Lazy views over one incrementally maintained occupancy index, with an overlay so arbitration sees tiles claimed earlier in the same tick. Never a materialised boolean grid | [`engine.md`](engine.md) 3.4.1 |

### The one contract Milestone 1 did **not** lock

**Replay input, authority, and verification.** The Playground hashes final state and the ordered
event stream, and `playground verify` re-resolves a scenario and compares — which proves the kernel
is deterministic, not that a *recording* can be replayed. The full game log of
[`engine.md`](engine.md) 4.4 — content locks, versions, committed plans per Build Phase, and a
`verify` path that re-simulates recorded inputs rather than re-running a scenario file — is this
milestone's to design and lock. It is the first thing to do, because everything else here is easier
to trust once a run can be replayed from its record.

## What Milestone 1 hands this milestone, unresolved

Four registered questions land squarely inside this milestone's scope. None blocks starting; all four
want an answer before its contracts are called locked.

| Question | What Milestone 1 measured | Where it bites here |
| --- | --- | --- |
| **Q14** — should the movement tie-break be mirror-fair? | A fixed compass order makes both sides prefer *their own left*, so formations meet at an angle. Symmetric between sides, and seed variance dominates it | Real routing replaces the greedy step this question is about; answer it as part of that |
| **Q15** — what should a mover with no route do? | Greedy routing with a sidestep leaves an actor pacing between two tiles forever. The report detects it from net progress; the kernel does not | Pathfinding makes it moot, or makes it a deliberate choice. Decide which |
| **Q17** — should a Chebyshev tie break on distance, or on entity id? | With each army in a rank, every enemy is equidistant and both armies target one unit each. Staggering fixtures hides it; it is still the rule | Target scoring is on this milestone's list. **Q17 is the first thing that scoring should fix**, and it is now safe to move the hashes |
| **Q13** — where do workers flee, and what counts as annihilation? | Workers move at `1/1` and every fixture attacker at `3/4` or slower, so a fleeing worker on open ground is **never caught**. The mirror never reaches annihilation and always runs its full tick count | Real routing gives fleeing a danger cost, and an economy gives workers somewhere to be. Both change the shape of this question |

One further thing Milestone 1 learned that is not a question: **a fixture for a movement rule should
have exactly one thing moving.** Three fixtures appeared to fail before anyone noticed that two
movers each rounding an obstacle drag each other's targets around, so the fixture was measuring an
orbit rather than a route.

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
