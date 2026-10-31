# Terminal Nexus — the documents

Every document is on one shelf. **Current** documents say what is true now and are edited in place;
**planning** documents say what is next and lose items as they are done; **history** documents say
what happened and are never required reading. A merged pull request is the change; there is no
version of the design beyond git.

## Current — what the game is (`game-design/`)

- [`concept.md`](game-design/concept.md) — the game in one page: who it is for, how a match works, the promise.
- [`lore.md`](game-design/lore.md) — the universe, the Nexuses, the factions, voice and visual language.
- [`game-modes.md`](game-design/game-modes.md) — Campaign and Challenge, and the vocabulary they share.
- [`runs.md`](game-design/runs.md) — Challenge runs as a whole game: the route, the stops, the drafted army, the opponents and the rewards.
- [`commander-armies.md`](game-design/commander-armies.md) — factions, Commanders and the shape of a playable army.
- [`campaigns.md`](game-design/campaigns.md) — missions, the Citizen opening, PERIMETER, cutscenes.
- [`play-strategies.md`](game-design/play-strategies.md) — what duels have taught about playing a Build Phase well, as advice a model player reads in its brief.
- [`scripted-opponent.md`](game-design/scripted-opponent.md) — raids, intentions and the Campaign's opponent (working design).
- [`ascii-art-references.md`](game-design/ascii-art-references.md) — where to learn terminal art and what to take from each source.
- [`concept-art/`](game-design/concept-art/README.md) — early concept art and the first prototype captures.

## Current — how the software is shaped (`system-design/`)

- [`grid-engine.md`](system-design/grid-engine.md) — the engine design: the three worlds, the Grid, the Pulse, content, presentation, input, runtime. Start at its first section; every statement is RULE, GUIDANCE or IDEA.
- [`effects.md`](system-design/effects.md) — animations, particles, shading and tweens: the contract and the vocabulary.
- [`ui-patterns.md`](system-design/ui-patterns.md) — how every screen, menu, popup, effect and key behaves; read its goals and checklist before interface work.
- [`testing.md`](system-design/testing.md) — what the suite proves and how.
- [`replay-format.md`](system-design/replay-format.md) — the unbuilt replay file design (GUIDANCE).
- [`portability.md`](system-design/portability.md) — what a host must provide to run the game elsewhere (working design).
- [`army-authoring.md`](system-design/army-authoring.md) — how to write an army, a Commander, a Nexus power, an ability and a campaign as data: the file structure, the conventions, the checklist for a new Commander, and what a modder can do today.
- [`duels.md`](system-design/duels.md) — two Commander Armies fought out headless, script or model a side: the rules, the command line, the brief and plan, how to run model against model for testing, and what the numbers can say.
- [`testing-ground.md`](system-design/testing-ground.md) — where a change to troops is tried: the maps by folder, every side's goal, `grid` trials over seeds from both ends, variants (another unit, army, number, ground or target), trial files and round robins, how to read one and compare before and after, what trials found and cannot say.
- [`measurement.md`](system-design/measurement.md) — how a battle is measured, so results before and after a rule change compare: a battle's record, the route scenarios, duels and campaign levels played, seeds, how a result is written down and retired when it goes stale, and the `measure` command.
- [`movement.md`](system-design/movement.md) — troop movement: the seven rules a player should be able to predict, then where an army goes, banners (an idea), spawning, the three states (march, battle, retreat), formation, targeting and attacking, breaching, workers, the machinery underneath, what is still to smooth, and strategies.
- [`routing.md`](system-design/routing.md) — how a place in the game is named and reached: routes, `--at`, the title menu's rows and the browser page's links.

## Planning — what is next (`milestones/`)

- [`README.md`](milestones/README.md) — the milestone sequence, each one's status, the build order and why.
- `milestone-NN-*.md` — the current milestone and the planned ones, each with its question, what it depends on and its steps; [`completed/`](history/milestones) holds the finished ones.
- [`next-steps.md`](milestones/next-steps.md) — what waits on Mario, carry-over, the cleanup queue.
- [`open-questions.md`](milestones/open-questions.md) — decisions waiting on Mario, each with options and a recommendation.
- [`core-loop.md`](milestones/core-loop.md) — the core loop, decided: the front stays between rounds with a regroup, 30-second rounds, orders from a stance to banners; the experiment behind it.
- [`backlog.md`](milestones/backlog.md) — work no milestone owns yet.

## History — what happened (`history/`)

- [`README.md`](history/README.md) — the dated record of what was accepted and merged.
- [`lessons-learned.md`](history/lessons-learned.md) — what working this way taught, dated.
- [`answered-questions.md`](history/answered-questions.md) — every answered question, the decision and where it lives now.
- [`feedback/`](history/feedback) — Mario's playtest feedback, item by item, with what was done.
- [`reports/`](history/reports) — long-form reports on past work, dated.
- [`measurements/`](history/measurements/README.md) — results of the `measure` command, dated, each with the build, the rules it measured and whether it is current or superseded.
- [`milestones/`](history/milestones/) — the completed milestones, kept as records.
- [`spec-audit-2026-08-21.md`](history/spec-audit-2026-08-21.md), [`original-spec-2026-08-19.md`](history/original-spec-2026-08-19.md) — the August audit and the original specification, verbatim.

## Elsewhere

- [`../AGENTS.md`](../AGENTS.md) — the entry point for any agent; [`../DEVELOPMENT.md`](../DEVELOPMENT.md) — the practices manual; [`../README.md`](../README.md) — the game and how to run it.
- [`history/screenshots/`](history/screenshots/README.md) — fifteen pictures, one or two per era, the project's visual record. Pictures of the current build live on each pull request, not in the tree.
- [`claude-web.md`](claude-web.md) — setting up Claude Code on the web for this repository.
