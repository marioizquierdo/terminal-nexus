# Skirmish setup, save files and headless play

_How a Skirmish is set up, saved, loaded and played without a screen: one vocabulary for the setup screen, the save
file, the command line and the routes. The game design of Skirmish (why it is the centre, what it is for) is
[`game-modes.md`](../game-design/game-modes.md); the duel it plays is [`duels.md`](duels.md). Built so far: the save
file and the `skirmish` command (`src/skirmish/`, `src/cli/skirmish.ts`); the setup screen, profiles, goals, modifiers
and saving from the game are the rest of the Skirmish milestone
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
  `nexus` and `hold` by slot), as a map file is. A slot may carry `options` (`credits`, its share of the income).
  Elimination is the only goal.
- **`state`** is written by the game: the duel's own state between rounds (`DuelState`, `src/duel/types.ts`), in the
  engine's words, where side A is `p1` and side B is `p2`: the round to play, each side's credits, kept powers and
  absent Commander, every round's report, the result once there is one, and `carried`, what stands on the Grid. The
  Grid's ground is never in it: the map has it.
- **`draft`** is a slot's plan so far (the duel's plan, [`duels.md`](duels.md)), so a load returns to where it stopped.
  It is cleared when the round is played.
- **`start`** (not built yet: the scenarios' conversion needs it) is what a person adds to round 1 by hand: a side's
  credits, its roster, units and buildings already on the Grid.
- **The log is never in a save** (the owner: "Logging is a separate concern").
- **A save the loader refuses is refused whole**, every problem named at once, by its place in the file
  (`setup.slots.p2.controller: no script "aggro"`).
- **Written to be read**: indented, with each unit, round's report and planned building on one line, so a battle of a
  hundred units is a page.

**Saving and loading happen at a Build Phase** (RULE — settled 2026-11-12, the owner: "saving and loading game is always
for the build phase"). The Build Phase's game menu gains **Save game**, which writes a new file (or over the one loaded).

**The units in a save stand where the regroup leaves them** (RULE — the owner, 2026-11-12): the state a save keeps is the
one after the regroup's walk, every survivor at the end of it, computed by the rules, not by the screen. Anything the
screen moves during a Build Phase (a regroup still animating, a unit stepping off ground being built on) is
presentation: the Battle Round opens from the saved places, so a battle loaded from a save plays as the one played
straight through (tested on Node and Bun).

**Today's scenarios converge on it.** The engine's rule and bench maps (`scenarios/`, one Battle Round on a map of
their own, played by `grid`) and the duel maps (`src/duel/maps.ts`) become save files and maps in this format: a rule map is a save
whose map is drawn inline and whose slots are `script:idle` (they plan nothing), so its first Battle Round is what it
tests. Their folders are renamed `saves/` and `maps/`. This is a migration of some seventy files and of `grid`'s loader,
done by a script and checked by every test staying byte-identical.

## 4. The `skirmish` command

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

**The game's own flags** take the same names once Save game lands: `terminal-nexus --load <file> [--p2 script:turtle]`,
the route `skirmish?load=<file>`, and `skirmish?map=pocket&seed=7` for a new battle.

## 5. How an agent plays a Skirmish

Three ways, from cheapest to fullest:

1. **Round by round** — the usual one. `skirmish -f s.json` prints the brief of the slot it plays; the agent writes a
   plan (`plan.json`, the duel's plan: a card to keep, buildings and where, building actions, the stance); `skirmish -f
   s.json --p1 build:plan.json` checks it; `--battle` added plays it against the other slot's script and saves the next
   Build Phase. Every round can be a file of its own to keep, compare, copy and change (`--load` one, `--save` another).
2. **Variations from a person's save**: copy Mario's save and play it on with scripts in both slots (`--p1 script:turtle
   --p2 script:rush --battle`), a round a command, or change its `draft` to try another plan.
3. **On the screen**: the playtest script opens a save (`--load`, with Save game) and presses keys, returning every
   screen as text, for how it reads. The player's diary (Milestone 20) plays a whole battle this way.

## 6. Spectating

With no `player` slot the Build Phase has nothing to build: its menu is Explore Map and Start next round, the enemy's
and the other script's plans revealed as each round starts (Milestone 20's "reading the opponent"). It is how
a person watches two scripts, or an agent, play; Load game with both slots set to scripts opens it.

## 7. What is not decided

- Goals beyond Elimination (the owner named Economy and Creative) and which modifiers come first: IDEAs, each built
  when a Skirmish is fun without it.
- How an agent profile names its model, what context it reads and which tools it plays through: the agent players'
  milestone.
- Whether a save keeps every round's report, as it does now (a round-4 save is about 23 KB), or only the last few once
  battles grow longer.
