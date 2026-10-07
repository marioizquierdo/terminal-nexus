# Milestone 7 — Worker Economy

**Status:** PLANNED
**Depends on:** Milestone 6 (the Battle Round loop that workers act inside)

This milestone was pulled forward from the backlog on purpose. [`backlog.md`](backlog.md) deferred a
full economy until some level needed one, and this is that level. The scope stays narrow: enough worker
behaviour for PERIMETER's own small deposit, not the full economy the backlog still holds (storage and
warehouses, a second resource, target scoring for combat).

## Question

Can a player produce workers, have them pick and work a deposit automatically during the Battle Round, and
see the resource they gather feed the same pool the Build Phase spends, deterministically and on real
content, for the first time?

## What it builds

- **Worker production.** `unit.citizen.worker` becomes something the player can add from the build
  menu Milestone 5 built. The build menu's list in
  `docs/history/milestones/milestone-02-campaign-design.md` is amended to include it.
- **Job assignment.** Workers pick the closest available job by deterministic path distance (the
  worker rules in [`docs/system-design/grid-engine.md`](../system-design/grid-engine.md), still
  unbuilt). For PERIMETER the only job is harvesting the mission's own deposit tiles.
- **Harvesting.** Workers produce in place, continuously, with no bundles carried home (the
  recommendation in Q7, adopted here). A deposit is finite and depletes for good. Up to five workers
  may share one: the tile itself and its four orthogonal neighbours.
- **What it does not need from Q7.** The "stall when storage is full" half only matters once a storage
  cap exists, and Level 1 has none (no warehouses). Workers simply keep producing. Q7 stays open for
  whichever later level adds a storage cap.

## Steps

### Step 7A — Worker production

- [ ] `unit.citizen.worker` is on the build menu.
- [ ] Workers are produced by their recipe during the Battle Round. Milestone 6's production step is the
      mechanism; this is its first real use.

### Step 7B — Job assignment and harvesting

- [ ] Workers take the closest available job by deterministic path distance.
- [ ] Workers produce in place from a finite deposit that five workers can share.
- [ ] The resource total visibly moves because of a worker.

### Step 7C — Income across battles

- [ ] Decide how gathered resource and the per-battle allotment combine within a match. Until now both
      modes run on an allotment per battle, as Mechabellum's rounds do, and that is enough for a run
      to play (see the economy notes in [`docs/game-design/game-modes.md`](../game-design/game-modes.md)).
- [ ] Record whether anything should persist between a run's battles (Q40, option C).

In the build order this comes after the Challenge mode's first run (Milestone 11), on purpose: the
economy is what makes a battle feel like Terminal Nexus, not what makes it playable.

## Out of scope

- A second resource.
- Storage or warehouse structures.
- Target scoring for combat (a separate backlog item with its own design guidance).
- Worker flight or danger behaviour beyond what Milestone 1 shipped (fleeing when a hostile is within its range
  and two more, rounded up to whole rows).
- Salvage economy. That is Mission 2's job, RIGHT OF SALVAGE, in Milestone 10.

## How it is judged

Automated: the kernel-change checklist. Determinism holds across many runs and both runtimes, there is
no clock or `Math.random`, a named scenario exercises worker production and harvesting, and
`src/pulse` still imports nothing from `src/view`.

Human: a fresh viewer can watch a worker get produced, walk to the deposit and start gathering, and can
tell the resource total is moving because of that worker, not by coincidence.

## Done when

- [ ] Worker production is a real build-menu option.
- [ ] Job assignment and harvesting work on PERIMETER's own deposit.
- [ ] Q7 is updated to say it is partly adopted (produce in place) and still open for the storage cap.
- [ ] `./scripts/check-repository.sh` passes.
