```text
                                              /\
                                             /  \
     ___ ___ ___  _  _  _  _  _  __  _      /    \    _  _ ___ _  _ _ _  __
      |  |__ |__/ |\/|  |  |\ | |__| |     /      \   |\ | |__  \/  | | |__
      |  |__ |  \ |  |  |  | \| |  | |__  /        \  | \| |__  /\  |_| __|
                                         /__________\
                                        /            \
                                       /              \
                                      /________________\
                                  '  /                  \  '
________________________@___ _ .    /                    \    . _ ______________

                   Boot up, Commander. The Ancients are here.
```

# Terminal Nexus

Terminal Nexus is the next-gen ASCII autobattler strategy game that runs in your command-line shell. Choose your faction, build your base and send your units to the battle.

## Project Status

Pre-production. No playable game exists yet.

## Local Development

### Build

Coming Soon.

### Run locally

Coming Soon.

### Run tests

Coming Soon.

Repository-level validation is available now:

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
