```text
                                 : "                                                    
_____._._______.______  ._____.___ .___ .______  .______  .___                          
\__ _:|: .____/: __   \ :         |: __|:      \ :      \ |   |                         
  |  :|| : _/\ |  \____||   \  /  || : ||       ||   .   ||   |       ,                 
  |   ||   /  \|   :  \ |   |\/   ||   ||   |   ||   :   ||   |/\                       
  |   ||_.: __/|   |___\|___| |   ||   ||___|   ||___|   ||   /  \                      
  |___|   :/   |___|          |___||___|    |___|    |___||______/             '        
               \                                                                        
               .\_____  ._______ ____   ____.____     .________   `.   ..─────\\>       
  `            :      \ : .____/ \   \_/   /|    |___ |    ___/   |           '' .  `   
       '       |       || : _/\   \___ ___/ |    |   ||___    \   |._'  :    '          
               |   |   ||   /  \  /   _   \ |    :   ||       / -══-           .....    
               |___|   ||_.: __/ /___/ \___\|        ||__:___/ /  _ \.                  
                   |___|   :/               |. _____/    :    /,/'`.        ,.          
                                             :/    │       /-/.-,...'' \\    '     │    
                                             :   ─────    /   '     ══   \\  |    ────  
                               "             :    ││    //   ' /----\----  \-\   │─│    
    Boot up, Commander. You crossed half a galaxy for this  /-/|,''' \══ \  -\\──│ └┌─  
                                                   //  /       |,.||  \══-\---\\-\  └───
                                         /  :   --//  / -/     | |||   \══-----\- \\ ───
                                                                                \   \   
```

# Terminal Nexus

Terminal Nexus is a next-gen ASCII auto-battler linux shell strategy game. Choose faction, place buildings, draft upgrades, send units to battle.

## Project Status

Pre-production. The first playable artifact is the **Pulse Playground** of Milestone 1, Gate 1A:
units on a small Grid resolving a deterministic battle from a seed, with a levelled report and a
minimal ASCII view. There is no Build Phase, no economy, and no campaign yet.

## Local Development

Node.js 22.18 or newer, or Bun 1.3 or newer. Both run the TypeScript sources directly, so there is
no build step.

### Install

```bash
npm install
```

Only type checking and the OpenTUI terminal backend need it. The kernel, the report and the view
have no runtime dependency, so `run`, `watch` and `verify` work from a clean checkout.

### Run locally

```bash
./bin/playground.ts run   scenarios/citizen-mirror-skirmish.ts
./bin/playground.ts watch scenarios/citizen-mirror-skirmish.ts
./bin/playground.ts verify scenarios/citizen-mirror-skirmish.ts --runs 20
```

`run` prints a levelled log on stderr and a summary on stdout, so
`playground run x.ts > report.txt 2> run.log` splits them. `watch` plays the same Pulse back in an
80x24 terminal. `verify` re-resolves a scenario and compares hashes.

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
├── specs/                 Focused canon and milestone contracts
├── concept/               Concept art and the canon deltas it implies
├── docs/                  Human setup and workflow notes
├── scripts/               Repository and future development commands
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
