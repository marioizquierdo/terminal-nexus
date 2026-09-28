# Terminal Nexus — interface patterns

**Document role:** The interaction and drawing patterns every interactive screen follows
**Status:** WORKING — built on the Build Phase first; not canon yet (promoted into `specs/engine.md`
Section 9 when the owner accepts them)
**Updated:** 2026-09-27 (Debug Mode, gate 5G)
**License:** Apache-2.0

These came out of the owner's playtests of the Build Phase (2026-09-26 and 2026-09-27; the item-by-item
log is [`feedback/2026-09-27-build-phase-playtest.md`](feedback/2026-09-27-build-phase-playtest.md)).
They are written as rules so the next screens — the Nexus Pulse view, Debug Mode, the campaign menu —
behave the same way without anyone re-deriving them. Where the Build Phase implements one, the file is
named. When a new screen needs to break one, change this document in the same pull request and say
why.

## 1. Focus

- **One place has the keyboard at a time**, and the screen shows exactly one "you are here" for it:
  the menu's highlight bar, or the map cursor — never both. (`BuildState.focus`; the cursor is drawn
  only while the Grid has focus.)
- **The key help starts with where the keyboard is**, in capitals, then the keys that work there:
  `MENU`, `PLACE`, `EXPLORE`, `INFO`, or the open popup's name. (`keyHelp` in `src/view/build.ts`.)
- **Focus is state, not adapter memory**, so a script can set it and a test can read it.
- **The menu orchestrates.** Actions start on the menu; the map cursor is for placing and exploring.
  After a placement the keyboard goes back to the menu, on the same row.
- **A mode has one meaning per key.** Arrows and Enter/Space follow focus; nothing else does. Digits
  always arm their row; letters always name commands, from any focus.
- **Several ways in, all shown**: Tab toggles; an explicit menu entry (`[e] Explore`); a click on the
  area; and on the menu, Right twice (the first flickers to say "you are on the menu").

## 2. Back, cancel and close

- **Esc, `x` and a right click are one command** (`cancel`) and always mean the same thing.
- **Esc walks back one level at a time**: a popup, then an information panel, then the map (to the
  menu), then on the menu it asks "Exit the game?". Esc never leaves the game by itself.
- **Leaving always asks**: `q` opens the exit question; only the question's own `[q]` quits. Ctrl+C
  is the one immediate way out.
- **A building is armed only while the map has focus.** Anything that takes the keyboard off the map
  disarms, so a stale ghost can never sit on the map while you work the menu.

## 3. Mouse

- **A click moves focus to where it lands.** A first click on the menu while the keyboard is
  elsewhere only highlights the row; a click on a row the keyboard is already on activates it.
- **A second click on the same tile confirms**, compared by tile, never by screen cell.
- **A click outside a popup closes it** and moves focus to where it landed — and does nothing else, so
  a dismissing click never also places or picks.
- **Whole rows are click targets**, the same width the highlight bar is drawn.
- **Hit-testing and drawing read one geometry** (`src/build/layout.ts`, `src/build/overlay.ts`), so a
  click can never land on something the frame drew elsewhere.

## 4. Menu rows

- **Every row shows its hotkey** as `[x]` in the hotkey colour; the bracket survives monochrome.
- **Four states**, legible without colour:
  - **plain**;
  - **selected** — an inverse bar across the whole row, one colour;
  - **pressed** — for a few frames after activation, a stronger bar: bold and underlined, in the
    hotkey's colour;
  - **refused** — for a few frames when a key reached the row but had nothing to do (Left/Right, an
    unaffordable row): the bar dims and comes back.
- Plus **disabled** (dimmed) for a row that cannot be used now — an unaffordable one — and **`>`** for
  the one item that is armed.
- **Timing lives in the live loop, not the reducer.** The reducer records an acknowledgement with a
  sequence number (`BuildState.ack`); the terminal loop shows it for its duration from when it first
  sees it (`src/cli/spike.ts`). Still frames — tests, screenshots — never carry one unless asked.

## 5. Popups

- **One shape for every popup** (`src/build/overlay.ts`): a title and rows as data; options name the
  command a click on them sends.
- **Drawn to be unmissable**: a solid border in the same weight as a map edge, the title in the top
  border, `[esc]` in the top-right corner (the key, the label and the click target at once), and a
  one-cell shadow that blanks what is behind it. Centred over the map.
- **A popup holds the keyboard and the mouse** until closed; keys it does not use do nothing.
- **Questions are popups** — the start-the-Pulse question and the exit question use the same shape.
- **Nothing opens a popup but the player.**
- **A choice closes its popup** (Q60, owner 2026-09-27): picking a Nexus power, like answering a
  question, returns the player to where they were. What the pick did is on the status line and on the
  menu; reopening the popup shows it listed as active.
- **A setting is a row whose value Left and Right change** (Debug Mode, gate 5G): its name, the value
  between `<` and `>` (the arrows say which keys change it), and, quietly on the right, when a change is
  seen — `now` or `restart`. Enter/Space is Right. A choice of two comes round at either end; a number
  stops at its ends and the status line says so. **By mouse, the left half of the value box is Left
  and the right half is Right** — two targets six cells wide each, big enough for a finger on the
  browser playtest page; a click anywhere else on the row highlights it. Every change is said on the
  status line. (`settingColumns` in `src/build/overlay.ts`.)
- **What a highlighted row is for is written under the list**, wrapped at words, in a fixed number of
  lines so the popup does not change height as the highlight moves — the popup's version of the
  menu's effect line. (A `note` row.)
- **A popup that belongs to a menu row keeps that row lit behind it** (the Nexus popup, the
  start-the-Pulse question); **one that belongs to no row** (Debug Mode) **leaves the menu unlit**, so
  its own highlight is the only one on screen.

## 5a. Development tools

- **Debug Mode is found, not hidden**: `[d] debug` sits at the right of the top bar — the hotkey in
  the hotkey colour, the name quiet — and is a click target, like every other entry point. It is in
  the top bar rather than the menu because it is a tool for playtesting, not a game action, and will
  shrink as its questions are answered.
- **Agents ask the owner to flip flags.** A choice that is his to feel ships behind a flag, defaulting
  to the recommended answer, and the pull request tells him which one to flip with `d` (his own
  request, 2026-09-28). A new behaviour whose worth is in doubt gets an on/off flag.
- **Every flag names the question it serves** and whether it applies now or on restart; the popup's
  title says nothing in it is saved. A restart row starts the Build Phase over keeping the flags,
  which is how a "restart" flag takes effect.

## 6. Panels

- **The side panel shows one thing at a time**: the menu, or — while exploring — the information
  panel for what is under the cursor, with `[esc]` in its top-right corner.
- **The information panel card**: the thing's own glyphs as its icon, its name, what it is for in one
  line (wrapped at words, never cut), then its numbers as label/value rows. Later: a larger ASCII art
  version, and live numbers during a Pulse.
- **Text in the panel never cuts a word**; a line that does not fit wraps or is dropped.

## 7. The map rectangle

- **The map is a closed rectangle.** A side with more map beyond it is a thin, dim line; a side that
  has reached the map's edge is a **solid bar** — the same weight horizontally and vertically, in every
  glyph pack, without colour. A corner is solid where a solid side runs into it.
- **A map shorter than the panel** closes directly under its own last row; the panel keeps its height.

## 8. The status line

- **One line answers "what just happened, or why not"**: a typed message (text, a tone, and the tile
  it is about), never a bare string. A message about a tile lapses when the cursor leaves it.
- **Say the result and the way back**: `Hatchery placed (resources: 70) - [u] undo`,
  `Debug - Opens on: map - applies on restart: [r]`.
- **Looking reads quietly; trying reads loudly**: a refusal is neutral while the player only hovers,
  red and bold once they press Enter.

## 9. Words

- Plain words on screen; no internal ids or code names. Each Nexus is named for its faction
  ("Citizen Nexus").
- Short labels in the key help: `arrows move`, `enter/space place`, `esc cancel`.
