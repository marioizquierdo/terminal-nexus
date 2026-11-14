# Terminal Nexus — routing

_How a place in the game is named and reached: the route grammar, every route that exists, how a route reaches each screen, how to add a place, the bare command and save files, and the browser page's links. Every unmarked statement is GUIDANCE._

**Status: built.** Everything here that carries a RULE marking is implemented (`src/cli/route.ts`, `src/cli/launch.ts`)
and tested. Not built, and marked **IDEA** where they appear: a route straight into a mission round's Battle Round, a
route to a saved replay (there is no replay file, [`replay-format.md`](replay-format.md)), and a bare launch that
resumes the last save. This page is about addresses of screens; how troops route is [`movement.md`](movement.md).

## 1. What a route is

A **route** names a place in the game the way a web address names a page, without the site: the place,
then optionally `?` and `name=value` pairs joined by `&`.

```
settings
skirmish?seed=1234
story?mission=vasse-test-1&round=3
```

**One grammar for every way of going somewhere** (RULE — `tests/route.test.ts`, `tests/route-open.test.ts`):

- `terminal-nexus --at <route>` opens the game there;
- `node scripts/playtest.mjs --at <route>` opens a scripted playtest there (a title menu screen, a mission or a
  Skirmish);
- `--load <file>`, on the game and on the scripted playtest, is the route `skirmish?load=<file>`;
- `--note <file>`, on the game and on the scripted playtest, opens a playtest note at its moment: a title menu note at
  its screen's route, a Build Phase note at its round, its commands replayed ([`skirmish-saves.md`](skirmish-saves.md),
  notes);
- every title menu row that opens a place names its route, and choosing the row follows it;
- the browser playtest page opens `#at=<route>`, its mode buttons open their routes, and a demo may carry
  an `at`.

**A route is read with the rest of a launch.** Where a run opens, the settings text it starts with and the keys
it plays first are read once, the same way, whichever way the run was started — the game's `--at`, `--settings`
and `--keys`, the scripted playtest's same three, the page's `#at=`, `#settings=` and `#keys=`, a demo's `at`,
`settings` and `keys` (`readLaunch`, `src/cli/launch.ts`). Each only finds the texts and says where they came
from. What a host does with a part it cannot read is its own: the game and the scripted playtest refuse the
launch, the page opens a new Skirmish and says why under the screen, the build refuses the demo. Where a launch
opens when it names no place is the host's too: the title menu for the game, the save
`saves/crossing-new.save.json` for the page and the scripted playtest, PERIMETER's first round for a demo. (RULE — `tests/launch.test.ts`)

How a route is read (`parseRoute`, `src/cli/route.ts`):

- An empty route is `menu`. A leading or trailing `/` is an address's habit and is ignored.
- Place names and query names are read whatever their case; a mission's id and a file's name are matched exactly.
- Any part may be percent-encoded (`%20` for a space), as an address's often are. The query is split off
  before anything is decoded, so an encoded `?` belongs to the place's name.
- **A route that is not a place is refused whole, with every problem at once**, each naming what was
  written and what exists instead: the places, the query names the place reads, the missions, a mission's
  rounds. Nothing opens. A place renamed says what replaced it: `campaign` is Story now, and Challenge runs are
  retired for `skirmish`. (RULE — `tests/route.test.ts`, `tests/terminal-nexus-cli.test.ts`)
- On a command line, quote a route with `?` or `&` in it: the shell reads both itself.

## 2. Every route today

| Route | Opens |
| --- | --- |
| `menu`, or nothing | the title menu: Skirmish, Story, Settings, About, Exit |
| `skirmish?setup` | the title menu's Skirmish screen: New game, Load game, as choosing its row opens it |
| `skirmish?setup=new` | New game: the setup screen, every row at its default, the highlight on Start |
| `skirmish?setup=load` | Load game: the saves folder, then the examples in `saves/` |
| `skirmish` | a Skirmish's first Build Phase on the defaults (Vasse against Dob Hunter's `balanced` script on the Crossing), on a seed from the clock |
| `skirmish?seed=1234` | the same battle on that seed |
| `skirmish?seed=7&map=pocket&p2=script:agro&p2-commander=averno&modifiers=fast-rounds` | a new battle set up as named, in the `skirmish` command's own words, read by its own reader (`src/skirmish/ask.ts`: `map`, `seed`, `ticks`, `rounds`, `modifiers`, `p1`, `p2`, `p1-commander`, `p2-commander`, `p1-credits`, `p2-credits`); what is not named is the default, and the game's flags take the same words (`--map pocket`). A battle started from the setup screen has this route, so it can be opened again |
| `skirmish?load=<file>` | a save file at its Build Phase, the plan it was saved with restored (`--load <file>` says the same) |
| `story` | the title menu's Story screen, a placeholder until the Story menu is built |
| `settings` | the title menu's Settings screen |
| `about` | the title menu's About screen |
| `story?mission=<id>` | that mission's Build Phase, round 1: `vasse-test-1` (PERIMETER, 3 rounds), `vasse-test-2` (the Commander's cadence: Vasse falls in round 1), `vasse-test-3` (the power curve's test level: six rounds, the Garrison locked until a Barracks stands), `averno-test-1` (the same curve with Averno in Vasse's place, five rounds) |
| `story?mission=<id>&round=<n>` | its round `n`, as the screen counts them (`vasse-test-2&round=2` opens on the Nexus Pulse restoring her) |

Every mission the game can open is a route the same way, `story?mission=<id>` with each of its rounds: the
missions are every shipped story's (`stories/<id>/story.json`, [`content.md`](content.md)). `terminal-nexus --help`
prints the places and the missions from the same table and list, so it never names one the game does not
have. A Skirmish's slots are not a route's: `--p1` and `--p2` beside it name who plays each, as the `skirmish` command
takes them ([`skirmish-saves.md`](skirmish-saves.md)).

**Battle Rounds.** `round` counts Battle Rounds from 1, as the screen counts ("round 2 of 3"), and is the
only way a route names one (the owner, 2026-10-04: "let's settle in Battle Rounds"). A route that says anything else
is refused like any query name the place does not read, naming `mission` and `round` as what `story` reads.

**A later round is reached as a player who builds nothing reaches it**: the rounds before it are played
out with no Nexus power kept (a power would change the battle), with the run's own settings and Experiments
(`openRound`, `src/cli/levels.ts`). A route to round 2 therefore opens exactly the screen the keys `Esc s s`, a
wait and `Enter` reach, every time (RULE — `tests/route-open.test.ts`).

## 3. How a route reaches its screen

`parseRoute` turns a route into a **destination**: a place on the title menu, a mission at a round, or a
Skirmish to open (a seed, the clock's, or a save file: the route never reads a clock or a file, the host does,
`openSkirmish` in `src/cli/skirmish-open.ts`). What happens next depends on who asked.

- **The game** (`src/cli/terminal-nexus.ts`). A title menu place runs the title menu's loop, a mission or a
  Skirmish the Build Phase's loop at that round; both take the destination as `at`, with the settings store, the
  export, Save game's writer, `--settings` and, on a Build Phase, `--keys` and `--scroll-margin`. A Skirmish is
  opened before any screen, with `--p1` and `--p2`: a save that cannot be read, or slots the screen cannot play (it
  plays p1, against a script in p2), are refused with every problem at once. `--keys` and `--scroll-margin` on a
  title menu route are refused, since nothing there reads them; `--settings` there applies its player settings
  to the menu. **An argument the game does not read is refused before any screen**, so a command pasted from
  an older note never opens somewhere it did not mean; the removed `--build-phase` and `--spike` say that
  `--at 'story?mission=vasse-test-1'` replaced them. (RULE — `tests/terminal-nexus-cli.test.ts`)
- **The title menu** (`src/cli/menu.ts`). Each row that opens a place names its route. Choosing the row
  and opening at its route go through one `follow`, so they can never lead to two different screens
  (RULE — `tests/route-open.test.ts`: the same frame either way). Opening at a place leaves its row
  highlighted, so Esc comes back to it as it would for a player who chose it. Exit names no route: it
  opens no place. Each place's screen and the line it says there (Story's placeholder) is one entry in the menu's
  `PLACE_SCREENS` (`src/cli/title-screens.ts`); Back and Esc follow the menu's own route. Skirmish's row names
  `skirmish?setup`, the Skirmish screen, whose rows name `skirmish?setup=new` and `skirmish?setup=load`. `setup` is the
  one query name that may stand without a value (a place's `flags`).
- **The scripted playtest** (`gameOpening`, `src/playtest/build.ts`) reads its `--at`, `--settings` and
  `--keys` (or `--file`) as a launch, and `--load`, `--note`, `--p1` and `--p2` as the game does: a title menu screen,
  a mission at a round, or a Skirmish (the save `saves/crossing-new.save.json` unless told), with no keys needed to walk
  there; a key that does not exist is refused.
- **The browser page** (`src/web/host.ts`): section 6.

## 4. Adding a place

A place is **one entry in `PLACES`** (`src/cli/route.ts`): what it opens in a few words, the query names
it reads and what each means, where its query leads, and the routes it names. `--help`, the table above
and the test that opens every route all read that entry.

A place that opens a screen nothing opens yet also needs that screen to follow it: a new title menu
screen is a row naming its route and a line in the menu's `PLACE_SCREENS` (its screen, and what it says
there); a new kind of destination makes
the type checker name every place that must learn it — the game's dispatch, the browser page, the
scripted playtest. A new mission needs no entry here at all: `story?mission=<id>` reads the missions
the game can open (`src/cli/levels.ts`).

IDEA — places a later step could name, none built: a mission's round straight into its Battle Round; a saved replay,
once the replay file exists.

## 5. The bare command and save files

A bare `terminal-nexus` opens the title menu. **Save game** (the Build Phase's game menu, on a Skirmish) writes a save
file: a name alone into `~/.terminal-nexus/saves/`, beside `settings.json`, a name with a folder where it says.
`--load <file>` (the route `skirmish?load=<file>`) opens one at its Build Phase, as Load game on the setup screen does.

IDEA — a bare launch could carry on the last save, opening the title menu only when there is none; the owner's session
("start the game again, choose skirmish => load game, and continue playing") goes through the title menu instead, so
this waits for his word.

## 6. The browser page's links

The page reads its address after `#` (`src/web/address.ts`):

| Part | Is | Example |
| --- | --- | --- |
| `at=` | where to open: a route | `#at=story?mission=vasse-test-1&round=3` |
| `settings=` | a settings text for a mission, as `--settings` takes it | `&settings=jumpStep=12&reducedMotion=true` |
| `keys=` | a key script played first on a mission, as `--keys` takes it | `&keys=Esc n 1` |

**A route and a settings text have `&` and `=` of their own**, so a part runs until the next `&at=`,
`&settings=` or `&keys=`, not until the next `&`: it is written as plainly as on a command line (RULE —
`tests/web.test.ts`). Any part may also be percent-encoded. Without `#at=` the page opens the save
`saves/crossing-new.save.json`, which `#settings=` and `#keys=` alone apply to. The page has no files, but it carries
the example saves in `saves/`, so `#at=skirmish?load=saves/crossing-round-4.save.json` opens one; a route that is not a
place, or a save it does not carry, opens a new Skirmish instead, with the problems written under the screen. Its
title menu's Load game lists the same examples, and its New game the shipped script profiles.

The page reads its address as a launch (`src/cli/launch.ts`): its parts are the launch's, so a part added
there is one the address reads.

The mode buttons that are game screens open their routes (Menu is `menu`, Skirmish is `skirmish`, PERIMETER is
`story?mission=vasse-test-1`); the two battle replays are the engine tool's battles, not places in the
game.

**A link on claude.ai cannot carry a `#` part with `=` in it**; a copy of the page opened from disk can.
A published page opens at a place through a demo instead: a demo in `scripts/demos/*.json` may carry an
`at` beside its `keys` and `settings`, checked when the page is built with the game's own readers
(`src/web/demos.ts`), so a demo opens round 2 without a key script walking there. A demo with no `at` opens
PERIMETER's first round, as demos always have.
