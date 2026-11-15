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

Three programs exist today, all on one deterministic battle engine.

**`terminal-nexus`** is the game. It opens on a menu (Skirmish, Story, Settings, About,
Exit) that works by hotkey, by arrows and Enter, or by mouse.

**`skirmish`** plays the same game headless, for agents and tests: a battle from a save, a round at a time
or to the end, with a levelled report and ASCII pictures. **`measure`** plays many battles the same way
before and after a change.

The game has three modes ([the game modes](docs/game-design/game-modes.md)): **Skirmish**, one battle against a scripted
Commander Army; **Story**, a Commander's story of missions; and **Versus**, later. Skirmish on the menu starts one battle
against Dob Hunter's scripted army; Esc then Save game keeps it in a file, and `--load <file>` opens it again. `--at` opens any place in the game by its route, written like a web address without the
site (`--help` lists them). The playable part is the **Build Phase** of PERIMETER, Vasse's first
mission, opened with `--at 'story?mission=vasse-test-1'`, and at any of its rounds with `&round=2`:

- A map bigger than the screen, in a closed rectangle whose sides show where there is more map. The
  cursor scrolls the view, and the view slides.
- A menu on the left that runs the screen: Explore Map, the Nexus Pulse (the hand of Nexus powers
  dealt as the round opens), a budget, a list of buildings with their costs, and Start Battle Round. A card replaces the menu while you explore a tile or
  place a building. Keyboard, mouse and a scripted driver all send the same commands.
- Buildings are placed at the cursor with a short build animation and sparks. A refused placement
  says why and names its tile on the bottom line.
- A Nexus power to keep from the hand, three a round, each saying how rare it is (for now a round may start
  without one), then **Start Battle Round**.
- **Settings** (Esc, then `s`) holds the player's own saved settings and, below them, **Experiments**:
  open design questions you can flip while playing. Export settings copies them as text to paste into
  a pull request, and `--settings` reads them back.

Start Battle Round runs the battle, the **Battle Round**: the unmodified rules engine resolves the plan you built. You
watch it with a countdown, a score and a feed of events, and you can pause, change speed, step and
watch again. The first mission, **PERIMETER**, is three Battle Rounds, with the raid arriving in each.
After each round there is a result, and Next round opens the next Build Phase on what survived.

Not built yet: the Skirmish setup screen, an economy, Story beyond its first mission, and sound. The
[milestones](docs/milestones/README.md) say what comes next.

## Local Development

Node.js 22.18 or newer, or Bun 1.3 or newer. Both run the TypeScript sources directly, so there is
no build step.

### Install

```bash
npm install
```

Only type checking and the OpenTUI terminal backend need it. The battle engine, the report and the view
have no runtime dependency, so the game and the `skirmish` command work from a clean checkout.

### Play it

Make your terminal **at least 80 x 24** — bigger is fine — then:

```bash
npm run terminal-nexus              # the menu: Skirmish, Story, Settings, About, Exit
npm run terminal-nexus -- --at 'skirmish?seed=7'                      # a Skirmish on seed 7
npm run terminal-nexus -- --load mine.save.json                       # a saved Skirmish, at its Build Phase
npm run terminal-nexus -- --load saves/mirror-vasse.save.json         # two scripts, watched
npm run terminal-nexus -- --at 'story?mission=vasse-test-1'           # PERIMETER: the Build Phase and the Battle Round
npm run terminal-nexus -- --at settings                                # any screen of the title menu
```

Every menu row shows its hotkey (`[1] Skirmish`) and works three ways: press the hotkey, arrow to it
and press Enter, or click it. Inside the Build Phase, press `?` for every key. Esc opens the game
menu, and `d` jumps to the Experiments. While a Battle Round plays, `space` pauses, `[` and `]` change
the speed, and `r` watches it again.

**If the screen says `TERMINAL TOO SMALL`,** it needs 80 x 24 and your window is smaller — resize and
it resumes from the same instant. That is the resize screen, not a crash.

### Play it headless

The `skirmish` command plays the same game without a screen, for agents and tests: a battle from a save
or a new setup, a round at a time or to the end, scripts or build files on each side. `--help` is its manual.

```bash
npm run skirmish -- --map crossing --p1 script:agro --p2 script:defensive --play-to end
npm run skirmish -- --map crossing --p1 script:steady --p2 script:steady --commanders all --seeds 1-6 --play-to end
```

A **sandbox** (`sandboxes/`, `npm run sandboxes` lists them) is a save whose battlefield is set up by hand: one
Battle Round for one rule, unit or kind of ground. The command plays it, prints the levelled log (one
stream, closed by a `report` line with the outcome, losses and hashes) and draws it as ASCII at the ticks
asked for:

```bash
npm run skirmish -- --load sandboxes/showcase/citizens-versus-ravels.save.json --play-to next --show 0,60,end
npm run skirmish -- --load sandboxes/rules/ravel-cascade.save.json --play-to next --log-level info | grep blast
```

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
│   ├── game-design/           What the game is: concept, lore, modes, Commander Armies, Story
│   ├── system-design/         How it is built: the architecture, the battle engine, effects, UI patterns, testing
│   ├── milestones/            What is next: milestones, open questions, backlog
│   ├── history/               What happened: timeline, reports, feedback, the visual record
│   └── claude-web.md          Setting up Claude Code on the web
├── src/                   engine (the battle engine), match and mission (the rules between rounds),
│                          battle and skirmish (the game), content, armies, report, log, measure,
│                          terminal, view, build (the Build Phase), title-menu, cli, settings, web
├── tests/                 The test suite; Node's runner and Bun both run it
├── sandboxes/             Sandboxes: Skirmish saves whose battlefield is set up by hand, one per rule
├── saves/                 Example Skirmish saves and the save format's JSON Schema
├── scripts/               Repository validation and development tooling (its README lists them)
├── bin/                   terminal-nexus.ts, skirmish.ts and measure.ts, the three entry points
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
