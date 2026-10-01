# Terminal Nexus — input

_The command vocabulary, the three adapters (keyboard, mouse, driver), displayed hotkeys and the bindings. Split from the engine design; every unmarked statement is GUIDANCE._

### 9.7 Input model — RULE for the command vocabulary, the three adapters, and displayed hotkeys; GUIDANCE for the bindings

**Owner direction, canon 2.10**, written before any interactive screen exists so that Milestones 3
and 5 build against one model instead of two. Mario: "When a player is proficient in the game, they
should be able to move fast by just typing in the keyboard... The menu should also work with the
mouse... We have to support keyboard, mouse, and agent interfaces."

**One command vocabulary — RULE.** Everything a player can do on an interactive screen — pick a
menu item, move keyboard focus, move the cursor, arm a structure for placement, place it, inspect a
tile, remove it, pick a Nexus power, go back one level, commit the Build Phase, start the Pulse,
advance a cutscene, ask to leave, quit — is a **named command**. Commands
are the only way input reaches the application shell, and a command's effect never depends on which
adapter produced it. Three adapters exist, and all three are first-class:

| Adapter | Produces commands from | Exists for |
| --- | --- | --- |
| **Keyboard** | key events, through one displayed keymap | the primary way to play; keyboard-complete stays the accessibility floor (9.6) |
| **Mouse** | click, wheel, and, where the terminal reports it, motion — converted from terminal cells to tiles and menu rows by the adapter alone | direct manipulation: every menu item is clickable, and a click that activates it does exactly what its hotkey does. Since canon 2.25 a click **activates what it lands on**, from any focus (owner, 2026-09-28: "using the mouse should activate what is being clicked"); only the keyboard has a "highlighted, not yet chosen" state (the bindings table below) |
| **Driver** | a scripted list of commands, or of raw key and mouse events, from a file or a test | agents and tests: Claude playtesting the game without a terminal, and every input assertion the project makes |

The driver is not a test-only afterthought. It is Section 1's practical test — "resolve an entire
match with the renderer deleted" — applied to the shell: the whole game, menus and Build Phase
included, must be playable from a command stream, and its output read back as the engine-owned cell
frame (9.1) and structured snapshots rather than as pixels or ANSI. Two things follow:

- **the driver injects raw key and mouse events into the real adapters, not only commands.** A test
  that only sends commands proves the command works; it does not prove that `[2]` on screen means
  what pressing `2` does, or that a click on that row means the same. The mapping is the thing most
  likely to drift, so it is the thing under test. `controlForKey` and `keysFromChunk` in
  `src/view/playback.ts`, and the fake stdin `tests/lifecycle.test.ts` drives `watch` with, are the
  seed of this — one key map both the view and a test agree on. The driver generalises it to mouse
  events and to every screen;
- **mouse geometry lives only in the mouse adapter.** A click arrives as a terminal cell; the adapter
  converts it to a tile using the tile width (9.3) and the composition's layout, and emits a command
  that names a tile or a menu item. Nothing downstream ever learns a cell coordinate, so a change of
  tile width or panel layout changes one adapter and no command.

**Menus — RULE.** Every menu item displays its hotkey before its label — `[1] Barracks`,
`[s] Start Pulse` — and pressing that key activates the item. **A hotkey that is not displayed
does not exist.** Arrow keys and Enter also work on every list, and Esc backs out of it: the hotkey is
the fast path, never the only one (a menu can always be walked with Up, Down and Enter alone). Hotkeys are stable — the same item keeps the same key across
screens, sessions, and terminal sizes — so muscle memory transfers. The bracketed key is the carrier
that survives monochrome; a style role (`chrome.hotkey`) colours it where colour exists, and colour
never carries it alone (9.6).

**The Grid cursor — RULE for what it is, GUIDANCE for the numbers.** One cursor, on the Grid, moved
by the arrow keys one tile at a time, with a modifier for a longer jump; it drives scrolling exactly
as 3.3 already states. Clicking a Grid tile moves the cursor to it. In the Build Phase, a structure is
*armed* from the construct menu by its hotkey, by Enter or Space on its highlighted row, or by a
click, and placed at the cursor with Enter or Space (or a second click on the same tile — Q52, below).

**The menu orchestrates the Build Phase — RULE, canon 2.21; finishing returns to where it began
since canon 2.26** (owner, 2026-09-27, Q57; refined 2026-09-29, feedback F30). Keyboard focus is
reducer state, on the menu or on the Grid, and the screen is always in one of four plain modes:
**the menu** (the highlight bar, no Grid cursor), **placing** (focus on the Grid with a structure
armed: its row drawn active, the cursor carrying its ghost), **Explore Map** (focus on the Grid,
nothing armed, the tile panel in the menu's place) and **plain navigation** (focus on the Grid,
nothing armed, the bare cursor and the menu beside it). **A structure is armed only while the Grid has
focus**, so a stale ghost can never sit on the map while the player works the menu. **Finishing goes
back to where it began**: a placement, or Esc while placing, goes back — disarmed — to plain
navigation when the arming began on the map (a digit pressed there), and to the menu, on the row just
used, when it began on the menu (Enter/Space or a click on its row, or a digit while the menu had
focus); Explore Map follows the same rule. With the mouse, "back to the menu" leaves no highlight bar
(9.2). **Arming puts the building where the cursor is** — its digit, Enter/Space on its row or a click
on it — when it fits there; otherwise the spot within reach of the cursor that costs the least to
reach, a tile up or down costing more than a tile sideways (the reach and the cost are the owner's
tuned values, `armSearchTiles` and `armVerticalCost` in `src/build/tuning.ts`), trying first spots that leave one free
tile between it and every structure and only then spots that merely fit (ties: the more horizontal
move, then east, then south); with none in reach the cursor steps one right and one down and the
building is drawn as itself, not refused, until the player moves or tries to place. The cursor opens
on the Grid Nexus. The owner's own flow (2026-09-29): find a good area, press a building's key — it
stays under the cursor — place it, press the key again, and the next one lands a free column to the
right. This retires Q55's smart cursor, which placed the next building beside the last one planned
wherever the cursor was.

**Bindings — GUIDANCE**, the starting keymap. Milestones 3 and 5 retune on evidence and record why:

| Key | Command | Note |
| --- | --- | --- |
| `1`–`9`, `0` | select item *n* of the panel's current list — construct menu, Nexus draft, or a menu screen's options. While a building is being placed its own digit cancels it and every other building's digit is refused until it is placed or cancelled (canon 2.28, F69-F70) | digits always address the list; they never mean anything else. The construct menu is one list since canon 2.27 (no groups); if groups come back, **they share one digit sequence** (gate 5B): a hotkey addresses the whole menu, never a position within a group, because per-group numbering needs a focused group and that is the mode this convention exists to forbid |
| Arrows | on the Grid: move the cursor one tile. On the menu and in every list: Up/Down move the highlight, stopping at the first and last row (no wrapping, canon 2.28), taps counted and a hold at the map cursor's pace; Left and Right have nothing to do there, so the highlighted row flickers, and **the keyboard stays on the menu** | the cursor drives the camera at the scroll margin (3.3); a tap moves one tile, a run of taps speeds up by counting (the third quick tap moves two, three more reach four), and a held arrow moves at the game's own pace, one tile a move and later two, whatever the keyboard's repeat rate; where the terminal reports key events, a quick tap is never taken for a hold and a release stops the cursor at once (3.3). The flicker is the owner's (2026-09-27: "pressing right/left should flicker the item so the user understands the focus is on the menu"); a second Right moved focus to the Grid until canon 2.27 (2026-09-30, F55: "on second thought, it's better that the focus stays on the menu, but it is good that the menu item blinks when pressing left or right") |
| Shift+Arrow | the fast move: a **jump of 10 tiles** (the owner's settings export, 2026-09-30; 5 until gate 5H, 8 until gate 5J, 12 until canon 2.28), the view following by the ordinary margin; held, it jumps again at most every 100 ms. **In a list, the fast move goes to the first or last row** (canon 2.28) | fast pan across a scrolling Grid (owner, 2026-09-28: "Holding shift should behave fundamentally different, instead of just speed up to 8, it should move the cursor 12 tiles"). **Two sequence families, both bound** (gate 5A): xterm's `CSI 1;<modifier>` and rxvt's `CSI a/b/c/d`. Any modifier counts, not Shift alone — nothing else on these screens binds a modified arrow, so a terminal that eats Shift but passes Alt or Ctrl still gives its player the fast pan. **Option+Arrow as a Mac sends it is the same move** (owner, 2026-09-26: "we should also allow option (it is typical to move word by word)"): macOS terminals send Option+Left/Right as `ESC b`/`ESC f`, and one set to treat Option as Meta sends `ESC` before an ordinary arrow. Before canon 2.19 the input splitter broke both into a bare Escape plus a stray key — and a bare Escape with nothing armed leaves the screen. Bound from the terminals' documented defaults; **not yet measured on the owner's own iTerm2** — `node scripts/lib/key-echo.mjs`, run in that terminal, prints exactly what each key sends |
| PageUp / PageDown, Home / End | the fast move — the modifier-free fallback | **Required, not optional** (gate 5A): four surveyed terminal families send no shifted arrow at all, so without this they would have no fast pan. Decoded from a table, because Home and End have three live spellings between xterm, screen/tmux/linux and rxvt |
| Enter, Space | on the menu: activate the highlighted entry — arm a structure (focus moves to the Grid), open the Nexus powers, or explore. On the Grid while placing: place the armed structure at the cursor. On the map after a click brought the keyboard there: open Explore Map (9.2). In the Nexus powers popup: pick the highlighted power (the two questions answer to their own letters) | Space added 2026-09-26 (owner: "should also work with space, that was my reflex") — an alias of Enter everywhere on this screen, never a second meaning of its own |
| Esc, `x` | **go back one level** — Esc is the `cancel` command, `x` the `back` command: close the open popup, returning to the popup it was opened from if any (Settings to the game menu, the export to Settings); else leave placing or Explore Map for where it began, disarming; else leave plain navigation for the menu; else, on the menu, **Esc** opens the **game menu** (`[s] Settings`, `[c] Controls and hotkeys`, `[r] Restart`, `[q] Quit`) while **`x` does nothing** — no message, no flicker, on the menu, a committed plan or a Nexus Pulse alike — so `x x x` always lands on the menu (owner, 2026-09-30, F62: "the only exception to the rule of esc and x are the same"). No popup has a row that only goes back (F73) | **RULE since canon 2.21: Esc never leaves the game by itself — leaving always asks.** `x` is Esc everywhere but there (owner, 2026-09-27: "it should be equivalent to do [esc], and x"), and a right click is `x`. A lone Esc at the end of a read waits a short timeout (50 ms, a tuned value) for the rest of a sequence; Esc then a letter or digit in one read is two keys; Esc then an arrow in one read is Option+Arrow, so anything scripting keys pauses after Esc (gate 5H) |
| Tab | toggle keyboard focus between the side panel's menu and the Grid (arriving on the Grid in plain navigation, nothing armed); does nothing while a popup is open | **Gate 5F, owner-requested 2026-09-26.** This row previously read "jump the cursor to the player's next / previous own structure" — GUIDANCE, never built, now retired from Tab (Q53 keeps the idea for another key). **Focus is its own state beside `armed`**, and the rule above holds: a structure is armed only while the Grid has focus, and finishing returns focus to where it began (Q57, answered 2026-09-27, refined 2026-09-29). **Convention 1 below applies: the bottom line's hint is written for where focus is**, because focus makes arrows mean two things |
| Backspace, Delete | on the Grid: remove the planned, uncommitted placement under the cursor | plans are revisable until commit (Milestone 5). The Mac key labelled "delete" sends Backspace, so it cannot also return focus to the menu, as the owner's first sketch of the focus toggle had it — Esc does (Q57). On the menu, where the cursor is hidden, it is refused: the row flickers, as Left and Right do |
| `u` | undo the last planned placement | |
| `s`, `p` | Start Nexus Pulse — the menu's last row, `[s] Start Pulse`; `p`, its first key, still works | moves focus to the menu and opens the Battle Round screen, where Enter, Space or `s` again start it and Esc goes back (gate 6A, feedback F47-F50); the one action that must not fire by accident. Refused while a dealt Nexus power is still waiting to be picked |
| `n` | open the Nexus powers popup — the menu's `[n] Nexus` entry | pressed again inside the popup, closes it |
| `e` | Explore Map — the menu's first entry, `[e] Explore Map`: focus to the Grid with nothing armed, the side panel describing what is under the cursor as it moves (9.2). Opened from the menu, the cursor first moves to clear ground by the arming rule for a one-tile footprint (F66, canon 2.28); opened from the map it stays | added 2026-09-27 (owner: "Pressing [e] changes the focus to the map in navigation mode"); first, renamed and self-explaining at gate 5J (feedback F23); a toggle, its row drawn active while open, since gate 5K (F32). Tab arrives in plain navigation instead |
| `q` | open the game menu | never quits outright, so a stray press cannot lose a plan; only the game menu's own `[q]` (or Enter or a click on its Quit row) quits. The top bar's `menu [esc]` is Esc, which on the menu opens it (gate 5J, owner: "When pressing [esc] or explicitly opening the main menu, there should be an option for '[s] Settings' along with '[q] Quit'") |
| Ctrl+C | quit at once | the one immediate way out, from anywhere |
| `?` | the **Controls and hotkeys** page — every key and click, grouped by where the player is; also the game menu's `[c]` row | built at canon 2.27 (owner, 2026-09-30, feedback F60: "an option for 'Controls and hotkeys' that opens a section that explains how to use the keyboard, hotkeys and mouse clicks. This will be enough for offering help"). One scrolling popup, from one table (`src/build/help.ts`); opened from the game menu, Esc goes back to it; opened with `?`, Esc closes it |
| `q`, Space, `.`, `,`, `[`, `]`, `r` | unchanged from `grid` during a Pulse: quit, pause, step, speed, restart | one keymap across `grid` and `terminal-nexus` |
| Mouse: click a menu row | **activate at once**, whatever had focus: arm the building (its preview at the cursor when it fits there, else at the nearest good spot (the arming rule above); what a row click starts returns to the menu), open the Nexus powers, or open Explore Map — the row's hotkey. While a card covers the menu (Explore Map, or a building being placed), a click on the panel only gives the menu back | owner, 2026-09-28 (feedback F22), reversing 2026-09-27's highlight-first: "The selected state only makes sense when using the keyboard, but using the mouse should activate what is being clicked." After the mouse works the menu no highlight bar is drawn; the first menu key only shows it again, on the row it remembers. An armed row is marked as armed (`[x] … >>`, underlined), never with the keyboard's bar. The whole row is the target, the width its highlight bar is drawn |
| Mouse: click a Grid tile | move focus to the Grid and the cursor to the tile, the armed preview with it; **a second click on the same tile places it, and so does a quick double click on the same spot** (3.3). With nothing armed it only moves the cursor: in Explore Map the panel follows it; from the menu, the menu stays drawn beside the map | Q52, reversing Q50 — the terminal caveats below have the reasoning. A click near an edge scrolls in proportion, armed or not (3.3, Q62, F22). A `Shift+click` to place in one click is still planned |
| Mouse: click outside an open popup | close the popup and move focus to where the click landed — and nothing more | a dismissing click never also places, picks or activates (owner, 2026-09-27: he clicked Nexus, missed the popup in the middle of the screen, and thought the mouse was broken). A click on the top bar's `close [esc]` goes back one level, as Esc does, where a click outside closes every popup at once; a click on one of its options chooses it |
| Mouse: click the top bar's right end | Esc — the `cancel` command, one level back | the right end names what Esc does now: `menu [esc]` on the menu (or a committed Build Phase), `back [esc]` while the Grid has focus, `close [esc]` while a popup is open (owner, 2026-09-29, feedback F37: "we can reverse the title and hotkey for some actions that navigate 'back'"). It is the one place Esc is named on screen |
| Mouse: wheel | **move the cursor five tiles**; the camera follows it, as it follows every other cursor move | the mouse's Shift+Arrow, literally. An independent camera would be the separate pan mode 3.3 forbids, and would strand the cursor off screen (gate 5A). Inside a popup, the wheel walks its list |
| Mouse: right click | `x` — go back one level, never opening the game menu | the RTS convention for "cancel"; since canon 2.28 (F62) it is `x`, not Esc, so a stray right click cannot open a menu |

**Letters are spoken for before they are built**, so a new binding does not collide with a planned
one: `d` opens Settings at its Experiments, and `m` is kept for a whole-map popup (Q59); inside
their own popups `s` is Settings (the game menu) and `e` is Export (Settings) — outside them `e` is
still Explore Map. The
entries above the construct groups get **letters**, never digits — a digit would renumber every
construct row beneath it, which is exactly what one digit sequence per menu (the first row of the
table above) exists to prevent: `[e] Explore Map` and `[n] Nexus`. Inside the game menu `c` is
Controls and hotkeys. `p`, `q`, `s`, `u` and `x` are taken.

Three conventions behind that table, so a retune keeps them:

1. **No modes but focus.** A key means one thing on a screen. Digits always address the list,
   letters always name commands, from either focus. That is why `h`/`j`/`k`/`l` are *not* cursor
   aliases even though a terminal audience expects them: letters belong to the hotkey vocabulary, and
   a modal cursor is the classic source of "why is my key not working." The one exception is the one
   this convention always allowed: a panel that genuinely needs arrow keys of its own (the menu, since
   gate 5F) takes them through keyboard focus, so arrows and Enter/Space — and nothing else — follow
   focus, Tab moves it, and the bottom line's hint is written for where it is (9.2).
2. **The screen documents itself.** The bottom line says what can be done where the keyboard is, the
   Controls and hotkeys page (`?`, or the game menu's `[c]`) carries every key and click, and every
   menu row carries its own. Nothing is discoverable only from a manual.
3. **Standards over cleverness.** Enter confirms, Esc cancels, `?` helps, digits pick, wheel scrolls,
   right-click cancels. A player who has used a terminal editor, a roguelike, or an RTS should guess
   the first key right.

**The Nexus power pick is a popup the player opens, not a screen forced on them — GUIDANCE, revised
2026-09-26, gate 5F.** Gate 5D built the pick as its own full-screen step that opens the Build Phase
and blocks everything else until answered. The owner's own later playtest asked for something
friendlier: a "Nexus (1)" entry — the count is the number of picks waiting — as **the top
entry of the side panel's menu**, that opens a popup **in the middle of the screen** only when the
player actively selects it, never forced open the instant the Build Phase begins; inside it they make
a pending pick by keyboard or mouse, read what each power does, and review the ones already active.
The popup is the first thing the game draws **over** the Grid pane, holding the keyboard and the
mouse until it closes. The start-the-Pulse question and the exit question became popups too, so with
three real uses the shape was extracted at gate 5F's second round (the one popup shape of 9.2); the
Settings popup (below) is the fourth. **The popup closes on the pick — GUIDANCE, canon 2.21**
(owner, 2026-09-27, answering Q60): open, pick, and the player is back on the menu; the status line
and the entry's "1 active" confirm it, and reopening the popup lists the pick as active. Esc, `n` or
a click outside close it without a pick. The entry itself is `[n] Nexus`, with the number of picks
waiting after its name — "(1)" — in the hotkey's colour. The owner scoped it to the interface ("only build the UI for now"): the powers
behind it stay gate 5D's two placeholders until Milestone 8. **A dealt Nexus power still may not
be skipped** (`commander-armies.md` Section 4.5, unchanged) — but where that gets enforced has to move
for the popup to actually feel optional. Gate 5D refused every state-changing command with "Pick a
Nexus power first" the instant a pick was outstanding, which was exactly right for a forced full
screen but would make an *optional* popup feel just as forced — every other action would still nag
until it was opened. Gate 5F narrowed the check to the one place the invariant actually has to hold:
only the commit itself (`p`, and its confirmation) is refused while a pick is outstanding, and arming,
placing, undoing and removing proceed freely regardless (`commitLock` in `src/build/state.ts`).
Nothing about the invariant's own guarantee changes — the Build Phase still cannot
end without a pick — only where the refusal fires.

**Two related ideas from the same feedback, each with a gate now** (Q55): a **smart cursor** (built at gate 5F, replaced at gate 5K by arming where the cursor is, above) that,
when a structure is armed from the menu and focus moves to the Grid, puts the cursor on the nearest
tile where it can legally go — toward the centre of the map, aligned with what is already planned and
leaving one tile free between structures — in practice one tile beside the last thing planned,
aligned with it — so the owner's "down, down, space, place, space, place" lays out a tidy row without
the arrow keys: each placement returns to the menu on the same row, and Space arms it again beside
the one just placed (gate 5F, with the focus it belongs to; it is a deterministic rule of the
plan, so the reducer can own it); and **a frame timer** for the Grid pane (built at gate 5H), so camera and cursor moves
can ease toward their target over a few frames instead of jumping — the same "presentation may
interpolate without changing simulation" latitude Section 1 already grants, on a screen that has
only ever redrawn once per input event (`src/cli/spike.ts`'s `render()`) (gate 5H).

**Settings and Experiments — GUIDANCE, gate 5G as Debug Mode, gate 5J as Settings** (owner
direction, 2026-09-26 and 2026-09-28: "Let's solidify this as Settings"). The game menu's
`[s] Settings` is one scrolling popup, the same shape as every other, **in titled sections with a blank
line before each** (F85): Display — **the player's own settings**, background (dark or light), colour
depth, symbols, reduced motion, which apply at once and are saved through the same store as the title
menu's Settings — then Keyboard navigation, Effects and the placeholder Pulse, whose rows are
**Experiments**: live-editable playtest settings — a step size, a timing, a look — so the owner can try
an idea during a playtest instead of asking for a new command-line flag and a rebuild. **Every setting is
declared once with its tier** — player, experiment, or tuned (a constant in code, not shown) — and its
section, label, question, values and default (`src/build/all-settings.ts`); moving one between tiers or
sections is a one-word edit, and code reads any setting through one lookup that does not care which tier
it is on. A row is a name and a value; one that only takes effect when the
Build Phase starts over says so on the status line when changed and, when Settings closes with such a
change pending, once in a message popup (F34). **Every Experiment names the question it serves and is normally deleted before its pull
request is accepted**, a few staying longer or graduating into real settings; they are Build Phase
state, per session, **never saved**, because their defaults change from build to build. The reducer
reads those that change what a command does, the input path and the live loop read the timing ones,
and the game menu's `[r] Restart` starts the Build Phase over keeping every setting and experiment. `d` opens
Settings at the first Experiment (Keyboard navigation's). A row shows its value between `<` and `>`, Left/Right change it,
and each half of the value box is a click target; the title says where the highlight is
(`SETTINGS (5/20)`, counting only rows the keyboard can be on; headings and blank lines are never rows), the list keeps it in view with a scroll bar in the right border, and what the
highlighted row is for is written under a line below the list (F35). **Export settings** — the list's
last row, and `[e]` from anywhere in it — shows every setting and
experiment as `name = value` text — the experiments that differ from this build's defaults first,
each with the default it replaced, then the settings, then the rest, with the build's commit near the
top — so the owner can paste what felt right into a pull request comment. The adapter, never the
reducer, also copies it to the clipboard (OSC 52 in a terminal, the clipboard API on the browser page)
and saves it to a file beside the settings. `--settings "<text>"` (the terminal game and the scripted
playtest) and `#settings=` (the browser page) read it back, skipping an unknown name or a bad value
one at a time, so an agent sees exactly what the owner saw. An old export's names are read by the tier
each setting is on now: a settled one is skipped quietly, a renamed one is read as its new name. It replaced the one-flag-at-a-time
`--scroll-margin`/`--edge-style` pattern of gates 5A-5C, and gate 5G's `[d] debug` popup, as the way
this project shows the owner two answers side by side. The title menu's Settings screen has the
player settings only.

**Terminal caveats, verified rather than assumed** (Q37; measured by gate 5A on 2026-09-21,
`docs/history/reports/2026-09-21-scrolling-and-placement.md` Section 4.1 has the table and the ten terminals it could *not* test):

- **Modified arrows are not universal, and not single-valued.** Measured: xterm, xterm-256color,
  tmux and tmux-256color send `CSI 1;2A` and its siblings; rxvt and rxvt-unicode send a completely
  different, shorter form (`CSI a`/`b`/`c`/`d`); and **screen, screen-256color, the Linux virtual
  console, vt100, vt220 and ansi define no shifted arrow at all** — on those, Shift+Up is simply Up.
  Both families are bound, and the modifier-free fallback above is required rather than a courtesy.
  PageUp and PageDown exist on every terminal description surveyed except vt100 and ansi, which
  makes them better supported than the binding this table recommends first. Both are displayed.
  **An emulator this project has not measured is not a supported one**: PuTTY, Alacritty, kitty,
  WezTerm, Ghostty, iTerm2, the GNOME/VTE family, Windows Terminal, Konsole and foot are all
  untested, and their own documentation is not evidence this project has gathered. The owner plays
  in **iTerm2 on macOS**, which makes it the first one worth measuring: `node scripts/lib/key-echo.mjs`
  run there, with Shift, Option and plain arrows pressed in turn, settles what this table only
  assumes about it.
- **Mouse reporting is opt-in and must be undone.** A terminal reports the mouse only after the
  program asks (SGR extended mode, `1006`, over `1000`/`1002`); the disposer of 10.1 switches it off
  on every exit path. A game that leaves mouse reporting on is rejected for the same reason as one
  that leaves raw mode on. Where no mouse arrives — a plain SSH session, the driver, a non-TTY —
  nothing is lost, because the keyboard is complete.
- **Key events — GUIDANCE, canon 2.29** (the owner's third round on the menu spike, F79: "We should
  enable/disable reading key-press in the settings, so I can test how it feels when the system provides
  it vs when it does not"). With the Key releases Experiment on `auto`, the Build Phase asks the terminal
  for the kitty keyboard protocol (`CSI ? u`, then Device Attributes, which every terminal answers) and,
  if it answers, switches it on (flags 1 + 2: disambiguate, report event types). **10.1's one disposer
  switches it off again on every exit path**, before leaving the alternate screen. With the protocol on,
  a press is a tap, a repeat belongs to a hold and a release ends it at once; Esc arrives whole (no
  wait); Ctrl+C arrives as `CSI 99;5u` and still quits at once; keypad keys are read as the keys they
  stand for. A release sends no command. Where the terminal does not answer, or with the Experiment
  off, a press within the hold window of the one before is a repeat (3.3). The browser page behaves the
  same way from the browser's own key-down and key-up events. Only how a repeat is recognised differs,
  never where the cursor goes; a test holds that (`src/view/key-events.ts`).
- **A second click on the same tile places the armed structure — RULE, revised** (Q52, 2026-09-26,
  reversing Q50's 2026-09-21 decision — see `open-questions.md` for both). A first click on a tile
  only moves the cursor there and shows the armed preview, the same as arriving there by arrow keys;
  a second click **on that same tile** is what commits the placement. This deliberately reopens the
  asymmetry Q50's own writeup found and rejected at the time — a first click within the scroll margin
  can slide the Grid under the pointer, so a second click at the same *screen position* can land on a
  different *tile* — but it is safe this time for the reason it was not safe as a toggle: the check is
  on tile identity, never on screen position, so a camera-shifted second click is correctly read as a
  fresh first click on a new tile (one more click confirms it), not a placement on the wrong one. A
  later `Shift+click` is planned as a one-click escape hatch for a proficient player who wants the old
  behaviour back; not built yet. Keyboard placement (Enter, and now Space) is unaffected and stays a
  single press, which already asks for two deliberate actions (arm, then place) the way a first click
  now also does. A camera-shifted second click is safe but still a surprise — the player clicked the
  same spot twice and nothing was placed — and a wider scroll margin (Q54) makes it common, which is
  why Q58 recommends that an armed click never scroll the view at all.
  **What still makes any of this safe is that a plan is revisable** — undo, remove-under-cursor, and
  nothing committed until the commit key. If a future Build Phase action is genuinely irreversible,
  confirmation belongs on that one action, never back on every click.
- **The tile just built on never reads as a refusal — RULE** (2026-09-26 owner playtest). The
  moment after a structure is placed, the tile under the cursor is occupied by that same structure;
  a preview that redrew its normal legality check there would report the tile as taken and show the
  illegal-placement block on top of what the player had just correctly built, reading as a failure.
  Gate 5E answered it with a special case: the just-placed tile absorbed a repeated place command
  until the cursor moved, with the structure still armed. **Since canon 2.21 it holds by
  construction instead**: every placement disarms and returns focus to the menu (the menu
  orchestrates, above), so no ghost is left on the Grid to recheck the tile, and the status line
  reports the success — `Barracks placed (resources: 60) - [u] undo`. The special case is gone with
  the armed state it existed for; the rule it protected, no false refusal over a correct placement,
  is unchanged and still tested.

---
