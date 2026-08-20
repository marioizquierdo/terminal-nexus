# Terminal Nexus

Terminal Nexus is a fast, terminal-native strategy game about building a compact base during hidden simultaneous planning, then watching persistent armies resolve those decisions through vivid deterministic ASCII battles called Nexus Pulses.

It combines modern drafting and autobattler structure with old-school RTS ideas: workers, supply, automatic production, terrain, faction asymmetry, Commanders, and bases whose geometry matters. A complete match should eventually fit inside a 5–12-minute build break.

## Status

Terminal Nexus is in pre-production. No playable game exists yet.

The current work is **Milestone 1A**, a bounded renderer/toolchain preflight. It selects the first reliable TypeScript terminal path before the authored ASCII battle reel. Combat simulation begins only after that visual milestone succeeds.

## Canon and current work

The project is specification-driven and uses a focused canon rather than one large design file:

- [Game concept](specs/terminal-nexus-concept.md)
- [Specification index and reading order](specs/README.md)
- [Current battle-spike milestone](specs/milestone-1-spike-battle.md)
- [Engine and gameplay framework](specs/engine.md)
- [Lore and aesthetics](specs/terminal-nexus-lore.md)

The current milestone controls implementation scope. Future-facing documents do not authorize their systems.

## Development

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
