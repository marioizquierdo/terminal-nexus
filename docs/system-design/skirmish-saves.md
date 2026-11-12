# Skirmish setup, save files and headless play

_How a Skirmish is set up, saved, loaded and played without a screen: one vocabulary for the setup screen, the save
file, the command line and the routes. The game design of Skirmish (why it is the centre, what it is for) is
[`game-modes.md`](../game-design/game-modes.md); the duel it plays is [`duels.md`](duels.md). Built so far: the save
file, the `skirmish` command and the testing saves (`src/skirmish/`, `src/cli/skirmish.ts`, `skirmish-testing/`), script
profiles and modifiers, the game playing a save on its screen (`src/cli/skirmish-play.ts`), Save game and `--load`
(`src/cli/skirmish-open.ts`, `src/cli/skirmish-files.ts`); the setup screen, spectating and playtest notes are the rest
of the Skirmish milestone
([`milestone-17-skirmish.md`](../milestones/milestone-17-skirmish.md))._

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
| **Slot** | One side of the battle, by number (`p1` west, `p2` east): its Commander and its **controller**. The duel's own state calls them side A and side B |
| **Controller** | Who plans a slot each round: `player` (a person, at the screen or through a plan file; `player:<name>` names them), `script:<profile>` (a scripted player), `agent:<profile>` (a language model, later) |
| **Script profile** | A named scripted player and its options, a file in `players/scripts/` (`agro.json`). The same scripts the duels and the measurements play |
| **Agent profile** | A language model's playing style, a Markdown file in `players/agents/` (`curious.md`). Its milestone decides the rest |
| **Goal** | What wins: **Elimination** (destroy the enemy Nexus; the healthier Nexus after the last round) is the only one built first |
| **Modifier** | A named rule laid over the battle: `fast-rounds`, `double-income`. A playground for experiments; the good ones are kept |
| **Setup** | The map, the seed, the slots, the goal, the modifiers and the settings text: everything chosen before round 1 |
| **Save file** | A setup, and the battle as it stands at the opening of a Build Phase (`*.save.json`) |
| **Testing save** | A save that opens on a Battle Round written by hand (its `start`), both slots planning nothing: a rule, a unit, a kind of ground or a showcase, in `skirmish-testing/` |
| **Spectating** | A battle with no `player:` slot: the Build Phase has nothing to build, only Explore Map and Start next round |

The code's word for the two-sided battle stays *duel* (as the engine's word for a battle is *match*); a person reads
*Skirmish*.

## 2. Setting up a Skirmish

**The setup screen asks, in order** (GUIDANCE — the order follows what each choice depends on):

1. **The map.** It fixes the slots: the Crossing and the Pocket have two.
2. **Each slot**: its Commander (Vasse, Averno, Dob Hunter) and its controller: `Player: marioiz` (the name from the
   settings), `Scripted: agro`, or, once its milestone lands, `Agent: curious`. A script profile may offer options
   (its credits share, its formation, when it starts attacking), shown beneath it.
3. **The goal**: Elimination.
4. **Modifiers**, each on or off.
5. **The seed**: shown, editable.

Every row has a default (Vasse as the player against Dob Hunter's `balanced` script on the Crossing, Elimination, no
modifiers, a seed from the clock), so Enter starts at once. **Load game** sits beside **New game**: it lists the save
files and, for the one chosen, lets the slots' controllers, their options, the modifiers and the settings be changed
before it opens (not the map or the Commanders: the battle so far depends on them).

**The same screen later serves Versus**: a second `player` slot.

**The opponent's credits** are a script profile's option, a share of the power curve (100% unless set), and may be set
on any slot: there is no difficulty setting, and both sides start on equal ground (the owner, 2026-11-11 and
2026-11-12).

## 3. The save file

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
  `nexus` and `hold` by slot; a `legend` only in a testing save), as a map file is. A slot may carry `options`
  (`credits`, its share of the income). Elimination is the only goal.
- **`state`** is written by the game: the duel's own state between rounds (`DuelState`, `src/duel/types.ts`), in the
  engine's words, where side A is `p1` and side B is `p2`: the round to play, each side's credits, kept powers and
  absent Commander, every round's report, the result once there is one, and `carried`, what stands on the Grid. The
  Grid's ground is never in it: the map has it.
- **`draft`** is a slot's plan so far (the duel's plan, [`duels.md`](duels.md)), so a load returns to where it stopped.
  It is cleared when the round is played.
- **`start`** is what each slot has on the Grid before round 1, placed by hand: a save with one is a **testing save**
  (section 4). A side's credits and roster in `start` are not built: no testing save needs them yet.
- **The log is never in a save** (the owner: "Logging is a separate concern").
- **A save the loader refuses is refused whole**, every problem named at once, by its place in the file
  (`setup.slots.p2.controller: no script "aggro"`).
- **Written to be read**: indented, with each unit, round's report and planned building on one line, so a battle of a
  hundred units is a page.

**Saving and loading happen at a Build Phase** (RULE — settled 2026-11-12, the owner: "saving and loading game is always
for the build phase"; `tests/skirmish-play.test.ts`). **Save game** is on the game menu (Esc, `[v]`; the owner: "on the
main menu settings "[esc]" instead of in the side menu"): it writes the battle as the Build Phase opened and the plan
so far as p1's draft, under a name the player types, offered as the file loaded or last saved to, or a new name by the
setup (`vasse-dob-1234-round-3`). A name alone goes into `~/.terminal-nexus/saves/` (the folder beside
`settings.json`), a name with a folder where it says, `.save.json` added unless it ends in `.json`. Loading it returns to
exactly that Build Phase: the round, its hand and credits, the power picked, every building placed, held and fitted; and
the round then plays as the uninterrupted one. It is dimmed on a story mission and refused once the plan is locked in.

**The screen is a save played on** (RULE — `src/cli/skirmish-play.ts`): a Skirmish's round carries its setup and the
duel as the Build Phase opened (`saveOf` and `duelOf` turn either into the other), so there is no screen state a save
could miss. The screen plays slot p1 as its player and p2 by its script; spectating and p2 as the player wait for the
setup screen's step, two players for Versus, and each is refused saying so.

**The units in a save stand where the regroup leaves them** (RULE — the owner, 2026-11-12): the state a save keeps is the
one after the regroup's walk, every survivor at the end of it, computed by the rules, not by the screen. Anything the
screen moves during a Build Phase (a regroup still animating, a unit stepping off ground being built on) is
presentation: the Battle Round opens from the saved places, so a battle loaded from a save plays as the one played
straight through (tested on Node and Bun).

## 4. Testing saves

**A testing save opens on a Battle Round written by hand** (RULE — `src/skirmish/start.ts`,
`src/skirmish/testing-saves.ts`, `tests/skirmish-save.test.ts`, `tests/testing-saves.test.ts`): a save with a `start`,
whose first Battle Round is what it tests. The engine's rule, unit, movement, bench and showcase battles are testing
saves, in [`skirmish-testing/`](../../skirmish-testing), a folder for each purpose (`rules/`, `units/`, `movement/`,
`engage/`, `showcase/`), with the trial files that play them in `skirmish-testing/trials/`
([`testing-ground.md`](testing-ground.md)). A file may be named anything; its id is its file name.

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
  `src/skirmish/opening/open.ts`), not by the duel: the same entities in the same reading order, the same seed, the
  same hash. `grid <save>` watches it, `grid <save> --seeds` makes it a trial, the measurement and every test open it,
  and `skirmish --load <save> --battle` plays it and prints `grid`'s report; nothing is saved after it, since the file
  is the battle.
- **Refused whole**, as any save: every problem at once, by its place in the file, and once the shape is right the first
  unit that does not fit the ground (off the Grid, on rock, on another) as `start: ...`.

The duel maps (`src/duel/maps.ts`) are still built in, by id; files for them in `maps/` wait for the setup screen.

## 5. The `skirmish` command

**One command, new or loaded** (the owner, 2026-11-12): `--map` starts a battle, `--load` carries one on from its Build
Phase, and what it does follows from what it is given. `skirmish --help` lists every option.

```text
skirmish --map crossing --p1 build: --p2 script:rush                  a new battle: p1's brief
skirmish --map crossing --p1 build:plan.json --p2 script:rush         p1's plan checked, nothing built
skirmish --map crossing --p1 build:. --p2 script:rush --battle --save s.json
                                                                      both sides build, the Battle Round, saved
skirmish --load s.json                                                the brief of every slot a player plans
skirmish --load s.json --p1 script:turtle --p2 build:                 who plans each slot, changed
skirmish --load s.json --p1 build:plan.json --save s.json             p1's plan kept as the draft, no battle
skirmish -f s.json --battle                                           load, play the next round, save over it
skirmish -f s.json --p1 script:agro --p2 script:defensive --battle    two scripts, a round a command
skirmish --map pocket --p1 build:a.json --p2 build:b.json --battle    two plans of your own, against each other
skirmish -f s.json --battles 3                                        three rounds (every slot a script)
skirmish --map crossing --p1 script:agro --p2 script:defensive --play-until-win --log battle.log
                                                                      to the end, the battle's log beside
skirmish --map crossing --p1 script:agro --p2 script:steady --play-until-win --seeds 1-20 --out runs/
                                                                      twenty battles, a line each, a tally
skirmish --map pocket --p1 build: --p2 script:agro-rich --modifiers fast-rounds
```

- **A slot** is `--p1`/`--p2` and who plans it: `build:<plan file>` (a player; a folder or `.` means the `build.json` in
  it; `build:` alone means the save's draft, or nothing), or `script:<name>` (`script:` alone plans nothing). A slot
  that builds by hand is saved as `player`; a load with no slots named keeps each slot's controller.
- **Without `--battle` nothing changes**: a player's slot with a plan file has the plan checked by the Build Phase's rules
  (the card it keeps, what it would build and where, each refusal with its reason, the credits left; exit code 1 when
  anything is refused), and one without prints its brief (`--json` for the brief as data). A plan's clash with the
  other side's over one tile is settled only once both are revealed, at the battle.
- **Who plays**: both slots may be players (`--p1 build:a.json --p2 build:b.json`: an agent plays itself), both scripts
  (the battle is watched), or one of each. A script slot names a **script profile** (`players/scripts/<name>.json`: the
  duel script it plays, a line saying how, and its options; `agro`, `defensive`, `steady`, `agro-rich`) or a duel
  script by its own name (`rush`, `turtle-area`). `agent:<profile>` is refused until agent players are built.
- **How many rounds**: `--battle` plays one; `--battles <n>` plays n; `--play-until-win` plays until the battle ends, a
  Nexus falling or the rounds running out, with the limit raised to 100 rounds unless `--rounds` says otherwise. A
  player's plan plays one round, so many rounds need every slot a script. The report says what each side kept, built,
  fielded and lost.
- **Many seeds**: `--seeds 1-20` (or `1,4,9`) plays a new battle once a seed with `--battles` or `--play-until-win`, a
  line each and then a tally (who won how often, how many by a Nexus falling, rounds on average). It never saves over a
  file: `--out` keeps every round.
- **Every round kept**: `--out <dir>` writes each round's save and report (`round-<n>.save.json`, `round-<n>.txt`), so a
  battle can be read, copied and played on from any round.
- **The battle's log**: `--log <file>` writes every round's Battle Round as `grid` writes a battle's log, at `--log-level`
  (`info` unless set: what happened; `debug` and `trace` add the detail; `warn` only what looks wrong). The log is never
  in a save.
- **Credits shares**: `--p1-credits 1.25` gives a slot a quarter more income each round (a profile may carry one; the
  slot's own wins). There is no difficulty setting.
- **Modifiers**: `--modifiers fast-rounds,double-income` (or `none`), on a new battle or a loaded one, from the next
  round: `fast-rounds` halves every Battle Round, `double-income` doubles every side's income. `--rounds` on a loaded
  battle changes its limit from now on, never below the round it is at.
- **`--save <file>`** writes the save (made or replaced); `-f <file>` loads and saves the same file.
- A new battle's Commanders are `--p1-commander` and `--p2-commander` (Vasse against Dob Hunter unless named), with
  `--seed` and `--ticks`; a loaded battle refuses them, and refuses `--map`: the battle so far depends on them.
- **A map file** is a map drawn in full, as a save carries it (`--map rocks.json`); the save then carries the map.
- An option nobody knows is refused by name.

**`duel` stays beside it** for every pairing of every Commander over seeds (`duel bench`) and the file flow for two model
players in two sessions (`duel new`, `wait`, `submit`). They fold into `skirmish` once save files carry them.

**The game's own flags** take the same names: `terminal-nexus --load <file> [--p1 build:plan.json] [--p2 script:turtle]`
(a plan file for p1 is laid on the first Build Phase, as a draft is), the route `skirmish?load=<file>`, and
`skirmish?seed=7` for a new battle on the defaults (a map and Commanders in the route wait for the setup screen). The
scripted playtest takes the same `--load`, `--p1` and `--p2`.

## 6. How an agent plays a Skirmish

Three ways, from cheapest to fullest:

1. **Round by round** — the usual one. `skirmish -f s.json` prints the brief of the slot it plays; the agent writes a
   plan (`plan.json`, the duel's plan: a card to keep, buildings and where, building actions, the stance); `skirmish -f
   s.json --p1 build:plan.json` checks it; `--battle` added plays it against the other slot's script and saves the next
   Build Phase. Every round can be a file of its own to keep, compare, copy and change (`--load` one, `--save` another).
2. **Variations from a person's save**: copy Mario's save and play it on with scripts in both slots (`--p1 script:turtle
   --p2 script:rush --battle`), a round a command, or change its `draft` to try another plan.
3. **On the screen**: the playtest script opens a save (`--load`) and presses keys, returning every screen as text, for
   how it reads; `Esc v`, a name and Enter save where it stopped. The player's diary (Milestone 20) plays a whole battle this way.

## 7. Spectating

With no `player` slot the Build Phase has nothing to build: its menu is Explore Map and Start next round, the enemy's
and the other script's plans revealed as each round starts (Milestone 20's "reading the opponent"). It is how
a person watches two scripts, or an agent, play; Load game with both slots set to scripts opens it.

## 8. What is not decided

- Goals beyond Elimination (the owner named Economy and Creative) and which modifiers come first: IDEAs, each built
  when a Skirmish is fun without it.
- How an agent profile names its model, what context it reads and which tools it plays through: the agent players'
  milestone.
- Whether a save keeps every round's report, as it does now (a round-4 save is about 23 KB), or only the last few once
  battles grow longer.
