# Terminal Nexus agent instructions

**Canon version:** 2.6

These instructions apply to every coding agent and human-assisted coding session in this repository.

Section 4 below summarises invariants that are stated authoritatively in `specs/`. It is a summary,
and when it disagrees with the canon the canon wins — the validator checks that the version above
matches `specs/README.md`, so a canon bump that forgot this file fails the build.

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

**Milestone 1 is built.** Both gates — 1A, the Pulse Playground, and 1B, quality and effects — are
implemented, evidenced and merged. The current gate is **1B**, and what is outstanding is the half no
test can answer: Mario watching the thing move.

So the authorised work for a new session is, in order:

1. **whatever the owner's viewing asks for.** Read
   [`evidence/report.md`](evidence/report.md) and
   [`evidence/gate-1b-report.md`](evidence/gate-1b-report.md) first — they name what each gate
   claims, what it refuses to claim, and what it got wrong;
2. **nothing else, unless the owner accepts Milestone 1.** Milestone 2's contracts are locked and it
   is ready to start cold — but it starts on acceptance, not on a session having time left.

Do not build economy, production, supply, visibility, the Build Phase, campaigns, packaging, remote
delivery, a mod loader, multiplayer, sound, or a Rust/Go migration unless an accepted gate result
authorizes it. Do not author a Commander Army: the two fixture armies on the bench are disposable
bench content, and `commander-armies.md` still reserves rosters for Milestone 4.

**How to run what exists:** `DEVELOPMENT.md`. `./bin/playground.ts run <scenario>` for the headless
report, `watch` for the view, `verify` for hashes. `npm test` is 122 tests on Node and the same files
under Bun.

End with a `PASS`, `REVISE`, `STOP`, or `BLOCKED` evidence report. **Do not continue to the next gate
merely because time remains.** Finishing early with a clean, well-evidenced answer is the intended
outcome, not a shortfall.

## 3. How much authority does a statement have?

Most of the design canon is a recommendation written before the thing existed. Every section of
[`specs/engine.md`](specs/engine.md) declares which kind it is:

- **RULE** — committed; something already depends on it. Changing it needs Mario and a canon bump.
- **GUIDANCE** — a recommendation, not yet earned by working code. Follow it by default; depart when
  the work shows better and say why in the gate report.

Most of it is GUIDANCE.

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
- The Grid has five layers — terrain, obstacles, workers, units, air. **Layers define render order.
  They do not define collision**: collision is a mask composed from a chosen set of layers, so a unit
  can be blocked by a building on another layer while sharing a tile with a worker.
- **Coordinates:** `(0,0)` is the north-west tile, `x` grows east, `y` grows south, `n` is `y - 1`.
  Scenario rows read north to south. One convention, every module.
- **Speed tier is initiative, and lower acts first** — for movement claims and attacks alike. It is
  not a movement rate; that is `movementRate`.
- Every entity has an anchor, a footprint, and a facing. **Units as well as structures may span
  several tiles**, and that matters strategically. A mover tests its whole footprint against its
  mask. Range measures to the nearest occupied tile.
- The viewport is clamped to between 48 × 16 and 72 × 24 tiles; the cursor drives scrolling at a
  3-tile margin; there is no minimap. 80 × 24 is the floor and the acceptance target.
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
- Gameplay randomness is one seeded PRNG — **PCG32**, with published vectors. Cosmetic randomness is
  a **hash of an effect instance's identity, never a stream**: a stream's answers depend on how many
  times it has been asked, which is exactly what effect purity forbids.
- The **compositor** enforces the corruption law. An effect cell that would replace an entity's glyph
  is dropped; the only write allowed onto an occupied cell is a glyphless attribute change.
- A **Grid Nexus is a flag on a content definition**, never a content id the kernel recognises.
- Faction identity lives in the glyph family and the effect language; ownership keeps the colour, so
  a mirror match stays legible and monochrome stays whole.
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
- no two entities overlap in a collision mask that includes both their layers, ever;
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
