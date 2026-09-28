# Owner playtest feedback — Build Phase after gate 5F

**Document role:** Owner feedback log, one item per row, each with what happened to it
**Status:** OPEN — every item must end up built, scheduled into a gate, or contested with a reason
**Updated:** 2026-09-27
**License:** Apache-2.0

Mario played the merged gate 5F build (`./bin/terminal-nexus.ts --spike`) and sent this on
2026-09-27. Each item below is his point in short, followed by what was done with it. A later
orchestrator session goes through every item still marked **Scheduled** or **Open** in order; nothing
here may be silently dropped — an item leaves this list only by being built, or by being contested
with a reason he has seen.

Status values: **Built** (in the round-2 PR, with a test where behaviour changed) · **Scheduled**
(owned by a named gate, written into that gate's block in the milestone tracker) · **Open** (needs a
decision first; the question is named) · **Contested** (we think it should not be done as asked; the
reason is written here for him to answer).

The patterns he asked to keep consistent are collected in [`../ui-patterns.md`](../ui-patterns.md).

## Items

### F1 — A click moves focus; a first click on the menu only highlights

> Clicking on the menu or on the grid should bring the focus there. Clicking on the menu first when
> the focus was not there should simply highlight a menu option, not activate it. When an option is
> clicked there should be a clear click highlight, stronger than "selected", for a few quick frames
> (~50 ms). The Nexus Powers option is not highlighted when clicked.

**Built.** A click on the menu while the keyboard is elsewhere moves focus there and highlights the
row; a click on a row the keyboard is already on activates it. A click on the Grid moves focus to the
Grid. An activation shows a brief, stronger "pressed" highlight (drawn by the live screen for ~90 ms
from a reducer acknowledgement, so the reducer still has no clock). The Nexus entry now highlights
like every other row.

### F2 — Clicking outside a popup closes it; `[esc]` in the popup's top-right corner

> Clicking outside of a popup should do the same thing as closing it, and bring focus to that area.
> The popup should show [esc] on the top right, which is the hotkey and the clickable area to close it.

**Built.** A click outside an open popup closes it and moves focus to wherever the click landed
(without activating anything). `[esc]` sits in the popup's top-right border and is clickable.

### F3 — Menu row states: selected, disabled, pressed, and a "not understood" flicker

> Item focus (selected), disabled, active (shows for a few frames only when clicking on it), and
> flash/flicker (to quickly show that the click/keystroke was understood but there's no action).

**Built**, as four row states: *selected* (the inverse bar), *disabled* (dimmed — an unaffordable
row), *pressed* (a brief bold, underlined bar after an activation) and *refused* (a brief flicker when
a key reached the menu but had nothing to do, e.g. Left/Right, or activating an unaffordable row).
Timing is presentation-only: the reducer records an acknowledgement, the live loop shows it for a few
frames. Richer animation of these states waits for the frame timer (gate 5H).

### F4 — Left/Right on the menu flickers; Right again moves focus to the Grid

> When focus is on the menu, pressing right/left should flicker the item so the user understands the
> focus is on the menu. Pressing right again should bring focus to the grid.

**Built.** First Right: the highlighted row flickers. A second Right in a row: focus moves to the
Grid, in exploring mode. Left only flickers.

### F5 — Placement status line and fully drawn buildings

> The status bar should say "hatch placed (resources: 30) - [u] undo". "Planned" may be more correct
> but it's easier to just see it being built. Not sure why they are greyed out; it will look better
> if they are fully built.

**Built.** The status line reads `Hatchery placed (resources: 70) - [u] undo` — *resources* is what
is left after the placement (read that way because the cost is already on the menu row; say if you
meant the cost). Planned buildings are drawn at full strength, like standing ones. Undo and remove
still work until the Pulse starts, which is what keeps a plan revisable without the grey.

### F6 — Click-to-scroll zones proportional to distance from the edge, and larger

> Clicking 2 rows from the limit should scroll a lot faster than clicking 5 rows from the border. It
> seems limited to 1-3 rows. Make those areas larger.

**Built — gate 5H (2026-09-28).** Exploring, a click inside an edge zone a third of the view deep
brings the clicked tile toward the middle in proportion to how deep it landed — at 80x24, clicks 2 and
8 columns in from the edge scroll 19 and 8 tiles, a click in the middle none. With a building armed
nothing scrolls (Q58, option B), so the confirming click lands where the first did — the
reconciliation proposed here. Debug Mode flags "Explore click" (Q62) and "Click edge zone" let him
tune it; awaiting his feel.

### F7 — The cursor shows only when the Grid has focus; three clear modes

> Focus on the menu => no cursor; focus on the grid to place a building => menu item selected and the
> cursor has the building ghost; focus on the grid while exploring => no menu item selected, the
> navigation cursor highlighted instead. The cursor should use the same colour as the selected menu
> item.

**Built**, as the rule "a building is armed only while the Grid has focus". Leaving the Grid
(Tab, Esc, a click on the menu, a placement) disarms. The cursor is drawn only while the Grid has
focus, in the same inverse style as the menu's selected row.

### F8 — After a placement, focus always returns to the menu

> Keep the menu as the main orchestrator: when a building is placed, the focus should always come
> back to the menu.

**Built — this answers open question Q57 as option A ("always back to the menu")**, reversing the
"back to wherever the arming came from" recommendation gate 5F built. Consequence, stated so it can be
judged: the digit fast path is now "digit, arrows, Enter" per building, rather than "digit" once
then "arrows, Enter" repeatedly — a digit still arms from anywhere and still leaves the cursor where
it was. The register row and `engine.md` 9.7's "stays armed after placing" line need updating at the
next canon change (listed in the round-2 report).

### F9 — Placement animation, particles, and colour interpolation

> Every building should define an array of frames played when it is placed, and particle effects.
> The particle system should get colour interpolation (a rainbow, lighting on the characters), a
> simplified shader: change colour, transparency, light/dark, and move positions by frame
> interpolation. Building placement could show lighting effects.

**Scheduled — a new gate after 5H, "placement juice"**, because it needs 5H's frame timer on this
screen. Groundwork that already exists: the Pulse view's effect system (`src/view/effects`) with
effects as pure functions of presentation time, and `CellStyle.fade` for transparency at the
256-colour and truecolour tiers. What is new: per-structure placement frames (authored beside
`src/content/art.ts`), and colour/brightness interpolation as a style-role operation (never a literal
colour — the renderer still resolves roles per theme and capability). Written into the tracker.

### F10 — The Grid rectangle's heavy edges must be consistent on all four sides

> The grid borders need to use the "thick" version horizontally too, when the scroll is all the way
> left or right, consistent with vertically. It's already doing it with colour but it should be
> clearer. If "=" cannot be consistent with the horizontal, change it to something else. The
> rectangle needs to be a rectangle.

**Built** (and closes Q56): a side that has reached the map's edge is now drawn as a **solid bar**
(an inverse-video cell) on all four sides and at the corners where it runs, in both glyph packs — the
same weight horizontally and vertically, with no dependence on colour. The light "more map this way"
side stays the thin dim line. Needs his eye.

### F11 — `[e] Explore` under `[n] Nexus`; stronger, larger popups with a shadow

> Add "[e] Explore" right below "[n] Nexus" (just Nexus is better). Pressing [e] changes the focus to
> the map in navigation mode. Popup borders need to be stronger, the popup larger, with a shadow.

**Built.** The entry is renamed `[n] Nexus`; `[e] Explore` sits under it and moves focus to the Grid
with nothing armed. Popups are wider, bordered in the heavy weight, and cast a one-cell shadow that
blanks what is behind them.

### F12 — Enter/Space on the Grid opens an information panel

> When navigating the grid, Space or Enter on any element should change the menu on the left to an
> information panel, with [esc] on the top right to bring back the menu. Clicking on a building should
> show its details. Later: presentation cards with the in-game icon, name, description, live stats,
> and a larger ASCII art version.

**Built (first version).** Exploring, Enter/Space — or a click on a building — replaces the menu with
an information panel: the building's own glyphs as its icon, its name and one-line description, and
its stats (health, size, cost; attack where it has one). `[esc]` top-right returns to the menu.
**Scheduled** for later: the larger ASCII art (none is authored yet — Milestone 12 content) and live
stats during a Pulse (Milestone 6).

### F13 — Esc and `x` are the same; Esc walks back a stack; an exit confirmation

> [esc] and "x" (close) should be equivalent. Tab alternates; Esc goes back in the stack — menu first,
> then the grid, then any popup. On the menu, Esc presents an "exit the game?" popup: Esc again
> closes it, "[q] quit" exits back to the main menu. Remove "q quit" from the hotkey list.

**Built.** `x` is Esc everywhere. Esc closes a popup, then leaves the Grid for the menu, then on the
menu opens "Exit the game?" with `[q] Quit` and `[esc] Keep playing`. `q` outside that popup opens the
same popup rather than quitting outright (so a stray `q` can't lose a plan); Ctrl+C still quits
immediately. "q quit" is gone from the key help. **Note:** the spike is launched on its own, not from
the main menu, so "quit" leaves the program; once the Build Phase is reached from the game menu it
returns there instead.

### F14 — A `ui-patterns.md` so the interface stays consistent

**Built:** [`../ui-patterns.md`](../ui-patterns.md), a short list of the interaction patterns above,
written as rules the next screen (the Pulse view, Debug Mode, the campaign menu) follows too. Not
canon yet; promoted into `engine.md` when he accepts it.

### F15 — Play it as a new user; keep refactoring toward the patterns

**Built / ongoing.** The round-2 report lists what a first-time pass turned up. The overlay code was
extracted into one shape now that there are three uses (Nexus, the exit question, the start-Pulse
question) — the extraction gate 5G was going to do.

## Found along the way (not in his message)

### F16 — Pressing `q` during Pulse playback never finishes on its own

Found by the browser-rendering research (2026-09-27), not by a player: the Pulse playback loop cleans
up the terminal on `q` but then waits for the program to exit, and never resolves by itself. The
terminal hides it because the process exits. It breaks the first time one process must go Pulse →
back to Build Phase, which is Milestone 6. **Built** (the browser playtest pull request): leaving now
also finishes the playback, and `tests/lifecycle.test.ts` fails without the fix.

### F17 — First-time pass over the round-2 build (played as a new user, through the playtest tool)

**Built** — the first item, after he agreed the menu side of the map gets a solid bar like the others:

- On a map scrolled to its west edge, the map's solid west bar sat directly against the menu, so the
  divider looked like a thick panel border rather than "the map ends here" (`build-idle.png`). The
  divider and the map's west side are now two columns: the divider is a plain line, the map's own
  west side is solid where the map ends and a blank gutter where there is more map (the divider then
  goes light, like the other three sides). The column comes from the menu, which is one character
  narrower; the map keeps all 48 of its columns at 80 × 24.

**Built** — the orchestrator's pass (2026-09-27):

- A popup's shadow was blank cells, invisible on the dark theme's near-black ground. It is now a dim
  shade (`:` in the ASCII glyphs, `░` in Unicode), which reads on both themes and in monochrome.
- Backspace on the menu did nothing and said nothing (it removes the building under the map cursor,
  which the menu hides). It now flickers the highlighted row, like Left, and removes nothing.
- Found while checking the shadow: the screenshot tool drew reversed cells dark-on-dark on the light
  theme (it assumed a dark terminal background). Fixed in `scripts/lib/terminal-capture.mjs`; the
  game itself was always right in a light terminal.

**Contested — kept as is, for his eye:** "Reserve Fund picked." stays on the status line until the
next action. The status line is the record of the last thing that happened, so a message that stays is
doing its job; clearing it on a timer would need the frame timer gate 5H adds. If he wants
confirmations to fade after a few seconds, it rides 5H.

## Design documents owed an update (for the orchestrator)

**Done at canon 2.21 (2026-09-27).** The design documents now describe what the code does:
`specs/engine.md` 3.3 (the solid-bar map edge on all four sides, Q56; the map's west side as its own
column beside the menu's plain divider, F17; a short map closing on its own edge), 9.2 (planned
buildings at full strength, F5; the information panel, F12; the one popup shape, F11; the one-line
empty group; the per-mode key help), 9.4 (a popup drawn last in the chrome band, with no band of its
own) and 9.7 (the menu orchestrates and every placement returns to it, disarmed, F8 and Q57; the
bindings table — Esc and `x` as one back, `q` asks, Tab, `[e] Explore`, a second Right, Enter/Space
inspecting while exploring, a click that focuses before it activates, a click outside a popup; the
Nexus popup closing on the pick, Q60); and `AGENTS.md` Section 4's input-model and Build Phase panel
summaries. `docs/ui-patterns.md` is pointed to from `engine.md` Section 9 as the working list, and
stays unpromoted until the owner accepts it.

The browser playtest page's own rule is already in `specs/engine.md` 10.2 (canon 2.20).
