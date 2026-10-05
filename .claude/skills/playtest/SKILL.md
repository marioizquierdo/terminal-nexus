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
node scripts/playtest.mjs --keys "Esc Down Down Space*4"             # status per step + final screen
node scripts/playtest.mjs --keys "Esc Down Down Space*4" --print all # every step's full screen
node scripts/playtest.mjs --keys "Esc n 1 Tab S-Left*5" --png final  # one PNG
node scripts/playtest.mjs --keys "Esc Down Down Space*4" --gif --name hatchery-run
node scripts/playtest.mjs --file flow.keys --size 104x30 --capability monochrome --png all
node scripts/playtest.mjs --settings "popupPulseMs=3000 nextRound=auto" --keys "Esc 1 Enter"  # start from an export
node scripts/playtest.mjs --keys "Esc n 1 1 Enter" --activity Interactions   # what the run recorded
node scripts/playtest.mjs --at 'campaign?level=vasse-test-1&round=3' --png final   # round 3, no keys at all
node scripts/playtest.mjs --at 'campaign?level=vasse-test-1&round=2' --keys "n 1 s s wait~1000*20"
node scripts/playtest.mjs --help
```

`--at <route>` opens a campaign level at a round, in the game's own route grammar (`src/cli/route.ts`,
the same as `terminal-nexus --at`): `campaign?level=vasse-test-1` is PERIMETER's first round (what runs
without `--at`), and `&round=3` its third Battle Round, counted from 1 as the screen counts. A later round is reached as a player who picks the first Nexus power and builds nothing
reaches it, played with the run's `--settings`, so it is the very screen the keys `Esc n 1 s s wait~1000*16
Enter` reach for round 2, without them. Quote the route: the shell reads `?` and `&`. A title menu route
(`settings`) is refused, since only a campaign level's Build Phase is wired up here; with `--at`, `--keys`
may be left out to see the round as it opens.

Output lands in `.playtest/` (git-ignored): `<name>.txt` always holds every step's screen as text.
Only for an image going into a pull request, add `--out docs/pr-pictures` (see Workflow; keep each
GIF under about 1 MB, `--scale 1` quarters it; six keys at 80x24 is about 200 KB). The flags beyond
the ones above are in `--help`: `--theme`, `--glyphs`, `--delay`, `--hold`, `--caption`, `--force`.

## Key names

`Up Down Left Right`, `S-Up` etc. (Shift, xterm bytes), `M-Up` etc. (Option as Esc+), `Tab S-Tab Esc
Enter Space Bksp Del PgUp PgDn Home End C-c`, any single character (`n`, `1`, `p`, `y`), `Name*N` to
repeat, `Name~MS` for a key arriving MS ms after the previous step (untimed steps are 1000 ms apart,
so each is its own press). Tap counting and the hold's pace only run on timed steps: `Tab Right
Right~350 Right~250` is three taps, the last quick, so 1, 1, 2 tiles; `Tab Left Left~180 Left~30*12` is a
press, a repeat inside the 200 ms hold window, then auto-repeat, moving one tile every 60 ms (so every
other repeat moves nothing). `Right/press`, `Right/repeat` and `Right/release` send the key as a terminal
that reports key events does (the kitty keyboard protocol), with the same `~MS` timing. The summary
line prints each step's cursor and the kind and size of the last timed cursor key's move (`tap 1`,
`tap 2`, `hold 1`, `hold 0`, `jump 10`, `release 0`).
`wait` is a step where no key is pressed and time passes — a second, or `wait~MS`; `wait~250*40` is
ten seconds in quarter-second frames. It is how a script watches a Nexus Pulse. Mouse: `click:X,Y` clicks Grid tile X,Y wherever the camera has it drawn right now (fails if
it is off screen), `click@COL,ROW` clicks a 0-based screen cell; `rclick`, `wheelup`, `wheeldown` take
the same targets. `#` starts a comment in a `--file`. The table with bytes is at the top of
`src/playtest/keys.ts`. An unknown name is an error, never a guess.

## Useful openings

Each reaches a state on a campaign level's Build Phase (PERIMETER's first round unless `--at` says
another); what the screens are and every key on them is in
[`docs/system-design/ui-patterns.md`](../../../docs/system-design/ui-patterns.md) and
[`docs/system-design/input.md`](../../../docs/system-design/input.md). **PERIMETER opens on its intro**, the
dialog at the bottom, which holds the keyboard: every opening below starts after `Esc`, which skips it
(`Enter` reads the next line; `--keys "Enter Enter Enter" --png all` shows each line).

- `n 1`: pick the first Nexus power; the popup closes and the highlight stays on the Nexus row.
- `n 1 Down Down Space`: arm the Hatchery from the menu; the panel becomes its card.
- `n 1 PgDn Enter`: the Battle Round screen (`PgDn` goes to the last row, Start Battle Round; without a power
  picked first, the bottom line says so instead).
- `n 2 s s wait~1000*20`: a whole Pulse with nothing built, twenty seconds in; the second `s` starts it.
- `--at 'campaign?level=vasse-test-1&round=2'` with no keys: round 2 as it opens, round 1 played with
  nothing built. A round that opens with a scene (PERIMETER's first, a Commander's return) plays it first,
  as the game does; `Esc` skips it.
- `Esc s`: Settings from the menu; from the map it is `Tab Esc Esc s` (Esc on the map goes back to the
  menu first). `Esc s Right` switches the background to light; `d` opens the Experiments.
- `Esc a`: the Activity logs window (`Right` steps the filter, `e` exports).
- `click@3,7`: click a screen cell (0-based column, row); `click:22,9` clicks Grid tile 22,9.
- `--settings "popupPulseMs=3000 nextRound=auto"`: start from an export, or just pairs; a name that
  is no longer an Experiment is skipped with a note on stderr.
- `--activity [filter]`: print what the run recorded in the Activity Logs (Everything when no filter
  is named; `Interactions`, `Problems`) and save `<name>-activity.txt`, with times on the script's own
  clock. The quickest check that an event you added fires, and with what.
- `./bin/terminal-nexus.ts --at 'campaign?level=vasse-test-1' --keys "Esc n 1 1 Enter"`: the same route
  and key script open the live game in a state (`#at=campaign?level=vasse-test-1&keys=Esc n 1 1 Enter` on
  a local copy of the browser page; a demo's `at` and `keys` on a published one), for a demo or to hand
  Mario the exact state a report is about.

What a script cannot show is time between keys on the live screen: the view sliding, a flash, a
building going up (script frames always draw buildings finished). Two things are the exception, since a
`wait` moves their clock: a Pulse, and the raid's intent trail, whose arrows step on toward what the raid
goes for from the first frame that drew them moving (after `Esc` closes PERIMETER's intro, or as a round
opened by `--at` starts). `--at 'campaign?level=vasse-test-1&round=2' --keys "wait~100*23" --gif --delay 100
--hold 100 --scale 1` makes a GIF of it moving, a frame every 100 ms, as fast as it plays. For those, compose a frame with `camera` / `refusedTry` / `ack` /
`placing: [{ ordinal, elapsedMs }]` / `removing: [{ ordinal, contentId, anchor, elapsedMs }]`
yourself, or step `BuildAnimation` (`src/view/build-live.ts`) with a fake clock: `slideGif`,
`placementGif` and `placementSheet` in `scripts/capture-build-phase-screenshots.mjs` do exactly that.

## Workflow

1. Iterate in text: run with the default `--print final` (or `all`) until the screen says what you
   expect. The per-step summary prints focus and the bottom line for each key.
2. Then pictures: `--png final` or `--gif`. **Read the image before using it** — the text being right
   does not mean the picture is.
3. For a pull request: re-run with `--out docs/pr-pictures --name <descriptive-name>` and commit
   the one or two pictures to the pull request's branch in one commit; the description links them by
   that commit's SHA, and the branch's last commit removes `docs/pr-pictures/` before merge (the
   `pr-description` skill has the exact steps, "Pictures that display on a phone"). A picture worth
   keeping for the record goes in `docs/history/screenshots/` instead, as that folder's README says.
4. A before/after pair: run the same script on `origin/main` (a worktree) and on the branch, with
   different `--name`s. See [`DEVELOPMENT.md`](../../../DEVELOPMENT.md) section 3 for how to size
   the Demo to the change.

## Tests and screenshots built on it

- `tests/playtest.test.ts` is the pattern for asserting a flow in the test suite: `parseKeyScript` +
  `runBuildPlaytest`, then assert on `frames[n].state` and `frameToText(frames[n].frame)`.
- `scripts/capture-build-phase-screenshots.mjs` composes most Build Phase screenshots this way
  (`scripted(...)`, `scriptedGif(...)`), keeping only the shots that prove the terminal path itself on
  tmux. Add a flow shot there as a key script plus the text its frame must contain.
- Images whose content did not change are not rewritten (a hash rides inside each PNG/GIF);
  `--force` re-renders anyway.

## Extending to another screen

Only the Build Phase is wired. For the title menu, write a sibling of `src/playtest/build.ts` (take
steps, drive that screen's session through `handleData`, return frames), and let `--at` pick it: a title
menu route is refused today exactly where it would be handed over (`playtestOpening`). A `grid` battle
is not a place in the game and would take its own option. The key grammar and the image code
(`scripts/lib/frame-capture.mjs`) do not change.
