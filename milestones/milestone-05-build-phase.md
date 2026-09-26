# Milestone 5 — Build Phase

**Document role:** Milestone tracker — the mission's own Build Phase: placement, upgrade pick, scrolling
**Status:** CURRENT
**Active gate:** 5E — UI/UX refinement from the owner's own real-terminal playtest of gates 5A-5D:
click-to-place becomes a two-stage confirm, the menu/Grid keyboard focus toggle, the Nexus power pick
as an openable popup rather than a forced screen, and the status-line/footer polish described below.
Gate 5D itself is built and reported (PASS) but not yet formally accepted — see its own line below —
and this gate does not depend on that acceptance, the same way 5D did not wait on 5C's
**Depends on:** Milestone 3 (the game menu that launches it — accepted 2026-09-21), Milestone 2 (the
mission's own budget/units decided — accepted 2026-09-12)
**Updated:** 2026-09-26
**License:** Apache-2.0

> **Milestone 4 has not landed, and this milestone does not wait for it.** An earlier draft of the
> header above named Milestone 4 as a dependency, from back when the campaign menu was expected to be
> built before the Build Phase. The re-cut build order (canon 2.11,
> [`README.md`](README.md)'s own table) puts this milestone third — straight after the game menu — and
> the campaign menu seventh, so anything below that reads as "the player arrives here from the
> campaign menu" describes where the Build Phase will eventually be reached from, not a prerequisite
> for building it. Gate 5A in particular is a self-contained spike: it needs a Grid, a cursor, and a
> terminal, none of which Milestone 4 supplies.

> **Gate 5A: ACCEPTED, 2026-09-21** — [`../evidence/gate-5a-report.md`](../evidence/gate-5a-report.md)
> concludes PASS; Mario ran it, answered both questions it was built to ask, and accepted the gate.
> The viewport rule finally executes: a 96 x 40 Grid in a viewport of 48 x 16 tiles at 80 columns and
> 72 x 24 at 104, the camera following the cursor at three tiles, edge markers and a position readout
> in place of the minimap the canon refuses to have. Structures are armed by a digit or a click and
> placed at the cursor, and an illegal placement is refused with a reason rather than slid somewhere
> legal. Three findings changed canon at 2.17: Shift+Arrow is neither universal nor single-valued
> (measured across thirteen terminal descriptions — several send no shifted arrow at all), the mouse
> wheel moves the cursor rather than a camera of its own, and a click places the armed structure
> (Q50). The three-tile margin stands, with Mario's fuller judgement deferred.
>
> His one piece of feedback on the screen itself: *"The UI is starting to look good (although still
> has too much text focused on demo instead of trying to be as simple and direct as possible)."*
> **Gate 5B owns acting on it**, since 5B rebuilds that panel anyway — see its own line below.

> **Gate 5B: ACCEPTED, 2026-09-21** — [`../evidence/gate-5b-report.md`](../evidence/gate-5b-report.md)
> concludes PASS; merged, and accepted by Mario: *"We are finally implementing functionality and I
> love it... I think we are already going the right direction."* A larger manual test is deferred, the
> same way the scroll margin's fuller judgement was. The construct menu lists both groups under one
> digit sequence with a cost and a one-line effect per row, the budget runs down and dims what it can
> no longer afford, and a refused placement is answered with its reason and its tile. The demo text is
> gone, and the panel got shorter doing it — what it dropped was narrating things the Grid already
> showed. Four rules earned by building them are in canon 2.18; Q30 is answered.

> **Gate 5C: code merged across two rounds; not yet formally accepted.** Round 1
> ([`../evidence/gate-5c-report.md`](../evidence/gate-5c-report.md), PASS) walked cursor-driven
> scrolling across the whole supported viewport range — it needed no change — and put the footer and
> the side panel on one shared list of key bindings. Round 2 acted on Mario's own live feedback:
> replaced the arrow edge markers with a border that goes solid where the map ends and dim where it
> does not, gave the armed construct row an explicit `>` marker, fixed three small bugs the work
> turned up (an unaffordable armed row's cost read as affordable; the cursor was nearly invisible on
> bare ground; a stale refusal could outlive its own tile), and built a proportional scrollbar as a
> second, switchable option (`--edge-style scrollbar`) next to the default. Mario, on merging round 2:
> *"I like the changes."* Two things were his alone to judge. **The first is now resolved (2026-09-26):
> no scrollbar; the border instead reads as a heavier, doubled line on whichever side truly has no more
> Grid to reveal, and as the everyday lighter line otherwise — canon 2.19.** The second — whether the
> armed row's marker and the cursor's own brightness read as intended — is untouched by that and still
> open. Proceeding to gate 5D was his own call, made explicitly: neither open question touched anything
> 5D added.

> **This is where scrolling was always going to land.** Gate 1A deliberately used a Grid that fit the
> viewport entirely specifically to defer this:
> [`milestone-01-grid-battles.md`](milestone-01-grid-battles.md) says so at its own Section 1 — "Not
> in Gate 1A specifically: selection, inspection, and scrolling... They arrive with the Build Phase."
> This milestone is the Build Phase. Nothing about that plan changed; this is just where the bill
> comes due.

> **Gate 5D: built and reported, awaiting Mario's review** —
> [`../evidence/gate-5d-report.md`](../evidence/gate-5d-report.md) concludes PASS. The Build Phase now
> opens on a Nexus power draft (two placeholder powers, not real Milestone-8 content) that may not be
> skipped; `p` asks once, in plain yes/no terms, whether to end the Build Phase and start the Nexus
> Pulse, and accepting locks every other action. The panel gained the NEXUS and SPECIAL rows
> `commander-armies.md` Section 2.1 names as a Build Phase's third and fourth decision surfaces,
> SPECIAL always drawn as an empty "none available" row the same way the empty ARMY group already is.
> A dedicated test suite (`tests/build-nexus.test.ts`) covers the whole mechanism, including one test
> that plays pick-then-build-then-commit-then-confirm once by keyboard bytes, once by mouse bytes, and
> once by a driver script, and checks all three land on the identical final state. This was written as
> the last gate this milestone's own tracker listed; **it no longer is — see Gate 5E below**, opened by
> the owner's own feedback after playing this build. This gate was unrelated to gate 5C's own two open
> questions (which border/scrollbar style, whether the selection marker reads right); the first is now
> resolved (see 5C's own line above), the second is still open for Mario's manual test.

> **Gate 5E: scoped 2026-09-26, not yet built.** Mario ran the merged Build Phase in a real terminal
> and gave two rounds of direct feedback. One item was small and clear enough to fix immediately, on
> its own PR rather than folded in here: the frame border and the divider between the Grid pane and
> the side panel were using a colour already known to read as nearly invisible in bright ambient light
> — the same bug an earlier fix had already caught for two other roles and simply missed for the
> border. Everything else is real design and engineering work, captured in `engine.md` (Sections 3.3
> and 9.7, canon 2.19) and `open-questions.md` (Q52-Q55) rather than only in this paragraph, so a
> session picking this gate up reads settled canon first and a feedback transcript second:
>
> - **Click-to-place becomes a two-stage confirm** (Q52, reversing Q50): a first click arms/previews,
>   a second click on the same tile places. Space is added alongside Enter for keyboard placement. The
>   moment right after a placement no longer shows the illegal-preview block on the tile just built.
> - **A menu/Grid keyboard focus toggle**, reusing the highlight/activate shape `src/menu/list.ts`
>   already has: Tab switches focus, Up/Down highlights a menu entry, Enter/Space arms it and moves
>   focus to the Grid, placing returns focus to the menu. This retires Tab's previous, never-built
>   "jump to my next structure" GUIDANCE (Q53).
> - **The Nexus power pick becomes a popup the player opens** ("Nexus Powers (n)" in the panel), not a
>   screen forced open the instant the Build Phase begins — the "may not be skipped" rule's own
>   refusal narrows from every state-changing command down to just the commit itself, so the popup can
>   stay genuinely optional to open rather than every other action nagging until it does.
> - **The status line becomes a small, typed concept** (text plus a tone/emphasis, resolved onto style
>   attributes the renderer already has) rather than a plain string, and a live "cannot build here"
>   is echoed there in addition to the panel's own required detail (`engine.md` 9.2's RULE is
>   unchanged — this is additive). The footer's key-bindings line is trimmed to the essentials.
> - **Cursor movement speed tiers and a percentage-of-viewport scroll margin** (Q54) — a real design,
>   not yet felt against a terminal, so every number stays a parameter the way `--scroll-margin`
>   already is.
> - Smart-cursor auto-placement and frame-timer-based movement interpolation are registered (Q55) and
>   explicitly **not** in this gate's scope.

## 1. Question

Can a player place buildings and pick a Nexus upgrade during a hidden Build Phase — with keyboard
controls, a GUI that adapts across the whole supported terminal size range, and real cursor-driven
map scrolling — before handing off into Milestone 6's Pulse?

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
- **The Special slot — keep the space, and report whether the channel earns it.**
  [`../specs/commander-armies.md`](../specs/commander-armies.md) Section 2.1 names *four* places in a
  Build Phase, not three: the construct menu's two groups, the Nexus draft panel, and a Special the
  player arms and fires once per match. It is also flagged provisional there — a third decision
  channel beside placement and the draft, with nothing yet showing that a Build Phase wants one.
  PERIMETER has no Special to arm, so this milestone authors no content for it; it keeps the layout
  honest about a fourth place (the same way the army group is empty but not assumed away, below) and
  says in its report whether the Build Phase felt short of a channel. Milestone 6 plays the first
  whole loop and is where the answer lands — retiring Specials, or folding them back into the Nexus
  power pool, is a legitimate outcome of that report.
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

### 2.1 Gates

- **5A — The scrolling-and-placement spike** (Q37, answered): interactive, all three adapters,
  viewport extremes, the click-to-place toggle, the Shift+Arrow terminal findings. Report first, then
  build.
- **5B — Construct menu and legality.** The two-group menu (common tier, army tier), cost and effect
  per item, the legality panel that says why, placement validation that rejects with a reason.
  **Also: cut the spike's demo text.** Gate 5A's screen explained itself — a gate number in the
  header, a line promising nothing reaches the simulation, a subtitle naming the spike. That was
  right for a thing built to be looked at once and wrong for a screen a player uses, and Mario said
  so on accepting 5A: *"still has too much text focused on demo instead of trying to be as simple
  and direct as possible."* Every line this gate leaves on screen should be something a player needs
  while deciding where to build.
- **5C — Scrolling and the adaptive layout.** Cursor-driven scrolling at the 3-tile margin across the
  full 48×16–72×24 range; the side panel's layout at both ends; edge markers and the position
  readout.
- **5D — The Nexus draft slot and commit.** The upgrade-pick mechanism against a placeholder option
  (Milestone 8 fills it), `p` with its one confirmation, undo and removal of planned placements, the
  hotkey-versus-click identical-plan test, and the Special slot's own space in the layout with the
  report's line on whether a third decision channel was missed.
- **5E — UI/UX refinement from the owner's own playtest of 5A-5D**, opened 2026-09-26 (not part of the
  milestone's original scope in Section 1-2 above — added by direct owner feedback, per
  `AGENTS.md` Section 2's own priority order for what a session works on). See the status block above
  for the full scope; in one line: the click-to-place confirm reverses (Q52), a menu/Grid keyboard
  focus toggle is added, the Nexus pick becomes an openable popup, the status line and footer bindings
  get a polish pass, and cursor movement gets a real speed-tier model (Q54).

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

- [x] the scrolling-and-placement spike (Q37) ran first, its terminal findings and the click-to-place
      toggle are in the gate report, and `engine.md` 9.7's bindings were retuned or confirmed from it
      — **done, gate 5A, accepted 2026-09-21**: both Shift+Arrow sequence families and a required
      modifier-free fallback are now in 9.7, the wheel is settled as a cursor jump, and the toggle
      answered Q50 and was then deleted;
- [x] the construct menu, cost/effect, and legality panel are built and legible at every capability
      tier and in monochrome, with every item's hotkey displayed and clickable — **done, gate 5B,
      accepted 2026-09-21**;
- [x] the driver plays a full Build Phase from a command stream, and a test proves hotkey and click
      entry of the same plan are identical — **done, gate 5D**: the pick-build-commit-confirm script
      produces an identical final state by keyboard bytes, mouse bytes, and a driver script;
- [ ] cursor-driven scrolling works correctly across the full 48×16-72×24 viewport range — gate 5C's
      own code is merged and its automated evidence passes, but the gate itself is not yet formally
      accepted (see the note above);
- [ ] the GUI's own layout adapts across that range without becoming illegible at either end — same
      status as the line above, gate 5C's;
- [x] the Nexus-upgrade pick mechanism works against at least a placeholder option — **done, gate
      5D**: two placeholder powers, offered once, picked by digit or click, applying their effect
      exactly once;
- [x] the report says whether the Build Phase felt short of a third decision channel, so the
      provisional Special slot (`../specs/commander-armies.md` Section 2.1) gains evidence either way
      — **done, gate 5D**: the slot fits in the layout without strain, which is the only question this
      gate could actually answer; whether a Build Phase genuinely wants a third channel is the
      canon's own Milestone 6 question, per `commander-armies.md` Section 2.1 itself;
- [x] a gate report exists, ending in **PASS / REVISE / STOP / BLOCKED** — gates 5A-5D each have one,
      all four concluding **PASS**;
- [x] `./scripts/check-repository.sh` passes;
- [x] new questions this raises are rows in [`../specs/open-questions.md`](../specs/open-questions.md)
      — gate 5D raised none of its own; the two still open are gate 5C's, already registered there.

Gate 5E's own definition of done, added 2026-09-26 and unstarted:

- [ ] a mouse click on a Grid tile arms/moves only; a second click on the same tile places (Q52),
      and Space places alongside Enter from the keyboard;
- [ ] the tile a structure was just placed on shows success, not an illegal-preview block, until the
      cursor moves off it, and a repeated place command there is a no-op;
- [ ] a menu/Grid keyboard focus toggle exists (Tab switches, Up/Down highlights, Enter/Space arms and
      moves focus, Esc/Delete returns it), reusing `src/menu/list.ts`'s highlight/activate shape;
- [ ] the Nexus power pick is reachable as a "Nexus Powers (n)" panel entry that opens a popup, not a
      screen forced open at the start of the Build Phase, with the "may not be skipped" invariant
      (`commander-armies.md` 4.5) still enforced;
- [ ] the status line is a small typed concept (text plus tone/emphasis) rather than a plain string,
      and echoes a live "cannot build here" alongside the panel's own required detail;
- [ ] the footer's key-bindings line is trimmed to the essentials;
- [ ] cursor movement has a real speed-tier model and a percentage-of-viewport scroll margin, with
      every number exposed as a parameter (Q54);
- [ ] a gate report exists for 5E, ending in PASS / REVISE / STOP / BLOCKED.
