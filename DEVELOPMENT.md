# Developing Terminal Nexus

Terminal Nexus is a specification-driven pre-production project. The first implementation will be a
bounded terminal renderer experiment, not a vertical slice of the whole game.

## Start a coding session

1. Run `./scripts/check-repository.sh`. It prints the canon version and the active gate.
2. Read `AGENTS.md`.
3. Read `specs/terminal-nexus-concept.md`.
4. Open `specs/README.md` and follow its current-gate reading order.
5. Skim `specs/open-questions.md` Section 4 so you know what is undecided before you decide it.
6. Inspect existing code, tests, and evidence before proposing changes.
7. Copy `specs/templates/gate-report.md` and fill in its first section: question, artifact, evidence,
   exclusions, stop conditions.

The current implementation contract is whichever file `milestones/README.md` marks **CURRENT**, through
its own **Active gate**. Milestone 1 (Grid Battles) is complete and accepted; the campaign's first
level is being built across the milestones after it. `./scripts/check-repository.sh` prints the
current gate, so it is faster than reading for it.

## Current commands

### Repository validation

```bash
./scripts/check-repository.sh
```

This is the project's only automated feedback loop until a runtime is selected. It checks
invariants, not literals — canon version and current gate are derived from the documents, so
correct canon work never breaks it. What it enforces:

- required files exist;
- every document under `specs/` and `concept/` declares the same canon version as `specs/README.md`,
  and so does `AGENTS.md`;
- every such document carries `Document role`, `Status`, `Canon version`, `Updated`, `License` —
  **except a document named in `check-repository.sh`'s `historical_archives` list**, a frozen record
  nothing may depend on. It still owes its links, but not the metadata header or the canon version,
  and it is exempt from the terminology scan below, because an archive edited to use today's words
  stops being a record of what was actually said;
- exactly one milestone is `CURRENT`, declares an `Active gate`, and matches the governance ledger;
- every `Q<n>` referenced anywhere is defined in `specs/open-questions.md`, and every `OPEN` question
  carries a recommendation;
- retired terminology stays retired — mark a line `<!-- stale-ok -->` to quote it deliberately;
- `.devcontainer/devcontainer.json` parses, local Markdown links resolve, code fences balance, and
  the working tree has no whitespace errors.

Add a check here whenever you find yourself remembering a rule instead of relying on one.

### Play it in a browser (a phone, during review)

```bash
bun scripts/build-web.mjs                      # dist/terminal-nexus-playtest.html, about 135 KB
bun scripts/build-web.mjs --out some/page.html
```

One self-contained HTML file with the real menu, Build Phase and two Pulse replays, painted on a
canvas, with an on-screen key bar for the keys a phone keyboard lacks and taps as mouse clicks. It
opens straight from disk; for a phone, a session publishes it as a private claude.ai page for the pull
request, with the commit printed at the top of the page. It is **a development tool, not a platform**
(`specs/engine.md` 10.2): the browser runs the terminal's own three screen loops through a stand-in
terminal (`src/view/backends/ports.ts`), and adds only a canvas backend
(`src/view/backends/canvas.ts`), key and tap translation (`src/web/keys.ts`, through the scripted
playtest's own key names) and browser-stored settings (`src/web/host.ts`, the one file that touches the
DOM). The build needs Bun and **fails if anything the page reaches imports a Node-only module**;
`tests/web.test.ts` holds the page to the terminal's characters, colours and keys, and (in the Bun pass)
runs the bundle in a sandbox with no Node features and requires the same fingerprints Node computes.

What it cannot show: raw keyboard mode, terminal cleanup, signals, real terminals' own key encodings
(iTerm2's Option key), the OpenTUI backend, or frame timing. Those stay terminal-only, and a terminal
at 80 x 24 stays the acceptance target.

### Install, build, test, run

Gate 1A selected the toolchain. There is **no build step**: Node 22.18+ and Bun 1.3+ both execute
the TypeScript sources directly, so relative imports carry explicit `.ts` extensions and the code
stays inside erasable-syntax TypeScript (no enums, no parameter properties). `tsconfig.json` is for
type checking and editors only.

```bash
# install (type checking and the OpenTUI backend; the kernel itself has no runtime dependency)
npm install

# there is no build step

# test
npm test            # Node's runner over tests/*.test.ts
npm run test:bun    # the same suite under Bun, one file at a time
npm run typecheck   # tsc --noEmit, then the browser page's one DOM file against tsconfig.web.json

# run — <map> is a .map.json path, suffix optional; no subcommand, watch is the default action
./bin/grid.ts scenarios/citizen-mirror-skirmish                              # watch (the default)
./bin/grid.ts scenarios/citizens-versus-ravels --glyphs unicode --capability truecolor
./bin/grid.ts scenarios/ravel-cascade --capability monochrome --reduced-motion
./bin/grid.ts scenarios/citizens-versus-ravels --no-effects
./bin/grid.ts scenarios/citizen-mirror-skirmish --headless --log-level debug --ticks 120
./bin/grid.ts scenarios/citizen-mirror-skirmish --headless --events events.jsonl --json
./bin/grid.ts scenarios/citizen-mirror-skirmish --verify                    # 10 runs by default
./bin/grid.ts scenarios/citizen-mirror-skirmish --verify --runs 20
./bin/grid.ts scenarios/citizen-mirror-skirmish --headless --turn 90        # jump straight to tick 90

# the same commands under Bun
bun bin/grid.ts scenarios/citizen-mirror-skirmish --headless

# run terminal-nexus — the game's own entry point, distinct from grid: no map, straight to the menu
./bin/terminal-nexus.ts                                                     # top-level menu
./bin/terminal-nexus.ts --capability truecolor --theme dark --backend auto

# the Build Phase scrolling-and-placement spike (Milestone 5, gate 5A)
./bin/terminal-nexus.ts --spike
./bin/terminal-nexus.ts --spike --scroll-margin 30 --capability monochrome   # margin: % of the view
```

Pinned by Gate 1A, measured 2026-08-21:

| | Version | Note |
| --- | --- | --- |
| Node.js | 22.22.2 | Runs TypeScript with no build step from 22.18 |
| Bun | 1.3.11 | Same sources, same hashes |
| `typescript` | 7.0.2 | Type checking only |
| `@types/node` | 22.20.1 | Type checking only |
| `@opentui/core` | 0.5.6 | Terminal backend. **Native core loads under Bun, not under Node** |
| `gifenc` | 1.0.3 | Dev only: GIFs of a scripted playtest (MIT, no dependencies; checked 2026-09-27) |
| `pngjs` | 7.0.0 | Dev only: reads Chromium's PNGs for those GIFs and for "is this shot unchanged?" (MIT, no dependencies) |

`watch` options: `--capability monochrome|color16|color256|truecolor`, `--theme dark|light`,
`--glyphs ascii|unicode`, `--tile-width 1|2`, `--no-effects`, `--reduced-motion`,
`--cosmetic-seed`, `--speed`, `--backend`. ASCII and monochrome are the defaults and the
acceptance floor; everything above them is fidelity, never information. `--capability` defaults
to the best tier `COLORTERM`/`TERM` advertise rather than always `color16` (owner playtest: a
terminal that can do more was still getting the tier most exposed to a terminal theme's own,
inconsistently defined colours). `--theme` defaults to `dark` — the palette the lore and every
screenshot are designed against — and `light` is one flag away for a light terminal background.

**`terminal-nexus`** (Milestone 3, all three gates built) launches straight to a top-level menu —
Campaign, Challenge, Settings, Exit — on the same `TerminalBackend`/cell-frame stack `grid` uses, not
a second presentation system. `src/menu/` holds the reusable menu-list shape, the keyboard and mouse
adapters, and the driver; `src/view/menu.ts` composes the frame; `src/cli/lifecycle.ts` is the one
idempotent disposer both `grid watch` and this menu build their lifecycle on. Every menu item shows
its hotkey (`[1] Campaign`) and is reachable three equivalent ways — the hotkey, arrows and Enter, or
a mouse click on its row (opt-in SGR mouse reporting, switched off by the disposer on every exit
path). Settings and Exit are real; Campaign and Challenge are honest about not being built yet, each
in its own way (below). `terminal-nexus` flags: `--capability`, `--theme`, `--glyphs`,
`--reduced-motion`, `--backend`.

**The Build Phase** (`--spike`, Milestone 5) is the first screen in the project that
shows a **window onto a Grid larger than itself**: a 96 x 40 map in a viewport that is 48 x 16 tiles
at 80 columns and 72 x 24 at 104. The screen is a full-width top bar, the **menu on the left**, the
Grid in **a rectangle of its own** beside it, and a full-width bottom bar of three lines: the position
readout, the key help for whatever has the keyboard, and the **status line**. Each side of the Grid's
rectangle is a dim line where there is more map that way and a **solid bar** where the map ends; the
map's west side is its own column beside the menu's plain divider. The readout names the visible
range, because there is no minimap.

**The menu runs the screen** (the owner's round-2 direction; `docs/ui-patterns.md` has the rules).
The keyboard starts on the menu: Up/Down and Enter/Space work it, `[n] Nexus` opens the Nexus Powers
popup (a pick closes it), `[e] Explore` (or Tab, or a second Right) moves the keyboard to the map with
nothing armed, where the arrows move the cursor, the map scrolls once the cursor comes within a fifth
of the view of an edge, and Enter/Space on a building opens an information panel. Arming a building (Enter
on its row, or its digit from anywhere) puts the cursor beside the last thing planned; Enter or Space
places it, and **every placement returns the keyboard to the menu, disarmed**. A mouse click first
moves focus and only then activates; on the map a **second click on the same tile** places (Q52). Esc,
`x` and a right click go back one level — popup, information panel, map — and on the menu ask "Exit the
game?"; `q` asks the same, and only Ctrl+C quits at once. Every row shows its cost, a row that no
longer fits is dimmed, and **why a placement would be refused is the status line's job** — "rock in
the way at 8,5", "costs 40, 20 left" (affordability first) — quietly while the grey `x` preview sits on
the tile, in red once a placement is tried. `[u]` undoes and Backspace (on the map) removes the one
under the cursor, both refunding, which keeps a plan revisable until `p` starts the Pulse.

**Moving has speed tiers** (gate 5H): a tap moves one tile; a held arrow moves two a step, then four
once held for a moment; Shift+Arrow moves eight; and a change of direction drops a held arrow back to
one a step, for pointing precisely, until it is let go. Terminals send no key-up, so "held" is read
from how close together the key's repeats arrive (`src/build/motion.ts`); the reducer only ever sees
a move of the size chosen. The view **slides** to where it scrolled over a few frames — the screen's
first frame timer, running only while something moves (`src/view/build-live.ts`) — and a fast move
re-centres the view on the cursor. **A click with a building armed never scrolls the view**, so the
confirming second click lands where the first did (Q58); **exploring, a click near an edge scrolls
further the nearer the edge**. A placement tried and refused flashes its footprint. A lone Esc at the
end of a read waits 50 ms for the rest of a key sequence before it counts as Esc — so anything sending
keys programmatically leaves a pause after an Esc. **Every one of these numbers is a Debug Mode flag**
(`d`); the popup scrolls, since there are twenty-four.

**A placed building goes up** (gate 5I): it plays a few frames of its own (authored beside its art in
`src/content/art.ts`'s `PLACEMENT_ART`, with a generic fallback for anything not drawn yet), then
stands finished with a brief light on its characters and a few sparks around it — all of it timed by
the live loop and drawn by `src/view/placement.ts` as a pure function of the time since the
placement, and none of it in the plan. Debug Mode's first four rows tune it (Build animation,
Lighting — including a rainbow — Particles, Glow time); reduced motion shows the finished building at
once. Scripted playtests draw buildings finished; `scripts/capture-spike-screenshots.mjs`'s
`placementGif` and `placementSheet` step the animation with a fake clock.

Shift+Arrow is the fast move, and so are PageUp/PageDown and Home/End, because several terminals
deliver no shifted arrows at all — `node scripts/probe-modified-keys.mjs` prints the survey, and
`evidence/gate-5a-report.md` has the table. So does Option+Arrow as macOS terminals send it (`ESC b`,
`ESC f`, or `ESC` before an arrow), bound from their documented defaults; **`node
scripts/lib/key-echo.mjs` prints exactly what each key sends in the terminal it runs in** (press `q`
to leave), which is how to check a terminal nobody has measured yet. **The footer and the panel share
one list of bindings**: the bottom bar takes as many as its width holds, trimmed to the essentials —
arrows, place, disarm, quit, the fast move, remove, undo — and the panel shows the rest, so a wide
terminal has them all on one line and an 80-column one loses none of them (the other fast-move keys
stay bound but unlisted). `--scroll-margin <percent>` starts the scroll margin at another share of the
view than 20% (Debug Mode changes it live). Nothing it plans reaches the simulation, and nothing is
saved.

Before any of that, the Build Phase opens on a **Nexus power draft** (gate 5D): two placeholder
powers — a plain bump to the starting allotment, not real Milestone-8 content — that must be picked
with a digit or a click before anything else can happen, because a dealt Nexus power may not be
skipped. Once picked, the screen becomes the construct menu described above, and the panel's own
NEXUS and SPECIAL rows name what was picked and hold the Special slot's own reserved space, empty for
now. `p` asks, once, whether to end the Build Phase and start the Nexus Pulse; `y`/`n` (or Esc)
answers, and accepting locks everything else — arming, placing, undo, and removal are all refused
once committed, each naming which of the three gates (drafting, confirming, or already committed) is
holding it. Whichever of the draft, the confirmation, or the construct menu the panel is currently
showing is the one a digit or a click addresses, so a hotkey and a click always land on the same
command, whichever adapter sent it.

Its own code: `src/build/` holds the camera arithmetic, the pure reducer, the three adapters and the
driver; `src/view/build.ts` composes the frame; `src/cli/spike.ts` runs it on the same backend and the
same idempotent disposer as the menu. `src/view/draw.ts` is where the `put`/`text` band-writing
helpers moved once a third screen wanted them.

Campaign and Challenge (Gate 3C) hand off to Milestones 4 and 11, neither of which is built yet, so
each says so — differently, matching what the milestone's own text asks for. Campaign's hotkey opens
a real second screen (`src/cli/menu.ts`'s `campaignMenu`, the exact same session/list/view machinery
Settings already uses) with a plain message and a Back row. Challenge stays on the top-level menu but
renders dimmed — `MenuItem` gained an optional `disabled` flag that `src/view/menu.ts` reads to draw a
row in the muted style instead of its usual colours — and its own label already names the milestone
that builds it (`"Challenge (Milestone 11)"`), rather than making a player press it to find out.
Activating a dimmed row is unchanged from any other item — engine.md 9.7 is a RULE that a displayed
hotkey activates the item it belongs to, so `disabled` only ever changes how a row is drawn, never
whether pressing it does something.

Settings (`src/settings/`, Gate 3B) is a second menu screen reached from the top level by its own
hotkey, built from the exact same list shape and the exact same three adapters rather than a second
kind of screen invented for it: four rows — colour depth, background, symbols, reduced motion — each
cycling to their own next value in place, plus a row that goes back (its own hotkey, or Esc). A change
shows up on the very next frame with no restart of the terminal: `TerminalBackend` gained an optional
`setPresentation(capability, theme)`, implemented by both `AnsiBackend` and `OpenTuiBackend`, so the
same running backend can be told to draw differently instead of being torn down and rebuilt. Every
change is written straight to `~/.terminal-nexus/settings.json` — a small file of its own that `grid`
never reads, and deliberately not a step toward any future save/progression format — and read back on
the next launch; an explicit command-line flag still overrides it for that one run without changing
what is saved.

`bun test` drives one file at a time (`./scripts/run-tests.sh bun`): its `node:test` shim rejects a
test registered while another file's tests are still running, and it does not implement `t.skip()`.
Node's runner isolates each file and takes the whole glob at once.

**Bun enforces a 5000ms default per-test timeout that Node's runner does not.** Any test whose cost
scales with the fixture count — `for (const name of scenarioFiles())`, N runs each — silently
approaches that ceiling as scenarios are added and eventually times out under Bun with no equivalent
warning under Node. This has happened twice already (`tests/cli.test.ts`'s `verify --runs 20`,
`tests/determinism.test.ts`'s twenty-runs-of-every-scenario check). The fix each time was the same:
give the test an explicit `{ timeout: 120_000 }` (`test(name, { timeout }, fn)`, third-argument form,
works identically under Node). **Before adding a new scenario file, run `./scripts/run-tests.sh bun`
once** — not just `npm test` — since this class of failure is Bun-only and easy to miss.

### Scripted playtests and demos

```bash
node scripts/playtest.mjs --keys "Down Down Space*4"                  # every step's status, then the final screen
node scripts/playtest.mjs --keys "n 1 Tab S-Left*3 Enter" --print all
node scripts/playtest.mjs --keys "Down Down Space*4" --gif --png final --name hatchery-run
node scripts/playtest.mjs --file flow.keys --size 104x32 --capability monochrome --png all
```

Presses keys on the Build Phase screen (`--spike`) without a terminal and keeps what the screen
showed after every key: the text of every step in `.playtest/<name>.txt`, and on request PNGs
(`--png final`, `--png all`, `--png 0,3,6`) and an animated GIF of the whole sequence (`--gif`).
Output goes to `.playtest/`, which git ignores; pass `--out evidence/screenshots` only for an image
that is going into a pull request. `--help` lists everything, including `--size`, `--capability`,
`--theme`, `--glyphs`, `--delay` and `--hold`.

Use it to see a change working, to check a flow a person described, and to make the pictures a pull
request shows. The keys go through the real keyboard and mouse adapters as the exact bytes a terminal
sends, one key at a time, and each frame comes from the same composer the live screen uses — so there
is no capture race, and no Esc glued to the next key by accident. Key names: `Up Down Left Right`,
`S-` (Shift) and `M-` (Option) arrows, `Tab S-Tab Esc Enter Space Bksp Del PgUp PgDn Home End`, any
single character, `Name*N` to repeat, `Name~MS` for a key arriving MS milliseconds after the one
before (untimed keys are a second apart, so each is a press of its own; `Right Right~400 Right~30*12`
is a held arrow's auto-repeat, which the speed ramp reads — the per-step summary prints the tier),
`click:X,Y` for a Grid tile and `click@COL,ROW` for a screen
cell (`rclick`, `wheelup`, `wheeldown` likewise), `#` for a comment in a file. The full table is at
the top of `src/playtest/keys.ts`. A script that leaves the screen (`q`, or Esc with nothing armed)
stops there and says so.

Only the Build Phase is wired up. Another screen gets a sibling of `src/playtest/build.ts` — take
steps, return frames — and the command line, the key names and the image code carry over unchanged.

Images come from the same pipeline as the real-terminal screenshots below (`frameToAnsi` → HTML →
headless Chromium), plus `pngjs` and `gifenc` for the GIF: one shared palette, and every frame after
the first stores only the pixels that changed, so a six-key GIF at 80 x 24 is about 200 KB at the
default `--scale 2`. Chromium's bundled ffmpeg (`/opt/pw-browsers/ffmpeg-1011`) was checked and cannot
help: it reads only MJPEG and writes only VP8 WebM, and a WebM does not play inline in a pull request.

### Screenshots of the real terminal

```bash
node scripts/capture-screenshots.mjs              # all of them
node scripts/capture-screenshots.mjs --only mirror-melee
```

It drives `grid` (watch, the default action) inside a tmux pseudo-terminal — a real PTY, so the ANSI backend takes
the same path a person gets — pauses it, steps to an exact tick, captures the pane with its escape
sequences, and renders it to a PNG in `evidence/screenshots/` through the Chromium already present
for Playwright. Use it when a change touches the composition: a frame's *text* is what the tests
assert on, and it says nothing about spacing, density, or where the eye goes.

`node scripts/capture-spike-screenshots.mjs` covers the Build Phase, at each of the terminal sizes
that actually mean something: 80 x 24 (the floor and the minimum viewport), 104 x 32 (the maximum
viewport), 128 x 24 (two columns per tile), and 79 x 24 (one column below the floor, so the resize
gate). `--only <name>` captures a single shot; `--out <dir>` writes somewhere other than
`evidence/screenshots/`. **Most of its shots are composed in-process**, through the scripted playtest
above, because a shot about layout or a flow must not be able to come out one key early — one did,
with a popup still open, because the text it waited for was drawn before the key that closed it. Each
names text its frame must contain and fails if it does not. **A few stay on tmux on purpose**, because
the terminal path is what they prove: startup, the resize gate, real Shift+Arrow and PageDown bytes,
real SGR mouse clicks, and `--capability monochrome` end to end.

The tmux path is made race-free in `scripts/lib/terminal-capture.mjs`: every key is its own tmux call
followed by a short pause (an Esc and the next key in one read are one Option+key to the input
splitter), and after the expected text appears the shot waits until two captures 200 ms apart agree
(`settledPane`) before rendering. `capture-menu-screenshot.mjs` uses the same two helpers.

**An unchanged shot is not rewritten.** Every image the shared pipeline renders records a hash of
the page it was rendered from; when a regeneration would produce the same page, the file is left
alone. An older image without the hash is compared pixel by pixel and also left alone when it
matches. So regenerating every screenshot after a change touches only the images the change actually
shows up in, instead of adding a fresh copy of each to the repository's history. `--force` (or
`TN_CAPTURE_FORCE=1`) re-renders everything — for when Chromium or the font changed rather than the
game.

`node scripts/probe-modified-keys.mjs` is not a screenshot but belongs to the same family: it prints
what every terminal description installed on the machine claims it sends for Shift+Arrow, PageUp and
Home, then drives a real pseudo-terminal and prints what actually arrived. Run it before trusting any
remembered escape sequence.

`node scripts/capture-menu-screenshot.mjs` does the same for `terminal-nexus`'s menu, sharing the
same `scripts/lib/terminal-capture.mjs` pipeline: launch, arrow keys by real tmux key name, a hotkey
digit, and — driving the mouse adapter with the literal bytes a terminal actually sends, not a
description of one — a raw SGR mouse click at the row's own rendered cell. Its shots also cover the
Settings screen (entering it, cycling a row, and coming back — cycling does more work than a plain
navigation redraw, since it writes the settings file too, so that shot waits for the new text to
actually appear rather than capturing on a fixed delay) and Campaign's placeholder screen the same
way, plus one of Challenge dimmed and highlighted on the top-level menu itself.

Requires `tmux` and the browser at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Editing the
`shots` array at the top of the script is how you add a frame worth looking at.

### The log is the feedback loop

`grid --headless` writes fixed-column lines to one stream (stdout), which is what lets an agent
assert on behaviour without parsing prose:

```text
[tick] LEVEL kind subject [-> object] detail...
```

Levels are `ERROR`, `WARN` (default), `INFO`, `DEBUG`, `TRACE`. `INFO` is the story — spawns, first
engagements, every attack that landed, deaths, structures destroyed, victory; `WARN` is anomalies
plus a closing `report` line carrying the outcome, losses, and hashes, so a bare `--headless` run
still ends with the answer even at the default level. It grows by adding kinds, never by reshaping
columns. `--save-log <file>` writes the same lines to a file, in any action (`watch` included). When
a test needs structure rather than a story, assert on `--events` JSONL instead.

## Environment options

### Local checkout

Use any editor and terminal capable of running the pinned toolchain once selected. The repository
validator currently requires Bash, Node.js, and standard POSIX tools (`grep`, `sed`, `awk`, `find`).

### GitHub Codespaces

The repository includes a dev-container configuration supplying an editor, shell, Node environment,
and GitHub CLI. The Node image does not pre-decide the Terminal Nexus runtime.

### Claude Code on the web

Claude runs in an isolated task environment and should work on a branch, verify its changes, and
return a pull request. See `docs/claude-web.md`.

Measured in that environment on 2026-08-20: **Bun 1.3.11 and Node 22.22.2 are present; Deno is not.**
A Deno probe therefore costs an install step in every session, which is why Milestone 1 dropped it.

## Change discipline

- One pull request should answer one bounded question.
- Keep measured facts separate from design judgments.
- Preserve exact versions, commands, platforms, fixtures, snapshots, and seeds.
- Do not continue into a later gate without owner acceptance.
- Do not update canon to claim an experiential success that Mario or a fresh viewer has not observed.
- Never commit secrets or personal information.

## Evidence reports

Copy `specs/templates/gate-report.md` into the spike's `evidence/report.md` and fill it in **while you
work**. A report reconstructed at the end is how a gate quietly turns into a summary of whatever got
built.

Reports and large evidence belong beside the implementation spike, not inside the durable canon.

## Canon changes

The canon is split by responsibility under `specs/`. Change the narrowest authoritative document and
follow the protocol in `specs/project-governance.md`. Increment the shared canon version for semantic
changes — the validator names the documents you forgot.

Undecided things go in `specs/open-questions.md` with a recommendation, not into a hedge inside a
specification.

## Change log

Human-readable history of the development setup. Product and canon history lives in
`specs/project-governance.md` Section 6.

### 2026-08-21 — Milestone 1 built: the Pulse Playground (canon 2.6)

The repository has code. Node 22.18+ and Bun 1.3+ run the TypeScript sources with **no build step**,
so relative imports carry explicit `.ts` extensions and the code stays inside erasable-syntax
TypeScript — no enums, no parameter properties. `tsconfig.json` is for type checking and editors.

New commands:

```bash
npm run play           # watch Citizens versus Ravels, colour, Unicode, effects on
npm run play:cascade   # the Ravel fuel-dump chain, at half speed
npm run play:plain     # the same fight with effects off
npm run play:mono      # monochrome, the acceptance floor
npm run scenarios      # list all seventeen

npm test               # 122 tests under Node's runner
npm run test:bun       # the same files under Bun, one at a time
npm run typecheck      # tsc --noEmit

./bin/playground.ts run|watch|verify <scenario>
node scripts/capture-screenshots.mjs      # drives a real PTY and renders PNGs
node scripts/capture-frames.mjs <id> ...  # plain-text frames
```

Things worth knowing before touching this:

- **`bun test` is driven one file at a time** by `scripts/run-tests.sh`. Its `node:test` shim rejects
  a test registered while another file's tests are still running, and it does not implement
  `t.skip()`, so runtime-specific tests are registered conditionally instead.
- **`src/pulse` may not import `src/view`, and `src/report` may not import `src/pulse`.**
  `tests/architecture.test.ts` walks the transitive import graph and fails the build on either.
- **The kernel touches no clock and no `Math.random`** — asserted both statically and by trapping
  them during a resolve.
- **Screenshots need tmux and Chromium**, both present in the web container. See the
  `grid-screenshots` skill (renamed from `playground-screenshots` since this entry was written).
- `@opentui/core` is pinned at 0.5.6 and its **native core only loads under Bun**; the direct-ANSI
  backend carries Node and passes the whole lifecycle suite.

### 2026-08-21 — execution-readiness audit (canon 2.5)

The canon read as a contract an isolated session has to execute, rather than as a design document.
Full findings, including the ones deliberately *not* acted on, are in
`docs/spec-audit-2026-08-21.md`.

**Tooling**

- The validator now checks `AGENTS.md`'s canon version against `specs/README.md`. `AGENTS.md`
  Section 4 restates ~20 canon invariants as a summary; it carried no version, so a canon bump could
  leave it stale with nothing to notice. It now has one, and forgetting it fails the build.
- The fix that suggested itself and was **not** taken: teaching the validator to verify `engine.md`
  section *numbers* in cross-references. Numbers move on every restructure. The cheaper convention is
  to cite a section by name as well — `engine.md §9.4 "Bands"` — so that a grep survives renumbering.
  Worth doing when the next renumbering happens, not before.

### 2026-08-20 — viewport and playground pass (canon 2.3)

Corrections from Mario after the 2.2 pass, plus the shape of the first spike.

**Viewport, screen sizes, and scrolling — now formalised**

- The viewport is measured in tiles and clamped to **48 x 16 minimum, 72 x 24 maximum**. The minimum
  is the floor below which the renderer gates; the maximum exists so a huge display cannot show
  meaningfully more Grid than a laptop, and so every layout calculation has a bound. Space beyond the
  maximum goes to centring and a larger inspection panel, never to more Grid.
- Terminal sizes fall out: **80 x 24** for the minimum viewport at one column per tile, 104 x 28 for
  the maximum; 128 x 24 and 176 x 28 at two columns. 80 x 24 stays the acceptance target.
- **Scrolling is cursor-driven.** Move the cursor within 3 tiles of a viewport edge and the camera
  follows. No pan mode, no modifiers, no second cursor, and no minimap. The UI must show there is more
  Grid, so edge markers on the frame and a footer position readout are both required.
- Small and medium presets fit the minimum viewport entirely, so tutorials and opening missions can
  introduce the game without a player ever learning to scroll.

**Layers were wrong, and are now right**

The 2.2 pass made "collisions resolve within a layer, never across" a hard rule. That is not what
layers are for. Corrected:

- **Layers define render order. That is the only hard rule.** Beyond that they organise assets.
- **Collision is a query**, not a layer property: a `CollisionMask` is composed from a chosen set of
  layers plus a predicate. A ground unit's movement mask includes `obstacles` and `units` but not
  `workers`, which is *why* a worker and a soldier can share a tile — and why a unit is still blocked
  by a building on a different layer. Both fall out of one mechanism instead of two rules.
- Different questions compose different masks: movement, placement, and targeting each want their own.

**Units can be large**

Settled directly (Q3): units as well as structures may span multiple tiles, and it matters
strategically. A Ravel raider drawn `>x<` is one unit occupying three tiles. A mover tests its **whole
footprint** against its mask; damage and destruction apply to the entity, not the tile. The Gate 1A
fixture now includes a 3 x 1 hauler specifically to break a collision system written for one-tile
actors while that is still cheap to find out.

**Authority markers reduced to two**

**RULE** and **GUIDANCE**. `UNPROVEN` folded into GUIDANCE — sections that describe something not yet
designed say so in their own words, which was doing the work anyway.

**Milestone 1 is the Pulse Playground**

Reshaped again, and better. The headless run and the ASCII view are built **together**, not as
separate gates: the headless run is how an agent iterates, the view is how Mario tells whether any of
it is good, and each catches what the other hides. Gate 1A uses a small Grid that fits the viewport,
so selection and scrolling are out of scope entirely. Gate 1B adds render tiers and effects.

The Playground is **foundation, not spike residue** — it is the bench every future unit gets tested
on, so the code quality bar is higher than "spike."

**The report is the feedback loop**

The Playground's most important feature for autonomous work: a **levelled log on stderr** (default
`INFO`) in fixed, greppable columns, and a **summary on stdout** with the outcome and hashes.
`playground run x.ts > report.txt 2> run.log` splits them. `INFO` carries the story — spawns,
engagements, attacks that landed, deaths, destruction, victory — so an agent can assert on behaviour
without parsing prose, and a designer can read what happened. `DEBUG` carries per-tick decisions,
`TRACE` carries everything.

**Concept folder simplified**

The delta tables added in 2.2 were over-engineering an early sketch. Reduced to what is worth keeping
from each piece, plus a note that the real visual concept comes from the Playground.

### 2026-08-20 — design-authority pass (canon 2.2)

A second pass after Mario clarified the shape of the engine and refocused the first spike.

**Terminology**

- The play surface is now **the Grid**, everywhere. The replica standing on it is a **Grid Nexus**;
  the one that stays home is a **Prime Nexus**. The retired word is rejected by the validator.

**The Grid became a real model rather than a number**

- Size and shape presets: `small`/`medium`/`large`/`extra-large` against
  `squared`/`wide`/`extra-wide`, twelve in all. `medium-extra-wide` (48 x 16) is the default, and the
  arithmetic is not a coincidence — at one column per tile it is exactly 80 columns with a sidebar,
  and at two columns exactly 128.
- **Orientation is a rendering choice.** Portrait and landscape change no coordinate and no rule.
- **Five layers** — terrain, obstacles, workers, units, air — with one occupancy law: collisions
  resolve *within* a layer, never across. That single rule is what makes a worker and a soldier
  sharing a tile a legal transient state rather than an edge case to arbitrate, and it maps straight
  onto the render bands.
- **Anchor, footprint, and facing** on every entity. Multi-tile is first-class from day one, because
  a footprint loop written now costs nothing and retrofitted later costs a week. Range measures to
  the nearest occupied tile. Facing is presentation-only for now (Q9).

**Authority markers**

Every section of `engine.md` now declares **LAW**, **GUIDANCE**, or **UNPROVEN**, with a legend in
`specs/README.md`. Most of the design canon is GUIDANCE — a recommendation written before the thing
existed, so a session facing a fork has better than a coin flip. The rule that makes it work:
*descriptive completeness is not authorization.*

**Milestone 1 refocused onto the Pulse**

The old plan proved a renderer first and simulated later. That is backwards for this game: an
authored reel can tell you whether a hand-tuned sequence looks good, but not whether *emergent
simulated combat* is legible — which is the actual product risk. The milestone is now three gates,
each producing something runnable:

- **1A — headless Pulse.** Grid, layers, scenario files, deterministic tick loop, a mirror Citizen
  skirmish. No terminal at all. `pulse run` prints a hash.
- **1B — watch the Pulse.** Cell frame, bands, composition, playback, lifecycle. Renders a kernel
  already known to be correct. The backend is *chosen* (OpenTUI, on the measurements) rather than
  competed for in a gate of its own.
- **1C — make it hit.** The effect vocabulary, evaluated by fresh viewers with effects on and off.

**Packaging, standalone binaries, SSH, PTY, and browser delivery are deferred out of the milestone
entirely.** They answer no question the game currently has.

**New: `specs/ascii-effects.md`**

The particle system, formalised: the pure `EffectRecipe` contract (absolute time in, sparse cells
out, `f(t)` never depending on `f(t-1)`), the beat structure, the craft rules, and a ten-effect
starter vocabulary. Every effect owes three forms — full, reduced-motion, monochrome — authored
together, never in a later accessibility pass. Gate 1C is the spike that proves or discards it.

**Tooling**

- The retired-terminology guard now covers the Grid rename.
- `specs/ascii-effects.md` is a required file.


### 2026-08-20 — canon audit and autonomy pass (canon 2.1)

An audit of the canon against itself, against the concept art, and against current upstream sources.

**Specification changes**

- **Milestone 1 was split.** Gate 1A previously required two backends, two runtimes, standalone
  executables, an SSH smoke test, and a browser-terminal demonstration before Gate 1B could begin —
  while `engine.md` Section 11.2 simultaneously called remote and browser surfaces "not Milestone 1
  product commitments." Gate 1A is now cell frame and lifecycle only. Packaging and remote delivery
  moved to **Gate 1C**, which is authorized independently and does not block the battle reel.
- **`specs/open-questions.md` added** — the durable register for decisions that need Mario. Seeded
  with seven questions found during the audit. The register is what lets a session get blocked on one
  fork without stalling on all of them.
- **`specs/templates/gate-report.md` added** — the fill-in template that closes a gate.
- **`specs/ascii-art-references.md` added** — researched sources for producing terminal art, with what
  each one is actually good for.
- **`concept/README.md` added** — index of the concept folder: the early art, the real screenshots
  that replaced it, and the archived original specification.
- **`engine.md` Section 11 corrected against measurement** (see below). Sections 6.1, 6.4, 10.2, and
  10.4 now point at the questions they leave open instead of reading as settled.
- **Corruption law added** to `engine.md` Section 10.4 and `terminal-nexus-lore.md` Section 9,
  resolving the collision between Glitch's identity and the legibility contract.

**Measured findings that changed the specification**

Probed on Linux x64, 2026-08-20. Indicative only — re-measure before citing.

- `@opentui/core@0.5.4` (MIT) publishes an explicit `node` export and **imports cleanly on Node 22**.
  The premise that OpenTUI meant Bun was false; library and runtime are independent choices.
- Its native core ships as **8 prebuilt per-platform packages** in `optionalDependencies`. No Zig
  toolchain is needed to consume it — the "install Zig" note applies to building the monorepo.
- **318 published versions, 141 semver releases** since 2025-08-13, roughly 12 per month. The pre-1.0
  churn risk is real and quantified. The repository has also moved from `sst/` to `anomalyco/`.
- `bun build --compile` produced a **140 MB standalone binary that ran from a clean working
  directory**, so the FFI-plus-standalone-binary risk is largely retired; size is the remaining cost.
  Startup measured ~390-580 ms compiled, ~290 ms via `bun run`.
- `@opentui/core/testing` exports `ManualClock`, `TestRecorder`, and mock keyboard and mouse input —
  a deterministic, TTY-free snapshot harness already exists, which is most of Gate 1A's automated
  acceptance.
- `OptimizedBuffer.setCell(x, y, char, fg, bg, attributes)` maps directly onto `ReadonlyCellFrame`,
  and `CliRenderer` accepts arbitrary streams, which is what makes Gate 1C possible later.

**Tooling changes**

- `scripts/check-repository.sh` rewritten. It previously grepped for the literals
  `**Canon version:** 2.0` and `**Status:** CURRENT — Gate 1A only`, which meant that doing correct
  canon work *broke the build*. Both are now derived from the documents. It also reports all failures
  at once instead of exiting on the first, and prints the canon version and active gate on success.
- The retired-terminology guard now covers the whole repository and understands a `<!-- stale-ok -->`
  exemption, so the concept index can quote what the art actually says.

## Licensing

Code and technical work use Apache-2.0. Lore and creative work use CC BY-SA 4.0. See `README.md`,
`NOTICE`, and `CONTRIBUTING.md` before importing third-party code, art, fiction, fonts, or assets.
