# Contributing to Terminal Nexus

Terminal Nexus is at version 0.1 and uses small experiments to earn its architecture and game-design decisions.

## Before proposing a change

1. Read `AGENTS.md`.
2. Read `docs/README.md`, the index of every document.
3. Read the current milestone in `docs/milestones/`, down to its current step.
4. Skim `docs/milestones/open-questions.md` so you do not silently decide something that is waiting on Mario.
5. Confirm the change is in scope for the current step.

Open an issue or discussion before work that changes what the game is, widens the current step, adds a service or secret, introduces a compatibility promise, or modifies licensing.

## Pull requests

- Keep one pull request focused on one decision or one milestone step.
- Write the description for someone reading it on a phone who will play the build rather than read
  the diff: what changed on screen, how to try it (exact command and keys), screenshots, and the
  decisions that are still open, in plain English, in the order of
  `.github/pull_request_template.md`. Agents use the `pr-description` skill
  (`.claude/skills/pr-description/SKILL.md`), which has the full rules.
- Say what no person has tried yet, and what is known to be broken.
- Update design documents in the same pull request as the code that changes them.
- Do not combine one milestone step with the next one's implementation.

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
