# Gate report — Milestone 3, Gate 3A: the menu and the three adapters

**Document role:** Gate evidence report for Gate 3A
**Status:** BUILT — Section 8 concludes PASS on every automated check; owner review is outstanding
**Canon version:** 2.16
**Updated:** 2026-09-13
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.16.
- **Milestone and gate:** Milestone 3 — Game Menu; Gate 3A (the menu and the three adapters).
- **Question this gate answers:** Can a player launch `terminal-nexus` and navigate a top-level menu
  through keyboard, mouse, and a scripted driver, with every option's hotkey actually displayed and
  provably equivalent across all three input paths — the smallest screen that exercises the whole
  input model of [`engine.md`](../specs/engine.md) Section 9.7?
- **Smallest artifact that can answer it:**
  - `bin/terminal-nexus.ts`, a second entry point beside `bin/grid.ts`, built on the same
    `TerminalBackend`/`ReadonlyCellFrame`/band-compositor/capability-and-theme stack — no second
    presentation system;
  - one small, reusable "menu list" shape (`src/menu/`): items with a stable id, a displayed hotkey,
    and a label; a pure reducer over highlight/activate/quit commands;
  - the keyboard adapter (raw key to command), the mouse adapter (raw SGR mouse click to command,
    geometry owned only there), and the driver (raw bytes or direct commands into the same real
    adapters, frame read back) — three producers of one `MenuCommand` vocabulary;
  - the shared idempotent disposer, extracted out of `src/cli/watch.ts` into `src/cli/lifecycle.ts` so
    `grid watch` and `terminal-nexus`'s menu both build on the one implementation, not two that
    happen to look alike;
  - four menu items — Campaign, Challenge, Settings, Exit — with Campaign/Challenge/Settings stubbed
    honestly (a plain "not built yet" notice naming the milestone that builds it) and Exit real,
    because 3B (Settings) and 3C (mode select and handoffs) are explicitly out of scope for 3A.
- **Automated evidence planned:**
  - a pure-reducer test proving keyboard navigation moves the highlight correctly at every list
    length, including one item;
  - the sharp-edge equivalence test: for every item, derive the raw key from the item's own displayed
    hotkey text and the raw mouse click from the item's own rendered screen position (not from the
    adapter's internal constants), feed both into the real keyboard and mouse adapters, and prove all
    three (keyboard, mouse, and Enter-on-the-highlighted-item) resolve to the identical named
    `MenuCommand` — asserting only at the command layer would prove nothing per the milestone's own
    instruction;
  - a lifecycle test (the `tests/lifecycle.test.ts` fake-stdin pattern) proving `q`, an interrupt
    byte, `SIGINT`, and `SIGTERM` all reach the same disposer exactly once, that a second `dispose()`
    call is harmless, and that mouse reporting is switched off on every exit path alongside raw mode;
  - a render test at all four capability tiers and monochrome, asserting every glyph is one column
    (`offendingGlyph`) and that monochrome emits no colour code;
  - a CLI smoke test (subprocess, mirroring `tests/cli.test.ts`) proving a non-TTY launch prints one
    line and no escape sequences, per engine.md 10.1;
  - the existing suite (`npm test`, `npm run test:bun`) staying green, since `watch.ts` is refactored,
    not rewritten.
- **Human observation planned:** none planned as a blocking requirement for 3A specifically — the
  milestone's own acceptance criteria for this gate are all mechanically checkable (hotkeys displayed,
  three adapters equivalent, capability tiers render, disposer idempotent). A screenshot is produced
  as supporting evidence anyway, since Mario reads screenshots as part of every gate; whether the menu
  *looks* right is explicitly deferred to 3C once Campaign/Challenge have real destinations to show
  rather than a stub notice.
- **Explicit exclusions:** Settings as an interactive screen (3B); Campaign/Challenge real handoffs
  and "disabled with reason" polish (3C); any save/progression format; persisted settings; a
  file-based script format for the driver (the driver exists as a programmatic API a test or a future
  agent script calls directly — reading a script *file* is not built, since nothing yet needs it);
  scroll-wheel and right-click mouse gestures (no camera or cancel target exists on a flat menu); a
  help overlay (`?`) and Esc handling beyond a no-op at the top level (nothing to back out of yet).
- **Stop conditions:** if the input model itself (one command vocabulary, three equivalent adapters)
  turns out not to fit a plain vertical list — for example if mouse geometry cannot be made to agree
  with keyboard-driven layout without per-backend special-casing — that is a finding to register and
  stop on, not a reason to fork the vocabulary per adapter.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux (container), x86_64 |
| Runtime and exact version | Node v22.22.2; Bun 1.3.11 |
| Dependencies and exact versions | `@opentui/core@0.5.6`, `typescript@7.0.2`, `@types/node@22.20.1` (from `package.json`/`package-lock.json`, unchanged by this gate) |
| Hardware, if it affects measurements | Not applicable — no performance measurement in this gate |
| Date measured | 2026-09-13 |

Commands, copy-pasteable, in the order a stranger would run them:

```bash
# install
npm ci

# build
# there is no build step — Node and Bun both run the TypeScript sources directly

# typecheck
npm run typecheck

# test
npm test
npm run test:bun

# run
./bin/terminal-nexus.ts
node bin/terminal-nexus.ts --capability truecolor --theme dark
./scripts/check-repository.sh
```

## 3. What was built

**The pure menu core, `src/menu/`** — no stdin, no ANSI, no backend, no `src/view` import:

- `types.ts` — `MenuItem` (`id`, `hotkey`, `label`) and `MenuCommand`, the one vocabulary
  (`highlight`, `activate`, `quit`) all three adapters produce.
- `list.ts` — `MenuListState`, `createMenuList`, `moveHighlight` (wraps at both ends; degrades
  correctly to "always stays put" on a one-item list), and the pure reducer `applyMenuCommand`.
- `layout.ts` — `MenuLayout`, `menuItemLabel` (`[1] Campaign`), `menuItemRow`, and `menuIndexAt`: the
  **one** function both the composer and the mouse adapter call, so a click can never target a row
  the frame did not actually draw there.
- `keyboard.ts` — `keyboardCommand(key, state)`: digits activate by hotkey regardless of highlight;
  arrows move the highlight (wrapping); Enter/`\n` activates the highlighted item; `q`/Ctrl+C quit.
- `mouse.ts` — `parseMouseClick` (SGR `ESC [ < Cb ; Cx ; Cy M`, plain left button only, terminal
  1-based coordinates converted to frame 0-based here and nowhere else) and `mouseCommand`; plus
  `formatMouseClick`, the exact inverse, so a test or a driver script can describe "click column 5,
  row 10" and get the literal bytes a terminal would send. `MOUSE_REPORTING_ON`/`_OFF` are the SGR
  1000+1006 enable/disable escapes.
- `session.ts` — `MenuSession`: holds the list state and dispatches. `dispatch(command)` is the
  driver's direct-command path; `handleData(rawChunk, layout)` is the driver's raw-bytes path *and*
  what a live terminal's `stdin.on("data", ...)` calls — the same function, so "the driver injects
  raw key and mouse events into the real adapters" (engine.md 9.7) is the literal code path a test
  exercises, not a description of one.

**The frame, `src/view/menu.ts`** — `composeMenuFrame`, `MENU_SIZE` (80×24, the same floor
`compose.ts`'s Grid screen uses), `MENU_LAYOUT`. Reuses `BANDS`/`composeBands`/`gateFrame` from
`frame.ts` and `chromeGlyph` from `theme.ts` unchanged; draws its own border (a menu has one pane, not
the Grid screen's Grid/panel split, so the shared border code wasn't reusable as-is and duplicating
~15 lines was cheaper and safer than refactoring `compose.ts`'s tested drawing code to extract it).
The highlighted row renders in reverse video (`inverse: true`) — the one signal that survives
monochrome, per engine.md 9.6.

**A new style role, `chrome.hotkey`** (`src/view/roles.ts`) — engine.md 9.7 names it explicitly ("a
style role (`chrome.hotkey`) colours [the bracketed key] where colour exists"); added with dark/light
`ansi`/`rgb` swatches, a cyan distinct from every existing role's hue. The 256-colour tier derives
automatically from `rgb` (Q25's existing machinery); nothing else needed updating.

**The CLI wiring, `src/cli/`:**

- `lifecycle.ts` — `createTerminalSession`/`TerminalSession`: the idempotent disposer, **extracted
  out of `watch.ts`** rather than reinvented. `onDispose(step)` registers a cleanup step (any return
  value is awaited then ignored); `onSignal(leave)` hooks SIGINT/SIGTERM to `leave` and registers
  their own removal; `dispose()` runs every step exactly once, memoized, safe to call from anywhere,
  any number of times. `watch.ts` now builds its own disposer on this same class — there is one
  disposer in the codebase, not two that happen to look alike.
- `menu.ts` — `runMenu`, `TOP_LEVEL_ITEMS` (Campaign/Challenge/Settings/Exit, hotkeys 1-4),
  `STUB_NOTICES`. Non-TTY prints one line and returns (engine.md 10.1); otherwise selects a backend,
  turns mouse reporting on, and drives an event-driven loop (redraw on input or resize only — a menu
  has no ticks, so there is no `Playback` clock and no per-frame timer, unlike `watch.ts`). Exit calls
  the shared disposer; Campaign/Challenge/Settings set an honest stub notice and keep running.
- `terminalNexus.ts` — the `terminal-nexus` executable's own `main(argv)`: parses `--capability`,
  `--theme`, `--glyphs`, `--backend`, `--help`, then calls `runMenu`.

**The entry point, `bin/terminal-nexus.ts`** — mirrors `bin/grid.ts` exactly (EPIPE handling, the same
`.then`/`.catch` shape), alongside it rather than replacing it.

**A real bug found and fixed, `src/view/playback.ts`'s `keysFromChunk`** — see Section 7.

**Tests** (new files, plus additions to two existing ones): `tests/menu-list.test.ts`,
`tests/menu-adapters.test.ts` (the sharp-edge equivalence test lives here), `tests/menu-view.test.ts`,
`tests/menu-session.test.ts`, `tests/terminal-nexus-cli.test.ts`; two new tests in
`tests/lifecycle.test.ts` for the extracted disposer itself; three new tests in
`tests/playback.test.ts` for the `keysFromChunk` fix.

**Evidence**: `scripts/capture-menu-screenshot.mjs` (reuses `scripts/lib/terminal-capture.mjs`'s
tmux→HTML→Chromium pipeline `capture-screenshots.mjs` already uses for `grid`) and five PNGs in
`evidence/screenshots/`: `menu-top-level`, `menu-monochrome`, `menu-highlight-moved`,
`menu-stub-notice`, `menu-mouse-click`.

**Docs**: `README.md`, `DEVELOPMENT.md`, and `milestones/milestone-03-game-menu.md` updated together
(AGENTS.md Section 5); `package.json` gained a `terminal-nexus` script.

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| `./scripts/check-repository.sh` | PASS | Canon 2.16, gate 3A, zero failures |
| `npm run typecheck` (`tsc --noEmit`) | PASS | Clean, `strict`/`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` all on |
| `npm test` (Node 22.22.2) | PASS | 248/248, 0 failures |
| `npm run test:bun` (Bun 1.3.11) | PASS | 247/247 across 23 files, 0 failures |
| Node/Bun count reconciled | explained | The 248-vs-247 difference is `tests/lifecycle.test.ts`'s pre-existing `if (!RUNTIME_IS_BUN)` OpenTUI-fallback test — registered only where the fallback actually happens (Node); not a new discrepancy, not a bug |
| Keyboard hotkey, arrow+Enter, mouse click → identical command | PASS | `tests/menu-adapters.test.ts`, "the sharp edge" test — raw bytes into the real adapters for all four `TOP_LEVEL_ITEMS`, plus a real-terminal screenshot per path (Section 5) |
| Highlight moves correctly at every list length, incl. one item | PASS | `tests/menu-list.test.ts` |
| Menu renders at all 4 capability tiers + monochrome, every glyph one column | PASS | `tests/menu-view.test.ts`, `offendingGlyph` |
| Monochrome emits no colour code; a colour tier emits at least one | PASS | `tests/menu-view.test.ts` |
| Every hotkey/label literally on screen | PASS | `tests/menu-view.test.ts`, asserted against `frameToText`, not the data model |
| Disposer runs exactly once, from `q`, an interrupt byte, SIGINT, SIGTERM, or the Exit item | PASS | `tests/menu-session.test.ts`, fake-stdin pattern from `tests/lifecycle.test.ts` |
| Mouse reporting off on every exit path, alongside raw mode | PASS | `tests/menu-session.test.ts` |
| A caught render failure still disposes and reports failure | PASS | `tests/menu-session.test.ts` |
| `grid watch`'s own lifecycle unchanged after the disposer extraction | PASS | pre-existing `tests/lifecycle.test.ts` suite, unmodified assertions, all still green |
| Non-TTY launch: one line, no escapes | PASS | `tests/menu-session.test.ts` (fake streams) and `tests/terminal-nexus-cli.test.ts` (real subprocess) |
| `--help`, unknown `--capability`/`--theme` | PASS | `tests/terminal-nexus-cli.test.ts`, real subprocess |
| `createTerminalSession` itself: ordering, idempotency, signal hook/unhook | PASS | `tests/lifecycle.test.ts`, new tests |
| `keysFromChunk` splits N escape sequences in one chunk, CSI-with-params, SGR mouse, SS3 | PASS | `tests/playback.test.ts`, new tests |
| Real terminal (tmux/PTY): keyboard hotkey activates the right item | PASS | `evidence/screenshots/menu-stub-notice.png` |
| Real terminal: arrow-down twice moves the highlight two rows | PASS | `evidence/screenshots/menu-highlight-moved.png`, after the `keysFromChunk` fix (see Section 7 — **failed before the fix**) |
| Real terminal: a raw SGR mouse click activates the item at that cell | PASS | `evidence/screenshots/menu-mouse-click.png` |
| Real terminal: monochrome reads clearly with the inverse-highlight approach | PASS | `evidence/screenshots/menu-monochrome.png` |

Measurements: not applicable — this gate has no performance or balance claim.

## 5. Human observations

None yet — nobody but this session has looked at the screen. Per Section 1, this was not planned as
a blocking requirement for 3A (every acceptance criterion is mechanically checkable), but five
screenshots exist in `evidence/screenshots/` (`menu-top-level`, `menu-monochrome`,
`menu-highlight-moved`, `menu-stub-notice`, `menu-mouse-click`) and `npm run terminal-nexus` runs the
real thing, for whenever Mario looks.

## 6. Interpretation

**The acceptance bar is met, including its sharp edge.** The equivalence test does not merely check
that three functions return `{kind:"activate", index}` for hand-picked inputs — it derives the raw
key from each item's own `hotkey` field and the raw click coordinate from `menuItemRow`/
`menuItemLabel`, the exact functions the composer draws with, so a future change to either the hotkey
assignment or the layout would make the test fail rather than quietly stop proving anything. The real
terminal evidence in Section 4/5 is the same claim made twice, independently: unit tests via fake
adapters, screenshots via a real PTY.

**Several small, reversible decisions were made under bounded autonomy** (`project-governance.md`
Section 2) rather than asked about, each stated here so a later session can revisit cheaply if
evidence says otherwise:

- **Highlight wraps at both ends**, rather than clamping. Both satisfy the acceptance criterion's own
  edge case (a one-item list never moves); wrap is the more common terminal-menu convention. Flipping
  it later is a one-line change to `moveHighlight`.
- **Campaign, Challenge, and Settings are activatable stubs, not disabled rows.** The milestone's own
  text imagines Challenge eventually "disabled with the reason shown"; for 3A specifically, keeping
  every item activatable is what let the equivalence test exercise all four real items rather than
  only Exit, which is closer to "the smallest possible screen that exercises the whole input model."
  3C can add a disabled/dimmed state without touching the input model.
- **The menu frame is a hardcoded 80×24 (`MENU_SIZE`), not `compose.ts`'s `compositionSize(tileWidth)`
  reused directly.** The two numbers coincide at `tileWidth` 1, but `compositionSize`'s own doc
  comment ties its arithmetic to Grid columns and a side panel that don't exist on a menu screen;
  reusing the *number* (the 80×24 RULE floor, Q12) rather than the *function* felt like the more
  honest reuse. `gateFrame` — genuinely screen-agnostic — is reused directly, unmodified.
- **No new open question was registered.** Reviewed carefully against the two real candidates: (1)
  whether OpenTUI's own renderer might contend with the CLI-level SGR mouse toggle — not registered,
  because it is a testable technical risk with an obvious fix if wrong, not a product fork Mario would
  choose between options for, and today it cannot even be measured (OpenTUI's native core does not
  load under Node; `auto` falls back to direct ANSI there, per existing evidence in `roles.ts`'s own
  comment) — flagged as a stop condition for whoever first ships `--backend opentui` for real; (2)
  whether the reusable menu-list shape needs scrolling for a list longer than the screen (Milestone
  5's construct menu might exceed four items) — not registered, because nothing in `MenuLayout`
  forecloses adding a scroll offset later, and building it now would be speculative before a real
  list is long enough to need it. Both are recorded here rather than silently assumed.

## 7. Failures, surprises, and discarded approaches

**The one real bug, found only by real-terminal evidence, not by any unit test.** The first screenshot
pass (`scripts/capture-menu-screenshot.mjs`, driving two arrow-down presses through tmux) showed the
highlight still on the first item — it should have moved to the third. Every fake-stdin unit test for
the same key had passed, because every one of them sent exactly one escape sequence per `data` event.

Diagnosis: dumped raw bytes with a throwaway stdin-reading script under the identical tmux setup.
`tmux send-keys Down` sends exactly `1b 5b 42` (`ESC [ B`) — the *right* bytes — but two of them sent
close together arrive at the real process as **one six-byte chunk**, `ESC[B ESC[B`. The pre-existing
`keysFromChunk` (`src/view/playback.ts`, unmodified since Milestone 1) treated *any* chunk starting
with ESC as one whole key, in full, regardless of how many complete sequences it actually contained —
correct only because Gate 1A's `controlForKey` binds no escape sequence to anything, so the function's
own doc comment already said so ("since Gate 1A binds none of them, ignored"). This is the first
screen to bind arrow keys to a real command, and the first real exercise of that assumption; it did
not hold.

Fixed by replacing the "ESC → rest of chunk" shortcut with a real scan: a CSI sequence
(`ESC [ ... final-byte`, final byte `0x40`-`0x7E`) ends at its own final byte, an SS3 sequence
(`ESC O` + one character) is fixed at three characters, and anything else is a bare one-character ESC
— so a chunk containing several complete sequences (or a mix of sequences and plain keys) now
produces one key per sequence, not one key for the whole tail. Verified three ways: new unit tests
(two, three, and mixed sequences in one chunk; a modified arrow and an SGR mouse report, which shares
the same CSI shape; an SS3 arrow), the full existing suite staying green (`grid watch` binds no
escape sequence either way, so its behaviour is provably unchanged), and — the thing that actually
caught it — a re-captured screenshot showing the highlight correctly landing on the third item after
two presses.

**Why no unit test caught it first.** Every existing fake-stdin test (`tests/lifecycle.test.ts` and
this gate's own `tests/menu-session.test.ts`, before this fix) drives input one `emit("data", ...)`
call at a time, which is exactly one key per chunk — a pattern that can never reproduce "the OS
delivered two keypresses in one read." That gap is now closed for the *specific* case this gate
needed (multiple escape sequences), with regression tests, but it is worth naming plainly: a fake
stdin that always sends one logical action per `data` event cannot, by construction, find a bug that
only appears when several logical actions share one physical chunk. `tests/playback.test.ts` already
had exactly this insight for *plain* keys ("a chunk of input is several keys," `,,,`, from Milestone
1) — it simply had never been extended to escape sequences, because nothing needed one before.

**A smaller thing, not a bug: the raw-byte-in-source-file trap.** An early draft of
`capture-menu-screenshot.mjs` built the SGR mouse-click bytes as a literal JS template-string escape
(`"[<0;8;11M"`); the tool call that wrote it round-tripped through a layer that decodes `\uXXXX`
escapes, so the file that actually landed on disk contained a **raw, literal ESC control byte** inside
the source rather than the six printable characters `\`, `u`, `0`, `0`, `1`, `b`. It still ran
correctly (a raw control byte inside a double-quoted JS string is syntactically legal), but it is a
genuinely bad thing to leave committed — invisible in a normal diff, and one bad editor or line-ending
transform away from silently corrupting. Caught by `cat -A` showing `^[` instead of the expected
`` text, and fixed by importing the already-exported `ESC` runtime constant from
`scripts/lib/terminal-capture.mjs` and building the string with a template literal instead. Worth
remembering: **grep or `cat -A` a file after writing it, if the intended content was a control-
character escape sequence** — the write path is not guaranteed to preserve "the six characters
``" versus "the one byte `0x1B`" distinction.

**Discarded: a `MenuDriver` wrapper class.** The plan going in was a dedicated driver object
(`pressKey`, `click`, `sendCommand`, `frame`) separate from `MenuSession`, mirroring what a first
reading of engine.md 9.7's driver row suggests. Building it turned out to be pure indirection:
`MenuSession.dispatch` and `.handleData` already are the driver's two required shapes (a direct
command, or raw bytes into the real adapters), and `composeMenuFrame(session.state, ...)` already
reads the frame back. A wrapper would have forwarded to these with no added behaviour. Discarded in
favour of tests and any future agent script calling `MenuSession` directly — one class, not two.

**Discarded: extracting `compose.ts`'s border-drawing into a shared helper.** `compose.ts`'s frame
border and the menu's are visually identical in their outer edge, but `compose.ts`'s version also
draws the Grid/panel divider inline in the same loop, so a clean extraction would have meant editing
tested, working Grid-rendering code to peel that apart — for roughly fifteen lines saved. Duplicated
the small border-drawing function instead, in `src/view/menu.ts` only; `compose.ts` is untouched by
this gate.

## 8. Decision

> **PASS**

Every automated check this gate set for itself (Section 1) passes, on both runtimes, including the
sharp-edge equivalence test the task named explicitly. A real, previously-latent bug in shared
Milestone-1 code was found by real-terminal evidence (not by a unit test), root-caused precisely,
fixed with proof that `grid watch`'s own behaviour is unchanged, and covered by regression tests. The
shared disposer is genuinely shared — `watch.ts` was refactored onto `src/cli/lifecycle.ts`, not left
as a second copy beside a new one. Explicit exclusions (Settings persistence, real Campaign/Challenge
handoffs, a help overlay, mouse wheel/right-click, a file-based driver format) are named, not silently
missing. No new open question needed registering; two candidate forks were considered and recorded in
Section 6 as reversible assumptions rather than blockers.

## 9. Canon impact

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| None | — | This gate implements the input model engine.md 9.7 already states as RULE (canon 2.10); nothing here contradicts or extends that RULE, so no amendment is proposed. |

Questions raised: none. Section 6 explains why the two candidate forks (OpenTUI/mouse interaction;
scrolling for a longer future list) are recorded as assumptions rather than registered as `Q<n>` rows
— neither is a product decision Mario would choose between named options for, and both are cheap to
revisit if evidence later says otherwise.

## 10. Next authorized action

Gate 3B (Settings: capability tier, theme, glyph pack, reduced motion as a menu, persisted to a small
settings file) — after Mario has looked at `evidence/screenshots/menu-*.png` and this report, per
`milestones/milestone-03-game-menu.md` Section 1.1's own build order.
