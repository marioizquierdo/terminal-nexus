# Skirmish setup, save files and headless play

_How a Skirmish is set up, saved, loaded and played without a screen: one vocabulary for the setup screen, the save
file, the command line and the routes. The game design of Skirmish (why it is the centre, what it is for) is
[`game-modes.md`](../game-design/game-modes.md); the duel it plays is [`duels.md`](duels.md). Nothing here is built
yet: it is the Skirmish milestone's design ([`milestone-17-skirmish.md`](../milestones/milestone-17-skirmish.md))._

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
| **Slot** | One side of the battle, by letter (`A` west, `B` east): its Commander and its **controller** |
| **Controller** | Who plans a slot each round: `player:<name>` (a person at the screen), `script:<profile>` (a scripted player), `agent:<profile>` (a language model, later) |
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

**The same screen later serves Versus**: a second `player:` slot.

**The opponent's credits** are a script profile's option, a share of the power curve (100% unless set), and may be set
on any slot: there is no difficulty setting, and both sides start on equal ground (the owner, 2026-11-11 and
2026-11-12).

## 3. The save file

**One format, written by the game and by a person** (GUIDANCE — the milestone settles the details; a first guess):

```json
{
  "format": "terminal-nexus.save/1",
  "name": "Vasse holds the Crossing",
  "notes": "Round 3: Dob's den line is forward; my Turrets are behind the pillars.",
  "setup": {
    "map": "crossing",
    "seed": 7,
    "goal": "elimination",
    "modifiers": ["fast-rounds"],
    "rounds": 8,
    "roundTicks": 360,
    "settings": "battleBanner=on",
    "slots": {
      "A": { "commander": "vasse", "controller": "player:marioiz" },
      "B": { "commander": "dob", "controller": "script:agro", "options": { "credits": 1.2 } }
    }
  },
  "start": {
    "A": { "credits": 140, "units": [{ "unit": "unit.citizen.trooper", "count": 4, "at": { "x": 20, "y": 13 } }] },
    "B": { "roster": { "buildings": ["den"], "powers": [], "doctrines": [] } }
  },
  "round": 3,
  "state": { "...": "the battle as it stands, written by the game" },
  "draft": { "A": { "build": [{ "building": "turret", "x": 22, "y": 11 }], "stance": "attack" } }
}
```

- **`setup`** is exactly what the setup screen chooses, under the same names. A file with only `setup` is a new battle.
- **`start`** is what a person adds to round 1 by hand: a side's credits, its roster, units and buildings already on the
  Grid, Nexus powers already kept. It is how a demo, a rule's test or a strange opening is written.
- **`round`** and **`state`** are written by the game when it saves: the battle as the Build Phase of that round opened
  (the duel's own state between rounds, `DuelState`, `src/duel/types.ts`: what stands on the Grid after the regroup,
  each side's credits, kept powers and absent Commander, and every round's report so far). A file with `state` ignores
  `start`.
- **`draft`** is the player's plan so far, so a load returns to exactly where they stopped.
- **The log is never in a save** (the owner: "Logging is a separate concern"): `--log <file>` writes it beside.

**Saving and loading happen at a Build Phase** (RULE — settled 2026-11-12, the owner: "saving and loading game is always
for the build phase"). The Build Phase's game menu gains **Save game**, which writes a new file (or over the one loaded);
a battle is deterministic, so a save is small and replays the same from its seed.

**Today's scenarios converge on it.** The engine's rule and bench maps (`scenarios/`, one Battle Round on a map of
their own, played by `grid`) and the duel maps (`src/duel/maps.ts`) become save files and maps in this format: a rule map is a save
whose map is drawn inline and whose slots are `script:idle` (they plan nothing), so its first Battle Round is what it
tests. Their folders are renamed `saves/` and `maps/`. This is a migration of some seventy files and of `grid`'s loader,
so it is the last step of the format's work, done by a script and checked by every test staying byte-identical.

## 4. The command line and the routes

**The same names everywhere** (GUIDANCE): a flag, a route's parameter and a save's field share one name.

```text
terminal-nexus                                          title menu: Skirmish (New game, Load game), Story, Settings...
terminal-nexus --at skirmish                            the setup screen
terminal-nexus --at 'skirmish?map=pocket&seed=7&b=dob:script:rush'
terminal-nexus --load saves/mine.save.json [--slot B=script:turtle] [--modifiers fast-rounds]

skirmish play  (--load <file> | --map crossing --a vasse:script:balanced --b dob:script:rush) [--seed 7] [--out <dir>]
skirmish round --load <file> --plan A=plan.json [--plan B=plan.json] --out next.save.json
skirmish brief --load <file> --slot A [--json]
skirmish bench --commanders vasse,dob --players balanced,rush,turtle --seeds 1-6
skirmish new | wait | submit | status                   the file flow for model players (as `duel` has today)
```

- A slot on the command line is `<commander>:<controller>`: `vasse:player`, `dob:script:rush`. `--slot B=<controller>`
  changes only the controller of a loaded save.
- **`skirmish`** is today's `bin/duel.ts` renamed and given `--load`, `round` and `brief`; `npm run skirmish`.
- **`play`** runs a whole battle headless; every slot must be a script (or an agent, later).
- **`round`** plays one round from a save: the plans given for some slots, the scripts for the rest, then the Battle
  Round; it writes the save at the next Build Phase and the round's report beside it.
- Routes keep their shape: `skirmish?…` takes the setup's names; `story?mission=<id>&round=<n>` opens a mission.

## 5. How an agent plays a Skirmish

Three ways, from cheapest to fullest:

1. **Round by round, through files** — the usual one. `skirmish brief --load s.save.json --slot A` prints what side A
   knows (the brief a model already reads, [`duels.md`](duels.md)); the agent writes a plan as JSON; `skirmish round
   --load s.save.json --plan A=plan.json --out s2.save.json` plays it against B's script and writes the next save and
   the round's report. Repeat from `s2`. Every round is a file to keep, compare, copy and change.
2. **Variations from a person's save**: copy Mario's save, put scripts in both slots (`--slot A=script:turtle --slot
   B=script:rush`), and `skirmish play` it over several seeds, or change `start` to try a different opening.
3. **On the screen**: the playtest script opens a save (`--load`) and presses keys, returning every screen as text, for
   how it reads. The player's diary (Milestone 20) plays a whole battle this way.

## 6. Spectating

With no `player:` slot the Build Phase has nothing to build: its menu is Explore Map and Start next round, the enemy's
and the other script's plans revealed as each round starts (Milestone 20's "reading the opponent"). It is how
a person watches two scripts, or an agent, play; Load game with both slots set to scripts opens it.

## 7. What is not decided

- Goals beyond Elimination (the owner named Economy and Creative) and which modifiers come first: IDEAs, each built
  when a Skirmish is fun without it.
- How an agent profile names its model, what context it reads and which tools it plays through: the agent players'
  milestone.
- Whether a save keeps every round's report or only the last few (size against a full history to read).
