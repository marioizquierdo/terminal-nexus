# Milestone 7 — Worker Economy

**Status:** PLANNED
**Depends on:** Milestone 6 (the Battle Round loop that workers act inside), Milestone 17 (Skirmish, where it is first played); before friends play (Milestone 20), after or beside the first content pass (2026-11-12)

This milestone was pulled forward from the backlog on purpose. [`backlog.md`](backlog.md) deferred a
full economy until some level needed one, and this is that level. The scope stays narrow: enough worker
behaviour for a deposit on a Skirmish map, not the full economy the backlog still holds (storage and
warehouses, a second resource, target scoring for combat).

**Narrowed on 2026-11-12** ([the review](../history/feedback/2026-11-12-skirmish-saves.md)): steps 7A and 7B only, on a
map with deposits offered as a map choice (the Crossing with a deposit), so the default Skirmish is not at risk while it
is tuned. How gathered resource and the round's credits combine, and how long a battle with an economy plays, are
settled by measurement in [Milestone 20](milestone-20-skirmish-worth-showing.md), a battle that stays open.

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
  unbuilt). The only job is harvesting a map's deposit tiles.
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

### Step 7C — Income across battles (moved to Milestone 20)

- [ ] Decide how gathered resource and the credits a round brings combine within a battle. Until now a
      battle runs on credits by round, as Mechabellum's rounds do.
- [ ] Time a Skirmish with an economy, in minutes, for the question of how long a battle is (Q75).

In the build order this comes right after Skirmish, on purpose: the economy is what makes a battle feel like
Terminal Nexus, not what makes it playable, and Story's endless stand asks the player to balance it.

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
- [ ] Job assignment and harvesting work on a Skirmish map's deposit, and a save file can place one.
- [ ] Q7 is updated to say it is partly adopted (produce in place) and still open for the storage cap.
- [ ] `./scripts/check-repository.sh` passes.
