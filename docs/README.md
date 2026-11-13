# Terminal Nexus — the documents

Every document is on one shelf. **Current** documents say what is true now and are edited in place;
**planning** documents say what is next and lose items as they are done; **history** documents say
what happened and are never required reading. A merged pull request is the change; there is no
version of the design beyond git.

## Current — what the game is (`game-design/`)

- [`concept.md`](game-design/concept.md) — the game in one page: who it is for, how a battle works, the three modes, the promise.
- [`lore.md`](game-design/lore.md) — the universe, the Nexuses, the factions, voice and visual language.
- [`game-modes.md`](game-design/game-modes.md) — Skirmish, Story and Versus: the words they share, every way a Skirmish is set up, save files, how each mode is tested.
- [`commander-armies.md`](game-design/commander-armies.md) — factions, Commanders and the shape of a playable army.
- [`story.md`](game-design/story.md) — a Commander's story (tutorial, technology missions, endless stand, final battle), what a mission is, Vasse's story and PERIMETER, cutscenes, testing a mission.
- [`play-strategies.md`](game-design/play-strategies.md) — what duels have taught about playing a Build Phase well, as advice a model player reads in its brief.
- [`scripted-opponent.md`](game-design/scripted-opponent.md) — raids, intentions, and where an opponent planner for missions and Skirmish comes from (working design).
- [`ascii-art-references.md`](game-design/ascii-art-references.md) — where to learn terminal art and what to take from each source.
- [`concept-art/`](game-design/concept-art/README.md) — early concept art and the first prototype captures.

## Current — how the software is shaped (`system-design/`)

- [`grid-engine.md`](system-design/grid-engine.md) — the engine design: the three worlds, the Grid, the Pulse, content, presentation, input, runtime. Start at its first section; every statement is RULE, GUIDANCE or IDEA.
- [`effects.md`](system-design/effects.md) — animations, particles, shading and tweens: the contract and the vocabulary.
- [`ui-patterns.md`](system-design/ui-patterns.md) — how every screen, menu, popup, effect and key behaves; read its goals and checklist before interface work.
- [`testing.md`](system-design/testing.md) — what the suite proves and how.
- [`replay-format.md`](system-design/replay-format.md) — the unbuilt replay file design (GUIDANCE).
- [`portability.md`](system-design/portability.md) — what a host must provide to run the game elsewhere (working design).
- [`army-authoring.md`](system-design/army-authoring.md) — how to write an army, a Commander, a Nexus power, an ability and a story as data: the file structure, the conventions, the checklist for a new Commander, and what a modder can do today.
- [`duels.md`](system-design/duels.md) — the duel, the battle a Skirmish plays: how its rounds play, the brief a player reads and the plan it answers with, formations, and what its numbers can say.
- [`skirmish-saves.md`](system-design/skirmish-saves.md) — how a Skirmish is set up (map, slots and controllers, goal, modifiers), saved and loaded at a Build Phase, and opened the same way by the screen and the `skirmish` command, whose manual is the comment [`src/cli/skirmish.ts`](../src/cli/skirmish.ts) opens with; the testing saves, spectating and playtest notes; one vocabulary for the screen, the save file, the command line and the routes.
- [`testing-ground.md`](system-design/testing-ground.md) — how a change is tested: which tool answers which question, the shape of a trial (testing save, variant, engine, record, summary) and how to extend each part, the testing saves by folder, comparing two builds, testing through Skirmishes with the `skirmish` command (scripts over seeds, every pairing of Commanders, a plan round by round, model against model), and the principles earlier rounds learned.
- [`measurement.md`](system-design/measurement.md) — how a battle is measured, so results before and after a rule change compare: a battle's record, the route saves, duels and story missions played, seeds, how a result is written down and retired when it goes stale, and the `measure` command.
- [`movement.md`](system-design/movement.md) — troop movement: the seven rules a player should be able to predict, then where an army goes, banners (an idea), spawning, the three states (march, battle, retreat), formation, targeting and attacking, breaching, workers, the machinery underneath, what is still to smooth, and strategies.
- [`routing.md`](system-design/routing.md) — how a place in the game is named and reached: routes, `--at`, the title menu's rows and the browser page's links.

## Planning — what is next (`milestones/`)

- [`README.md`](milestones/README.md) — the milestone sequence, each one's status, the build order and why.
- `milestone-NN-*.md` — the current milestone and the planned ones, each with its question, what it depends on and its steps; [`completed/`](history/milestones) holds the finished ones.
- [`next-steps.md`](milestones/next-steps.md) — what waits on Mario, carry-over, the cleanup queue.
- [`open-questions.md`](milestones/open-questions.md) — decisions waiting on Mario, each with options and a recommendation.
- [`core-loop.md`](milestones/core-loop.md) — the core loop, decided: the front stays between rounds with a regroup, 30-second rounds, orders from a stance to banners; the experiment behind it.
- [`backlog.md`](milestones/backlog.md) — work no milestone owns yet.
- [`build-files-with-conditions.md`](milestones/build-files-with-conditions.md) — a proposal for the next pull request: build-file entries that hold only when the battle says so, reading one library of named facts shared by scripts, build files, a model player and missions; its first step and open questions.

## History — what happened (`history/`)

- [`README.md`](history/README.md) — the dated record of what was accepted and merged.
- [`lessons-learned.md`](history/lessons-learned.md) — what working this way taught, dated.
- [`answered-questions.md`](history/answered-questions.md) — every answered question, the decision and where it lives now.
- [`feedback/`](history/feedback) — Mario's playtest feedback, item by item, with what was done.
- [`reports/`](history/reports) — long-form reports on past work, dated.
- [`measurements/`](history/measurements/README.md) — results of the `measure` command, dated, each with the build, the rules it measured and whether it is current or superseded.
- [`milestones/`](history/milestones/) — the completed milestones, kept as records.
- [`spec-audit-2026-08-21.md`](history/spec-audit-2026-08-21.md), [`original-spec-2026-08-19.md`](history/original-spec-2026-08-19.md) — the August audit and the original specification, verbatim.
- [`retired-asks-2026-11-12.md`](history/retired-asks-2026-11-12.md) — the asks retired from the "Waiting on Mario" list when it was cut to five, and where each went.
- [`challenge-runs-design.md`](history/challenge-runs-design.md) — the retired Challenge runs design (the route, the stops, the draft), kept for the ideas Story borrows.

## Elsewhere

- [`../AGENTS.md`](../AGENTS.md) — the entry point for any agent; [`../DEVELOPMENT.md`](../DEVELOPMENT.md) — the practices manual; [`../README.md`](../README.md) — the game and how to run it.
- [`history/screenshots/`](history/screenshots/README.md) — fifteen pictures, one or two per era, the project's visual record. Pictures of the current build live on each pull request, not in the tree.
- [`claude-web.md`](claude-web.md) — setting up Claude Code on the web for this repository.
