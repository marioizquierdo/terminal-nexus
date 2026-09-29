---
name: playtest
description: Press keys on the Terminal Nexus Build Phase screen without a terminal and get back every step's screen as text, PNGs and an animated GIF (scripts/playtest.mjs). Use to see a change working, to check a flow someone described ("Down, Down, Space, Space"), to reproduce a playtest report, and to make the before/after pictures or GIF a pull request shows. Prefer it over tmux screenshots for anything about layout or a flow; it cannot capture one key early.
---

# Scripted playtests

`scripts/playtest.mjs` takes a key script, feeds it one key at a time through the real keyboard and
mouse adapters (`BuildSession.handleData`) as the exact bytes a terminal sends, and composes the frame
after every key with the same composer the live screen uses. No terminal, no timing, no race.

## Commands

```bash
node scripts/playtest.mjs --keys "Down Down Space*4"                 # status per step + final screen
node scripts/playtest.mjs --keys "Down Down Space*4" --print all     # every step's full screen
node scripts/playtest.mjs --keys "n 1 Tab S-Left*5" --png final    # one PNG
node scripts/playtest.mjs --keys "Down Down Space*4" --gif --name hatchery-run
node scripts/playtest.mjs --file flow.keys --size 104x32 --capability monochrome --png all
node scripts/playtest.mjs --settings "placeLight=rainbow scrollMargin=25" --keys "1 Enter"  # start from an export
node scripts/playtest.mjs --help
```

Output lands in `.playtest/` (git-ignored): `<name>.txt` always holds every step's screen as text.
Only for an image going into a pull request, add `--out evidence/screenshots` (keep each GIF under
about 1 MB; six keys at 80x24 is about 200 KB).

## Key names

`Up Down Left Right`, `S-Up` etc. (Shift, xterm bytes), `M-Up` etc. (Option as Esc+), `Tab S-Tab Esc
Enter Space Bksp Del PgUp PgDn Home End C-c`, any single character (`n`, `1`, `p`, `y`), `Name*N` to
repeat, `Name~MS` for a key arriving MS ms after the previous step (untimed steps are 1000 ms apart,
so each is its own press). The held-key ramp only runs on timed steps: `e Right Right~150
Right~30*12` is a tap, the terminal's repeat delay (inside the 150 ms hold window), then
auto-repeat — the summary line prints each
step's cursor and the kind of move the last timed cursor key made (`tap`, `hold`, `fast`, `jump`).
`wait` is a step where no key is pressed and time passes — a second, or `wait~MS`; `wait~250*40` is
ten seconds in quarter-second frames. It is how a script watches a Nexus Pulse. Mouse: `click:X,Y` clicks Grid tile X,Y wherever the camera has it drawn right now (fails if
it is off screen), `click@COL,ROW` clicks a 0-based screen cell; `rclick`, `wheelup`, `wheeldown` take
the same targets. `#` starts a comment in a `--file`. The table with bytes is at the top of
`src/playtest/keys.ts`. An unknown name is an error, never a guess.

Useful openings on the `--spike` screen: focus starts on the menu's first row, Explore Map (`e`, or
Enter there, opens it; `e` or Esc goes back), and the map cursor on the Grid Nexus (18,10); `n 1`
picks the first Nexus power, which closes the popup (budget becomes 130) and leaves the highlight on
the Nexus row, so `n 1 Down Down Space` arms the Hatchery from the menu (`n 2` is the War Chest: 2000
more to spend). Arming — a digit, Enter on a row, a click on it — keeps the cursor where it is when the
building fits there, and otherwise moves it to the nearest spot a free tile from everything (from the
Nexus, that is 22,10 for a Barracks, a free column to its right; a tile down counts as two across). A digit pressed on the map comes back to the map after the
placement (plain navigation, `MAP` in the key help); anything started on the menu comes back to the
menu. `Tab` switches focus, arriving on the map in plain navigation. A click on a building's row arms it at once
(`click@3,9` is the Hatchery at 80x24), and a second click on the same tile places. `Esc` on the menu
(or `q` anywhere) opens the game menu: `s` Settings, `r` Restart (the Build Phase over, every setting
kept), `q` quits. The top bar's right end says what Esc does now — `menu [esc]`, `back [esc]`,
`close [esc]` — and clicking it is Esc (`click@70,1` at 80x24). **Settings** lists the player's own
settings first (`Esc s Right` switches the background to light), then the **Experiments** — the
playtest flags, which `d` opens straight at (Up/Down choose, Left/Right change, `e` exports, `Esc`
closes) — and last, **Export settings**. The title shows the highlight's place, `SETTINGS (6/28)`;
the right border beside the list is its scroll bar (a click on its lower half scrolls down). The
Experiments start on gate 5I's placement juice (`d Right` lengthens the build animation, `d Down
Right` sets Lighting to rainbow), then gate 5H's movement numbers (`d Down*4 Right` widens the scroll
margin). From the first setting, Up comes round to Export, then the last experiments. Closing
Settings with a changed Experiment that only applies after a restart shows a **RESTART NEEDED**
message (Esc closes it, back on the game menu's Restart; `r` then restarts) — no Experiment needs a
restart today, since "Opens on" was deleted. `src/build/debug.ts`'s
`DEBUG_FIELDS` is the order. The map's edge is not an Experiment: it is the map's own style (the spike
map's fence; `--glyphs unicode` shows the Unicode forms), and the menu's divider is its west side.

**A Nexus Pulse** (gate 6A): `p` asks, `y` starts it on the same screen, and from then on each step's
frame is the Pulse at the script's own clock — the frame after `y` is 0.0 s, the frame after
`wait~7000` is 7.0 s. A whole plan and its Pulse: `n 2 3 click:22,9 click:22,9 3 click:22,12
click:22,12 2 click:20,14 click:20,14 p y wait~1000*20` (the War Chest, two Turrets across the muster
point, a Hatchery behind them — a win); `n 2 p y wait~40000` is nothing built, and a loss. Its ending
is an alarm (about 10.5 s in for that first plan), a cease fire, the survivors walking home and a
result; `--settings "raid=none"` (nobody comes: TIME'S UP), `"crew=none"` (no units of your own: the
Nexus falls), `"raid=heavy"`, `"endAlarmLeadMs=0"` (no alarm), `"endWalkMs=0"` (no walk) and
`"endCentre=off"` reach the rest. During a Pulse Space pauses, `[` and `]` change the speed, `.` and `,`
step, `r` watches it again, and `d` still opens the Experiments; `Esc` opens the game menu and its
Restart is the way back to a fresh Build Phase. `scripts/capture-spike-screenshots.mjs` has
`pulseGif` (an ending frame by frame, in real time) and shows each ending as a still.

**Reproducing what the owner played**: he exports his settings (Settings, `e`) and pastes the text
into the pull request; `--settings "<that text>"` starts the script from exactly those settings and
experiments (the whole export, or just pairs: `--settings "placeLight=rainbow scrollMargin=25"`). The
same key script can open the **live game** in a state: `./bin/terminal-nexus.ts --spike --keys "n 1 1
Enter"` (and `#keys=` in the browser page's address) plays those keys through the real adapters
before the player gets the keyboard — for a demo link, or to hand Mario the exact state a report is
about.
Unknown names and bad values are skipped and named on stderr.

What a script cannot show is time between keys on the live screen — the view sliding, a flash, a
building going up (script frames always draw buildings finished; a Nexus Pulse is the exception, since
a `wait` moves its clock). For those, compose a frame with
`camera` / `refusedFlash` / `flash` / `placing: [{ ordinal, elapsedMs }]` / `removing: [{ ordinal,
contentId, anchor, elapsedMs }]` yourself, or step
`BuildAnimation` (`src/view/build-live.ts`) with a fake clock: `slideGif`, `placementGif` and
`placementSheet` in `scripts/capture-spike-screenshots.mjs` do exactly that.

## Workflow

1. Iterate in text: run with the default `--print final` (or `all`) until the screen says what you
   expect. The per-step summary prints focus and the status line for each key.
2. Then pictures: `--png final` or `--gif`. **Read the image before using it** — the text being right
   does not mean the picture is.
3. For a pull request: re-run with `--out evidence/screenshots --name <descriptive-name>`, commit the
   file, and embed it by its raw URL pinned to the pushed commit (the `pr-description` skill says how).
4. A before/after pair: run the same script on `origin/main` (a worktree or `git stash`) and on the
   branch, with different `--name`s.

## Tests and screenshots built on it

- `tests/playtest.test.ts` is the pattern for asserting a flow in the test suite: `parseKeyScript` +
  `runBuildPlaytest`, then assert on `frames[n].state` and `frameToText(frames[n].frame)`.
- `scripts/capture-spike-screenshots.mjs` composes most Build Phase evidence shots this way
  (`scripted(...)`, `scriptedGif(...)`), keeping only the shots that prove the terminal path itself on
  tmux. Add a flow shot there as a key script plus the text its frame must contain.
- Images whose content did not change are not rewritten (a hash rides inside each PNG/GIF);
  `--force` re-renders anyway.

## Extending to another screen

Only the Build Phase is wired. For the main menu or a `grid` battle, write a sibling of
`src/playtest/build.ts` (take steps, drive that screen's session through `handleData`, return
frames), and let `scripts/playtest.mjs` pick it with a `--screen` option. The key grammar and the
image code (`scripts/lib/frame-capture.mjs`) do not change.
