# Milestone 12 — Content and Balance Iteration

**Status:** PLANNED
**Depends on:** Milestone 11 (a run to play new content in) and Milestone 10 (missions to teach it in); this milestone repeats rather than closing once

Content comes after the experience, on purpose. Mario's brief: "Once we create some vocabulary and
structure for the single player modes, we should jump right away into building the actual game
experience and UX. And later, when we have the UI/UX working, we can start adding new units and
upgrades, iterating on the game modes as we do more playtesting." Everything before this milestone runs
on disposable bench content. Here the real Citizens and Ravels rosters, the "Commander Army selection"
workstream that [`docs/game-design/decisions.md`](../game-design/decisions.md) has held back, finally
get authored, one card at a time, each judged in a run and in a mission.

## Question

With the experience working and both modes playable, does each new card make a run more interesting and
let a mission teach it, measured rather than asserted, by runs the driver plays and runs people play?

## Steps

A loop, not a line.

### Step 12A — The first real rosters

- [ ] The smallest Citizens and Ravels Commander Armies, as laid out in
      [`docs/game-design/commander-armies.md`](../game-design/commander-armies.md): common tier, army
      tier, Nexus power pool, and one Commander each (Vasse and Corvane).
- [ ] Every card is tagged with `rarity`, `tier` and `role`.
- [ ] The faction rule shapes that Milestone 1 already proved cheap (volatile munitions, shared
      cadence) are in.
- [ ] Bench content retires or is promoted card by card. Nothing carries over by default.
- [ ] Rule shapes come before roster breadth in every pass. The bench showed that one rule made the
      Ravels legible where stats alone did not, so a pass that adds a rule shape is usually worth more
      than one that adds three more units.

### Step 12B — Measure

- [ ] Pick rate and win rate per card, per tier and per act, from driver-played runs under a few simple
      policies and from human sessions, in a small report derived from events the way the `grid`
      report already is.
- [ ] Follow the Slay the Spire discipline from the game-modes design: weekly-sized changes, metrics
      read with suspicion, fun judged by people.

### Step 12C — Tune and add

- [ ] Retune rarity, tier and cost from the step 12B numbers, and add the next few cards.
- [ ] Return to step 12B.
- [ ] Add a second Commander per faction only once the first plays distinctly.

## Out of scope

- Glitch, Feudals or Alder content. These stay lore and art direction until Citizens and Ravels prove
  the loop.
- New modes.
- Multiplayer.
- A public mod loader. Content contracts stay mod-shaped (see the content notes in
  [`docs/system-design/grid-engine.md`](../system-design/grid-engine.md)) without building the loader.

## How it is judged

Automated: every card has a named scenario exercising its rule, determinism holds across runs and
runtimes after every content change, and the step 12B report regenerates from logs alone.

Human: a player who has never read the lore can state each faction's philosophy from a run. This is
the alignment test in [`docs/game-design/lore.md`](../game-design/lore.md), now applied to real rosters
rather than bench fixtures.

## Done when, for each pass

- [ ] The pass's cards are authored with tags and scenarios, and each has a line in the pull request.
- [ ] The step 12B numbers are in the pull request, with the interpretation kept separate from them.
- [ ] The Commander Army and game-modes designs are updated with what the pass learned.
- [ ] `./scripts/check-repository.sh` passes.
