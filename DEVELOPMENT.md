# Developing Terminal Nexus

Terminal Nexus is a specification-driven pre-production project. The first implementation will be a
bounded terminal renderer experiment, not a vertical slice of the whole game.

## Start a coding session

1. Run `./scripts/check-repository.sh`. It prints the canon version and the active gate.
2. Read `AGENTS.md`.
3. Read `specs/terminal-nexus-concept.md`.
4. Open `specs/README.md` and follow its current-gate reading order.
5. Skim `specs/open-questions.md` Section 4 so you know what is undecided before you decide it.
6. Inspect existing code, tests, and evidence before proposing changes.
7. Copy `specs/templates/gate-report.md` and fill in its first section: question, artifact, evidence,
   exclusions, stop conditions.

The current implementation contract is `specs/milestone-1-spike-battle.md`, Gate 1A.

## Current commands

### Repository validation

```bash
./scripts/check-repository.sh
```

This is the project's only automated feedback loop until a runtime is selected. It checks
invariants, not literals — canon version and current gate are derived from the documents, so
correct canon work never breaks it. What it enforces:

- required files exist;
- every document under `specs/` and `concept/` declares the same canon version as `specs/README.md`;
- every such document carries `Document role`, `Status`, `Canon version`, `Updated`, `License`;
- exactly one milestone is `CURRENT`, declares an `Active gate`, and matches the governance ledger;
- every `Q<n>` referenced anywhere is defined in `specs/open-questions.md`, and every `OPEN` question
  carries a recommendation;
- retired terminology stays retired — mark a line `<!-- stale-ok -->` to quote it deliberately;
- `.devcontainer/devcontainer.json` parses, local Markdown links resolve, code fences balance, and
  the working tree has no whitespace errors.

Add a check here whenever you find yourself remembering a rule instead of relying on one.

### Install, build, test, run

Coming Soon. Gate 1A selects and pins the product runtime and dependencies.

Do not install an unpinned floating runtime merely to populate these commands. When Gate 1A earns a
toolchain decision, update this document, `README.md`, the dev container, CI, and Claude setup
together.

## Environment options

### Local checkout

Use any editor and terminal capable of running the pinned toolchain once selected. The repository
validator currently requires Bash, Node.js, and standard POSIX tools (`grep`, `sed`, `awk`, `find`).

### GitHub Codespaces

The repository includes a dev-container configuration supplying an editor, shell, Node environment,
and GitHub CLI. The Node image does not pre-decide the Terminal Nexus runtime.

### Claude Code on the web

Claude runs in an isolated task environment and should work on a branch, verify its changes, and
return a pull request. See `docs/claude-web.md`.

Measured in that environment on 2026-08-20: **Bun 1.3.11 and Node 22.22.2 are present; Deno is not.**
A Deno probe therefore costs an install step in every session, which is why Milestone 1 dropped it.

## Change discipline

- One pull request should answer one bounded question.
- Keep measured facts separate from design judgments.
- Preserve exact versions, commands, platforms, fixtures, snapshots, and seeds.
- Do not continue into a later gate without owner acceptance.
- Do not update canon to claim an experiential success that Mario or a fresh viewer has not observed.
- Never commit secrets or personal information.

## Evidence reports

Copy `specs/templates/gate-report.md` into the spike's `evidence/report.md` and fill it in **while you
work**. A report reconstructed at the end is how a gate quietly turns into a summary of whatever got
built.

Reports and large evidence belong beside the implementation spike, not inside the durable canon.

## Canon changes

The canon is split by responsibility under `specs/`. Change the narrowest authoritative document and
follow the protocol in `specs/project-governance.md`. Increment the shared canon version for semantic
changes — the validator names the documents you forgot.

Undecided things go in `specs/open-questions.md` with a recommendation, not into a hedge inside a
specification.

## Change log

Human-readable history of the development setup itself. Product and canon history lives in
`specs/project-governance.md` Section 6.

### 2026-08-20 — canon audit and autonomy pass (canon 2.1)

An audit of the canon against itself, against the concept art, and against current upstream sources.

**Specification changes**

- **Milestone 1 was split.** Gate 1A previously required two backends, two runtimes, standalone
  executables, an SSH smoke test, and a browser-terminal demonstration before Gate 1B could begin —
  while `engine.md` Section 11.2 simultaneously called remote and browser surfaces "not Milestone 1
  product commitments." Gate 1A is now cell frame and lifecycle only. Packaging and remote delivery
  moved to **Gate 1C**, which is authorized independently and does not block the battle reel.
- **`specs/open-questions.md` added** — the durable register for decisions that need Mario. Seeded
  with seven questions found during the audit. The register is what lets a session get blocked on one
  fork without stalling on all of them.
- **`specs/templates/gate-report.md` added** — the fill-in template that closes a gate.
- **`specs/ascii-art-references.md` added** — researched sources for producing terminal art, with what
  each one is actually good for.
- **`concept/README.md` added** — concept art index recording, per piece, what it gets right and which
  canon deltas it implies.
- **`engine.md` Section 11 corrected against measurement** (see below). Sections 6.1, 6.4, 10.2, and
  10.4 now point at the questions they leave open instead of reading as settled.
- **Corruption law added** to `engine.md` Section 10.4 and `terminal-nexus-lore.md` Section 9,
  resolving the collision between Glitch's identity and the legibility contract.

**Measured findings that changed the specification**

Probed on Linux x64, 2026-08-20. Indicative only — re-measure before citing.

- `@opentui/core@0.5.4` (MIT) publishes an explicit `node` export and **imports cleanly on Node 22**.
  The premise that OpenTUI meant Bun was false; library and runtime are independent choices.
- Its native core ships as **8 prebuilt per-platform packages** in `optionalDependencies`. No Zig
  toolchain is needed to consume it — the "install Zig" note applies to building the monorepo.
- **318 published versions, 141 semver releases** since 2025-08-13, roughly 12 per month. The pre-1.0
  churn risk is real and quantified. The repository has also moved from `sst/` to `anomalyco/`.
- `bun build --compile` produced a **140 MB standalone binary that ran from a clean working
  directory**, so the FFI-plus-standalone-binary risk is largely retired; size is the remaining cost.
  Startup measured ~390-580 ms compiled, ~290 ms via `bun run`.
- `@opentui/core/testing` exports `ManualClock`, `TestRecorder`, and mock keyboard and mouse input —
  a deterministic, TTY-free snapshot harness already exists, which is most of Gate 1A's automated
  acceptance.
- `OptimizedBuffer.setCell(x, y, char, fg, bg, attributes)` maps directly onto `ReadonlyCellFrame`,
  and `CliRenderer` accepts arbitrary streams, which is what makes Gate 1C possible later.

**Tooling changes**

- `scripts/check-repository.sh` rewritten. It previously grepped for the literals
  `**Canon version:** 2.0` and `**Status:** CURRENT — Gate 1A only`, which meant that doing correct
  canon work *broke the build*. Both are now derived from the documents. It also reports all failures
  at once instead of exiting on the first, and prints the canon version and active gate on success.
- The retired-terminology guard now covers the whole repository and understands a `<!-- stale-ok -->`
  exemption, so the concept index can quote what the art actually says.

## Licensing

Code and technical work use Apache-2.0. Lore and creative work use CC BY-SA 4.0. See `README.md`,
`NOTICE`, and `CONTRIBUTING.md` before importing third-party code, art, fiction, fonts, or assets.
