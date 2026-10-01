# Terminal Nexus — agent instructions

These instructions apply to every coding agent and every human-assisted session in this repository.
They are short on purpose: they say how we work and where everything is, and they point at the
documents that hold the detail. They change only when a rule of working changes.

## What this is

Terminal Nexus is a terminal strategy game: players build a base during a hidden Build Phase, then
watch persistent armies resolve the plan in a deterministic ASCII battle called a Nexus Pulse. The
project is at version 0.1 until it is public. The design documents under `docs/` describe the current
design; a merged pull request is the change. Nothing is versioned beyond git.

Every document is on one of three shelves, and the path says which:

| Shelf | Folder | What it holds |
| --- | --- | --- |
| Current | `docs/game-design/`, `docs/system-design/` | What the game is and how the software is shaped. Edited in place. |
| Planning | `docs/milestones/` | The milestone sequence, the current one and its steps, open questions, what waits. |
| History | `docs/history/` | Reports, feedback logs, answered questions, lessons. Never required reading. |

## Start here

1. Run `./scripts/check-repository.sh`. It validates the repository and prints the current milestone
   and its current step.
2. Read [`docs/README.md`](docs/README.md), the index of every document, one line each.
3. Read the current milestone in [`docs/milestones/`](docs/milestones/README.md) through its current
   step, and [`docs/milestones/next-steps.md`](docs/milestones/next-steps.md) for what is waiting on
   Mario, the owner, and what rode along.
4. Skim the titles in [`docs/milestones/open-questions.md`](docs/milestones/open-questions.md) so you
   do not quietly decide something that is his to decide.
5. For the system you are about to touch, read its page in `docs/system-design/`; for a screen, a
   menu, a popup, an effect or a key, [`docs/system-design/ui-patterns.md`](docs/system-design/ui-patterns.md)
   first, its goals and its checklist for a new screen.

[`DEVELOPMENT.md`](DEVELOPMENT.md) is the practices manual: the toolchain, the tests, how to see a
change, how milestones and spikes work, the feedback loop with Mario, how a design change lands.

## How we work

- **Scope is the current milestone step.** One step per session, one pull request per step. Do not
  start the next step because time remains; finishing early with a clean, tested result is the
  intended outcome. Future milestones are context, not scope.
- **Whatever Mario's latest feedback asks for comes first.** A pasted settings export is feedback:
  start the game with it (`--settings`) and settle each Experiment it answers.
- **Small, reviewable changes**, each with its tests, green on both runtimes (`npm test`,
  `npm run test:bun`, `npm run typecheck`), and the validator passing.
- **See it before you claim it.** The playtest script presses keys without a terminal and returns
  every screen; a test that passes is not proof that a screen reads well.
- **A design change is one pull request**: the sentence in the design document, the code and the
  test change together, and the description says so in plain words.
- **A fork you cannot settle becomes an Experiment or a question.** A choice Mario should feel (a
  timing, a look, whether a feature should exist) goes behind an Experiment he can flip in Settings;
  a choice he must decide goes in the open-questions register with a recommendation. Then keep
  working on everything the answer does not touch.
- **Write for a person.** Everything Mario reads — pull requests, commit messages, chat — says what
  the thing is, not where it is filed. No section numbers, no question ids, no project shorthand
  without a definition.
- **End with a pull request** written with the `pr-description` skill, sized to the change: a code
  block when nothing shows on screen, screenshots for a look, a GIF for motion, a playable page only
  when it must be played.

## Rules that do not bend

[`docs/system-design/grid-engine.md`](docs/system-design/grid-engine.md) holds the architecture and
every rule, each marked RULE (built and depended on), GUIDANCE (the default; anything unmarked) or
IDEA (a sketch). The ones every session needs:

- **Three worlds.** State is what is true, the Pulse is how it changes, presentation is what it looks
  like. Only the Pulse mutates state; presentation never influences it. A match must resolve with
  the renderer deleted.
- **The kernel is pure.** It imports no terminal, clock, network or renderer, calls no `Math.random`,
  and the same scenario, seed and tick count hash identically on Node and Bun, every run.
- **Two random streams never touch**: seeded gameplay (PCG32) and cosmetic randomness (a hash of an
  effect instance's identity, never a stream).
- **Effects are pure functions of presentation time**, and an effect never replaces an entity's glyph.
- **Every interactive action is a named command**; keyboard, mouse and a driver are three adapters
  onto one vocabulary, every menu item shows its hotkey and a click activates what it lands on.
- **Cells carry style roles, never colours.** Monochrome ASCII is the floor; 80 × 24 is the
  acceptance target.
- **Lore is a platform, not a plot.** When clearer ASCII and richer story compete, the Grid wins.
- Do not build what no milestone step asks for: a second resource, routing, visibility, the replay
  format, multiplayer, sound, packaging, a mod loader, any level beyond PERIMETER and RIGHT OF SALVAGE,
  or a full Commander Army.

## Where things are

| Path | What it is |
| --- | --- |
| `src/pulse/`, `src/state/`, `src/grid/`, `src/events/`, `src/rng/` | The deterministic kernel. |
| `src/content/`, `src/scenario/`, `scenarios/` | Content definitions, the map format and the checked-in maps. |
| `src/match/`, `src/mission/` | The rules layer between the Build Phase and the kernel: openings, Recall, missions and their trigger runner. |
| `src/build/`, `src/menu/`, `src/settings/` | The Build Phase reducer and adapters, the menu list shape, saved settings; `src/build/all-settings.ts` declares every setting and Experiment once. |
| `src/view/`, `src/cli/`, `src/web/`, `src/playtest/` | Composition, backends, the screen loops, the browser page, the scripted playtest. |
| `bin/grid.ts`, `bin/terminal-nexus.ts` | The engine tool and the game's entry point. |
| `tests/` | The suite, run by Node and by Bun. |
| `scripts/` | The validator, the test runner, playtests, screenshots, the browser build. |
| `.claude/skills/` | `grid`, `playtest`, `grid-screenshots`, `feedback-round`, `pr-description`. |

## Finishing a session

- [ ] `./scripts/check-repository.sh` passes; both test runtimes and the type check are green.
- [ ] The milestone's step list is ticked for what was built, and nothing else.
- [ ] New questions carry a recommendation; new Experiments name the question they serve.
- [ ] The pull request says what a person will notice, how to try it, and what is left to decide.
- [ ] Anything learned the hard way is in `docs/history/lessons-learned.md`, not only fixed.

## Licensing

Code, schemas, scripts, tests and technical documents are Apache-2.0; lore, fiction, characters, ASCII
art and visual direction are CC BY-SA 4.0. Never commit keys, tokens, credentials or personal data.
