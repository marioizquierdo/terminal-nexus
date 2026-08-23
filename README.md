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

Pre-production. The first playable artifact is **`grid`**, the engine, editor, and replay tool
Milestone 1's Pulse Playground grew into: units on a small Grid resolving a deterministic battle
from a seed, with a levelled report and a minimal ASCII view. There is no Build Phase, no economy,
and no campaign yet — those, and the game's own executable, come later. `grid` is not that game;
it is the tool that builds and replays it.

## Local Development

Node.js 22.18 or newer, or Bun 1.3 or newer. Both run the TypeScript sources directly, so there is
no build step.

### Install

```bash
npm install
```

Only type checking and the OpenTUI terminal backend need it. The kernel, the report and the view
have no runtime dependency, so `run`, `watch` and `verify` work from a clean checkout.

### Play it

Make your terminal **at least 80 x 24** — bigger is fine, 128 columns wide unlocks the two-column
composition — then:

```bash
npm install     # only needed once, and only for typechecking and the OpenTUI backend
npm run play    # Citizens versus Ravels, colour, Unicode, effects on
```

| While it runs |                                           |
| ------------- | ----------------------------------------- |
| `space`       | pause and resume                          |
| `.`           | step one frame                            |
| `,`           | step one tick — the way to study a moment |
| `[` `]`       | slower, faster                            |
| `r`           | restart from the beginning                |
| `q`           | quit, restoring your terminal             |

Four more worth watching, in this order:

```bash
npm run play:cascade   # a Ravel fuel dump goes up in one tick, at half speed
npm run play:plain     # the same fight with effects off - the comparison Gate 1B is judged on
npm run play:mono      # monochrome, the acceptance floor: can you still follow it?
./bin/grid.ts watch scenarios/citizen-mirror-skirmish.ts   # the Gate 1A baseline
```

`npm run scenarios` lists them all. Any of them takes the same options:

```bash
./bin/grid.ts watch <scenario> \
  --capability monochrome|color16|color256|truecolor \
  --glyphs ascii|unicode \
  --tile-width 1|2          # 2 needs a 128-column terminal
  --speed 2 --no-effects --reduced-motion --seed 0x1234
```

**If the screen says `TERMINAL TOO SMALL`,** it needs 80 x 24 and your window is smaller — resize and
it resumes from the same instant. That is the resize gate, not a crash.

### Read what happened

The view is one of two outputs. The other is a report you can grep:

```bash
./bin/grid.ts run scenarios/citizens-versus-ravels.ts              # story on stderr, summary on stdout
./bin/grid.ts run scenarios/ravel-cascade.ts 2>&1 | grep blast     # just the detonations
./bin/grid.ts run scenarios/citizens-versus-ravels.ts --log-level debug
./bin/grid.ts verify scenarios/citizens-versus-ravels.ts --runs 20 # same hashes every time?
```

### Run locally

```bash
./bin/grid.ts run   scenarios/citizen-mirror-skirmish.ts
./bin/grid.ts watch scenarios/citizen-mirror-skirmish.ts
./bin/grid.ts verify scenarios/citizen-mirror-skirmish.ts --runs 20
```

`run` prints a levelled log on stderr and a summary on stdout, so
`grid run x.ts > report.txt 2> run.log` splits them. `watch` plays the same Pulse back. `verify`
re-resolves a scenario and compares hashes.

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

It reports the canon version and the active gate, and enforces the canon's structural invariants.

See [DEVELOPMENT.md](DEVELOPMENT.md) for the workflow and evidence requirements.

## Development environments

- GitHub Codespaces is configured through [.devcontainer/devcontainer.json](.devcontainer/devcontainer.json).
- Claude Code and Claude Code on the web read [CLAUDE.md](CLAUDE.md), which imports [AGENTS.md](AGENTS.md).
- GitHub Actions runs repository checks on each push and pull request.
- [Claude Web setup](docs/claude-web.md) documents the one-time connection and first task.

## Repository structure

```text
.
├── src/                   The kernel and tools: pulse (deterministic engine), content, scenario,
│                          state, events, grid, report, view, cli, rng
├── scenarios/             Checked-in scenario fixtures — one file per rule under test
├── bin/                   grid.ts, the CLI entry point (`./bin/grid.ts run|watch|verify`)
├── tests/                 The test suite; Node's runner and Bun both run it
├── specs/                 Focused canon and milestone contracts
├── evidence/              Gate reports and screenshots — what was measured, not just claimed
├── concept/               Concept art, real screenshots, and the archived original spec
├── docs/                  Human setup and workflow notes
├── scripts/               Repository validation and development tooling
├── .claude/               Skills for coding agents working in this repository
├── .devcontainer/         Codespaces configuration
├── .github/               CI and contribution configuration
├── AGENTS.md              Shared coding-agent contract
├── CLAUDE.md              Claude-specific entry point
└── DEVELOPMENT.md         Human development workflow
```

## Licensing

Terminal Nexus uses two licenses because software infrastructure and a fictional universe are different kinds of work.

- **Code and protocols — Apache License 2.0.** Source, tests, scripts, APIs, schemas, data formats, deterministic simulation contracts, network protocols, build configuration, and technical documentation use [Apache-2.0](LICENSE).
- **Lore and creative material — Creative Commons Attribution-ShareAlike 4.0 International.** Fiction, setting, characters, factions, dialogue, ASCII art, visual designs, concept art, and other creative assets use [CC BY-SA 4.0](LICENSE-CREATIVE).

Some documents combine technical and creative material. Each section follows the license appropriate to its subject. Inseparable mixed material may be reused only while satisfying both licenses.

Third-party work remains under its original license and must be identified near the material or in an attribution file. The project licenses do not imply endorsement by Terminal Nexus or its contributors.

See [NOTICE](NOTICE) and [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Contributing

Terminal Nexus begins with evidence-driven milestones, not a general feature backlog. Read [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), the [specification index](specs/README.md), and the current gate before proposing implementation.
