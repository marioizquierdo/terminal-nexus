# Milestone 3 — Game Menu

**Document role:** Milestone tracker — the game's own entry point, as distinct from `grid`'s
**Status:** CURRENT
**Active gate:** none — all three gates (3A, 3B, 3C) are built; owner acceptance is what closes this
milestone and opens Milestone 5
**Depends on:** Milestone 2 (campaign design decided — accepted 2026-09-12)
**Updated:** 2026-09-21
**License:** Apache-2.0

> **Start simple, with the minimum.** Mario's own words. This is the first time anything under the
> name `terminal-nexus` actually launches — [`../specs/engine.md`](../specs/engine.md) Section 11
> already names the split: "`grid` is the editor and replay tool, not the game; a future
> `terminal-nexus` executable is what launches a campaign built on it." This milestone is that
> executable's first real screen, and nothing more than that.

> **Gate 3A: BUILT, 2026-09-13** — [`../evidence/gate-3a-report.md`](../evidence/gate-3a-report.md)
> concludes PASS on every automated check it set for itself; owner viewing is outstanding (the same
> "built, not yet accepted" state Milestone 1's own gates passed through). `bin/terminal-nexus.ts`
> launches a real top-level menu on the existing terminal stack; the menu-list shape, the keyboard and
> mouse adapters, and the driver all live in `src/menu/`; the shared disposer is now
> `src/cli/lifecycle.ts`, used by `grid watch` and this menu alike, not reinvented. Real-terminal
> evidence (`evidence/screenshots/menu-*.png`, `scripts/capture-menu-screenshot.mjs`) caught and fixed
> a genuine bug no fake-stdin test had ever exercised: `keysFromChunk` (`src/view/playback.ts`) treated
> *any* number of escape sequences arriving in one stdin chunk as a single key, which silently dropped
> the second of two quick arrow presses. Fixed to split every complete sequence on its own, with
> regression tests; `grid watch`'s own behaviour is unchanged since it still binds no escape sequence
> to anything. **3B and 3C are next**, in the build order this file's own Section 1.1 already gives —
> not authorized by this note, only unblocked by it.

> **Gate 3B: BUILT, 2026-09-18** — [`../evidence/gate-3b-report.md`](../evidence/gate-3b-report.md)
> concludes PASS on every automated check it set for itself; owner viewing is outstanding, the same
> "built, not yet accepted" state Gate 3A passed through. Settings is now a real second screen, reached
> from the top-level menu by its own hotkey: four rows — colour depth, background, symbols, reduced
> motion — that each cycle to their next value in place, plus a row that goes Back, all driven by the
> exact same hotkey/arrow/click machinery Gate 3A already built rather than a second one invented for
> this screen. Changing a row takes effect on the very next frame, with no stop-and-restart of the
> terminal itself, and is written to a small settings file
> (`~/.terminal-nexus/settings.json`, distinct from any future save/progression format) that the next
> launch reads back. Two real bugs were found and fixed before either could ship: the ANSI and OpenTUI
> backends had no way to change colour depth or theme once running, so showing a change "on the very
> next frame" always meant tearing the terminal down and setting it back up, until both backends
> gained a way to update their own presentation in place; and a hotkey typed immediately before a
> second keystroke, both landing in the same chunk of input — the exact shape a quick typist or a
> script produces — could send that second keystroke to the screen the player had just left, because
> the menu had been deciding which screen was listening once per chunk of input rather than once per
> keystroke. **3C is next**, in the build order this file's own Section 1.1 already gives — not
> authorized by this note, only unblocked by it.

> **Gate 3C: BUILT, 2026-09-21** — [`../evidence/gate-3c-report.md`](../evidence/gate-3c-report.md)
> concludes PASS on every automated check it set for itself; owner viewing is outstanding, the same
> "built, not yet accepted" state Gates 3A and 3B passed through. This is the last gate the milestone
> names. Neither Milestone 4 nor Milestone 11 is built yet, so Campaign and Challenge each say so in
> the way this file's own Section 2 asks for, and the two ways turned out to need different handling
> rather than one generic "disabled" behaviour: Campaign's hotkey now opens a real second screen — the
> same reusable list/session/view shape Settings already proved, a plain message, and a Back row —
> instead of pinning a notice to the menu behind it. Challenge stays on the top-level menu but renders
> dimmed, and its own label already names the milestone that builds it, so a player learns why before
> ever pressing it rather than only after. Pressing Challenge's hotkey still does exactly what it
> always has (Gate 3A's own stub notice) — `engine.md` 9.7 is a RULE that a displayed hotkey activates
> the item it belongs to, so dimming only ever changes how a row is drawn, never whether pressing it
> does something, and nothing about the command vocabulary, the adapters, or the pure reducer changed
> to build it. With all three gates built, the milestone's own question is answered; what remains is
> Mario looking at it.

## 1. Question

Can a player launch `terminal-nexus` and navigate a top-level menu — **Campaign, Challenge,
Settings, Exit** — built on the same terminal stack `grid` already proved, rather than a second
rendering system invented for menus? (Canon 2.11 renamed the options: the two single-player modes of
[`../specs/game-modes.md`](../specs/game-modes.md) are the menu, and "Load Game" lives inside
Campaign once there is anything to load.)

### 1.1 Gates

- **3A — The menu and the three adapters. BUILT**, see the note above and
  [`../evidence/gate-3a-report.md`](../evidence/gate-3a-report.md). `bin/terminal-nexus.ts`, the list
  shape with displayed hotkeys, the keyboard and mouse adapters, the driver, and the shared disposer —
  with the hotkey/arrow/click equivalence test. The smallest possible screen that exercises the whole
  input model of [`../specs/engine.md`](../specs/engine.md) 9.7.
- **3B — Settings. BUILT**, see the note above and
  [`../evidence/gate-3b-report.md`](../evidence/gate-3b-report.md). Capability tier, theme, glyph
  pack, and reduced motion as a menu, each cycling in place and persisted to a small settings file.
- **3C — Mode select and honest handoffs. BUILT**, see the note above and
  [`../evidence/gate-3c-report.md`](../evidence/gate-3c-report.md). Campaign hands off to its own
  placeholder screen since Milestone 4 isn't built yet; Challenge shows dimmed on the top-level menu,
  its own label naming Milestone 11; nothing is silently broken.

## 2. What gets built

- **`bin/terminal-nexus.ts`**, a new entry point alongside the existing `bin/grid.ts`, sharing the
  same `TerminalBackend`, `ReadonlyCellFrame`, band compositor, and capability/theme machinery — a
  menu is a frame like any other, not a reason to build a second presentation stack.
- **A menu is its own small, reusable shape**: a vertical list of options, each showing its hotkey
  before its label (`[1] Start New Game`), selected by that key, by up/down and Enter, or by a click
  — all three producing the same named command, per
  [`../specs/engine.md`](../specs/engine.md) Section 9.7 (canon 2.10: "a hotkey that is not displayed
  does not exist"). Rendered through the existing cell frame so monochrome, every colour tier, and
  reduced motion all already work without new accessibility code.
- **The three input adapters, built here at their smallest.** This is the first screen with a
  command vocabulary, so it is where the keyboard adapter, the mouse adapter (opt-in terminal mouse
  reporting, switched off by the disposer), and the driver — a scripted stream of commands *or raw
  key and mouse events*, from a file or a test — first exist. A menu is the cheapest possible place
  to get that shape right; the Build Phase (milestone 5) inherits it rather than inventing it. The
  seed already exists: `controlForKey`/`keysFromChunk` in `src/view/playback.ts` and the fake stdin
  in `tests/lifecycle.test.ts`.
- **Campaign** hands off to Milestone 4's campaign menu. If Milestone 4 is not yet built when this
  lands, hand off to an explicit placeholder screen rather than leaving the option silently broken.
  Per Q43 (answered), there is **no Commander-choice screen at this level**: a new player goes
  straight into Vasse's mission 1. Averno and Dob Hunter are unlocks that appear as new rows on
  Milestone 4's campaign menu once Vasse's mission 1 is complete — nothing for this milestone to
  build.
  Loading a campaign in progress lives behind this option, and depends on there being a save to load.
  There is no real save/progression system yet (`../specs/open-questions.md` Q31 recommends a flat,
  checked-in unlock list for Level 1, not a save format) — until one exists, say so plainly rather
  than pretend. Do not build a save system to make this feel complete; that is its own future
  decision, not this milestone's.
- **Challenge** hands off to Milestone 11's run screen, or is disabled with the reason shown until
  that milestone lands. In the build order it lands before Milestone 4, so this may be the first
  option that actually works.
- **Settings** exposes what `grid` already takes as CLI flags — capability tier, theme, glyph pack,
  reduced motion — as an interactive menu instead of flags-only. Persisted to a small local settings
  file, separate from any future save/campaign-progress format, so "I set monochrome" survives the
  next launch without needing the save system this milestone explicitly does not build.
- **Exit** reuses the existing idempotent disposer (`q`, `SIGINT`, `SIGTERM`, setup failure, caught
  render failure) `grid` already has one of — do not build a second one.

## 3. Explicitly not this milestone

The campaign menu's own content (Milestone 4), Build Phase (Milestone 5), any actual mission
gameplay, a real save/progression format (Q31 stays open), sound.

## 4. Acceptance

- keyboard navigation moves the highlight correctly at every list length, including one item;
- every option is reachable three ways — its displayed hotkey, arrows and Enter, and a mouse click
  on its row — and a driver-fed test proves all three emit the same command, injecting the raw key
  and the raw click, not the command;
- every menu frame renders correctly at all four capability tiers and in monochrome, the same bar
  every Gate 1B effect met;
- Exit runs the shared disposer exactly once regardless of which key or signal triggered it;
- Settings changes persist across a relaunch; Load Game's stubbed state is honest about not being
  real yet, not silently broken.

## 5. Definition of done

Checked items below are what **Gates 3A, 3B, and 3C** (this file's own Section 1.1) close between
them — the last of the three, so every item is now checked; the milestone as a whole still awaits
Mario's own acceptance before it counts as done, the same way Milestone 1's gates did.

- [x] `bin/terminal-nexus.ts` exists and launches to the top-level menu from a clean checkout;
- [x] all four options are reachable and do something honest — **3A**: Campaign, Challenge, and
      Settings each showed a plain, honest stub notice naming the milestone/gate that builds them for
      real, and Exit actually cleans up and quits; **3B**: Settings now persists every choice it
      shows, across a full stop-and-restart, not just for the rest of the current run; **3C**: Campaign
      now opens its own placeholder screen instead of a notice on the menu behind it, and Challenge
      shows dimmed with its own reason right in its label;
- [x] every option shows its hotkey, and hotkey, arrows-and-Enter, and click are proven equivalent
      through the driver;
- [x] the disposer leaves mouse reporting off on every exit path, alongside raw mode;
- [x] a gate report exists, ending in **PASS / REVISE / STOP / BLOCKED** —
      [`../evidence/gate-3a-report.md`](../evidence/gate-3a-report.md) for 3A,
      [`../evidence/gate-3b-report.md`](../evidence/gate-3b-report.md) for 3B,
      [`../evidence/gate-3c-report.md`](../evidence/gate-3c-report.md) for 3C;
- [x] `./scripts/check-repository.sh` passes;
- [x] new questions this raises are rows in [`../specs/open-questions.md`](../specs/open-questions.md)
      — none needed registering for any of the three gates; see each gate report's own Section 6 for
      why.
