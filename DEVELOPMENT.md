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

The current implementation contract is whichever file `milestones/README.md` marks **CURRENT**, through
its own **Active gate**. Milestone 1 (Grid Battles) is complete and accepted; the campaign's first
level is being built across the milestones after it. `./scripts/check-repository.sh` prints the
current gate, so it is faster than reading for it.

## Current commands

### Repository validation

```bash
./scripts/check-repository.sh
```

This is the project's only automated feedback loop until a runtime is selected. It checks
invariants, not literals — canon version and current gate are derived from the documents, so
correct canon work never breaks it. What it enforces:

- required files exist;
- every document under `specs/` and `concept/` declares the same canon version as `specs/README.md`,
  and so does `AGENTS.md`;
- every such document carries `Document role`, `Status`, `Canon version`, `Updated`, `License` —
  **except a document named in `check-repository.sh`'s `historical_archives` list**, a frozen record
  nothing may depend on. It still owes its links, but not the metadata header or the canon version,
  and it is exempt from the terminology scan below, because an archive edited to use today's words
  stops being a record of what was actually said;
- exactly one milestone is `CURRENT`, declares an `Active gate`, and matches the governance ledger;
- every `Q<n>` referenced anywhere is defined in `specs/open-questions.md`, and every `OPEN` question
  carries a recommendation;
- retired terminology stays retired — mark a line `<!-- stale-ok -->` to quote it deliberately;
- `.devcontainer/devcontainer.json` parses, local Markdown links resolve, code fences balance, and
  the working tree has no whitespace errors.

Add a check here whenever you find yourself remembering a rule instead of relying on one.

### Install, build, test, run

Gate 1A selected the toolchain. There is **no build step**: Node 22.18+ and Bun 1.3+ both execute
the TypeScript sources directly, so relative imports carry explicit `.ts` extensions and the code
stays inside erasable-syntax TypeScript (no enums, no parameter properties). `tsconfig.json` is for
type checking and editors only.

```bash
# install (type checking and the OpenTUI backend; the kernel itself has no runtime dependency)
npm install

# there is no build step

# test
npm test            # Node's runner over tests/*.test.ts
npm run test:bun    # the same suite under Bun, one file at a time
npm run typecheck   # tsc --noEmit

# run — <map> is a .map.json path, suffix optional; no subcommand, watch is the default action
./bin/grid.ts scenarios/citizen-mirror-skirmish                              # watch (the default)
./bin/grid.ts scenarios/citizens-versus-ravels --glyphs unicode --capability truecolor
./bin/grid.ts scenarios/ravel-cascade --capability monochrome --reduced-motion
./bin/grid.ts scenarios/citizens-versus-ravels --no-effects
./bin/grid.ts scenarios/citizen-mirror-skirmish --headless --log-level debug --ticks 120
./bin/grid.ts scenarios/citizen-mirror-skirmish --headless --events events.jsonl --json
./bin/grid.ts scenarios/citizen-mirror-skirmish --verify                    # 10 runs by default
./bin/grid.ts scenarios/citizen-mirror-skirmish --verify --runs 20
./bin/grid.ts scenarios/citizen-mirror-skirmish --headless --turn 90        # jump straight to tick 90

# the same commands under Bun
bun bin/grid.ts scenarios/citizen-mirror-skirmish --headless
```

Pinned by Gate 1A, measured 2026-08-21:

| | Version | Note |
| --- | --- | --- |
| Node.js | 22.22.2 | Runs TypeScript with no build step from 22.18 |
| Bun | 1.3.11 | Same sources, same hashes |
| `typescript` | 7.0.2 | Type checking only |
| `@types/node` | 22.20.1 | Type checking only |
| `@opentui/core` | 0.5.6 | Terminal backend. **Native core loads under Bun, not under Node** |

`watch` options: `--capability monochrome|color16|color256|truecolor`, `--theme dark|light`,
`--glyphs ascii|unicode`, `--tile-width 1|2`, `--no-effects`, `--reduced-motion`,
`--cosmetic-seed`, `--speed`, `--backend`. ASCII and monochrome are the defaults and the
acceptance floor; everything above them is fidelity, never information. `--capability` defaults
to the best tier `COLORTERM`/`TERM` advertise rather than always `color16` (owner playtest: a
terminal that can do more was still getting the tier most exposed to a terminal theme's own,
inconsistently defined colours). `--theme` defaults to `dark` — the palette the lore and every
screenshot are designed against — and `light` is one flag away for a light terminal background.

`bun test` drives one file at a time (`./scripts/run-tests.sh bun`): its `node:test` shim rejects a
test registered while another file's tests are still running, and it does not implement `t.skip()`.
Node's runner isolates each file and takes the whole glob at once.

**Bun enforces a 5000ms default per-test timeout that Node's runner does not.** Any test whose cost
scales with the fixture count — `for (const name of scenarioFiles())`, N runs each — silently
approaches that ceiling as scenarios are added and eventually times out under Bun with no equivalent
warning under Node. This has happened twice already (`tests/cli.test.ts`'s `verify --runs 20`,
`tests/determinism.test.ts`'s twenty-runs-of-every-scenario check). The fix each time was the same:
give the test an explicit `{ timeout: 120_000 }` (`test(name, { timeout }, fn)`, third-argument form,
works identically under Node). **Before adding a new scenario file, run `./scripts/run-tests.sh bun`
once** — not just `npm test` — since this class of failure is Bun-only and easy to miss.

### Screenshots of the real terminal

```bash
node scripts/capture-screenshots.mjs              # all of them
node scripts/capture-screenshots.mjs --only mirror-melee
```

It drives `grid` (watch, the default action) inside a tmux pseudo-terminal — a real PTY, so the ANSI backend takes
the same path a person gets — pauses it, steps to an exact tick, captures the pane with its escape
sequences, and renders it to a PNG in `evidence/screenshots/` through the Chromium already present
for Playwright. Use it when a change touches the composition: a frame's *text* is what the tests
assert on, and it says nothing about spacing, density, or where the eye goes.

Requires `tmux` and the browser at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Editing the
`shots` array at the top of the script is how you add a frame worth looking at.

### The log is the feedback loop

`grid --headless` writes fixed-column lines to one stream (stdout), which is what lets an agent
assert on behaviour without parsing prose:

```text
[tick] LEVEL kind subject [-> object] detail...
```

Levels are `ERROR`, `WARN` (default), `INFO`, `DEBUG`, `TRACE`. `INFO` is the story — spawns, first
engagements, every attack that landed, deaths, structures destroyed, victory; `WARN` is anomalies
plus a closing `report` line carrying the outcome, losses, and hashes, so a bare `--headless` run
still ends with the answer even at the default level. It grows by adding kinds, never by reshaping
columns. `--save-log <file>` writes the same lines to a file, in any action (`watch` included). When
a test needs structure rather than a story, assert on `--events` JSONL instead.

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

Human-readable history of the development setup. Product and canon history lives in
`specs/project-governance.md` Section 6.

### 2026-08-21 — Milestone 1 built: the Pulse Playground (canon 2.6)

The repository has code. Node 22.18+ and Bun 1.3+ run the TypeScript sources with **no build step**,
so relative imports carry explicit `.ts` extensions and the code stays inside erasable-syntax
TypeScript — no enums, no parameter properties. `tsconfig.json` is for type checking and editors.

New commands:

```bash
npm run play           # watch Citizens versus Ravels, colour, Unicode, effects on
npm run play:cascade   # the Ravel fuel-dump chain, at half speed
npm run play:plain     # the same fight with effects off
npm run play:mono      # monochrome, the acceptance floor
npm run scenarios      # list all seventeen

npm test               # 122 tests under Node's runner
npm run test:bun       # the same files under Bun, one at a time
npm run typecheck      # tsc --noEmit

./bin/playground.ts run|watch|verify <scenario>
node scripts/capture-screenshots.mjs      # drives a real PTY and renders PNGs
node scripts/capture-frames.mjs <id> ...  # plain-text frames
```

Things worth knowing before touching this:

- **`bun test` is driven one file at a time** by `scripts/run-tests.sh`. Its `node:test` shim rejects
  a test registered while another file's tests are still running, and it does not implement
  `t.skip()`, so runtime-specific tests are registered conditionally instead.
- **`src/pulse` may not import `src/view`, and `src/report` may not import `src/pulse`.**
  `tests/architecture.test.ts` walks the transitive import graph and fails the build on either.
- **The kernel touches no clock and no `Math.random`** — asserted both statically and by trapping
  them during a resolve.
- **Screenshots need tmux and Chromium**, both present in the web container. See the
  `grid-screenshots` skill (renamed from `playground-screenshots` since this entry was written).
- `@opentui/core` is pinned at 0.5.6 and its **native core only loads under Bun**; the direct-ANSI
  backend carries Node and passes the whole lifecycle suite.

### 2026-08-21 — execution-readiness audit (canon 2.5)

The canon read as a contract an isolated session has to execute, rather than as a design document.
Full findings, including the ones deliberately *not* acted on, are in
`docs/spec-audit-2026-08-21.md`.

**Tooling**

- The validator now checks `AGENTS.md`'s canon version against `specs/README.md`. `AGENTS.md`
  Section 4 restates ~20 canon invariants as a summary; it carried no version, so a canon bump could
  leave it stale with nothing to notice. It now has one, and forgetting it fails the build.
- The fix that suggested itself and was **not** taken: teaching the validator to verify `engine.md`
  section *numbers* in cross-references. Numbers move on every restructure. The cheaper convention is
  to cite a section by name as well — `engine.md §9.4 "Bands"` — so that a grep survives renumbering.
  Worth doing when the next renumbering happens, not before.

### 2026-08-20 — viewport and playground pass (canon 2.3)

Corrections from Mario after the 2.2 pass, plus the shape of the first spike.

**Viewport, screen sizes, and scrolling — now formalised**

- The viewport is measured in tiles and clamped to **48 x 16 minimum, 72 x 24 maximum**. The minimum
  is the floor below which the renderer gates; the maximum exists so a huge display cannot show
  meaningfully more Grid than a laptop, and so every layout calculation has a bound. Space beyond the
  maximum goes to centring and a larger inspection panel, never to more Grid.
- Terminal sizes fall out: **80 x 24** for the minimum viewport at one column per tile, 104 x 28 for
  the maximum; 128 x 24 and 176 x 28 at two columns. 80 x 24 stays the acceptance target.
- **Scrolling is cursor-driven.** Move the cursor within 3 tiles of a viewport edge and the camera
  follows. No pan mode, no modifiers, no second cursor, and no minimap. The UI must show there is more
  Grid, so edge markers on the frame and a footer position readout are both required.
- Small and medium presets fit the minimum viewport entirely, so tutorials and opening missions can
  introduce the game without a player ever learning to scroll.

**Layers were wrong, and are now right**

The 2.2 pass made "collisions resolve within a layer, never across" a hard rule. That is not what
layers are for. Corrected:

- **Layers define render order. That is the only hard rule.** Beyond that they organise assets.
- **Collision is a query**, not a layer property: a `CollisionMask` is composed from a chosen set of
  layers plus a predicate. A ground unit's movement mask includes `obstacles` and `units` but not
  `workers`, which is *why* a worker and a soldier can share a tile — and why a unit is still blocked
  by a building on a different layer. Both fall out of one mechanism instead of two rules.
- Different questions compose different masks: movement, placement, and targeting each want their own.

**Units can be large**

Settled directly (Q3): units as well as structures may span multiple tiles, and it matters
strategically. A Ravel raider drawn `>x<` is one unit occupying three tiles. A mover tests its **whole
footprint** against its mask; damage and destruction apply to the entity, not the tile. The Gate 1A
fixture now includes a 3 x 1 hauler specifically to break a collision system written for one-tile
actors while that is still cheap to find out.

**Authority markers reduced to two**

**RULE** and **GUIDANCE**. `UNPROVEN` folded into GUIDANCE — sections that describe something not yet
designed say so in their own words, which was doing the work anyway.

**Milestone 1 is the Pulse Playground**

Reshaped again, and better. The headless run and the ASCII view are built **together**, not as
separate gates: the headless run is how an agent iterates, the view is how Mario tells whether any of
it is good, and each catches what the other hides. Gate 1A uses a small Grid that fits the viewport,
so selection and scrolling are out of scope entirely. Gate 1B adds render tiers and effects.

The Playground is **foundation, not spike residue** — it is the bench every future unit gets tested
on, so the code quality bar is higher than "spike."

**The report is the feedback loop**

The Playground's most important feature for autonomous work: a **levelled log on stderr** (default
`INFO`) in fixed, greppable columns, and a **summary on stdout** with the outcome and hashes.
`playground run x.ts > report.txt 2> run.log` splits them. `INFO` carries the story — spawns,
engagements, attacks that landed, deaths, destruction, victory — so an agent can assert on behaviour
without parsing prose, and a designer can read what happened. `DEBUG` carries per-tick decisions,
`TRACE` carries everything.

**Concept folder simplified**

The delta tables added in 2.2 were over-engineering an early sketch. Reduced to what is worth keeping
from each piece, plus a note that the real visual concept comes from the Playground.

### 2026-08-20 — design-authority pass (canon 2.2)

A second pass after Mario clarified the shape of the engine and refocused the first spike.

**Terminology**

- The play surface is now **the Grid**, everywhere. The replica standing on it is a **Grid Nexus**;
  the one that stays home is a **Prime Nexus**. The retired word is rejected by the validator.

**The Grid became a real model rather than a number**

- Size and shape presets: `small`/`medium`/`large`/`extra-large` against
  `squared`/`wide`/`extra-wide`, twelve in all. `medium-extra-wide` (48 x 16) is the default, and the
  arithmetic is not a coincidence — at one column per tile it is exactly 80 columns with a sidebar,
  and at two columns exactly 128.
- **Orientation is a rendering choice.** Portrait and landscape change no coordinate and no rule.
- **Five layers** — terrain, obstacles, workers, units, air — with one occupancy law: collisions
  resolve *within* a layer, never across. That single rule is what makes a worker and a soldier
  sharing a tile a legal transient state rather than an edge case to arbitrate, and it maps straight
  onto the render bands.
- **Anchor, footprint, and facing** on every entity. Multi-tile is first-class from day one, because
  a footprint loop written now costs nothing and retrofitted later costs a week. Range measures to
  the nearest occupied tile. Facing is presentation-only for now (Q9).

**Authority markers**

Every section of `engine.md` now declares **LAW**, **GUIDANCE**, or **UNPROVEN**, with a legend in
`specs/README.md`. Most of the design canon is GUIDANCE — a recommendation written before the thing
existed, so a session facing a fork has better than a coin flip. The rule that makes it work:
*descriptive completeness is not authorization.*

**Milestone 1 refocused onto the Pulse**

The old plan proved a renderer first and simulated later. That is backwards for this game: an
authored reel can tell you whether a hand-tuned sequence looks good, but not whether *emergent
simulated combat* is legible — which is the actual product risk. The milestone is now three gates,
each producing something runnable:

- **1A — headless Pulse.** Grid, layers, scenario files, deterministic tick loop, a mirror Citizen
  skirmish. No terminal at all. `pulse run` prints a hash.
- **1B — watch the Pulse.** Cell frame, bands, composition, playback, lifecycle. Renders a kernel
  already known to be correct. The backend is *chosen* (OpenTUI, on the measurements) rather than
  competed for in a gate of its own.
- **1C — make it hit.** The effect vocabulary, evaluated by fresh viewers with effects on and off.

**Packaging, standalone binaries, SSH, PTY, and browser delivery are deferred out of the milestone
entirely.** They answer no question the game currently has.

**New: `specs/ascii-effects.md`**

The particle system, formalised: the pure `EffectRecipe` contract (absolute time in, sparse cells
out, `f(t)` never depending on `f(t-1)`), the beat structure, the craft rules, and a ten-effect
starter vocabulary. Every effect owes three forms — full, reduced-motion, monochrome — authored
together, never in a later accessibility pass. Gate 1C is the spike that proves or discards it.

**Tooling**

- The retired-terminology guard now covers the Grid rename.
- `specs/ascii-effects.md` is a required file.


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
- **`concept/README.md` added** — index of the concept folder: the early art, the real screenshots
  that replaced it, and the archived original specification.
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
