# Milestone 4 — Story Menu

**Status:** PLANNED
**Depends on:** Milestone 3 (the game menu hands off here), Milestone 17 (Skirmish: a mission is a Skirmish setup with a script)

Re-cut on 2026-11-11 for Story ([`story.md`](../game-design/story.md)): a Commander's story is missions in order, and
what a player collects carries from one to the next. This milestone builds the screen and the record that carry it.

This milestone is mostly infrastructure, and that is expected. Mission 1 is the tutorial, so there
is no earlier unlock and no earlier enemy sighting: the screen can show only a baseline. Milestone 10's
second mission (RIGHT OF SALVAGE) is what exercises it, when progress moves, an army grows and enemy
intel has something in it. Building the screen empty but correct now is cheaper than building it later
and finding the shape was wrong.

## Question

From the title menu's Story row, can a player choose a Commander's story and reach one screen that shows
its progress, the current mission, the technologies collected so far, their own army (units, buildings, Nexus powers and
Commanders) and enemy intel (discovered enemy units, buildings, Nexus powers, Commanders and past mission
reports), and launch the current mission from it?

## What it builds

- **Story state.** Which Commander's story, which mission is current, what technologies it has collected, and what the record says is
  available. The record is a flat, checked-in list, not a real save format yet (Q31). On the first
  playthrough it is nearly empty by construction: nothing is unlocked before Mission 1 is completed.
- **Army panel.** Units, buildings, Nexus powers and Commanders available. "Commanders" means exactly the
  Commander and Nexus Symbol of [`docs/game-design/commander-armies.md`](../game-design/commander-armies.md),
  not a new roster concept. The panel reads the record and computes nothing new.
- **Enemy intel panel.** Discovered enemy units, buildings, Nexus powers, Commanders and mission reports.
  This is new ground: no design document yet describes a persistent, cross-mission record of what the
  player has seen of the enemy. The player's view in the grid engine is a live visibility filter for
  one Battle Round, not a remembered log. The discovery rule is an open question (below) and is settled before
  this panel is built.
- **Mission reports.** The existing headless report already produces a per-mission outcome (ticks,
  losses, victory reason, hashes; see `docs/history/milestones/milestone-01-grid-battles.md`). Reuse
  it as the saved mission report this screen shows. That is cheaper than a second summary format and
  keeps the report module's job intact: derive everything from the event stream and the final state.
- **Launch.** Selecting the current mission hands off into Milestone 5's Build Phase for that
  mission's map.

## Steps

### Step 4A — Story state and launch

- [ ] The flat record of what each story has collected (Q31) and its current mission.
- [ ] Completing Vasse's tutorial opens Averno's and Dob Hunter's stories as two new rows ([`story.md`](../game-design/story.md), progress and the Story menu).
- [ ] Launching the mission into Milestone 5's Build Phase with that mission's map and trigger list.

### Step 4B — Army and intel panels

- [ ] The army panel shows the composition laid out in the Commander Army design: common tier, army
      tier and tech tree, Nexus power pool, Special.
- [ ] The enemy intel panel follows the discovery rule that is settled (Q35).
- [ ] Both panels are correct when empty and never assume there is something to show.

### Step 4C — Mission reports

- [ ] The existing report module's output is saved and shown for each completed mission.
- [ ] Artifact entries appear here once Milestone 9 produces them.

### Step 4D — Technologies that carry

- [ ] What a mission grants (its main goal, a bonus goal, a choice after it) is recorded for that story, and every later
      mission offers it on top of its own.
- [ ] The choice after a mission: a small offer dealt by rarity and tier, some offers exclusive pairs
      ([`story.md`](../game-design/story.md), what carries). Replaying a mission keeps the best of what was collected.

## Out of scope

- A real save and progression system. Q31 stays open: this milestone reads and writes the same flat
  record the title menu's Story row reads, nothing richer.
- A mission-select map or a branching graph of missions. A story is linear; it branches by technology, not by mission.
- Enemy intel content beyond the mechanism. Mission 1 has nothing to discover yet.

## Decision it waits on

**What counts as "discovered" enemy intel, and when is it recorded?** (Q35) The candidates are: (a) any
enemy entity the player's view has ever rendered during any Battle Round, logged the instant it is first seen;
(b) only entities that survive to the end of a Battle Round; (c) only reveals a mission's own script declares.
The recommendation is (a): it is the simplest rule, needs no new authoring per mission, and is derived
from the event stream the way the report module already works. The question is registered in
[`open-questions.md`](open-questions.md) with that recommendation.

## Done when

- [ ] The Story screen renders correctly with an empty army and intel state.
- [ ] Launching the current mission hands off into Milestone 5.
- [ ] Mission reports reuse the existing report module.
- [ ] `./scripts/check-repository.sh` passes.
