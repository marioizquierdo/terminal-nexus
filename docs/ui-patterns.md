# Terminal Nexus — interface patterns

**Document role:** The interaction and drawing patterns every interactive screen follows
**Status:** WORKING — built on the Build Phase first; not canon yet (promoted into `specs/engine.md`
Section 9 when the owner accepts them)
**Updated:** 2026-09-28 (a click activates; Explore Map — round-3 feedback F22, F23; Settings,
Experiments and the export, replacing Debug Mode's popup)
**License:** Apache-2.0

These came out of the owner's playtests of the Build Phase (2026-09-26 and 2026-09-27; the item-by-item
log is [`feedback/2026-09-27-build-phase-playtest.md`](feedback/2026-09-27-build-phase-playtest.md)).
They are written as rules so the next screens — the Nexus Pulse view, the campaign menu —
behave the same way without anyone re-deriving them. Where the Build Phase implements one, the file is
named. When a new screen needs to break one, change this document in the same pull request and say
why.

## 1. Focus

- **One place has the keyboard at a time**, and the screen shows exactly one "you are here" for it:
  the menu's highlight bar, or the map cursor — never both. (`BuildState.focus`; the cursor is drawn
  only while the Grid has focus.)
- **The highlight bar means "the keyboard is here, not chosen yet"** — and only that (feedback F22).
  It is a keyboard idea: after the mouse works the menu it is not drawn, and the first menu key only
  shows it again, on the row it remembers, and does nothing else (`BuildState.highlightHidden`).
  Something chosen — an armed building — is marked as chosen (section 4), never with the bar.
- **The key help starts with where the keyboard is**, in capitals, then the keys that work there:
  `MENU`, `PLACE`, `EXPLORE MAP`, `MAP`, or the open popup's name. (`keyHelp` in `src/view/build.ts`.)
- **Focus is state, not adapter memory**, so a script can set it and a test can read it.
- **The menu orchestrates.** Actions start on the menu; the map cursor is for placing and exploring.
  After a placement the keyboard goes back to the menu, on the same row.
- **A mode has one meaning per key.** Arrows and Enter/Space follow focus; nothing else does. Digits
  always arm their row; letters always name commands, from any focus.
- **Several ways in, all shown**: Tab toggles; an explicit menu entry (`[e] Explore Map`, the menu's
  first); a click on the area; and on the menu, Right twice (the first flickers to say "you are on
  the menu").
- **The map has three modes, each named in the key help**: `PLACE` (a building armed, its ghost at
  the cursor), `EXPLORE MAP` (nothing armed; the side panel describes what is under the cursor —
  section 6), and `MAP` — the map a mouse click opened from the menu, with the menu left beside it so
  the next click can arm a building from it. Every keyboard way onto the map with nothing armed
  (`e`, the entry, Tab, Right twice) arrives in Explore Map; Enter/Space on the `MAP` opens it.

## 2. Back, cancel and close

- **Esc, `x` and a right click are one command** (`cancel`) and always mean the same thing.
- **Esc walks back one level at a time**: a popup (to the popup it was opened from, if any — Settings
  to the game menu, the export to Settings), then the map — placing, Explore Map or the map a click
  opened — to the menu, then on the menu it opens the **game menu**. Esc never leaves the game by
  itself.
- **The game menu is the way out, and the way to Settings** (owner, 2026-09-28): `[s] Settings`,
  `[q] Quit`, `[esc] Back to the game`. Esc on the menu, `q` anywhere, and a click on `[esc] menu` at
  the right of the top bar open it.
- **Leaving always asks**: only the game menu's own `[q]` (or Enter or a click on its Quit row) quits.
  Ctrl+C is the one immediate way out.
- **A building is armed only while the map has focus.** Anything that takes the keyboard off the map
  disarms, so a stale ghost can never sit on the map while you work the menu.

## 3. Mouse

- **A click activates what it lands on** (owner, 2026-09-28, feedback F22 — reversing the 2026-09-27
  rule that a first click on the menu only highlighted). A click on a building's row arms it at once,
  whatever had focus: the map takes the mouse with the ghost at the cursor — where the player was
  pointing if the map had focus, the smart-cursor spot if the menu did (Enter's twin). A click on
  `[n] Nexus` opens its popup; on `[e] Explore Map`, Explore Map. Only the keyboard has a "highlighted,
  not yet chosen" state.
- **A click can only choose what it could see.** While the Explore Map panel covers the menu, a click
  anywhere on the panel gives the menu back and chooses nothing.
- **A second click on the same tile confirms**, compared by tile, never by screen cell. The
  placement returns the menu with nothing looking chosen.
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
- Plus **disabled** (dimmed) for a row that cannot be used now — an unaffordable one — and **armed**
  for the one building being placed: `>` before it, the whole row in the hotkey's colour and bold, its
  name underlined, and **no bar** — the bar is the keyboard's "not chosen yet", and armed is chosen.
  Legible in monochrome by the marker and the underline.
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
- **Questions and menus are popups** — the start-the-Pulse question, the game menu, Settings and the
  export use the same shape.
- **Nothing opens a popup but the player.**
- **A choice closes its popup** (Q60, owner 2026-09-27): picking a Nexus power, like answering a
  question, returns the player to where they were. What the pick did is on the status line and on the
  menu; reopening the popup shows it listed as active.
- **A setting is a row whose value Left and Right change** (Settings, since gate 5G): its name, the value
  between `<` and `>` (the arrows say which keys change it), and, quietly on the right, when a change is
  seen — `now` or `restart`. Enter/Space is Right. A choice of two comes round at either end; a number
  stops at its ends and the status line says so. **By mouse, the left half of the value box is Left
  and the right half is Right** — two targets six cells wide each, big enough for a finger on the
  browser playtest page; a click anywhere else on the row highlights it. Every change is said on the
  status line. (`settingColumns` in `src/build/overlay.ts`.)
- **What a highlighted row is for is written under the list**, wrapped at words, in a fixed number of
  lines so the popup does not change height as the highlight moves — the popup's version of the
  menu's effect line. (A `note` row.)
- **A list longer than the popup can hold scrolls** (gate 5H): it keeps the highlighted row in view
  (in the middle while it can), and the line above and below it says how many rows are hidden that
  way — `^ 4 more`, `v 11 more` — in the hotkey colour, blank at the list's own ends. A click on that
  line, or the wheel over the popup, scrolls. The window is derived from the highlight, never stored,
  so the reducer needs to know nothing about the popup's height. (`OverlayScroll` and `scrollWindow`
  in `src/build/overlay.ts`.)
- **A list in sections keeps each section's heading in the list** (Settings: "YOUR SETTINGS - saved",
  then "EXPERIMENTS - for playtests, not saved"): the headings scroll with the rows and are never
  highlighted; Up/Down skip them.
- **A text too long for its popup is a list too** (the export): each line a row, with a highlight
  Up/Down move, so it scrolls exactly as every other list does.
- **A popup that belongs to a menu row keeps that row lit behind it** (the Nexus popup, the
  start-the-Pulse question); **one that belongs to no row** (the game menu, Settings, the export)
  **leaves the menu unlit**, so its own highlight is the only one on screen.

## 5a. Settings, Experiments and the export

- **Settings are found, not hidden**: the game menu's `[s] Settings` (Esc, then `s`), and `[esc] menu`
  at the right of the top bar for a pointer — the hotkey in the hotkey colour, the name quiet.
- **The player's settings come first, the Experiments last** (owner, 2026-09-28: "At the bottom of
  those settings, we can include 'Experiments'"). Player settings — background, colour depth, symbols,
  reduced motion — apply at once and are **saved**, through the same store as the title menu's
  Settings. Experiments are the playtest flags (gate 5G's Debug Mode) and are **never saved**:
  defaults change from build to build. `d` opens Settings straight at the Experiments.
- **Agents ask the owner to flip experiments.** A choice that is his to feel ships behind an
  experiment, defaulting to the recommended answer, and the pull request tells him which one to flip
  (Esc, `s`, or `d` for the Experiments) and asks him to **paste the export back** (his own request,
  2026-09-28). A new behaviour whose worth is in doubt gets an on/off experiment. Most experiments
  are deleted before the pull request is accepted; a few stay longer, or become real settings.
- **Every experiment names the question it serves** and whether it applies now or on restart. A
  restart row starts the Build Phase over keeping every setting and experiment, which is how a
  "restart" experiment takes effect.
- **The export is text a person can paste and a program can read back**: `name = value` lines, `#`
  comments, the experiments that differ from this build's defaults first (each with the default it
  replaced), then the settings, then the other experiments, and the build's commit near the top. It
  is shown in a popup, and also copied to the clipboard and written to a file by the adapter — never
  by the reducer. `--settings "<text>"`, and `#settings=` on the browser page, read it back; reading
  skips an unknown name or a bad value one at a time rather than refusing the text.

## 6. Panels

- **The side panel shows one thing at a time**: the menu, or — in Explore Map — the **Explore Map
  panel** for what is under the cursor, following it as it moves with no key to press (feedback F23).
- **A panel that replaces the menu names itself** in a header bar across its top — inverse, in the
  title's weight, like a popup's top border — with `[esc]` at its right (`EXPLORE MAP  [esc]`). The
  "pressed" flash of the row that opened it plays on the header, since the row is gone.
- **The Explore Map card**: the thing's own glyphs as its icon, its name, what it is for in one line
  (wrapped at words, never cut), then its numbers as label/value rows. Later: a larger ASCII art
  version, and live numbers during a Pulse.
- **Text in the panel never cuts a word**; a line that does not fit wraps or is dropped.

## 7. The map rectangle

- **The map is a closed rectangle.** A side with more map beyond it is a thin, dim line; a side that
  has reached the map's edge is a **solid bar** — the same weight horizontally and vertically, in every
  glyph pack, without colour. A corner is solid where a solid side runs into it.
- **A map shorter than the panel** closes directly under its own last row; the panel keeps its height.
- **The map's edge has Experiments, all keeping the one rule — the same weight on every side**
  (feedback F25; the Experiments "Map edge", "Map edge colour" and "Shared west side"): the solid bar, a
  half block on the map's side of the cell, a heavy or a double line (joined to the frame's light rules
  in mixed-weight junctions), a light shade, or **the map's own style** — a map names one for itself
  (the Build Phase map's is a dashed "fence"). Drawn in the frame's colour, dimmed, or a quieter grey
  of its own (the `chrome.edge` role). Where ASCII has no glyph for a style, it falls back to the solid
  bar; a shade is `:` and the fence `+---+`, its posts fixed to the map so they scroll with it.
  (`src/view/edge.ts`.)
- **The west side may share the menu's divider**, giving the map the column back: layout, drawing and
  hit-testing read the flag from one place (`layoutOptions` in `src/build/layout.ts`), and the screen
  is laid out again the moment it changes, exactly as for a resize.

## 7a. Moving around the map (gate 5H, reworked 2026-09-28)

- **A tap is one tile, always.** Precise placement is the common case; speed comes from holding.
- **Holding (or tapping quickly) speeds up at once, and a different key starts over**: the same arrow
  again within the hold window moves 2 a press straight away, then 4 once the run is 300 ms old;
  another arrow, or anything else, is a tap again. There is no slow tier. Terminals send no key-up,
  so "held" is read from the gaps between presses — in the input path, never the reducer.
- **Shift is a jump, not a speed**: 12 tiles a press, and a held one jumps again no faster than the
  eye can follow it land (every 150 ms). Option+Arrow, PageUp/PageDown and Home/End are the same jump.
- **Everything that moves is interpolated; nothing teleports**: every camera change slides and every
  cursor move glides, over a few frames, from wherever it is drawn at that moment — a second move
  mid-way continues smoothly. The state already holds the destination; a tween (`src/view/tween.ts`)
  is how the screen gets there. The cursor glides across the *view* (its tile less the camera's), so
  it rides along when only the map scrolls and is never drawn outside the view. Hit-testing uses the
  drawn camera, so a click lands on what the player saw. Reduced motion snaps everything. Nothing
  animates unless something moved — an idle screen draws once per input.
- **Pointing to confirm never moves the view**: with a building armed, a click moves the cursor and
  the preview only (Q58). **Exploring, a click near an edge brings that part of the map in** —
  further the nearer the edge — and a fast move re-centres the view on the cursor.
- **Every number is an Experiment** until the owner has felt it.
- **A refused try is seen where the eye is**: the footprint flashes in the "danger" colour for a moment
  as the status line says why.

## 7b. A building going up (gate 5I)

- **A placement is felt, then settles into the plain plan.** The building plays a few frames of its
  own as it goes up (drawn plain — a scaffold), then stands finished (bold, as every building is),
  lit for a moment, with a few sparks thrown off its edge. After under a second it is exactly the
  still picture every other frame shows.
- **Juice is presentation, never plan**: nothing about it reaches the reducer; the live loop times it
  from the frame that first drew the placement, and the view draws "this placement, this long ago".
  Undo or Backspace mid-animation removes the building at once — no ghost frames.
- **An effect never covers a building**: sparks are dropped on any tile a building stands on.
- **Light is a role pulled toward another role, never a colour** (`CellStyle.tint`): a real blend at
  256 colours and truecolor, a step at 16, nothing in monochrome, where the plain-to-bold change of the
  frames carries it.
- **Reduced motion shows the finished building at once**, unlit; the sparks become a still mark at
  its corners.
- **Every duration and intensity is an Experiment with an off value** (Build animation, Lighting,
  Particles, Glow time).

## 8. The status line

- **One line answers "what just happened, or why not"**: a typed message (text, a tone, and the tile
  it is about), never a bare string. A message about a tile lapses when the cursor leaves it.
- **Say the result and the way back**: `Hatchery placed (resources: 70) - [u] undo`,
  `Experiment - Opens on: map - applies on restart: [r]`.
- **Looking reads quietly; trying reads loudly**: a refusal is neutral while the player only hovers,
  red and bold once they press Enter.

## 9. Words

- Plain words on screen; no internal ids or code names. Each Nexus is named for its faction
  ("Citizen Nexus").
- Short labels in the key help: `arrows move`, `enter/space place`, `esc cancel`.
