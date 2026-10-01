# Terminal Nexus — presentation

_The cell frame, composition by phase, tile width, bands, effects and accessibility: how state becomes what is on screen. Split from the engine design; every unmarked statement is GUIDANCE._

## 9. Presentation

**Authority: RULE** for the cell boundary, bands, and the accessibility rules; **GUIDANCE** for
composition details.

The working list of interaction and drawing patterns every interactive screen follows — focus, back
and cancel, the mouse, menu row states, popups, panels — is
[`docs/system-design/ui-patterns.md`](ui-patterns.md); it is not canon until the owner accepts it and it
is promoted here.

### 9.1 The cell frame — RULE

```ts
type CellStyle = Readonly<{
  fgRole?: string          // a role, never a colour
  bgRole?: string
  bold?: boolean
  dim?: boolean
  underline?: boolean
  inverse?: boolean
  fade?: number            // 0-1, fgRole only: 0 the role's own colour, 1 the theme's background
  tint?: { role: string; amount: number } // 0-1, fgRole pulled toward another role (canon 2.24)
  seeThrough?: { role: string; alpha: number } // 0-1, a see-through cursor over the cell (canon 2.28)
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

No backend object ever appears inside a frame. Style carries **roles** —
`fgRole: "faction.citizen"`, never `"#ff8800"` — and the capability mode resolves roles to colour,
which is what makes monochrome a setting rather than a rewrite.

**`fade` — added at canon 2.8 (Q25, `open-questions.md`).** A continuous scalar the resolver blends
toward the active theme's background before quantizing to the capability tier; the cell still carries
only a role and a number, so "never a colour" stays literally true. It resolves at `color256` and
`truecolor` only — `color16` and `monochrome` have no continuum to express it on and ignore it
entirely, unchanged from before this field existed. It is `fgRole`-only: a background is never faded.
Scope is deliberately narrow, not a general fade-out licence for effects — `ascii-effects.md` craft
rule 7 still holds everywhere except the one recorded departure it names.

**`tint` — added at canon 2.24 (gate 5I).** `tint?: { role, amount }` pulls the cell's `fgRole` part
of the way (`amount` 0–1) toward another role; the cell still carries only roles and a number.
`truecolor` interpolates the two roles' colours; `color256` interpolates, then takes the nearest
palette colour; `color16` has no continuum and steps onto the other role's own colour from 0.5 up;
`monochrome` ignores it. It is applied before `fade`. Scope: a placed building's light in the Build
Phase. The rainbow's six hue roles (`fx.hue.red` … `fx.hue.magenta`) are ordinary roles with a colour
per theme.

**`seeThrough` — added at canon 2.28 (the menu spike's round 2, feedback F64-F65).** A see-through
cursor over the cell: `{ role, alpha }`, a role and a number from 0 to 1, never a colour — "the cursor,
drawn in `role`, at opacity `alpha`, over what this cell shows". The cell's fill becomes `alpha` of the
role's colour and `1 − alpha` of what was there, which is itself 80% the cell's background and 20% its
glyph's colour, the glyph being taken to cover about a fifth of the cell (the owner's definition). The
glyph stays, drawn `alpha` of the way toward the colour the real cursor draws glyphs in (the theme's
background, the cursor being inverse video). The glyph's colour is its role after tint and fade; the
background is the cell's `bgRole` or the theme's; an inverse cell is swapped first; a blank cell is just
its background mixed toward the role. `truecolor` mixes exactly, `color256` takes the nearest palette
entry, `color16` shows the plain cursor (inverse in the role's colour) from an alpha of one half and
nothing below, `monochrome` the same step as inverse alone. Where it shows it replaces the cell's
colours, inverse and dim; bold and underline stay. It is written by a glyphless write, so the glyph
beneath always survives, and a later see-through write on a cell replaces an earlier one. One function resolves it
(`seeThroughColours` in `src/view/roles.ts`), and every renderer reaches it through `resolveCell` — the
one place a cell's style becomes what the ANSI writer, the browser page's canvas and OpenTUI draw: its
colours, its inverse video, its dim and its see-through style. Scope: the Explore Map hand-off's
travelling cursor. **`fade` is also used on the Build Phase panel's own text** for the card reveal
(below), chrome rather than an effect's glyph.

This is the terminal boundary and an excellent snapshot surface. It is **not** the universal renderer
API; a future graphical renderer consumes events and `PlayerView`, not cells.

**Capability modes are four, and they buy fidelity rather than facts** (Milestone 1): monochrome,
16-colour, 256-colour, and truecolor, resolving one role table. Every tier puts identical glyphs on
screen — a test asserts it — so nothing a player needs is available only to a colour terminal.
Monochrome is the floor, not the degraded mode.

**A glyph pack is optional, and it changes the field and the frame, never the actors.** Units stay
letters in every pack, because letter case carries ownership and the glyph family carries faction;
prettier symbols do not improve that, and they would break the one system that survives monochrome.
ASCII is the baseline and the acceptance target, and a pack may only draw from a curated
single-width set.

**One band write carries no glyph at all.** A style-only write keeps the glyph beneath it and applies
its attributes — the mechanism `fx.damage.flash` needs, and the only way an effect may touch a cell
an entity is standing on.

### 9.2 Composition depends on the phase — GUIDANCE

The two phases need different amounts of screen, and pretending otherwise wastes the Grid:

**Both phases share the same frame**: a **top bar**, the **Grid pane** closed into its own rectangle
(3.3), a 30-column **side panel**, and a **bottom bar**. The top bar and the bottom bar run the whole
width: at the 80-column floor the Grid pane is 49 columns, and the bottom bar's line is longer than
that. What each part is for is the owner's own description (2026-09-26): the top bar carries the
game's title and where the player is (the phase today; the mission and Pulse number once there are
some), the bottom bar is **one line of contextual help** (canon 2.27, below), and the side panel carries
actions and their status. Both phases support the cursor,
selection, inspection, and scrolling — a player watching a Pulse can hover a unit to read its state
in real time, and can scroll the Grid, exactly as they can while building. Keeping one composition
means one cursor, one scroll rule, and one set of muscle memory.

**The side panel moves to the left of the Grid — GUIDANCE, gate 5F.** Gates 5A-5E drew it on the
right. The owner, after playing it: "The build menu should definitely be on the left. I can think of
build games like sim-city. My eyes were on the left and I didn't notice that I needed to select the
things to build on the right... since build goes first, it seems better to keep the GUI on the left."
The frame's lines are derived from where the panel is rather than drawn around a fixed side
(`src/view/build-frame.ts`'s `drawChrome`), so the move is a layout change, not a redraw of every line.

What differs between the phases is what the side panel holds:

| | Side panel carries |
| --- | --- |
| **Build Phase** | what is left to spend on its top line, then `[e] Explore Map` and `[n] Nexus` (9.7), the buildings with each row's cost, and `[s] Start Pulse` on its last line — or, while Explore Map is open or a building is being placed, a card in the menu's place (below) |
| **Nexus Pulse** | Pulse number, both Nexus states, force totals, playback controls, and — when something is selected — that entity's live state |

**A refused placement is answered on the status line, and names its tile — RULE.** Built at gate 5B
as a block on the panel, and moved at canon 2.19 on the owner's own direction: "it would make more
sense to show that feedback on the low bar where it says 'Barracks selected', so we keep that low bar
for cursor status feedback... just doesn't need to be uppercase." A refusal names its reason, and the
tile when the reason is a tile, so the player can fix it rather than guess. **Affordability is
reported before any tile problem**: telling somebody a rock is in the way when they cannot afford the
building sends them to fix the wrong thing. **Looking and trying read differently**: while the armed
preview merely sits on a tile Enter would refuse, the status line says why in its ordinary tone and
the preview is a grey block of `x` (the owner found an all-red ghost "a bit too intense"); once the
player actually tries — Enter, Space, or a confirming click — the same sentence takes the refusal
tone, red where colour exists and bold everywhere, which is the acknowledgement that the attempt
arrived. A brief cursor flash on that attempt, the owner's other suggestion, needs a frame timer and
lands with gate 5H. The panel carries no refusal of its own any more.

**The bottom bar is one line, the contextual line — RULE for what it is, GUIDANCE for its words and
tones, canon 2.27** (owner, 2026-09-30, feedback F59: "The only thing that is useful is having a single
row that offers contextual help ... with an easy-to-use interface to show help as needed"). It is the
one place any screen answers "what just happened, or why not" — and, when nothing did, "what can I do
here". **It says the last command's answer while that command said something** ("Barracks placed
(resources: 60) - [u] undo", "Cannot build here: rock in the way at 8,5."), **and otherwise a hint for
where the keyboard is**: the highlighted menu row's description and cost, how to place, how to leave
Explore Map, what an open popup's keys do — from **one list of situations in the code**, a line each
(`HINTS` in `src/build/help.ts`), so a new situation is one line in one place. **An answer lapses at the
next command that says nothing**, so the hint comes back on its own; a message about a tile also lapses
the moment the cursor leaves that tile. During a Nexus Pulse the line says what the Pulse is doing,
unless a popup over it holds the keyboard. The position readout and the key help that shared the bottom
bar with it until canon 2.27 are gone: the map's sides say there is more map (3.3), and every key is on
the Controls and hotkeys page (9.7).

A message on that line is a small typed value, not a string: its text, a **tone** (`neutral`,
`success`, `warning`, `danger`, and `hint`, which reads quieter than any answer), and optionally **the
tile it is about** (`src/status.ts`). A tone resolves onto existing style
roles in exactly one place (`src/view/status.ts`) and never names a colour itself, so monochrome gets
the same message by weight alone. The owner asked for exactly this ("the game code should be able to
easily change the status text with options for highlight, bold, color, etc, and later maybe also
effects, that should be enums"); an effect — a flash, a fade — is a later field on the same value, not
a second mechanism.

**Hints are written the way the screen writes keys — GUIDANCE, canon 2.27.** Named keys in brackets,
as the menu rows and the top bar show them (`[enter]`, `[esc]`, `[e]`); arrows, up/down and
left/right as plain words, since they are directions. Each fits the bottom bar at the 80-column floor,
and a line wider than a narrower bar loses whole words, never half of one. The trimmed key help this
replaced (owner, 2026-09-26: "just say arrows move, shift+arrow fast move, leave pgup/home keys out")
opened with the mode's name in capitals; a hint names the situation in its own words instead.

**Planned buildings are drawn at full strength — GUIDANCE, canon 2.21** (owner, 2026-09-27: "Not
sure why they are greyed out; it will look better if they are fully built"). A planned structure uses
the same glyphs, role and weight as a standing one. What keeps a plan revisable was never the grey:
it is undo and remove, which work until the Nexus Pulse starts, and the status line after a placement
says so — `Hatchery placed (resources: 70) - [u] undo`, what is left to spend and the way back.

**The Build Phase menu is one list — GUIDANCE, canon 2.27, reordered at 2.28** (owner, 2026-09-30,
feedback F56-F58: "I want consistency and simplicity"; then F71-F72). `[e] Explore Map` is the panel's
first line and `[n] Nexus` sits straight under it, with the number of picks waiting and how many powers
are active ("Do not leave a space between Explore and Nexus items"). Then the **credits line**: blank on
the left and, in the column the building costs are in, the map's own resource-deposit symbol and what
is left to spend — `* 130`, `◆ 130` in the Unicode pack — the symbol from the same table the map draws
deposits with, in the deposit's colour, the amount bold, with no label and no maximum ("on the empty
line right before the build/construction list ... the same as the symbol used on the map to represent
resources"); a maximum can be shown when the player reaches it, later. The credits are on the menu
alone — not on a card, the committed summary or a Nexus Pulse — and list movement skips their line.
Then **every building as one list** in catalog order, one row each, numbered in that order, and
`[s] Start Pulse` pinned to the panel's last line. **No group headings and no Special row** ("Remove the categories for now. We
don't know how many items will be on a real game"): headings come back if a real game shows a list too
long to read. A building row the panel has no room for is neither drawn nor a click target. **The panel
carries no help text**: the key help that used to overflow into it and the line saying what the
highlighted row does are gone, and what a row does is the bottom line's to say. The rule that an empty
construct group is drawn, not skipped, so no hotkey moves when content arrives (gate 5B), retired with
the groups; it returns with them.

**A card replaces the menu while something has the map's attention — GUIDANCE, canon 2.21, reshaped
at canon 2.25, 2.26 and 2.27** (owner, 2026-09-27 to 2026-09-30). **Explore Map** — the menu's first
entry, and where the screen opens — gives the Grid the keyboard with nothing armed, and the panel
describes whatever is under the cursor **as the cursor moves**, no key needed. **Placing a building**
does the same for the building being placed (F58: "the menu should change to the full card that shows
details about that building ... This will create visual consistency for anything that gains focus on
the map"). Either way the card's header is **the row that opened it, drawn active on the panel's first
line** — `[e] Explore Map  >` or `[1] Barracks  >` — a separator runs under it, and
the card follows, in four parts (owner, 2026-09-30, F84): a **title** beside its icon (the thing's own
glyphs); a **subtitle** under the title, one short line on what the thing is for; a **description**, a
few plain sentences wrapped between words and never cut mid-word; and its **numbers** as label/value
rows — cost where the menu sells it, health, size, attack where it has one, or a bare tile's position.
The same four parts describe a building being placed, a planned or standing building, the Grid Nexus,
and bare ground (open ground, rock, a deposit). A card carries no status line — planned, standing or to
build is plain from the rest of the screen — and its words are written with the content, not in the
view. How it looks may later differ between placing a building, exploring in the Build Phase and
exploring during a Pulse; that stays a drawing choice over the same card. Start Pulse hides with the rest of the menu.
**The header's own hotkey cancels** (F70: "cancelation is "esc", "x" or the same hotkey ... that is
already on the title"): `e` closes Explore Map and a building's digit cancels it, as `x`, Esc or a click
anywhere on the panel do, back to where the card was opened from (9.7). **A building being placed holds
the menu** (F69, canon 2.28): until it is placed or cancelled, another building's digit, `e` and `s` are
refused — the header flickers and the bottom line names the way on — while popups that belong to no row
choice (the Nexus powers, the game menu, Controls, Settings) open over it and give it back, and never
move the menu's highlight. Explore Map holds nothing: a digit while exploring arms from the map. Arming
and opening Explore Map put nothing on the bottom line but its hint. Tab and a click on the map arrive in
plain navigation instead, the menu left beside the map, so the next click can arm from it. It is a first
version of the presentation card the owner described; a larger ASCII art version waits for content
that has one, and live numbers wait for the Nexus Pulse view.

**The card opens with a short transition — GUIDANCE, canon 2.28** (F68: "all the menu disappears except
for the currently selected menu item ... interpolates (moves) the item to the top, and then the detail
card appears"). Whenever the panel turns into a card — Explore Map opened, or a building armed from the
menu or by a digit on the map — it plays over the card reveal's length (400 ms, the owner's tuned value since his third round)
in three beats: the other rows fade out (a quarter); the chosen row, drawn active, slides a row at a time
to the header line (under a third); the separator and the card fade in, its name, subtitle and
description typed and a building's icon playing its own placement frames (the rest). From one card
straight to another only the last beat plays. Closing is instant, reduced motion shows the card at once,
and a still frame is the finished card. It is presentation timed by the live loop, which watches the
state become a card; the reducer never hears of it.

**A menu row has two states — RULE, canon 2.26; the active look since canon 2.27** (owner, 2026-09-29,
feedback F32: "we can standardize on the same style we use for buildings"): **highlighted**, the
keyboard's inverse bar, drawn only while the menu has focus; and **active**, while its action is under
way — a building armed, Explore Map open, the Nexus popup open, the Battle Round screen open. An active
row reads **`[1] Barracks  >`** (F53, then F67 and F70 at canon 2.28): its own hotkey, which ends what
it started (with Esc and `x`), and one `>` in place of its value, pointing at the map ("This will help
with the visual aid about the selected item having an effect on the grid"); the whole row in the hotkey
colour and bold, no underline, no bar — legible in monochrome by the `>` and the bold. A pressed flash
still wins, drawn as the bar — except on the row a card reveal carries up from the menu, which is
drawn active all the way (F68). **A refused flicker changes only the words** (F61): they turn grey — the
muted role, dim — and the row's background stays exactly as it was, the highlight bar included, so it
reads "nothing here" rather than a press. Every menu row either opens a popup or gives the map something to do (F52), and both kinds
share the one look. One function decides and draws it for every row, so a change of style reaches them
all.

**Popups have one shape — RULE for the shape as data, GUIDANCE for its look, canon 2.21, grown at
2.26.** Every popup — the Nexus powers, the start-the-Pulse question, the game menu, Settings, the
export, and a message — is a title and a list of rows, some of them options that name the command a
click on them sends, and **at most one run of rows that scrolls** (`src/build/popup.ts`). The frame
draws a popup from the same placed shape the mouse adapter hit-tests, so a click can never land on
anything the frame drew somewhere else — the guarantee `src/build/layout.ts` already gives the side
panel. Drawn to be unmissable (the owner clicked Nexus, did not notice the popup, and thought the mouse
had stopped working): centred over the Grid pane, bordered in a solid bar, the title in the top border,
and a one-cell shadow that blanks what is behind it. **No popup carries `[esc]`** since gate 5K: the
top bar's right end names what Esc does — `close [esc]` while a popup is open — and is its click
target (9.7, feedback F37). While its scrolling rows overflow, **the right border beside them is a
scroll bar**: an up symbol, a track that is the plain border, a thumb showing the share in view in a
texture of its own (never the shadow's: `#` in ASCII, `╬` in Unicode — the owner's third round, F78),
and a down symbol, in every glyph pack; a click on its upper half scrolls up and on its lower half down, and the wheel and Up/Down
walk the highlight as before (F36). **A message is the shape with nothing to choose**: a title and
wrapped text, closed by Esc (or `x`, or a right click) or a click outside, and by nothing else (F34:
"This popup does not have an action, it's just a warning message"). A popup holds the keyboard and
the mouse until it closes, and nothing opens one but the player — a message only as the answer to
something the player just did. It sits on top of everything else without a drawing band of its own
(9.4).

**No radius preview until something placed has a radius.** An earlier draft of the table's Build
Phase row listed one; nothing in the content that exists has a radius, and a preview of nothing is a framework built
before its first use (Q30).

**The Pulse view shows everything by default.** Selection is an addition the player reaches for, never
a prerequisite for following the fight. If a Pulse can only be understood by clicking things, the
presentation has failed and no panel will rescue it.

### 9.3 Tile width — RULE

One Grid tile occupies **one terminal column** at 80 columns and **two** at 128 or wider. Same tiles,
same actors, same revealed information; only the composition changes. **80 × 24 is the acceptance
target** — anything authored for the wide composition must degrade to the narrow one.

One honest consequence: at one column per tile the Grid is squashed 2:1 horizontally, because a
terminal cell is about twice as tall as it is wide. A radius that is square in tiles looks like a
wide rectangle. Range previews and area effects must be authored in tiles and must be checked at
both widths.

Effects are authored against **tile coordinates**, never column counts, so one effect written once
works at both widths.

### 9.4 Bands — RULE

Fixed bands, not free z-indexes. The layers of Section 3.4 map onto them directly, which is the point:

| Band | Fed by |
| --- | --- |
| 1 `terrain` | `terrain` layer |
| 2 `territory` | construction coverage |
| 3 `ground-items` | salvage, rubble, deposits |
| 4 `structures` | `obstacles` layer |
| 5 `units` | `workers` and `units` layers |
| 6 `air` | `air` layer |
| 7 `projectiles` | presentation only |
| 8 `effects` | presentation only |
| 9 `highlights` | selection, cursor, preview, range |
| 10 `chrome` | frame, sidebar, status strip, popups |

Each band returns sparse cells; the topmost defined cell replaces the lower complete cell style.
Grid bands clip to the Grid. **Presentation overlap never changes occupancy.**

**A popup has no band of its own** (canon 2.21). It is drawn last in the `chrome` band: within one
band a later write replaces an earlier one, so a popup drawn after the frame, the side panel and the
bottom bar sits on top of all of them, and over the Grid bands beneath. The bands stay the fixed list
above; an eleventh band for overlays would be the free z-index this section exists to refuse.

**The corruption law — RULE.** Effects that deliberately degrade the display — Glitch identity, Nexus
authority, Commander restoration, catastrophic destruction — live in `effects` or above, never in
`units` or `structures`. They may add, overdraw, and unsettle. They may never remove or replace the
only cell carrying a required semantic cue. The screen may look wrong; the player must still be able
to see what is attacking them.

**The compositor enforces it; recipes are not asked to remember** (Milestone 1B). An effect cell that
would replace an entity's own glyph is dropped on that tile, and the only write allowed onto an
occupied cell is a glyphless attribute change. The first frame ever composed with effects on put a
clash mark on the defender's own cell — removing the only thing saying the defender was there — and
a test written for Gate 1A caught it immediately. A structural guarantee is worth more here than
eleven recipes each remembering a rule.

### 9.5 Effects and particles

Effects subscribe to semantic cues and cannot apply damage, move actors, spend resources, or decide
victory. They sample **absolute presentation time**, so the frame at time *t* is identical whether
every earlier frame rendered or most were skipped. Cosmetic randomness never touches the gameplay
stream.

The particle system, its contract, its starter vocabulary, and the craft rules that make ASCII motion
read as weight are specified in **[`ascii-effects.md`](effects.md)**.

**Placement juice — GUIDANCE, gate 5I.** A structure may carry **placement frames**: a short list of
footprint-sized frames played before its finished art as it is placed (a space is empty ground). Only
the Build Phase view reads them; a structure without them gets a generic run derived from its finished
art, so no content waits on an artist. It is presentation only: the live loop times each placement
from the first frame that drew it, the view draws a pure function of the plan and the time since
placement, and a placement that leaves the plan stops at once. **A placement is one *play* of its
frames on that building's animation track, and the light (`fx.light.flash`, shading — `tint`, above)
and the sparks (`fx.sparks.burst`, particles) are that play's follow-ups, scheduled when its last frame
ends** (gate 5J). Reduced motion shows it finished at once. Every duration and intensity is an
Experiment. The four families of presentation — animations, particles, shading and tweens — and the
animation track are defined in [`ascii-effects.md`](effects.md) Section 1.2.

### 9.6 Accessibility and input — RULE

- Keyboard-complete; mouse is optional direct manipulation.
- Every gameplay glyph occupies exactly one cell. No emoji, combining mark, or ambiguous-width glyph
  is ever required.
- ASCII-safe is the baseline; Unicode packs map the same semantic roles separately.
- Monochrome, 16-colour, 256-colour, and truecolor are explicit modes.
- **Colour never carries ownership, target, danger, or health alone.**
- Reduced motion keeps anticipation, impact, and settled state; it removes decorative movement only.
- Structured snapshots include glyph, foreground and background roles, and attributes.
- Below minimum size, playback pauses behind a resize gate and resumes from the same presentation
  time. Early docs/milestones do not scroll or crop.

The simulation knows semantic ids such as `unit.worker` and `structure.nexus`. **It never knows a
glyph.**
