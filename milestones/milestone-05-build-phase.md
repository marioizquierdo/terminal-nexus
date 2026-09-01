# Milestone 5 — Build Phase

**Document role:** Milestone tracker — the mission's own Build Phase: placement, upgrade pick, scrolling
**Status:** GATED
**Depends on:** Milestone 4 (launches the mission), Milestone 2 (the mission's own budget/units decided)
**Updated:** 2026-09-01
**License:** Apache-2.0

> **This is where scrolling was always going to land.** Gate 1A deliberately used a Grid that fit the
> viewport entirely specifically to defer this:
> [`milestone-01-grid-battles.md`](milestone-01-grid-battles.md) says so at its own Section 1 — "Not
> in Gate 1A specifically: selection, inspection, and scrolling... They arrive with the Build Phase."
> This milestone is the Build Phase. Nothing about that plan changed; this is just where the bill
> comes due.

## 1. Question

Can a player, from the campaign menu, place buildings and pick a Nexus upgrade during a hidden Build
Phase — with keyboard controls, a GUI that adapts across the whole supported terminal size range, and
real cursor-driven map scrolling — before handing off into Milestone 6's Pulse?

## 2. What gets built

- **Placement and spending**, per Milestone 2's own decision (Section 4.2 there): a short, fixed
  construct menu, cost/effect shown per item, a legality panel that says *why* an illegal placement
  failed — exactly [`../specs/engine.md`](../specs/engine.md) Section 9.2's already-specified side
  panel shape, built for the first time, at the smallest scope PERIMETER actually needs (no radius
  preview unless something placed has a radius worth previewing).
- **One Nexus upgrade slot**, picked during Build Phase. Milestone 8 is what populates this with a
  real, small draft tied to Commander Vasse — this milestone builds the *mechanism* (offer a choice,
  accept a pick, apply its effect) against a placeholder option if Milestone 8 has not landed yet, so
  neither milestone blocks on the other's exact sequencing.
- **Real map scrolling, at last**: the viewport clamp (48×16 to 72×24 tiles) and cursor-driven
  scrolling at a 3-tile margin are already RULE (`engine.md` Section 3), unbuilt since Gate 1A's Grid
  always fit the viewport whole. Built here, for real, against a Grid sized to actually need it.
- **A GUI that adapts to terminal size** across that same clamped range — not just the tile-width
  adaptation `engine.md` 9.3 already covers (one column per tile at 80 wide, two at 128+), but the
  side panel's own layout across the viewport's minimum-to-maximum span. This is a reversible UI-layout
  decision a session may make alone (`../specs/project-governance.md` Section 2) — pick something,
  ship it, and record why in the gate report rather than treating it as a blocker.
- **All three input adapters, on the screen that needs them most** — per
  [`../specs/engine.md`](../specs/engine.md) Section 9.7 (canon 2.10), which supersedes an earlier
  draft of this line that left the mouse optional. Keyboard: digits arm a construct-menu item, arrows
  move the cursor one tile and Shift+Arrow five, Enter places, Esc disarms, `p` commits after one
  confirmation, and the armed item stays armed so a run of placements is one digit then arrows and
  Enter. Mouse: a click on a menu row is its hotkey; a click on a tile moves the cursor and places
  the armed item; the wheel scrolls; right-click is Esc. Driver: the same Build Phase played from a
  command stream — the agent-playtest path — with raw key and mouse events injectable so the
  mappings themselves are under test. The construct menu shows the common tier and the army tier as
  two groups under one digit sequence, and the Nexus draft is its own panel
  ([`../specs/commander-armies.md`](../specs/commander-armies.md) Section 2.1) — for PERIMETER the
  army group is empty, and the layout should not assume it always is.
- **Opens with the scrolling-and-placement spike — Q37, answered.** Before the real build: an
  interactive spike of exactly the two interactions Mario named as needing the most attention —
  scrolling a Grid larger than the viewport and placing a selected structure — driven through
  keyboard, mouse, and the driver, at the viewport range's minimum and maximum, with click-to-place
  versus click-then-confirm made observable as a toggle rather than argued. It also records which of
  the project's target terminals actually deliver Shift+Arrow and picks the modifier-free fallback
  for the five-tile jump. Static mockups at the range's extremes are a cheap by-product, not the
  deliverable. Its findings go in this milestone's gate report and retune the GUIDANCE bindings in
  `engine.md` 9.7.

## 3. Grounded in already-locked contracts

The old Milestone 3 (`specs/milestone-3-builder-editor.md`, now retired — its content lives here and
in `../specs/backlog-pulse-completion.md`) named the exact things to lock before this could be called
solid: radius metric and footprint measurement, same-plan construction chaining, simultaneous
same-cell conflicts, path-sealing legality, and refunds for an invalid revealed plan
(`engine.md` Section 6 restates the same list). Lock only the ones PERIMETER's own small budget
actually exercises; the rest stay backlog until a mission needs them.

## 4. Explicitly not this milestone

A battle editor for authoring new maps (that content list stays backlog); a second resource or
storage/warehouses; the full upgrade draft's content (Milestone 8); worker production or resource
gathering during the Pulse itself (Milestone 7 — Build Phase here only *spends* a starting allotment,
per Milestone 2's decision).

## 5. Acceptance

Automated: placement validation rejects an illegal plan with a stated reason, never silently clamps
it; scrolling keeps the cursor's margin correctly at every viewport size in the clamped range; the
same Build Phase plan produces identical composed frames across capability tiers and reduced motion;
the same plan, entered once by hotkeys and once by clicks through the driver, produces an identical
committed plan and identical frames — the "same command, whichever adapter" RULE, asserted.

Human, and this is the real gate — mirroring the old Milestone 3's own pass evidence: a fresh player
can expand toward the legal zone, understand *why* an illegal placement failed, revise a hidden plan,
and commit without an accidental permanent placement; scrolling to see more of the Grid feels like
looking around, not like fighting the cursor.

## 6. Definition of done

- [ ] the scrolling-and-placement spike (Q37) ran first, its terminal findings and the click-to-place
      toggle are in the gate report, and `engine.md` 9.7's bindings were retuned or confirmed from it;
- [ ] the construct menu, cost/effect, and legality panel are built and legible at every capability
      tier and in monochrome, with every item's hotkey displayed and clickable;
- [ ] the driver plays a full Build Phase from a command stream, and a test proves hotkey and click
      entry of the same plan are identical;
- [ ] cursor-driven scrolling works correctly across the full 48×16-72×24 viewport range;
- [ ] the GUI's own layout adapts across that range without becoming illegible at either end;
- [ ] the Nexus-upgrade pick mechanism works against at least a placeholder option;
- [ ] a gate report exists, ending in **PASS / REVISE / STOP / BLOCKED**;
- [ ] `./scripts/check-repository.sh` passes;
- [ ] new questions this raises are rows in [`../specs/open-questions.md`](../specs/open-questions.md).
