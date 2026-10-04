# Terminal Nexus — presentation

_How state becomes what is on screen: the cell frame, composition by phase, tile width, bands, the effects hook-up and accessibility._

## 1. The cell frame — RULE

**RULE** — `src/view/frame.ts` (the types), `tests/view.test.ts` (every frame is roles and one-cell glyphs).

```ts
type CellStyle = Readonly<{
  fgRole?: string          // a role, never a colour
  bgRole?: string
  bold?: boolean
  dim?: boolean
  underline?: boolean
  inverse?: boolean
  fade?: number            // 0-1, fgRole only: 0 the role's own colour, 1 the theme's background
  tint?: { role: string; amount: number } // 0-1, fgRole pulled toward another role
  seeThrough?: { role: string; alpha: number } // 0-1, a see-through cursor over the cell
}>

type Cell = Readonly<{ glyph: string; style: CellStyle }>

type ReadonlyCellFrame = Readonly<{
  width: number
  height: number
  cells: readonly Cell[]
}>

interface TerminalBackend {
  start(): Promise<void>
  present(frame: ReadonlyCellFrame): void | Promise<void>
  stop(): Promise<void>
}
```

**The compositor emits an engine-owned cell frame; platform backends are adapters that present it**
(RULE — `src/view/frame.ts`, `tests/web.test.ts`, `tests/see-through.test.ts`). The simulation emits
visibility-filtered semantic views and events; the terminal compositor turns them into cells; the ANSI
writer, OpenTUI and the browser page's canvas only draw those cells. No backend object ever appears
inside a frame.

**Cells carry style roles, never colours** (RULE — `tests/view.test.ts`, `tests/roles.test.ts`). Style
carries **roles** — `fgRole: "faction.citizen"`, never `"#ff8800"` — and the capability mode resolves
roles to colour, which is what makes monochrome a setting rather than a rewrite. The compositor emits
only roles from the committed vocabulary.

**The presentation baseline is monochrome seven-bit ASCII, enhanced by explicit ANSI colour and optional
Unicode** (RULE — `tests/view.test.ts`, `tests/effects.test.ts`). ASCII is the baseline and the
acceptance target; colour and Unicode packs add to it and are never required to read a screen.

**Capability modes are four, and they buy fidelity rather than facts**: monochrome, 16-colour,
256-colour and truecolor, resolving one role table. Every tier puts identical glyphs on screen, so
nothing a player needs is available only to a colour terminal. Monochrome is the floor, not the
degraded mode (RULE — `tests/view.test.ts`, `tests/build-view.test.ts`, `tests/effects.test.ts`: each
asserts that every tier shows the same glyphs).

**A glyph pack is optional, and it changes the field and the frame, never the actors** (RULE —
`tests/effects.test.ts`). Units stay letters in every pack, because letter case carries ownership and
the glyph family carries faction; prettier symbols do not improve that, and they would break the one
system that survives monochrome. A pack may only draw from a curated single-width set.

**Faction visual identity lives in the glyph family and the effect language; ownership keeps the
colour** (RULE — `tests/content.test.ts`, which holds that art is authored lower case so ownership can
flip its case, and `tests/effects.test.ts`). A mirror match stays legible, and monochrome stays whole.

**The style attributes beyond roles** are each a role and a number, so "never a colour" stays literally
true. Each resolves in one place for every renderer.

- **`fade`** is a continuous scalar the resolver blends toward the active theme's background before
  quantizing to the capability tier. It resolves at `color256` and `truecolor` only; `color16` and
  `monochrome` have no continuum to express it on and ignore it. It is `fgRole`-only: a background is
  never faded. RULE — `tests/roles.test.ts`, `tests/view.test.ts`. Its scope is deliberately narrow, a
  recorded departure from the "decay is not fade-out" craft rule in [`effects.md`](effects.md): no
  effect recipe sets `fade` except `fx.damage.flash` (RULE — `tests/effects.test.ts`). The Build Phase
  panel's own text also uses it for the card reveal, which is chrome rather than an effect's glyph.
- **`tint`** pulls the cell's `fgRole` part of the way (`amount` 0 to 1) toward another role. `truecolor`
  interpolates the two roles' colours; `color256` interpolates, then takes the nearest palette colour;
  `color16` has no continuum and steps onto the other role's own colour from 0.5 up; `monochrome`
  ignores it. It is applied before `fade`. RULE — `tests/build-placement.test.ts`. Its scope is a placed
  building's light in the Build Phase. The rainbow's six hue roles (`fx.hue.red` to `fx.hue.magenta`) are
  ordinary roles with a colour per theme.
- **`seeThrough`** is a see-through cursor over the cell: `{ role, alpha }`, "the cursor, drawn in
  `role`, at opacity `alpha`, over what this cell shows". RULE — `tests/see-through.test.ts`. The cell's
  fill becomes `alpha` of the role's colour and `1 − alpha` of what was there, which is itself 80% the
  cell's background and 20% its glyph's colour, the glyph being taken to cover about a fifth of the cell.
  The glyph stays, drawn `alpha` of the way toward the colour the real cursor draws glyphs in (the
  theme's background, the cursor being inverse video). The glyph's colour is its role after tint and
  fade; the background is the cell's `bgRole` or the theme's; an inverse cell is swapped first; a blank
  cell is just its background mixed toward the role. `truecolor` mixes exactly, `color256` takes the
  nearest palette entry, `color16` shows the plain cursor (inverse in the role's colour) from an alpha
  of one half and nothing below, `monochrome` the same step as inverse alone. Where it shows it replaces
  the cell's colours, inverse and dim; bold and underline stay. It is written by a glyphless write, so
  the glyph beneath always survives, and a later see-through write on a cell replaces an earlier one.
  One function resolves it (`seeThroughColours` in `src/view/roles.ts`), and every renderer reaches it
  through `resolveCell`, the one place a cell's style becomes what the ANSI writer, the browser canvas
  and OpenTUI draw. Its scope is the Explore Map hand-off's travelling cursor.

**One band write carries no glyph at all.** A style-only write keeps the glyph beneath it and applies
its attributes: the mechanism `fx.damage.flash` needs, and the only way an effect may touch a cell an
entity is standing on.

The cell frame is the terminal boundary and an excellent snapshot surface. It is **not** the universal
renderer API; a future graphical renderer consumes events and `PlayerView`, not cells.

## 2. Composition depends on the phase

The working list of interaction and drawing patterns every interactive screen follows (focus, back and
cancel, the mouse, menu row states, popups, panels) is [`ui-patterns.md`](ui-patterns.md); this document
holds the frame, composition and bands those patterns draw into.

The two phases need different amounts of screen, and pretending otherwise wastes the Grid.

**Both phases share the same frame**: a **top bar**, the **Grid pane** closed into its own rectangle (see
[`grid.md`](grid.md)), a **side panel** 30 columns wide counting the divider it shares with the Grid, and a **bottom bar** (RULE —
`tests/build-focus.test.ts`, `tests/build-view.test.ts`). The top bar and the bottom bar run the whole
width: at the 80-column floor the Grid pane is 49 columns, and the bottom bar's line is longer than that.
The top bar carries the game's title and where the player is (the phase today; the mission and the round
number once there are some), the bottom bar is **one line of contextual help**, and the side panel
carries actions and their status. Both phases support the cursor, selection, inspection and scrolling: a
player watching a Pulse can hover a unit to read its state in real time, and can scroll the Grid, exactly
as they can while building. One composition means one cursor, one scroll rule and one set of muscle
memory.

**The side panel is to the left of the Grid** (RULE — `tests/build-focus.test.ts`). Build menus read
first, and a player's eyes start on the left. The frame's lines are derived from where the panel is
rather than drawn around a fixed side (`drawChrome` in `src/view/build-frame.ts`), so the side is a
layout choice, not a redraw of every line.

What differs between the phases is what the side panel holds:

| | Side panel carries |
| --- | --- |
| **Build Phase** | what is left to spend on its credits line, then `[e] Explore Map` and `[n] Nexus` (see [`input.md`](input.md)), the buildings with each row's cost, and `[s] Start Pulse` on its last line — or, while Explore Map is open or a building is being placed, a card in the menu's place (below) |
| **Nexus Pulse** | round number, both Nexus states, force totals, playback controls, and — when something is selected — that entity's live state |

**A refused placement is answered on the status line, and names its tile** (RULE —
`tests/build-view.test.ts`, `tests/build-help.test.ts`). The panel carries no refusal of its own; the
low bar keeps all cursor status feedback. A refusal names its reason, and the tile when the reason is a
tile, so the player can fix it rather than guess. **Affordability is reported before any tile problem**
(RULE — `tests/build-phase.test.ts`): telling somebody a rock is in the way when they cannot afford the
building sends them to fix the wrong thing. **Looking and trying read differently**: while the armed
preview merely sits on a tile Enter would refuse, the status line says why in its ordinary tone and the
preview is a grey block of `x`; once the player actually tries (Enter, Space, or a confirming click) the
same sentence takes the refusal tone, red where colour exists and bold everywhere, which is the
acknowledgement that the attempt arrived. A refused placement also flashes the footprint briefly (a
tuned time), and moving off it ends the flash (RULE — `tests/build-motion.test.ts`).

**The bottom bar is one line, the contextual line** (RULE for what it is — `tests/build-help.test.ts`,
`tests/build-view.test.ts`; GUIDANCE for its words and tones). It is the one place any screen answers
"what just happened, or why not" and, when nothing did, "what can I do here". **It says the last
command's answer while that command said something** ("Barracks placed (resources: 60) - [u] undo",
"Cannot build here: rock in the way at 8,5."), **and otherwise a hint for where the keyboard is**: the
highlighted menu row's description and cost, how to place, how to leave Explore Map, what an open
popup's keys do. The hints come from **one list of situations in the code**, a line each (`HINTS` in
`src/build/help.ts`), so a new situation is one line in one place. **An answer lapses at the next
command that says nothing**, so the hint comes back on its own; a message about a tile also lapses the
moment the cursor leaves that tile. During a Nexus Pulse the line says what the Pulse is doing, unless a
popup over it holds the keyboard. There is no position readout and no key help on it: the map's sides
say there is more map (see [`grid.md`](grid.md)), and every key is on the Controls and hotkeys page (see
[`input.md`](input.md)).

A message on that line is a small typed value, not a string: its text, a **tone** (`neutral`,
`success`, `warning`, `danger`, and `hint`, which reads quieter than any answer), and optionally **the
tile it is about** (`src/build/status.ts`). A tone resolves onto existing style roles in exactly one place
(`src/view/status.ts`) and never names a colour itself, so monochrome gets the same message by weight
alone. An effect (a flash, a fade) is a later field on the same value, not a second mechanism.

**Hints are written the way the screen writes keys.** Named keys in brackets, as the menu rows and the
top bar show them (`[enter]`, `[esc]`, `[e]`); arrows, up/down and left/right as plain words, since they
are directions. Each fits the bottom bar at the 80-column floor, and a line wider than a narrower bar
loses whole words, never half of one. A hint names the situation in its own words rather than opening
with the mode's name in capitals. A test holds that a hint never names a key the keyboard adapter does
not bind (RULE — `tests/build-view.test.ts`, `tests/build-help.test.ts`).

**Planned buildings are drawn at full strength.** A planned structure uses the same glyphs, role and
weight as a standing one. What keeps a plan revisable is undo and remove, which work until the Nexus
Pulse starts, and the status line after a placement says so with what is left to spend and the way back
(`Hatchery placed (resources: 70) - [u] undo`; RULE — `tests/build-view.test.ts`).

**The Build Phase menu is one list.** `[e] Explore Map` is the panel's first line and `[n] Nexus` sits
straight under it, with the number of picks waiting and how many powers are active. Then the **credits
line**: blank on the left and, in the column the building costs are in, the map's own resource-deposit
symbol and what is left to spend (`* 130`, `◆ 130` in the Unicode pack), the symbol from the same table
the map draws deposits with, in the deposit's colour, the amount bold, with no label and no maximum. The
credits are on the menu alone (not on a card, the committed summary or a Nexus Pulse) and list movement
skips their line. Then **every building as one list** in catalog order, one row each, numbered in that
order, and `[s] Start Pulse` pinned to the panel's last line (RULE — `tests/build-menu.test.ts`). There
are no group headings and no Special row; headings come back if a real game shows a list too long to
read, and an empty group would then be drawn, not skipped, so no hotkey moves when content arrives. A
building row the panel has no room for is neither drawn nor a click target. **The panel carries no help
text**: what a row does is the bottom line's to say. The interface rules for the menu are in
[`ui-patterns.md`](ui-patterns.md).

**A card replaces the menu while something has the map's attention** (RULE for the replacement —
`tests/build-card.test.ts`; GUIDANCE for the look). **Explore Map** (the menu's first entry, and where
the screen opens) gives the Grid the keyboard with nothing armed, and the panel describes whatever is
under the cursor **as the cursor moves**, no key needed. **Placing a building** does the same for the
building being placed, which keeps anything that gains focus on the map visually consistent. Either way
the card's header is **the row that opened it, drawn active on the panel's first line** (`[e] Explore Map  >` or
`[1] Barracks  >`), a separator runs under it, and the card follows in four parts: a **title**
beside its icon (the thing's own glyphs); a **subtitle** under the title, one short line on what the
thing is for; a **description**, a few plain sentences wrapped between words and never cut mid-word; and
its **numbers** as label/value rows (cost where the menu sells it, health, size, attack where it has
one, or a bare tile's position). The same four parts describe a building being placed, a planned or
standing building, the Grid Nexus, and bare ground. A card carries no status line, and its words are
written with the content, not in the view. How it looks may later differ between placing a building,
exploring in the Build Phase and exploring during a Pulse; that stays a drawing choice over the same
card. Start Pulse hides with the rest of the menu.

**The header's own hotkey cancels**: `e` closes Explore Map and a building's digit cancels it, as `x`, Esc
or a click anywhere on the panel do, back to where the card was opened from (RULE —
`tests/build-card.test.ts`, `tests/build-holds-menu.test.ts`). **A building being placed holds the menu**:
until it is placed or cancelled, another building's digit, `e` and `s` are refused (the header flickers
and the bottom line names the way on), while popups that belong to no row choice (the Nexus powers, the
game menu, Controls, Settings) open over it and give it back, and never move the menu's highlight (RULE
— `tests/build-holds-menu.test.ts`). Explore Map holds nothing: a digit while exploring arms from the map.
Arming and opening Explore Map put nothing on the bottom line but its hint. Tab and a click on the map
arrive in plain navigation instead, the menu left beside the map, so the next click can arm from it. A
larger ASCII-art card waits for content that has one, and live numbers wait for the Nexus Pulse view.

**The card opens with a short transition.** Whenever the panel turns into a card (Explore Map opened, or
a building armed from the menu or by a digit on the map) it plays over the card reveal's length (400 ms,
a tuned value) in three beats: the other rows fade out (a quarter); the chosen row, drawn active, slides
a row at a time to the header line (under a third); the separator and the card fade in, its name,
subtitle and description typed and a building's icon playing its own placement frames (the rest). From
one card straight to another only the last beat plays. Closing is instant, reduced motion shows the card
at once, and a still frame is the finished card. It is presentation timed by the live loop, which watches
the state become a card (`cardRevealAt` in `src/view/build-live.ts`); the reducer never hears of it
(RULE — `tests/build-card.test.ts`).

**A menu row has two states** (RULE — `tests/build-menu.test.ts`): **highlighted**, the keyboard's
inverse bar, drawn only while the menu has focus; and **active**, while its action is under way (a
building armed, Explore Map open, the Nexus popup open, the Battle Round screen open). An active row
reads **`[1] Barracks  >`**: its own hotkey, which ends what it started (with Esc and `x`), and one `>`
in place of its value, pointing at the map; the whole row in the hotkey colour and bold, no underline,
no bar, legible in monochrome by the `>` and the bold. A pressed flash still wins, drawn as the bar,
except on the row a card reveal carries up from the menu, which is drawn active all the way. **A refused
flicker changes only the words**: they turn grey (the muted role, dim) and the row's background stays
exactly as it was, the highlight bar included, so it reads "nothing here" rather than a press. Every menu
row either opens a popup or gives the map something to do, and both kinds share the one look. One
function decides and draws it for every row, so a change of style reaches them all.

**Popups have one shape** (RULE for the shape as data — `tests/build-popups.test.ts`; GUIDANCE for its
look). Every popup (the Nexus powers, the start-the-Pulse question, the game menu, Settings, the export,
and a message) is a title and a list of rows, some of them options that name the command a click on them
sends, and **at most one run of rows that scrolls** (`src/build/popup.ts`). The frame draws a popup from
the same placed shape the mouse adapter hit-tests, so a click can never land on anything the frame drew
somewhere else, the guarantee `src/build/layout.ts` also gives the side panel (RULE —
`tests/build-popups.test.ts`: hit-testing reads the placement the frame draws). It is drawn to be
unmissable: centred over the Grid pane, bordered in a solid bar, the title in the top border, and a
one-cell shadow that blanks what is behind it. **No popup carries `[esc]`**: the top bar's right end
names what Esc does (`close [esc]` while a popup is open) and is its click target (RULE —
`tests/build-popups.test.ts`). While its scrolling rows overflow, **the right border beside them is a
scroll bar**: an up symbol, a track that is the plain border, a thumb showing the share in view in a
texture of its own (never the shadow's: `#` in ASCII, `╬` in Unicode), and a down symbol, in every glyph
pack; a click on its upper half scrolls up and on its lower half down, and the wheel and Up/Down walk the
highlight. **A message is the shape with nothing to choose**: a title and wrapped text, closed by Esc (or
`x`, or a right click) or a click outside, and by nothing else. A popup holds the keyboard and the mouse
until it closes, and nothing opens one but the player; a message appears only as the answer to something
the player just did. It sits on top of everything else without a drawing band of its own (see bands
below).

**There is no radius preview until something placed has a radius.** Nothing in the content that exists
has a radius, and a preview of nothing is a framework built before its first use.

**The Pulse view shows everything by default.** Selection is an addition the player reaches for, never a
prerequisite for following the fight. If a Pulse can only be understood by clicking things, the
presentation has failed and no panel will rescue it.

## 3. Tile width — RULE

**RULE** — `tests/build-camera.test.ts`, `tests/view.test.ts`.

Tile width is adaptive presentation. One Grid tile occupies **one terminal column** at 80 columns and
**two** at 128 or wider. Same tiles, same actors, same revealed information; only the composition
changes. **80 × 24 is the acceptance target**: anything authored for the wide composition must degrade
to the narrow one.

One honest consequence: at one column per tile the Grid is squashed 2:1 horizontally, because a terminal
cell is about twice as tall as it is wide. A radius that is square in tiles looks like a wide rectangle.
Range previews and area effects must be authored in tiles and must be checked at both widths.

Effects are authored against **tile coordinates**, never column counts, so one effect written once works
at both widths.

## 4. Bands — RULE

**RULE** — `src/view/effects/composite.ts`, `tests/effects.test.ts`.

Fixed bands, not free z-indexes. The layers in [`grid.md`](grid.md) map onto them directly, which is the
point:

| Band | Fed by |
| --- | --- |
| 1 `terrain` | `terrain` layer |
| 2 `territory` | construction coverage: the build range while a building is armed; the raid's trail in the Build Phase |
| 3 `ground-items` | salvage, rubble, deposits |
| 4 `structures` | `obstacles` layer |
| 5 `units` | `workers` and `units` layers |
| 6 `air` | `air` layer |
| 7 `projectiles` | presentation only |
| 8 `effects` | presentation only |
| 9 `highlights` | selection, cursor, preview, range: a building's reach |
| 10 `chrome` | frame, sidebar, status strip, popups |

Each band returns sparse cells; the topmost defined cell replaces the lower complete cell style. Grid
bands clip to the Grid. **Presentation overlap never changes occupancy.**

**A popup has no band of its own.** It is drawn last in the `chrome` band: within one band a later write
replaces an earlier one, so a popup drawn after the frame, the side panel and the bottom bar sits on top
of all of them, and over the Grid bands beneath. The bands stay the fixed list above; an eleventh band
for overlays would be the free z-index this design refuses.

**The corruption law** (RULE — `src/view/effects/composite.ts`, `tests/effects.test.ts`,
`tests/build-placement.test.ts`). Effects that deliberately degrade the display (Glitch identity, Nexus
authority, Commander restoration, catastrophic destruction) live in `effects` or above, never in
`units` or `structures`. They may add, overdraw and unsettle. They may never remove or replace the only
cell carrying a required semantic cue. The screen may look wrong; the player must still be able to see
what is attacking them.

**The compositor enforces it; recipes are not asked to remember** (RULE —
`paintEffectCells` in `src/view/effects/composite.ts`, `tests/build-placement.test.ts`). An effect cell
that would replace an entity's own glyph is dropped on that tile, and the only write allowed onto an
occupied cell is a glyphless attribute change. The first frame ever composed with effects put a clash
mark on the defender's own cell, removing the only thing saying the defender was there, and a test
caught it immediately. A structural guarantee is worth more here than eleven recipes each remembering a
rule.

## 5. Effects and particles

Effects subscribe to semantic cues and cannot apply damage, move actors, spend resources, or decide
victory (RULE — `tests/effects.test.ts`: turning effects off changes only the picture). They sample
**absolute presentation time**, so the frame at time *t* is identical whether every earlier frame
rendered or most were skipped. Cosmetic randomness never touches the gameplay stream; it is a hash of an
effect instance's identity, never a stream (RULE — `tests/effects.test.ts`: the same instance always
scatters the same way, and the cosmetic seed cannot reach the kernel).

The particle system, its contract, its starter vocabulary, and the craft rules that make ASCII motion
read as weight are specified in [`effects.md`](effects.md).

**Placement juice.** A structure may carry **placement frames**: a short list of footprint-sized frames
played before its finished art as it is placed (a space is empty ground). Only the Build Phase view
reads them; a structure without them gets a generic run derived from its finished art, so no content
waits on an artist. It is presentation only: the live loop times each placement from the first frame
that drew it, the view draws a pure function of the plan and the time since placement, and a placement
that leaves the plan stops at once. **A placement is one *play* of its frames on that building's
animation track, and the light (`fx.light.flash`, shading, which uses `tint`) and the sparks
(`fx.sparks.burst`, particles) are that play's follow-ups, scheduled when its last frame ends** (RULE —
`tests/build-placement.test.ts`). Reduced motion shows it finished at once. Every duration and intensity
is an Experiment. The four families of presentation (animations, particles, shading and tweens) and the
animation track are defined in [`effects.md`](effects.md).

## 6. Accessibility — RULE

- Keyboard-complete; mouse is optional direct manipulation (RULE — `tests/build-start.test.ts`: every
  menu entry is reached by Down and done by Enter alone).
- Every gameplay glyph occupies exactly one cell. No emoji, combining mark, or ambiguous-width glyph is
  ever required (RULE — `tests/view.test.ts`, `tests/build-view.test.ts`).
- ASCII-safe is the baseline; Unicode packs map the same semantic roles separately.
- Monochrome, 16-colour, 256-colour, and truecolor are explicit modes.
- **Colour never carries ownership, target, danger, or health alone** (RULE — `tests/view.test.ts`:
  monochrome renders every scenario and no cell depends on colour to exist).
- Reduced motion keeps anticipation, impact, and settled state; it removes decorative movement only
  (RULE — `tests/effects.test.ts`).
- Structured snapshots include glyph, foreground and background roles, and attributes
  (`src/view/snapshot.ts`).
- Below minimum size, playback pauses behind the resize gate (the terminal-too-small screen) and resumes
  from the same presentation time; nothing is cropped (RULE — `tests/playback.test.ts`,
  `tests/view.test.ts`).

The simulation knows semantic ids such as `unit.worker` and `structure.nexus`. **It never knows a
glyph** (RULE — `tests/architecture.test.ts`).
