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
node scripts/playtest.mjs --help
```

Output lands in `.playtest/` (git-ignored): `<name>.txt` always holds every step's screen as text.
Only for an image going into a pull request, add `--out evidence/screenshots` (keep each GIF under
about 1 MB; six keys at 80x24 is about 200 KB).

## Key names

`Up Down Left Right`, `S-Up` etc. (Shift, xterm bytes), `M-Up` etc. (Option as Esc+), `Tab S-Tab Esc
Enter Space Bksp Del PgUp PgDn Home End C-c`, any single character (`n`, `1`, `p`, `y`), `Name*N` to
repeat, `Name~MS` for a key arriving MS ms after the previous step (untimed steps are 1000 ms apart,
so each is its own press). The held-key speed ramp only runs on timed steps: `e Right Right~400
Right~30*12` is a tap, the terminal's repeat delay, then auto-repeat — the summary line prints each
step's cursor and speed tier (`slow`, `normal`, `fast`, `faster`). Mouse: `click:X,Y` clicks Grid tile X,Y wherever the camera has it drawn right now (fails if
it is off screen), `click@COL,ROW` clicks a 0-based screen cell; `rclick`, `wheelup`, `wheeldown` take
the same targets. `#` starts a comment in a `--file`. The table with bytes is at the top of
`src/playtest/keys.ts`. An unknown name is an error, never a guess.

Useful openings on the `--spike` screen: focus starts on the menu's Nexus Powers row; `n 1` picks
the first Nexus power, which closes the popup (budget becomes 130); `Down Down Space` arms the Hatchery
from the menu; a digit arms by hotkey and moves focus to the Grid; `Tab` switches focus. `d` opens
Debug Mode (Up/Down choose a flag, Left/Right change it, `r` restarts keeping the flags, `Esc`
closes). Its list scrolls and starts on gate 5I's placement juice (`d Right` lengthens the build
animation, `d Down Right` sets Lighting to rainbow), then gate 5H's movement numbers (`d Down*4
Right` widens the scroll margin); Up from the top wraps to the restart row, so the older flags at the bottom are close that
way: `d Up*5 Right Esc` turns the smart cursor off, `d Up*4 Right r` restarts with the keyboard on the
map. `src/build/debug.ts`'s `DEBUG_FIELDS` is the order.

What a script cannot show is time between keys on the live screen — the view sliding, a flash, a
building going up (script frames always draw buildings finished). For those, compose a frame with
`camera` / `refusedFlash` / `flash` / `placing: [{ ordinal, elapsedMs }]` yourself, or step
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
