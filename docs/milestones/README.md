# Milestones

A milestone is one question about the game, small enough to play and judge. It is split into steps
(3A, 3B, and so on); each step is one pull request and is done when it is merged and Mario has played it.
A session takes one step and stops. The practice is in [`DEVELOPMENT.md`](../../DEVELOPMENT.md).

## The sequence

**Milestone numbers are identities, not an order.** A number is never renumbered or reused, because
documents cite it. The build order is the column below. Only the CURRENT row is in scope; a PLANNED row
is context, and becomes current when its dependencies are met and Mario says so, not because time
remains.

| Milestone | Status | Build order | Question |
| --- | --- | --- | --- |
| [1 — Grid Battles](../history/milestones/milestone-01-grid-battles.md) | COMPLETE | done | Do units move, fight, and die deterministically from a seed, legibly on screen? |
| [2 — Design and Orientation](../history/milestones/milestone-02-campaign-design.md) | COMPLETE | done | What vocabulary and structure do the single-player modes need, and what few PERIMETER decisions does the UX build need, before milestones 3-6 build the game's experience? |
| [3 — Game Menu](../history/milestones/milestone-03-game-menu.md) | COMPLETE | done | Can a player launch `terminal-nexus` into a menu with displayed hotkeys, mouse parity, and a driver, and pick a mode? |
| [5 — Build Phase](../history/milestones/milestone-05-build-phase.md) | COMPLETE | done | Can a player place buildings, pick a Nexus upgrade, and scroll a real map during Build Phase — by keyboard, mouse, and driver? |
| [6 — Nexus Pulse Phase](../history/milestones/milestone-06-pulse-phase.md) | COMPLETE | done | Can a player start the Battle Round (then called the Nexus Pulse), watch it resolve, see a legible ending with Recall, and land in the next Build Phase? |
| [8 — Commander](milestone-08-commander.md) | CURRENT | 5 | Can Commander Vasse and a Nexus Pulse that deals from an army's pool exist without becoming a full Commander Army? |
| [11 — Challenge Mode: Runs](milestone-11-challenge-runs.md) | PLANNED | 6 | Can a player play a seeded run of battles with a run draft between them, and does the same seed give the same run? |
| [4 — Campaign Menu](milestone-04-campaign-menu.md) | PLANNED | 7 | Can a player start or load a campaign and see progress, army, and enemy intel? |
| [7 — Worker Economy](milestone-07-worker-economy.md) | PLANNED | 8 | Can workers be built and gather resources deterministically during the Battle Round? |
| [9 — Mission Cutscenes](milestone-09-mission-cutscenes.md) | PLANNED | 9 | Can a mission declare and play its own briefing, exchanges, barks, and debrief? |
| [10 — First and Second Missions](milestone-10-first-and-second-missions.md) | PLANNED | 10 | Do PERIMETER (polished) and RIGHT OF SALVAGE (new) together read as a real campaign opening? |
| [12 — Content and Balance Iteration](milestone-12-content-iteration.md) | PLANNED | 11, repeating | Does each new card make a run more interesting and let a mission teach it — measured, not asserted? |

The order is for a played loop as early as possible. The match experience comes first (menu, Build Phase,
Battle Round), then the two mode shells (the Commander and draft, the run, the campaign), then depth (the worker
economy, cutscenes), then proof and content (the first two missions, repeated content passes). Prefer the
honest, connected, ugly step over the beautiful one that dead-ends: the biggest improvements to the Grid
all came after the Battle Round ran end to end, because playing it is what says which part needed the quality.

**The owner's priority, 2026-10-01**, after playing the loop across rounds: the interface and the quality of
the mechanics come before any level's balance. A first mission that is too easy is fine while the basics are
being built; levels are designed and balanced later, inside what the mechanics allow. His notes on the battle
screen wait in [`backlog.md`](backlog.md) for the step that takes them.

Two orderings are choices Mario may swap: 11 before 4, because a run exercises Commander Army composition
harder than a campaign shell and needs no writing; and 7 after 11, because a run can start on a
per-battle allotment and the worker economy is what makes it feel like Terminal Nexus rather than what
makes it playable.

## After the build order

Milestone 12 repeats: each pass adds cards and retunes both modes on what the last pass measured. Beyond
it, one milestone per remaining mission (RESTORATION, PRECOMMITTED, TWELVE OF TWELVE, ANNEX ZERO, from
[`campaigns.md`](../game-design/campaigns.md)) is likely, as is a release-readiness pass once all six
missions exist (packaging, a title and credits sequence, whatever the finished campaign shows is missing).
Neither is a file yet, and no number is reserved; each gets one when the milestone before it is close
enough to done that its contents are no longer a guess.

Horizontal kernel work that no milestone needs yet (real routing, a second resource, the full replay
format, visibility) is in [`backlog.md`](backlog.md).
