# Milestone 12 — Content and Balance Iteration

**Status:** CURRENT
**Current step:** none open — 12A waits on Mario's word (Milestone 17 closed on 2026-11-13).
**Depends on:** Milestone 17 (Skirmish, to play new content in); this milestone repeats rather than closing once

Content comes after the experience, on purpose. Mario's brief: "Once we create some vocabulary and
structure for the single player modes, we should jump right away into building the actual game
experience and UX. And later, when we have the UI/UX working, we can start adding new units and
upgrades, iterating on the game modes as we do more playtesting." Everything before this milestone runs
on disposable bench content. Here the real Citizens and Ravels rosters, the "Commander Army selection"
workstream that [`commander-armies.md`](../game-design/commander-armies.md) holds back, finally
get authored, one card at a time, each judged in a Skirmish. A mission teaches it later, when Story begins.

Since 2026-11-11 this is how the game grows ([the owner's words](../history/feedback/2026-11-11-game-modes.md)): "keep
adding a few units, keep polishing how to automatically test units, formations, balance adjustments". Each pass also
improves the sandboxes and trials, so the next unit is cheaper to judge ([`sandboxes.md`](../system-design/sandboxes.md)).

**What the first pass starts from** (moved here from the "Waiting on Mario" list on 2026-11-12):

- **Units that counter each other.** After showing the game, the owner: "it's kind of obvious what to do. Just place
  some buildings and use your money" ([his words](../history/feedback/2026-11-11-showing-the-game.md)). With one
  resource and no counters, buying what you can afford is the whole plan; counters and the worker economy answer it.
- **What the duels found** ([the report](../history/reports/2026-10-20-pathfinding-measured.md)): Averno wins most (65%
  of 72 scripted duels); Ravel buildings train about half the strength per credit that Citizen ones do; Dob Hunter wins
  mostly when he holds. The early lead deciding a battle is the Skirmish milestone's own step.
- **A sparse formation** ([his idea](../history/feedback/2026-10-06-rows-x2.md)): units prefer a free column beside
  them and not to stand straight above or below another, so a group spreads into a staggered grid, a preference that
  never blocks a move; tested with formations facing up and down against formations facing sideways.

**Two kinds of pass** (2026-11-12, [the review](../history/feedback/2026-11-12-skirmish-saves.md)):

- **The first pass, before friends**, beside the Skirmish milestone: three or four units that counter each other (what
  beats a swarm, what beats a wall, what beats air), each measured by duels and sandboxes, so a Skirmish has
  something to weigh beyond "buy what you can afford". It needs no playtime until Milestone 20 plays it.
- **Later passes, after friends**, chosen by their notes: the full rosters below, tagging and the pick-rate report, and
  more Nexus powers for each Commander. Vasse's designed powers come from the retired Nexus Pulse milestone
  ([its record](../history/milestones/milestone-13-nexus-pulse.md)): Countersigned as Standing Order's upgrade, Mutual
  Support Standard, Field Triage, Plating Revision, Emergency Procedure, Restoration Order, Early Warning, with the effect
  kinds they need (`modifyRule`, `reveal`).

## Question

With Skirmish playable, does each new unit and card make a Skirmish more interesting, measured rather than asserted, by battles the scripts and the driver play and battles people play?

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

- [ ] Pick rate and win rate per card and per tier, from duels and driver-played Skirmish battles under a few simple
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

Automated: every card has a named sandbox exercising its rule, determinism holds across runs and
runtimes after every content change, and the step 12B report regenerates from logs alone.

Human: a player who has never read the lore can state each faction's philosophy from a Skirmish. This is
the alignment test in [`docs/game-design/lore.md`](../game-design/lore.md), now applied to real rosters
rather than bench fixtures.

## Done when, for each pass

- [ ] The pass's cards are authored with tags and sandboxes, and each has a line in the pull request.
- [ ] The step 12B numbers are in the pull request, with the interpretation kept separate from them.
- [ ] The Commander Army and game-modes designs are updated with what the pass learned.
- [ ] `./scripts/check-repository.sh` passes.

## Found while testing the Skirmish milestone (2026-11-12)

- Many sandboxes in `sandboxes/` field content no army uses (workers, haulers, the colossus, sentinel,
  corsair, leviathan, bench units). Once this milestone settles the roster, prune the sandboxes that only exercise
  content no Commander fields, keeping the ones that pin a kernel rule.

## Found by a player's eye (2026-11-13)

From [an agent's play through the command](../history/reports/2026-11-13-a-players-eye.md): the hand thins to two
commons by round 5 and Reserve Callup can be kept again and again, so the Nexus Pulse stops mattering after round 4;
the Hatchery (3 strength a credit) is never worth a Barracks (28); about a hundred troopers a side by round 8 turn a
report into "lost 83". Strength a credit ignores area damage, so the brief undersells the Battery and leaves out the
bombers.
