# Developing Terminal Nexus

Terminal Nexus is currently a specification-driven pre-production project. The first implementation will be a bounded terminal renderer experiment, not a vertical slice of the whole game.

## Start a coding session

1. Read `AGENTS.md`.
2. Read `specs/terminal-nexus-concept.md`.
3. Open `specs/README.md` and follow its current-gate reading order.
4. Inspect existing code, tests, and evidence before proposing changes.
5. Restate the question, artifact, evidence, exclusions, and stop condition.

The current implementation contract is `specs/milestone-1-spike-battle.md`, Gate 1A.

## Current commands

### Repository validation

```bash
./scripts/check-repository.sh
```

### Install

Coming Soon. Gate 1A will select and pin the product runtime and dependencies.

### Build

Coming Soon.

### Test

Coming Soon.

### Run locally

Coming Soon.

Do not install an unpinned floating runtime merely to populate these commands. When Gate 1A earns a toolchain decision, update this document, `README.md`, the dev container, CI, and Claude setup together.

## Environment options

### Local checkout

Use any editor and terminal capable of running the pinned toolchain once selected. The repository validator currently requires Bash and Node.js only for documentation checks.

### GitHub Codespaces

The repository includes a dev-container configuration. It supplies a consistent editor, shell, Node environment for repository checks, and GitHub CLI. The Node image does not pre-decide the Terminal Nexus runtime.

### Claude Code on the web

Claude runs in an isolated task environment and should work on a branch, verify its changes, and return a pull request. See `docs/claude-web.md`.

## Change discipline

- One pull request should answer one bounded question.
- Keep measured facts separate from design judgments.
- Preserve exact versions, commands, platforms, fixtures, snapshots, and seeds.
- Do not continue into a later gate without owner acceptance.
- Do not update canon to claim an experiential success that Mario or a fresh viewer has not observed.
- Never commit secrets or personal information.

## Evidence reports

A gate report should identify:

- canon version and current gate;
- hypothesis and exclusions;
- environment and exact commands;
- produced artifact;
- automated results and measurements;
- human observations, when applicable;
- failures and useful discarded approaches;
- `PASS`, `REVISE`, `STOP`, or `BLOCKED`;
- earned canon changes and the proposed next gate.

Reports and large evidence belong beside the implementation spike rather than inside the durable canon.

## Canon changes

The canon is split by responsibility under `specs/`. Change the narrowest authoritative document and follow the protocol in `specs/project-governance.md`. Keep links valid and increment the shared canon version for semantic changes.

## Licensing

Code and technical work use Apache-2.0. Lore and creative work use CC BY-SA 4.0. See `README.md`, `NOTICE`, and `CONTRIBUTING.md` before importing third-party code, art, fiction, fonts, or assets.
