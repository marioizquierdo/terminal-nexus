# Milestone 3 — Game Menu

**Document role:** Milestone tracker — the game's own entry point, as distinct from `grid`'s
**Status:** CURRENT
**Active gate:** 3A — The menu and the three adapters; gates 3B and 3C follow once 3A closes
**Depends on:** Milestone 2 (campaign design decided — accepted 2026-09-12)
**Updated:** 2026-09-12
**License:** Apache-2.0

> **Start simple, with the minimum.** Mario's own words. This is the first time anything under the
> name `terminal-nexus` actually launches — [`../specs/engine.md`](../specs/engine.md) Section 11
> already names the split: "`grid` is the editor and replay tool, not the game; a future
> `terminal-nexus` executable is what launches a campaign built on it." This milestone is that
> executable's first real screen, and nothing more than that.

## 1. Question

Can a player launch `terminal-nexus` and navigate a top-level menu — **Campaign, Challenge,
Settings, Exit** — built on the same terminal stack `grid` already proved, rather than a second
rendering system invented for menus? (Canon 2.11 renamed the options: the two single-player modes of
[`../specs/game-modes.md`](../specs/game-modes.md) are the menu, and "Load Game" lives inside
Campaign once there is anything to load.)

### 1.1 Gates

- **3A — The menu and the three adapters.** `bin/terminal-nexus.ts`, the list shape with displayed
  hotkeys, the keyboard and mouse adapters, the driver, and the shared disposer — with the
  hotkey/arrow/click equivalence test. The smallest possible screen that exercises the whole input
  model of [`../specs/engine.md`](../specs/engine.md) 9.7.
- **3B — Settings.** Capability tier, theme, glyph pack, reduced motion as a menu, persisted to a
  small settings file.
- **3C — Mode select and honest handoffs.** Campaign hands off to Milestone 4 or an explicit
  placeholder; Challenge hands off to Milestone 11 or is disabled with the reason shown; nothing is
  silently broken.

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

- [ ] `bin/terminal-nexus.ts` exists and launches to the top-level menu from a clean checkout;
- [ ] all four options are reachable and do something honest (Campaign hands off or shows a clear
      placeholder; Challenge is disabled-with-reason or hands off once Milestone 11 exists; Settings
      persists; Exit cleans up);
- [ ] every option shows its hotkey, and hotkey, arrows-and-Enter, and click are proven equivalent
      through the driver;
- [ ] the disposer leaves mouse reporting off on every exit path, alongside raw mode;
- [ ] a gate report exists, ending in **PASS / REVISE / STOP / BLOCKED**;
- [ ] `./scripts/check-repository.sh` passes;
- [ ] new questions this raises are rows in [`../specs/open-questions.md`](../specs/open-questions.md).
