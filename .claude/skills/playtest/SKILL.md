---
name: playtest
description: Press keys on the Terminal Nexus screens — the title menu, the Skirmish setup screen and the Build Phase — without a terminal and get back every step's screen as text, PNGs and an animated GIF (scripts/playtest.mjs). Use to see a change working, to check a flow someone described ("Down, Down, Space, Space"), to reproduce a playtest report, and to make the before/after pictures or GIF a pull request shows. Prefer it over tmux screenshots for anything about layout or a flow; it cannot capture one key early.
---

# Scripted playtests

`scripts/playtest.mjs` takes a key script, feeds it one key at a time through the real keyboard and
mouse adapters (`BuildSession.handleData` on a Build Phase, `TitleScreens.handleKey` on the title menu) as the exact
bytes a terminal sends, and composes the frame after every key with the same composer the live screen uses. It follows
the game from screen to screen: New game's Start (or a loaded save's Open) hands the rest of the script to that
battle's Build Phase, and a result's `[m] Setup screen` hands it back to New game (`src/playtest/game.ts`). No
terminal, no timing, no race.

## Commands

```bash
node scripts/playtest.mjs --keys "Esc Down Down Space*4"             # status per step + final screen
node scripts/playtest.mjs --keys "Esc Down Down Space*4" --print all # every step's full screen
node scripts/playtest.mjs --keys "Esc n 1 Tab S-Left*5" --png final  # one PNG
node scripts/playtest.mjs --keys "Esc Down Down Space*4" --gif --name hatchery-run
node scripts/playtest.mjs --file flow.keys --size 104x30 --colors monochrome --png all
node scripts/playtest.mjs --settings "popupPulseMs=3000 nextRound=auto" --keys "Esc 1 Enter"  # start from an export
node scripts/playtest.mjs --keys "Esc n 1 1 Enter" --activity Interactions   # what the run recorded
node scripts/playtest.mjs --at 'story?mission=vasse-test-1&round=3' --png final   # round 3, no keys at all
node scripts/playtest.mjs --at 'story?mission=vasse-test-1&round=2' --keys "n 1 s s wait~1000*26"
node scripts/playtest.mjs --at 'skirmish?seed=7' --keys "Esc n 1 1 Enter"    # a Skirmish: a power, a building
node scripts/playtest.mjs --load tmp/mine.save.json --p2 script:rush          # a save, at its Build Phase
node scripts/playtest.mjs --at menu --keys "1 1 1 2 s Esc"   # title -> Skirmish -> New game: the Pocket, Averno, Start
node scripts/playtest.mjs --at 'skirmish?setup=load' --keys "2 1 s Esc s"   # Load game: round 4, p1 a script, watch
node scripts/playtest.mjs --note .playtest/notes/note-20261112-153012.note.json     # a playtest note (!), at its moment
node scripts/playtest.mjs --help
```

**Start from a save.** A change to the battle or the Build Phase is seen in a Skirmish, not in PERIMETER, and with no
`--at`, `--load` or `--note` the script opens `saves/crossing-new.save.json` (a new battle on the Crossing, Vasse
against Dob Hunter's `balanced` script, seed 7; Esc skips its opening lines). `--load <save>` opens another at its
Build Phase with the plan it was saved with, and `--p1`/`--p2` as the `skirmish` command takes them
([`skirmish-saves.md`](../../../docs/system-design/skirmish-saves.md)). Which save shows what: `crossing-new` round 1
and its first hand; `crossing-round-4` bases built and armies regrouped; `mirror-vasse` both slots scripted
(spectating); `pocket-short` a whole battle to its result and `[m] Setup screen` in a few rounds (`--p1 script:agro` to
watch it). Open a mission (`--at 'story?mission=vasse-test-1'`) only for a change about missions.

**The title menu and the setup screen**: `--at menu`, `--at 'skirmish?setup'`, `--at 'skirmish?setup=new'` or
`--at 'skirmish?setup=load'`. New game opens on Start, so `Enter` starts its defaults; `1`-`0` come a row round (the
map, each slot's Commander, who plays it, its credits, the modifiers), `e` types the seed (digits, Enter), `s` starts.
New game's seed comes from a fixed clock (567890), so a script plays the same battle every run. Load game lists the
script's own saves folder (`.playtest/saves/`, or `--saves <dir>`) then `saves/`; a row's key chooses one, its rows change who
plays each side, `s` opens it. The name a `Player` slot shows is `--player <name>` (`player` unless given). The
summary line of a title step says the screen, its highlighted row and its notice.

**A note** (`!`, on any screen, a line, Enter) is written into `.playtest/notes/` (or `--notes <dir>`): a script never
writes into the player's own notes. `--note <file>` opens it at its moment: its round as it opened, the commands
pressed since replayed at their times, the very screen the note shows; `--keys` go on from there.

**Save game in a script**: `Esc v`, then the name (`Bksp*40` clears the offered one, then `type:mine`; Space types
`-`), then `Enter`. A bare name goes into the script's own saves folder (`.playtest/saves/`, git-ignored, or
`--saves <dir>`), never the player's; a name with a folder is written there, from the working folder. The file then
opens with `--load .playtest/saves/mine.save.json`, on the round it was saved at, with the plan restored, or from the
title menu: `--at 'skirmish?setup=load'`.

`--at <route>` opens a mission at a round, in the game's own route grammar (`src/cli/route.ts`,
the same as `terminal-nexus --at`): `story?mission=vasse-test-1` is PERIMETER's first round, and `&round=3` its third Battle Round, counted from 1 as the screen counts. A later round is reached as a player who builds nothing and keeps no Nexus power
reaches it, played with the run's `--settings`, so it is the very screen the keys `Esc s s wait~1000*26
Enter` reach for round 2, without them (the battle lasts about 21 seconds, then the
result Enter goes on from). Quote the route: the shell reads `?` and `&`. A title menu route opens that screen; with
`--at`, `--load` or `--note`, `--keys` may be left out to see the screen as it opens.

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
ten seconds in quarter-second frames. It is how a script watches a Battle Round. Mouse: `click:X,Y` clicks Grid tile X,Y wherever the camera has it drawn right now (fails if
it is off screen), `click@COL,ROW` clicks a 0-based screen cell; `rclick`, `wheelup`, `wheeldown` take
the same targets. `#` starts a comment in a `--file`. The table with bytes is at the top of
`src/playtest/keys.ts`. An unknown name is an error, never a guess.

## Useful openings

Each reaches a state on a Build Phase — the scripted playtest's own save unless `--at` or `--load` says another; the
ones that name the raid are PERIMETER's (`--at 'story?mission=vasse-test-1'`); what the screens are and every key on them is in
[`docs/system-design/ui-patterns.md`](../../../docs/system-design/ui-patterns.md) and
[`docs/system-design/input.md`](../../../docs/system-design/input.md). **A round opens on its lines** (a Skirmish's
opening, PERIMETER's intro), the dialog at the bottom, which holds the keyboard: every opening below starts after `Esc`,
which skips it (`Enter` reads the next line; `--keys "Enter Enter Enter" --png all` shows each line).

- `n 1`: pick the first Nexus power dealt; the popup closes and the highlight stays on the Nexus Pulse row. The hand
  is two powers dealt from the pool, then War Chest (`n 3`, 2000 to spend), dealt the same way every run.
- `n 1 Down Down Space`: arm the Hatchery from the menu; the panel becomes its card.
- `n 1 PgDn Enter`: the Battle Round screen (`PgDn` goes to the last row, Start Battle Round; without a power
  picked first, the bottom line says so instead).
- `s s wait~1000*20`: a whole Battle Round with nothing built and no power kept, twenty seconds in; the second `s`
  starts it.
- `--at 'story?mission=vasse-test-1&round=2'` with no keys: round 2 as it opens, round 1 played with
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
- `./bin/terminal-nexus.ts --at 'story?mission=vasse-test-1' --keys "Esc n 1 1 Enter"`: the same route
  and key script open the live game in a state (`#at=story?mission=vasse-test-1&keys=Esc n 1 1 Enter` on
  a local copy of the browser page; a demo's `at` and `keys` on a published one), for a demo or to hand
  Mario the exact state a report is about.

What a script cannot show is time between keys on the live screen: the view sliding, a flash, a
building going up (script frames always draw buildings finished). Two things are the exception, since a
`wait` moves their clock: a Battle Round, and the raid's intent trail, whose arrows step on toward what the raid
goes for from the first frame that drew them moving (after `Esc` closes PERIMETER's intro, or as a round
opened by `--at` starts). `--at 'story?mission=vasse-test-1&round=2' --keys "wait~100*23" --gif --delay 100
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

The title menu and the Build Phase are wired (`src/playtest/game.ts` runs `TitleScreens` and a `BuildDriver`,
`src/playtest/build.ts`, and hands the script between them). Another screen gets a driver of the same shape (take a
step, return its frame) and a place in `runGamePlaytest`'s hand-over. A `grid` battle is not a place in the game and
would take its own option. The key grammar and the image code (`scripts/lib/frame-capture.mjs`) do not change.
