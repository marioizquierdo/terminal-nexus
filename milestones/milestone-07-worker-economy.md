# Milestone 7 — Worker Economy

**Document role:** Milestone tracker — build workers, gather resources during the Pulse
**Status:** GATED
**Depends on:** Milestone 6 (the Pulse loop workers actually act inside)
**Updated:** 2026-08-26
**License:** Apache-2.0

> **Pulled forward from backlog, on purpose.** `../specs/backlog-pulse-completion.md` deferred a full
> economy until some level actually needed one; this is that level. Scope stays narrow: enough worker
> behaviour for PERIMETER's own small deposit, not the full economy backlog document still holds
> (storage/warehouses, a second resource, target scoring for combat).

## 1. Question

Can a player produce workers, have them pick and work a deposit automatically during the Pulse, and
see the resource they gather feed the same pool Build Phase spends — deterministically, on real
content, for the first time?

## 2. What gets built

- **Worker production**: `unit.citizen.worker` becomes something the player can add to the construct
  menu Milestone 5 already built (`../milestones/milestone-02-campaign-design.md` Section 4.2's
  construct-menu list is amended here to include it — worker production is exactly what this
  milestone is about, and it did not need its own line item until this milestone made it concrete).
- **Job assignment**: workers pick the closest available job by deterministic path distance
  ([`../specs/engine.md`](../specs/engine.md) Section 6, GUIDANCE, unbuilt) — for PERIMETER, the only
  job available is harvesting the mission's own deposit tile(s).
- **Harvesting**: produce in place, continuously, no carrying bundles home
  ([`../specs/open-questions.md`](../specs/open-questions.md) Q7's own recommendation, adopted here).
  A deposit is finite and permanently depletes; up to five workers may share one (the tile itself plus
  its four orthogonal neighbours).
- **What this milestone does *not* need from Q7**: the "stall when storage is full" half of Q7's
  recommendation only matters once a storage cap exists, and Level 1 deliberately has none (no
  warehouses — `../specs/milestone-02-campaign-design.md` Section 4.2, `AGENTS.md` Section 2). Workers
  simply keep producing; Q7 stays open for whichever later level actually adds a storage cap.

## 3. Explicitly not this milestone

A second resource; storage or warehouse structures; target scoring for combat (a different, already
GUIDANCE-specified backlog item); worker flight/danger behaviour beyond what Milestone 1 already
shipped (fleeing when a hostile is within `range + 2`); salvage economy (Mission 2, RIGHT OF SALVAGE's
own job, per the belief ramp — Milestone 10).

## 4. Acceptance

Automated: the kernel-change checklist every prior rule change in this project has followed —
determinism preserved across many runs and both runtimes, no clock or `Math.random`, a named scenario
exercising worker production and harvesting specifically, `src/pulse` still importing nothing from
`src/view`.

Human: a fresh viewer can watch a worker get produced, walk to the deposit, and start gathering,
and can tell the resource total is genuinely moving because of that worker, not by coincidence.

## 5. Definition of done

- [ ] worker production is a real construct-menu option, per the amendment in Section 2 above;
- [ ] job assignment and harvesting work correctly on PERIMETER's own deposit;
- [ ] Q7 is updated to note it is partially adopted here (produce-in-place) and still open for the
      storage-cap half;
- [ ] a gate report exists, ending in **PASS / REVISE / STOP / BLOCKED**;
- [ ] `./scripts/check-repository.sh` passes.
