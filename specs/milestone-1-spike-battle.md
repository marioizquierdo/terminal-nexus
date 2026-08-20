# Milestone 1 — prove the ASCII battle

**Document role:** Start-here implementation contract
**Status:** CURRENT
**Active gate:** 1A — cell frame and lifecycle
**Canon version:** 2.1
**Updated:** 2026-08-20
**License:** Apache-2.0; authored creative treatments are CC BY-SA 4.0

## 1. Milestone decision

Milestone 1 asks:

> **Can Terminal Nexus own a reliable terminal surface and use moving symbols to create a battle that
> is legible, weighty, and intrinsically enjoyable to watch?**

Three gates answer it. Only one is CURRENT at a time.

| Gate | Question | Status |
| --- | --- | --- |
| **1A — cell frame and lifecycle** | Can a TypeScript backend own an exact 80x24 cell frame, animate it smoothly, and always give the terminal back? | **CURRENT** |
| **1B — authored battle reel** | Do moving symbols make a battle worth watching before combat rules exist? | GATED on 1A acceptance |
| **1C — delivery probe** | Can the chosen path ship as one artifact and survive a remote PTY and a browser terminal? | GATED, independent |

Gate 1C does **not** block Gate 1B. It may run before it, after it, or never, depending on what
Mario wants to show people first. Bundling delivery into the renderer decision was the previous
version's largest scope error; see Q6 in [`open-questions.md`](open-questions.md).

Milestone 1 implements no combat rules. Gate 1A animates a synthetic fixture. Gate 1B animates
authored scene facts. The deterministic Nexus Pulse kernel begins in Milestone 2.

## 2. Read before coding

1. [`terminal-nexus-concept.md`](terminal-nexus-concept.md)
2. this document, through the active gate's exclusions
3. [`open-questions.md`](open-questions.md) Section 4 — what is undecided and why
4. [`engine.md`](engine.md) Sections 1, 2, 10, and 11
5. [`terminal-nexus-lore.md`](terminal-nexus-lore.md) Sections 1 and 9, for symbolic intent
6. [`project-governance.md`](project-governance.md) Sections 2-4
7. `AGENTS.md`, then existing source, tests, and evidence

Before editing, open the gate report from
[`templates/gate-report.md`](templates/gate-report.md) and fill in its first section: question,
smallest artifact, automated evidence, owner-observed evidence, exclusions, stop conditions. The
report is written **during** the gate, not after it.

---

## 3. Gate 1A — cell frame and lifecycle (CURRENT)

### 3.1 Decision to earn

> **Which TypeScript terminal backend can own an exact cell frame, animate it at 60 fps without
> tearing or drift, and restore the terminal from every exit path — without coupling the future
> simulation to one library?**

That is the whole question. Not packaging, not SSH, not the browser, not which runtime is
philosophically nicer. Gate 1A chooses the backend that Gate 1B will author against.

Allowed outcomes:

- **PASS — OpenTUI imperative core**, on a named and pinned runtime
- **PASS — direct ANSI**, on a named and pinned runtime
- **REVISE — exactly one named comparator is needed**, with the criterion it must satisfy
- **STOP / BLOCKED — no bounded TypeScript route owns a reliable cell frame**

Do not begin Gate 1B or Gate 1C in the same pass.

### 3.2 Prior findings — verify, do not trust

These were measured on 2026-08-20 inside a Linux x64 Claude Code container. They are **indicative,
not gate evidence**: single cold samples on shared hardware, no TTY attached. Re-measure everything
you intend to cite, and treat any disagreement with these numbers as the interesting result.

| Finding | Measured | Why it matters |
| --- | --- | --- |
| `@opentui/core@0.5.4`, MIT, published 2026-08-18 | registry metadata | Current pin candidate |
| **318 published versions, 141 semver releases since 2025-08-13** | registry metadata | ~12 releases/month. Pre-1.0 churn is real and large. Pin exactly; expect to re-pin |
| Repository is `anomalyco/opentui`; older references point at `sst/opentui` | search results | The project has moved once already. Verify the canonical repo before citing it |
| **OpenTUI exposes a `node` export and imports cleanly on Node 22.22.2** | `node --experimental-strip-types` | The old "OpenTUI means Bun" premise is false. Library and runtime are **independent axes** |
| Native core ships as 8 prebuilt platform packages in `optionalDependencies` | registry metadata | No Zig toolchain needed to consume. The "must have Zig installed" note applies to building the monorepo |
| `bun add @opentui/core` resolved in 1.53 s; `node_modules` 84 MB; `libopentui.so` 21 MB | local install | Heavy for a game that draws characters. Worth knowing, not disqualifying |
| `bun build --compile` produced a 140 MB binary that ran from a clean working directory | local build | The FFI-plus-standalone-binary risk is **largely retired**. Size is the open cost |
| Startup: compiled binary ~390-580 ms; `bun run` ~290 ms | 5 samples each | Under the "launches almost instantly" bar, but not by much. Measure properly on real hardware |
| `@opentui/core/testing` exports `ManualClock`, `TestRecorder`, `RecordedFrame`, mock keys and mouse | type definitions | A deterministic, TTY-free snapshot harness already exists. Most of Section 3.7 may be assembled rather than written |
| `OptimizedBuffer.setCell(x, y, char, fg, bg, attributes)` | type definitions | `ReadonlyCellFrame` maps to a direct `setCell` loop. The boundary in Section 3.4 is achievable as written |
| `CliRenderer(stdin, stdout, width, height, config)` accepts arbitrary streams | type definitions | The custom-stream hypothesis holds, which is what makes Gate 1C possible later |
| Bun 1.3.11 and Node 22.22.2 are present in the Claude Code web container; **Deno is not** | `command -v` | A Deno probe costs an install in every session |

### 3.3 Hypotheses to test

- **OpenTUI's imperative core leads**, because `setCell`, mouse, resize, arbitrary streams, and a
  testing harness are already there. Its risks are churn and weight, not capability.
- **Direct ANSI is the control.** It measures how much terminal responsibility the project would own
  if it took OpenTUI's job back. It is a real candidate, not a formality.
- **Runtime is a separate choice.** Probe Bun first because it is present, fast, and packages
  directly. Node is the portability check. **Deno is dropped from this gate** — it is not installed
  in the working environment and no measured requirement currently needs it.
- **Terminal Kit is the contingency** if direct ANSI starts becoming a terminal library.
- **Ratatui/Crossterm and Bubble Tea/Wish stay unimplemented** unless a named TypeScript failure
  requires one.

Re-check official documentation before pinning. Never copy a remembered or floating version.

### 3.4 The boundary

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
  width: number
  height: number
  cells: readonly Cell[]
}>

interface TerminalBackend {
  start(): Promise<void>
  present(frame: ReadonlyCellFrame): void | Promise<void>
  stop(): Promise<void>
}
```

Names may change; the boundary may not. **No OpenTUI, Bun, Node, ANSI, Rust, or Go value may appear
in a frame, a cell, or the fixture.** If a backend needs something the boundary does not carry, that
is a finding — write it down rather than widening `Cell`.

Style carries **roles**, not colours. `fgRole: "faction.citizen"` is legal; `fgRole: "#ff8800"` is
not. Role-to-colour resolution belongs to the capability mode, which is what makes monochrome a
setting rather than a rewrite.

This cell frame is the terminal boundary, not the future universal renderer API. The production
engine will emit player-safe semantic views and events; graphical renderers consume those semantics
without parsing glyphs.

### 3.5 The shared fixture

Every backend renders the same authored scene, from the same code, through the same boundary.

**Composition.** A bordered 48x18 battlefield inside an 80x24 frame, plus a right sidebar, a header,
and a control footer — the layout the concept art shows, at the scale canon locks.

**Tile width is a fixture parameter with values 1 and 2.** At width 1 the frame is 80x24. At width 2
the same battlefield needs roughly 128x24 and the fixture must say so and render it. This is how
Q1 in [`open-questions.md`](open-questions.md) gets answered: Mario looks at both and picks, instead
of the two of us arguing about column budgets. Both widths must produce the same *semantic* content
— identical actors on identical tiles — differing only in composition.

**Content**, at either width:

- symbols moving between recorded integer tile positions;
- at least 25 changed cells in the busiest sample;
- one ranged attack: telegraph, travel, impact;
- one colour or attribute transition tied to a state change, not to a timer;
- a visible presentation clock, frame counter, and synthetic logical-tick counter;
- a capability label plus changed-cell and bytes-written diagnostics;
- keys for pause, resume, step, tile width, capability mode, and quit;
- receipt and display of one mouse event, without making the mouse necessary.

**Time.** Recorded logical states use the 12 Hz working hypothesis. Presentation samples at 30 or
60 fps and may interpolate cosmetic motion only. There is no simulation. A given timestamp,
capability mode, and tile width produce the same structured frame on every backend, at every
physical frame rate. Effects sample absolute presentation time, so a backend that drops frames still
produces the correct later frame.

### 3.6 The two probes

**Probe A — OpenTUI imperative core.** Pin exact versions. Use the imperative core; not React, not
Solid, not the layout system. Terminal Nexus owns its composition — this probe is about backend
behaviour, not widgets. Map `ReadonlyCellFrame` into one buffer via `setCell`. Run on Bun; then
confirm the same fixture imports and renders on Node, or record exactly how it fails.

**Probe B — direct ANSI.** Map the same frame through a deliberately narrow backend: alternate
screen, cursor control, raw input, previous-frame diffing with changed runs, byte counting around
real writes, and explicit monochrome / 16-colour / 256-colour / truecolor modes. Same runtimes, same
fixture, same snapshots before escape encoding.

**Stop condition for Probe B:** if it starts needing robust input parsing, terminal capability
discovery, or mouse decoding, **stop and record it**. That is the measurement — it means the project
would be writing a terminal library — and it is the trigger for the Terminal Kit comparator.

### 3.7 Automated acceptance

Every item is a test that fails loudly, not a thing you looked at once.

**Frame and time**

- every frame is exactly the composition's declared size, at both tile widths;
- every gameplay glyph has terminal width one;
- a fixed `(timestamp, capability, tileWidth)` produces byte-identical structured frames;
- **backend choice does not change frame content** — Probe A and Probe B snapshots are equal;
- pause freezes presentation time; step advances exactly one 1/60 s sample;
- synthetic logical states occur every 1/12 simulation second;
- dropping render samples does not change any later frame.

**Terminal behaviour**

- one backend sustains 60 fps with ample margin over a 30 s run; 30 fps is the floor;
- resize below the minimum shows a gate and freezes presentation time; resizing back resumes from
  the same presentation time;
- at least one keyboard event and one mouse event are observed and reported;
- `q`, `SIGINT`, `SIGTERM`, setup failure, and an injected caught render failure all run the **same**
  disposer;
- calling the disposer twice is harmless;
- non-TTY launch prints one readable line and emits no escape sequences;
- monochrome ASCII remains legible with colour fully disabled.

The lifecycle cases are the ones that matter most. A renderer that drops two frames per minute is a
tuning problem; a renderer that leaves Mario's terminal in raw mode with a hidden cursor is a reason
to reject it.

### 3.8 Evidence to record

Per candidate, and no more than this:

- exact runtime, dependency, OS, and architecture versions;
- install, dev, test, and launch commands, copy-pasteable;
- startup latency and clean-install time;
- median, p95, and worst composition and presentation times;
- requested versus published frames over the 30 s run;
- changed cells and bytes written for idle, movement, and impact samples;
- adapter size in lines, and every workaround it needed;
- result of each lifecycle and capability case;
- anything that surprised you.

Separate measured facts from judgement. Do not call an untested platform supported.

### 3.9 Decision rule

Prefer the **simplest** candidate that owns the frame and always restores the terminal. Speed beyond
comfortable 60 fps is not a reason to choose anything. Widget polish is irrelevant unless it removes
work Terminal Nexus would otherwise do. Dependency weight matters only where it costs startup or
reliability.

The report answers:

1. Which backend and runtime should Gate 1B author against?
2. Which measured fact defeated the runner-up?
3. What is left in the game-owned adapter, in lines and in responsibilities?
4. Which platforms were actually tested, and which are unknown?
5. Which future adapter stays viable without changing current code?
6. Is a conditional comparator required, and against which criterion?
7. Which tile width does the fixture argue for, and what did Mario see?

### 3.10 Suggested layout

```text
spikes/battle-renderer/
  README.md
  src/
    contract/      cell frame, backend interface, capability modes
    fixture/       the authored scene, parameterised by tile width
    backends/
      opentui/
      ansi/
    input/
    lifecycle/     the one disposer
  tests/
  evidence/
    report.md
    measurements.json
    snapshots/
```

Shape is flexible. Contract and fixture are shared; backends stay separate and know nothing about
each other.

### 3.11 Exclusions

- no combat, targeting, pathfinding, economy, workers, production, or resources;
- no authoritative Pulse loop or movement-credit rule;
- no Gate 1B storyboard or Commander comparison;
- no packaging, standalone binary, SSH, PTY, or browser work — that is Gate 1C;
- no campaign, save, progression, balance, AI, multiplayer, or LLM;
- no mod API, plugin loader, effect DSL, ECS, DI framework, or universal renderer SDK;
- no Rust or Go migration.

### 3.12 Definition of done

Gate 1A is complete when **all** of these are true, and not before:

- [ ] both probes render the shared fixture through the same boundary;
- [ ] every check in Section 3.7 exists as an automated test and passes;
- [ ] Probe A and Probe B produce identical structured snapshots;
- [ ] the fixture runs at both tile widths and both are captured for Mario;
- [ ] `./scripts/check-repository.sh` passes;
- [ ] `evidence/report.md` is filled in from
      [`templates/gate-report.md`](templates/gate-report.md) and ends with one of
      **PASS / REVISE / STOP / BLOCKED**;
- [ ] every command in the report has been run verbatim from a clean checkout;
- [ ] new questions raised are rows in [`open-questions.md`](open-questions.md), each with a
      recommendation.

Then **stop.** Do not update canon; that happens after Mario accepts. Do not start Gate 1B because
time remains — Gate 1B's whole value is that it is authored against a backend that is already known
to work.

---

## 4. Gate 1B — authored ASCII battle reel (GATED)

Do not implement while Gate 1A is the active gate.

### 4.1 Question

> **Can moving symbols produce enough anticipation, impact, clarity, and personality that watching a
> battle is satisfying before real combat exists?**

### 4.2 Deliverable

A 30-45 second non-branching reel driven by hand-authored scene facts, containing:

- simultaneous-looking movement;
- a melee hostile-cell claim;
- a ranged volley;
- a fleeing worker;
- structure assembly;
- building destruction and salvage;
- a battlefield Nexus entering critical condition;
- Commander presence, influence, fall, or survival;
- pause, restart, speed, step, glyph and colour treatment, help, and clean exit.

The same positions, structures, damage, construction, destruction, outcome, and beat timing appear
in four Commander treatments:

1. frontline `@`;
2. support general;
3. Nexus-bound presence;
4. no Commander.

Treatments change presentation only. Frontline `@` is the leading hypothesis, not a conclusion.

### 4.3 Constraints

- the composition and tile width Gate 1A selected;
- one framebuffer composition;
- a pure `snapshotAt(timeMs, treatment, capability, tileWidth, reducedMotion)`;
- step advances one 1/30 s quantum while paused;
- resize freezes presentation time;
- authored `ReelEvent` values, not a replay schema;
- direct TypeScript effect functions, not a DSL;
- no economy, routing, combat simulation, AI, saves, campaign, or content loader.

### 4.4 Acceptance

Automated evidence covers deterministic snapshots, capability modes, resize, controls, cleanup,
changed-cell diagnostics, and glyph width.

Human evidence is the point of this gate and cannot be automated. Show the reel to **at least one
person who has never seen it** and ask them to narrate what happened. They should identify sides,
targets, movement, construction, destruction, the major reversal, and Commander presence **without
an event log and without a legend**. The reel must survive monochrome.

Revise or stop if the reel reads as telemetry, if colour is required for causality, if effects
obscure their own targets, if the Commander treatment monopolises attention, or if terminal
fragility defeats a quick launch.

---

## 5. Gate 1C — delivery probe (GATED, independent)

Does not block Gate 1B. Authorize when Mario wants Terminal Nexus running somewhere other than the
machine that built it.

### 5.1 Question

> **Can the selected path ship as one frictionless artifact, and survive an ordinary remote PTY and a
> browser terminal, without changing the fixture?**

### 5.2 Deliverable

1. One artifact that launches on the current desktop target with no project toolchain installed.
   Record size, startup latency, and the exact build command. Try only documented cross-target paths
   and record failures honestly.
2. The fixture through an ordinary PTY or SSH session: initial dimensions, resize propagation,
   disconnect cleanup, and bytes written during idle and busy intervals.
3. The fixture's output stream connected to a local xterm.js client over a WebSocket — or, if that
   blocks, a reproduction of the current official adapter example reduced to **one precisely named
   remaining integration task**.

### 5.3 Exclusions

No accounts, public endpoints, durable sessions, authentication, matchmaking, TLS deployment, save
recovery, or anything that would make this a service. This gate proves the pipe exists. It does not
open it.

---

## 6. Milestone completion

Milestone 1 passes when Gates 1A and 1B are both accepted. Gate 1C is optional to the milestone and
mandatory before anyone else is invited to run the game. Durable outputs:

- a selected and pinned TypeScript backend and runtime;
- the engine-owned structured cell boundary;
- lifecycle evidence covering every exit path;
- an authored battle reel and its treatment comparison;
- initial ASCII and effect rules earned from human observation, promoted into
  [`terminal-nexus-lore.md`](terminal-nexus-lore.md) Section 9;
- an answer to Q1 and Q3 in [`open-questions.md`](open-questions.md);
- explicit authorization — or refusal — to begin the deterministic Nexus Pulse.
