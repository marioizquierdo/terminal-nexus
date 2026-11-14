# Terminal Nexus — presentation

_How state becomes what is on screen: the cell frame, composition by phase, the tile, bands, the effects hook-up and accessibility._

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
carries **roles** — `fgRole: "faction.citizen"`, never `"#ff8800"` — and the colour depth resolves
roles to colour, which is what makes monochrome a setting rather than a rewrite. The compositor emits
only roles from the committed vocabulary.

**The presentation baseline is monochrome seven-bit ASCII, enhanced by explicit ANSI colour and optional
Unicode** (RULE — `tests/view.test.ts`, `tests/effects.test.ts`). ASCII is the baseline and the
acceptance target; colour and Unicode packs add to it and are never required to read a screen.

**Colour depths are three, and they buy fidelity rather than facts**: monochrome, 256 colours and
truecolor, resolving one role table. The setting is `colors` (`--colors`, Settings > Colours; the player
sees none, 256 and millions); it was called `capability` until it was named for what it is, a choice of how
much colour to draw with and not a fact the game detects. Every depth puts identical glyphs on screen, so
nothing a player needs is available only to a colour terminal (RULE — `tests/view.test.ts`,
`tests/build-view.test.ts`, `tests/effects.test.ts`: each asserts the same glyphs at every depth).
Monochrome is the floor: the game is whole, testable and playable in it. It is not the look the game is
designed for. A Battle Round is a field battle read at a glance, and that read is told in colour, contrast,
layers and transparency, which monochrome stands in for with a glyph, a weight or inverse video. The
experience is the colour one.

**The game owns its background: with colours, every cell is two colours, the glyph's and its fill** (RULE —
`tests/background.test.ts`, `tests/roles.test.ts`, `tests/see-through.test.ts`). The fill is the cell's
`bgRole` or the theme's background (`BACKGROUND_RGB`: a near-black for `dark`, a warm paper white for
`light`). Nothing is left to the player's terminal theme, so Solarized, a purple terminal and a black one
show the same game, Background (`--theme`) is a choice of look rather than a match for the terminal, and a
fade or a see-through mix blends toward a colour that is really there. `resolveCell` (`src/view/roles.ts`)
is the whole of it, for the ANSI writer, the canvas and OpenTUI alike, in one order: the cell's exact
colours (roles with tint and fade, plain text when a cell has no role, swapped by inverse video, the glyph
mixed `1 - DIM_ALPHA` toward its fill when dim, a see-through style over all of it), then one last pass that
turns each into the depth (`shownAt`: truecolor as it is, 256 colours the nearest entry). No depth has code
of its own, an RGB renderer shows exactly what a 256-colour terminal shows, and the terminal's own "default
colour", "faint" and "reverse video", which differ from one terminal to the next, are never sent with
colours. The ANSI writer also grows a frame smaller than the screen (the title menu is one 80 × 24 frame)
with blank background (`padFrame`) and starts the screen over when the depth changes. Monochrome alone
leaves the terminal's colours as they are, so a theme means nothing there.

**There is no sixteen-colour depth** (RULE — `tests/roles.test.ts`). The sixteen ANSI colours are whatever
the player's terminal theme says they are (Solarized's yellow is not xterm's), so the game can neither
know how a code looks nor blend toward it, and its backgrounds, fades and see-through mixes need real RGB;
a sixteen-colour tier would be a second palette to author and playtest, with eleven colours at most doing
the work of twenty-six roles. The palette is one table of RGB per theme. Truecolor draws it exactly; 256
colours is derived from it by the nearest match in Lab (how different two colours look, not how far apart
their channels are) over indices 16 to 255, so no colour the game draws is one of the terminal's sixteen. A
terminal that advertises no more than that gets monochrome, which sends no colour code and leaves its own
colours alone; the player picks the colours in Settings if the guess was low. Truecolor is the one look to
playtest, 256 colours and monochrome are looked at now and then, and nothing else needs checking.

**The palette has a quality bar, held by a test, so a colour added later meets what the ones before did**
(RULE — `tests/palette.test.ts`). In both themes every role to be read clears 3:1 against the background
(the quiet marks, a dot of floor, the map's edge and a bullet's trail, are exempt); the muted, label and
frame colours stay readable after a dim; 256 colours shows every role within a Delta E of 12 of millions,
and a colour with a hue keeps it; and the two sides are two colours that each read as their own, 40 Delta E
apart at every depth and for a colour-blind player (simulated protanopia and deuteranopia). A role placed
by eye in millions is nudged a few points toward the xterm cube only if the test says its 256 match
drifted.

**A glyph pack is optional, and it changes the field and the frame, never the actors** (RULE —
`tests/effects.test.ts`). Units stay letters in every pack, because letter case carries ownership and
the glyph family carries faction; prettier symbols do not improve that, and they would break the one
system that survives monochrome. A pack may only draw from a curated single-width set.

**Faction visual identity lives in the glyph family and the effect language; ownership keeps the
colour** (RULE — `tests/content.test.ts`, which holds that art is authored lower case so ownership can
flip its case, and `tests/effects.test.ts`). A mirror match stays legible, and monochrome stays whole.

**The style attributes beyond roles** are each a role and a number, so "never a colour" stays literally
true. Each resolves in one place for every renderer.

- **`fade`** is a continuous scalar the resolver blends toward the active theme's ground before quantizing
  to the colour depth. It resolves at `color256` and `truecolor` only; `monochrome` has no continuum to
  express it on and ignores it. It is `fgRole`-only: a background is never faded. RULE —
  `tests/roles.test.ts`, `tests/view.test.ts`. Its scope is deliberately narrow, a recorded departure from the
  "decay is not fade-out" craft rule in [`effects.md`](effects.md): no effect recipe sets `fade` except
  `fx.damage.flash` (RULE — `tests/effects.test.ts`). Two interface marks use it too, neither an effect's
  glyph: the card reveal fades the Build Phase panel's own text, and the raid's intent trail is drawn faded,
  the copy each moving arrow leaves behind fading further until it is gone (in monochrome,
  which ignores `fade`, that copy is the arrow's own dim look until it goes).
- **`tint`** pulls the cell's `fgRole` part of the way (`amount` 0 to 1) toward another role. `truecolor`
  interpolates the two roles' colours; `color256` interpolates, then takes the nearest palette colour;
  `monochrome` ignores it. It is applied before `fade`. RULE — `tests/build-placement.test.ts`. Its scope is a placed
  building's light in the Build Phase. The rainbow's six hue roles (`fx.hue.red` to `fx.hue.magenta`) are
  ordinary roles with a colour per theme.
- **`seeThrough`** is a see-through style over the cell: `{ role, alpha }`, mixed as the owner defined it
  (*See-through styles* in [`ui-patterns.md`](ui-patterns.md): the fill becomes `alpha` of the role's colour and
  `1 − alpha` of what was there, the glyph taken as a fifth of the cell). RULE — `tests/see-through.test.ts`. The glyph's
  colour is its role after tint and fade; the background is the cell's `bgRole` or the theme's; an inverse cell is
  swapped first. `truecolor` mixes exactly, `color256` takes the nearest palette entry, `monochrome` shows the plain
  cursor as inverse alone from an alpha of one half and nothing below. Where it shows it replaces the cell's colours,
  inverse and dim; bold and underline stay. It is written by a glyphless write, so the glyph beneath always survives,
  and a later see-through write on a cell replaces an earlier one. One function resolves it (`seeThroughColours` in
  `src/view/roles.ts`), reached through `resolveCell`, the one place a cell's style becomes what the ANSI writer, the
  browser canvas and OpenTUI draw. Its scope is the Explore Map hand-off's travelling cursor and Vasse's aura.

**One band write carries no glyph at all.** A style-only write keeps the glyph beneath it and applies
its attributes: the mechanism `fx.damage.flash` needs, and the only way an effect may touch a cell an
entity is standing on.

The cell frame is the terminal boundary and an excellent snapshot surface. It is **not** the universal
renderer API; a future graphical renderer consumes events and `PlayerView`, not cells.

## 2. Composition depends on the phase

How an interactive screen behaves (focus, back and cancel, the mouse, menu row states, cards, popups, the bottom
line, ranges and the aura on the map) is [`ui-patterns.md`](ui-patterns.md), pattern by pattern; this document
holds the frame, composition and bands those patterns draw into.

The two phases need different amounts of screen, and pretending otherwise wastes the Grid.

**Both phases share the same frame**: a **top bar**, the **Grid pane** closed into its own rectangle (see
[`grid.md`](grid.md)), a **side panel** 30 columns wide counting the divider it shares with the Grid, and a **bottom bar** (RULE —
`tests/build-focus.test.ts`, `tests/build-view.test.ts`). The top bar and the bottom bar run the whole
width: at the 80-column floor the Grid pane is 49 columns, and the bottom bar's line is longer than that.
The top bar carries the game's title and where the player is (the phase today; the mission and the round
number once there are some), the bottom bar is **one line of contextual help**, and the side panel
carries actions and their status. Both phases support the cursor, selection, inspection and scrolling: a
player watching a Battle Round can hover a unit to read its state in real time, and can scroll the Grid, exactly
as they can while building. One composition means one cursor, one scroll rule and one set of muscle
memory.

**The side panel is to the left of the Grid** (RULE — `tests/build-focus.test.ts`). Build menus read
first, and a player's eyes start on the left. The frame's lines are derived from where the panel is
rather than drawn around a fixed side (`drawChrome` in `src/view/build-frame.ts`), so the side is a
layout choice, not a redraw of every line.

What differs between the phases is what the side panel holds:

| | Side panel carries |
| --- | --- |
| **Build Phase** | what is left to spend on its credits line, then `[e] Explore Map` and `[n] Nexus Pulse` (see [`input.md`](input.md)), the buildings with each row's cost, and `[s] Start Battle Round` on its last line — or, while Explore Map is open or a building is being placed, a card in the menu's place (*Cards* in [`ui-patterns.md`](ui-patterns.md)) |
| **Battle Round** | round number, both Nexus states, force totals, playback controls, and — when something is selected — that entity's live state |

**Drawing and hit-testing read one placed geometry** (RULE — `tests/build-menu.test.ts`, `tests/build-popups.test.ts`):
the side panel's rows come from `buildLayout` (`src/build/layout.ts`) and a popup from the placed shape in
`src/build/popup.ts`, the same ones the mouse adapter hit-tests, so a click can never land on anything the frame drew
somewhere else.

**The bottom bar is one line** and answers, in one place, "what just happened, or why not" and, when nothing did,
"what can I do here"; a refusal names its tile, affordability first (RULE for what it is — `tests/build-help.test.ts`,
`tests/build-view.test.ts`). Its messages are typed values (text, a **tone**, optionally the tile): a tone resolves onto
existing style roles in exactly one place (`src/view/status.ts`) and never names a colour, so monochrome gets the same
message by weight alone. The rules for the line, the hints and the tones are *The bottom line* in
[`ui-patterns.md`](ui-patterns.md).

**The Build Phase menu, a card, a menu row's two states, a popup and a reach are drawn by the rules in
[`ui-patterns.md`](ui-patterns.md)** (*The Build Phase menu*, *Cards*, *Menu rows*, *Popups*, *The build range and a
reach*, *Her aura's reach*). Two things of the frame's own: a popup and the card's reveal are chrome, drawn last in the
`chrome` band (below); and a reach is the rules' own tiles (*A tile is one column*).

**Burning ground is drawn on its own ground, under what stands on it** (RULE — `tests/burning-ground.test.ts`). A
patch a mortar's shell sets alight (`MatchState.burning`) is every tile within its radius of its centre by the Grid's
own test (`tilesWithin`, which is the kernel's `withinArea`), so the patch drawn and the patch that burns cannot
disagree, and it is drawn in the state of the tick shown, from the tick it was lit to its last. It has four roles of its own, red and
yellow (the owner, 2026-10-21: "that red seems too intense ... red and yellow, more transparent and use flashing
effect instead of constant color"): **`fx.fire.ground`**, the faint scorch every burning tile takes where colours are
drawn — the ground's own colour barely warmed, a fill only, chosen so both sides' letters and the flames clear 3:1 on
it; **`fx.fire`**, a low flame's red; **`fx.fire.tall`**, a tall flame's yellow; and **`fx.fire.glow`**, the red fill
a tile flashes under a tall flame. At any instant most of a patch shows the ground itself on the scorch; on open
ground about a quarter of its tiles show a low flame `~` in red on the scorch and about one in six flashes a tall
flame `^` (the Unicode pack's `▴`), bold yellow on the glow — glyphs nothing else on a Battle Round's Grid uses; rock
and deposits keep their glyphs. **Under a unit, a building, a corpse still drawn or salvage** the scorch alone is
laid, a glyphless write that keeps its glyph and every colour of its own, so a unit standing in the fire is seen
standing in it. Effects draw over it. **It flickers by cosmetic randomness only**: each tile rolls its look again once
a beat (170 ms), its beats offset from its neighbours' by a hash, the look a hash of the cosmetic seed, the patch's
identity (when it was lit, by whom, where), the tile and the beat — a pure function of presentation time (`fireAt`,
`src/view/burning.ts`) — so the patch reads as fire alive on the ground rather than a red carpet over it, and over a
second nearly every tile has flared. **It dies down in its last second**: low flames only, dim, one tile in five, so
the end reads before it comes; the scorch holds to the end, since the ground still hurts. Ground still burning when
the fight ends is put out once everything in flight has landed, as the regroup puts it out in the rules. **Reduced
motion** holds each tile's look still (the dying down stays: it is the patch's state, not decoration). **In
monochrome** no fill is drawn and the flames carry the patch alone, by their glyphs: under half its tiles at any
instant, flaring in turn across it, so its shape is drawn over a second. Both Pulse views draw it from one list worked out with the rest of a
presentation instant (`PulseSample.fire`): the engine tool's and the Build Phase screen's, the live Battle Round and
the replay of the last round alike, and with them the browser page.

**The Battle Round's view shows everything by default.** Selection is an addition the player reaches for, never a
prerequisite for following the fight. If a battle can only be understood by clicking things, the
presentation has failed and no panel will rescue it.

## 3. A tile is one column — RULE

**RULE** — `tests/rows-view.test.ts`, `tests/build-camera.test.ts`, `tests/view.test.ts`.

**One Grid tile is one terminal cell, one column wide, at every terminal size**: the Build Phase, the Battle Round,
the engine tool's own view and the browser page alike. A cell is about twice as tall as it is wide, and the rules
count a row as two columns in every distance ([`grid.md`](grid.md), distance, reach and movement), so a reach is
twice as wide as it is tall in tiles and, drawn a column a tile, as wide as it is tall on screen; a unit walking
down the screen crosses it at the pace of one walking across. A larger terminal never widens a tile: past the
largest view it buys centring, never another shape. At 80 × 24 the map shows 49 × 18 tiles, and **80 × 24 is the
acceptance target**; a larger terminal shows more of the same Grid, up to 72 × 24 tiles, and the same information.

**A picture of an area the rules decide draws the rules' own tiles**: a building's or a unit's reach, the build
range, Vasse's aura, a blast and burning ground are each drawn from the Grid's own sets of tiles (`tilesWithin`,
`src/grid/reach.ts`; a reach's outline, the last tiles it covers, is `outlineWithin`, `src/view/reach-outline.ts`), so what the screen shows
as a reach is what the rules count. A picture that claims no area — death debris and its shockwave, the tracer's
line, the intro highlight's ring — may take a shape of its own.

**What reads a slope off the map weighs a row as two columns** (`inColumns`, `src/grid/coords.ts`): the raid
panel's compass point, the focus arrow, and the raid trail's arrows, each the glyph nearest its way on screen and
looking a whole stair on (two across, one down) along the way, so a way down the screen's diagonal is one steady
stroke. Arming looks for the nearest free spot with a row costing the tuned `armVerticalCost`, a cost of the
cursor's rather than a distance.

Effects are authored in **tile coordinates**, never column counts: a tile is one cell, and the compositor places
it through the camera.

## 4. Bands — RULE

**RULE** — `src/view/effects/composite.ts`, `tests/effects.test.ts`.

Fixed bands, not free z-indexes. The layers in [`grid.md`](grid.md) map onto them directly, which is the
point:

| Band | Fed by |
| --- | --- |
| 1 `terrain` | `terrain` layer |
| 2 `territory` | construction coverage: the build range while a building is armed; the raid's trail in the Build Phase; a Commander's aura's reach and burning ground during a Battle Round |
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
waits on an artist. The live loop times each placement from the first frame that drew it, the view draws a
pure function of the plan and the time since placement, and a placement that leaves the plan stops at once.
**A placement is one *play* of its frames on that building's animation track, and the light (`fx.light.flash`,
shading, which uses `tint`) and the sparks (`fx.sparks.burst`, particles) are that play's follow-ups, scheduled
when its last frame ends** (RULE — `tests/build-placement.test.ts`). Reduced motion shows it finished at once;
every duration and intensity is an Experiment. The families and the animation track are in
[`effects.md`](effects.md).

## 6. Accessibility — RULE

- Keyboard-complete; mouse is optional direct manipulation (RULE — `tests/build-start.test.ts`: every
  menu entry is reached by Down and done by Enter alone).
- Every gameplay glyph occupies exactly one cell. No emoji, combining mark, or ambiguous-width glyph is
  ever required (RULE — `tests/view.test.ts`, `tests/build-view.test.ts`).
- ASCII-safe is the baseline; Unicode packs map the same semantic roles separately.
- Monochrome, 256-colour, and truecolor are explicit modes; there is no 16-colour mode.
- **Colour never carries ownership, target, danger, or health alone** (RULE — `tests/view.test.ts`:
  monochrome renders every sandbox and no cell depends on colour to exist).
- Reduced motion keeps anticipation, impact, and settled state; it removes decorative movement only
  (RULE — `tests/effects.test.ts`).
- Structured snapshots include glyph, foreground and background roles, and attributes
  (`src/view/snapshot.ts`).
- Below minimum size, playback pauses behind the resize gate (the terminal-too-small screen) and resumes
  from the same presentation time; nothing is cropped (RULE — `tests/playback.test.ts`,
  `tests/view.test.ts`).

The simulation knows semantic ids such as `unit.worker` and `structure.nexus`. **It never knows a
glyph** (RULE — `tests/architecture.test.ts`).
