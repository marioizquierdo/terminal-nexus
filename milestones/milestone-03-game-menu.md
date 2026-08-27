# Milestone 3 — Game Menu

**Document role:** Milestone tracker — the game's own entry point, as distinct from `grid`'s
**Status:** GATED
**Depends on:** Milestone 2 (campaign design decided)
**Updated:** 2026-08-26
**License:** Apache-2.0

> **Start simple, with the minimum.** Mario's own words. This is the first time anything under the
> name `terminal-nexus` actually launches — [`../specs/engine.md`](../specs/engine.md) Section 11
> already names the split: "`grid` is the editor and replay tool, not the game; a future
> `terminal-nexus` executable is what launches a campaign built on it." This milestone is that
> executable's first real screen, and nothing more than that.

## 1. Question

Can a player launch `terminal-nexus` and navigate a keyboard-driven top-level menu — **Start New
Game, Load Game, Settings, Exit** — built on the same terminal stack `grid` already proved, rather
than a second rendering system invented for menus?

## 2. What gets built

- **`bin/terminal-nexus.ts`**, a new entry point alongside the existing `bin/grid.ts`, sharing the
  same `TerminalBackend`, `ReadonlyCellFrame`, band compositor, and capability/theme machinery — a
  menu is a frame like any other, not a reason to build a second presentation stack.
- **A menu is its own small, reusable shape**: a vertical list of options, keyboard up/down to move
  the highlight, enter to select, rendered through the existing cell frame so monochrome, every
  colour tier, and reduced motion all already work without new accessibility code.
- **Start New Game** hands off to Milestone 4's campaign menu. If Milestone 4 is not yet built when
  this lands, hand off to an explicit placeholder screen rather than leaving the option silently
  broken.
- **Load Game** depends on there being a save to load. There is no real save/progression system yet
  (`../specs/open-questions.md` Q31 recommends a flat, checked-in unlock list for Level 1, not a save
  format) — until one exists, this option should say so plainly rather than pretend, or be disabled
  outright with a reason shown. Do not build a save system to make this option feel complete; that is
  its own future decision, not this milestone's.
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
- every menu frame renders correctly at all four capability tiers and in monochrome, the same bar
  every Gate 1B effect met;
- Exit runs the shared disposer exactly once regardless of which key or signal triggered it;
- Settings changes persist across a relaunch; Load Game's stubbed state is honest about not being
  real yet, not silently broken.

## 5. Definition of done

- [ ] `bin/terminal-nexus.ts` exists and launches to the top-level menu from a clean checkout;
- [ ] all four options are reachable and do something honest (Start New Game hands off or shows a
      clear placeholder; Load Game is disabled-with-reason or hands off once Milestone 4 exists;
      Settings persists; Exit cleans up);
- [ ] a gate report exists, ending in **PASS / REVISE / STOP / BLOCKED**;
- [ ] `./scripts/check-repository.sh` passes;
- [ ] new questions this raises are rows in [`../specs/open-questions.md`](../specs/open-questions.md).
