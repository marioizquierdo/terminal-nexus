# Gate report — Milestone 5, Gate 5A: the scrolling-and-placement spike

**Document role:** Gate evidence report for Gate 5A
**Status:** BUILT — Section 8 concludes PASS on every automated check; the two questions only the owner can answer (Section 5) are outstanding
**Canon version:** 2.16
**Updated:** 2026-09-21
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.16.
- **Milestone and gate:** Milestone 5 — Build Phase; Gate 5A (the scrolling-and-placement spike).
  Milestone 3 was accepted by Mario on 2026-09-21 and Milestone 5 promoted to CURRENT the same day;
  this is its first gate, and the milestone's own text says the spike runs *before* the real Build
  Phase gets built.
- **Question this gate answers:** Do the two interactions Mario singled out as needing the most
  attention — moving around a map bigger than the screen, and placing a chosen building on it —
  actually hold up when you drive them, by keyboard, by mouse, and from a script, on both the
  smallest and the largest screen the game supports? And which of the keys the design assumed does a
  real terminal quietly fail to deliver?
- **Smallest artifact that can answer it:** one interactive screen, reachable from the game's own
  menu, that does exactly those two things and nothing else:
  - a Grid deliberately larger than any viewport the game will ever show (96 × 40 tiles, against a
    largest-ever viewport of 72 × 24), so scrolling is unavoidable rather than optional;
  - a cursor moved by the arrow keys, which drags the camera with it once it comes within three
    tiles of an edge — the rule the canon has stated since before Gate 1A and nothing has ever
    executed, because Gate 1A deliberately used a Grid that fit the screen whole;
  - a short list of buildings, each showing its own key, armed by pressing that key or clicking the
    row, placed at the cursor with Enter or a click on a tile, staying armed afterwards so a run of
    them is one key then arrows and Enter;
  - a legality check strict enough that placing on rock, off the map, or on top of something already
    there is refused with a short reason — enough to make placement feel real. The full side panel
    that explains *why* in the Build Phase proper is gate 5B's, not this one's;
  - the same screen driven three ways: real keystrokes, real mouse bytes, and a scripted list of
    commands, with a test proving the three produce the identical plan and the identical screen;
  - **a toggle, not an argument, for the click question.** One key flips between "a click places it
    immediately" and "a click moves the cursor there and a second click confirms." Both behaviours
    ship, the current one is named on screen, and Mario picks by trying them.
- **Automated evidence planned:**
  - the camera arithmetic, on its own: the three-tile margin honoured at every cursor position, the
    camera never leaving the Grid, the viewport clamped to between 48 × 16 and 72 × 24 tiles no
    matter how large the terminal is, and the resize gate below 80 × 24;
  - the same plan entered three ways — raw keystrokes, raw mouse bytes, and a command script —
    producing byte-identical planned placements and byte-identical frames;
  - placement legality: off the Grid, on rock, and overlapping something already placed are each
    refused with their own reason, and nothing is ever silently moved to a legal tile instead;
  - the screen composed at the viewport's minimum (80 × 24) and maximum (104 × 32) terminal size,
    asserting that the edge markers appear on exactly the sides with more Grid beyond them and that
    the footer's position readout names the visible tile range;
  - the whole existing suite staying green on both runtimes, including the Bun run, since new files
    are involved;
  - **a real-terminal survey of the modified arrow keys**, driven through tmux into a raw-mode
    reader that prints the bytes it actually received, cross-checked against what each terminal's own
    terminfo entry claims it sends. Measured, not remembered.
- **Human observation planned:** Mario, on two questions only. First: does scrolling feel like
  looking around the map, or like fighting the cursor? Second: which click behaviour does he want —
  place on the first click, or confirm on a second? Both are feel questions no test can answer, which
  is why the second one ships as a toggle rather than a decision. Screenshots at both terminal sizes
  go in `evidence/screenshots/` either way.
- **Explicit exclusions:**
  - the real Build Phase. No costs or spending, no two-group construct menu, no legality *panel*, no
    Nexus upgrade draft, no Special slot, no commit key and no confirmation — those are gates 5B, 5C
    and 5D, and this gate is explicitly the thing that runs before them;
  - the adaptive side-panel layout across the size range (gate 5C). The spike's panel is a fixed
    30 columns at every size, which is what the canon's own arithmetic already assumes;
  - anything that touches the simulation. Nothing here spends a tick, runs a Pulse, or writes to
    match state; a planned placement is a plan on a screen and never reaches the kernel;
  - PERIMETER's own map, budget or content. The spike's map is a throwaway sized to force scrolling;
  - saving anything. The spike keeps nothing between runs;
  - retuning `engine.md` 9.7's key bindings in the canon itself. The gate *reports* what the
    measurement says; changing canon waits for Mario to accept the gate.
- **Stop conditions:**
  - if the three-tile margin rule turns out to be unimplementable as stated — for instance if
    honouring it at the Grid's own edges requires the camera to leave the Grid — that is a RULE in
    tension with itself and a question for Mario, not something to quietly redefine;
  - if the mouse wheel cannot be made to scroll without introducing a second, independent camera that
    the cursor does not drive. The canon says both "the wheel scrolls the camera" and "the cursor
    drives it, no separate pan mode"; if those cannot both be true, the spike stops and says so
    rather than picking one silently;
  - if no modifier-free fallback for the five-tile jump survives contact with a real terminal, the
    gate reports that the fast pan has no portable binding rather than shipping one that only works
    on the machine it was written on.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Ubuntu 24.04.4 LTS (container), x86_64 |
| Runtime and exact version | Node v22.22.2; Bun 1.3.11 |
| Dependencies and exact versions | `@opentui/core@0.5.6`, `typescript@7.0.2`, `@types/node@22.20.1` — unchanged by this gate |
| Terminal tooling for the survey | tmux 3.4; ncurses `infocmp` 6.4; Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (a renderer for the screenshots, nothing more) |
| Hardware, if it affects measurements | Not applicable — nothing here is timed |
| Date measured | 2026-09-21 |

Commands, copy-pasteable, in the order a stranger would run them:

```bash
# install
npm install

# build — there is no build step; both runtimes execute the TypeScript sources directly

# test
npm run typecheck
npm test
npm run test:bun

# run — the spike itself. Section 7 records why this is a flag rather than a menu row.
./bin/terminal-nexus.ts --spike
./bin/terminal-nexus.ts --spike --capability monochrome
./bin/terminal-nexus.ts --spike --scroll-margin 5      # the one tuning number, to feel against 3

# the pre-merge review that found the dead `t` binding still printed in the footer
# (Milestone 3B's own lesson: every automated check passed before it ran)

# the modified-arrow-key survey: what terminals claim, and what one actually delivers
node scripts/probe-modified-keys.mjs

# real-terminal screenshots, at every terminal size that means something
node scripts/capture-spike-screenshots.mjs
node scripts/capture-spike-screenshots.mjs --only spike-minimum
```

Two lines of Section 1 above stopped being true while the work happened, and are left standing
rather than quietly edited, because a frame rewritten to match what got built is worth nothing.
Section 7 records both: the screen is reached by a flag rather than from the menu, and the scroll
margin became a parameter that Section 1 did not plan for.

## 3. What was built

One screen, reachable with `./bin/terminal-nexus.ts --spike`, and the small pile of pure code under
it. What exists now that did not before:

**The map camera** (`src/build/camera.ts`). The arithmetic of the viewport rule, which has been
written down since before the first line of the kernel existed and executed by nothing: how many
tiles a terminal of a given size has room for, whether one tile is drawn in one terminal column or
two, whether the terminal is below the floor and should show a resize notice instead, and — the
whole interaction — where the camera goes when the cursor moves. Pure arithmetic over tiles: no
terminal, no frame, no cells, which is what lets the entire scrolling rule be checked without a
terminal at all.

**The screen's state, as one pure function** (`src/build/state.ts`). A command in, the next state
out. It holds the cursor, the camera, which structure is armed, what has been planned, and which of
the two click behaviours is live. It also holds the legality check: a placement that would hang off
the map, sit on rock, or overlap something is refused with a short reason, and nothing is moved to
make it fit.

**The three ways in** (`src/build/keyboard.ts`, `mouse.ts`, `session.ts`). Keys, mouse bytes and a
scripted list of commands, all producing the same named commands, with the session object being the
real dispatch that a live terminal uses — not a parallel copy written for tests. The construct menu
reuses the menu-row shape, the hit-testing and the `[1] Barracks` label format the game menu already
had, rather than growing a second list widget.

**The frame** (`src/view/build.ts`). The Build Phase composition, drawn for the first time: a map
pane showing a window onto a map larger than itself, a 30-column side panel, markers on the frame's
border for each side with more map beyond it, and a footer naming the visible tile range. Plus the
placement preview — the armed structure's own glyphs under the cursor when it would be legal there,
a block of `x` when it would not.

**The map itself** (`src/build/catalog.ts`): 96 x 40 tiles, which is larger than the biggest viewport
the game will ever show, so scrolling is unavoidable rather than optional. Built by a function rather
than checked in as a scenario file, because a scenario file is simulation input and every one of them
is replayed twenty times by the determinism suite — this map never reaches the simulation at all.

**The terminal survey** (`scripts/probe-modified-keys.mjs`, `scripts/lib/key-echo.mjs`) and
**ten real-terminal screenshots** (`scripts/capture-spike-screenshots.mjs`).

Two things moved rather than appeared. `src/view/draw.ts` is the pair of helpers that put a glyph or
a string into the frame; the Pulse view and the menu each had their own copy, and this screen would
have been the third, so they were extracted and both existing callers switched over. And the
repository's ignore list stopped hiding `src/build/` — see Section 7, which is where that belongs.

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| Whole suite, Node 22.22.2 | 332 pass, 0 fail | `npm test` |
| Whole suite, Bun 1.3.11 | 331 pass, 0 fail across 31 files | `npm run test:bun` |
| Type checking, strict | clean | `npm run typecheck` |
| Canon invariants | pass | `./scripts/check-repository.sh` |
| This gate's own tests | 53 pass | `node --test tests/build-{camera,spike,view,lifecycle}.test.ts` |
| Minimum viewport needs exactly 80 x 24; maximum exactly 104 x 32 | holds | `tests/build-camera.test.ts`, `engine-3.3-clamp` |
| A terminal of any size shows at most 72 x 24 tiles | holds, checked at 400 x 120 | same file |
| One column per tile below 128 columns, two at 128 and above | holds | `engine-9.3-tile-width` |
| Below 80 x 24 the screen gates; a map smaller than the viewport never gates | holds | `engine-3.3-gate` |
| The cursor keeps its three-tile margin, checked at every one of the 3,840 tiles of the map | holds | `engine-3.3-scroll`, exhaustive walk |
| …and at every viewport width from 48 to 72, at three heights | holds | same file |
| The camera never leaves the map, and the cursor is never off screen | holds | same two tests |
| Edge markers name exactly the sides with more map, and none when it all fits | holds | `engine-3.3-markers` |
| The footer names the visible range and the map's size | holds | `tests/build-view.test.ts`, `engine-3.3-readout` |
| The same plan by raw keys, by raw mouse bytes and from a script: identical state and identical frame | holds | `tests/build-spike.test.ts` |
| A click on a construct row does exactly what its digit does | holds | same file |
| An illegal placement is refused with its own reason and nothing is moved to fit | holds, for off-map, rock, a standing structure and a planned one | same file |
| The armed structure stays armed after placing | holds | same file |
| Shift+Arrow (two encodings), PageUp/PageDown and all four spellings of Home/End each jump five tiles | holds | same file |
| Two keys in one chunk are two keys | holds | same file |
| Every capability tier puts identical glyphs on screen | holds | `tests/build-view.test.ts` |
| Every glyph is one cell wide, at three terminal sizes in both glyph packs | holds | same file |
| `q`, an interrupt byte, Esc, SIGINT and SIGTERM all reach one disposer; raw mode, the alternate screen and mouse reporting all off after each | holds | `tests/build-lifecycle.test.ts` |
| Resizing below the floor gates and back above it restores the screen at the same cursor | holds | same file |
| No raw escape byte reached a source file | holds | `grep -rlP '\x1b' src tests scripts` returns nothing |
| The footer never names a key the keyboard adapter does not bind | holds, checked on the widest composition | `tests/build-view.test.ts` — added after the review found `t click mode` surviving the toggle's deletion |
| No header or footer line is cut off at the 80-column floor | holds | same file |
| The scroll margin the header prints is the one the camera follows at | holds at 2 and 5 | same file |

### 4.1 The modified-arrow survey

`node scripts/probe-modified-keys.mjs`, measured 2026-09-21 on this machine. **Leg one** is what each
terminal description installed here claims it sends, read out of its own terminfo entry — this covers
terminals nobody here can run. **Leg two** drives a real pseudo-terminal and reports what actually
arrived.

| Terminal | Shift+Up | Shift+Down | Shift+Left | Shift+Right | PageUp | PageDown | Home | End |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| xterm | `ESC [1;2A` | `ESC [1;2B` | `ESC [1;2D` | `ESC [1;2C` | `ESC [5~` | `ESC [6~` | `ESC OH` | `ESC OF` |
| xterm-256color | `ESC [1;2A` | `ESC [1;2B` | `ESC [1;2D` | `ESC [1;2C` | `ESC [5~` | `ESC [6~` | `ESC OH` | `ESC OF` |
| tmux, tmux-256color | `ESC [1;2A` | `ESC [1;2B` | `ESC [1;2D` | `ESC [1;2C` | `ESC [5~` | `ESC [6~` | `ESC [1~` | `ESC [4~` |
| rxvt, rxvt-unicode-256color | `ESC [a` | `ESC [b` | `ESC [d` | `ESC [c` | `ESC [5~` | `ESC [6~` | `ESC [7~` | `ESC [8~` |
| screen, screen-256color | **none** | **none** | **none** | **none** | `ESC [5~` | `ESC [6~` | `ESC [1~` | `ESC [4~` |
| linux (the Linux virtual console) | **none** | **none** | **none** | **none** | `ESC [5~` | `ESC [6~` | `ESC [1~` | `ESC [4~` |
| vt220 | **none** | **none** | **none** | **none** | `ESC [5~` | `ESC [6~` | **none** | **none** |
| vt100 | **none** | **none** | **none** | **none** | **none** | **none** | **none** | **none** |
| ansi | **none** | **none** | **none** | **none** | **none** | **none** | `ESC [H` | **none** |

**Not surveyed, because no terminal description for them is installed on this machine, and this gate
does not guess:** PuTTY, Alacritty, kitty, WezTerm, Ghostty, iTerm2, the GNOME/VTE family, Windows
Terminal, Konsole, foot. Their own documentation is not evidence this project has gathered, and
`AGENTS.md` Section 5 is explicit that an untested platform is not a supported one.

Leg two, on a real pseudo-terminal — tmux 3.4, default configuration, no `tmux.conf`, keys sent by
name and read back off a raw-mode echo:

| Pressed | Delivered |
| --- | --- |
| Up | `ESC [ A` |
| Shift+Up / Down / Left / Right | `ESC [ 1 ; 2 A` / `B` / `D` / `C` |
| PageUp / PageDown | `ESC [ 5 ~` / `ESC [ 6 ~` |
| Home / End | `ESC [ 1 ~` / `ESC [ 4 ~` |
| Ctrl+Up | `ESC [ 1 ; 5 A` |

And end to end, in the real screen rather than in a test: `evidence/screenshots/spike-scrolled.png`
was produced by sending four Shift+Rights and four PageDowns through tmux into the running program,
and its footer reads `cursor 38,33` — twenty tiles east and twenty south of where it started, which
is four five-tile jumps on each axis.

## 5. Human observations

**Mario looked at it on 2026-09-21 and answered both questions this gate exists to ask.** In his own
words: *"ill confirm scroll margin later, default 3 for now seen right. Click to place looks good to
me too. We can always implement undo or destroy later, for now this is good."*

1. **Does scrolling feel like looking around the map, or like fighting the cursor?** Three tiles
   reads right to him, with a full confirmation deferred. So the margin is unchanged, and
   `--scroll-margin` stays on the command line rather than being hard-coded back down — the thing
   that lets him settle it later is the ability to feel another number against this one.
2. **Which click behaviour should the game keep?** *"Click to place looks good to me."* Answered as
   Q50, and the toggle is deleted rather than kept as a setting, which is what that row's own
   recommendation said to do once he had looked. Section 7 records what removing it turned up.

One thing his answer assumed that is already true: undo and destroy exist. `u` undoes the last
placement and Backspace removes whatever is under the cursor, both built in this gate, both on the
panel. They are also the reason placing on a single click is safe at all, so they were never
optional here.

**Still not observed, and not claimed:** nobody has played a *Build Phase*, because there is not one
yet — no costs, no upgrade pick, no commit. Whether the whole thing hangs together as a phase is
Milestone 6's question, not this one's.

Ten screenshots are in `evidence/screenshots/spike-*.png`, each captured from a real terminal at the
size it is about. An eleventh showed the click-then-confirm mode and was deleted with it.

## 6. Interpretation

**The viewport rule survived contact, and it did not need changing.** That is the least dramatic
possible outcome and the most valuable one: a rule written years before anything could run it turned
out to be implementable exactly as stated, including the three-tile margin, the clamp at both ends,
and the "spend extra terminal space on centring, never on more map" clause. The one place it looked
self-contradictory — what happens to the margin at the map's own edge — dissolves on contact. The
margin is a rule about where the camera follows the cursor *to*, not an invariant about where the
cursor may be; at the edge of the map the camera has nowhere left to go, and the cursor correctly
reaches the edge of the screen, because there is no more map to reveal by scrolling further. The
exhaustive test walks all 3,840 tiles and states the exception as "the camera is already as far as
it can scroll", which is checkable, rather than as "sometimes", which is not.

**Shift+Arrow was the right thing to be suspicious about.** The canon flagged it as the one keymap
assumption a terminal can silently break, and the survey shows it breaking in two different ways at
once: some terminals send nothing at all (`screen`, the Linux console, and the whole vt lineage), and
rxvt sends something completely different from xterm's. Either one alone would have produced a game
where the fast pan silently does nothing on some machines and nobody could say why. The fallback
matters more than it looked: PageUp and PageDown exist on every terminal description surveyed except
vt100 and ansi, which makes them a better-supported binding than the one the canon recommends first.

**The wheel forced a real decision, and the canon answers it if you read both halves.** The input
model's binding table says the wheel scrolls the camera; the viewport rule says the cursor drives the
camera and there is no separate pan mode. A wheel with a camera of its own would be exactly that pan
mode, and would leave the cursor stranded off screen. The reading that keeps both true is the one the
table's own gloss already points at — "the mouse's Shift+Arrow" — so the wheel jumps the *cursor*
five tiles and the camera follows. This is a GUIDANCE departure in letter and an agreement in spirit,
and Section 9 proposes the wording change.

**Deleting the toggle after the answer found a live bug the tests could not.** With Q50 answered, the
`t` binding came out of the keyboard adapter and a new test asserted it now means nothing. It did —
and the footer went on printing `t click mode` anyway, because the bindings line appends its optional
extras only while they fit, so the dead key appeared at 142 columns and wider and nowhere narrower.
Every screenshot in this gate is at 80, 104 or 128 columns, so nothing looked at it. A pre-merge
review over the whole diff caught it (Milestone 3B's own lesson, applied). Fixed, and the test that
should have caught it now composes the frame at its widest and checks **every** key the footer names
against the real adapter, rather than checking the adapter alone. The general shape is worth keeping:
**a test that a binding is dead is not a test that the screen stopped advertising it.**

**Click-then-confirm is worse than it looks, for a reason nobody could have argued from a document.**
A click moves the cursor; moving the cursor scrolls the map; so a first click near the edge of the
screen slides the whole map under the pointer, and the second click at the same place lands on the
neighbouring tile and places there without complaint. Pressing Enter instead is unaffected and the
screen says so, but "click the same place twice" is the gesture the mode is named for. This is
precisely what the canon meant by making a feel decision observable instead of arguing about it: the
toggle did not settle a matter of taste, it exposed a structural interaction between two features
that were specified separately. The recommendation is to keep placing on the first click, and Q50
puts it to Mario with the finding attached.

**On the fourth decision channel** (the milestone asks each of its gates to notice whether a Build
Phase feels short of one): nothing to report yet, and it would be dishonest to claim otherwise. This
screen has one channel — placement — and no upgrade pick, no Special, and no costs. Gate 5D and
Milestone 6 are where that question can actually be felt.

**What is deliberately still missing**, so the next session does not mistake this for a Build Phase:
no costs or spending, no two-group construct menu, no legality *panel* (the reason appears as one
footer line), no upgrade draft, no Special slot, no commit key, and no adaptive side-panel layout —
the panel is a fixed 30 columns and its blocks stay at the top of a tall screen rather than spreading
out. Those are gates 5B, 5C and 5D, and this gate ran first on purpose.

## 7. Failures, surprises, and discarded approaches

**The repository's ignore list swallowed the whole module.** `.gitignore` carried an unanchored
`build/`, meant for build output at the root. Git matches an unanchored directory pattern at any
depth, so the moment `src/build/` existed, all eight of its files were invisible: the commit went
through, the working tree was clean, and every test passed — because the files were still on disk.
A fresh clone would have failed to start. Caught by reading the commit's own file list rather than by
any check. The rule is now `/build/`, anchored, with a comment saying why. **The general lesson: a
commit that succeeds is not evidence that the files are in it**, and a module directory whose name
collides with a conventional build-output name is worth a second look before pushing.

**The first placement test failed, and the test was right.** Click-then-confirm, driven by clicking
the same screen cell twice, placed nothing. The instinct was to fix the test's click coordinates. The
actual cause is the finding in Section 6: the first click had scrolled the map. The behaviour is now
pinned by a test that states it in full, so it cannot change silently, and it became the strongest
piece of evidence in Q50. **A failing test that contradicts a design assumption is a finding, not a
broken test** — and one afternoon of "fix the coordinates" would have buried it.

**The first screenshot found a layout bug no test could have.** The marker for "there is more map to
the east" sits on the rule between the map and the side panel. Drawn sparsely, the first one lands
next to the first construct row — and a lone `>` beside `[1] Barracks` reads unmistakably as a caret
pointing at it. It is not: it means the map continues. Fixed by drawing the vertical markers every
two rows instead of every six, so a run of them reads as an edge rather than as a pointer. No
assertion about frame *text* would ever have caught this; it is purely about what a person's eye does
with one character. This is the third gate in a row where a real-terminal screenshot caught something
the tests structurally could not.

**Three lines were truncated mid-word at 80 columns**, and only the screenshot showed it. The map
pane is 46 usable columns at the floor, and the position readout, the live key bindings and the
status line are all longer than that. Fixed by stopping the map/panel divider above the footer, so
the footer's three rows run the whole width — a layout choice a session may make alone, made here
rather than registered as a question, and worth revisiting in gate 5C when the panel's own layout is
the subject. The bindings line now also grows with the terminal: at 80 columns it stops after `q
quit`, and what falls off is shown on the panel instead of being cut in half.

**One performance-budget failure, on a run that had a Bun suite beside it.** The busiest-frame test
("two armies, every effect on") failed its 95th-percentile budget once and passed on re-run and on
every run since. It is worth chasing rather than shrugging at, because this gate moved the two
helpers that write every single cell of every frame into another module, and a hot path is exactly
where that could cost something. It did not. Measured five runs on this branch against five on
`main`, same machine, same command: p95 1.00-1.21 ms here against 0.99-1.20 ms there, and the
composed output is byte-identical (5,938 bytes per frame on both). The budget is 83 ms, so failing it
means the process stalled for eighty times its normal frame cost — machine load, not this change. Not
fixed, because there is nothing here to fix; recorded because "it passed the second time" is not an
explanation, and the next session to see it should know the comparison has already been run.

**A third copy of the same two helper functions.** Two screens each had their own `put`/`text` pair
for writing into a frame. Writing a third would have been the point at which they quietly drift, so
they moved to `src/view/draw.ts` and both existing callers switched. The project's own rule — extract
after two real uses reveal the boundary — landed exactly here.

**The map is code, not a scenario file, and that was deliberate.** Checking in a 96 x 40 `.map.json`
would have cost the determinism suite twenty replays of a map that never reaches the simulation. The
development notes already warn that Bun enforces a per-test timeout Node does not, and that adding a
scenario file is the usual way to trip it.

**The screen is reached by a flag, not from the menu, and Section 1 said otherwise.** The plan
written before coding said "reachable from the game's own menu". Wiring it in would have meant
restructuring the menu's own event loop — it disposes its terminal session and exits when an item
ends it, so handing off to another screen and coming back needs a state machine the menu does not
have. That is accepted, merged Milestone 3 code, and rebuilding it to host a throwaway spike is the
opposite of a small change inside the current gate. `--spike` is one documented flag, it appears in
`--help` and in the development notes, and a test asserts it is documented. When the real Build Phase
is reached from a mission (Milestone 6 closes that loop), the handoff gets built once, for the thing
that actually needs it.

**The scroll margin became a parameter, which Section 1 also did not plan for.** The project's
governance says in as many words that this milestone may retune the three-tile margin "on evidence
from the first person who actually scrolls a Grid". A number nobody can change is a number nobody can
judge, so it became `--scroll-margin` and it is printed in the header. That is the canon's own
preferred move — make the fork observable rather than argue it — applied to something the frame had
not thought to make observable.

**Nothing was discarded wholesale**, which is itself worth saying: the shape the milestone described
was buildable as described. The three departures from it are all narrow, all recorded above, and all
in Section 9 as proposed wording changes rather than applied ones.

## 8. Decision

> **PASS**

Both interactions work, through all three ways in, at both ends of the supported screen size, proven
by 53 tests of which the scrolling ones are exhaustive rather than sampled, and by ten screenshots
of a real terminal. The question about Shift+Arrow is answered with a measurement rather than a
memory, and the answer changed the code: two sequence families and a modifier-free fallback, where
the canon assumed one sequence. The click question was put to Mario as a toggle rather than as an
argument, which is exactly what the milestone asked this gate to produce, and he answered it: a click
places it. The toggle is gone.

PASS here means the automated evidence holds and the gate's question is answered. It does not mean
accepted — that is still Mario's to give. What has changed since this section was first written is
that the two things only he could judge (Section 5) are no longer outstanding: he looked, the scroll
margin stands at three, and Q50 is closed. That separation between "the evidence holds" and "the
owner accepts" is the project's own convention, and Gate 1A's report closed the same way.

## 9. Canon impact

**Nothing below is applied. All of it waits for Mario to accept the gate.**

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| The five-tile jump binds Shift+Arrow **in two sequence families** (xterm's `CSI 1;<mod>` and rxvt's `CSI a/b/c/d`) **and** a modifier-free fallback (PageUp/PageDown, Home/End in all four of their live spellings). Both are displayed | `engine.md` 9.7's bindings table, replacing the single "Shift+Arrow" row | The terminal survey in Section 4.1: four surveyed terminal families send no shifted arrow at all, and rxvt sends a different sequence from xterm |
| A modified arrow counts as the jump **for any modifier, not Shift alone** | same table, as a note | Nothing else on the screen binds a modified arrow, so a terminal that eats Shift but passes Alt or Ctrl still gives its player the fast pan. A liberal reading costs nothing and rescues a case |
| **The mouse wheel moves the cursor five tiles**; the camera follows it, as it follows every other cursor move. It is not an independent camera | `engine.md` 9.7's mouse rows, replacing "wheel — scroll the camera" | Section 6: an independent camera would be the separate pan mode 3.3 forbids, and would strand the cursor off screen |
| The three-tile scroll margin, **confirmed, not retuned** — pending Mario's own look | `project-governance.md` Section 7, which currently says Milestone 5 may retune it | The exhaustive walk holds at three tiles at every viewport size; but "confirmed" here means "nothing is wrong with it", and only a person can say it feels right |
| The margin is a **follow rule, not an invariant**: at the map's own edge the cursor reaches the edge of the screen, because there is no more map to reveal | `engine.md` 3.3, one clarifying sentence | The only reading under which the rule is implementable at all, and the one the exhaustive test encodes |
| The Build Phase's **footer may run the full width**, under both panes, rather than stopping at the map pane | `engine.md` 9.2, which is GUIDANCE on composition | At 80 columns the map pane is 46 usable columns and all three footer lines are longer than that |
| **A click places the armed structure**; there is no confirm-on-second-click mode. The sentence calling this "a feel decision the spike makes observable as a toggle" describes a spike that has now run | `engine.md` 9.7's mouse rows and its click-to-place caveat | Q50, answered by Mario on 2026-09-21 after trying both. Held here rather than applied on its own, so this gate's canon changes land in one version bump instead of two |

Questions raised, each already added to [`../specs/open-questions.md`](../specs/open-questions.md)
with a recommendation:

| ID | Question | Recommendation, and what happened |
| --- | --- | --- |
| Q50 | With a structure armed, does a click on a tile place it, or does a second click confirm? | Recommended **place on the first click**, and delete the toggle once Mario had looked. **Answered 2026-09-21**: he picked it, the toggle is deleted, and the row is in the register's answered section |

Q37, which asked for this spike, is answered by the gate's existence and by Section 4.1's table; it is
already in the register's answered section and needs no further movement.

## 10. Next authorized action

Gate 5B — the construct menu and the legality panel — after Mario has looked at the spike, answered
Q50, and said whether scrolling feels right; not before, and no other gate in the meantime.
