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

**A route is read with the rest of a launch.** Where a run opens, the settings text it starts with and the keys
it plays first are read once, the same way, whichever way the run was started — the game's `--at`, `--settings`
and `--keys`, the scripted playtest's same three, the page's `#at=`, `#settings=` and `#keys=`, a demo's `at`,
`settings` and `keys` (`readLaunch`, `src/cli/launch.ts`). Each only finds the texts and says where they came
from. What a host does with a part it cannot read is its own: the game and the scripted playtest refuse the
launch, the page opens the default level's first round and says why under the screen, the build refuses the
demo. Where a launch opens when it names no place is the host's too: the title menu for the game, the default
level's first round elsewhere. (RULE — `tests/launch.test.ts`)

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
| `campaign?level=vasse-test-2` | the Commander's cadence, the campaign's second test level: Vasse falls in round 1 |
| `campaign?level=vasse-test-2&round=2` | its round 2, which opens on a line saying she is out |
| `campaign?level=vasse-test-2&round=3` | its round 3, which opens on her return |

Every level the game can open is a route the same way, `campaign?level=<id>` with each of its rounds: the
levels are every shipped campaign's, from its army ([`content.md`](content.md)). `terminal-nexus --help`
prints the places and the levels from the same table and list, so it never names one the game does not
have.

**Battle Rounds.** `round` counts Battle Rounds from 1, as the screen counts ("round 2 of 3"), and is the
only way a route names one: the owner's first route counted from 0 with another word, and he then settled
the word (2026-10-04, "let's settle in Battle Rounds"). A route that says anything else is refused like any
query name the place does not read, naming `level` and `round` as what `campaign` reads.

**A later round is reached as a player who builds nothing reaches it**: the rounds before it are played
out with no Nexus power kept (a power would change the battle), with the run's own settings and Experiments
(`openRound`, `src/cli/levels.ts`). A route to round 2 therefore opens exactly the screen the keys `Esc s s`, a
wait and `Enter` reach, every time (RULE — `tests/route-open.test.ts`).

## 3. How a route reaches its screen

`parseRoute` turns a route into a **destination**: a place on the title menu, or a level at a round.
What happens next depends on who asked.

- **The game** (`src/cli/terminal-nexus.ts`). A title menu place runs the title menu's loop, a level the
  Build Phase's loop at that round; both take the destination as `at`, with the settings store, the export,
  `--settings` and, on a campaign level, `--keys` and `--scroll-margin`. `--keys` and `--scroll-margin` on a
  title menu route are refused, since nothing there reads them; `--settings` there applies its player settings
  to the menu. **An argument the game does not read is refused before any screen**, so a command pasted from
  an older note never opens somewhere it did not mean; the removed `--build-phase` and `--spike` say that
  `--at 'campaign?level=vasse-test-1'` replaced them. (RULE — `tests/terminal-nexus-cli.test.ts`)
- **The title menu** (`src/cli/menu.ts`). Each row that opens a place names its route. Choosing the row
  and opening at its route go through one `follow`, so they can never lead to two different screens
  (RULE — `tests/route-open.test.ts`: the same frame either way). Opening at a place leaves its row
  highlighted, so Esc comes back to it as it would for a player who chose it. Exit names no route: it
  opens no place. Each place's screen and the line it says there (Campaign's placeholder, Challenge's
  notice) is one entry in the menu's `PLACE_SCREENS`; Back and Esc follow the menu's own route.
- **The scripted playtest** (`playtestOpening`, `src/playtest/build.ts`) reads its `--at`, `--settings` and
  `--keys` (or `--file`) as a launch: a level at a round, PERIMETER's first unless given, with no keys needed
  to walk there. A title menu route is refused with a message saying so, until the title menu has a scripted
  playtest of its own, and so is a key that does not exist.
- **The browser page** (`src/web/host.ts`): section 6.

## 4. Adding a place

A place is **one entry in `PLACES`** (`src/cli/route.ts`): what it opens in a few words, the query names
it reads and what each means, where its query leads, and the routes it names. `--help`, the table above
and the test that opens every route all read that entry.

A place that opens a screen nothing opens yet also needs that screen to follow it: a new title menu
screen is a row naming its route and a line in the menu's `PLACE_SCREENS` (its screen, and what it says
there); a new kind of destination makes
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

## 6. The browser page's links

The page reads its address after `#` (`src/web/address.ts`):

| Part | Is | Example |
| --- | --- | --- |
| `at=` | where to open: a route | `#at=campaign?level=vasse-test-1&round=3` |
| `settings=` | a settings text for a campaign level, as `--settings` takes it | `&settings=jumpStep=12&reducedMotion=true` |
| `keys=` | a key script played first on a campaign level, as `--keys` takes it | `&keys=Esc n 1` |

**A route and a settings text have `&` and `=` of their own**, so a part runs until the next `&at=`,
`&settings=` or `&keys=`, not until the next `&`: it is written as plainly as on a command line (RULE —
`tests/web.test.ts`). Any part may also be percent-encoded. Without `#at=` the page opens PERIMETER's
first round, as it always has, so `#settings=` and `#keys=` alone still work; a route that is not a place
opens that same default, with the problems written under the screen.

The page reads its address as a launch (`src/cli/launch.ts`): its parts are the launch's, so a part added
there is one the address reads.

The mode buttons that are game screens open their routes (Menu is `menu`, Build Phase is
`campaign?level=vasse-test-1`); the two Pulse replays are the engine tool's battles, not places in the
game.

**A link on claude.ai cannot carry a `#` part with `=` in it**; a copy of the page opened from disk can.
A published page opens at a place through a demo instead: a demo in `scripts/demos/*.json` may carry an
`at` beside its `keys` and `settings`, checked when the page is built with the game's own readers
(`src/web/demos.ts`), so a demo opens round 2 without a key script walking there.
