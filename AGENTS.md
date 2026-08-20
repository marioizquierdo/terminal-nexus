# Terminal Nexus agent instructions

These instructions apply to every coding agent and human-assisted coding session in this repository.

Terminal Nexus is a specification-driven pre-production project. The specifications are not
decoration around the code — right now they *are* the project, and the code does not exist yet.
Treat them as the operating contract.

## 0. Orient in one command

```bash
./scripts/check-repository.sh
```

It prints the canon version and the active gate, and it enforces the canon's structural invariants.
Run it first, and run it again before you hand back work. It is the only feedback loop that exists
until Gate 1A selects a runtime, so keep it honest and keep it green.

## 1. Start with authority, not code

Read in this order:

1. [`specs/terminal-nexus-concept.md`](specs/terminal-nexus-concept.md);
2. [`specs/README.md`](specs/README.md) and the milestone marked **CURRENT**, through its
   **Active gate**;
3. [`specs/open-questions.md`](specs/open-questions.md) Section 4 — what is undecided and why;
4. [`specs/project-governance.md`](specs/project-governance.md), especially the execution ledger and
   bounded autonomy;
5. only the supporting canon sections named by the current gate;
6. existing source, tests, evidence, and recent changes.

The canon controls product truth. The current gate controls implementation. Future milestones are
context, not authorization.

Before changing code, state:

- the current question;
- the smallest artifact that can answer it;
- required automated and human evidence;
- exclusions and stop conditions.

Write them into a copy of [`specs/templates/gate-report.md`](specs/templates/gate-report.md) rather
than only into the chat. If they are not clear from the repository, that itself is the finding — say
so before building something to fill the gap.

## 2. Current authorization

The current gate is **Milestone 1A — headless Pulse** in
[`specs/milestone-1-spike-battle.md`](specs/milestone-1-spike-battle.md).

Build the Grid, the scenario file format, and a deterministic tick loop that resolves a mirror Citizen
skirmish into an identical event log every run. **There is no renderer in this gate.** Do not begin
Gate 1B (watching it) or Gate 1C (effects), and do not build routing, economy, production, supply,
visibility, the Build Phase, campaigns, packaging, remote delivery, a mod loader, multiplayer, sound,
or a Rust/Go migration unless an accepted gate result authorizes it.

End with a `PASS`, `REVISE`, `STOP`, or `BLOCKED` evidence report. **Do not continue to the next gate
merely because time remains.** Finishing early with a clean, well-evidenced answer is the intended
outcome, not a shortfall.

## 3. How much authority does a statement have?

Most of the design canon is a recommendation written before the thing existed. Every section of
[`specs/engine.md`](specs/engine.md) declares which kind it is:

- **LAW** — committed; something already depends on it. Changing it needs Mario and a canon bump.
- **GUIDANCE** — the current best recommendation. Follow it by default; depart when the work shows
  better and say why in the gate report.
- **UNPROVEN** — recorded so it is not lost. Do not implement it, and do not let a design assume it.

**Descriptive completeness is not authorization.** If you find yourself building something because it
is described in a document, stop and check the marker and the active gate.

## 4. Architectural invariants

**The three worlds.** State is what is true; the Pulse is how it changes; presentation is what it
looks like. Only the Pulse mutates state. Presentation can never influence the Pulse. The two random
streams — seeded gameplay, free cosmetic — never touch. A match must resolve with the renderer
deleted, and the renderer must be replaceable without one simulation test changing.

- The deterministic rules kernel is authoritative and imports no terminal, clock, network, or
  presentation implementation.
- Simulation produces canonical state and ordered semantic events. Events carry meaning, not
  appearance; renderers never reverse-engineer cells back into mechanics.
- Player projection removes hidden information before presentation.
- The play surface is the **Grid**; the replica on it is a **Grid Nexus**. The retired word for it
  is rejected by the validator. <!-- stale-ok -->
- The Grid has five layers — terrain, obstacles, workers, units, air — and **collisions resolve
  within a layer, never across layers**. A worker and a soldier may share a tile; two soldiers may
  not.
- Every entity has an anchor, a footprint, and a facing. Multi-tile entities are first-class; write
  the footprint loop on day one. Range measures to the nearest occupied tile.
- Grid orientation is a rendering choice. Portrait and landscape change no coordinate.
- Terminal composition produces an engine-owned structured cell frame. Cells carry style **roles**,
  never literal colors.
- OpenTUI, direct ANSI, browser, SSH, mobile, and future graphical renderers are adapters. The
  terminal library and the JavaScript runtime are independent choices.
- Presentation may interpolate, skip, pause, accelerate, reduce motion, or recolor without changing
  simulation.
- Corruption effects live in the `effects` band or above; they never remove the only carrier of a
  required semantic cue.
- Effects are pure functions of absolute presentation time. `f(t)` never depends on `f(t-1)`.
- Gameplay and presentation randomness are separate and explicitly seeded.
- Content is TypeScript-first and mostly declarative.
- The playable content boundary is a Commander Army: Commander, units, structures, upgrades, Nexus
  powers, and starting package.
- Prime Nexuses remain at home and replicate Grid Nexuses; avoid stale teleportation language.
- Player-facing phases are **Build Phase** and **Nexus Pulse**; use those names consistently.
- Prefer direct code for the current proof. Extract a framework only after two real uses reveal the
  boundary.

## 5. Working method

- Keep changes small, reviewable, and within the current gate.
- Preserve unrelated work; never use destructive Git commands to clear an incidental problem.
- Pin runtime and dependency versions used as evidence. Re-check official sources; never copy a
  remembered version.
- Separate measurements from interpretation.
- Do not label an untested platform supported.
- Keep fixtures, seeds, snapshots, commands, and measurements reproducible.
- Add or update tests with behavioral changes.
- Treat owner validation as separate from automated correctness.
- Ask before changing a locked decision, widening scope, adding a service or secret, publishing
  artifacts, or pushing directly to `main`.
- Update `README.md`, `DEVELOPMENT.md`, the dev container, CI, and agent instructions together when
  canonical development commands change.

## 6. When the canon does not answer you

This will happen. It is expected, and there is a procedure — see
[`specs/open-questions.md`](specs/open-questions.md) Section 2.

1. **Decide it yourself** if it is reversible: module boundaries, names, local data shapes, test
   organization, diagnostics. Governance Section 2 already grants this. Do not ask.
2. **Make it observable** if you can. A parameter, toggle, or side-by-side fixture that lets Mario
   *look* at both answers beats a paragraph arguing for one. This is the preferred move and it is
   cheap far more often than it looks.
3. **Register it** if it is genuinely the owner's call: add a `Q<n>` row with the question, why it
   blocks, the options, their costs, and **a recommendation**. The validator rejects an `OPEN`
   question with no recommendation, because a question without one just moves the work to Mario.
4. **Keep going.** State the assumption you are proceeding under and finish everything the answer
   does not touch. Stop entirely only when proceeding under any assumption would waste the work.

## 7. Verification

Until the product runtime is selected, run:

```bash
./scripts/check-repository.sh
```

When a gate adds commands, record exact install, build, test, and run instructions in its evidence
and promote the accepted ones into `DEVELOPMENT.md`.

**For simulation work** — Gate 1A, and every kernel change after it:

- the same scenario, seed, and tick count produce identical final-state and event hashes across many
  runs;
- resolving in one call equals resolving tick by tick;
- the kernel calls no clock and no `Math.random`, and imports nothing from a renderer — assert it,
  do not assume it;
- changing only the cosmetic seed changes nothing about state or events;
- no two entities share a tile **on the same layer**, ever;
- arbitration terminates under a bounded pass count with a decreasing progress measure;
- every rule has a named scenario file that exercises it, checked in and runnable.

**For terminal work**, once a gate authorizes it:

- structured-cell snapshots, identical across backends;
- keyboard and mouse-event receipt;
- resize suspension and recovery from the same presentation time;
- alternate-screen and cursor cleanup;
- `q`, `SIGINT`, `SIGTERM`, setup failure, and caught render failure through one idempotent disposer;
- non-TTY behavior;
- monochrome ASCII and explicit color modes;
- startup, frame-time, changed-cell, and output-byte evidence.

The lifecycle cases matter most. A renderer that drops frames is a tuning problem; a renderer that
leaves the terminal in raw mode is a reason to reject it.

## 8. Finishing a session

Leave the repository in a state the next session can pick up cold:

- [ ] `./scripts/check-repository.sh` passes;
- [ ] the gate report is filled in and ends with `PASS` / `REVISE` / `STOP` / `BLOCKED`;
- [ ] every command in the report has been run verbatim;
- [ ] new questions are registered with recommendations;
- [ ] the commit message says what question the change answers;
- [ ] anything you learned the hard way is written down, not just fixed.

Section 7 of the gate report — failures, surprises, and discarded approaches — is the highest-value
thing you can leave behind. An empty one usually means it was skipped rather than that nothing went
wrong.

## 9. Canon maintenance

After an accepted gate:

1. update the [`specs/project-governance.md`](specs/project-governance.md) ledger and history;
2. promote only evidence-backed conclusions into the focused authority document;
3. move answered questions into the register's Answered section and cite the ID in the commit;
4. update locked and open decisions;
5. revise the next milestone only after owner acceptance;
6. increment the shared canon version for semantic changes — the validator will name the documents
   you missed;
7. update links and run repository validation.

Do not recreate a monolithic specification. Lore goes in the lore document, engine rules in the
engine, playable content in Commander Armies, mission content in campaigns, undecided things in the
open-questions register.

## 10. Licensing and safety

- Code, protocols, schemas, scripts, tests, technical docs, and build config are Apache-2.0.
- Lore, fiction, characters, dialogue, ASCII art, and visual direction are CC BY-SA 4.0.
- Keep mixed scopes identifiable and preserve third-party attribution.
- Studying a referenced project's approach is free; copying its art, glyph sets, or palettes is not.
- Never commit API keys, tokens, credentials, `.env` files, personal data, or generated secrets.
