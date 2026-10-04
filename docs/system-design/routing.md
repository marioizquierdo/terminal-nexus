# Terminal Nexus — routing

_How a place in the game is named and reached: the route grammar, every route that exists, how a route reaches each screen, how to add a place, the planned saved-game start, and the browser page's links. Every unmarked statement is GUIDANCE._

## 1. What a route is

A **route** names a place in the game the way a web address names a page, without the site: the place,
then optionally `?` and `name=value` pairs joined by `&`.

```
settings
campaign?level=vasse-test-1&round=3
```

**One grammar for every way of going somewhere** (RULE — `tests/route.test.ts`, `tests/route-open.test.ts`):

- `terminal-nexus --at <route>` opens the game there;
- `node scripts/playtest.mjs --at <route>` opens a scripted playtest there (a campaign level only);
- every title menu row that opens a place names its route, and choosing the row follows it;
- the browser playtest page opens `#at=<route>`, its mode buttons open their routes, and a demo may carry
  an `at`.

How a route is read (`parseRoute`, `src/cli/route.ts`):

- An empty route is `menu`. A leading or trailing `/` is an address's habit and is ignored.
- Place names and query names are read whatever their case; a level's id is matched exactly.
- Any part may be percent-encoded (`%20` for a space), as an address's often are. The query is split off
  before anything is decoded, so an encoded `?` belongs to the place's name.
- **A route that is not a place is refused whole, with every problem at once**, each naming what was
  written and what exists instead: the places, the query names the place reads, the levels, a level's
  rounds. Nothing opens. (RULE — `tests/route.test.ts`, `tests/terminal-nexus-cli.test.ts`)
- On a command line, quote a route with `?` or `&` in it: the shell reads both itself.

## 2. Every route today

| Route | Opens |
| --- | --- |
| `menu`, or nothing | the title menu: Campaign, Challenge, Settings, About, Exit |
| `campaign` | the title menu's Campaign screen, a placeholder until the campaign menu is built |
| `challenge` | the title menu with Challenge's "not built yet" notice, as choosing its row shows it |
| `settings` | the title menu's Settings screen |
| `about` | the title menu's About screen |
| `campaign?level=vasse-test-1` | PERIMETER's Build Phase, round 1 |
| `campaign?level=vasse-test-1&round=2` | its round 2 (`&round=3`, its last) |
| `campaign?level=vasse-test-1&wave=0` | round 1 again, counted as a wave |

Every level the game can open is a route the same way, `campaign?level=<id>` with each of its rounds;
the Commander's cadence test map joins the table as soon as the level list names it. `terminal-nexus
--help` prints the places and the levels from the same table and list, so it never names one the game
does not have.

**Round and wave.** `round` counts from 1, as the screen counts ("round 2 of 3"), and is the route's own
word. `wave` counts from 0 and names the same round: `wave=N` is `round=N+1`, on any level. It exists
because the owner's first route was written `campaign?level=vasse-test-1&wave=0`: a wave is what a
mission brings during a round, and PERIMETER brings its first in round 1, its second in round 2, its
third in round 3. A route gives one or the other, never both.

**A later round is reached as a player who builds nothing reaches it**: the rounds before it are played
out, the first Nexus power picked each time, with the run's own settings and Experiments (`openRound`,
`src/cli/levels.ts`). A route to round 2 therefore opens exactly the screen the keys `Esc n 1 s s`, a
wait and `Enter` reach, every time (RULE — `tests/route-open.test.ts`).

## 3. How a route reaches its screen

`parseRoute` turns a route into a **destination**: a place on the title menu, or a level at a round.
What happens next depends on who asked.

- **The game** (`src/cli/terminal-nexus.ts`). A title menu place runs the title menu's loop opened at it
  (`runMenu`'s `at`); a level runs the Build Phase's loop on that level at that round (`runBuildPhase`'s
  `level` and `round`), with everything the old flag had: the settings store, the export, `--settings`,
  `--keys` and `--scroll-margin`. `--keys` and `--scroll-margin` on a title menu route are refused, since
  nothing there reads them.
- **The title menu** (`src/cli/menu.ts`). Each row that opens a place names its route. Choosing the row
  and opening at its route go through one `follow`, so they can never lead to two different screens
  (RULE — `tests/route-open.test.ts`: the same frame either way). Opening at a place leaves its row
  highlighted, so Esc comes back to it as it would for a player who chose it. Exit names no route: it
  opens no place.
- **The scripted playtest** (`playtestOpening`, `src/playtest/build.ts`). A level at a round, with no
  keys needed to walk there; a title menu route is refused with a message saying so, until the title
  menu has a scripted playtest of its own.
- **The browser page** (`src/web/host.ts`): section 6.

## 4. Adding a place

A place is **one entry in `PLACES`** (`src/cli/route.ts`): what it opens in a few words, the query names
it reads and what each means, where its query leads, and the routes it names. `--help`, the table above
and the test that opens every route all read that entry.

A place that opens a screen nothing opens yet also needs that screen to follow it: a new title menu
screen is a row naming its route and a line in the menu's `PLACE_SCREENS`; a new kind of destination makes
the type checker name every place that must learn it — the game's dispatch, the browser page, the
scripted playtest. A new campaign level needs no entry here at all: `campaign?level=<id>` reads the levels
the game can open (`src/cli/levels.ts`).

IDEA — places a later step could name, none built: a level's round straight into its Pulse; the run
screen, once Challenge exists; a saved replay, once the replay file exists.

## 5. The bare command and the saved game

A bare `terminal-nexus` opens the title menu. That is a stand-in.

IDEA — **the intended start**: once the game can save, a bare launch continues the saved game from its
default place beside the settings (a file in `~/.terminal-nexus/`, next to `settings.json`), and opens the
title menu only when there is no saved game. `--at` stays the way to go anywhere else, saved game or not;
where a saved game resumes is itself a place a route can name. Nothing saves yet.

`--build-phase` and its older name `--spike` are `--at campaign?level=vasse-test-1` for one more release,
so pasted commands keep working; `--at` wins when both are given.

## 6. The browser page's links

The page reads its address after `#` (`src/web/address.ts`):

| Part | Is | Example |
| --- | --- | --- |
| `at=` | where to open: a route | `#at=campaign?level=vasse-test-1&round=3` |
| `settings=` | a settings text for a campaign level, as `--settings` takes it | `&settings=trainEvery=6&reducedMotion=true` |
| `keys=` | a key script played first on a campaign level, as `--keys` takes it | `&keys=Esc n 1` |

**A route and a settings text have `&` and `=` of their own**, so a part runs until the next `&at=`,
`&settings=` or `&keys=`, not until the next `&`: it is written as plainly as on a command line (RULE —
`tests/web.test.ts`). Any part may also be percent-encoded. Without `#at=` the page opens PERIMETER's
first round, as it always has, so `#settings=` and `#keys=` alone still work; a route that is not a place
opens that same default, with the problems written under the screen.

The mode buttons that are game screens open their routes (Menu is `menu`, Build Phase is
`campaign?level=vasse-test-1`); the two Pulse replays are the engine tool's battles, not places in the
game.

**A link on claude.ai cannot carry a `#` part with `=` in it**; a copy of the page opened from disk can.
A published page opens at a place through a demo instead: a demo in `scripts/demos/*.json` may carry an
`at` beside its `keys` and `settings`, checked when the page is built with the game's own readers
(`src/web/demos.ts`), so a demo opens round 2 without a key script walking there.
