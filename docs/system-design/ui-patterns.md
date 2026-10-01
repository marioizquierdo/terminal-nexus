# Terminal Nexus — interface patterns

_How every screen, menu, popup, effect and key behaves; read the goals and the checklist first, then the sections you touch; when two rules disagree the goals decide, and a change that adds, bends or retires a pattern updates this document in the same pull request and names the pattern. The model behind these patterns is [`input.md`](input.md), [`presentation.md`](presentation.md) and [`effects.md`](effects.md). Every unmarked statement is GUIDANCE._

## How to use this document

For any agent or person about to build or change a screen, a menu, a popup, an effect or a key. Read
**the goals and the checklist below first**, then the sections you touch.

- **A RULE names the test that holds it**, in parentheses. Changing one is a design change: the sentence,
  the code and the test change together in one pull request. Unmarked statements are GUIDANCE; depart
  from them when the work shows better, and say why.
- **When two rules disagree, or none covers the case, the goals decide.**
- **A change that breaks a rule or adds a pattern updates this document in the same pull request**, and
  says why. A new pattern gets a name here — a *hand-off*, a *card reveal*, a *see-through style* — so
  the next screen reuses it; use the names in code comments and pull requests too.
- **Numbers live in the code, not here**: the table of tuned values and the Experiments list
  (`src/build/experiments.ts`). This document says what a number is for.
- `scripts/playtest.mjs` (the `playtest` skill) presses the keys for you.

### Checklist for a new screen

- [ ] It can be walked with Up, Down and Enter alone; every action is a row with a visible `[key]`.
- [ ] A click on a row does what its key does.
- [ ] Esc and `x` go back one level; only the game menu's Quit leaves.
- [ ] The top bar's right end names what Esc does there.
- [ ] The bottom line has a hint for every situation the screen can be in.
- [ ] Lists stop at their ends; taps and holds move them as they move the map cursor; Shift, PageUp/PageDown and Home/End jump to the ends.
- [ ] Motion explains a change, then the screen is still.
- [ ] It works under reduced motion, in monochrome, in ASCII, and at 80 × 24.
- [ ] Anything the owner should feel rather than read about is an Experiment; an interaction you want
      reports on logs an event (section 15).

## 0. The goals

The rules are the letter; these are the spirit, read out of the owner's playtests.

1. **Point at it or press it, and the same thing happens.** Keyboard, mouse, a finger and a script are
   equal doors onto one set of commands. The floor of a menu is Up, Down and Enter; "the hotkeys and
   mouse clicks are the additional enhanced functionality."
2. **Tell me where I am and what happens next.** What is under way is marked, every situation has a hint,
   and a label says what a key will *do* (`back [esc]`), not what state we are in.
3. **Don't move things under the player.** A picked building appears where the cursor is; finishing goes
   back to where you began; a popup keeps its height; a double click places where you pointed.
4. **Suggest, never insist.** The game proposes — the nearest good spot, "restart later" as a warning —
   and one key overrules it. Recommend early and nearby; refuse late and in words.
5. **One pattern, said once.** One active style, one popup shape, one back, one way to move in a list,
   "so if we decide to change or style it later, it will be consistent to all menu items". Need a
   variant? Change the pattern.
6. **Every cell earns its place.** Remove what restates the obvious — "^ 9 more", `[esc]` in every popup,
   a position readout, a Back row — and give the space to what the player looks at.
7. **Motion explains change, then the screen is still.** "Interpolations are easy and powerful": reach
   for one before a jump cut. Done well, motion makes the game "look a LOT more legit, while also
   helping with usability".
8. **Taps are precise, holds are fast.** One press is one step, holding accelerates, and a long move is
   one key, so speed is never required — on the map and in every list alike.
9. **The world may style its own frame.** A map names its own edge ("even in ascii mode"); the chrome
   stays legible in monochrome and ASCII first.
10. **Give him something to feel, not something to judge — and a way to say what happened.** A fork
    ships as an Experiment he can flip; an interaction in doubt records what it did; his exports are the
    answer, and every build can be played from a link (section 15).
11. **Degrade gracefully, enhance progressively.** A bare terminal — ASCII, monochrome, no mouse, no
    key-up — works; Unicode, truecolour, a pointer and key releases make it better, never required.
12. **Keep what the player made safe.** Leaving asks, a stray key never loses a plan, undo exists.
13. **Portable by construction.** Styled cells plus a fixed set of commands; any host that draws cells
    and delivers keys and a pointer can run the game, and must do map navigation well
    ([`portability.md`](portability.md)).

## 1. The screen and the keyboard

- **Four regions.** The **top bar** (whole width): the title, where the player is, and at its right end
  what Esc does. The **side panel**, on the left because building comes first: the menu, a card, or the
  Nexus Pulse's panel. The **map**, a closed rectangle whose west side is the panel's divider. The
  **bottom line** (whole width): one line of contextual help. Popups open over the map. At 80 × 24 the
  map shows 49 × 18 tiles. (RULE — `tests/build-focus.test.ts`, `tests/build-help.test.ts`)
- **One place has the keyboard**, shown by exactly one "you are here": the menu's highlight bar or the
  map cursor, never both. Focus is state (`BuildState.focus`), so a script sets it and a test reads it.
  (RULE — `tests/build-focus.test.ts`)
- **The highlight bar means "the keyboard is here, not chosen yet"** and nothing else. After the mouse
  works the menu it is hidden, and the next menu key only shows it again (`BuildState.highlightHidden`).
  (RULE — `tests/build-focus.test.ts`)
- **A key means one thing per screen.** Arrows and Enter/Space follow focus; digits always address their
  row; letters always name commands. Tab toggles focus; Left and Right on the menu only flicker the row.
  (RULE — `tests/build-focus.test.ts`, `tests/build-menu.test.ts`)
- **The map has three modes, each with its own hint**: **placing** (a building armed, its ghost at the
  cursor, its card in the panel), **Explore Map** (the panel describes what is under the cursor) and
  **plain navigation** (the bare cursor, the menu beside it). Tab and a click on the map arrive in plain
  navigation; Explore Map is `e`, its row, or Enter/Space in plain navigation.
  (RULE — `tests/build-focus.test.ts`)
- **Finishing goes back to where it began** (`BuildState.returnTo`): begun on the map, it ends in plain
  navigation with the cursor where it was; begun on the menu, it ends on the same row, and a placement
  flashes that row once to bring the eye back. (RULE — `tests/build-focus.test.ts`, `tests/build-menu.test.ts`)
- **The Build Phase opens on the menu at Explore Map**, the cursor (not yet drawn) on the player's Grid
  Nexus. (RULE — `tests/build-focus.test.ts`)

## 2. Keys and clicks

- **Every action is a named command**; keyboard, mouse and a script are adapters onto one vocabulary
  ([`input.md`](input.md)), and tests drive the real adapters with raw keys and clicks. A hotkey that is
  not displayed does not exist. (RULE — `tests/build-phase.test.ts`, `tests/menu-adapters.test.ts`)
- **A click activates what it lands on**, from any focus: a building's row arms it, `[n] Nexus` opens its
  popup, `[e] Explore Map` opens it. What a row click starts comes back to the menu.
  (RULE — `tests/build-focus.test.ts`)
- **A click can only choose what it could see**: while a card covers the menu, a click on the panel goes
  back and chooses nothing. **A click outside a popup** closes it and moves focus there, nothing more; over a card it only closes
  the popup, and the card and its building come back. (RULE — `tests/build-card.test.ts`, `tests/build-placing.test.ts`)
- **Whole rows are targets**, as wide as the highlight bar, and **drawing and hit-testing read one
  geometry** (`buildLayout` in `src/build/layout.ts`, the placed popup in `src/build/popup.ts`).
  (RULE — `tests/build-menu.test.ts`, `tests/build-edge.test.ts`, `tests/build-popups.test.ts`)
- **A right click is `x`.** **The wheel** moves the map cursor five tiles (never a second camera) and
  walks a popup's list. (RULE for the right click — `tests/build-cancel.test.ts`)

## 3. Back, cancel and close

**Esc or `x` closes any popup, or cancels what is under way on the map, one level at a time.** A right
click is `x`. (RULE — `tests/build-cancel.test.ts`)

- **One level per press**: a popup goes back to the one it was opened from (Settings to the game menu,
  the export to Settings, the restart message to the game menu's Restart row) or closes; placing or Explore Map goes back to
  where it began; plain navigation goes to the menu. (RULE — `tests/build-cancel.test.ts`)
- **Only Esc opens the game menu.** On the menu nothing is left to cancel: Esc opens the game menu, and
  `x` and a right click do nothing there — no message, no flicker — so `x x x` always lands on the menu
  with the keyboard on it; the same on a committed plan and during a Pulse. `q` opens the game menu from
  anywhere. Two commands carry this: `cancel` (Esc, the top bar's label) and `back` (`x`, a right click).
  (RULE — `tests/build-cancel.test.ts`, `tests/pulse-screen.test.ts`)
- **The key that opened something closes it**: `e`, `n`, `d`, and a building's own digit while it is
  being placed. (On the Battle Round screen `s` confirms instead: starting takes two deliberate presses.)
  (RULE — `tests/build-placing.test.ts`, `tests/build-card.test.ts`, `tests/build-start.test.ts`)
- **No popup carries its own way back** — no `[esc] Back` row, no `[esc]` in its border. **The top bar's
  right end says what Esc does now**: `menu [esc]` on the menu and while a Pulse plays, `back [esc]` on
  the map, `close [esc]` over a popup — the action quiet, the key in the hotkey colour. A click on it is
  exactly Esc (`escLabel` in `src/build/layout.ts`). (RULE — `tests/build-popups.test.ts`, `tests/build-cancel.test.ts`)
- **The game menu** is `[s] Settings`, `[c] Controls and hotkeys`, `[a] Activity logs`, `[r] Restart` (the
  plan lost, settings and Experiments kept) and `[q] Quit`. **Leaving always asks**; Ctrl+C is the one immediate way out.
  (RULE — `tests/build-settings.test.ts`, `tests/build-popups.test.ts`, `tests/build-lifecycle.test.ts`)

## 4. Menu rows

- **A menu can always be walked with Up, Down and Enter alone.** Every action is a row in walking order,
  and Enter (or Space) does what its hotkey and a click do; an action with only a key or a button makes
  the menu incomplete. The same holds for a popup's options; a test walks the whole menu.
  (RULE — `tests/build-start.test.ts`)
- **Every row shows its hotkey** as `[x]` in the hotkey colour; the bracket carries it in monochrome.
  (RULE — `tests/menu-view.test.ts`, `tests/build-menu.test.ts`)
- **A title-menu screen that only has words to show** — Campaign's placeholder, About — has one row,
  `[1] Back`, where the rows start, with its words below it: headings bold, text wrapped at words to a
  comfortable reading width, a quiet line (the build) dimmed. Esc goes back too, and the highlight comes
  back to the row that opened it. It keeps a Back row, unlike a Build Phase popup, because the title menu
  has no top bar naming Esc and every action must be reachable with Up, Down and Enter alone.
  (RULE — `tests/menu-about-screen.test.ts`, `tests/menu-campaign-screen.test.ts`)
- **Two states, and only two**:
  - **highlighted** — an inverse bar across the row, in one colour, only while the menu has the keyboard;
  - **active** — its action is under way: it keeps its own hotkey, turns the hotkey colour, and a single
    **`>`** replaces its value at the right end, pointing at the map — `[1] Barracks  >`. No bar, no
    underline. A building being placed, Explore Map open, the Nexus popup or the Battle Round screen
    open: every row either opens a popup or gives the map something to do, and all share the look
    (`menuRowActive`, `menuRowSpec`, `drawMenuRow` in `src/view/build-menu.ts`).
  (RULE — `tests/build-menu.test.ts`)
- **Two brief acknowledgements**: **pressed** — a stronger bar in the hotkey colour for a few frames
  after activation, the look the cursor's blink borrows (not on the row a card reveal carries up from
  the menu, which stays active as it travels); and **refused** — when a key reached the row but
  had nothing to do, **the words turn grey for a moment and the background stays**, reading "nothing
  here" rather than a press (dim in monochrome). (RULE — `tests/build-menu.test.ts`, `tests/build-card.test.ts`)
- **Disabled** rows (unaffordable, or Start Pulse before the Nexus pick) are dimmed, and pressing one is
  refused with its reason on the bottom line. (RULE — `tests/build-start.test.ts`)
- **Timing lives in the live loop, never the reducer**: the reducer records an acknowledgement with a
  sequence number (`BuildState.ack`) and `src/view/build-live.ts` shows it from the frame that first
  sees it. Still frames carry none. (RULE — `tests/build-menu.test.ts`, `tests/build-card.test.ts`)

## 5. Moving in lists

**List movement** is the map cursor's movement applied to rows, in every list — the Build Phase menu,
the Nexus powers, the game menu, Settings, the export, the Controls page, the Activity logs window, the
title screen's menu.

- **No wrapping**: a list stops at its first and last row; holding Down arrives at the bottom and stays.
  Up on the first row and Down on the last do nothing, without a flicker — a held key would otherwise
  flicker at every repeat. (RULE — `tests/build-lists.test.ts`)
- **A first tap is one row; taps and holds move a list exactly as they move the map cursor** (see *The
  map*): quick taps speed up by counting, a held arrow keeps the game's pace, clamped at the ends. The
  title screen's menu stops and jumps but does not count or keep a pace: its loop reads no clock. One
  key classifier serves every list (`src/menu/list-keys.ts`).
  (RULE — `tests/build-lists.test.ts`, `tests/menu-list.test.ts`)
- **Shift+Up/Down, PageUp/PageDown and Home/End go to the first or last row.**
  (RULE — `tests/build-lists.test.ts`)
- **Rows that are not choices are skipped**: blank lines, the credits line, section headings.
  (RULE — `tests/build-all-settings.test.ts`, `tests/build-menu.test.ts`)

## 6. The side panel

### 6.1 The Build Phase menu

- **One list**: `[e] Explore Map`, `[n] Nexus` (picks waiting as `(1)` in the hotkey colour), then **the
  credits line** — the blank line before the buildings, what is left to spend right-aligned in the cost
  column after the map's own resource symbol in the deposit's colour (`◆ 130`; `* 130` in ASCII) — every
  building in catalog order with its cost, and `[s] Start Pulse` on the panel's last line.
  (RULE — `tests/build-menu.test.ts`)
- **Letters above the buildings, digits for them**, so no digit moves when an entry is added. No group
  headings until a real game needs them; if they return, one digit sequence runs through them. A row the
  panel has no room for is neither drawn nor clickable. The order lives in `menuEntries`
  (`src/build/state.ts`). (RULE for the room — `tests/build-menu.test.ts`)
- **No help text in the panel**: what a row does is the bottom line's to say.
  (RULE — `tests/build-start.test.ts`)
- **The action that ends the phase is the last row** (`startRow`), dim and refused with its reason until
  the Nexus power is picked; it opens the Battle Round screen. (RULE — `tests/build-start.test.ts`)

### 6.2 Cards

- **A card replaces the menu while something has the map's attention**: Explore Map's describes what is
  under the cursor as it moves; a building's describes the building being placed.
  (RULE — `tests/build-card.test.ts`)
- **Its header is the row that opened it**, moved to the panel's top line and drawn active with its own
  hotkey — `[e] Explore Map  >`, `[1] Barracks  >` — over a separator (`-` or `─`). **That hotkey
  cancels**, as Esc, `x` and a click on the panel do. No credits line on a card.
  (RULE — `tests/build-card.test.ts`)
- **A card is four parts, as data: a title, a subtitle, a description and its numbers.**
  The icon is the thing's own glyphs, or a bare tile's; the title sits beside it with the subtitle under
  it — one short line on what the thing is for; the description is two or three plain sentences with a
  little more detail, wrapped under the icon; then the numbers as label/value rows — cost where the menu
  sells it, health, size and attack, or a bare tile's position. **No status line**: planned, standing or
  about to be placed is plain from the rest of the screen. The words are written with the content
  (`src/content/cards.ts`), not in the view, and sized to the panel at 80 × 24. **Panel text never cuts a
  word**; if the words are too long, shorten them. One function draws every card (`drawCardBody`): that is
  where a later round would change the look for placing a building (where the title repeats the header),
  for exploring in the Build Phase, or for exploring during a Pulse.
  (RULE for the four parts and the fit — `tests/build-card.test.ts`)
- It appears with the **card reveal** (see *Motion and transitions*).

### 6.3 A selection holds the menu

While a building is being placed it stays the selection until placed or cancelled: another building's
digit, `e` and `s` (and `p`) are refused — the header flickers and the bottom line says to place it or
cancel it first, naming the keys. Its own digit, Esc and `x` cancel it. Popups (the Nexus powers, the
game menu, Settings, Controls) still open over it and hand it back, still armed, and a popup over a card
never moves the menu's highlight. So the menu is never workable with a ghost on the map, and never loses
track of what is armed (`refuseWhileArmed` in `src/build/state.ts`). Explore Map holds nothing: a digit
while exploring arms from the map, and `n` opens the Nexus powers.
(RULE — `tests/build-placing.test.ts`)

## 7. Hand-offs to the map

A **hand-off** is a menu row giving the keyboard to the map — a building armed, or Explore Map opened,
from the menu. It is shown so the eye travels with the keyboard: something flies from the row's own
place to the cursor, and **the cursor blinks twice** (the pressed look, at its speed) when it lands.
Keys work at once. Never on the way back, and never for Tab or a click on the map. Reduced motion drops
the flight and keeps the blink. The reducer records a sequence number (`BuildState.handoff`); the live
loop times the rest. (RULE — `tests/build-handoff.test.ts`)

- **A building sends the focus arrow** — the owner's "energy ray", in the hotkey colour: from the right end of
  the row, where the row stood in the menu (it then slides up to be the card's header), straight to the
  cursor, eased to arrive fast, homing if the cursor moves, its head (`>` or `▶`) pointing the way it
  flies over a short trail. (RULE — `tests/build-handoff.test.ts`)
- **Explore Map sends the see-through cursor** — a copy of the map cursor at 80% opacity, gliding from
  its row to the cursor over whatever it crosses (see *See-through styles*). Exploring only moves the focus, so it sends
  the cursor itself rather than a ray. (RULE — `tests/build-handoff.test.ts`)
- **Where the cursor lands** (`armingSpot` in `src/build/state.ts`): where it is, if the footprint fits;
  else the nearest spot within reach leaving a free tile around it, else the nearest that fits —
  nearest by the cursor's move, a step up or down costing more than a step sideways, so a run grows to
  the right (the reach and the cost are tuned values, `armSearchTiles` and `armVerticalCost`).
  With none in reach, arming steps one right and one down and draws the building as itself rather than
  as a refusal, until the player moves or tries. **Explore Map opened from the menu uses the same rule
  for one tile**, landing on clear ground that is easy to follow (or staying put); opened from the map,
  the cursor stays where the player put it. (RULE — `tests/build-focus.test.ts`, `tests/build-handoff.test.ts`)

## 8. Motion and transitions

- **Motion explains a change, then the screen is still.** Nothing moves unless something changed, and
  an idle screen draws once per input. Keys never wait: they act on the destination at once, and the
  animation catches up or stops. (RULE — `tests/build-motion.test.ts`)
- **Nothing teleports**: every camera change slides and every cursor move glides from wherever it is
  drawn, so a move mid-way continues smoothly. These are **tweens** (`src/view/tween.ts`): the state
  holds the destination, the tween is how the screen gets there. The cursor glides across the *view*, so
  it rides along when only the map scrolls; clicks hit-test the drawn camera.
  (RULE — `tests/build-motion.test.ts`, `tests/tween.test.ts`)
- **The card reveal**, about 400 ms in three beats (a tuned value, the owner's): the other rows fade out; the chosen row, now active,
  slides up to the header line; the card fades in, its title, subtitle and description typed out in that order, a
  building's icon playing its going-up frames. Explore Map's card opens the same way, and a card opened
  from the map by a digit too; from one card straight to another only the last beat plays, so the menu
  never flashes back between them. Going back is plain: the menu returns
  with its row lit. The live loop starts it by watching the state become a card (`cardRevealAt` in
  `src/view/build-live.ts`); the reducer never hears of it. (RULE — `tests/build-card.test.ts`)
- **An ambient effect breathes slowly and draws less often.** A popup's border breath is the one
  animation that never settles, so while it is the only thing moving the screen redraws 20 times a
  second instead of 60, and stops the moment the last popup closes. It starts at rest on the first frame
  that shows the popup, and every still frame draws it at rest. (RULE — `tests/build-breath.test.ts`)
- **An opening plays once, then gives way.** An element can open with a short, stronger effect
  that overrides its ambient one: the **popup opening**, today the Battle Round screen's **double
  flash**. It is drawn at the full frame rate, ends at rest, and hands over to the breath from rest, so
  there is no jump. A highlight, not an alarm: brief, twice, toward the title's colour. Reduced motion
  drops it; 16 colours keeps it as two steps. (RULE — `tests/build-breath.test.ts`)
- **Reduced motion snaps** — camera, cursor, card, flight — keeping only what is not movement, such as a
  blink. (RULE — `tests/build-motion.test.ts`, `tests/build-card.test.ts`, `tests/build-handoff.test.ts`)

## 9. See-through styles

A **see-through style** lays a colour over cells without hiding them. Its **alpha** (0 to 1) mixes the
style's colour, the cell's background and its glyph's colour, **the glyph taken as a fifth of the
cell**, as the owner defined it:

- **the background** becomes alpha of the style's colour plus (1 − alpha) of what was there — itself
  80% background and 20% glyph colour. His example: a white cursor at 80% over a yellow glyph on black is
  80% white, the other 20% split 80% black and 20% yellow;
- **the glyph stays**, drawn alpha of the way toward the colour the real element draws glyphs in (the
  theme's background, for the inverse-video cursor), so it stays readable as the style passes over it;
- **a role and a number, never a colour** (`CellStyle.seeThrough`, `SeeThrough` in `src/view/roles.ts`):
  exact at millions of colours, the nearest at 256, the element's plain look at 16 and in monochrome;
- **a glyphless write**, so the corruption law holds.

(RULE — `tests/see-through.test.ts`.) Any future see-through element — a travelling highlight, a ghost —
uses it rather than a new blend.

## 10. Popups

### 10.1 One shape

- **Every popup is one shape** (`src/build/popup.ts`): a title and rows as data, options naming the
  command a click, their hotkey and Enter on them all send (a setting's Left/Right and its value's two
  halves send the same decrease and increase), at most one scrolling list, drawn and hit-tested from one placement.
  (RULE — `tests/build-popups.test.ts`)
- **Unmissable**: a solid border in the map edge's weight, the title in it, a one-cell shadow (`:` or
  `░`), centred over the map, drawn last in the chrome band. (RULE — `tests/build-popups.test.ts`)
- **It holds the keyboard and the mouse** until it closes; keys it does not use do nothing. **Nothing
  opens a popup but the player.** (RULE — `tests/build-popups.test.ts`, `tests/build-placing.test.ts`)
- **A choice closes its popup**: a Nexus pick returns the player to where they were; the bottom line
  and the menu say what it did. (RULE — `tests/build-nexus.test.ts`)
- **A popup that belongs to a menu row keeps that row active behind it** (Nexus, Battle Round); one that
  belongs to none (game menu, Settings, export, Controls, Activity logs) leaves the menu unlit.
  (RULE — `tests/build-menu.test.ts`)
- **A confirmation is a screen, not a question**: its title says what is about to happen (`Battle
  Round 1`), its body announces it — data a mission can write per round (`BuildContext.roundText`), one
  sentence to a line — and its one row is the action, highlighted: `[s] Start`. Going back is Esc.
  (RULE — `tests/build-start.test.ts`)
- **Every popup's border breathes**: while a popup is open its border slowly turns a little lighter
  and a little darker, a smooth breath whose length is the "Popup pulse" Experiment. Only the border
  moves, never the title, text or shadow. (RULE — `tests/build-breath.test.ts`)
- **A popup can have an opening** that plays once from the moment it opens, then gives way to the breath.
  Which popup has which is a table in the view (`POPUP_OPENINGS`), not code in the drawing. Today only the
  Battle Round screen has one, a **double flash**: two quick flashes well past the breath's range (the
  "Battle Round flash" and "Flash strength" Experiments), then the breath from rest. Everything is still
  under reduced motion and in monochrome; at 16 colours the flash shows as two steps and the breath does
  not; the Popup pulse at 0 stops the breath only. (RULE — `tests/build-breath.test.ts`)
- **A message is a popup with nothing to choose**: a title and wrapped text, closed only by Esc, `x`, a
  right click or a click outside, over whatever was open. For a warning to read once and act on later
  (`BuildState.message`, `messageSpec`). (RULE — `tests/build-popups.test.ts`)

### 10.2 Scrolling lists and rows

- **The window follows the highlight**, in the middle while it can, derived and never stored
  (`scrollWindow`), so the reducer knows nothing of the popup's height.
  (RULE — `tests/build-popups.test.ts`)
- **The scroll bar is the right border beside the list**, only while rows are hidden: an up symbol, then
  the track — the plain border itself — with a textured **thumb** where the part in view sits (its
  length the share in view), then a down symbol: `^ # v` or `▲ ╬ ▼`, inverse like the border. The
  thumb's texture is its own, never the shadow's: a track in the shadow's texture read as more shadow
  (the bar keeps the regular border's background and differs in texture). A click on its upper half scrolls up, on its lower half down (`PlacedPopup.scrollBar`).
  (RULE — `tests/build-popups.test.ts`)
- **A long list shows where the highlight is beside its title**: `SETTINGS (6/28)`.
  (RULE — `tests/build-popups.test.ts`)
- **Section headings stay in the list**, scroll with it, and are skipped. **A long text is a list too**
  (the export), a line a row. (RULE — `tests/build-all-settings.test.ts`, `tests/build-help.test.ts`)
- **What the highlighted row is for sits under the list**, below a rule, in a fixed number of lines so
  the popup keeps its height (a `rule` row, then a `note` row). (RULE — `tests/build-popups.test.ts`)
- **A setting row** is its name and its value between `<` and `>` at the right. Left and Right change it
  (Enter/Space is Right); a choice comes round, a number stops at its ends, and the bottom line says
  every change. By mouse the value box's left half is Left and its right half Right, wide enough for a
  finger (`settingColumns`). A popup with long values may widen the box, never so far that a name loses
  its first eight columns. (RULE — `tests/build-popups.test.ts`, `tests/build-settings.test.ts`,
  `tests/build-activity.test.ts`)
- **A list whose length changes fills the room** (`PopupScroll.fill`): blank below its last row, so the
  popup's height and every row above the list stay put when the list grows or shrinks. (RULE —
  `tests/build-activity.test.ts`)
- **A line of a list can be clicked to highlight it**, so a phone can read in the note what the list
  cuts short. A note may hold paragraphs, each on its own line. (RULE — `tests/build-activity.test.ts`)

### 10.3 Settings, the export, the Controls page and the Activity logs

- **Settings**: the game menu's `[s]`, or `d` straight to the first Experiment. One scrolling list in
  **titled sections with a blank line before each** — Display (the player's own: background, colour
  depth, symbols, reduced motion — applied at once and saved), Keyboard navigation, Effects, the
  mission — and then, apart, **Export settings** (`e` from anywhere in it). A heading names the
  section and what its rows are ("saved", "experiments", or "saved and experiments"); headings and blank
  lines scroll with the list and are never rows, so Up and Down step over them and the title's count
  counts only rows the keyboard can be on. A new setting goes in the section a player would look for it
  in; a new section is one line in the list of sections. A change that needs a restart says so on the
  bottom line and, once, in a message when Settings closes with it still pending (`pendingRestart` in
  `src/build/settings.ts`). (RULE — `tests/build-all-settings.test.ts`, `tests/build-settings.test.ts`, `tests/build-popups.test.ts`)
- **The export** is text a person pastes and a program reads back: `name = value` lines, changed
  Experiments first with the defaults they replaced, and the build's commit. The adapter, never the
  reducer, copies it out; `--settings "<text>"` and `#settings=` read it back, skipping bad lines.
  (RULE — `tests/build-settings.test.ts`, `tests/build-experiments.test.ts`)
- **The Controls and hotkeys page** (`[c]` in the game menu, or `?`): every key and click grouped by where
  the player is, from one table (`controlsPage` in `src/build/help.ts`), so a new key is one line there.
  (RULE — `tests/build-help.test.ts`)
- **The Activity logs window** (`[a]` in the game menu; `a` closes it again) shows what the game
  recorded, newest first: a Filter row whose value Left and Right step through the filters (it comes
  round), `[e] Export logs`, then the list — one line per entry exactly as an export writes it, detail
  quieter, warnings and errors bold — and under a rule what the highlighted row is for: the filter's
  question, what an export holds, or what the entry's event means and every detail of it. **The list
  holds still while it is read**: a copy taken when the window opens, so new events never shift its rows
  and a full log never drops them; opening it again shows what came since. **Export** sends the filter's
  entries, oldest first, through the same adapter as the settings export (the clipboard and
  `activity-export.txt`; on the playtest page, its own box), and a message says how many went where.
  (RULE — `tests/build-activity.test.ts`)

## 11. The bottom line

- **One line: what just happened or why not — and when nothing did, what can be done here.** The last
  command's answer while it has one; otherwise the hint for where the keyboard is, from one list of
  situations (`HINTS` in `src/build/help.ts`), so a new situation is one line there.
  (RULE — `tests/build-help.test.ts`, `tests/build-view.test.ts`)
- **An answer lapses at the next command that says nothing** (`lapseStatus`); a move is one, so a
  refusal about a tile goes when the cursor leaves it. (RULE — `tests/build-help.test.ts`)
- **A message is typed** — text, a tone and its tile, never a bare string; hints have the quieter `hint`
  tone, and tones resolve onto style roles in one place (`src/view/status.ts`).
- **Say the result and the way back**: `Hatchery placed (resources: 70) - [u] undo`. **A refusal names
  its tile**, and affordability comes before any tile problem. (RULE — `tests/build-help.test.ts`)
- **Looking reads quietly, trying loudly**: a ghost on a tile it cannot use shows a grey block of `x` and
  a plain-toned reason; once the player tries, the same words turn red and bold until the answer lapses.
  **A command's own answer comes first**, a refusal included; the ghost's reason is what the line says
  when the last command said nothing. (RULE — `tests/build-help.test.ts`, `tests/build-placing.test.ts`)
- **During a Pulse** it says what the Pulse is doing, unless a popup holds the keyboard. **It fits 80
  columns**; a narrower bar drops whole words, never half of one. (RULE — `tests/build-help.test.ts`)

## 12. The map

- **A closed rectangle whose sides say whether there is more**: a thin dim line where the view can
  scroll further, **the map's own edge** where the map ends — the same weight on every side, corners
  included, in every glyph pack. No minimap, no position readout.
  (RULE — `tests/build-edge.test.ts`, `tests/build-view.test.ts`)
- **A map names its own edge style** (`BuildContext.edgeStyle`, `src/view/edge.ts`): the solid bar (the
  default), half block, heavy or double line, shade, or a fence whose posts scroll with the map; ASCII
  falls back to the solid bar (a shade is `:`, the fence `+---+`). The edge is drawn in its own quiet
  grey (`chrome.edge`) so the menu and bars stay the loudest lines. (RULE — `tests/build-edge.test.ts`)
- **The menu's divider is the map's west side**, and a map shorter than the panel closes directly under
  its own last row. (RULE — `tests/build-focus.test.ts`, `tests/build-edge.test.ts`)
- **Moving the cursor: taps are counted, a hold has a pace.** A tap is one tile. Taps of one arrow close
  together are a run that keeps its speed, and the third one since the speed changed, if quick, doubles
  it (1, 1, 2, then 2, 2, 4), so speed is asked for, never fallen into (a cursor that starts jumping
  ahead makes the player stop and come back). A held arrow moves at the game's own
  steady pace, whatever the keyboard's repeat rate, one tile a move and two after a while. A hold ends a
  run of taps, so adjusting after a hold is precise. **Shift is a jump, not a speed**, repeating no
  faster than the eye can see it land; Option+Arrow, PageUp/PageDown and Home/End are the same jump,
  because many terminals send no shifted arrow. The cursor drives the camera at a scroll margin, a share
  of the view. (RULE — `tests/build-motion.test.ts`, `tests/build-camera.test.ts`)
- ***Key releases*** (a named pattern: progressive enhancement for input): where the terminal reports key
  events (the kitty keyboard protocol, the Key releases Experiment), the game knows a tap from a repeat
  and when a key is let go; where it cannot, a press within the hold window counts as holding. Asking
  for more from a host is always undone on the way out, through the one disposer. The input path decides
  (`src/build/motion.ts`, `src/view/key-events.ts`); the reducer sees ordinary moves.
  (RULE — `tests/key-events.test.ts`, `tests/build-motion.test.ts`, `tests/build-lifecycle.test.ts`)
- **Clicks**: a click moves focus and the cursor to the tile, the ghost with it. **A second click on the
  same tile places** (by tile, never screen cell), and **a quick double click places where its first
  click pointed**, even if the view moved (`BuildSession`). A click near an edge scrolls further the
  nearer the edge, armed or not, so clicking with the ghost keeps scrolling.
  (RULE — `tests/build-focus.test.ts`, `tests/build-motion.test.ts`, `tests/build-phase.test.ts`)
- **Placing**: a planned building is drawn at full strength; undo and remove keep the plan revisable
  until the Pulse. A refused try flashes the footprint in the danger colour as the bottom line says why.
  (RULE for the flash — `tests/build-motion.test.ts`)
- **What else is on the map**: after a round, every survivor stands where Recall put it — the
  player's own and the raid's — and the raid's own structures stand where its plan put them, each in its
  side's colour. A structure of the raid's refuses a placement like the player's own; a unit does not,
  because **a unit steps aside for a building when the Pulse starts**, so a unit is never drawn over a
  planned building either. Explore Map's card reads any of them: its words, whose it is, its health now.
  (RULE — `tests/mission-loop.test.ts`)
- ***The incoming wave*** (a named pattern: the owner's "explore the map and see what is
  coming"): what the next round's triggers bring is drawn where it will arrive, **see-through** — dim, and
  faded where colour allows — so it reads as "not here yet" at every colour depth, monochrome included,
  and yields to buildings like any unit. Its card says "Incoming", when it arrives ("as the round
  starts", or seconds in), and **its intention** — one plain line the mission writes for the group — in
  place of a description. A forecast: it is placed against the map without the plan, and a building
  planned where an arrival would stand moves it when the Pulse starts. The Incoming wave Experiment hides
  it. (RULE — `tests/mission-loop.test.ts`)

## 13. Effects

- **Four families** ([`effects.md`](effects.md)), each a pure function of absolute presentation time:
  **animations** (an entity's own frames — the only family that may change its glyph), **particles**,
  **shading** (glyphless colour) and **tweens**. An animation's completion is scheduled data, never a
  callback. (RULE — `tests/effects.test.ts`, `tests/animation.test.ts`)
- **Effects never touch the plan**: the live loop times them from the frame that first drew their cause;
  undo mid-animation removes the building at once. (RULE — `tests/build-placement.test.ts`)
- **The corruption law**: an effect may recolour something on the map but never replace its glyph —
  sparks are dropped on a building's tiles. (RULE — `tests/effects.test.ts`, `tests/see-through.test.ts`)
- **An effect never carries a cue alone**: the settled screen or the bottom line says it too. **Every
  effect owes three forms**, authored together — full, reduced motion (keep the cause and the impact,
  drop the travel) and monochrome ([`effects.md`](effects.md)). (RULE — `tests/effects.test.ts`)
- **Light is a role pulled toward another role** (`CellStyle.tint`): a blend at 256 colours and up, a
  step at 16, nothing in monochrome, where a change of weight carries it. (RULE — `tests/effects.test.ts`, `tests/roles.test.ts`)
- **A placement is felt, then settles**: a few frames going up, a moment lit with sparks, then the still
  picture. A removal throws the same sparks. Reduced motion shows the finished building at once, unlit,
  with a still mark for the sparks. (RULE — `tests/build-placement.test.ts`)
- **A reserved colour means one thing.** Red is kept for the player's own Nexus being hurt — first hit,
  very low health, a lost round — as a faint, brief tint of the border, always said again in words, and
  absent under reduced motion. A new warning goes to the timer or the light, never to more red.
  (RULE — `tests/pulse-screen.test.ts`, `tests/ending.test.ts`)

## 14. The Nexus Pulse on screen

- **The Pulse plays on the Build Phase's screen**; only the panel changes. It opens on the player's
  Nexus, the arrows look around, and the Pulse never waits for the player.
  (RULE — `tests/pulse-screen.test.ts`)
- **The panel, in order**: `NEXUS PULSE 1` with the time left until the last shot; what the timer counts
  and its speed; a line per side (units, a health bar, the number); the last five events in plain words,
  coloured by side; then `[space] Pause` and `[r] Watch again`. Speed (`[`, `]`) and stepping (`.`, `,`)
  are keys, on the Controls page. (RULE — `tests/pulse-screen.test.ts`)
- **The ending is four beats, in order**: the **last seconds** — only the title's timer flashes, slowly,
  and a soft light sweeps the border like a lighthouse (colour, never a glyph; in monochrome the timer
  reverses and the border goes bold) — then **cease fire**, **Recall** (survivors walk home) and the
  **result** (`VICTORY`, `DEFEAT`, `DRAW` or `TIME'S UP`, why, and how many came home) — words first, on
  the panel and again on the bottom line, colour second. Reduced motion holds the timer lit and the light
  steady, and puts everyone home at once. (RULE — `tests/ending.test.ts`, `tests/pulse-screen.test.ts`)
- **Nothing the player does changes what the Pulse did**: it was resolved before the first frame, so
  Watch again only restarts the clock; centring on the Nexus is the same named command a key sends.
  (RULE — `tests/pulse-screen.test.ts`)
- ***The loop***: in a mission, the result says the fight first — `VICTORY`, `DEFEAT`, `DRAW` or
  `TIME'S UP`, and why — then where the mission stands ("Round 1 of 3 is over. The Nexus stands."), and
  the row where Pause was becomes **`[enter] Next round`**: Enter, Space, `n` or a click open the next
  round's Build Phase on what the last one left — the player's buildings standing, the survivors home,
  the credits not spent, a new Nexus power dealt, the cursor on the Nexus, and the bottom line saying how
  the last round went. **Nothing moves on before the result stands**: a key must never skip the ending.
  (The Next round Experiment can begin it on its own a moment after the result instead.) When a trigger
  ends the mission, **the mission's verdict leads** — `MISSION COMPLETE` or `MISSION FAILED`, in the
  mission's own words ("The perimeter held.") — with the last round's fight and its reason under it, and
  the row is `[enter] Play again`. Restart, from the game menu, is the mission from round 1.
  (RULE — `tests/mission-loop.test.ts`)
- **A mission's round is counted in the top bar** — `build phase - round 2 of 3` — because PERIMETER's goal
  is about rounds (a round counter shows only when the goal is about rounds), and the Battle Round screen
  is that round's number, in the mission's words for it.
  (RULE — `tests/mission-loop.test.ts`, `tests/build-start.test.ts`)

## 15. Feedback loops

**The game is built to be judged by playing it.** Every pull request ends with a build the owner — and,
later, friends he shares a link with — can play on a laptop or a phone, and the game carries the tools
for the answer to come back precise: what to feel, what happened, which build. Feedback itself travels
the ordinary way — words, screenshots and voice in the pull request or the session. Three tools, all
sized per pull request by the agent asking:

- **Experiments** ask *which feels right?* — a setting he flips (15.1), returned by the settings export.
- **Activity Logs** answer *what happened?* — events the game records, filtered and exported from the
  game menu (15.2).
- **The claude.ai playtest page** is where both meet: the build is a link, both exports land in text
  boxes under the screen, and a demo button opens the game exactly where the question is (15.3).

The determinism underneath — a seeded kernel, a Build Phase with no clock, every input a named command,
the build stamped on every export — is what makes a pasted export reproducible with `--settings` and
`--keys`. Keep it that way.

### 15.1 Experiments and tuned values


- **Every setting is declared once, with its tier** (`src/build/all-settings.ts`): **player** —
  shown in Settings and saved; **experiment** — shown for the owner's playtests, never saved, written
  into the export; **tuned** — a constant in code, not shown. A shown setting also names its section,
  label, the question it answers, its values and its default. Moving a setting between tiers or sections
  is a one-word edit plus, at most, its default; code reads a value with `setting(state, name)` and never
  cares which tier it is on. (Promoting one to *player* also needs a field in the saved settings; a type
  check says so.) A tuned constant that no longer needs tuning can later move next to the code that uses
  it. (RULE — `tests/build-all-settings.test.ts`)
- **A choice the owner should feel ships as an Experiment**, defaulting to the recommended answer — a
  timing, a look, a movement rule, or an on/off for a feature whose worth is in doubt. The pull request
  asks him in plain words to flip it (Settings, or `d`) and paste the export; `--settings` shows what he
  saw. (RULE for the settings flag and the export — `tests/build-experiments.test.ts`)
- **Once he settles one it moves to the tuned tier**: his value becomes its default, with who chose it
  and when, and it leaves Settings, so a new one stands out. It can come back the same way when a later
  round wants to feel it again — as keyboard navigation's numbers did for the navigation polish round.
  Some stay on purpose: a number that depends on the player's keyboard (the hold window), a comparison he
  asked to make (key releases), a look still being felt (the popup pulse and the Battle Round flash), or
  a feature whose worth is in doubt (the mission's Next round and Incoming wave). A renamed setting keeps its old name readable in old
  exports. (RULE for the old names — `tests/build-all-settings.test.ts`)
- **Never copy a tuned number into prose**; point at the setting.

### 15.2 Activity Logs

- **One structured logger** (`src/log/`): every event is declared before it is logged — its name, its
  default level (error, warn, info, debug), a sentence on what it means, and each property's type and
  meaning — so the schema in `src/log/activity.ts` is the documentation, and `activity.log(event, props)`
  accepts only what it declares. Entries are kept in memory, the oldest dropped past a limit.
  (RULE — `tests/log.test.ts`)
- **A log is a record, never an input**: the kernel and the match layer never reach it, and nothing the
  rules decide reads one. (RULE — `tests/architecture.test.ts`)
- **The Activity logs window** — the game menu's `[a]` (10.3) — lists them newest first under a filter,
  shows the highlighted one's every detail, and exports what the filter shows (oldest first) to paste
  into a pull request. It is deliberately plain. `node scripts/playtest.mjs … --activity [filter]`
  prints what a scripted run recorded.
- **An agent asking about an interaction** adds the event where it happens (never in the kernel), and a
  filter for its question at the top of `ACTIVITY_FILTERS` (the window opens on the first), then asks in
  the pull request: "play it, open Esc → Activity logs, export, paste it here". Remove both once
  answered, as an Experiment is removed.

### 15.3 The playtest page

- **The build is a link**: the browser playtest page published as a private claude.ai page, the same
  screen loops as the terminal. Tools *around* the screen are fair game there; the game's own screen
  never changes for it.
- **Exports land beside the screen**: the settings and the activity logs each fill a text box with a Copy
  button, so a phone can paste them. (RULE — `tests/build-activity.test.ts`, `tests/web.test.ts`)
- **Demo buttons open the game where the question is**: `#keys=` and `#settings=` in the address, and
  buttons for the pull request's demos (`bun scripts/build-web.mjs --demos <file>`; a bad key script
  fails the build). Each demo names what to try.

## 16. Words

- **Plain words on screen**, no internal ids; each Nexus named for its faction ("Citizen Nexus").
- **The build is named the same way everywhere it appears** — its commit, with `+changes` for a build
  made from uncommitted edits — on About (`Build: <commit>`), at the top of both exports, and in the
  playtest page's header.
- **Keys as the rows write them** — `[enter]`, `[esc]`, `[e]` — and arrows, up/down and left/right as
  plain words. For a way back, the action first, then the key (`back [esc]`).
- **Names**: the menu's acknowledgement is *pressed* in code (`ack`, `PRESSED_LOOK`) and a *blink* on screen; the
  building hand-off's traveller is the *focus arrow*; Explore Map's is the *see-through cursor*.
- **Battle Round or Pulse is still open** (Q68): the start screen says Battle Round; the menu row and the
  running screen say Pulse until it is settled. A mission's cycles are **rounds** to the player — "round 2
  of 3", "Next round" — which agrees with Battle Round either way. The words are defined in
  [`grid-engine.md`](grid-engine.md); the "Popup pulse" Experiment is a breath of light on a popup's
  border and has nothing to do with the Nexus Pulse.

## Where the rules came from

The owner's words, item by item, with what was done about each, newest first:
[`2026-10-01-feedback-loops`](../history/feedback/2026-10-01-feedback-loops.md),
[`2026-09-30-menu-spike-round-2`](../history/feedback/2026-09-30-menu-spike-round-2.md),
[`2026-09-30-menu-spike`](../history/feedback/2026-09-30-menu-spike.md),
[`2026-09-29-pr48-round-3`](../history/feedback/2026-09-29-pr48-round-3.md),
[`2026-09-29-pr48-pulse`](../history/feedback/2026-09-29-pr48-pulse.md),
[`2026-09-29-pr46-round-4`](../history/feedback/2026-09-29-pr46-round-4.md),
[`2026-09-28-pr46-playtest`](../history/feedback/2026-09-28-pr46-playtest.md) and
[`2026-09-27-build-phase-playtest`](../history/feedback/2026-09-27-build-phase-playtest.md).
