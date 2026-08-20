# Milestone 1 — prove the ASCII battle

**Document role:** Start-here implementation contract
**Status:** CURRENT — Gate 1A only
**Canon version:** 2.0
**Updated:** 2026-08-19
**License:** Apache-2.0; authored creative treatments are CC BY-SA 4.0

## 1. Milestone decision

Milestone 1 asks:

> **Can Terminal Nexus own a reliable terminal surface and use moving symbols to create a battle that is legible, weighty, and intrinsically enjoyable to watch?**

The milestone has two sequential gates:

- **Gate 1A — renderer preflight (CURRENT):** select the first TypeScript runtime/backend using one bounded deterministic fixture.
- **Gate 1B — authored battle reel (GATED):** use the selected path to compare ASCII battle and Commander treatments.

Implement **Gate 1A only**. Stop with a decision report. Gate 1B requires owner acceptance and an explicit status update here.

The first milestone intentionally does not implement combat rules. Gate 1A uses a synthetic cell animation. Gate 1B uses authored scene facts. The deterministic Nexus Pulse kernel begins in Milestone 2.

## 2. Read before coding

Read in this order:

1. [`terminal-nexus-concept.md`](terminal-nexus-concept.md)
2. this document through Gate 1A exclusions and evidence requirements
3. [`engine.md`](engine.md), Sections 1, 2, 10, and 11
4. [`terminal-nexus-lore.md`](terminal-nexus-lore.md), Sections 1 and 9 for symbolic intent
5. [`project-governance.md`](project-governance.md), Sections 2–4
6. repository instructions and existing evidence

Before editing, restate in the evidence report draft:

- the current question;
- the smallest artifact;
- automated evidence;
- owner-observed evidence;
- exclusions and stop conditions.

## 3. Gate 1A — renderer preflight

### 3.1 Decision to earn

> **Which first TypeScript renderer/runtime path can launch fast, own an exact cell frame, animate smoothly, restore the terminal reliably, and distribute credibly without coupling the future simulation to one platform?**

This chooses the first terminal adapter for Gate 1B. It does not choose every future platform or permanently lock the engine language.

Allowed outcomes:

- **PASS — imperative OpenTUI on Bun**
- **PASS — direct ANSI on a named TypeScript runtime**
- **REVISE — exactly one targeted comparator is needed**
- **STOP/BLOCKED — no bounded TypeScript route passes**

Do not begin Gate 1B in the same implementation pass.

### 3.2 Research hypotheses to verify

- **Imperative OpenTUI on Bun leads.** Direct cell buffers, input/mouse/resize, native rendering, custom streams, SSH examples, and Bun executable packaging fit the product.
- **Direct ANSI is the control and portability baseline.** It exposes how much terminal responsibility the project would own.
- **Deno is a credible pure-TypeScript runtime and packager.** Probe it with the ANSI baseline, not an assumed unofficial OpenTUI host.
- **Node is viable but not inherited automatically** from Model Chess Club.
- **Terminal Kit is the TypeScript contingency** if direct ANSI starts recreating a terminal library or OpenTUI fails a library-specific criterion.
- **Ratatui/Crossterm is the native architecture contingency.** Bubble Tea/Wish is the hosted-SSH/distribution contingency. Neither is implemented without a named failure requiring it.

Re-check official documentation before pinning. Never copy a floating or remembered version into the repository.

### 3.3 Shared contract

The fixture owns its data and presentation contracts:

```ts
type CellStyle = Readonly<{
  fgRole?: string
  bgRole?: string
  bold?: boolean
  dim?: boolean
  underline?: boolean
  inverse?: boolean
}>

type Cell = Readonly<{
  glyph: string
  style: CellStyle
}>

type ReadonlyCellFrame = Readonly<{
  width: 80
  height: 24
  cells: readonly Cell[]
}>

interface TerminalBackend {
  start(): Promise<void>
  present(frame: ReadonlyCellFrame): void | Promise<void>
  stop(): Promise<void>
}
```

Names may change; the boundary may not. No OpenTUI, Bun, Deno, Node, ANSI, Rust, or Go object appears in the frame or fixture.

This cell frame is the terminal boundary, not the future universal renderer API. The production engine will emit player-safe semantic views/events; graphical renderers consume those semantics without parsing glyphs.

### 3.4 Shared deterministic fixture

Every attempted backend uses the same authored 80×24 scene:

- bordered 48×18 battlefield inside the future composition;
- at least 25 changing cells in the busiest sample;
- symbols moving between recorded integer tile states;
- one projectile/beam, impact, and color/attribute transition;
- visible presentation clock, frame counter, and synthetic logical-tick counter;
- capability label plus changed-cell and bytes-written diagnostics;
- keyboard commands for pause/resume, step, capability mode, and exit;
- receipt/reporting of mouse input without making mouse necessary.

Recorded logical states use the 12 Hz working hypothesis. Presentation samples at 30 or 60 fps and may interpolate only cosmetic motion/effects. There is no simulation. A timestamp and capability mode produce the same structured frame regardless of backend or physical frame rate.

Effects use absolute presentation time. A slow backend may skip frames without altering a later sampled frame.

### 3.5 Probe A — OpenTUI/Bun

1. Pin exact Bun and `@opentui/core` versions.
2. Use imperative core, not React or Solid.
3. Map `ReadonlyCellFrame` into one full-frame buffer/renderable.
4. Verify alternate screen, cursor, keyboard, mouse receipt, resize, pause/resume, and custom streams where supported.
5. Run 30 fps and 60 fps trials for at least 30 seconds each.
6. Produce a standalone executable for the current target; try only documented cross-target paths and record failures honestly.
7. Exercise normal exit, `q`, `SIGINT`, `SIGTERM`, setup failure, and an injected caught render failure through one idempotent disposer.

Do not adopt OpenTUI layout/widgets simply to showcase them. Terminal Nexus owns the fixed composition; this probe is about backend behavior.

### 3.6 Probe B — direct ANSI baseline

Map the same frame through a deliberately narrow backend supporting:

- alternate screen, cursor, and raw input;
- explicit seven-bit monochrome, 16-color, 256-color, truecolor, and optional Unicode modes;
- previous-frame comparison and changed runs;
- resize and the same disposer cases;
- byte counting around real writes;
- identical structured snapshots before escape encoding.

Run it under Bun and one secondary runtime: prefer Deno; use Node if Deno blocks ordinary terminal input/output or packaging. Produce one self-contained artifact through the selected runtime's documented tooling.

If robust input parsing, mouse, terminal discovery, or output diffing begins becoming a library project, stop and use Terminal Kit as the comparator. Record why.

### 3.7 Remote and browser smoke

For the leading candidate:

1. run the fixture through an ordinary PTY or SSH session;
2. confirm initial dimensions and resize propagation;
3. terminate/disconnect and verify cleanup;
4. record bytes written during idle and busy intervals;
5. connect the ANSI/custom stream to a local xterm.js/WebSocket client, or reproduce the current official adapter example closely enough to identify a precise remaining integration task.

This does not authorize accounts, public endpoints, durable sessions, authentication, matchmaking, TLS deployment, or save recovery.

### 3.8 Conditional comparators

| Comparator | Authorize only when |
| --- | --- |
| Terminal Kit | OpenTUI fails a TypeScript-library criterion or direct ANSI accumulates general TUI responsibilities |
| Ratatui + Crossterm | both TypeScript paths fail cells, lifecycle, packaging, performance, or platform reliability in a way native code plausibly fixes |
| Bubble Tea + Wish | hosted SSH becomes decision-critical and the ordinary PTY/TypeScript path cannot satisfy it |

Any comparator uses the same serialized fixture and evidence. Do not port simulation or content.

### 3.9 Automated acceptance

#### Frame and time

- Every frame is exactly 80×24.
- Every required gameplay glyph has terminal width one.
- Fixed timestamp/mode produces byte-identical structured frames.
- Backend choice does not change frame content.
- Pause freezes presentation time; step advances one 1/60-second sample.
- Synthetic logical states occur every 1/12 simulation second.
- Dropping a render sample does not change later output.

#### Terminal behavior

- One backend sustains 60 fps with ample margin; 30 fps remains a target.
- Resize below 80×24 shows a gate and freezes time; resizing back resumes safely.
- Keyboard and at least one mouse event are observed.
- `q`, `SIGINT`, `SIGTERM`, setup failure, and caught render failure use the same safe disposer.
- Calling the disposer twice is harmless.
- Non-TTY launch prints one readable message and no animation escapes.
- Monochrome ASCII remains legible without color.

#### Packaging and delivery

- At least one frictionless artifact launches on the current desktop target without a project toolchain.
- A tested remote PTY receives input, resize, and output.
- Browser-terminal delivery is demonstrated or reduced to a reproducible official boundary and precise task.

### 3.10 Evidence matrix

Record for each candidate:

- exact runtime, dependency, compiler, OS, and architecture;
- install, development, test, package, and launch commands;
- startup latency and clean-install time;
- median, p95, and worst composition/presentation time;
- requested versus published frames;
- changed cells and bytes for idle, movement, and impact samples;
- idle CPU when measurable honestly;
- package size and target artifacts actually produced;
- keyboard, mouse, resize, non-TTY, and capability results;
- lifecycle result for every exit/failure path;
- adapter size/complexity and workarounds;
- PTY/SSH and browser smoke result;
- unsupported targets labeled measured, documented, or unknown.

Do not call an untested platform supported. Separate measured facts from judgment.

### 3.11 Decision rule and handoff

Prefer the simplest candidate passing product-critical requirements. Speed far beyond ample 60 fps margin is not a reason to rewrite the engine. A larger binary is acceptable if startup is fast and installation is easier. Widget polish is irrelevant unless it removes work Terminal Nexus needs.

The report answers:

1. Which runtime/backend should Gate 1B use?
2. Which measured reason defeated the runner-up?
3. What remains in the game-owned adapter?
4. Which platforms were actually tested?
5. Which future adapter remains viable without affecting current code?
6. Is one conditional comparator required?

Suggested evidence location:

```text
spikes/battle-renderer/
  README.md
  src/
    fixture/
    contract/
    backends/
    input/
    lifecycle/
  tests/
  evidence/
    report.md
    measurements.json
    snapshots/
```

Exact shape is flexible; fixture/contracts are shared and backend setup remains separate.

### 3.12 Gate 1A exclusions

- no combat, targeting, pathfinding, economy, workers, production, or resources;
- no authoritative Nexus Pulse loop or movement-credit rule;
- no Gate 1B storyboard or Commander comparison;
- no campaign, save, progression, balance, AI, multiplayer, or LLM;
- no public mod API, plugin loader, effect DSL, ECS, dependency-injection framework, or universal renderer SDK;
- no production SSH host, browser game, iOS package, pixel renderer, or 3D renderer;
- no Rust/Go migration without a decision outcome authorizing one bounded comparator.

Gate 1A ends after source, tests, pinned commands, snapshots, measurements, smoke notes, known failures, and a **PASS/REVISE/STOP/BLOCKED** report. Update canon only after owner acceptance.

## 4. Gate 1B — authored ASCII battle reel (GATED)

Do not implement this section while Gate 1A is CURRENT.

### 4.1 Question

> **Can moving symbols produce enough anticipation, impact, clarity, and personality that watching a battle is satisfying before real combat exists?**

### 4.2 Deliverable

A 30–45-second non-branching reel driven by hand-authored scene facts, containing:

- simultaneous-looking movement;
- melee hostile-cell claim;
- ranged volley;
- fleeing worker;
- structure assembly;
- building destruction and salvage;
- battlefield Nexus entering critical condition;
- Commander presence, influence, fall, or survival;
- pause, restart, speed, step, glyph/color/treatment, help, and clean exit controls.

The same positions, structures, damage, construction, destruction, outcome, and beat timing appear in four Commander treatments:

1. frontline `@`;
2. support general;
3. Nexus-bound presence;
4. no Commander.

Treatments change presentation only. Frontline `@` is the leading hypothesis, not a required conclusion.

### 4.3 Constraints

- fixed 80×24 frame and 48×18 battlefield;
- one framebuffer composition;
- pure `snapshotAt(timeMs, treatment, capability, reducedMotion)`;
- step advances one 1/30-second quantum while paused;
- resize freezes presentation time;
- authored `ReelEvent`, not a replay schema;
- direct TypeScript effect functions, not a DSL;
- no economy, routing, combat simulation, AI, saves, campaign, or content loader.

### 4.4 Acceptance

Automated evidence covers deterministic structured snapshots, capability modes, resize, controls, cleanup, changed-cell/frame diagnostics, and glyph width.

Owner and fresh-viewer evidence asks whether viewers can identify sides, targets, movement, construction, destruction, the major reversal, and Commander presence without an event log. The sequence must remain understandable in monochrome at 80×24.

Revise or stop if the reel reads as telemetry, color is required for causality, effects obscure targets, Commander treatment monopolizes attention, or terminal fragility defeats quick launch.

## 5. Milestone completion

Milestone 1 passes only after both gates are accepted. Its durable outputs are:

- selected and pinned TypeScript runtime/backend;
- engine-owned structured cell boundary;
- lifecycle and packaging evidence;
- authored battle reel and treatment comparison;
- initial ASCII/effect rules earned from human observation;
- explicit authorization—or refusal—to begin the deterministic Nexus Pulse.
