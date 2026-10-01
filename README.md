```text
                                 : "
_____._._______.______  ._____.___ .___ .______  .______  .___
\__ _:|: .____/: __   \ :         |: __|:      \ :      \ |   |
  |  :|| : _/\ |  \____||   \  /  || : ||       ||   .   ||   |       ,
  |   ||   /  \|   :  \ |   |\/   ||   ||   |   ||   :   ||   |/\
  |   ||_.: __/|   |___\|___| |   ||   ||___|   ||___|   ||   /  \
  |___|   :/   |___|          |___||___|    |___|    |___||______/             '
               \                                                       --=\>
               .\_____  ._______ ____   ____.____     .________   `.       ---=\\>
  `            :      \ : .____/ \   \_/   /|    |___ |    ___/   |           '' .  `
       '       |       || : _/\   \___ ___/ |    |   ||___    \   |._'  .    '
               |   |   ||   /  \  /   _   \ |    :   ||       / -══-           .....
               |___|   ||_.: __/ /___/ \___\|        ||__:___/ / __ \.
                   |___|   :/               |. _____/    :    /,/''\        ,.
                                             :/    │       /-/,-,...'' \\    '    │
                                             :   ─────    /   ,     ══   \\  |   ────
                               "             :    ││    //   , /----\----  \-\   │─│
    Boot up, Commander. You crossed half a galaxy for this  /-/|,''' \══ \  -\\──│ └┌─
                                                   //  /       |, ||  \══-\---\\-\  └───
                                         /  :   --//  / -/     | |||   \══-----\- \\ ───
                                                                                \   \
```

# Terminal Nexus

Terminal Nexus is a next-gen ASCII auto-battler linux shell strategy game. Choose faction, place buildings, draft upgrades, send units to battle.

## Project Status

Terminal Nexus is at version 0.1 until its first public release. The design documents under
[docs/](docs/README.md) describe the current design, and a merged pull request is the change.

Two programs exist today.

**`grid`** is the engine, editor and replay tool: units on a Grid resolving a deterministic battle
from a seed, with a levelled report and an ASCII view. It is not the game. It is the tool that builds
and replays it.

**`terminal-nexus`** is the game's own executable. It opens on a menu (Campaign, Challenge, Settings,
Exit) that works by hotkey, by arrows and Enter, or by mouse. Campaign and Challenge are honest
placeholders. The playable part is the **Build Phase**, started with `--spike` (a temporary name):

- A map bigger than the screen, in a closed rectangle whose sides show where there is more map. The
  cursor scrolls the view, and the view slides.
- A menu on the left that runs the screen: Explore Map, the Nexus powers, a budget, a list of
  buildings with their costs, and Start Pulse. A card replaces the menu while you explore a tile or
  place a building. Keyboard, mouse and a scripted driver all send the same commands.
- Buildings are placed at the cursor with a short build animation and sparks. A refused placement
  says why and names its tile on the bottom line.
- A Nexus power pick that may not be skipped, then **Start Pulse**.
- **Settings** (Esc, then `s`) holds the player's own saved settings and, below them, **Experiments**:
  open design questions you can flip while playing. Export settings copies them as text to paste into
  a pull request, and `--settings` reads them back.

Start Pulse runs the **Nexus Pulse**: the unmodified rules kernel resolves the plan you built. You
watch it with a countdown, a score and a feed of events, and you can pause, change speed, step and
watch again. The first mission, **PERIMETER**, is three rounds with a raid arriving in three waves.
After each round there is a result, and Next round opens the next Build Phase on what survived.

Not built yet: an economy, Commander powers, Campaign content, Challenge runs and sound. The
[milestones](docs/milestones/README.md) say what comes next.

## Local Development

Node.js 22.18 or newer, or Bun 1.3 or newer. Both run the TypeScript sources directly, so there is
no build step.

### Install

```bash
npm install
```

Only type checking and the OpenTUI terminal backend need it. The kernel, the report and the view
have no runtime dependency, so every `grid` command works from a clean checkout.

### Play it

Make your terminal **at least 80 x 24** — bigger is fine, 128 columns wide unlocks the two-column
composition — then:

```bash
npm install     # only needed once, and only for typechecking and the OpenTUI backend
npm run grid -- scenarios/citizens-versus-ravels --glyphs unicode --capability truecolor
```

`<map>` is a path to a `.map.json` file — the `.map.json` suffix is optional, and there is no
subcommand: the first argument is always the map, and the default action is `watch`, the ASCII view.

| While it runs |                                            |
| -------------- | ----------------------------------------- |
| `space`        | pause and resume                          |
| `.`            | step one frame                            |
| `,`            | step one tick — the way to study a moment |
| `[` `]`        | slower, faster                            |
| `r`            | restart from the beginning                |
| `q`            | quit, restoring your terminal             |

A few more worth watching, in this order:

```bash
npm run grid -- scenarios/ravel-cascade --glyphs unicode --capability truecolor --speed 0.5
npm run grid -- scenarios/citizens-versus-ravels --no-effects --glyphs unicode --capability truecolor
npm run grid -- scenarios/citizens-versus-ravels --capability monochrome   # can you still follow it?
npm run grid -- scenarios/citizen-mirror-skirmish                          # the baseline mirror match
```

`npm run maps` lists every checked-in map. `watch` takes the same options on any of them:

```bash
npm run grid -- <map> \
  --capability monochrome|color16|color256|truecolor \
  --glyphs ascii|unicode \
  --tile-width 1|2          # 2 needs a 128-column terminal
  --speed 2 --no-effects --reduced-motion --seed 0x1234 --turn 90
```

**If the screen says `TERMINAL TOO SMALL`,** it needs 80 x 24 and your window is smaller — resize and
it resumes from the same instant. That is the resize screen, not a crash. `--turn 90` seeks straight to
tick 90 instead of playing from the start, in watch, headless and verify alike.

### The game

```bash
npm run terminal-nexus              # the menu: Campaign, Challenge, Settings, Exit
npm run terminal-nexus -- --spike   # the Build Phase and the Nexus Pulse
```

Every menu row shows its hotkey (`[1] Campaign`) and works three ways: press the hotkey, arrow to it
and press Enter, or click it. Inside the Build Phase, press `?` for every key. Esc opens the game
menu, and `d` jumps to the Experiments.

### Read what happened

`watch` is one of three actions. `--headless` resolves without a terminal and prints the levelled
log — one stream, closed by a `report` line carrying the outcome, losses, and hashes:

```bash
./bin/grid.ts scenarios/citizens-versus-ravels --headless                  # WARN by default
./bin/grid.ts scenarios/ravel-cascade --headless | grep blast              # just the detonations
./bin/grid.ts scenarios/citizens-versus-ravels --headless --log-level info # the story, not just anomalies
./bin/grid.ts scenarios/citizens-versus-ravels --headless --turn 90        # jump straight to tick 90
```

`--verify` is the same resolution, re-run 10 times by default, and fails if any run's hashes
disagree — also headless:

```bash
./bin/grid.ts scenarios/citizen-mirror-skirmish --verify              # same hashes every time?
./bin/grid.ts scenarios/citizen-mirror-skirmish --verify --runs 20
```

`--save-log <file>` writes the levelled log to a file in any of the three actions, so you can watch
or verify and keep a full record without a second terminal or a redirect.

### Run tests

```bash
npm test          # Node
npm run test:bun  # Bun
npm run typecheck
```

Repository-level validation:

```bash
./scripts/check-repository.sh
```

It prints the current milestone and its step, and checks the repository's structure and links.

See [DEVELOPMENT.md](DEVELOPMENT.md) for the toolchain, testing and how work is planned.

## Development environments

- GitHub Codespaces is configured through [.devcontainer/devcontainer.json](.devcontainer/devcontainer.json).
- Claude Code and Claude Code on the web read [CLAUDE.md](CLAUDE.md), which imports [AGENTS.md](AGENTS.md).
- GitHub Actions runs repository checks on each push and pull request.
- [Claude Web setup](docs/claude-web.md) documents the one-time connection and first task.

## Repository structure

```text
.
├── docs/                  The design, the plan and the history, in five folders
│   ├── README.md              Index of every document
│   ├── game-design/           What the game is: concept, lore, modes, Commander Armies, campaigns
│   ├── system-design/         How it is built: the engine, the Pulse, effects, UI patterns, testing
│   ├── milestones/            What is next: milestones, open questions, backlog
│   ├── history/               What happened: timeline, reports, Mario's feedback
│   ├── screenshots/           Pictures of the current build
│   └── claude-web.md          Setting up Claude Code on the web
├── src/                   The game and its tools: pulse (the rules kernel), match, mission, content,
│                          scenario, state, events, grid, report, view, build (the Build Phase),
│                          menu, cli, settings, web (the browser playtest page)
├── tests/                 The test suite; Node's runner and Bun both run it
├── scenarios/             Checked-in .map.json fixtures, one file per rule under test
├── scripts/               Repository validation and development tooling
├── bin/                   grid.ts and terminal-nexus.ts, the two entry points
├── .claude/               Skills for coding agents working in this repository
├── .devcontainer/         Codespaces configuration
├── .github/               CI, code owners and the pull request template
├── AGENTS.md              Entry point for any coding agent
├── CLAUDE.md              Claude-specific notes; imports AGENTS.md
├── CONTRIBUTING.md        For human contributors, and the contribution licences
├── DEVELOPMENT.md         How we work: toolchain, tests, milestones, feedback
├── README.md              This file
├── LICENSE, LICENSE-CREATIVE, NOTICE
└── package.json, tsconfig*.json
```

## Licensing

Terminal Nexus uses two licenses because software infrastructure and a fictional universe are different kinds of work.

- **Code and protocols — Apache License 2.0.** Source, tests, scripts, APIs, schemas, data formats, deterministic simulation contracts, network protocols, build configuration, and technical documentation use [Apache-2.0](LICENSE).
- **Lore and creative material — Creative Commons Attribution-ShareAlike 4.0 International.** Fiction, setting, characters, factions, dialogue, ASCII art, visual designs, concept art, and other creative assets use [CC BY-SA 4.0](LICENSE-CREATIVE).

Some documents combine technical and creative material. Each section follows the license appropriate to its subject. Inseparable mixed material may be reused only while satisfying both licenses.

Third-party work remains under its original license and must be identified near the material or in an attribution file. The project licenses do not imply endorsement by Terminal Nexus or its contributors.

See [NOTICE](NOTICE) and [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), then [AGENTS.md](AGENTS.md) and the [document index](docs/README.md), before proposing a change.
