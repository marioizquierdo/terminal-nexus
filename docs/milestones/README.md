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
| [13 — The Nexus Pulse](../history/milestones/milestone-13-nexus-pulse.md) | COMPLETE | retired unbuilt | Retired on 2026-11-12: the Skirmish milestones polish the Build Phase and the Battle Round; its powers went to content, its moment on screen to the backlog |
| [17 — Skirmish: setup and save files](milestone-17-skirmish.md) | CURRENT | 8 | Can Mario set up a Skirmish by map and slots, play, save, load and carry on, and can an agent take the same save, change who plays each side and play it headless, round by round? |
| [12 — Content and Balance Iteration](milestone-12-content-iteration.md) | PLANNED | 9, its first pass beside 17; then repeating after friends | Does each new unit and card make a Skirmish more interesting — measured by duels and the testing ground, then played? The first pass: units that counter each other |
| [7 — Worker Economy](milestone-07-worker-economy.md) | PLANNED | 10, narrow, a map choice | Can workers be built and gather resources deterministically during the Battle Round? |
| [20 — A Skirmish Worth Showing](milestone-20-skirmish-worth-showing.md) | PLANNED | 11, ends with friends playing | Does a player read what the enemy did, answer it with their build and banner, see the answer matter, and finish a battle that stayed open; and do friends say the same? |
| [21 — Agent Players](milestone-21-agent-players.md) | PLANNED | 12, after friends, while their notes come in | Can a player choose `Agent: <profile>` for a slot and play against a language model planning the other side each round? |
| [19 — A Deeper Planner](milestone-19-opponents.md) | PLANNED | 14, only if friends find the scripted enemy dull | Is there a scripted opponent worth playing again and again, planning more than one round ahead? |
| [4 — Story Menu](milestone-04-story-menu.md) | PLANNED | 15 | Can a player choose a Commander's story, see its progress and the technologies it has collected, and launch its next mission? |
| [9 — Mission Cutscenes](milestone-09-mission-cutscenes.md) | PLANNED | 16 | Can a mission declare and play its own briefing, exchanges, barks, and debrief? |
| [10 — First and Second Missions](milestone-10-first-and-second-missions.md) | PLANNED | 17 | Do PERIMETER (the tutorial, polished) and RIGHT OF SALVAGE (the first technology mission) read as the opening of a real Commander's story? |
| [18 — The Endless Stand](milestone-18-endless-stand.md) | PLANNED | not placed: after Story's first missions | Does an endless stand test what a story collected, play in fifteen to twenty-five minutes, and turn the story to its final battle? |
| [15 — ASCII Art](milestone-15-ascii-art.md) | PLANNED | not placed: Mario's call, after friends | Is there a workflow — research, a tool, an image model and a pass by hand — that makes ASCII and ANSI art a person calls good, for every unit, portrait and vignette? |

**Skirmish is current, 2026-11-11**: the owner set the modes ("Let's turn Skirmish into the center stone for game
design and testing", [his words](../history/feedback/2026-11-11-game-modes.md)) and retired runs of many battles. A
Skirmish is one battle against a scripted Commander Army, set up on a screen or from a save file; it is the loop a
player plays from the title screen, and the place every change is seen.

**How the project grows, from 2026-11-11, reviewed 2026-11-12** ([the owner's words](../history/feedback/2026-11-11-game-modes.md),
[the review](../history/feedback/2026-11-12-skirmish-saves.md)): through Skirmish, not through missions. PERIMETER is
no longer the testing map, and no Story mission is built for now. In order:

1. **Skirmish: setup and save files** (17): set up by map and slots, saved and loaded at a Build Phase, played headless
   by an agent round by round. Every later step is tested from a save, which is what spares Mario's playtime.
2. **Units that counter each other** (12's first pass, beside 17): the cheapest answer to a friend's "it's kind of
   obvious what to do", measured by duels, no playtime needed.
3. **The worker economy, narrow** (7): the second answer, offered as a map choice.
4. **A Skirmish worth showing** (20): the banner as a decision, reading the opponent, a script that answers, a battle
   that stays open, measured on the real rules. **Its last step is friends playing.**
5. After friends: **agent players** (21), **content passes** chosen by their notes (12, with more Nexus powers), **a
   deeper planner** (19) only if they find the enemy dull, then **Story** (4, 9, 10, then 18), one Commander at a time.

The Nexus Pulse milestone was retired on 2026-11-12: the Skirmish milestones polish the Build Phase and the Battle Round
it was meant to polish. It changes how the project is approached, not the game: the Grid, the battle and every rule built
so far stay as they are.

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
