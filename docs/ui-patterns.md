# Terminal Nexus — interface patterns

**Document role:** The working guide to how every interactive screen looks and behaves
**Status:** WORKING — built on the Build Phase; not canon until the owner accepts it and it is promoted into `specs/engine.md` Section 9
**Updated:** 2026-09-30 (rewritten by pattern rather than by history, F74; the screen as the menu spike's second round leaves it, F61-F76)
**License:** Apache-2.0

## How to use this document

For any agent or person about to build or change a screen, a menu, a popup, an effect or a key. Read
**section 0, the goals, and the checklist below first**, then the sections you touch.

- **When two rules disagree, or none covers the case, the goals decide.**
- **A change that breaks a rule or adds a pattern updates this document in the same pull request**, and
  says why. A new pattern gets a name here — a *hand-off*, a *card reveal*, a *see-through style* — so
  the next screen reuses it; use the names in code comments and pull requests too.
- **Numbers live in the code, not here**: the table of tuned values and the Experiments list
  (`src/build/experiments.ts`). This document says what a number is for.
- The canon's interface rules are `specs/engine.md` 3.3, 9.2 and 9.7 and `specs/ascii-effects.md` 1.2;
  where they speak, they win. `scripts/playtest.mjs` (the `playtest` skill) presses the keys for you.

### Checklist for a new screen

- [ ] It can be walked with Up, Down and Enter alone; every action is a row with a visible `[key]`.
- [ ] A click on a row does what its key does.
- [ ] Esc and `x` go back one level; only the game menu's Quit leaves.
- [ ] The top bar's right end names what Esc does there.
- [ ] The bottom line has a hint for every situation the screen can be in.
- [ ] Lists stop at their ends; a held arrow ramps; Shift, PageUp/PageDown and Home/End jump to the ends.
- [ ] Motion explains a change, then the screen is still.
- [ ] It works under reduced motion, in monochrome, in ASCII, and at 80 × 24.
- [ ] Anything the owner should feel rather than read about is an Experiment.

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
10. **Give him something to feel, not something to judge.** A fork ships as an Experiment he can flip,
    and his exported settings are the answer.
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
  map shows 49 × 18 tiles.
- **One place has the keyboard**, shown by exactly one "you are here": the menu's highlight bar or the
  map cursor, never both. Focus is state (`BuildState.focus`), so a script sets it and a test reads it.
- **The highlight bar means "the keyboard is here, not chosen yet"** and nothing else. After the mouse
  works the menu it is hidden, and the next menu key only shows it again (`BuildState.highlightHidden`).
- **A key means one thing per screen.** Arrows and Enter/Space follow focus; digits always address their
  row; letters always name commands. Tab toggles focus; Left and Right on the menu only flicker the row.
- **The map has three modes, each with its own hint**: **placing** (a building armed, its ghost at the
  cursor, its card in the panel), **Explore Map** (the panel describes what is under the cursor) and
  **plain navigation** (the bare cursor, the menu beside it). Tab and a click on the map arrive in plain
  navigation; Explore Map is `e`, its row, or Enter/Space in plain navigation.
- **Finishing goes back to where it began** (`BuildState.returnTo`): begun on the map, it ends in plain
  navigation with the cursor where it was; begun on the menu, it ends on the same row, and a placement
  flashes that row once to bring the eye back.
- **The Build Phase opens on the menu at Explore Map**, the cursor (not yet drawn) on the player's Grid
  Nexus.

## 2. Keys and clicks

- **Every action is a named command**; keyboard, mouse and a script are adapters onto one vocabulary
  (`specs/engine.md` 9.7), and tests drive the real adapters with raw keys and clicks.
- **A click activates what it lands on**, from any focus: a building's row arms it, `[n] Nexus` opens its
  popup, `[e] Explore Map` opens it. What a row click starts comes back to the menu.
- **A click can only choose what it could see**: while a card covers the menu, a click on the panel goes
  back and chooses nothing. **A click outside a popup** closes it and moves focus there, nothing more.
- **Whole rows are targets**, as wide as the highlight bar, and **drawing and hit-testing read one
  geometry** (`buildLayout` in `src/build/layout.ts`, the placed popup in `src/build/popup.ts`).
- **A right click is `x`.** **The wheel** moves the map cursor five tiles (never a second camera) and
  walks a popup's list.

## 3. Back, cancel and close

**Esc or `x` closes any popup, or cancels what is under way on the map, one level at a time.** A right
click is `x`.

- **One level per press**: a popup goes back to the one it was opened from (Settings to the game menu,
  the export to Settings, the restart message to the game menu's Restart row) or closes; placing or Explore Map goes back to
  where it began; plain navigation goes to the menu.
- **Only Esc opens the game menu.** On the menu nothing is left to cancel: Esc opens the game menu, and
  `x` and a right click do nothing there — no message, no flicker — so `x x x` always lands on the menu
  with the keyboard on it; the same on a committed plan and during a Pulse. `q` opens the game menu from
  anywhere. Two commands carry this: `cancel` (Esc, the top bar's label) and `back` (`x`, a right click).
- **The key that opened something closes it**: `e`, `n`, `d`, and a building's own digit while it is
  being placed. (On the Battle Round screen `s` confirms instead: starting takes two deliberate presses.)
- **No popup carries its own way back** — no `[esc] Back` row, no `[esc]` in its border. **The top bar's
  right end says what Esc does now**: `menu [esc]` on the menu and while a Pulse plays, `back [esc]` on
  the map, `close [esc]` over a popup — the action quiet, the key in the hotkey colour. A click on it is
  exactly Esc (`escLabel` in `src/build/layout.ts`).
- **The game menu** is `[s] Settings`, `[c] Controls and hotkeys`, `[r] Restart` (the plan lost, settings
  and Experiments kept) and `[q] Quit`. **Leaving always asks**; Ctrl+C is the one immediate way out.

## 4. Menu rows

- **A menu can always be walked with Up, Down and Enter alone.** Every action is a row in walking order,
  and Enter (or Space) does what its hotkey and a click do; an action with only a key or a button makes
  the menu incomplete. The same holds for a popup's options; a test walks the whole menu
  (`tests/build-start.test.ts`).
- **Every row shows its hotkey** as `[x]` in the hotkey colour; the bracket carries it in monochrome.
- **Two states, and only two**:
  - **highlighted** — an inverse bar across the row, in one colour, only while the menu has the keyboard;
  - **active** — its action is under way: it keeps its own hotkey, turns the hotkey colour, and a single
    **`>`** replaces its value at the right end, pointing at the map — `[1] Barracks  >`. No bar, no
    underline. A building being placed, Explore Map open, the Nexus popup or the Battle Round screen
    open: every row either opens a popup or gives the map something to do, and all share the look
    (`menuRowActive`, `menuRowSpec`, `drawMenuRow` in `src/view/build.ts`).
- **Two brief acknowledgements**: **pressed** — a stronger bar in the hotkey colour for a few frames
  after activation, the look the cursor's blink borrows; and **refused** — when a key reached the row but
  had nothing to do, **the words turn grey for a moment and the background stays**, reading "nothing
  here" rather than a press (dim in monochrome).
- **Disabled** rows (unaffordable, or Start Pulse before the Nexus pick) are dimmed, and pressing one is
  refused with its reason on the bottom line.
- **Timing lives in the live loop, never the reducer**: the reducer records an acknowledgement with a
  sequence number (`BuildState.ack`) and `src/view/build-live.ts` shows it from the frame that first
  sees it. Still frames carry none.

## 5. Moving in lists

**List movement** is the map cursor's movement applied to rows, in every list — the Build Phase menu,
the Nexus powers, the game menu, Settings, the export, the Controls page, the title screen's menu.

- **No wrapping**: a list stops at its first and last row; holding Down arrives at the bottom and stays.
  Up on the first row and Down on the last do nothing, without a flicker — a held key would otherwise
  flicker at every repeat.
- **A tap is always one row; holding ramps** with the map cursor's own steps and timings (section 12),
  clamped at the ends. The title screen's menu stops and jumps but does not ramp: its few rows need none
  and its loop reads no clock. One key classifier serves every list (`src/menu/list-keys.ts`).
- **Shift+Up/Down, PageUp/PageDown and Home/End go to the first or last row.**
- **Rows that are not choices are skipped**: blank lines, the credits line, section headings.

## 6. The side panel

### 6.1 The Build Phase menu

- **One list**: `[e] Explore Map`, `[n] Nexus` (picks waiting as `(1)` in the hotkey colour), then **the
  credits line** — the blank line before the buildings, what is left to spend right-aligned in the cost
  column after the map's own resource symbol in the deposit's colour (`◆ 130`; `* 130` in ASCII) — every
  building in catalog order with its cost, and `[s] Start Pulse` on the panel's last line.
- **Letters above the buildings, digits for them**, so no digit moves when an entry is added. No group
  headings until a real game needs them; if they return, one digit sequence runs through them. A row the
  panel has no room for is neither drawn nor clickable. The order lives in `menuEntries`
  (`src/build/state.ts`).
- **No help text in the panel**: what a row does is the bottom line's to say.
- **The action that ends the phase is the last row** (`startRow`), dim and refused with its reason until
  the Nexus power is picked; it opens the Battle Round screen.

### 6.2 Cards

- **A card replaces the menu while something has the map's attention**: Explore Map's describes what is
  under the cursor as it moves; a building's describes the building being placed.
- **Its header is the row that opened it**, moved to the panel's top line and drawn active with its own
  hotkey — `[e] Explore Map  >`, `[1] Barracks  >` — over a separator (`-` or `─`). **That hotkey
  cancels**, as Esc, `x` and a click on the panel do. No credits line on a card.
- **Its contents**: the thing's glyphs as its icon; its name and where it stands (planned, standing, to
  build); what it does; cost, health, size and attack as label/value rows. On bare ground, the terrain
  and the tile. **Panel text never cuts a word**; it wraps or is dropped.
- It appears with the **card reveal** (section 8).

### 6.3 A selection holds the menu

While a building is being placed it stays the selection until placed or cancelled: another building's
digit, `e` and `s` (and `p`) are refused — the header flickers and the bottom line says to place it or
cancel it first, naming the keys. Its own digit, Esc and `x` cancel it. Popups (the Nexus powers, the
game menu, Settings, Controls) still open over it and hand it back, still armed, and a popup over a card
never moves the menu's highlight. So the menu is never workable with a ghost on the map, and never loses
track of what is armed (`refuseWhileArmed` in `src/build/state.ts`). Explore Map holds nothing: a digit
while exploring arms from the map, and `n` opens the Nexus powers.

## 7. Hand-offs to the map

A **hand-off** is a menu row giving the keyboard to the map — a building armed, or Explore Map opened,
from the menu. It is shown so the eye travels with the keyboard: something flies from the row's own
place to the cursor, and **the cursor blinks twice** (the pressed look, at its speed) when it lands.
Keys work at once. Never on the way back, and never for Tab or a click on the map. Reduced motion drops
the flight and keeps the blink. The reducer records a sequence number (`BuildState.handoff`); the live
loop times the rest.

- **A building sends the focus arrow** — the owner's "energy ray", in the hotkey colour: from the right end of
  the row, where the row stood in the menu (it then slides up to be the card's header), straight to the
  cursor, eased to arrive fast, homing if the cursor moves, its head (`>` or `▶`) pointing the way it
  flies over a short trail.
- **Explore Map sends the see-through cursor** — a copy of the map cursor at 80% opacity, gliding from
  its row to the cursor over whatever it crosses (section 9). Exploring only moves the focus, so it sends
  the cursor itself rather than a ray.
- **Where the cursor lands** (`armingSpot` in `src/build/state.ts`): where it is, if the footprint fits;
  else the nearest spot within 12 tiles leaving a free tile around it, else the nearest that fits —
  nearest by the cursor's move, sideways costing one and up or down two, so a run grows to the right.
  With none in reach, arming steps one right and one down and draws the building as itself rather than
  as a refusal, until the player moves or tries. **Explore Map opened from the menu uses the same rule
  for one tile**, landing on clear ground that is easy to follow (or staying put); opened from the map,
  the cursor stays where the player put it.

## 8. Motion and transitions

- **Motion explains a change, then the screen is still.** Nothing moves unless something changed, and
  an idle screen draws once per input. Keys never wait: they act on the destination at once, and the
  animation catches up or stops.
- **Nothing teleports**: every camera change slides and every cursor move glides from wherever it is
  drawn, so a move mid-way continues smoothly. These are **tweens** (`src/view/tween.ts`): the state
  holds the destination, the tween is how the screen gets there. The cursor glides across the *view*, so
  it rides along when only the map scrolls; clicks hit-test the drawn camera.
- **The card reveal**, about 150 ms in three beats: the other rows fade out; the chosen row, now active,
  slides up to the header line; the card fades in, its name, subtitle and description typed out, a
  building's icon playing its going-up frames. Explore Map's card opens the same way, and a card opened
  from the map by a digit too; from one card straight to another only the last beat plays, so the menu
  never flashes back between them. The length is an Experiment. Going back is plain: the menu returns
  with its row lit. The live loop starts it by watching the state become a card (`cardRevealAt` in
  `src/view/build-live.ts`); the reducer never hears of it.
- **Reduced motion snaps** — camera, cursor, card, flight — keeping only what is not movement, such as a
  blink.

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

Any future see-through element — a travelling highlight, a ghost — uses it rather than a new blend.

## 10. Popups

### 10.1 One shape

- **Every popup is one shape** (`src/build/popup.ts`): a title and rows as data, options naming the
  command a click sends, at most one scrolling list, drawn and hit-tested from one placement.
- **Unmissable**: a solid border in the map edge's weight, the title in it, a one-cell shadow (`:` or
  `░`), centred over the map, drawn last in the chrome band.
- **It holds the keyboard and the mouse** until it closes; keys it does not use do nothing. **Nothing
  opens a popup but the player.**
- **A choice closes its popup**: a Nexus pick returns the player to where they were; the bottom line
  and the menu say what it did.
- **A popup that belongs to a menu row keeps that row active behind it** (Nexus, Battle Round); one that
  belongs to none (game menu, Settings, export, Controls) leaves the menu unlit.
- **A confirmation is a screen, not a question**: its title says what is about to happen (`Battle
  Round 1`), its body announces it — data a mission can write per round (`BuildContext.roundText`), one
  sentence to a line — and its one row is the action, highlighted: `[s] Start`. Going back is Esc.
- **A message is a popup with nothing to choose**: a title and wrapped text, closed only by Esc, `x`, a
  right click or a click outside, over whatever was open. For a warning to read once and act on later
  (`BuildState.message`, `messageSpec`).

### 10.2 Scrolling lists and rows

- **The window follows the highlight**, in the middle while it can, derived and never stored
  (`scrollWindow`), so the reducer knows nothing of the popup's height.
- **The scroll bar is the right border beside the list**, only while rows are hidden: an up symbol, a
  textured track with a solid thumb (its length the share in view), a down symbol — `^ : v` or `▲ ░ ▼`,
  inverse like the border. A click on its upper half scrolls up, on its lower half down
  (`PlacedOverlay.scrollBar`).
- **A long list shows where the highlight is beside its title**: `SETTINGS (6/28)`.
- **Section headings stay in the list**, scroll with it, and are skipped. **A long text is a list too**
  (the export), a line a row.
- **What the highlighted row is for sits under the list**, below a rule, in a fixed number of lines so
  the popup keeps its height (a `rule` row, then a `note` row).
- **A setting row** is its name and its value between `<` and `>` at the right. Left and Right change it
  (Enter/Space is Right); a choice comes round, a number stops at its ends, and the bottom line says
  every change. By mouse the value box's left half is Left and its right half Right, wide enough for a
  finger (`settingColumns`).

### 10.3 Settings, the export and the Controls page

- **Settings**: the game menu's `[s]`, or `d` straight to the Experiments. One list: the player's own
  settings (background, colour depth, symbols, reduced motion — applied at once and saved), then the
  Experiments (never saved), then **Export settings** (`e` from anywhere in it). A change that needs a
  restart says so on the bottom line and, once, in a message when Settings closes with it still pending
  (`pendingRestart` in `src/build/settings.ts`).
- **The export** is text a person pastes and a program reads back: `name = value` lines, changed
  Experiments first with the defaults they replaced, and the build's commit. The adapter, never the
  reducer, copies it out; `--settings "<text>"` and `#settings=` read it back, skipping bad lines.
- **The Controls and hotkeys page** (`[c]` in the game menu, or `?`): every key and click grouped by where
  the player is, from one table (`controlsPage` in `src/build/help.ts`), so a new key is one line there.

## 11. The bottom line

- **One line: what just happened or why not — and when nothing did, what can be done here.** The last
  command's answer while it has one; otherwise the hint for where the keyboard is, from one list of
  situations (`HINTS` in `src/build/help.ts`), so a new situation is one line there.
- **An answer lapses at the next command that says nothing** (`lapseStatus`), and one about a tile when
  the cursor leaves it.
- **A message is typed** — text, a tone and its tile, never a bare string; hints have the quieter `hint`
  tone, and tones resolve onto style roles in one place (`src/view/status.ts`).
- **Say the result and the way back**: `Hatchery placed (resources: 70) - [u] undo`. **A refusal names
  its tile**, and affordability comes before any tile problem.
- **Looking reads quietly, trying loudly**: a ghost on a tile it cannot use shows a grey block of `x` and
  a plain-toned reason; once the player tries, the same words turn red and bold until the answer lapses.
  **A command's own answer comes first**, a refusal included; the ghost's reason is what the line says
  when the last command said nothing.
- **During a Pulse** it says what the Pulse is doing, unless a popup holds the keyboard. **It fits 80
  columns**; a narrower bar drops whole words, never half of one.

## 12. The map

- **A closed rectangle whose sides say whether there is more**: a thin dim line where the view can
  scroll further, **the map's own edge** where the map ends — the same weight on every side, corners
  included, in every glyph pack. No minimap, no position readout.
- **A map names its own edge style** (`BuildContext.edgeStyle`, `src/view/edge.ts`): the solid bar (the
  default), half block, heavy or double line, shade, or a fence whose posts scroll with the map; ASCII
  falls back to the solid bar (a shade is `:`, the fence `+---+`). The edge is drawn in its own quiet
  grey (`chrome.edge`) so the menu and bars stay the loudest lines.
- **The menu's divider is the map's west side**, and a map shorter than the panel closes directly under
  its own last row.
- **Moving the cursor**: a tap is one tile, always. The same arrow again within the hold window is a run —
  2 tiles a press at once, 4 once it is old enough; any other key starts over. **Shift is a jump, not a
  speed**, repeating no faster than the eye can see it land; Option+Arrow, PageUp/PageDown and Home/End
  are the same jump, because many terminals send no shifted arrow. "Held" is read from the gaps between
  presses in the input path (`src/build/motion.ts`), since a terminal sends no key-up (Q66 asks about
  reading releases where one does). The cursor drives the camera at a scroll margin, a share of the view.
- **Clicks**: a click moves focus and the cursor to the tile, the ghost with it. **A second click on the
  same tile places** (by tile, never screen cell), and **a quick double click places where its first
  click pointed**, even if the view moved (`BuildSession`). A click near an edge scrolls further the
  nearer the edge, armed or not, so clicking with the ghost keeps scrolling.
- **Placing**: a planned building is drawn at full strength; undo and remove keep the plan revisable
  until the Pulse. A refused try flashes the footprint in the danger colour as the bottom line says why.

## 13. Effects

- **Four families** (`specs/ascii-effects.md` 1.2), each a pure function of absolute presentation time:
  **animations** (an entity's own frames — the only family that may change its glyph), **particles**,
  **shading** (glyphless colour) and **tweens**. An animation's completion is scheduled data, never a
  callback.
- **Effects never touch the plan**: the live loop times them from the frame that first drew their cause;
  undo mid-animation removes the building at once.
- **The corruption law**: an effect may recolour something on the map but never replace its glyph —
  sparks are dropped on a building's tiles.
- **An effect never carries a cue alone**: the settled screen or the bottom line says it too. **Every
  effect owes three forms**, authored together — full, reduced motion (keep the cause and the impact,
  drop the travel) and monochrome (`specs/ascii-effects.md` 4).
- **Light is a role pulled toward another role** (`CellStyle.tint`): a blend at 256 colours and up, a
  step at 16, nothing in monochrome, where a change of weight carries it.
- **A placement is felt, then settles**: a few frames going up, a moment lit with sparks, then the still
  picture. A removal throws the same sparks. Reduced motion shows the finished building at once, unlit,
  with a still mark for the sparks.
- **A reserved colour means one thing.** Red is kept for the player's own Nexus being hurt — first hit,
  very low health, a lost Pulse — as a faint, brief tint of the border, always said again in words, and
  absent under reduced motion. A new warning goes to the timer or the light, never to more red.

## 14. The Nexus Pulse on screen

- **The Pulse plays on the Build Phase's screen**; only the panel changes. It opens on the player's
  Nexus, the arrows look around, and the Pulse never waits for the player.
- **The panel, in order**: `NEXUS PULSE 1` with the time left until the last shot; what the timer counts
  and its speed; a line per side (units, a health bar, the number); the last five events in plain words,
  coloured by side; then `[space] Pause` and `[r] Watch again`. Speed (`[`, `]`) and stepping (`.`, `,`)
  are keys, on the Controls page.
- **The ending is four beats, in order**: the **last seconds** — only the title's timer flashes, slowly,
  and a soft light sweeps the border like a lighthouse (colour, never a glyph; in monochrome the timer
  reverses and the border goes bold) — then **cease fire**, **Recall** (survivors walk home) and the
  **result** (`VICTORY`, `DEFEAT`, `DRAW` or `TIME'S UP`, why, and how many came home) — words first, on
  the panel and again on the bottom line, colour second. Reduced motion holds the timer lit and the light
  steady, and puts everyone home at once.
- **Nothing the player does changes what the Pulse did**: it was resolved before the first frame, so
  Watch again only restarts the clock; centring on the Nexus is the same named command a key sends.

## 15. Experiments and tuned values

- **A choice the owner should feel ships as an Experiment**, defaulting to the recommended answer — a
  timing, a look, a movement rule, or an on/off for a feature whose worth is in doubt. The pull request
  asks him in plain words to flip it (the game menu's Settings, or `d`) and paste the export; `--settings`
  shows what he saw. Every Experiment names its question (`src/build/experiments.ts`).
- **Once he settles one it leaves Settings**: his value becomes the default in the code's table of tuned
  values (`TUNING` in `src/build/tuning.ts`), with who chose it and when, and the Experiment is deleted, so a new one stands out. Some stay on
  purpose: a number that depends on the player's keyboard (the hold window), or placeholder data (the
  Pulse's raid and crew).
- **Never copy a tuned number into prose**; point at the table.

## 16. Words

- **Plain words on screen**, no internal ids; each Nexus named for its faction ("Citizen Nexus").
- **Keys as the rows write them** — `[enter]`, `[esc]`, `[e]` — and arrows, up/down and left/right as
  plain words. For a way back, the action first, then the key (`back [esc]`).
- **Names**: the menu's acknowledgement is the *pressed flash* in code and a *blink* on screen; the
  building hand-off's traveller is the *focus arrow*; Explore Map's is the *see-through cursor*.
- **Battle Round or Pulse is still open** (Q68): the start screen says Battle Round; the menu row and the
  running screen say Pulse until it is settled.

## Where the rules came from

The owner's words, item by item, with what was done about each, newest first:
[`2026-09-30-menu-spike-round-2`](feedback/2026-09-30-menu-spike-round-2.md) (F61-F76),
[`2026-09-30-menu-spike`](feedback/2026-09-30-menu-spike.md) (F52-F60),
[`2026-09-29-pr48-round-3`](feedback/2026-09-29-pr48-round-3.md) (F47-F51),
[`2026-09-29-pr48-pulse`](feedback/2026-09-29-pr48-pulse.md) (F41-F46),
[`2026-09-29-pr46-round-4`](feedback/2026-09-29-pr46-round-4.md) (F28-F40),
[`2026-09-28-pr46-playtest`](feedback/2026-09-28-pr46-playtest.md) (F18-F27) and
[`2026-09-27-build-phase-playtest`](feedback/2026-09-27-build-phase-playtest.md) (F1-F17).
