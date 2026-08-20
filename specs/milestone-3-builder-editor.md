# Milestone 3 — Build Phase and battle editor

**Document role:** Future milestone contract; expand before implementation
**Status:** GATED
**Canon version:** 2.1
**Updated:** 2026-08-20
**License:** Apache-2.0; creative test content is CC BY-SA 4.0

## Question

Is arranging a compact base pleasant and understandable enough to carry most player agency, and can humans and agents create reproducible battle fixtures quickly?

## Smallest intended artifact

A keyboard-first Build Phase with optional mouse support plus a text/CLI-accessible battle editor. It should include one fixed map, battlefield Nexus, existing structures, build-radius preview, connectivity, outpost, defense, producer, cost, undo, validation, hidden opponent plan, and simultaneous reveal. Combat may use recorded or minimal kernel playback.

Before implementation, expand this document to lock:

- radius metric and footprint measurement;
- same-plan construction chaining;
- simultaneous same-cell conflicts;
- path-sealing legality;
- invalid-reveal refunds;
- exact hidden/public projection;
- editor scenario and export format.

## Intended pass evidence

A fresh player can expand toward a neutral zone, preserve a legal path, understand invalid placement, inspect portraits/stats, revise a hidden plan, and commit without accidental permanent placement. An agent can generate the same scenario through files or CLI, choose a seed/Pulse length, run or step it, and export deterministic evidence.
