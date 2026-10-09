# How ASCII roguelikes move a cursor and run — what we could read and play

Mario, after the build with no acceleration ([his words](../feedback/2026-10-08-keyboard-without-acceleration.md)):
"Let's do some research about how other ascii games solve navigation. I think this is a well-known problem that
we can probably check online for documentation or even try the game ourselves with a tui probe (headless
terminal). Check how navigation works on other ascii roguelikes like Brogue, Nethack, rogue, Moria, Cogmind,
ADOM."

Terminal Nexus's Build Phase has a **free cursor** on a map bigger than the screen: the player points at a tile to
build on or look at. That is a different problem from walking a character, and most of these games solve both, in
different places. This report separates them.

**How each fact was learned**, because the sources are not equal:

- **Played** — the game ran in a headless terminal (tmux, 80 × 24, or 110 × 36 for Brogue) and its own screen was
  captured. NetHack 3.6.7, Rogue (the "Rogue Clone III" that Debian packages as `rogue`, not the original 5.4), Umoria 5.7.13, Dungeon Crawl Stone Soup
  0.28 (not on Mario's list; added because its cursor help is the fullest), Brogue CE 1.15.1 (built from source,
  text-mode front-end).
- **Read in the game's own help or manual** — the text the installed game ships.
- **Read in source** — Brogue CE and Umoria on GitHub (read only).
- **Search snippet only** — Cogmind and ADOM. Both are proprietary, neither runs here, and every site that documents
  them (Grid Sage Games, Steam forums, adom.de, NetHack.org, the Brogue wiki, the NetHack wiki) is blocked by this
  environment's network policy, so only the one-paragraph summaries a web search returns were seen. Treat them as
  leads, not facts.

## Surprises first

1. **None of them accelerate by timing.** In every game that was played or read, a key moves the same distance
   every time. Speed comes from a modifier or a separate command, never from how fast or how long a key is
   pressed. That is where the build with no acceleration already is.
2. **The "big step" is small and fixed: 5, 7 or 8 cells.** NetHack's capital `HJKL` move the cursor 8; Brogue's
   Shift or Ctrl moves it 5 (`moveIncrement = (controlKey || shiftKey) ? 5 : 1` in `moveCursor`); Crawl's Shift
   moves it 7, and the number is a setting (`level_map_cursor_step`). Ours is 10, and a row on screen is about two
   columns tall, so ten rows up or down is twice as far to the eye as ten across.
3. **The real answer to "far away" is a jump-to-thing key, not a faster cursor.** NetHack has `m` monsters, `o`
   objects, `d` doors, `x` unexplored places, `a` anything interesting, and typing a map symbol such as `<` jumps to
   the next one. Brogue has Tab and Shift-Tab through monsters, items and terrain features. Crawl has `<` `>`
   stairs, `^` traps, `_` altars, `I` and `O` items, `\` shops, `o` the next place to explore, and waypoints.
   Cogmind (snippet) has Tab through targets, nearest first. Nobody expects the player to push a cursor across
   empty ground.
4. **NetHack's "skip same glyphs" mode is a cursor that runs.** Pressing `*` in its position prompt changes `HJKL`
   from "8 cells" to "move to the next cell that looks different". It is the same idea as a character's run,
   applied to the cursor, and it is what a building game would want: from the Nexus, one key to the edge of the
   build range, the next building, the next deposit.
5. **The cursor tells you what is under it, as it moves.** NetHack's autodescribe printed `doorway`, `tame kitten`,
   `staircase up`, and `unexplored (no travel path)` as the cursor landed. Brogue shows the thing in its sidebar and
   a line of flavour text. Explore Map in Terminal Nexus already does this.

## NetHack 3.6.7 — played, and read in its help

Moving the character, from the game's own `cmdhelp` and `hh` files:

- `yuhjklbn` one step. `YUHJKLBN` (Shift) "go in specified direction until you hit a wall or run into something".
- `g<dir>` or Ctrl-direction runs "until something interesting is seen"; `G<dir>` is the same "except a branching
  corridor isn't considered interesting". `m<dir>` moves without picking up or fighting. `n` starts a count.
- `_` is travel: it asks "Where do you want to travel to?" and takes a position from the cursor.

Moving the cursor (the position prompt that travel, look and targeting share), captured from the game by pressing
`_` and then `?`:

```
Use 'h', 'j', 'k', 'l' to move the cursor to the desired destination.
Use 'H', 'J', 'K', 'L' to fast-move the cursor, 8 units at a time.
Or enter a background symbol (ex. '<').
Use '@' to move the cursor on yourself.
Use 'm'/'M' to move the cursor to next/previous monster.
Use 'o'/'O' to move the cursor to next/previous object.
Use 'd'/'D' to move the cursor to next/previous door or doorway.
Use 'x'/'X' to move the cursor to unexplored location.
Use 'a'/'A' to move the cursor to anything interesting.
Use '*' to change fast-move mode to skipping same glyphs.
Use '!' to toggle menu listing for possible targets.
Use '"' to change the mode of limiting possible targets.
Use '#' to toggle automatic description.
Type a '.' when you are at the right place.
```

Played: `L` moved the cursor from column 68 to 76 (8 right) and the game said "unexplored (no travel path)"; `d` went
to a doorway, `m` to the pet, `@` back to the player, `<` to the staircase; `d` then `.` walked the hero toward
the door until a jackal's bite interrupted the walk.

## Brogue CE 1.15.1 — played, and read in source

From the in-game help (`?`): the mouse moves a cursor (and describes what it is over), click travels, Ctrl-click
advances one space; **`Return` turns on a keyboard cursor, `Space` or `Esc` turns it off**; `hjklyubn`, arrows or
numpad move or attack, "control or shift to run"; `<` and `>` travel to the stairs; `x` explores automatically.

From the source (`src/brogue/Items.c`, `moveCursor` and `nextTargetAfter`; `IO.c`, `Movement.c`):

- In keyboard-cursor mode a direction moves the cursor 1, **or 5 with Shift or Ctrl**.
- **Tab and Shift-Tab cycle the cursor through the monsters, items and terrain features listed in the sidebar**,
  forward and backward. Played: after `Return`, `Tab` jumped to a scroll lying in the water and the sidebar and
  message line described it.
- `Return` confirms: the player travels there. A target one step away is simply stepped onto.
- A character's run (`playerRuns`) stops when something disturbs it, and also when the passability of the cells
  beside it changes: a doorway or a side corridor ends the run, a plain straight corridor does not.

## Rogue (Rogue Clone III) — played, and read in its help

Its `?` screen lists `<SHIFT><dir>: run that way` and `<CTRL><dir>: run till adjacent`: two kinds of run on two
modifiers (the original Rogue's key list says the same, from memory, not checked here), one that stops only at an obstacle and one that stops next to anything. Played: Shift-`L` ran east and
stopped four cells later when a bat and a hobgoblin came near.

## Umoria 5.7.13 (the Moria family) — read in its help and source

- Original keys: `.` plus a direction runs. Roguelike keys: Shift plus a direction runs. A count (`#` then digits, a
  space, then the command) repeats a move; any keypress ends it.
- **`L` is "Locate with map", a mode for moving the view, not a cursor.** Each direction key scrolls the view by
  half a screen (`SCREEN_WIDTH / 2` and `SCREEN_HEIGHT / 2`) and the prompt says "Map sector [y,x], which is North
  of your sector. Look which direction?"; `M` shows the whole level, reduced.
- `l` plus a direction looks in that direction. No free map cursor was seen in its help.

## Dungeon Crawl Stone Soup 0.28 — played, and read in its manual (not on the list; the fullest example)

The level map (`X`) and look (`x`) share one cursor. Its help screen, captured:

```
Dir.       : Move the cursor.
Shift-Dir. : Move the cursor in larger steps (7 by default).
- or +     : Scroll level map 20 grids up or down.
.          : Start travel (also Enter and , and ;).
             (Moves cursor to the last travel destination if still on @.)
o          : Move the cursor to the next autoexplore target.
< or >     : Cycle through up or down stairs.
^          : Cycle through traps.
\ or Tab   : Cycle through shops and portals.
I          : Cycle forward through all items.
O          : Cycle backward through all items.
_          : Cycle through altars.
Ctrl-W     : Set waypoint to current position.
W          : Cycle through all waypoints on the level.
```

Also from its manual: Shift-direction on the map "moves straight until something interesting is found (like a
monster)"; `G` travels between levels; interrupted travel remembers its destination; targeting starts the cursor on
the nearest monster (or the last target), `+` and `-` step to the next or previous monster, and Shift-direction
fires straight away. Options worth noting: `level_map_cursor_step = 7`, `travel_key_stop` (a keypress stops
travel), and for its graphical build `tile_key_repeat_delay = 200` (how long a held key waits before repeating).

## Cogmind — search snippets only (unverified)

Summaries of forum posts and Grid Sage Games' posts, not opened. They say: Shift is run-move, and a run stops at
doors and at side corridors while following a wall; examine mode (`x`) moves a keyboard cursor, `d` opens details,
`s` centres the screen there, and **Shift-Alt-g travels to the cursor ("works like a left-click")**; firing mode
(`f`) cycles targets with Tab or Shift-Tab, `-`/`=` or numpad `-`/`+`, nearest first, starting on the last target;
modifiers follow a scheme (Ctrl for attaching parts, Alt for detaching, Shift for information).

## ADOM — search snippets only (unverified)

A Steam community key list says the number pad moves, `w` plus a direction is an "extended walk", and `l` looks;
a developer reply says commands that ask for a map position have the number pad and arrows hard-coded, apart from
the rebindable movement keys; bindings live in `adom.kbd`. Nothing found confirms Shift-run or a travel command.

## What this suggests for Terminal Nexus

These are suggestions to try, not decisions.

1. **Keep no acceleration and a Shift step.** It matches every game that could be read. Their steps are 5, 7 and
   8; the Shift step Experiment already offers 5 and 8 beside the default 10, so Mario can feel the difference.
2. **Make the step a setting, as Crawl does.** Done: Shift step.
3. **Add "to the next different thing" as a third kind of Shift step**, from NetHack's `*` mode: Shift plus an
   arrow runs the cursor until the tile changes (a building, a deposit, the edge of the build range). It is the
   cursor version of the character's run, it needs no number, and it suits a map where things stand in clusters.
4. **Add jump-to-thing keys.** This is what every game leans on. Candidates for the Build Phase: the player's
   Nexus, each of the player's buildings, the raid's arrival groups, deposits, and what has been planned this
   round. The open design question is the key: Tab is already focus between the menu and the map, and the
   left hand's letters are hotkeys, so the pair could be brackets, comma and period, or a letter under the right
   hand; Brogue and Cogmind both use Tab.
5. **Keep the cursor describing what it is over** (already true in Explore Map), and consider saying when a place
   cannot be built on, the way NetHack says "no travel path".
6. **The map's view is a separate matter.** Umoria's Locate scrolls the view by half a screen without moving
   anything; Terminal Nexus's view follows the cursor at a margin. If a long map ever needs looking at without
   moving the cursor, that is the precedent.

## What is still unknown, and how to close it

- Cogmind's and ADOM's real key lists, and how Cogmind's cursor steps. Allowing these hosts in the environment's
  network settings would let them be read: `www.gridsagegames.com`, `steamcommunity.com`,
  `cdn.steamstatic.com`, `www.adom.de`, `www.ancientdomainsofmystery.com`; for the others, `www.nethack.org`,
  `nethackwiki.com`, `brogue.wiki`. Neither game can be played here (both proprietary; Cogmind is Windows).
- How any of these feel with a key held down. None of them uses a held key to go faster; the games that run in a
  graphical window leave key repeat to the operating system (Crawl's `tile_key_repeat_delay` is the one setting
  seen). Whether a held arrow should repeat at all is Mario's to feel.

## Sources

Played and read locally: NetHack 3.6.7 (`nethack-console`, its `cmdhelp`, `hh` and in-game `?`), Rogue Clone III
(`bsdgames-nonfree` 2.17), Umoria 5.7.13 (its `help.txt` and `rl_help.txt`), Dungeon Crawl Stone Soup 0.28
(`/usr/share/crawl/docs/crawl_manual.txt`, `options_guide.txt`, and the in-game map help).
Read in source: [Brogue CE](https://github.com/tmewett/BrogueCE) (`Items.c`, `IO.c`, `Movement.c`),
[Umoria](https://github.com/dungeons-of-moria/umoria) (`game_run.cpp`).
Found by search, not opened (blocked here):
[Brogue wiki commands](https://brogue.wiki/wiki/Commands),
[Cogmind movement quality of life](https://www.gridsagegames.com/blog/2019/11/movement-qol/),
[Cogmind keyboard controls thread](https://steamcommunity.com/app/722730/discussions/0/1480982338950037839/),
[ADOM key list](https://steamcommunity.com/app/333300/discussions/0/3055112985293983516/),
[the ADOM developer's note on notebook keyboards](https://www.ancientdomainsofmystery.com/2011/10/trouble-with-notebook-keyboards.html).
