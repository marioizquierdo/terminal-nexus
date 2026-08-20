# Terminal Nexus agent instructions

These instructions apply to every coding agent and human-assisted coding session in this repository.

## 1. Start with authority, not code

Read in this order:

1. `specs/terminal-nexus-concept.md`;
2. `specs/README.md` and the milestone marked **CURRENT**;
3. `specs/project-governance.md`, especially the execution ledger and bounded autonomy;
4. only the supporting canon sections named by the current gate;
5. existing source, tests, evidence, and recent changes.

The canon controls product truth. The current gate controls implementation. Future milestones are context, not authorization.

Before changing code, state:

- the current question;
- the smallest artifact that can answer it;
- required automated and human evidence;
- exclusions and stop conditions.

If these are not clear from the repository, stop and ask Mario.

## 2. Current authorization

The current gate is **Milestone 1A: renderer preflight** in `specs/milestone-1-spike-battle.md`.

Implement only the shared fixture and bounded terminal/runtime comparison. Do not begin the authored battle reel, combat simulation, pathfinding, economy, builder, campaign, mod loader, multiplayer, sound, or a Rust/Go migration unless the accepted Gate 1A result explicitly authorizes the next action.

End with a `PASS`, `REVISE`, `STOP`, or `BLOCKED` evidence report. Do not continue to Gate 1B merely because time remains.

## 3. Architectural invariants

- The deterministic rules kernel is authoritative and imports no terminal, clock, network, or presentation implementation.
- Simulation eventually produces canonical state and ordered semantic events.
- Player projection removes hidden information before presentation.
- Terminal composition produces an engine-owned structured cell frame.
- OpenTUI, direct ANSI, browser, SSH, mobile, and future graphical renderers are adapters.
- Presentation may interpolate, skip, pause, accelerate, reduce motion, or recolor without changing simulation.
- Gameplay and presentation randomness are separate and explicitly seeded.
- Content is TypeScript-first and mostly declarative.
- The playable content boundary is a Commander Army: Commander, units, structures, upgrades, Nexus powers, and starting package.
- Prime Nexuses remain at home and replicate battlefield Nexuses; avoid stale teleportation language.
- Player-facing phases are **Build Phase** and **Nexus Pulse**; use those names consistently.
- Prefer direct code for the current proof. Extract a framework only after two real uses reveal the boundary.

## 4. Working method

- Keep changes small, reviewable, and within the current gate.
- Preserve unrelated work; never use destructive Git commands to clear an incidental problem.
- Pin runtime and dependency versions used as evidence.
- Separate measurements from interpretation.
- Do not label an untested platform supported.
- Keep fixtures, seeds, snapshots, commands, and measurements reproducible.
- Add or update tests with behavioral changes.
- Treat owner validation as separate from automated correctness.
- Ask before changing a locked decision, widening scope, adding a service/secret, publishing artifacts, or pushing directly to `main`.
- Update `README.md`, `DEVELOPMENT.md`, the dev container, CI, and agent instructions together when canonical development commands change.

## 5. Verification

Until the product runtime is selected, run:

```bash
./scripts/check-repository.sh
```

When Gate 1A adds commands, record exact install, build, test, launch, and packaging instructions in its evidence and promote accepted commands into `DEVELOPMENT.md`.

For terminal work verify, as required by the current milestone:

- structured-cell snapshots;
- keyboard and mouse-event receipt;
- resize suspension/recovery;
- alternate-screen and cursor cleanup;
- `q`, `SIGINT`, `SIGTERM`, setup failure, and caught render failure;
- non-TTY behavior;
- monochrome ASCII and explicit color modes;
- startup, frame-time, changed-cell, and output-byte evidence.

## 6. Canon maintenance

After an accepted gate:

1. update `specs/project-governance.md` ledger and history;
2. promote only evidence-backed conclusions into the focused authority document;
3. update locked/open decisions;
4. revise the next milestone only after owner acceptance;
5. increment the shared canon version for semantic changes;
6. update links and run repository validation.

Do not recreate a monolithic specification. Put lore in the lore document, engine rules in the engine, playable content in Commander Armies, and mission content in campaigns.

## 7. Licensing and safety

- Code, protocols, schemas, scripts, tests, technical docs, and build config are Apache-2.0.
- Lore, fiction, characters, dialogue, ASCII art, and visual direction are CC BY-SA 4.0.
- Keep mixed scopes identifiable and preserve third-party attribution.
- Never commit API keys, tokens, credentials, `.env` files, personal data, or generated secrets.
