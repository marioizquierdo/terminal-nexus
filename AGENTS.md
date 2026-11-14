# Terminal Nexus — agent instructions

How every coding agent and every human-assisted session works in this repository, and which document
holds each detail. Change a line here only when a rule of working changes.

## What this is

Terminal Nexus is a terminal strategy game. Each round opens with a Nexus Pulse, when the Grid Nexus
deals a hand of Nexus powers; players then build a base during a hidden Build Phase and watch
persistent armies resolve the plan in a deterministic ASCII battle, the Battle Round. It has three
modes ([`docs/game-design/game-modes.md`](docs/game-design/game-modes.md)): **Skirmish**, one battle
against a scripted Commander Army and the centre of design and testing; **Story**, a Commander's story
of missions; and **Versus**, later. The project is at version 0.1 until it is public.

Every document is on one of three shelves, and the path says which:

| Shelf | Folder | What it holds |
| --- | --- | --- |
| Current | `docs/game-design/`, `docs/system-design/` | What the game is and how the software is shaped. Edited in place; a merged pull request is the change, and git is the only versioning. |
| Planning | `docs/milestones/` | The milestone sequence, the current one and its steps, open questions, what waits. |
| History | `docs/history/` | Reports, feedback logs, answered questions, lessons. Never required reading. |

## Start here

1. Run `./scripts/check-repository.sh`. It passes, and prints the current milestone and its current step.
2. Find the documents your task touches in [`docs/README.md`](docs/README.md), the index of every
   document with when to reach for each.
3. Read the current milestone in [`docs/milestones/`](docs/milestones/README.md) through its current
   step, and [`docs/milestones/next-steps.md`](docs/milestones/next-steps.md) for what waits on Mario,
   the owner.
4. Skim the index table at the top of [`docs/milestones/open-questions.md`](docs/milestones/open-questions.md):
   a decision listed there is his, and you work around it.
5. Read the `docs/system-design/` page of each system you will touch. For a screen, a menu, a popup,
   an effect or a key, [`docs/system-design/ui-patterns.md`](docs/system-design/ui-patterns.md) comes
   first: follow its steps for a new screen, then read its goals.

**When no step is open** (the current one is built and waits for Mario's playtest, or the next waits
for his word), the work is what his latest feedback or the "Waiting on Mario" list asks for. If both
are empty, say so and stop.

[`DEVELOPMENT.md`](DEVELOPMENT.md) is the practices manual, "the manual" below; the bullets that
follow name the section to read for each practice.

## How we work

- **Scope is the current milestone step.** One step per session, one pull request per step. A step
  finished early, clean and tested, is the intended outcome; the next step starts on Mario's word.
  Future milestones are context.
- **Toward a Skirmish worth playing.** The goal now is a basic game that is fun against an enemy on
  equal ground, comfortable, and set up a few ways, so friends can play it; polish of the look waits
  behind that ([`game-modes.md`](docs/game-design/game-modes.md), how the game grows).
- **The priority now: the `skirmish` command and automated testing.** It comes before any past detail
  it trips over.
- **Past decisions on design and architecture bind; small details follow the glossary.** A line's
  wording, a number or a label is made to agree with the glossary and moves on (the manual's
  "Changing the design", which past decisions bind). Quote Mario only with a link to his words.
- **Mario's time is the scarcest thing we have.** Play every change yourself before asking him; every
  ask says whether it is to play, watch, decide or do; at most five wait on him (the manual's "The
  feedback loop").
- **Mario's latest feedback comes first.** Playtest feedback, a pasted settings export, an Activity
  Logs export or playtest note files start a feedback round: the `feedback-round` skill.
- **Develop every change measurement first**: the measurement and its threshold written before the
  code, each new reading built with a second count as a test, tester agents with a goal each, and
  only then Mario. Before the first edit to code or content, read the manual's "Developing and
  testing a change" and work its steps in order.
- **See it before you claim it.** A passing test is not proof that a screen reads well: press the
  keys with the scripted playtest and read every screen it returns (the `playtest` skill).
- **One word, one thing: check the [glossary](docs/game-design/glossary.md) before naming anything**,
  be it a screen, a setting, a flag, a field, a file, a heading or a line a player reads. Use the word
  it gives. A missing word that is a general term used across the game goes in the glossary in the
  same pull request; one module's detail stays in its module. A word under "Words we stopped using"
  stays retired: say what the glossary gives instead.
- **A design change is one pull request**: the sentence in the design document, the code and the test
  change together, and the description says so in plain words.
- **A fork you cannot settle becomes an Experiment, an Activity Logs filter, or a question**: a choice
  he should feel, what happened in a playtest, a decision only he can make (into the register, with a
  recommendation). Then keep working on everything the answer does not touch (the manual's "The
  feedback loop" and "Changing the design").
- **Write for a person.** Everything Mario reads says what the thing is in plain words, with the
  section number, question id or feedback item number left out (the manual's "Writing for Mario").
- **End with a pull request** written with the `pr-description` skill, its Demo sized to the change.

## Rules that do not bend

[`docs/system-design/grid-engine.md`](docs/system-design/grid-engine.md) holds the architecture and
every rule, each marked RULE (built and depended on), GUIDANCE (the default; anything unmarked) or
IDEA (a sketch). Read its invariants table before changing a RULE or adding a module. The ones every
session needs:

- **Three worlds.** State is what is true, the Pulse is how it changes, presentation is what it looks
  like. Only the Pulse mutates state; presentation never influences it. A match must resolve with
  the renderer deleted.
- **The kernel is pure.** It imports no terminal, clock, network or renderer, calls no `Math.random`,
  and the same opening, seed and tick count hash identically on Node and Bun, every run.
- **Two random streams never touch**: seeded gameplay (PCG32) and cosmetic randomness (a hash of an
  effect instance's identity, never a stream).
- **Effects are pure functions of presentation time**, and an effect never replaces an entity's glyph.
- **Every interactive action is a named command**; keyboard, mouse and a driver are three adapters
  onto one vocabulary, every menu item shows its hotkey and a click activates what it lands on.
- **A log is a record, never an input.** Events are declared before they are logged (`src/log/`); the
  kernel and the match layer never log, and nothing the rules decide reads a log.
- **Cells carry style roles, never colours.** Monochrome ASCII is the floor; 80 × 24 is the
  acceptance target. The look the game is designed for is the colour one, and with colours the game
  paints every colour itself, its background included, so it never reads or leans on the terminal's
  own theme. Before a colour change, read the manual's "The display options".
- **Lore is a platform, not a plot.** When clearer ASCII and richer story compete, the Grid wins.
- **Build only what a milestone step asks for**; a design page that describes a thing does not
  schedule it. Waiting for a step of their own: a second resource, visibility, the replay format (the
  Skirmish milestone's session record for playtest notes is not it), a unit route still marked IDEA
  in [`movement.md`](docs/system-design/movement.md) (a second banner, a worker's job), multiplayer,
  sound, packaging, a mod loader, any mission beyond PERIMETER and RIGHT OF SALVAGE, and a full
  Commander Army.

## Where things are

What the folder names do not say; the rest is in the tree.

| Path | What it is |
| --- | --- |
| `src/pulse/`, `src/state/`, `src/grid/`, `src/events/`, `src/rng/`, `src/routing/`, `src/abilities/` | The deterministic kernel, the pure parts its unit routes are built from, and the table of ability kinds it calls. `tests/architecture.test.ts` names every folder held to the kernel's purity and which layer may import which. |
| `src/match/`, `src/mission/` | The rules layer between the Build Phase and the kernel: openings, the regroup, banners, missions and their trigger runner. |
| `armies/`, `stories/`, `src/armies/` | Armies as data, stacked: `armies/all` (what any Commander may use), the factions (`citizen`, `ravel`), one army per Commander; a Commander's story and missions (`stories/<id>/story.json`); the loader. To write one: [`army-authoring.md`](docs/system-design/army-authoring.md). |
| `src/battle/`, `src/skirmish/`, `src/cli/skirmish*.ts`, `saves/`, `players/`, `maps/` | The whole game, played: the `skirmish` command plays a Skirmish headless from a save, a round at a time, a script or a model on each side (Nexus, credits, rounds, who wins). Its manual is the opening comment of `src/cli/skirmish.ts`; the design is [`battles.md`](docs/system-design/battles.md) and [`skirmish-saves.md`](docs/system-design/skirmish-saves.md). |
| `sandboxes/`, `src/skirmish/opening/`, `src/measure/`, `bin/grid.ts` | A slice of the Grid, like a unit test's context: a sandbox is one Battle Round written by hand for one rule, effect, movement or ability, run by `grid`, the engine tool; a trial plays one over many seeds, as built and as variants change it ([`sandboxes.md`](docs/system-design/sandboxes.md)). `bin/measure.ts` plays the same battles before and after a change ([`measurement.md`](docs/system-design/measurement.md)). |
| `src/build/all-settings.ts` | Every setting and Experiment, declared once. |
| `src/log/`, `src/report/` | Two records: the Activity Logs (the structured logger, its declared events and filters) and a battle's levelled log with the report a run ends on. |
| `src/terminal/`, `src/view/`, `src/cli/` | What every screen shares with the terminal (it imports nothing from the view); composition and backends; the screen loops and the screen routes (`src/cli/route.ts`). `bin/terminal-nexus.ts` is the game. |
| `.claude/skills/<name>/SKILL.md` | The runnable procedures; each description says when to use it: `grid`, `playtest`, `grid-screenshots`, `skirmish`, `remeasure`, `feedback-round`, `pr-description`, `writing-for-agents`. |

## Finishing a session

- [ ] `./scripts/check-repository.sh` passes; `npm run test:all` (the type check, then the suite on
      Node and on Bun) is green.
- [ ] The milestone's step list is ticked for what was built, and nothing else.
- [ ] Every new word is in the glossary, and every retired one stayed retired.
- [ ] New questions carry a recommendation; new Experiments name the question they serve.
- [ ] The pull request says what a person will notice, how to try it, and what is left to decide.
- [ ] Anything learned the hard way is in `docs/history/lessons-learned.md`, not only fixed.

## Licensing

Code, schemas, scripts, tests and technical documents are Apache-2.0; lore, fiction, characters, ASCII
art and visual direction are CC BY-SA 4.0. Never commit keys, tokens, credentials or personal data.
