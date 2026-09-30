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
node scripts/playtest.mjs --settings "battleRoundPulseMs=3000 raid=probe" --keys "1 Enter"  # start from an export
node scripts/playtest.mjs --help
```

Output lands in `.playtest/` (git-ignored): `<name>.txt` always holds every step's screen as text.
Only for an image going into a pull request, add `--out evidence/screenshots` (keep each GIF under
about 1 MB; six keys at 80x24 is about 200 KB).

## Key names

`Up Down Left Right`, `S-Up` etc. (Shift, xterm bytes), `M-Up` etc. (Option as Esc+), `Tab S-Tab Esc
Enter Space Bksp Del PgUp PgDn Home End C-c`, any single character (`n`, `1`, `p`, `y`), `Name*N` to
repeat, `Name~MS` for a key arriving MS ms after the previous step (untimed steps are 1000 ms apart,
so each is its own press). The held-key ramp only runs on timed steps: `e Right Right~300
Right~30*12` is a tap, the terminal's repeat delay (inside the 350 ms hold window), then
auto-repeat — the summary line prints each
step's cursor and the kind of move the last timed cursor key made (`tap`, `hold`, `fast`, `jump`).
`wait` is a step where no key is pressed and time passes — a second, or `wait~MS`; `wait~250*40` is
ten seconds in quarter-second frames. It is how a script watches a Nexus Pulse. Mouse: `click:X,Y` clicks Grid tile X,Y wherever the camera has it drawn right now (fails if
it is off screen), `click@COL,ROW` clicks a 0-based screen cell; `rclick`, `wheelup`, `wheeldown` take
the same targets. `#` starts a comment in a `--file`. The table with bytes is at the top of
`src/playtest/keys.ts`. An unknown name is an error, never a guess.

Useful openings on the `--spike` screen: the menu is one list — `[e] Explore Map`, `[n] Nexus`, a
line with what is left to spend on its right (`* 100` in ASCII, `◆ 100` in Unicode — the map's
resource symbol), the buildings, `[s] Start Pulse` on the last line — and the one bottom line says the
last key's answer or a hint for where the keyboard is. Focus starts on the menu's first row, Explore
Map (`e`, or Enter there, opens it as a card under `[e] Explore Map  >`, first moving the cursor to
clear ground; `e`, `x` or Esc goes back), and the map cursor on the Grid Nexus (18,10); `n 1` picks the
first Nexus power, which closes the popup (the credits become `* 130`) and leaves the highlight on the
Nexus row, so `n 1 Down Down Space` arms the Hatchery from the menu and the panel becomes its card
under `[2] Hatchery  >` (`n 2` is the War Chest: 2000 more to spend). **Lists stop at their ends** —
Up on the first row stays there — and `PgDn`, `End` or `S-Down` goes to the last row, so `PgDn Enter`
is the Battle Round screen from anywhere on the menu. Arming — a digit, Enter on a row, a click on it — keeps the cursor where it is when the
building fits there, and otherwise moves it to the nearest spot a free tile from everything (from the
Nexus, that is 22,10 for a Barracks, a free column to its right; a tile down counts as two across). A
building being placed holds the keyboard: its own digit, `x` or Esc cancels it, another digit is
refused with a line saying so. A digit pressed on the map comes back to the map after the placement
(plain navigation); anything started on the menu comes back to the menu, the row flashing once. `Tab`
switches focus, arriving on the map in plain navigation; Left and Right on the menu only grey the
row's words for a moment. A script's frames are still frames: the focus arrow, the see-through cursor
Explore Map sends, the cursor blink and the card reveal are live-loop timing, drawn by `handoffGif` in
`scripts/capture-spike-screenshots.mjs`. A click on a building's row arms it at once
(`click@3,7` is the Hatchery at 80x24), and a second click on the same tile places. `x` and a right
click go back one level and do nothing on the menu, so `x x x` always lands there; only `Esc` on the
menu (or `q` anywhere) opens the game menu: `s` Settings, `c` Controls and hotkeys (`?` opens it from
anywhere), `r` Restart (the Build Phase over, every setting kept), `q` quits. The top bar's right end says what Esc does now — `menu [esc]`, `back [esc]`,
`close [esc]` — and clicking it is Esc (`click@70,1` at 80x24). **Settings** lists the player's own
settings first (`Esc s Right` switches the background to light), then the **Experiments** — the
playtest flags, which `d` opens straight at (Up/Down choose, Left/Right change, `e` exports, `Esc`
closes) — and last, **Export settings**. No popup has an `[esc] Back` row. The title shows the
highlight's place, `SETTINGS (5/10)`; the right border beside the list is its scroll bar when the list
is longer than the popup (a click on its lower half scrolls down). There are five Experiments: the
hold window (`d Left` shortens it to 150 ms), key releases (auto / off), the Battle Round pulse
(`d Down Down Right` lengthens a breath to 3000 ms; `--settings "battleRoundPulseMs=0"` stills it), and
the placeholder Pulse's raid and crew. Every other number the owner settled is a tuned value in
`src/build/tuning.ts`, not a setting — the focus arrow and the card reveal among them since his third
round. Closing Settings with a changed Experiment that only applies after a restart (key releases)
shows a **RESTART NEEDED** message (Esc closes it, back on the game menu's Restart; `r` then restarts). `src/build/experiments.ts`'s `EXPERIMENT_FIELDS` is the
order. The map's edge is not an Experiment: it is the map's own style (the spike
map's fence; `--glyphs unicode` shows the Unicode forms), and the menu's divider is its west side.

**A Nexus Pulse** (gate 6A): `s` asks (the menu's last row, `[s] Start Pulse`, which Up then Enter also
reaches; `p` is an unlisted alias) and opens the Battle Round 1 screen, a second `s`
(or `Enter` or `Space`) starts it on the same screen, and from then on each step's frame is the Pulse
at the script's own clock — the frame after the second `s` is 0.0 s (the title's timer at its full
countdown), the frame after `wait~7000` is 7.0 s. A whole plan and its Pulse: `n 2 3 click:22,9
click:22,9 3 click:22,12 click:22,12 2 click:20,14 click:20,14 s s wait~1000*20` (the War Chest, two
Turrets across the muster point, a Hatchery behind them — a win); `n 2 s s wait~40000` is nothing
built, and a loss. Its ending is the last three seconds (about 11.6 s in for that first plan: the
title's timer flashes and a light sweeps the map's border), a cease fire, the survivors walking home
and a result; red on the border is only the player's own Nexus being hurt. `--settings "raid=none"`
(nobody comes: TIME'S UP), `"crew=none"` (no units of your own: the Nexus falls, and the border
blushes red at its first hit) and `"raid=probe crew=some"` (the gate-6A defaults) reach the rest; the
ending's timings are tuned values now (`src/build/tuning.ts`). The defaults are a heavy raid and no
units of your own: the plan above still wins, and `n 2 s s` with nothing built loses about 27 s in. During a Pulse
Space pauses, `[` and `]` change the speed, `.` and `,` step, `r` watches it again, and `d` still
opens the Experiments; `Esc` opens the game menu and its Restart is the way back to a fresh Build
Phase. `scripts/capture-spike-screenshots.mjs` has `pulseGif` (an ending frame by frame, in real time)
and shows each ending as a still.

**Reproducing what the owner played**: he exports his settings (Settings, `e`) and pastes the text
into the pull request; `--settings "<that text>"` starts the script from exactly those settings and
experiments (the whole export, or just pairs: `--settings "battleRoundPulseMs=3000 raid=probe"`; a name that is
no longer an Experiment is skipped with a note). The
same key script can open the **live game** in a state: `./bin/terminal-nexus.ts --spike --keys "n 1 1
Enter"` (and `#keys=` in the browser page's address) plays those keys through the real adapters
before the player gets the keyboard — for a demo link, or to hand Mario the exact state a report is
about.
Unknown names and bad values are skipped and named on stderr.

What a script cannot show is time between keys on the live screen — the view sliding, a flash, a
building going up (script frames always draw buildings finished; a Nexus Pulse is the exception, since
a `wait` moves its clock). For those, compose a frame with
`camera` / `refusedTry` / `ack` / `placing: [{ ordinal, elapsedMs }]` / `removing: [{ ordinal,
contentId, anchor, elapsedMs }]` yourself, or step
`BuildAnimation` (`src/view/build-live.ts`) with a fake clock: `slideGif`, `placementGif` and
`placementSheet` in `scripts/capture-spike-screenshots.mjs` do exactly that.

## Workflow

1. Iterate in text: run with the default `--print final` (or `all`) until the screen says what you
   expect. The per-step summary prints focus and the bottom line for each key.
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
