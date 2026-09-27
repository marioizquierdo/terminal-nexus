# Gate report — Milestone 5, Gate 5G: Debug Mode

**Document role:** Gate evidence report for Gate 5G
**Status:** COMPLETE — PASS, awaiting the owner's look
**Canon version:** 2.20
**Updated:** 2026-09-27
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.20, unchanged. This session did not edit `specs/`, `AGENTS.md` or
  `milestones/` (another session is editing the design documents); the text those documents owe is
  proposed to the orchestrator in Section 9.
- **Milestone and gate:** Milestone 5 — Build Phase, gate 5G, Debug Mode.
- **Question this gate answers:** can the owner try two answers to an open question during a
  playtest — change a value on the running screen and feel the difference — without a new
  command-line flag or a rebuild, by keyboard, mouse and driver script alike?
- **Smallest artifact that can answer it:** a `[d] Debug` popup over the Grid, built on the one popup
  shape the Nexus, start-the-Pulse and exit popups already share, listing a handful of flags tied to
  questions still open, each changing the running screen.
- **Automated evidence planned:** tests for every behaviour; one flow driven three ways (keys, clicks,
  a driver script) to the same state and the same frame; an architecture check that the Build Phase
  reducer names no clock and never reaches the kernel's tick; the full suite on Node and Bun;
  `tsc`; the validator; the browser page build; screenshots at 80x24, 104x32 and in the light theme,
  looked at.
- **Human observation planned:** Mario, in iTerm2 and on the browser playtest page — can he find the
  panel, change a value, see the effect and leave; and do the first answers he feels settle any of the
  questions the flags serve. See Section 5.
- **Explicit exclusions:** saving the flags anywhere (per session, see Section 6); a scrolling popup
  for more flags than fit at 80x24 (gate 5H adds its numbers and will need one — see Section 7); the
  frame timer, speed tiers and eased camera of gate 5H; any flag for a question already answered
  (where focus goes after a placement, Q57; whether the Nexus popup closes on a pick, Q60; the map
  edge's weight, Q56).
- **Stop conditions:** a flag that could only work through a global, or that would reach the
  simulation kernel; a popup that could not fit 80x24. Neither reached.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux 6.18.44 x86_64 (the cloud session's container) |
| Runtime and exact version | Node 22.22.2; Bun 1.3.11 |
| Dependencies and exact versions | `typescript` 7.0.2, `@types/node` 22.20.1, `@opentui/core` 0.5.6, `gifenc` 1.0.3, `pngjs` 7.0.0 |
| Hardware, if it affects measurements | not applicable — no measurement here depends on it |
| Date measured | 2026-09-27 |

Commands, in the order they were run for this report:

```bash
./scripts/check-repository.sh
npm run typecheck
node --test tests/build-debug.test.ts
node --test tests/architecture.test.ts
npm test
npm run test:bun
bun test tests/performance.test.ts
bun test tests/build-debug.test.ts
bun scripts/build-web.mjs
node scripts/playtest.mjs --keys "d" --capability monochrome
node scripts/playtest.mjs --keys "d Down Right Right" --size 104x32
node scripts/playtest.mjs --keys "d Down Down" --theme light --png final --name dbglight --print none --force
node scripts/playtest.mjs --keys "d Right Esc Down Down Space" --print none
node scripts/playtest.mjs --keys "1 Esc d Down Down Right r" --print final
node scripts/capture-spike-screenshots.mjs
./bin/terminal-nexus.ts --spike --capability truecolor   # under tmux at 80x24: d, Right, Esc, Esc, q
```

## 3. What was built

In plain terms: **press `d` (or click `[d] debug` at the right of the top bar) and a popup lists the
experiments running on this screen.** Each row is one question still open, its current answer
between `<` and `>`, and whether a change shows now or only after a restart. Up/Down choose a row,
Left/Right change it, and what the highlighted row is for is written underneath in plain words. `[r]`
starts the Build Phase over keeping the settings. Esc closes it. Nothing is saved.

The five flags, each tied to something still undecided:

| Flag | Values | Seen | The question it serves |
| --- | --- | --- | --- |
| Smart cursor | on / off | now | Does picking a building from the menu put the cursor beside the last thing planned, or leave it where it is? (Q55, the comparison its own register entry asks for) |
| Scroll margin | 0-8 tiles (starts at 3, or `--scroll-margin`) | now | How near the edge of the view the cursor gets before the map scrolls (Q54; gate 5H makes it a share of the screen) |
| Opens on | menu / map | restart | Where the keyboard is when the Build Phase opens — built as the menu, a guess gate 5F made and never asked |
| Pressed flash | off, 50, 90, 140, 250, 400 ms (starts at 90) | now | How long a menu row flashes when chosen; the owner asked for about 50 ms, 90 was a guess |
| Refused flicker | the same list (starts at 140) | now | How long a row flickers when a key reaches it but does nothing |

Where the code is:

- `src/build/debug.ts` (new): the flags as data — name, question, values, when seen, how a value is
  written — and the one step function Left/Right, Enter and a click all go through.
- `src/build/state.ts`: the flags live in `BuildState.debug`. The reducer reads the smart cursor, the
  scroll margin and the opening focus from there (no global; `BuildContext.scrollMargin` and
  `smartCursor` are now only starting values). A new margin re-settles the camera at once. Four
  commands: `open-debug`, `debug-adjust` (by field, so a driver can set a flag without walking the
  list), `debug-select`, `debug-restart`; Up/Down, Left/Right and Enter reuse `highlight`, `nudge` and
  `activate`.
- `src/build/overlay.ts`: Debug Mode is the popup shape's fourth use. It added two row kinds — a
  `setting` (name, `< value >`, now/restart) and a `note` (text wrapped at words into a fixed number of
  lines) — and `settingColumns`, the one geometry drawing and hit-testing share. `wrapWords` moved here
  from the view so placement can count wrapped lines.
- `src/build/layout.ts`, `mouse.ts`, `keyboard.ts`: the top bar's `[d] debug` hint and its click
  target; the popup's keys.
- `src/view/build.ts`: the hint, the two row kinds, the `DEBUG` key help, and the margin readout now
  reading the live flag. While Debug Mode is open the menu shows no highlight bar.
- `src/cli/spike.ts`: the flash durations come from the flags instead of a constant; the live loop is
  still the only place that reads a clock.
- `src/web/keys.ts`: `d debug` on the browser page's Build Phase key bar.
- `docs/ui-patterns.md`: the setting-row pattern, the note row, when a popup keeps a menu row lit, and
  where development tools live.
- `scripts/lib/terminal-capture.mjs`: a screenshot-tool fix (Section 7) so light-theme pictures show
  inverse bars correctly.

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` (both tsconfigs) | pass | no output |
| `npm test` (Node) | **451 / 451 pass** (437 before this gate; +13 Debug Mode, +1 architecture) | `tests/build-debug.test.ts`, `tests/architecture.test.ts` |
| `npm run test:bun` | 450 pass, 1 fail on the first run: the Pulse-view performance test's worst case hit Bun's 5 s timeout. Re-run alone: 3 / 3 pass | `bun test tests/performance.test.ts` |
| Same debug flow by keys, clicks and driver | identical `BuildState` (deep-equal) and identical monochrome frame | `tests/build-debug.test.ts`, last test |
| Build reducer names no clock, never reaches `src/pulse` or `src/cli` | pass | `tests/architecture.test.ts` |
| Popup inside the Grid pane at 80x24, 104x32, 128x24; every label uncut; every question within 3 lines | pass | `tests/build-debug.test.ts` |
| Scroll margin set live equals a screen opened with that margin, for 0, 1, 5, 8 | identical camera after the same moves | `tests/build-debug.test.ts` |
| `bun scripts/build-web.mjs` | wrote `dist/terminal-nexus-playtest.html`, 140 KB, 78 source files | build output |
| `./scripts/check-repository.sh` | pass | validator output |
| Live `--spike` in tmux at 80x24 | `d` opened the popup, Right set "Smart cursor: off", Esc closed it, Esc asked to exit, `q` left and the session ended | tmux capture |

Measurements: not applicable — this gate adds no timing-sensitive path; the only timing it touches
(the flash durations) is now a number the owner sets.

Screenshots (regenerated; every Build Phase picture changed because the top bar now carries
`[d] debug`):

- `evidence/screenshots/build-debug-80x24.png` — the popup as it opens, at the floor size;
- `evidence/screenshots/build-debug-104x32.png` — the scroll margin moved to 5, the readout naming it;
- `evidence/screenshots/build-debug-light.png` — the light theme, "Opens on" highlighted;
- `evidence/screenshots/build-debug-restarted-on-map.png` — after `[r]` with "Opens on: map";
- `evidence/screenshots/build-debug-smart-cursor.gif` — smart cursor off, then the menu flow.

## 5. Human observations

Nobody but this session has looked at it yet. What this session saw in the pictures, played as a new
user: the `[d] debug` hint is visible top right at every size; `d` opens a popup whose first row is
highlighted and whose question is written underneath; Right changed the value and the status line
said so; Esc closed it and the change was felt (the smart cursor no longer moved the cursor). Two
problems were found only by looking at pictures and are fixed (Section 7).

**For Mario:** open the Build Phase, press `d` (or click `[d] debug`, top right). Try the smart cursor
off and on with the Barracks/Hatchery run; try the scroll margin at 1 and at 6 while moving to the
map's edge; set "Opens on" to map and press `r`. Are these the right first experiments, and does
feeling any of them settle its question?

## 6. Interpretation

- **Flags in state, not context.** The context is by its own definition what never changes while the
  screen is open; a flag that changes must be state. Putting all five in `BuildState.debug` also makes
  keyboard, mouse and driver parity free: they are commands like any other. The reducer stores the
  two flash durations but never reads them; only the live loop does, so the reducer still has no clock
  and a still frame never carries a flash.
- **Per session, not saved.** Nothing gave a reason to persist them, and a saved experiment is one
  that can silently outlive its question. `--scroll-margin` still sets where the margin starts. The
  restart row is what makes "applies on restart" real without saving anything.
- **The entry point is the top bar, not the menu.** The menu is the game's; this is a playtest tool
  that will shrink as its questions are answered. It is still found (drawn, with its hotkey, at every
  size) and clicked like any other entry.
- **Only the highlighted row's question is shown.** All five questions in full do not fit at 80x24
  (the popup already uses 15 of the pane's 16 rows). Showing the highlighted one under the list is the
  menu's own effect-line pattern, and keeps the popup's height fixed as the highlight moves.
- **Nothing reaches the kernel.** The Build Phase plan is a plan on a screen until the Pulse; the
  architecture test now holds `src/build` away from `src/pulse` and any clock.

## 7. Failures, surprises, and discarded approaches

- **Light-theme screenshots showed every inverse bar black on black** — the menu highlight, popup
  titles, the settings screen's own picture (`evidence/screenshots/settings-light-theme.png`, made
  before this gate). It was the screenshot tool, not the game: the ANSI-to-HTML converter swapped
  inverse text to the *dark* background whatever the theme. A real terminal and the browser canvas
  both use their own background. Fixed in `scripts/lib/terminal-capture.mjs` (`ansiToHtml` takes the
  pane background); `settings-light-theme.png` and the mirror light-theme pictures come from other
  capture scripts and were not regenerated here, so they still show the old artifact.
- **Two highlights at once.** The first picture showed the menu's Nexus row lit behind the Debug
  popup, beside the popup's own highlight. The Nexus and start-the-Pulse popups keep their menu row lit
  on purpose (they belong to it); Debug Mode belongs to no row, so it now leaves the menu unlit.
- **The smart cursor's question wrapped to four lines at 80x24**, pushing "(Q55)" off the popup. It
  was shortened, and a test now holds every question to three lines at the narrowest popup.
- **Discarded: a question line under every flag.** Two lines per flag made 16 content lines, one more
  than 80x24 can hold, before gate 5H adds its numbers.
- **Discarded: small `<` and `>` click targets.** One cell is hard to hit with a finger on the browser
  page; each half of the value box (six cells) is its target instead.
- **Owed by gate 5H:** its speed tiers, margin share and easing times are meant to be Debug Mode flags
  too. At 80x24 the popup is full at five, so 5H needs the popup to scroll (or a second page).
- **Flaky under load:** the Pulse-view performance test's worst case hit Bun's 5 s timeout once and a
  Node test failed once on the untouched baseline; both passed on a re-run. Not this gate's code, but
  worth knowing when a full run fails once.

## 8. Decision

> **PASS**

Debug Mode opens from `d` or the top bar, lists five flags each naming its question and when it
applies, changes the running screen, closes with Esc (and `x`, `d`, a right click, a click outside),
and does all of it identically by keyboard, mouse and driver. The popup reuses the one popup shape.
Nothing is saved and nothing reaches the kernel. Pending the owner's look.

## 9. Canon impact

Proposed, not applied — the orchestrator owns the design documents in this round:

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| Debug Mode's flags are Build Phase state, per session and never saved; the reducer reads the rule-changing ones, the live loop reads the timing ones; `[r]` restarts keeping them | `specs/engine.md` 9.7, the Debug Mode paragraph | this gate |
| A setting row: value between `<` `>`, Left/Right change it, each half of the value box is its click target, a choice of two comes round, a number stops at its ends | `docs/ui-patterns.md` (done), later `engine.md` 9 | this gate |

Questions raised: none new. "Where the screen opens" is a guess gate 5F made that has no register
entry; the flag is its observable form, and the orchestrator may want a Q row for it.

## 10. Next authorized action

Mario looks at Debug Mode (and gate 5F); then gate 5H, whose numbers become Debug Mode flags and whose
first job there is a popup that scrolls.
