# Terminal Nexus — glossary

_Every word the project made its own, one line each, with the page that holds its rules. One word names one thing in
the documents, on screen, in the save file, on the command line and in the code; where the code keeps an older word,
the entry says so. A new word is added here in the same pull request that brings it in. Every unmarked statement is
GUIDANCE._

## A battle

- **battle** — one Grid, two sides, rounds until a result: the unit of play. The kernel's word is *match*, and the
  two-sided battle in code is the *duel* ([`game-modes.md`](game-modes.md)).
- **round** — one Nexus Pulse, one Build Phase and one Battle Round, in that order: the unit the player counts, "round 2
  of 3". In code the round's number is `pulseNumber`.
- **Nexus Pulse** — the moment each round opens, when the Grid Nexus speaks to its Commander and deals a hand of Nexus
  powers; the player may keep one during the Build Phase (for now the pick is optional). It took the place of "the
  Nexus draft" (the owner, 2026-10-07: "The Nexus Pulse signals the start of a new round").
- **Build Phase** — the hidden, simultaneous, untimed phase where each player makes their build actions. Saving and
  loading happen only here.
- **Battle Round** — the fixed-tick, deterministic battle that ends each round and plays both plans out in ASCII. The
  player's word for it everywhere (the owner, 2026-10-04: "Battle Round is better for the player and UI").
- **tick** — one step of a Battle Round's simulation; a Battle Round lasts a fixed number of them (360 unless a setup
  says otherwise). `grid --from-tick 90` starts a replay or a log at tick 90.
- **regroup** — what happens when a Battle Round ends: survivors stay where they fought, step back and form up across
  their march line, so the next round starts from the front ([`movement.md`](../system-design/movement.md)).
- **wave** — the units one building makes at once in a Battle Round, set down together beside it; how many, how many
  waves a round and the seconds between them are on the building's card. It means only this: a round's battle is a
  Battle Round, and what a mission brings is a group.
- **group** — units a mission trigger brings onto the Grid together, at a chosen tick, with a name and an intention.
  Never a wave (the owner, 2026-10-04).
- **goal** — what wins. **Elimination**: destroy the enemy Nexus, or have the healthier one after the last round. The
  only goal built so far.
- **round limit** — the most rounds a battle lasts (`rounds` in a save, `--rounds`); a loaded battle may change it
  from the next round on.

## The ground

- **Grid** — the rectangular integer playfield a battle is fought on ([`grid.md`](../system-design/grid.md)).
- **Grid Nexus**, **Prime Nexus** — the Nexus replica that stands on the Grid and must not fall, and the one that
  stays home and replicates it ([`lore.md`](lore.md)).
- **map** — the ground and its slots: where each Nexus stands and where its troops hold. The built-in maps are
  `crossing` and `pocket`; a map file is the same as JSON.
- **target** — the place a side's troops head for: they engage what comes within reach on the way, and stand there
  ([`pulse.md`](../system-design/pulse.md)).
- **build range** — the ground a new building needs a tile in: within the construction radius of the player's Grid
  Nexus and of every standing building linked to it; a building planned this round gives its range from the next.
- **room** — the tiles a building that makes units keeps free round it, so its waves have somewhere to appear.
- **distance** — columns across plus two for each row up or down, between the nearest tiles of two footprints; every
  range, reach and radius counts in it, and a reach of 1 is touching ([`grid.md`](../system-design/grid.md)).
- **starter map** — the Build Phase's one disposable map and the few buildings it offers, there to be played and
  replaced; not a mission.

## Armies

- **Commander** — the leader a player plays, with their own unit, powers and army: Vasse, Averno and Dob so far
  ([`commander-armies.md`](commander-armies.md)).
- **faction** — the side a Commander belongs to, with its Nexus, units and buildings: Citizen and Ravel so far.
- **Commander Army** — everything one player brings: faction, Commander, starting units and buildings, blueprints,
  upgrades, Nexus powers and Specials.
- **army file** — `armies/<id>/army.json`, an army as data, stacked: `armies/all` (what any Commander may use), the
  faction armies, one army per Commander ([`army-authoring.md`](../system-design/army-authoring.md)).
- **Nexus power** — a named effect with one plain line of description, dealt in a hand at each Nexus Pulse. **draft**
  is the word for choosing from that hand.
- **building**, **unit** — what a player places in the Build Phase, and what a building makes to fight. A Commander is
  a unit too, and marches like any other.
- **building action** — something done to a standing building in the Build Phase: an upgrade, a mode or an order
  ("hold production").
- **ability** — what a unit does on its own, by a kind from one table (`src/abilities/`): an aura, a bounty, loaded
  dice.
- **credits** — what everything costs. Each round's income follows the **credits curve**; a slot's **credits share**
  is its part of that curve (1 is the curve's own; `--p1-credits 1.25`).
- **tech tree**, **blueprint**, **Special**, **research** — the mechanisms that grow an army between rounds and
  missions, each naming exactly one thing ([`commander-armies.md`](commander-armies.md)).

## Modes

- **Skirmish** — one battle against a scripted Commander Army, set up by the player: the centre of the game and of
  its testing ([`game-modes.md`](game-modes.md)).
- **Story** — a Commander's story: missions in order, with technologies carried from one to the next, ending in a
  final battle ([`story.md`](story.md)).
- **Versus** — one battle between two people. Later.
- **mission** — a battle with a script, words and a goal, played in rounds driven by triggers; only inside Story. Its
  entry in a story file is a **level** in code.
- **technology** — a card a mission grants and later missions keep.
- **endless stand** — a mission of waves that grow until the Nexus falls, scored by how far the player got.

## Setting up and playing a Skirmish

- **slot** — one side of a battle, `p1` (west) or `p2` (east): its Commander and its controller. The duel's state
  calls them side A and side B ([`skirmish-saves.md`](../system-design/skirmish-saves.md)).
- **controller** — who plays a slot each round, as the save writes it: `player` (a person, at the screen or through a
  build file), `script:<profile>`, later `agent:<profile>`. On the command line and in a route a player slot is
  written `build:` or `build:<build file>`.
- **script** — a coded player (`src/duel/players.ts`): `balanced`, `rush`, `turtle` and their variants (`rush-area`,
  `turtle-upgrade`, `rush-block` …). One plain idea of how to spend a round; none is a good player.
- **script profile** — a named script with its options, a file in `players/scripts/`: `agro` (rush), `defensive`,
  `steady`, `agro-rich`. What `script:<profile>` names first.
- **agent profile** — a language model's playing style, a Markdown file in `players/agents/`. Later.
- **modifier** — a named rule laid over a battle from the next round: `fast-rounds`, `double-income`.
- **setup** — everything chosen before round 1: map, seed, slots, goal, modifiers, round limit, settings.
- **save file** — a setup and the battle as it stands at the opening of a Build Phase (`*.save.json`). Every way into
  a Skirmish opens one, and every Build Phase can be written as one.
- **brief** — what a player reads before a round: the board, the hand, the credits, what each building costs and
  does. A person, a script and a model all read the same one ([`duels.md`](../system-design/duels.md)).
- **build actions** — a slot's answer for one round: the power it keeps, what it builds and where, its building
  actions, its formation and its stance. Both slots answer blind; there are no turns.
- **build file** — build actions as JSON, for one round or many (`"round": 3`, `"2-4"`, `"*"`).
- **draft** (in a save) — a slot's build actions handed in so far for the round it is at.
- **stance** — whether a slot's army holds or attacks this round.
- **formation** — how a plan sets its buildings that make units: touching (`block`) or apart (`apart`).
- **ask** — a Skirmish asked for in words (`map`, `seed`, `ticks`, `rounds`, `p1`, `p2-commander`, `p1-credits`,
  `modifiers`, `load`): one reader reads them from the `skirmish` command's flags, the game's flags and a route
  (`src/skirmish/ask.ts`).
- **route** — a place in the game written like a web address without its site (`settings`,
  `skirmish?map=pocket&p2=script:agro`); `--at`, the title menu and the browser page's `#at=` read it
  ([`routing.md`](../system-design/routing.md)).
- **play to** — how far the `skirmish` command plays: `--play-to next`, a round's number, or `end`.
- **spectating** — a battle with no player slot: two scripts, watched.
- **playtest note** — a moment saved with `!` on the screen: the save and the keys pressed, for an agent to open.

## Testing

- **sandbox** — a save that opens on a Battle Round set by hand (its `start`: what each side has on the Grid, and
  where its troops head), with no Commander's plan, no Build Phase and one round: it tests one rule, unit, kind of
  ground or showcase, in `sandboxes/`. `grid`, the trials, the measurement and the tests open it exactly
  ([`sandboxes.md`](../system-design/sandboxes.md)). It was called a *testing save* until 2026-11-13. <!-- stale-ok -->
- **trial** — a sandbox played over many seeds, as built and as variants change it (`grid <sandbox> --seeds`).
- **variant** — the same ground with one thing changed: a unit tuned, a rule switched, a formation.
- **bench roster** — the Citizen, Ravel and Proving Grounds units and buildings that sandboxes and tests use; not a
  Commander Army.
- **duel** — the code's word for the two-sided battle a Skirmish plays, a script or a model planning each side
  ([`duels.md`](../system-design/duels.md)).
- **measurement** — battles played the same way before and after a change, so the numbers compare: sandboxes, duels
  and missions ([`measurement.md`](../system-design/measurement.md)).
- **record** — what a measurement keeps of one battle.
- **playtest** — playing a change: Mario at the screen, or an agent pressing keys through `scripts/playtest.mjs`.
- **Experiment** — a design choice put behind a switch in Settings, so Mario can feel both answers and send back the
  settings export.
- **tuned value** — a number set by feel and kept in one place (`src/build/tuning.ts`).

## The screen

- **menu** — the Build Phase's side panel: one list of rows, each with its hotkey.
- **build menu** — the menu's buildings, each with its cost: what can be placed this round (`constructMenu` and the
  `catalog` in code).
- **card** — the panel that replaces the menu while something has the map's attention: what is under the cursor, or
  the building being placed.
- **popup** — one overlay shape: a title and rows, closed by Esc or a click outside. A **message** is a popup with
  nothing to choose.
- **hand-off** — a menu row giving the keyboard to the map, shown by a focus arrow or a see-through cursor.
- **see-through style** — a glyphless cell write that blends a colour into whatever is under it.
- **resize gate** — the TERMINAL TOO SMALL screen shown below the minimum size instead of a cropped Grid.
- **Popup pulse** — an Experiment, unrelated to the Nexus Pulse: a slow breath of light on a popup's border.
- **Activity Logs** — the screen's record of what happened, by declared event and filter, exported as text.

## Engine words, never a player's

- **the Pulse** — the engine's name for the simulation that plays a Battle Round: `src/pulse/`, `pulseTicks`,
  `startPulse`, [`pulse.md`](../system-design/pulse.md). It is not the Nexus Pulse.
- **match** — the kernel's word for a battle.
- **the three worlds** — state, the Pulse and presentation ([`grid-engine.md`](../system-design/grid-engine.md)).

## Words we stopped using

| Old word | Say instead | Why |
| --- | --- | --- |
| turn, `--turn` | round (a player's), tick (the engine's), `--from-tick` | Both slots answer at once; there are no turns | <!-- stale-ok -->
| testing save | sandbox | It is a scene set by hand, not a saved game | <!-- stale-ok -->
| Nexus draft | Nexus Pulse | The moment is the Pulse; *draft* is choosing from the hand |
| wave (for a round's battle) | Battle Round | A wave is what one building makes |
| Recall | regroup | Survivors form up at the front; nobody walks home |
| campaign, run | Story | One Commander's missions in order |
