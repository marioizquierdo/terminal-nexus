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
| [8 — Commander](../history/milestones/milestone-08-commander.md) | COMPLETE | done | Can Commander Vasse and a Nexus Pulse that deals from an army's pool exist without becoming a full Commander Army? |
| [14 — Commander Armies](../history/milestones/milestone-14-commander-armies.md) | COMPLETE | done | Can two Commanders on the same buildings feel different, each army leaning its build on something of its own, against one expected power curve a lucky early hand cannot run away with? |
| [16 — Pathfinding](../history/milestones/milestone-16-pathfinding.md) | COMPLETE | done | Does every unit get where it is going — round rock, through crowds and narrow gaps, on a Grid that changes mid-round — by a route a player would call sensible, while a Battle Round stays deterministic, fair from either end and fast; and can where a player builds send their army out tight or loose? |
| [11 — Challenge Mode: Runs](../history/milestones/milestone-11-challenge-runs.md) | COMPLETE | done | Can a player play a seeded run of battles with a run draft between them? Closed when runs were retired: its battle mechanics (building actions, the kept front, troop movement, the banner prototype) carry on in every mode |
| [17 — Skirmish](milestone-17-skirmish.md) | CURRENT | 8 | Can a player start a Skirmish — any Commander against any script, a chosen map and the opponent's credits, or a battle file — play one battle they want to play again, and is a Skirmish where every change is seen and tested? |
| [7 — Worker Economy](milestone-07-worker-economy.md) | PLANNED | 9, beside the banner | Can workers be built and gather resources deterministically during the Battle Round? |
| [12 — Content and Balance Iteration](milestone-12-content-iteration.md) | PLANNED | 10, repeating | Does each new unit and card make a Skirmish more interesting — measured by duels and the testing ground, then played? |
| [13 — The Nexus Pulse](milestone-13-nexus-pulse.md) | PLANNED | 11 | Does each round open on a Nexus Pulse that feels like the Nexus speaking to its Commander — its own moment on screen, a hand worth reading, a schedule to plan around — without making a round slower? |
| [19 — Opponents](milestone-19-opponents.md) | PLANNED | 12 | Is there an opponent worth playing again and again: a scripted planner that answers the player, and Claude planning the other side at the same time? |
| [4 — Story Menu](milestone-04-story-menu.md) | PLANNED | 13, after friends have played Skirmish | Can a player choose a Commander's story, see its progress and the technologies it has collected, and launch its next mission? |
| [9 — Mission Cutscenes](milestone-09-mission-cutscenes.md) | PLANNED | 14 | Can a mission declare and play its own briefing, exchanges, barks, and debrief? |
| [10 — First and Second Missions](milestone-10-first-and-second-missions.md) | PLANNED | 15 | Do PERIMETER (the tutorial, polished) and RIGHT OF SALVAGE (the first technology mission) read as the opening of a real Commander's story? |
| [18 — The Endless Stand](milestone-18-endless-stand.md) | PLANNED | 16 | Does an endless stand test what a story collected, play in fifteen to twenty-five minutes, and turn the story to its final battle? |
| [15 — ASCII Art](milestone-15-ascii-art.md) | PLANNED | not placed: Mario's call | Is there a workflow — research, a tool, an image model and a pass by hand — that makes ASCII and ANSI art a person calls good, for every unit, portrait and vignette? |

**Skirmish is current, 2026-11-11**: the owner set the modes ("Let's turn Skirmish into the center stone for game
design and testing", [his words](../history/feedback/2026-11-11-game-modes.md)) and retired runs of many battles. A
Skirmish is one battle against a scripted Commander Army, set up on a screen or by a battle file; it is the loop a
player plays from the title screen, and the place every change is seen.

**How the project grows, from 2026-11-11** ([the owner's words](../history/feedback/2026-11-11-game-modes.md)): through
Skirmish, not through missions. PERIMETER is no longer the testing map, and no Story mission is built for now. The
milestones polish Skirmish, its interface and its gameplay; add the worker economy (next, beside the banner); add units
and keep improving how units, formations and balance are tested automatically; give each Commander more Nexus powers;
and make the opponent worth playing, up to Claude planning the other side. When the gameplay has a good foundation,
**Skirmish is shown to people**, the owner's friends first, and only then does Story begin (the Story menu, cutscenes,
the first missions, the endless stand), one Commander's story at a time. It changes how the project is approached, not
the game: the Grid, the battle and every rule built so far stay as they are.

Prefer the honest, connected, ugly step over the beautiful one that dead-ends: the biggest improvements to the Grid all
came after the Battle Round ran end to end, because playing it is what says which part needed the quality.

**The owner's priority, 2026-10-01**, after playing the loop across rounds: the interface and the quality of
the mechanics come before any level's balance. A first mission that is too easy is fine while the basics are
being built; levels are designed and balanced later, inside what the mechanics allow. His notes on the battle
screen wait in [`backlog.md`](backlog.md) for the step that takes them.

## After the build order

Milestone 12 repeats: each pass adds units and cards and retunes on what the last pass measured. Beyond
Story's first milestones, one milestone per remaining part of Vasse's story (the technology missions RESTORATION, PRECOMMITTED and TWELVE OF
TWELVE, and the final battle, from [`story.md`](../game-design/story.md)) is likely, then the other Commanders' stories
in the same shape, and a release-readiness pass (packaging, a title and credits sequence, whatever a finished story
shows is missing).
Neither is a file yet, and no number is reserved; each gets one when the milestone before it is close
enough to done that its contents are no longer a guess.

Horizontal kernel work that no milestone needs yet (a second resource, the full replay format, visibility) is in
[`backlog.md`](backlog.md); real routing has its own milestone, 16.
