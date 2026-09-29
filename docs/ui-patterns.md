# Terminal Nexus — interface patterns

**Document role:** The interaction and drawing patterns every interactive screen follows
**Status:** WORKING — built on the Build Phase first; not canon yet (promoted into `specs/engine.md`
Section 9 when the owner accepts them)
**Updated:** 2026-09-29 (gate 6A round 3: section 4's first rule — a menu can always be walked with Up, Down and Enter — and the Start button becoming the menu's last row and its question a "Battle Round 1" screen, sections 5 and 6; earlier the same day: section 6, the Start button, and section 7c, the Nexus Pulse on screen — gate 6A, and its second round: the timer, the light, and red kept for the Nexus being hurt; section 0, the UX goals read out of four rounds of feedback; round-4 feedback F30-F33: arming where the cursor is, focus that goes back to
where it came from, one "active" style for every menu row, Explore Map as that style, removal sparks;
F34-F37: the top bar names what Esc does; popups lose their `[esc]`, gain a message form and a scroll
bar; Settings' layout; Restart in the game menu); 2026-09-28 (a click activates; Explore Map —
round-3 feedback F22, F23; Settings, Experiments and the export, replacing Debug Mode's popup)
**License:** Apache-2.0

These came out of the owner's playtests of the Build Phase (2026-09-26 and 2026-09-27; the item-by-item
log is [`feedback/2026-09-27-build-phase-playtest.md`](feedback/2026-09-27-build-phase-playtest.md)).
They are written as rules so the next screens — the Nexus Pulse view, the campaign menu —
behave the same way without anyone re-deriving them. Where the Build Phase implements one, the file is
named. When a new screen needs to break one, change this document in the same pull request and say
why.

## 0. What the interface is for — the UX goals

The rules below are the letter; these are the spirit, read out of four rounds of the owner's feedback
(2026-09-26 to 2026-09-29). When a screen needs something no rule covers, ask which of these it
serves, and when two rules disagree, the goal decides. Each names where it showed up.

1. **Point at it or press it, and the same thing happens.** Keyboard, mouse, a finger and a script are
   equal doors onto one set of commands. Every row shows its key and is clickable, and a click does
   what its key does ("mobile tap, which for our code is the same as a mouse click, so we just call it
   mouse click", F22). The keyboard is the floor, never the only way — and the floor of a menu is Up,
   Down and Enter: hotkeys and clicks are shortcuts onto rows that can always be walked (F48).
2. **Tell me where I am and what happens next.** Every mode has a name in the key help, whatever is
   under way is marked (`>`), and a label says what a key will *do*, not what state we are in: the top
   bar reads `menu [esc]`, `back [esc]`, `close [esc]` (F32, F37). Say the result and the way back on
   the status line.
3. **Don't move things under the player.** A picked building appears where the cursor already is;
   finishing goes back to where you began; a popup keeps its height as the highlight moves; a list
   scrolls instead of jumping; a double click places where you pointed even if the view moved (F22,
   F30, F35). Whatever the player was looking at should still be there afterwards.
4. **Suggest, never insist.** The game proposes — the nearest good spot, the building's own ghost
   instead of a red `x`, "restart later" as a warning rather than a wall — and one key overrules it.
   Recommend early and nearby; refuse late and in words (F30, F34).
5. **One pattern, said once.** One active style for every menu row, one popup shape, one Esc, one scroll
   bar. When he spots a pattern he asks for it to be the same everywhere, "so if we decide to change or
   style it later, it will be consistent to all menu items" (F32). Before drawing something new, find
   the pattern that already exists; if you need a variant, change the pattern.
6. **Every cell earns its place.** Take away what restates the obvious: "^ 9 more" (the scrolling says
   so), a "now" column (say "restart" only when it matters), `[esc]` in every popup (the top bar has
   it), a separate divider column (F25, F34-F37). The freed space goes to what he is looking at.
7. **Motion explains change, and nothing else moves.** Every camera and cursor move is interpolated;
   what just happened is animated briefly (a building rising, sparks) and then the screen is still;
   reduced motion snaps. Effects are presentation and never touch the plan (F20, F26, F27). "Interpolation
   is easy and powerful" — reach for it before a jump cut.
8. **Taps are precise, holds are fast.** One press is one tile; holding accelerates; a long move is also
   a single key (Shift jumps 12), so speed is never required to get anywhere (F21, F29). Feel numbers
   are Experiments until he has felt them.
9. **The world may style its own frame.** A map names its own edge, and the rugged edge "even in ascii
   mode" is what he loved most (F38). Content brings personality to the chrome, and the chrome stays
   legible in monochrome and ASCII first.
10. **Give him something to feel, not something to judge.** A fork ships as an Experiment he can flip,
    and his exported settings are the answer (F19). Agents add Experiments freely and remove them when
    answered.
11. **Degrade gracefully, enhance progressively.** It works on a bare terminal — ASCII, monochrome, no
    mouse, no key-up — and gets better where the host offers more: Unicode, truecolour, a pointer, key
    releases (Q66). Never require the enhanced path, and always keep the plain one working.
12. **Keep what the player made safe.** Leaving asks, a stray key never loses a plan, undo exists, a
    restart is a choice and not a surprise (F13, F34).
13. **Portable by construction.** The screen is a grid of styled cells plus a fixed set of commands; any
    host that can draw cells and deliver keys and a pointer can run the game. The one capability a host
    must do *well* is map navigation
    ([`portability.md`](portability.md)).

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
- **Finishing goes back to where it started** (owner, 2026-09-29, feedback F30). Placing and Explore
  Map remember where they were begun (`BuildState.origin`): begun on the map — a digit pressed there,
  Enter/Space or `e` in plain navigation — a placement or Esc leaves the keyboard on the map in plain
  navigation, the cursor where it was; begun on the menu — Enter/Space or a click on a row, or a digit
  while the menu had the keyboard — they go back to the menu, on the same row (with nothing looking
  chosen after the mouse). The menu still orchestrates; the map is a place to work from too.
- **A mode has one meaning per key.** Arrows and Enter/Space follow focus; nothing else does. Digits
  always arm their row; letters always name commands, from any focus.
- **Several ways in, all shown**: Tab toggles; a click on the area; and on the menu, Right twice (the
  first flickers to say "you are on the menu").
- **The map has three modes, each named in the key help**: `PLACE` (a building armed, its ghost at
  the cursor), `EXPLORE MAP` (nothing armed; the side panel describes what is under the cursor —
  section 6), and `MAP` — **plain navigation**: the bare cursor with the menu left beside it, so the
  next click can arm a building from it. Tab, Right twice, a click on the map and finishing something
  begun on the map all arrive in plain navigation; Explore Map is reached only by `e`, its menu row,
  and Enter/Space in plain navigation.
- **The screen opens on the menu, at Explore Map** (owner, 2026-09-29, feedback F31), and the map
  cursor, not yet drawn, **on the player's Grid Nexus** — where nothing has been pointed at yet.
- **Arming puts the building where the cursor is** (feedback F30): a digit, Enter on a row or a click
  on it keeps the cursor where it is when the building fits there. Otherwise the cursor moves to the
  nearest spot within 12 tiles of it that leaves one free tile between the building and every other
  structure, or, with none in reach, the nearest that fits at all — nearest by the cursor's move, a
  tile across costing 1 and a tile up or down 2, so a run grows to the right ("in most cases this
  should move the cursor only a few tiles to the right", owner, 2026-09-29); ties to the more
  horizontal move, then east, then south (`armingSpot` in `src/build/state.ts`).
  With nothing in reach the cursor steps one tile right and one down and the building is drawn as
  itself, not as the refusal's `x`, until the player moves or tries to place. **Never from the last
  building placed**: press a building's key again right after placing one and the cursor, still on the
  new one, moves a gap away from it.

## 2. Back, cancel and close

- **Esc, `x` and a right click are one command** (`cancel`) and always mean the same thing.
- **Esc walks back one level at a time**: a popup (to the popup it was opened from, if any — Settings
  to the game menu, the export to Settings), then placing or Explore Map to where it was begun (plain
  navigation on the map, or the menu), then plain navigation to the menu, then on the menu it opens
  the **game menu**. Esc never leaves the game by itself. A key that opened something closes it the
  same way (`e` for Explore Map, `n` for the Nexus popup, `d` for Settings).
- **The game menu is the way out, the way to Settings, and the way to start over** (owner,
  2026-09-28; Restart since 2026-09-29, F34): `[s] Settings`, `[r] Restart` (the Build Phase over,
  every setting and experiment kept, the plan lost), `[q] Quit`, `[esc] Back to the game`. Esc on the
  menu and `q` anywhere open it.
- **The top bar's right end says what Esc does right now** (owner, 2026-09-29, F37): `menu [esc]` on
  the menu (and on a committed Build Phase), `back [esc]` while the map has the keyboard (placing,
  Explore Map, or plain navigation), `close [esc]` while a popup is open. The action first and
  the key after it, as a way back reads; the name quiet, the key in the hotkey colour. **A click on it
  sends exactly what Esc sends** — one level back, so over Settings opened from the game menu it goes
  back to the game menu, where a click outside would close both. It is the one place Esc is named:
  popups do not carry their own. (`escLabel` and `escHintSpan` in `src/build/layout.ts`.)
- **Leaving always asks**: only the game menu's own `[q]` (or Enter or a click on its Quit row) quits.
  Ctrl+C is the one immediate way out.
- **A building is armed only while the map has focus.** Anything that takes the keyboard off the map
  disarms, so a stale ghost can never sit on the map while you work the menu.

## 3. Mouse

- **A click activates what it lands on** (owner, 2026-09-28, feedback F22 — reversing the 2026-09-27
  rule that a first click on the menu only highlighted). A click on a building's row arms it at once,
  whatever had focus: the map takes the mouse with the ghost at the cursor when it fits there — where
  the player was pointing — and otherwise at the nearest good spot, exactly as a key would. A click on
  `[n] Nexus` opens its popup; on `[e] Explore Map`, Explore Map. A click on a row is the menu's, so
  what it starts comes back to the menu. Only the keyboard has a "highlighted, not yet chosen" state.
- **A click can only choose what it could see.** While Explore Map covers the menu, a click anywhere
  on the panel — its own active row included — closes it, as Esc does, and chooses nothing.
- **A second click on the same tile confirms**, compared by tile, never by screen cell. A placement
  armed from the menu returns the menu with nothing looking chosen ("focused but unselected").
- **A click outside a popup closes it** and moves focus to where it landed — and does nothing else, so
  a dismissing click never also places or picks.
- **Whole rows are click targets**, the same width the highlight bar is drawn.
- **Hit-testing and drawing read one geometry** (`src/build/layout.ts`, `src/build/overlay.ts`), so a
  click can never land on something the frame drew elsewhere.

## 4. Menu rows

- **A menu can always be walked with Up, Down and Enter alone** (owner, 2026-09-29, feedback F48: "It
  is important that the menu can always be navigated with up/down/enter. The hotkeys and mouse clicks
  are the additional enhanced functionality."). Every action a menu offers is a row in it, in the
  order Up and Down walk, and Enter (or Space) on the highlighted row does what the row's hotkey and a
  click on it do. A hotkey or a click is a shortcut to a row, never the only way to an action: an
  action with a key or a button and no row makes the menu incomplete. (The boxed `[s] Start` button of
  gate 6A was that — `s` and a click reached it, Up and Down did not — and became the menu's last
  row.) The same holds for a popup's options. A test walks the whole menu with those three keys.
- **Every row shows its hotkey** as `[x]` in the hotkey colour; the bracket survives monochrome.
- **Two states, and only two** (owner, 2026-09-29, feedback F32), legible without colour:
  - **highlighted** — an inverse bar across the whole row, one colour: where the keyboard is, not
    chosen yet; drawn only while the menu has the keyboard;
  - **active** — the row's action is under way: `>` before it, the whole row in the hotkey's colour
    and bold, its name underlined, and **no bar**. A building while it is armed, `[e] Explore Map`
    while Explore Map is open, `[n] Nexus` while its popup is, `[s] Start Pulse` while its screen is.
    One test says which rows are active
    (`menuRowActive`) and one function draws every row (`drawMenuRow`, both in `src/view/build.ts`),
    so a later change to the style reaches all of them. Legible in monochrome by the marker and the
    underline.
- Two brief flashes of the bar acknowledge a key: **pressed** — for a few frames after activation, a
  stronger bar, bold and underlined, in the hotkey's colour; **refused** — for a few frames when a key
  reached the row but had nothing to do (Left/Right, an unaffordable row): the bar dims and comes back.
  A row that cannot be used now — an unaffordable one — is **disabled** (dimmed) in any of them.
- **Timing lives in the live loop, not the reducer.** The reducer records an acknowledgement with a
  sequence number (`BuildState.ack`); the terminal loop shows it for its duration from when it first
  sees it (`src/cli/spike.ts`). Still frames — tests, screenshots — never carry one unless asked.

## 5. Popups

- **One shape for every popup** (`src/build/overlay.ts`): a title and rows as data; options name the
  command a click on them sends.
- **Drawn to be unmissable**: a solid border in the same weight as a map edge, the title in the top
  border, and a one-cell shadow that blanks what is behind it. Centred over the map. **No `[esc]` in
  the border** (F37): the top bar's `close [esc]` says it and is its click target.
- **A popup holds the keyboard and the mouse** until closed; keys it does not use do nothing.
- **Questions, confirmations and menus are popups** — the Battle Round screen, the game menu, Settings
  and the export use the same shape.
- **A confirmation is a screen, not a question** (owner, 2026-09-29, feedback F49-F50). Its title says
  what is about to happen — `Battle Round 1`, not `START PULSE 1?` — its body announces it, and it has
  one row, the action, highlighted: `[s] Start`. Going back is Esc (the top bar's `close [esc]`), never a
  second row to press. The body is data: a mission may write its own text for round *n*
  (`BuildContext.roundText`), and the default is "Activate Nexus. Collect Resources. Spawn Units.", one
  sentence to a line so a sentence never wraps at the 80-column floor. (`overlaySpec` in
  `src/build/overlay.ts`.)
- **Nothing opens a popup but the player** — a message only as the answer to what the player just
  did (below).
- **A message is a popup with nothing to choose** (F34, "a good case example to improve the popup
  implementation"): a title and its text, wrapped at words in as many lines as it needs. Esc (or `x`,
  or a right click) and a click outside close it, and nothing else does — no Enter, no hotkeys, no
  wheel. It sits over whatever was open, and Esc goes back to that. It is for a warning the player
  should read once and may act on later, not for an answer to a question. (`BuildState.message`,
  `messageSpec` in `src/build/overlay.ts`.)
- **A choice closes its popup** (Q60, owner 2026-09-27): picking a Nexus power, like answering a
  question, returns the player to where they were. What the pick did is on the status line and on the
  menu; reopening the popup shows it listed as active.
- **A setting is a row whose value Left and Right change** (Settings, since gate 5G): its name, and
  the value between `<` and `>` (the arrows say which keys change it) against the row's right end —
  nothing else (F34 removed the `now`/`restart` column). Enter/Space is Right. A choice of two comes round at either end; a number
  stops at its ends and the status line says so. **By mouse, the left half of the value box is Left
  and the right half is Right** — two targets six cells wide each, big enough for a finger on the
  browser playtest page; a click anywhere else on the row highlights it. Every change is said on the
  status line. (`settingColumns` in `src/build/overlay.ts`.)
- **What a highlighted row is for is written under the list, below a line across the popup** (F35:
  "closer to the selection"), wrapped at words, in a fixed number of lines so the popup does not
  change height as the highlight moves — the popup's version of the menu's effect line. (A `rule` row,
  then a `note` row.)
- **A popup has at most one list that scrolls** (F36), so a scroll bar has one place to be. A list
  longer than the popup can hold keeps the highlighted row in view (in the middle while it can); the
  window is derived from the highlight, never stored, so the reducer needs to know nothing about the
  popup's height. (`OverlayScroll` and `scrollWindow` in `src/build/overlay.ts`.)
- **The scroll bar is the popup's right border beside the list**, drawn only while rows are hidden:
  an up symbol on the list's first row, a down symbol on its last, and between them a textured track
  with a solid thumb whose length is the share in view and whose place is the share above (`^ v :` in
  ASCII, `▲ ▼ ░` in Unicode, all inverse like the border). **A click on its upper half scrolls up, on
  its lower half down**, bringing the next hidden rows into view; the wheel and Up/Down still walk the
  highlight a row at a time. Drawn and hit-tested from the one placement (`PlacedOverlay.scrollBar`).
  It replaced the `^ 4 more` / `v 11 more` lines (F35: "There's no need to say ...").
- **A long list says where the highlight is beside its title** (Settings: `SETTINGS (6/28)`), moving
  with it.
- **A list in sections keeps each section's heading in the list** (Settings: "YOUR SETTINGS - saved",
  then "EXPERIMENTS - for playtests, not saved"): the headings scroll with the rows and are never
  highlighted; Up/Down skip them.
- **A text too long for its popup is a list too** (the export): each line a row, with a highlight
  Up/Down move, so it scrolls exactly as every other list does.
- **A popup that belongs to a menu row keeps that row active behind it** (the Nexus popup: `> [n]
  Nexus`; the Battle Round screen, `> [s] Start Pulse`); **one that belongs to no row** (the
  game menu, Settings, the export) **leaves the menu unlit**, so its own highlight is the only one on
  screen.

## 5a. Settings, Experiments and the export

- **Settings are found, not hidden**: the game menu's `[s] Settings` (Esc, then `s`), and `menu [esc]`
  at the right of the top bar for a pointer.
- **Settings is one scrolling list**: the player's settings, the Experiments, and **Export settings**
  as its last row (`e` still exports from anywhere in it) — no fixed rows under it (F35).
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
- **Every experiment names the question it serves.** One that only takes effect when the Build Phase
  starts over says so on the status line when changed ("applies after a restart") and, **when Settings
  closes with such a change pending, in a message popup** — once per change, not when a value is put
  back, and not again on the next visit, since the player may keep playing and restart later (F34).
  The game menu's `[r] Restart` is how it takes effect. (`pendingRestart` in `src/build/settings.ts`.)
- **The export is text a person can paste and a program can read back**: `name = value` lines, `#`
  comments, the experiments that differ from this build's defaults first (each with the default it
  replaced), then the settings, then the other experiments, and the build's commit near the top. It
  is shown in a popup, and also copied to the clipboard and written to a file by the adapter — never
  by the reducer. `--settings "<text>"`, and `#settings=` on the browser page, read it back; reading
  skips an unknown name or a bad value one at a time rather than refusing the text.

## 6. Panels

- **The side panel shows one thing at a time**: the menu, or — in Explore Map — the **Explore Map
  panel** for what is under the cursor, following it as it moves with no key to press (feedback F23).
- **A panel that replaces the menu keeps the row that opened it as its header** (feedback F32): the
  row stays where it is, drawn active (`> [e] Explore Map`), a separator runs across the panel under it
  (`-` in ASCII, `─` in Unicode), and the panel's own content fills the rest. No `[esc]` of its own:
  what Esc does is the top bar's to say. The row's "pressed" flash plays on the row itself.
- **The Explore Map card**: the thing's own glyphs as its icon, its name, what it is for in one line
  (wrapped at words, never cut), then its numbers as label/value rows. Later: a larger ASCII art
  version, and live numbers during a Pulse.
- **Text in the panel never cuts a word**; a line that does not fit wraps or is dropped.
- **The action that finishes the phase is the menu's last row** (owner, 2026-09-29, feedback F41, then
  F47: "It just needs to be the last option on the menu... a regular menu item, at the bottom"):
  `[s] Start Pulse`, on the panel's bottom line, drawn and highlighted like every other row and reached
  by Up and Down (section 4's first rule). A boxed "end turn" button was tried first and was too large,
  and Up and Down could not reach it. It is dim, and refused with its reason, until the dealt Nexus power
  is picked; Enter on it, `s` or a click opens the Battle Round screen (section 5). It belongs to the menu,
  so Explore Map, which replaces the menu, hides it with the rest, and the panel's key help stacks
  directly above it. (`startRow` in `src/build/layout.ts`, drawn in `drawPanel` in `src/view/build.ts`.)

## 7. The map rectangle

- **The map is a closed rectangle.** A side with more map beyond it is a thin, dim line; a side that
  has reached the map's edge is **the map's own edge** — the same weight horizontally and vertically,
  in every glyph pack. A corner is the edge where an edge side runs into it.
- **A map shorter than the panel** closes directly under its own last row; the panel keeps its height.
- **A map names its own edge style** (feedback F25; settled by the owner's playtest of 2026-09-29:
  "using map-specific borders looks a lot better!"): the solid bar (an inverse-video cell, and what a
  map that names none gets), a half block on the map's side of the cell, a heavy or a double line
  (joined to the frame's light rules in mixed-weight junctions), a light shade, or a dashed "fence"
  (the Build Phase map's). Every style keeps the one rule — the same weight on every side. Where ASCII
  has no glyph for a style, it falls back to the solid bar; a shade is `:` and the fence `+---+`,
  its posts fixed to the map so they scroll with it. (`BuildContext.edgeStyle`, drawn by
  `src/view/edge.ts`.)
- **The edge is drawn quietly**: a grey of its own between the frame and the ground (the
  `chrome.edge` role), so it reads as a wall while the menu and the bars stay the loudest lines.
- **The menu's divider is the map's west side**: one column, a plain line beside the menu's own rows
  and rules, a light or map-edge side beside the map's rows — and the map has the column a separate
  west side took (49 tiles at 80 columns). Layout, drawing and hit-testing read it from one place
  (`buildLayout` in `src/build/layout.ts`).

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
- **A click near an edge brings that part of the map in** — further the nearer the edge — whether or
  not a building is armed (owner, 2026-09-28, F22: "keep clicking on the grid with the ghost building
  placement cursor to keep scrolling"), and a fast move re-centres the view on the cursor. **Because
  the view can move under a click, a double click places where its first click pointed**: two clicks on
  one screen cell within 400 ms are one "here", timed in the input path (`BuildSession`), while a slow
  second click on a spot the view has left is a fresh first click, never a placement on a tile nobody
  pointed at.
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
- **Removing is felt too** (owner, 2026-09-29, feedback F33): undo and Backspace/Delete take a planned
  building away at once and throw the same burst of sparks where it stood, for the same "Particles"
  and "Glow time". The live loop notes what left the plan and when (`removing`, beside `placing`); the
  plan never hears of it.
- **Every duration and intensity is an Experiment with an off value** (Build animation, Lighting,
  Particles, Glow time).

## 7c. The Nexus Pulse on screen (gate 6A)

- **The Pulse plays on the Build Phase's own screen, not a screen of its own.** The same top bar,
  the same closed map rectangle, the same bottom bar and popups; only the panel's contents and the
  key help change. A 96 x 40 map does not fit a fixed pane, so the Pulse uses the Build Phase's
  camera: it opens looking at the player's Nexus, the arrow keys look around while it plays, and the
  Pulse never waits for the player.
- **The panel says what is happening, in this order**: a headline (`NEXUS PULSE 1` with the **time
  left until the last shot** at its right end, and later the ending's beats), what the timer counts
  and how fast it runs (`time left  1x`), one line per side (how many units, a bar of the
  health left of what it began with, and the number), the last five events in plain words — `3.5s
  trooper > raider`, `3.8s raider dies` — each in the colour of the side it is about, and the two
  controls at the bottom.
- **Two controls have rows and everything else is a key**: `[space] Pause` (`Resume` while paused) and
  `[r] Watch again`, each clickable and doing what its key does. `[` and `]` change the speed, `.`
  and `,` step a frame and a tick — key help only, since a row for each would crowd the panel at 80
  columns. Popups and the game menu keep every one of these keys for themselves while they are open.
- **The ending is four beats, always in this order**: the **last seconds** (the title's timer flashes,
  slowly, like a racing game's clock, and a soft light sweeps once every two seconds round the map's
  border like a lighthouse calling — a colour pulled toward the light and never a glyph, so it cannot
  hide anything on the map; in monochrome the timer is reversed video and the border goes bold as
  the light passes), **cease fire**, **Recall** (the survivors walk home) and the **result**
  (`VICTORY`, `DEFEAT`, `DRAW` or `TIME'S UP`, why, and how many of yours came home). Each is a pure
  function of the presentation time, so pause, speed, a step or "Watch again" all keep it whole.
  Reduced motion holds the timer lit and the light steady, and puts everyone home the moment the
  walk would begin.
- **The timer is the only thing on the screen that flashes, and red is kept for one thing** (owner,
  2026-09-29): the player's own Nexus being hurt — its first hit, its health very low (a short blip
  every second and a half until it falls), and the result of a lost Pulse. Each is a faint, brief
  tint of the border (a fifth of a second, at most about half the way to the danger colour), never a
  banner, an inverse frame or a word in capitals, and every one is said again in words on the panel,
  so nothing depends on seeing it. Reduced motion has no red at all. A new warning goes to the timer
  or the light, never to a bigger red.
- **The result is words first, colour second.** The headline, the reason and the count are on the
  panel and again, as one sentence, on the status line (green for a win, red for a loss, plain for a
  draw or a time-out) — the words carry the cue where colour cannot.
- **Nothing the player does can change what the Pulse did.** Pause, speed, stepping and looking around
  are presentation; "Watch again" only starts the clock over, because the kernel resolved the whole
  Pulse before the first frame. What the presentation asks of the Build Phase — centre the view on
  the Nexus at the start and when the ending begins — goes through the same named command a player's
  key does (`look-at`), so a script, the terminal and the browser page see the same thing.
- **The ending's timings are Experiments** (`d`, Final warning, Red alerts, Walk-back delay, Walk-back
  time, Centre on Nexus) and so are the raid and the crew the spike starts a Pulse with (Raid, Your
  units), so every way a Pulse can end can be watched without editing code.

## 8. The status line

- **One line answers "what just happened, or why not"**: a typed message (text, a tone, and the tile
  it is about), never a bare string. A message about a tile lapses when the cursor leaves it.
- **Say the result and the way back**: `Hatchery placed (resources: 70) - [u] undo`,
  `Explore Map - arrows look around, e or esc to go back.`
- **Looking reads quietly; trying reads loudly**: a refusal is neutral while the player only hovers,
  red and bold once they press Enter.

## 9. Words

- Plain words on screen; no internal ids or code names. Each Nexus is named for its faction
  ("Citizen Nexus"). What the player calls a Pulse is open (Q68): the start screen says **Battle
  Round**; the menu row and the running screen still say Pulse until it is settled.
- Short labels in the key help: `arrows move`, `enter/space place`, `esc cancel`.
