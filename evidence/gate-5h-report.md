# Gate report — Milestone 5, Gate 5H: movement feel

**Document role:** Gate evidence report for Gate 5H
**Status:** IN PROGRESS
**Canon version:** 2.22
**Updated:** 2026-09-28
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.22. The building session does not edit `specs/`, `AGENTS.md`, `milestones/`
  or `docs/feedback/`; it proposes their text in Section 9 and the orchestrating session applies it.
- **Milestone and gate:** Milestone 5 — Build Phase, gate 5H, movement feel.
- **Question this gate answers:** once the Build Phase screen has a clock of its own, can moving
  around a Grid larger than the screen feel fast when the player wants distance and precise when they
  want a tile — held-key speed tiers, a margin that is a share of the view, clicks that scroll by how
  near the edge they land, a camera that slides rather than jumps — with every number live in Debug
  Mode so the owner tunes it by feel?
- **Smallest artifact that can answer it:** the existing `terminal-nexus --spike` screen (and the
  browser playtest page, which runs the same loop) with: a frame timer that runs only while something
  animates; a key-repeat tracker in the input path deciding each arrow's step; a share-of-view scroll
  margin; an armed click that never scrolls (Q58 option B); proportional click-scrolling when exploring
  (feedback F6); recentring on the fast modifier; an eased drawn camera; a cursor flash on a refused
  placement; a lone-Esc timeout; and a Debug Mode popup that scrolls, since the new numbers do not fit
  at 80x24.
- **Automated evidence planned:** injected-clock tests for the speed ramp, the Esc timeout, the camera
  ease and the frame timer (runs only while animating); reducer tests for the share margin, the armed
  click, edge and centre click-scrolling, and recentring; the Debug Mode popup scrolling by keyboard,
  mouse and driver to the same state and frame; every existing "same plan, every adapter" test still
  passing; the architecture check that `src/build` names no clock; the full suite on Node and Bun;
  `tsc`; the validator; the browser page build; screenshots and a GIF, looked at.
- **Human observation planned:** Mario, in iTerm2 and on the browser page — hold an arrow and say
  whether normal-then-fast feels right and whether a tap still lands one tile; click near an edge
  while exploring; place by two clicks near an edge; and flip the Debug Mode flags this report names.
  Nobody but this session has looked yet (Section 5).
- **Explicit exclusions:** placement "juice" (per-building frames, particles — its own later gate);
  a `Shift+click` one-click placement; the `[m] Map` popup (Q59); any change to the Pulse view's own
  timing; saving the flags; measuring the owner's own iTerm2 key-repeat numbers (the flags exist so he
  can tune them there).
- **Stop conditions:** any need for a clock or timer inside the reducer; any change that makes the
  keyboard, mouse and driver paths reach different states; a Node-only import reachable from the
  browser page.

## 2. Environment — pinned, not remembered

(filled in at the end)

## 3. What was built

(filled in as the work lands)

## 4. Automated results

## 5. Human observations

## 6. Interpretation

## 7. Failures, surprises, and discarded approaches

## 8. Decision

## 9. Canon impact

## 10. Next authorized action
