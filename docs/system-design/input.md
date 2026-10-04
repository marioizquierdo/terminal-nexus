# Terminal Nexus — input

_The command vocabulary, the three adapters (keyboard, mouse, driver), displayed hotkeys, the bindings and what the terminals actually send._

## 1. Commands, adapters and hotkeys — RULE

Written before any interactive screen existed, so that every screen builds against one model instead of
two. The owner's direction: when a player is proficient they should be able to move fast by typing; the
menu should also work with the mouse; keyboard, mouse and agent interfaces are all supported.

**One command vocabulary — RULE** (`tests/build-phase.test.ts`, `tests/build-focus.test.ts`,
`tests/build-nexus.test.ts`: the same plan by hotkeys, by clicks and from a driver script is the same
state and the same frame). Everything a player can do on an interactive screen — pick a menu item, move
keyboard focus, move the cursor, arm a structure for placement, place it, inspect a tile, remove it,
pick a Nexus power, go back one level, commit the Build Phase, start the Pulse, advance a cutscene, ask
to leave, quit — is a **named command**. Commands are the only way input reaches the application shell,
and a command's effect never depends on which adapter produced it. **Keyboard, mouse and a driver are
three adapters onto that one vocabulary**, and all three are first-class:

| Adapter | Produces commands from | Exists for |
| --- | --- | --- |
| **Keyboard** | key events, through one displayed keymap | the primary way to play; keyboard-complete stays the accessibility floor (see [`presentation.md`](presentation.md)) |
| **Mouse** | click, wheel, and, where the terminal reports it, motion — converted from terminal cells to tiles and menu rows by the adapter alone | direct manipulation: every menu item is clickable, and a click that activates it does exactly what its hotkey does. A click **activates what it lands on**, from any focus; only the keyboard has a "highlighted, not yet chosen" state |
| **Driver** | a scripted list of commands, or of raw key and mouse events, from a file or a test | agents and tests: playtesting the game without a terminal, and every input assertion the project makes |

The driver is not a test-only afterthought. It is the practical test in
[`grid-engine.md`](grid-engine.md) (resolve an entire match with the renderer deleted) applied to the
shell: the whole game, menus and Build Phase included, must be playable from a command stream, and its
output read back as the engine-owned cell frame (see [`presentation.md`](presentation.md)) and structured
snapshots rather than as pixels or ANSI. Two things follow:

- **The driver injects raw key and mouse events into the real adapters, not only commands**
  (RULE — `tests/playtest.test.ts`, `tests/build-focus.test.ts`, `src/playtest/keys.ts`). A test that
  only sends commands proves the command works; it does not prove that `[2]` on screen means what
  pressing `2` does, or that a click on that row means the same. The mapping is the thing most likely to
  drift, so it is the thing under test. `controlForKey` and `keysFromChunk` in `src/terminal/playback.ts`,
  and the fake stdin `tests/lifecycle-backend.test.ts` drives `watch` with, are the seed of this: one key map
  that both the view and a test agree on. The scripted playtest (`scripts/playtest.mjs`) generalises it
  to the mouse and to every screen.
- **Mouse geometry lives only in the mouse adapter** (RULE — `tests/playtest.test.ts`,
  `tests/build-edge.test.ts`, `src/build/mouse.ts`, `src/title-menu/mouse.ts`). A click arrives as a terminal
  cell; the adapter converts it to a tile using the tile width (see [`presentation.md`](presentation.md))
  and the composition's layout, and emits a command that names a tile or a menu item. Nothing downstream
  ever learns a cell coordinate, so a change of tile width or panel layout changes one adapter and no
  command.

**Menus — RULE** (`tests/build-help.test.ts`, `tests/build-view.test.ts`, `tests/build-start.test.ts`).
Every menu item displays its hotkey before its label — `[1] Barracks`, `[s] Start Pulse` — and pressing
that key activates the item. **A hotkey that is not displayed does not exist**: the bottom line never
names a key the keyboard adapter does not bind, and the Controls page names only keys the adapters bind
and lists every command key they bind. Arrow keys and Enter also work on every list, and Esc backs out of
it: the hotkey is the fast path, never the only one (a menu can always be walked with Up, Down and Enter
alone). Hotkeys are stable — the same item keeps the same key across screens, sessions and terminal
sizes — so muscle memory transfers. The bracketed key is the carrier that survives monochrome; a style
role (`chrome.hotkey`) colours it where colour exists, and colour never carries it alone.

## 2. The Grid cursor and the Build Phase's focus

**The Grid cursor — RULE for what it is** (`tests/build-motion.test.ts`, `tests/build-camera.test.ts`);
the numbers are GUIDANCE. There is one cursor, on the Grid, moved by the arrow keys one tile at a time,
with a modifier for a longer jump; it drives scrolling as [`grid.md`](grid.md) states. Clicking a Grid
tile moves the cursor to it. In the Build Phase a structure is *armed* from the construct menu by its
hotkey, by Enter or Space on its highlighted row, or by a click, and placed at the cursor with Enter or
Space, or by a second click on the same tile (below). The camera and the cursor ease toward their targets
over a few frames while the state is already at the destination; that is presentation only, and keys
never wait for it.

**The menu orchestrates the Build Phase — RULE** (`tests/build-focus.test.ts`, `tests/build-cancel.test.ts`,
`tests/build-holds-menu.test.ts`). Keyboard focus is reducer state, on the menu or on the Grid, and the
screen is always in one of four plain modes: **the menu** (the highlight bar, no Grid cursor),
**placing** (focus on the Grid with a structure armed: its row drawn active, the cursor carrying its
ghost), **Explore Map** (focus on the Grid, nothing armed, the tile panel in the menu's place) and
**plain navigation** (focus on the Grid, nothing armed, the bare cursor and the menu beside it).
**A structure is armed only while the Grid has focus**, so a stale ghost can never sit on the map while
the player works the menu. **Finishing goes back to where it began**: a placement, or Esc while placing,
goes back — disarmed — to plain navigation when the arming began on the map (a digit pressed there), and
to the menu, on the row just used, when it began on the menu (Enter or Space or a click on its row, or a
digit while the menu had focus); Explore Map follows the same rule. With the mouse, "back to the menu"
leaves no highlight bar. How the screen draws each mode, and where the cursor lands when a building is
armed, are in [`ui-patterns.md`](ui-patterns.md); in short, arming puts the building where the cursor is
when it fits, otherwise at the nearest good spot within reach (`armSearchTiles` and `armVerticalCost`
in `src/build/tuning.ts`, `armingSpot` in `src/build/state.ts`), so pressing a building's key twice
lays a row.

## 3. Bindings

**Bindings are GUIDANCE**, the starting keymap, retuned on playtests. The sequence families the
terminals send and the fallbacks they need are RULE, marked where they appear.

| Key | Command | Note |
| --- | --- | --- |
| `1`–`9`, `0` | select item *n* of the panel's current list: the construct menu, the Nexus draft, or a menu screen's options. While a building is being placed its own digit cancels it and every other building's digit is refused until it is placed or cancelled | digits always address the list; they never mean anything else. The construct menu is one list; if groups come back, **they share one digit sequence**: a hotkey addresses the whole menu, never a position within a group, because per-group numbering needs a focused group and that is the mode this convention exists to forbid |
| Arrows | on the Grid: move the cursor one tile. On the menu and in every list: Up and Down move the highlight, stopping at the first and last row (no wrapping), taps counted and a hold at the map cursor's pace; Left and Right have nothing to do there, so the highlighted row flickers, and **the keyboard stays on the menu** | the cursor drives the camera at the scroll margin (see [`grid.md`](grid.md)); a tap moves one tile, a run of taps speeds up by counting (the third quick tap moves two, three more reach four), and a held arrow moves at the game's own pace, one tile a move and later two, whatever the keyboard's repeat rate. Where the terminal reports key events, a quick tap is never taken for a hold and a release stops the cursor at once. The flicker tells the player that focus is on the menu |
| Shift+Arrow | the fast move: a **jump of 10 tiles** (a tuned value taken from the owner's settings export of 2026-09-30), the view following by the ordinary margin; held, it jumps again at most every 100 ms. **In a list, the fast move goes to the first or last row** | fast pan across a scrolling Grid. **Two sequence families, both bound — RULE** (`tests/playback.test.ts`, `tests/build-phase.test.ts`): xterm's `CSI 1;<modifier>` and rxvt's `CSI a/b/c/d`. Any modifier counts, not Shift alone — nothing else on these screens binds a modified arrow, so a terminal that eats Shift but passes Alt or Ctrl still gives its player the fast pan. **Option+Arrow as a Mac sends it is the same move**: macOS terminals send Option+Left/Right as `ESC b`/`ESC f`, and one set to treat Option as Meta sends `ESC` before an ordinary arrow; the input splitter keeps both whole rather than breaking them into a bare Escape plus a stray key (a bare Escape with nothing armed leaves the screen). Bound from the terminals' documented defaults; **not yet measured on the owner's own iTerm2** — `node scripts/lib/key-echo.mjs`, run in that terminal, prints exactly what each key sends |
| PageUp / PageDown, Home / End | the fast move — the modifier-free fallback | **Required, not optional — RULE** (`tests/build-phase.test.ts`, `tests/playback.test.ts`): four surveyed terminal families send no shifted arrow at all, so without this they would have no fast pan. Decoded from a table, because Home and End have three live spellings between xterm, screen/tmux/linux and rxvt |
| Enter, Space | on the menu: activate the highlighted entry — arm a structure (focus moves to the Grid), open the Nexus powers, or explore. On the Grid while placing: place the armed structure at the cursor. On the map after a click brought the keyboard there: open Explore Map. In the Nexus powers popup: pick the highlighted power (the two questions answer to their own letters) | Space is an alias of Enter everywhere on this screen, never a second meaning of its own |
| Esc, `x` | **go back one level** — Esc is the `cancel` command, `x` the `back` command: close the open popup, returning to the popup it was opened from if any (Settings to the game menu, the export to Settings); else leave placing or Explore Map for where it began, disarming; else leave plain navigation for the menu; else, on the menu, **Esc** opens the **game menu** (`[s] Settings`, `[c] Controls and hotkeys`, `[a] Activity logs`, `[r] Restart`, `[q] Quit`) while **`x` does nothing** — no message, no flicker, on the menu, a committed plan or a Nexus Pulse alike — so `x x x` always lands on the menu. No popup has a row that only goes back | **RULE: Esc never leaves the game by itself — leaving always asks** (`tests/build-settings.test.ts`, `tests/lifecycle-build-phase.test.ts`). `x` is Esc everywhere but there, and a right click is `x`. A lone Esc at the end of a read waits a short timeout (50 ms, a tuned value) for the rest of a sequence; Esc then a letter or digit in one read is two keys; Esc then an arrow in one read is Option+Arrow, so anything scripting keys pauses after Esc (`tests/build-motion.test.ts`) |
| Tab | toggle keyboard focus between the side panel's menu and the Grid (arriving on the Grid in plain navigation, nothing armed); does nothing while a popup is open | **Focus is its own state beside `armed`**, and a structure is armed only while the Grid has focus; finishing returns focus to where it began. The bottom line's hint is written for where focus is, because focus makes arrows mean two things. Whether a key should jump the cursor to the player's next own structure is an open question (Q53) |
| Backspace, Delete | on the Grid: remove the planned, uncommitted placement under the cursor | plans are revisable until commit. The Mac key labelled "delete" sends Backspace, so it cannot also return focus to the menu; Esc does. On the menu, where the cursor is hidden, it is refused: the row flickers, as Left and Right do; refused, naming it, while another planned building needs its build range |
| `u` | undo the last planned placement | refused the same way, while another planned building needs its build range |
| `s`, `p` | Start Nexus Pulse — the menu's last row, `[s] Start Pulse`; `p`, its first key, still works | moves focus to the menu and opens the Battle Round screen, where Enter, Space or `s` again start it and Esc goes back; the one action that must not fire by accident. Refused while a dealt Nexus power is still waiting to be picked |
| `n` | open the Nexus powers popup — the menu's `[n] Nexus` entry | pressed again inside the popup, closes it |
| `e` | Explore Map — the menu's first entry, `[e] Explore Map`: focus to the Grid with nothing armed, the side panel describing what is under the cursor as it moves. Opened from the menu, the cursor first moves to clear ground by the arming rule for a one-tile footprint; opened from the map it stays | a toggle, its row drawn active while open. Tab arrives in plain navigation instead |
| `q` | open the game menu | never quits outright, so a stray press cannot lose a plan; only the game menu's own `[q]` (or Enter or a click on its Quit row) quits. The top bar's `menu [esc]` is Esc, which on the menu opens it |
| Ctrl+C | quit at once | the one immediate way out, from anywhere |
| `?` | the **Controls and hotkeys** page — every key and click, grouped by where the player is; also the game menu's `[c]` row | one scrolling popup, from one table (`src/build/help.ts`); opened from the game menu, Esc goes back to it; opened with `?`, Esc closes it |
| `q`, Space, `.`, `,`, `[`, `]`, `r` | unchanged from `grid` during a Pulse: quit, pause, step, speed, restart | one keymap across `grid` and `terminal-nexus` |
| Mouse: click a menu row | **activate at once**, whatever had focus: arm the building (its preview at the cursor when it fits there, else at the nearest good spot; what a row click starts returns to the menu), open the Nexus powers, or open Explore Map — the row's hotkey. While a card covers the menu (Explore Map, or a building being placed), a click on the panel only gives the menu back | **RULE: a click activates what it lands on** (`tests/build-focus.test.ts`, `tests/build-menu.test.ts`). The selected state only makes sense with the keyboard. After the mouse works the menu no highlight bar is drawn; the first menu key only shows it again, on the row it remembers. An armed row is drawn active (see [`presentation.md`](presentation.md)), never with the keyboard's bar. The whole row is the target, the width its highlight bar is drawn |
| Mouse: click a Grid tile | move focus to the Grid and the cursor to the tile, the armed preview with it; **a second click on the same tile places it, and so does a quick double click on the same spot**. With nothing armed it only moves the cursor: in Explore Map the panel follows it; from the menu, the menu stays drawn beside the map | see "A second click on the same tile" below. A click near an edge scrolls in proportion, armed or not; an unarmed click near an edge scrolls in proportion to how near it is, the settled answer (Q62). A `Shift+click` to place in one click is planned |
| Mouse: click outside an open popup | close the popup and move focus to where the click landed — and nothing more | **RULE: a dismissing click never also places, picks or activates** (`tests/build-nexus.test.ts`, `tests/build-holds-menu.test.ts`): a player who clicked a button, missed the popup in the middle of the screen and clicked again must not have the second click do anything else. A click on the top bar's `close [esc]` goes back one level, as Esc does, where a click outside closes every popup at once; a click on one of its options chooses it |
| Mouse: click the top bar's right end | Esc — the `cancel` command, one level back | the right end names what Esc does now: `menu [esc]` on the menu (or a committed Build Phase), `back [esc]` while the Grid has focus, `close [esc]` while a popup is open (`tests/build-popups.test.ts`). It is the one place Esc is named on screen |
| Mouse: wheel | **move the cursor five tiles**; the camera follows it, as it follows every other cursor move | the mouse's Shift+Arrow, literally. An independent camera would be the separate pan mode [`grid.md`](grid.md) forbids, and would strand the cursor off screen. Inside a popup, the wheel walks its list. Whether the wheel should follow Shift's step instead of five is an open question (Q63) |
| Mouse: right click | `x` — go back one level, never opening the game menu | the RTS convention for "cancel"; it is `x`, not Esc, so a stray right click cannot open a menu (`tests/build-cancel.test.ts`) |

**Letters are spoken for before they are built**, so a new binding does not collide with a planned one:
`d` opens Settings at its Experiments, and `m` is kept for a whole-map popup (an open question, Q59);
inside their own popups `s` is Settings (the game menu) and `e` is Export (Settings), while outside them
`e` is still Explore Map. The entries above the construct rows get **letters**, never digits — a digit
would renumber every construct row beneath it, which is exactly what one digit sequence per menu exists
to prevent: `[e] Explore Map` and `[n] Nexus`. Inside the game menu `c` is Controls and hotkeys and `a` is Activity logs. `p`,
`q`, `s`, `u` and `x` are taken.

Three conventions behind that table, so a retune keeps them:

1. **No modes but focus.** A key means one thing on a screen. Digits always address the list, letters
   always name commands, from either focus. That is why `h`/`j`/`k`/`l` are *not* cursor aliases even
   though a terminal audience expects them: letters belong to the hotkey vocabulary, and a modal cursor
   is the classic source of "why is my key not working." The one exception is a panel that genuinely
   needs arrow keys of its own (the menu): it takes them through keyboard focus, so arrows and
   Enter/Space — and nothing else — follow focus, Tab moves it, and the bottom line's hint is written for
   where it is.
2. **The screen documents itself.** The bottom line says what can be done where the keyboard is, the
   Controls and hotkeys page (`?`, or the game menu's `[c]`) carries every key and click, and every menu
   row carries its own. Nothing is discoverable only from a manual.
3. **Standards over cleverness.** Enter confirms, Esc cancels, `?` helps, digits pick, wheel scrolls,
   right-click cancels. A player who has used a terminal editor, a roguelike, or an RTS should guess the
   first key right.

## 4. The Nexus power pick

**The Nexus power pick is a popup the player opens, not a screen forced on them.** The menu's
`[n] Nexus` entry, with the number of picks waiting after its name in the hotkey's colour, opens a popup
in the middle of the screen only when the player actively selects it, never forced open when the Build
Phase begins; inside it they make a pending pick by keyboard or mouse, read what each power does, and
review the ones already active (RULE — `tests/build-nexus.test.ts`: nothing opens the popup but the
player). The popup holds the keyboard and the mouse until it closes. **It closes on the pick**: open,
pick, and the player is back on the menu; the status line and the entry's "1 active" confirm it, and
reopening lists the pick as active. Esc, `n` or a click outside close it without a pick. The popup is
one of the shapes in [`ui-patterns.md`](ui-patterns.md).

**A dealt Nexus power still may not be skipped** ([`commander-armies.md`](../game-design/commander-armies.md)),
but the check is enforced only where the invariant has to hold: only the commit itself (`p`, and its
confirmation) is refused while a pick is outstanding, and arming, placing, undoing and removing proceed
freely (RULE — `tests/build-nexus.test.ts`; `commitLock` in `src/build/state.ts`). The Build Phase still
cannot end without a pick; the refusal fires only at the one place that matters, so an optional popup
does not feel forced.

## 5. Settings and Experiments

The game menu's `[s] Settings` is one scrolling popup, the same shape as every other, in titled sections
with a blank line before each: Display (**the player's own settings**: background, colour depth,
symbols, reduced motion, which apply at once and are saved through the same store as the title menu's
Settings) and then the sections whose rows are **Experiments**: live-editable playtest settings (a step
size, a timing, a look) so the owner can try an idea during a playtest instead of asking for a new
command-line flag and a rebuild.

- **Every setting is declared once with its tier** — player, experiment, or tuned (a constant in code,
  not shown) — and its section, label, question, values and default (`src/build/all-settings.ts`).
  Moving one between tiers or sections is a one-word edit, and code reads any setting through one lookup
  that does not care which tier it is on (RULE — `tests/build-all-settings.test.ts`).
- **Every Experiment names the question it serves and is normally deleted before its pull request is
  accepted**, a few staying longer or graduating into real settings. Experiments are Build Phase state,
  per session, **never saved**, because their defaults change from build to build. The reducer reads
  those that change what a command does; the input path and the live loop read the timing ones. The game
  menu's `[r] Restart` starts the Build Phase over keeping every setting and experiment. `d` opens
  Settings at the first Experiment.
- **A row shows its value between `<` and `>`**, Left and Right change it, and each half of the value
  box is a click target; the title says where the highlight is (`SETTINGS (5/20)`, counting only rows the
  keyboard can be on), and what the highlighted row is for is written under a line below the list. A
  setting that only takes effect when the Build Phase starts over says so on the status line when
  changed and, when Settings closes with such a change pending, once in a message popup.
- **Export settings** — the list's last row, and `[e]` from anywhere in it — shows every setting and
  experiment as `name = value` text: the experiments that differ from this build's defaults first, each
  with the default it replaced, then the settings, then the rest, with the build's commit near the top,
  so the owner can paste what felt right into a pull request comment. The adapter, never the reducer,
  also copies it to the clipboard (OSC 52 in a terminal, the clipboard API on the browser page) and saves
  it to a file beside the settings (RULE — `tests/build-settings.test.ts`).
- **`--settings "<text>"`** (the terminal game and the scripted playtest) and `#settings=` (the browser
  page) read an export back, skipping an unknown name or a bad value one at a time, so an agent sees
  exactly what the owner saw. Pairs may be separated by spaces, lines or `&`, as a route's query is
  (`trainEvery=6&reducedMotion=true`), and every on/off setting takes on/off, true/false, yes/no and
  1/0 — a yes/no one, and one whose values hold an "off" (Key releases' `true` is `auto`; the popup
  pulse's `false` is 0); a yes word with several "on" values to choose from is skipped, not guessed. An
  old export's names are read by the tier each setting is on now: a settled one is skipped quietly, a
  renamed one is read as its new name (RULE — `tests/build-settings.test.ts`).

The title menu's Settings screen has the player settings only. How the popup is drawn is in
[`ui-patterns.md`](ui-patterns.md).

## 6. What terminals actually send

Verified rather than assumed. The ten emulators below were measured on 2026-09-21; the table and the
terminals that could not be tested are in
[`the scrolling-and-placement report`](../history/reports/2026-09-21-scrolling-and-placement.md).

- **Modified arrows are not universal, and not single-valued.** Measured: xterm, xterm-256color, tmux
  and tmux-256color send `CSI 1;2A` and its siblings; rxvt and rxvt-unicode send a completely different,
  shorter form (`CSI a`/`b`/`c`/`d`); and **screen, screen-256color, the Linux virtual console, vt100,
  vt220 and ansi define no shifted arrow at all** — on those, Shift+Up is simply Up. Both families are
  bound, and the modifier-free fallback is required rather than a courtesy (RULE — `tests/playback.test.ts`,
  `tests/build-phase.test.ts`). PageUp and PageDown exist on every terminal description surveyed except
  vt100 and ansi, which makes them better supported than the binding the table recommends first. Both
  are displayed. **An emulator this project has not measured is not a supported one**: PuTTY, Alacritty,
  kitty, WezTerm, Ghostty, iTerm2, the GNOME/VTE family, Windows Terminal, Konsole and foot are all
  untested, and their own documentation is not a measurement. The owner plays in **iTerm2 on macOS**,
  which makes it the first one worth measuring: `node scripts/lib/key-echo.mjs` run there, with Shift,
  Option and plain arrows pressed in turn, settles what the table only assumes about it.
- **Mouse reporting is opt-in and must be undone.** A terminal reports the mouse only after the program
  asks (SGR extended mode, `1006`, over `1000`/`1002`); the one disposer described in
  [`runtime.md`](runtime.md) switches it off on every exit path. A game that leaves mouse reporting on
  is rejected for the same reason as one that leaves raw mode on (RULE — `tests/lifecycle-build-phase.test.ts`,
  `tests/lifecycle-backend.test.ts`). Where no mouse arrives — a plain SSH session, the driver, a non-TTY —
  nothing is lost, because the keyboard is complete.
- **Key events, where the terminal reports them.** With the Key releases Experiment on `auto`, the
  Build Phase asks the terminal for the kitty keyboard protocol (`CSI ? u`, then Device Attributes, which
  every terminal answers) and, if it answers, switches it on (flags 1 + 2: disambiguate, report event
  types). **The one disposer switches it off again on every exit path**, before leaving the alternate
  screen (RULE — `tests/lifecycle-build-phase.test.ts`, `tests/key-events.test.ts`). With the protocol on, a
  press is a tap, a repeat belongs to a hold and a release ends it at once; Esc arrives whole (no wait);
  Ctrl+C arrives as `CSI 99;5u` and still quits at once; keypad keys are read as the keys they stand for.
  A release sends no command. Where the terminal does not answer, or with the Experiment off, a press
  within the hold window of the one before is a repeat. The browser page behaves the same way from the
  browser's own key-down and key-up events. Only how a repeat is recognised differs, never where the
  cursor goes (RULE — `tests/build-motion.test.ts`, `src/terminal/key-events.ts`).
- **A second click on the same tile places the armed structure — RULE**
  (`tests/build-phase.test.ts`, `tests/build-motion.test.ts`, `tests/build-focus.test.ts`). A first click
  on a tile only moves the cursor there and shows the armed preview, the same as arriving there by arrow
  keys; a second click **on that same tile** is what commits the placement. A first click within the
  scroll margin can slide the Grid under the pointer, so a second click at the same *screen position* can
  land on a different *tile*; this is safe because the check is on tile identity, never on screen
  position, so a camera-shifted second click is correctly read as a fresh first click on a new tile (one
  more click confirms it), not a placement on the wrong one. A later `Shift+click` is planned as a
  one-click escape hatch for a proficient player; it is not built. Keyboard placement (Enter, and Space)
  stays a single press, which already asks for two deliberate actions (arm, then place) the way a first
  click now also does. An armed click scrolls the view like any other, so a player can keep clicking
  to scroll with the ghost and double click to place: a quick double click (two left clicks on the same
  screen cell within 400 ms, an Experiment) places where the first click pointed, and a slow second click
  on a moved view is a fresh first click. **What makes any of this safe is that a plan is
  revisable** — undo, remove-under-cursor, and nothing committed until the commit key. If a future Build
  Phase action is genuinely irreversible, confirmation belongs on that one action, never back on every
  click.
- **The tile just built on never reads as a refusal — RULE** (`tests/build-view.test.ts`). The moment
  after a structure is placed, the tile under the cursor is occupied by that same structure; a preview
  that redrew its normal legality check there would report the tile as taken and show the
  illegal-placement block on top of what the player had just correctly built, reading as a failure. It
  holds by construction: every placement disarms and returns focus to the menu (the menu orchestrates,
  above), so no ghost is left on the Grid to recheck the tile, and the status line reports the success —
  `Barracks placed (resources: 60) - [u] undo`.

## 7. Taps, holds and releases

How a press of an arrow becomes a move. The reducer never sees any of this: it receives ordinary
`move-cursor` and `highlight` commands of the size chosen here (`src/build/motion.ts`), on the map cursor
and in every Build Phase list alike. **Principle: the plain path always works; a host that offers more
makes it better.**

**Three tiers, each a fallback for the one above — RULE for the floor and the parity**
(`tests/build-motion.test.ts`); the numbers are GUIDANCE, each an Experiment in Settings' Keyboard
navigation section or a tuned constant (`src/build/all-settings.ts`).

- **Tier 1, the floor.** Every move is also one key: a tap moves one tile and the fast move (Shift or
  Option with an arrow, PageUp/PageDown, Home/End) jumps `jumpStep` tiles, **10 by default** (the choices
  run 5 to 20); held, it jumps again at most every 100 ms. The mouse wheel moves the cursor **5 tiles**
  (`WHEEL_TILES`, `src/build/mouse.ts`; whether it should follow the jump is Q63). No hold is ever
  required.
- **Tier 2, timing (every terminal).** A tap and a hold are different things. **Taps speed up by
  counting**: taps of one arrow each within 400 ms (`doubleTapMs`) of the one before are a run that keeps
  its speed, and every third tap since the speed last changed (`tapsToSpeedUp`), if it came within 300 ms
  of the one before (`fastTapMs`), doubles it, so 1, 1, 2, then 2, 2, 4, and 4 is the top (`tapTopStep`).
  A slower gap, another arrow or any other key starts over at 1. **A hold runs at the game's own
  cadence**, whatever the keyboard's repeat rate: at most one move every 60 ms (`holdMoveMs`; on average
  exactly that when the keyboard repeats faster), 1 tile a move, then 2 once the key has repeated for
  600 ms (`holdLongMs`, `holdLongStep`). A hold breaks a run of taps, so the tap after it is one tile.
  Without key events a press of the same arrow within the **hold window** (`holdWindowMs`, 200 ms) of the
  one before is a repeat; anything slower is a tap. The window must stay above the keyboard's own repeat
  delay, which is why it is live to retune.
- **Tier 3, releases (a host that reports them).** The terminal's keyboard protocol (section 6) and the
  page's `keydown` and `keyup` say which presses are taps, which are a hold's repeats and when it ends:
  a quick tap is never taken for a hold and a release stops the cursor at once. Only how a repeat is
  *recognised* changes, never where the cursor goes: the same intent as timed presses and as
  press/repeat/release events lands on the same positions (RULE, `tests/build-motion.test.ts`). Scripts
  and the playtest send `Right/repeat` and `Right/release`; the playtest summary prints each move (`tap 2`,
  `hold 0`). The Key releases Experiment (`auto` | `off`) lets the owner compare. How a host is detected,
  and what each host can offer, is in [`portability.md`](portability.md).

**IDEA: a learned hold window.** Replace the fixed 200 ms with one measured from the first held run: keep
the median gap between repeats and set the window to about twice it, so a slow repeat delay stops turning
a hold's first repeat into a tap; the Experiment stays as an override, and "nothing for the window" counts
as the release. Not built; the number is the owner's own guess ("I would try 200").

**What is not done**, for the session that polishes navigation:

- The hold cadence is a first guess, and its numbers could be Experiments for that session; no export has come back for it yet.
- With key events a hold still waits for the operating system's first repeat before it moves on the
  cadence. A timer of the game's own in the live loop could start it sooner and stop at the release, with
  a safety stop for a release that never comes.
- Without the protocol a lone Esc still waits a moment (`escTimeoutMs`, 50 ms); Windows Terminal's
  win32-input-mode is not read; the title screen's menu has no timing at all (it stops at its ends and
  jumps); the browser page's hidden typing field sends no releases.
- A terminal that answers the keyboard query after a very quick quit would print its answer into the
  shell. Not seen, not guarded.
- Unmeasured on the owner's machine: `node scripts/probe-key-release.mjs` in his iTerm2 says whether it
  answers the query and whether held keys report `repeat` then `release`; his keyboard's repeat delay and
  interval (the `+N ms` column while holding) set what the hold window should be.
