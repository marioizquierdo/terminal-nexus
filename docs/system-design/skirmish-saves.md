# Skirmish setup, save files and headless play

_How a Skirmish is set up, saved, loaded and played without a screen: one vocabulary for the setup screen, the save
file, the command line and the routes. What a Skirmish is for a player is [`game-modes.md`](../game-design/game-modes.md);
the battle it plays is [`battles.md`](battles.md); the `skirmish` command's manual is the comment it opens with
([`src/cli/skirmish.ts`](../../src/cli/skirmish.ts)); how a test plays one is [`sandboxes.md`](sandboxes.md),
testing through Skirmishes. The code: the save and the steps the screen and the command share in `src/skirmish/`
(`save.ts`, `request.ts`, `play.ts`), the screen in `src/cli/skirmish-play.ts` and `src/cli/skirmish-open.ts`, the setup
screen in `src/cli/title-screens.ts`; what is left is in the Skirmish milestone
([`milestone-17-skirmish.md`](../history/milestones/milestone-17-skirmish.md))._

_Licence: Apache-2.0._

The owner, 2026-11-12 ([his words](../history/feedback/2026-11-12-skirmish-saves.md)): "Scenarios basically become saved
skirmish saves… formalize the concept that works both from the UI and from the CLI." What he will do once it is built:
start the game, choose Skirmish, pick a map, a Commander for each slot and who plays it, play a few rounds, save, come
back later, load and carry on; and hand the same file to an agent, which reads it, copies and changes it, and plays it
headless with scripts on either side.

## 1. The words

| Word | Means |
| --- | --- |
| **Map** | The ground and its **slots**: where each Nexus stands and where its troops hold. A map fixes how many sides a battle has (two today) |
| **Slot** | One side of the battle, by number (`p1` west, `p2` east): its Commander and its **controller**. The battle's own state calls them side A and side B |
| **Controller** | Who plans a slot each round: `player` (a person, at the screen or through a build file; `player:<name>` names them), `script:<profile>` (a scripted player), `agent:<profile>` (a language model, later) |
| **Script profile** | A named scripted player and its options, a file in `players/scripts/` (`agro.json`). The same scripts the battles and the measurements play |
| **Agent profile** | A language model's playing style, a Markdown file in `players/agents/` (`curious.md`). Its milestone decides the rest |
| **Goal** | What wins: **Elimination** (destroy the enemy Nexus; the healthier Nexus after the last round) is the only one built first |
| **Modifier** | A named rule laid over the battle: `fast-rounds`, `double-income`. A playground for experiments; the good ones are kept |
| **Setup** | The map, the seed, the slots, the goal, the modifiers, the round limit and the Battle Round's ticks: everything chosen before round 1 (the settings text travels beside it) |
| **Save file** | A setup, and the battle as it stands at the opening of a Build Phase (`*.save.json`) |
| **Sandbox** | A save that opens on a Battle Round written by hand (its `start`), both slots planning nothing: a rule, a unit, a kind of ground or a showcase, in `sandboxes/` |
| **Spectating** | A battle with no `player:` slot: the Build Phase has nothing to build, only Explore Map and Start next round |

The code's word for the two-sided battle stays *battle* (as the engine's word for a battle is *match*); a person reads
*Skirmish*.

## 2. How the pieces compose

One battle, many ways in. Each layer knows only the one beneath it, so the game's screen, the command line, the
scripted playtest, a test and an agent are the same battle reached by different doors (the owner, 2026-11-12: "reusing
components like this is more maintainable, flexible and easier to explain"):

| Layer | What it is | Where |
| --- | --- | --- |
| **The battle** | The battle: a round from both sides' build actions, deterministic, the regroup after it | `src/battle/`, the kernel beneath |
| **The record** | A save: the setup and the battle at a Build Phase, and a slot's build actions so far | `src/skirmish/save.ts` |
| **The ask** | The words a Skirmish is asked for by (`load`, `map`, `seed`, `rounds`, `p1`, `p2-commander`, …), read by one reader whichever door they come through | `src/skirmish/ask.ts` |
| **The seat** | Who plays each slot: a person, a build file, a script profile, later an agent; each answers the same brief, in any order | `src/skirmish/request.ts`, `slots.ts`, `play.ts` |
| **The round** | `playNext`: the setup's rules brought up to date, each slot's build actions asked of its controller, the round played; `playOn`, the one loop rounds are played on by | `src/skirmish/play.ts` |
| **The doors** | The screen (a person plays p1, or watches), the `skirmish` command (anything, headless, any number of rounds and battles), the measurement (scripts over many seeds, every Battle Round recorded), the playtest (keys pressed on the screen), the routes and the game's flags (`skirmish?map=pocket`, `--map pocket`) | `src/cli/skirmish-play.ts`, `src/cli/skirmish.ts`, `src/measure/`, `scripts/playtest.mjs`, `src/cli/route.ts` |

What follows from it:

- **A moment is a file.** Every Build Phase any door reaches can be saved, and every door opens a save; a note (`!`) is
  a save with what was pressed. So an agent prepares a moment for a person (a round reached by scripts, an opponent
  chosen) and hands over one line, `./bin/terminal-nexus.ts --load <file>`; a person's moment comes back the same way.
- **A player is anything that answers a brief.** A person on the screen, a build file (one round or many, written
  ahead), a script, a model: each is a controller, the brief they read is the same, and none of them can see another's
  answer. A new kind of player is a new controller, not a new door.
- **One rule, one place.** A rule of play lives in the battle or the round, never in a door; a door adds only what it
  is for (the screen's keys and pictures, the command's options and files). A change shows up in every door at once,
  and a test through the command is a test of the screen's battle.
- **Words are shared.** Every word that asks for a Skirmish means the same on the `skirmish` command, the game's flags
  and the routes, because one reader reads them all (`readAsk`) and writes them back (`askWords`):
  `skirmish --map pocket --p2-commander averno`, `terminal-nexus --map pocket --p2-commander averno` and
  `--at 'skirmish?map=pocket&p2-commander=averno'` are one battle, refused for the same reasons. The save's names are
  the setup screen's.
- **A sandbox is not a battle.** It tests one rule on the bench's content, with no Commander, Build Phase or wave,
  so it starts the kernel straight from the units it places. It too has one path, `playSandboxRound`
  (`src/skirmish/sandbox-round.ts`), which `grid`, the `skirmish` command and the measurement all play it by.

## 3. Setting up a Skirmish

**The setup screen asks, in order** (RULE for what is built — `tests/setup-screen.test.ts`; the order follows what each
choice depends on; how it looks and which keys it takes are [`ui-patterns.md`](ui-patterns.md), the setup screen):

1. **The map.** It fixes the slots: the Crossing and the Pocket have two.
2. **Each slot**: its Commander (Vasse, Averno, Dob Hunter) and its controller: `Player: marioiz` (the name from the
   settings), `Scripted: agro`, or, once its milestone lands, `Agent: curious`. A script profile may offer options
   (its credits share, its formation, when it starts attacking), shown beneath it.
3. **The goal**: Elimination.
4. **Modifiers**, each on or off.
5. **The seed**: shown, editable.

Every row has a default (Vasse as `Player: <name>` against Dob Hunter's `steady` profile — the `balanced` script — on
the Crossing, Elimination, no modifiers, a seed from the clock), so Enter starts at once. The setup it starts is a
save's `setup`, under the same names: Start opens `{ format, setup }`, nothing translated. A `Player` slot saves as
`player:<name>`, the name the account's in a terminal (`player` on the browser page). **Load game** sits beside **New
game**: it lists the saves folder, newest first, then the examples in `saves/`, and, for the one chosen, lets the
slots' controllers, their credits shares and the modifiers be changed before it opens (not the map or the Commanders:
the battle so far depends on them); a draft is laid on the Build Phase only while p1 is still the player. The
settings are the Settings screen's, on the title menu or in the game menu. Not built: a profile's options beyond its
credits share (its formation, when it attacks) — none of the scripts has one yet.

**The profiles on the browser page** are the same files, imported with the code as JSON
(`src/skirmish/shipped-players.ts`, held to `players/scripts/` by a test), and so are the example saves Load game lists
there: the page has no files to read. A terminal reads `players/scripts/` from disk, so a profile a person adds shows.

**The same screen later serves Versus**: a second `player` slot.

**The opponent's credits** are a script profile's option, a share of the credits curve (1, shown as 100%, unless set), and may be set
on any slot: there is no difficulty setting, and both sides start on equal ground (the owner, 2026-11-11 and
2026-11-12).

## 4. The save file

**One format, written by the game and by a person** (RULE for what is built: `src/skirmish/save.ts`; the JSON Schema is
[`saves/save.schema.json`](../../saves/save.schema.json), and [`saves/`](../../saves) holds examples):

```json
{
  "format": "terminal-nexus.save/1",
  "name": "Vasse against Dob, round 4",
  "notes": "Three rounds in, both bases built up.",
  "setup": {
    "map": "crossing",
    "seed": 7,
    "goal": "elimination",
    "modifiers": [],
    "rounds": 8,
    "roundTicks": 360,
    "slots": {
      "p1": { "commander": "vasse", "controller": "player" },
      "p2": { "commander": "dob", "controller": "script:balanced" }
    }
  },
  "state": { "round": 4, "sides": { "A": {}, "B": {} }, "history": [], "result": null, "carried": { "entities": [] } },
  "draft": { "p1": { "power": 1, "build": [{ "building": "turret", "x": 22, "y": 11 }], "stance": "attack" } }
}
```

- **`setup`** is exactly what the setup screen chooses, under the same names. A file with only `format` and `setup` is
  a new battle. `map` is a built-in map's id (`crossing`, `pocket`) or a map drawn in full (`id`, `name`, `rows`, and
  `nexus` and `hold` by slot; a `legend` only in a sandbox), as a map file is. A slot may carry `options`
  (`credits`, its share of the income). Elimination is the only goal.
- **`state`** is written by the game: the battle's own state between rounds (`BattleState`, `src/battle/types.ts`), in the
  engine's words, where side A is `p1` and side B is `p2`: the round to play, each side's credits, kept powers and
  absent Commander, every round's report (its Build Phase half) with its reading (the Battle Round's numbers, [`battles.md`](battles.md), "Reading a battle"), the result once there is one, and `carried`, what stands on the Grid. The
  Grid's ground is never in it: the map has it.
- **`draft`** is a slot's build actions so far for the round it is at ([`battles.md`](battles.md), the brief and the build
  actions), so a load returns to where it stopped: half made, as Save game leaves them mid-Build Phase, or whole, handed in
  by one slot before the other's.
  It is cleared when the round is played.
- **`start`** is what each slot has on the Grid before round 1, placed by hand: a save with one is a **sandbox**
  (section 5). A side's credits and roster in `start` are not built: no sandbox needs them yet.
- **The log is never in a save** (the owner: "Logging is a separate concern").
- **A save from before a round's report carried its reading is refused**, by the round (`state.history[0]`); the format
  stays `/1` until the game is public, and the examples are written again by `node scripts/make-example-saves.ts`.
- **A save the loader refuses is refused whole**, every problem named at once, by its place in the file
  (`setup.slots.p2.controller: no script "aggro"`).
- **Written to be read**: indented, with each unit, round's report and planned building on one line, so a battle of a
  hundred units is a page.

**Saving and loading happen at a Build Phase** (RULE — settled 2026-11-12, the owner: "saving and loading game is always
for the build phase"; `tests/skirmish-play.test.ts`). **Save game** is on the game menu (Esc, `[v]`; the owner: "on the
main menu settings "[esc]" instead of in the side menu"): it writes the battle as the Build Phase opened and the build actions
so far as p1's draft, under a name the player types, offered as the file loaded or last saved to, or a new name by the
setup (`vasse-dob-1234-round-3`). A name alone goes into `~/.terminal-nexus/saves/` (the folder beside
`settings.json`), a name with a folder where it says, `.save.json` added unless it ends in `.json`. Loading it returns to
exactly that Build Phase: the round, its hand and credits, the power picked, every building placed, held and fitted; and
the round then plays as the uninterrupted one. It is dimmed on a story mission and refused once the plan is locked in.

**The screen is a save played on** (RULE — `src/cli/skirmish-play.ts`, `tests/setup-screen.test.ts`): a Skirmish's
round carries its setup and the battle as the Build Phase opened (`saveOf` and `battleOf` turn either into the other), so
there is no screen state a save could miss, and **every round is played by `playNext`** (`src/skirmish/play.ts`), the
same function the `skirmish` command plays, with the script profiles: the same setup and build actions give the same battle on
screen as headless, profiles, credits shares and modifiers included. The screen plays slot p1 as its player against
p2's script, or watches two scripts (spectating, section 8); p2 as the only player is not built, two players wait for
Versus, and an agent for its milestone, each refused saying so.

**The units in a save stand where the regroup leaves them** (RULE — the owner, 2026-11-12): the state a save keeps is the
one after the regroup's walk, every survivor at the end of it, computed by the rules, not by the screen. Anything the
screen moves during a Build Phase (a regroup still animating, a unit stepping off ground being built on) is
presentation: the Battle Round opens from the saved places, so a battle loaded from a save plays as the one played
straight through (tested on Node and Bun).

## 5. Sandboxes

**A sandbox opens on a Battle Round written by hand** (RULE — `src/skirmish/start.ts`,
`src/skirmish/sandboxes.ts`, `tests/skirmish-save.test.ts`, `tests/sandboxes.test.ts`): a save with a `start`,
whose first Battle Round is what it tests. The engine's rule, unit, movement, bench and showcase battles are
sandboxes, in [`sandboxes/`](../../sandboxes), a folder for each purpose (`rules/`, `units/`, `movement/`,
`engage/`, `showcase/`), with the trial files that play them in `sandboxes/trials/`
([`sandboxes.md`](sandboxes.md)). A file may be named anything; its id is its file name.

```json
{
  "format": "terminal-nexus.save/1",
  "name": "Melee kill - two troopers close on one",
  "notes": "Two Citizen troopers walk into contact and kill a single defender.",
  "setup": {
    "map": { "id": "melee-kill", "rows": ["........................", "..."] },
    "seed": 40961, "goal": "elimination", "modifiers": [], "rounds": 1, "roundTicks": 180,
    "slots": { "p1": { "controller": "script:idle" }, "p2": { "controller": "script:idle" } }
  },
  "start": {
    "p1": { "at": {"x":10,"y":5}, "rows": ["t", "t"], "legend": { "t": {"content":"unit.citizen.trooper"} }, "target": {"x":13,"y":5,"width":1,"height":1} },
    "p2": { "at": {"x":13,"y":5}, "rows": ["t"], "legend": { "t": {"content":"unit.citizen.trooper"} }, "target": {"x":10,"y":5,"width":1,"height":2} }
  }
}
```

- **The map is drawn inline**, its rows one character a tile, north to south; `legend` names the ground of each
  character (`.` open, `#` rock, `*` a deposit unless given; `,` scrub needs it). `nexus` and `hold` may be left out:
  the start places the Nexuses.
- **A slot's start** is a picture of what it places, `rows` from `at` (the Grid's north-west corner unless given), a
  space nothing, each character the **centre tile** of what the `legend` names, `hp` when it starts hurt; and its
  `target`, where its troops head (none: the enemy Nexus). `p1` is the engine's side A, `p2` side B.
- **One Battle Round, nothing planned**: `rounds` is 1, both slots `script:idle`, no `state` and no `draft`; a slot
  names no Commander (its units are given) unless it wants one. `roundTicks` is how long the round may run.
- **One opening, two players of it.** The round opens exactly from `start`, by the kernel (`openBattle`,
  `src/skirmish/opening/open.ts`), not by the battle: the same entities in the same reading order, the same seed, the
  same hash. `grid <save>` watches it, `grid <save> --seeds` makes it a trial, the measurement and every test open it,
  and `skirmish --load <save> --play-to next` plays it and prints `grid`'s report; nothing is saved after it, since the file
  is the battle.
- **Refused whole**, as any save: every problem at once, by its place in the file, and once the shape is right the first
  unit that does not fit the ground (off the Grid, on rock, on another) as `start: ...`.

The built-in maps are files in `maps/` (`crossing.map.json`, `pocket.map.json`), read by `src/battle/maps.ts` and named by id.

## 6. Headless, and the same everywhere

**The `skirmish` command plays a Skirmish without a screen** (RULE for what is built — `tests/skirmish-command.test.ts`,
`tests/skirmish-save.test.ts`): from a save or a new setup, it prints the brief of a slot a player plays, checks its build actions
by the Build Phase's rules, plays a round or the battle to its end, many battles over seeds or every pairing of
Commanders, two sessions handing in build actions through one save, and keeps every round as a save, a report and the battle's
log. Its manual, every option with examples, is the comment [`src/cli/skirmish.ts`](../../src/cli/skirmish.ts) opens
with (`npm run skirmish -- --help`); how each kind of test uses it is [`sandboxes.md`](sandboxes.md).

**Parity with the command** (RULE — the owner, 2026-11-12: "formalize the concept that works both from the UI and from
the CLI"): the screen and the command open a battle by the same steps (`src/skirmish/request.ts`: a new setup or a save
read back, then `openSave`: each slot seated with its controller, its credits share and a player's build file, the rules changed from the round the battle is at) and play every round
through `playNext`. A slot is written the same everywhere: `--p1`/`--p2` with `build:<build file>` (a player; `build:`
alone, the draft or nothing) or `script:<profile>` (`script:` alone plans nothing); a loaded battle keeps its map,
Commanders and seed, and each slot's controller unless named. A change to one is a change to both.

**The game's own flags** take the same names: `terminal-nexus --load <file> [--p1 build:b.json] [--p2 script:turtle]`
(a build file's actions for p1 are laid on the Build Phase it opens at, as a draft is), the route `skirmish?load=<file>` (with `p1` and
`p2` to change who plays), and `skirmish?seed=7&map=pocket&p2=script:agro&p2-commander=averno&modifiers=fast-rounds`
for a new battle under the command's names, the defaults for what it leaves out. A battle started on the setup screen
(`skirmish?setup=new`) has that route, so it opens again from it. The scripted playtest takes the same `--load`, `--p1` and `--p2`, and starts from
`saves/crossing-new.save.json` when told nowhere.

## 7. How an agent plays a Skirmish

Round by round from a save file, as a person would: the brief of its slot, build actions written from it, checked,
then played against the other slot's script and saved at the next Build Phase; or two agents, one a slot, each
answering the same brief; or on the screen by keys through the scripted playtest. The commands for each are
[`sandboxes.md`](sandboxes.md), testing through Skirmishes. The player's diary (Milestone 20) plays a whole
battle on the screen this way.

## 8. Spectating

With no `player` slot the Build Phase has nothing to build (RULE — `tests/setup-screen.test.ts`): its menu is Explore
Map and Start next round, which begins the round at once, both scripts' plans revealed as it starts and played by
`playNext` as the command line plays them; the opening lines say how each side plays, and the result names the winner
(`DOB HUNTER WINS`). It is how a person watches two scripts, or an agent, play: New game or Load game with both slots
set to scripts opens it, and so does `--load <save> --p1 script:<profile>`. What each side planned, read before the
round, is Milestone 20's "reading the opponent".

## 9. Notes from a playtest

**A note is the moment itself** (RULE — `src/cli/notes.ts`, `tests/notes.test.ts`; the owner, 2026-11-12, notes built
on save files): `!`, on any screen, takes one typed line, and the note file it saves (`terminal-nexus.note/1`) holds
`line`, `at` (the route: a Skirmish's, a mission's at its round, a title menu screen's), `save` (a Skirmish's round as
its Build Phase opened, the plan laid then included), `settings` (the export text), `pressed` (every named command
since the round opened, `{ at, command }`, milliseconds after), `noteAt` (when `!` was pressed), `screen` (the screen
then, as text, a line a row) and `activity` (the last Activity Logs events, oldest first), with the build and the
time. A terminal writes it into `~/.terminal-nexus/notes/note-<date>-<time>.note.json`; the browser page copies its
text. `terminal-nexus --note <file>` and `node scripts/playtest.mjs --note <file>` open it at its moment: the round
opened from `save` (or `at`), the commands dispatched again at their times (`BuildSession.replay`), the clock moved on
to `noteAt`, so the screen is the one the note shows. A title menu note opens on its screen. The `feedback-round`
skill reads note files. A note is not the replay format: no content locks and no version checks; only the build that
wrote it promises to replay it. Not built: the browser page opening a note, and the optional rating of a round.

## 10. What is not decided

- Goals beyond Elimination (the owner named Economy and Creative) and which modifiers come first: IDEAs, each built
  when a Skirmish is fun without it.
- How an agent profile names its model, what context it reads and which tools it plays through: the agent players'
  milestone.
- Whether a save keeps every round's report, as it does now (a round-4 save is about 23 KB), or only the last few once
  battles grow longer.
