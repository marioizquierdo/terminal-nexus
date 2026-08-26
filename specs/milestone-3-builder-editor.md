# Milestone 3 — Build Phase and battle editor

**Document role:** Future milestone contract; expand before implementation
**Status:** GATED
**Canon version:** 2.8
**Updated:** 2026-08-26
**License:** Apache-2.0; creative test content is CC BY-SA 4.0

> **Backlog note, canon 2.8.** The roadmap went campaign-first
> ([`milestone-2-deterministic-pulse.md`](milestone-2-deterministic-pulse.md)): this milestone's
> content is no longer queued as a whole horizontal pass on its own schedule. It is pulled in
> level by level, the day some campaign level's own contract genuinely needs a fuller Build Phase or
> a real battle editor — read it as backlog, the same way
> [`backlog-pulse-completion.md`](backlog-pulse-completion.md) now holds the old Milestone 2. Nothing
> below is wrong or withdrawn; it is simply not any single gate's job to build all of it at once.

## Question

Is arranging a compact base pleasant and understandable enough to carry most player agency, and can humans and agents create reproducible battle fixtures quickly?

## Smallest intended artifact

A keyboard-first Build Phase with optional mouse support plus a text/CLI-accessible battle editor. It should include one fixed map, Grid Nexus, existing structures, build-radius preview, connectivity, outpost, defense, producer, cost, undo, validation, hidden opponent plan, and simultaneous reveal. Combat uses the Milestone 2 kernel; this milestone adds no rules.

Before implementation, expand this document to lock:

- radius metric and footprint measurement;
- same-plan construction chaining;
- simultaneous same-cell conflicts;
- path-sealing legality;
- invalid-reveal refunds;
- exact hidden/public projection;
- editor scenario and export format, as an extension of the Milestone 1 scenario file rather than a second format.

## Intended pass evidence

A fresh player can expand toward a neutral zone, preserve a legal path, understand invalid placement, inspect portraits/stats, revise a hidden plan, and commit without accidental permanent placement. An agent can generate the same scenario through files or CLI, choose a seed/Pulse length, run or step it, and export deterministic evidence.
