# Contributing to Terminal Nexus

Terminal Nexus is in pre-production and uses bounded experiments to earn architecture and game-design decisions.

## Before proposing a change

1. Read `AGENTS.md`.
2. Read `specs/terminal-nexus-concept.md` and `specs/README.md`.
3. Read the milestone marked **CURRENT**, through its **Active gate**.
4. Read only the focused canon referenced by that gate.
5. Skim `specs/open-questions.md` so you do not silently decide something that is waiting on Mario.
6. Confirm that the change belongs to the current authorization.

Open an issue or discussion before work that changes a locked decision, widens the active gate, adds a service or secret, introduces a compatibility promise, or modifies licensing.

## Pull requests

- Keep one pull request focused on one decision or artifact.
- Explain the question and explicit exclusions.
- Include exact verification commands and evidence.
- Separate automated results from human observations.
- Update canon only when accepted evidence earns a durable conclusion.
- Do not combine completion of one gate with the next gate's implementation.

Run before requesting review:

```bash
./scripts/check-repository.sh
```

Install, build, test, and run commands are in `README.md`'s Local Development section and
`DEVELOPMENT.md`. There is no build step — Node 22.18+ and Bun 1.3+ both run the TypeScript sources
directly.

## Contribution licenses

By submitting a contribution, you agree that:

- code, protocols, schemas, scripts, tests, technical documentation, and build configuration are Apache-2.0;
- lore, fiction, dialogue, characters, ASCII art, visual direction, and other creative material are CC BY-SA 4.0;
- you have the right to contribute the material under those terms;
- third-party material is identified with its original license and attribution.

Keep technical and creative sections distinguishable in mixed files whenever practical.
