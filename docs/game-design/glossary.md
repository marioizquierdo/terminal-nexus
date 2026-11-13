# Terminal Nexus — glossary

_Every word the project made its own, one line each, with the page that holds its rules. One word names one thing in
the documents, on screen, in the save file, on the command line and in the code; where the code keeps an older word,
the entry says so. Every unmarked statement is GUIDANCE._

**How to use it.** Before naming a thing — a screen, a setting, a flag, a field, a file, a heading, a line a player
reads — look the word up here. If it is here, use it as written and for nothing else. If it is not, add it in the same
pull request that brings it in: the word in bold, one line on what it names, the page that holds its rules. A word in
[Words we stopped using](#words-we-stopped-using) is not used again outside `docs/history/`; a word in
[Words that do two jobs](#words-that-do-two-jobs) is always said with which job it is doing. Search this page for the
word (the entries are grouped: a battle, movement, the ground, the universe, armies, modes and Story, a Skirmish,
testing and measurement, settings and feedback, the screen, effects, planning, the engine).

## A battle

- **battle** — one Grid, two sides, rounds until a result: the unit of play. The kernel's word is *match*, and the
  two-sided battle in code is the *duel* ([`game-modes.md`](game-modes.md)).
- **round** — one Nexus Pulse, one Build Phase and one Battle Round, in that order: the unit the player counts, "round 2
  of 3". In code the round's number is `round` in the duel and the save, `pulseNumber` in the Build Phase, and `pulse` in a
  mission's triggers (`{ pulse: 2, tick: 0 }`).
- **Nexus Pulse** — the moment each round opens, when the Grid Nexus speaks to its Commander and deals a hand of Nexus
  powers; the player may keep one during the Build Phase (for now the pick is optional). It took the place of "the
  Nexus draft" (the owner, 2026-10-07: "The Nexus Pulse signals the start of a new round").
- **Build Phase** — the hidden, simultaneous, untimed phase where each player makes their build actions. Saving and
  loading happen only here. There are no turns: both sides answer blind ([`concept.md`](concept.md)).
- **Battle Round** — the fixed-tick, deterministic battle that ends each round and plays both sides' build actions out
  in ASCII. The player's word for it everywhere (the owner, 2026-10-04: "Battle Round is better for the player and UI");
  the code calls it the Pulse (`src/pulse/`).
- **tick** — one step of a Battle Round's simulation; a Battle Round lasts a fixed number of them (360, thirty seconds,
  unless a setup says otherwise). `grid --from-tick 90` starts a replay or a log at tick 90.
- **regroup** — what happens when a Battle Round ends: survivors stay where they fought, step back and form up across
  their march line, so the next round starts from the front ([`movement.md`](../system-design/movement.md)).
- **the kept front** — the ground a side's survivors hold after the regroup, where its next round starts; **the front**
  for short.
- **wave** — the units one building makes at once in a Battle Round, set down together on its roof; how many, how many
  waves a round and the seconds between them are on the building's card. It means only this: a round's battle is a
  Battle Round, and what a mission brings is a group.
- **group** — units a mission trigger brings onto the Grid together, at a chosen tick, with a name and an intention.
  Never a wave (the owner, 2026-10-04).
- **goal** — what wins. **Elimination**: destroy the enemy Nexus, or have the healthier one after the last round. The
  only goal built so far ([`skirmish-saves.md`](../system-design/skirmish-saves.md)).
- **score** — who leads, and on what, if the battle ended now: Nexus health by share, then the damage dealt over the
  battle. The brief says it every round (`scoreOf`, [`battles.md`](../system-design/battles.md), reading a battle).
- **reading** — what a Battle Round said beyond its totals, read in one place (`src/battle/reading.ts`): the **front**
  (where the fighting was, 0% at your Nexus and 100% at theirs: the map's tempo), **first contact** (the tick units first
  hurt each other), the nearest an enemy came to each Nexus, what hit each Nexus, each building lost and by what, and
  what a side's own blasts cost it. The brief, the round's report and the scripts read it.
- **round limit** — the most rounds a battle lasts (`rounds` in a save, `--rounds`); a loaded battle may change it
  from the next round on.
- **result** — how a battle ends, on screen: `BATTLE WON`, `BATTLE LOST`, `BATTLE DRAWN` (`<COMMANDER> WINS` when two
  scripts play); a Battle Round's own end reads `VICTORY`, `DEFEAT`, `DRAW` or `TIME'S UP`
  ([`ui-patterns.md`](../system-design/ui-patterns.md)).
- **banner** — where the player sets the army's goal in the Build Phase, aggressive or defensive; by default on the
  enemy Nexus, aggressive. A prototype behind the Battle banner Experiment (`src/match/banner.ts`,
  [`ui-patterns.md`](../system-design/ui-patterns.md)).
- **stance** — whether a side's army attacks or holds this round (`attack`, `hold`); a banner has its own,
  aggressive or defensive.

## Movement

The rules, each with its test, are in [`pulse.md`](../system-design/pulse.md); how they fit together is
[`movement.md`](../system-design/movement.md).

- **troop movement** — the owner's word for what other games call pathfinding: where an army goes, how it forms up and
  how it fights its way there.
- **march**, **battle**, **retreat** — the three movement states a unit is always in (`MoveState`): walking for its
  side's goal, fighting what it sees, or pulled back by the rules. The `unit.state` event records each change.
- **vision** — how far a unit sees an enemy to turn to it: 6 columns, 3 rows, unless content says (`vision`; Averno 12).
- **formation** — the order an army sorts itself into on the march: **flankers**, then **melee**, then **ranged**;
  shorter range first; then by **class** (tank, fighter, support, siege). A unit walks at **half speed** while one that
  should be ahead of it is in its vision. Also a Skirmish's choice of how buildings that make units stand (below).
- **march line** — the line from a side's Commander (or its Nexus while she is out) toward its target, across which the
  regroup forms its ranks.
- **central path** — the line from a side's Nexus to its goal that a marcher keeps near when several ways are as short.
- **step back**, **form up** — the regroup's first two parts: 2 seconds walking back toward its own Nexus, then 6 seconds
  forming ranks across the march line; 2 more let the slowest arrive.
- **sticks** — a unit keeps its enemy until it falls, letting go after 2½ seconds of being unable to strike it.
- **breach** — when the enemy's buildings close every way, a unit breaks through the fewest of them; rock is never broken.
- **roof** — the tiles of a building that makes units: its wave comes out on the roof, and units walk **off the roof**
  toward the fight (the "Way off the roof" Experiment).
- **make way** — what idle units on a side's roofs do for a wave that has no room; also a slower unit swapping tiles
  with one behind it in a lane (`march.made-way`).
- **distance field** — the walking cost from every tile to a goal, shared by every unit going there, walked downhill
  ([`movement.md`](../system-design/movement.md)); the code calls the parts that build it routes (`src/routing/`).
- **flight map** — the field a worker walks to run from every threat at once.
- **movement credit** — what a unit spends to step: a row costs two, heavy ground more
  ([`pulse.md`](../system-design/pulse.md)).
- **stalled**, **idle** — a unit five seconds blocked (trying in vain), or five seconds doing nothing; counted by the
  measurement ([`measurement.md`](../system-design/measurement.md)).

## The ground

- **Grid** — the rectangular integer playfield a battle is fought on ([`grid.md`](../system-design/grid.md)).
- **tile** — one place on the Grid, drawn one column wide ([`presentation.md`](../system-design/presentation.md)).
- **footprint** — the tiles a body covers; with its **anchor** and **facing**, where it stands
  ([`grid.md`](../system-design/grid.md)).
- **map** — the ground and its slots: where each Nexus stands and where its troops hold. The built-in maps are
  `crossing` and `pocket`; a map file is the same as JSON.
- **target** — the place a side's troops head for: they engage what comes within reach on the way, and stand there
  ([`pulse.md`](../system-design/pulse.md)).
- **region** — a named area of a mission's map (`line`, `nw-ridge`): where a group spawns or a target points.
- **distance** — columns across plus two for each row up or down, between the nearest tiles of two footprints; every
  range, reach and radius counts in it, and a reach of 1 is touching ([`grid.md`](../system-design/grid.md)).
- **reach**, **range** — how far an attack, an aura or a heal touches, counted in distance; melee's reach is 1.
- **build range** — the ground a new building needs a tile in: within the construction radius of the player's Grid
  Nexus and of every standing building linked to it; a building planned this round gives its range from the next.
- **room** — the tiles a building that makes units keeps free round it, so its waves have somewhere to appear.
- **rock**, **scrub**, **burning ground** — ground nothing walks through (air flies over it); ground that weighs two steps; a patch a shell set
  alight, weighing four, which is state, not an effect ([`grid.md`](../system-design/grid.md),
  [`effects.md`](../system-design/effects.md)).
- **deposit**, **salvage** — the two sources of the one resource: a finite tile workers harvest, and what a destroyed
  structure drops ([`pulse.md`](../system-design/pulse.md), economy).
- **starter map** — the Build Phase's one disposable map and the few buildings it offers, there to be played and
  replaced; not a mission.

## The universe

Who these people are is in [`lore.md`](lore.md); what playing them is like, in [`commander-armies.md`](commander-armies.md).

- **Prime Nexus**, **Grid Nexus** — the pyramid that stays home and never moves, and the replica it sends onto the Grid,
  which must not fall. A Nexus is named for the faction that holds it: the Citizen Nexus, the Ravel Nexus, the Feudal,
  Glitch and Alder Nexus; never a proper name, and never "Nexus Proxy".
- **Terminal Nexus** — the unknown end the replicas' wars may be choosing; also the game's name.
- **the Activation**, **the Return** — the awakening of the Prime Nexuses, and the arrival people dreamed of before it.
- **Nexus Symbol**, **Symbol** — the culture's word for a Commander: a person a Nexus chose and restores after death.
- **restored** — what the Nexus Pulse does to a fallen Commander, the next round for most; "filed a round late" for some.
- **Operator** — how the interface addresses the player; each faction reads the title differently, and nothing says what
  it is.
- **Ancients**, **Ancient Original**, **golem**, **artifact** — the network's makers, the rare beings that come through
  it, its maintenance bodies, and the objects that woke with it. Deliberately unexplained.
- **the Eternals** — the owner's word for what awakens in a story's final battle ([`story.md`](story.md)).
- **claimant** — a civilization that holds a Prime Nexus.
- **Citizen**, **Ravel**, **Glitch**, **Feudal**, **Alder** — the five factions (Citizens, Ravels; Glitch and Alder
  have no plural). Citizens and Ravels are built; the other three are lore. Glitch call their Nexus the **Silent Queen
  Nexus**; a Feudal **Duo** is one office in two bodies, over **Clerics** and **Submitters**.
- **verb**, **contradiction**, **promise**, **relationship to chance** — what the faction design law asks of every
  faction: Build, Break free, Recompile, Obey, Outgrow.
- **confirmation word** — the interface's one tell per faction: `ACKNOWLEDGED`, `HEARD`, `ACCEPTED`, `WITNESSED`,
  `NOTED`.
- **bark**, **pre-battle exchange**, **briefing**, **debrief** — 3–8 words from an ordinary unit; three lines between
  two Commanders; a mission's words before and after ([`lore.md`](lore.md), budgets).

## Armies

- **Commander** — the leader a player plays, with their own unit, powers and army: Vasse, Averno and Dob so far
  ([`commander-armies.md`](commander-armies.md)). On the Grid a persistent `@` (Averno's is `&`); she falls in most
  battles and the Nexus Pulse restores her.
- **faction** — the side a Commander belongs to, with its Nexus, units and buildings: Citizen and Ravel so far. The
  faction is the whole pool; an army fields a few of them.
- **affinity** — how a Commander is bound to a Nexus: **Native**, **Estranged**, **Unsanctioned**, **Foreign**,
  **Dual-bound**, **Proxy**. Averno is Native with a **leak**: a card from the Ravel Nexus in some rounds' hands.
- **Commander Army** — everything one player brings: faction, Commander, starting units and buildings, blueprints,
  upgrades, Nexus powers and Specials. The owner's word for it is her *deck*, a name for the package, never deck
  behaviour; the code has no deck.
- **army file** — `armies/<id>/army.json`, an army as data, stacked: `armies/all` (what any Commander may use), the
  faction armies, one army per Commander ([`army-authoring.md`](../system-design/army-authoring.md)).
- **card** — a building or a Nexus power as an army file defines it, once, and a mode offers it; what a level offers is
  `Offer` in code, a duel side's narrower list its **roster**.
- **Nexus power** — a named effect with one plain line of description, dealt in a **hand** at each Nexus Pulse; the
  player may **keep** one, and the popup lists what is kept as **ACTIVE**. **draft** is the word for choosing from that
  hand.
- **Nexus power pool** — every power a level or an army can deal a hand from; never "pool" alone.
- **schedule**, **chance**, **requirement**, **repeatable** — which rarity each card of a hand is, round by round; how
  likely a power is beside others of its rarity; what must hold before it is dealt; whether it may be kept again
  ([`commander-armies.md`](commander-armies.md), how the Nexus Pulse deals).
- **rarity**, **tier**, **role** — the three tags an offered card carries: how often it is dealt (common, uncommon,
  rare, legendary), how far up the tech tree it is (1 to 3), what it is for.
- **building**, **unit** — what a player places in the Build Phase, and what a building makes to fight. A Commander is
  a unit too, and marches like any other. Content ids, the kernel and older pages call a building a *structure*
  (`structure.citizen.barracks`, `structure.destroyed`). A building that makes units is a **producer**.
- **worker** — a unit that gathers rather than fights; built in the Proving Grounds bench, and the subject of the worker
  economy milestone. Today it only runs.
- **supply** — the cap on how many units a side may field; supply buildings raise it (`units 5/12` on the credits line).
- **building action** — something done to a standing building in the Build Phase: an **upgrade** (it makes that
  building better), a mode, or an order ("Hold production", which keeps its waves home for a round). No building has
  levels.
- **general upgrade** — an improvement to every unit or every building of a kind, from a Nexus power or a building's
  standing; never one unit at a time.
- **upgrade** (of a power) — a power dealt once another is kept, listed in its place once kept itself (`Drill Schedule II`).
- **unlock**, **adds** — inside a battle only the tech tree unlocks; a Nexus power **adds** ("Adds building: Aid
  Station."). A story's mission unlocks cards between missions.
- **ability** — what a unit does on its own, by a kind from one table (`src/abilities/`): an aura, a bounty, loaded
  dice. A Commander's own ability is her **skill** (Vasse's By the Book, Dob's Bounty and Loaded Dice).
- **credits** — what everything costs. Each round's income follows the **credits curve** (`ROUND_CREDITS`), the income
  part of the **expected power curve** every army is designed against (`src/armies/curve.ts`); a slot's **credits
  share** is its part of that curve (1 is the curve's own; `--p1-credits 1.25`). Some screen lines still say
  *resources*.
- **tech tree**, **blueprint**, **Special**, **research** — the mechanisms that grow an army between rounds and
  missions, each naming exactly one thing ([`commander-armies.md`](commander-armies.md)): a blueprint is what a player
  may build, a building what they did build. The tree holds buildings and
  building upgrades; its **hard counters** are reachable by building, never by luck.
- **catch-up** — what keeps an early lead small without rubber-banding: the curve, commons first, public kept powers,
  the defender's ground ([`commander-armies.md`](commander-armies.md)).

## Modes and Story

- **mode** — what decides which battles are played, in what order, against whom, and what carries between them
  ([`game-modes.md`](game-modes.md)).
- **Skirmish** — one battle against a scripted Commander Army, set up by the player: the centre of the game and of
  its testing ([`game-modes.md`](game-modes.md)).
- **Story** — a Commander's story: missions in order, with technologies carried from one to the next, ending in a
  final battle ([`story.md`](story.md)). Its parts: **the tutorial**, **technology missions**, **the endless stand**,
  **the final battle**.
- **Versus** — one battle between two people. Later.
- **mission** — a battle with a script, words and a goal, played in rounds driven by triggers; only inside Story. Its
  entry in a story file is a **level** in code.
- **story file** — `stories/<id>/story.json`, a Commander's missions as data.
- **technology** — a card a mission grants and later missions keep; the story file stores it in a level's `unlocks`.
- **trigger** — a condition and the actions taken when it holds (`{ id, when, once?, do }`); its actions run in the
  **simulation** band (`spawn`, `target`, `win`) or the **presentation** band (`say`, `focus`) ([`story.md`](story.md)).
- **main goal**, **bonus goal**, **objective** — what a mission is won by, the harder optional one that grants a
  technology, and the code's shape for either.
- **raid** — a group a mission's opponent sends, with its **intention**: one line saying what it means to do, shown in
  the panel ([`scripted-opponent.md`](scripted-opponent.md)).
- **scene**, **dialog** — a round's lines in a mission, and the popup docked at the bottom of the map that shows them.
- **cutscene** — a mission's briefing, exchanges and debrief played as a sequence (Milestone 9).
- **endless stand** — a mission of groups that grow until the Nexus falls, scored by how far the player got.
- **save slot** — one story in progress, naming its Commander; not a Skirmish's slot.
- **PERIMETER**, **RIGHT OF SALVAGE** — Vasse's first mission, the tutorial, and her first technology mission. PERIMETER
  is the first map the game was built on, no longer its testing map.

## A Skirmish

How a Skirmish is set up, saved and opened is [`skirmish-saves.md`](../system-design/skirmish-saves.md); the battle it
plays, [`battles.md`](../system-design/battles.md).

- **slot** — one side of a battle, `p1` (west) or `p2` (east): its Commander and its controller. The duel's state
  calls them side A and side B.
- **controller** — who plays a slot each round, as the save writes it: `player` or `player:<name>` (a person, at the
  screen or through a build file), `script:<profile>` (or a script's own name, `script:rush`; `script:` alone builds
  nothing), later `agent:<profile>`. On the command line and in a route a player slot is written `build:` or
  `build:<build file>`. The setup screen shows them as `Player: <name>`, `Scripted: <profile>`, `Agent: <profile>`.
- **opponent** — what plans the other side: a script profile driving a Commander Army.
- **script** — a coded player (`src/battle/players.ts`): `balanced`, `rush`, `turtle` and their variants (`rush-area`,
  `turtle-upgrade`, `rush-block` …), and `reader`, which plans from the battle's reading (the stance that has traded
  better, a Turret when the enemy reached its Nexus, apart against area damage). One plain idea of how to spend a round;
  none is a good player.
- **script profile** — a named script with its options, a file in `players/scripts/`: `agro` (rush), `defensive`,
  `steady`, `agro-rich`. What `script:<profile>` names first.
- **agent profile** — a language model's playing style, a Markdown file in `players/agents/`. Later (Milestone 21).
- **modifier** — a named rule laid over a battle from the next round: `fast-rounds`, `double-income`.
- **setup** — everything chosen before round 1: map, seed, slots, goal, modifiers, round limit and the Battle Round's
  ticks (`roundTicks`); the settings travel beside it.
- **save file** — a setup and the battle as it stands at the opening of a Build Phase (`*.save.json`). Every way into
  a Skirmish opens one, and every Build Phase can be written as one.
- **brief** — what a player reads before a round: the board, the hand, the credits, what each building costs and
  does, the score and the last round's reading. A person, a script and a model all read the same one ([`battles.md`](../system-design/battles.md)).
- **battle picture** — the battle drawn as text, p1's things in lower case and p2's in upper case (`battlePicture`):
  the brief's map between rounds, and `skirmish --show 0,120,end` during a Battle Round.
- **build actions** — a slot's answer for one round: the power it keeps, what it builds and where, its building
  actions, its formation and its stance. Both slots answer blind; there are no turns. The code, older pages and a few
  screen lines still say *plan* (`BuildState.planned`, `Plan`, a "committed plan", a trigger's `commitPlan`, "back to the plan").
- **build file** — build actions as JSON, for one round or many (`"round": 3`, `"2-4"`, `"*"`).
- **draft** (the save's field) — a slot's build actions handed in so far for the round it is at. The save keeps this
  older word; in writing, say *build actions handed in so far*.
- **hold** — the word does three jobs, so say which: in a map, the ground where a slot's troops stand (`hold`); as a
  stance, staying in front of the Nexus; and *Hold production*, a building's order.
- **formation** (of buildings) — how build actions set the buildings that make units: touching (`block`), apart
  (`apart`), or each where its placement says (`zones`, the same as naming none).
- **ask** — a Skirmish asked for in words (`map`, `seed`, `ticks`, `rounds`, `p1`, `p2-commander`, `p1-credits`,
  `modifiers`, `load`): one reader reads them from the `skirmish` command's flags, the game's flags and a route
  (`src/skirmish/ask.ts`).
- **route** — a place in the game written like a web address without its site (`settings`,
  `skirmish?map=pocket&p2=script:agro`); `--at`, the title menu and the browser page's `#at=` read it
  ([`routing.md`](../system-design/routing.md)).
- **play to** — how far the `skirmish` command plays: `--play-to next`, a round's number, or `end`.
- **the `skirmish` command** — `bin/skirmish.ts`, a Skirmish played headless; its manual is the comment
  `src/cli/skirmish.ts` opens with.
- **Skirmish screen**, **setup screen** — the title menu's `[1] Skirmish` (`New game`, `Load game`), and the screen that
  picks the map and each slot's Commander and controller ([`ui-patterns.md`](../system-design/ui-patterns.md)).
- **spectating** — a battle with no player slot: two scripts, watched; the menu is only Explore Map and Start next round.
- **mirror** — a battle of one Commander against herself, or a sandbox drawn the same from both ends.

## Testing and measurement

- **sandbox** — a save that opens on a Battle Round set by hand (its `start`: what each side has on the Grid, and
  where its troops head), with no Commander's plan, no Build Phase and one round: it tests one rule, unit, kind of
  ground or showcase, in `sandboxes/`. `grid`, the trials, the measurement and the tests open it exactly
  ([`sandboxes.md`](../system-design/sandboxes.md)). It was called a *testing save* until 2026-11-13. <!-- stale-ok -->
- **opening** — the state a Battle Round starts from; a sandbox's `start` writes one by hand (`openBattle`,
  `src/skirmish/opening/`). The power curve's *opening* is a battle's first rounds.
- **trial** — a sandbox played over many seeds, as built and as variants change it (`grid <sandbox> --seeds`); a
  **trial file** in `sandboxes/trials/` names several.
- **variant** — the same ground with one thing changed: a unit tuned, a rule switched, a formation.
- **engine**, **meter**, **cells**, **summary** — a trial's parts: a build's kernel and content; its clock; each map
  and variant's battles summed up; the printed tables ([`sandboxes.md`](../system-design/sandboxes.md)).
- **bench roster** — the Citizen, Ravel and Proving Grounds units and buildings that sandboxes and tests use; not a
  Commander Army.
- **the bench**, **engage saves** — `sandboxes/engage/`: twelve units a side on six grounds, the yardstick for how fast
  battles are decided. Not the bench roster.
- **route saves** — `sandboxes/movement/route-*`: each one shape a unit's walk must manage.
- **showcase** — a whole battle in `sandboxes/showcase/`, to look at.
- **duel** — the code's word for the two-sided battle a Skirmish plays, a person, a script or a model planning each
  side ([`battles.md`](../system-design/battles.md)).
- **measurement** — battles played the same way before and after a change, so the numbers compare: sandboxes, duels
  and missions (`bin/measure.ts`, [`measurement.md`](../system-design/measurement.md)).
- **record** — what a measurement keeps of one battle.
- **spec** — which seeds, maps, players and levels a measurement plays: `quick` or `full`.
- **current**, **superseded** — a kept measurement's status: the latest on the rules now built, or replaced by a later
  one when the rules changed under it.
- **`grid`** — the engine tool, editor and replay viewer (`bin/grid.ts`); its headless output is the **levelled log**
  (`ERROR` to `TRACE`), and a run ends with a **report** (`src/report/`).
- **playtest** — playing a change: Mario at the screen, or an agent pressing keys through **the scripted playtest**
  (`scripts/playtest.mjs`).
- **the playtest page** — the browser build published as a private claude.ai page; its **demo** buttons open the game
  where a question is ([`ui-patterns.md`](../system-design/ui-patterns.md)).
- **player's diary** — an agent's short account of playing a whole Skirmish, what read badly and what did nothing.
  Planned (Milestone 20).

## Settings and feedback

- **Settings** — one list in titled sections, from the game menu's `[s]`; every setting is declared once with its
  **tier** in `src/build/all-settings.ts`: **player** (shown and saved), **experiment** (shown, never saved, exported)
  or **tuned** (a constant in code) ([`ui-patterns.md`](../system-design/ui-patterns.md)).
- **Experiment** — a design choice put behind a switch in Settings, so Mario can feel both answers and send back the
  settings export; it names the question it serves, and once settled it becomes a tuned value.
- **tuned value** — a number set by feel and kept in one place (`src/build/tuning.ts`); never copied into prose.
- **settings export** — every setting and Experiment as `name = value` text, with the build's commit; `--settings` and
  `#settings=` read it back.
- **Activity Logs** — the screen's record of what happened, by declared **event** and **filter** (`src/log/`),
  exported as text; the game menu's row reads `[a] Activity logs`. A log is a record, never an input.
- **playtest note**, **note file** — a moment saved with `!` on any screen: the round as it opened, the keys pressed
  since, the screen and a line; `--note <file>` opens it there.
- **display options** — `--colors` (monochrome, 256, truecolor), `--theme` (dark, light), `--glyphs` (the **glyph
  pack**: ascii, unicode), `--reduced-motion` ([`DEVELOPMENT.md`](../../DEVELOPMENT.md)). In code the colour depth is
  `ColorDepth`.
- **reduced motion** — a player setting that snaps every movement and keeps only what is not movement, such as a blink.

## The screen

[`ui-patterns.md`](../system-design/ui-patterns.md) holds every rule here.

- **top bar**, **side panel**, **map**, **bottom line** — the screen's four regions: the title and what Esc does; the
  menu, a card or the Battle Round panel; the Grid in a closed rectangle; one line of contextual help.
- **title menu** — the first screen: Skirmish, Story, Settings, About, Exit, each a row with its route.
- **game menu** — Esc on the Build Phase's menu: Settings, Controls and hotkeys, Activity logs, Save game, Restart, Quit.
- **menu** — the Build Phase's side panel: one list of rows, each with its hotkey; **the credits line** above the
  buildings says what is left to spend and the supply.
- **build menu** — the menu's buildings, each with its cost: what can be placed this round (`constructMenu` and the
  `catalog` in code); never "construct menu".
- **row**, **hotkey** — one line of a list, and its key shown as `[x]`; a hotkey that is not shown does not exist.
- **named command** — an action with a name, which keyboard, mouse and a script all send ([`input.md`](../system-design/input.md)).
- **named pattern** — an interface shape with a name in `ui-patterns.md` (the raid in the panel, the dialog), so the next
  screen reuses it.
- **highlight bar**, **focus** — the one "you are here" on the menu, and where the keyboard is (`BuildState.focus`): the
  menu or the map cursor, never both.
- **placing**, **Explore Map**, **plain navigation** — the map's three modes: a building armed with its **ghost** at
  the cursor; the panel describing what is under the cursor (`[e]`); the bare cursor.
- **card** — the panel that replaces the menu while something has the map's attention: what is under the cursor, or
  the building being placed. A title, a subtitle, a description and its numbers.
- **popup** — one overlay shape: a title and rows, closed by Esc or a click outside. A **message** is a popup with
  nothing to choose.
- **hand-off** — a menu row giving the keyboard to the map, shown by the **focus arrow** (a building armed) or the
  **see-through cursor** (Explore Map), then a **blink** (*pressed* in code).
- **card reveal** — the three beats a card opens with: rows fade, the chosen row slides up, the card types in.
- **see-through style** — a glyphless cell write that blends a colour into whatever is under it.
- **the raid in the panel**, **your troops' target** — what the coming round brings and where the player's troops will
  head, in the menu's free rows; the raid's **intent trail** on the map.
- **the battle banner** — the panel that starts a Battle Round: the Target and the Stance, `[t] Change Target`.
- **Controls page** — every key and click by where the player is (`[c]` or `?`).
- **resize gate** — the TERMINAL TOO SMALL screen shown below the minimum size instead of a cropped Grid.
- **Popup pulse** — an Experiment, unrelated to the Nexus Pulse: a slow breath of light on a popup's border.
- **last seconds**, **cease fire** — the Battle Round's ending beats before its result.

## Effects

[`effects.md`](../system-design/effects.md) holds every rule here.

- **effect** — a pure function from absolute presentation time to cells, made by a **recipe** (`fx.move.trail`) and
  painted in a **band**; it never touches state.
- **the four families** — **animations** (an entity's own frames, the only family that may change its glyph),
  **particles**, **shading** (glyphless colour) and **tweens** (a value eased between two over time).
- **track**, **follow-up** — the timestamped requests an entity animates by, and what a play schedules for when it
  completes; never a callback.
- **presentation time**, **cosmetic seed** — the clock effects read, independent of ticks; and the seed of their
  randomness, a hash, never the gameplay stream.
- **the corruption law** — an effect may recolour something but never replace its glyph; the compositor drops any
  effect cell that would.
- **three forms** — full, reduced motion and monochrome: every effect owes all three.
- **glyphless** — a cell write that keeps the glyph under it and changes only its colour or attributes.
- **style role** — what a cell carries instead of a colour (`src/view/roles.ts`); the theme maps roles to colours.
- **reserved colour** — a colour that means one thing: red, the player's own Nexus being hurt.

## Planning and working

- **shelf** — where a document sits: **current** (`docs/game-design/`, `docs/system-design/`), **planning**
  (`docs/milestones/`), **history** (`docs/history/`) ([`docs/README.md`](../README.md)).
- **RULE**, **GUIDANCE**, **IDEA** — a statement built and held by a test, the default, a sketch
  ([`grid-engine.md`](../system-design/grid-engine.md)).
- **milestone** — one question about the game, small enough to play and judge; `PLANNED`, `CURRENT` or `COMPLETE`
  (or paused: `REVISE`, `BLOCKED`, `STOPPED`). Numbers are identities, never an order.
- **step** — one pull request's worth of a milestone (12A), **not started**, **built** or **done**; the **current
  step** is the one in scope.
- **spike** — a small, throwaway build that answers one question reading cannot ([`DEVELOPMENT.md`](../../DEVELOPMENT.md)).
- **feedback round** — one batch of Mario's feedback, logged item by item and worked through (the `feedback-round`
  skill); never a battle's round.
- **ask** (of Mario) — something waiting on him, of one kind: **play**, **watch**, **decide** or **do**; at most five
  wait, in **Waiting on Mario** ([`next-steps.md`](../milestones/next-steps.md)).
- **open question** — a decision only Mario can make, in [the register](../milestones/open-questions.md) with a
  recommendation; answered, it moves to history.
- **backlog**, **carry-over**, **cleanup queue** — work no milestone owns yet; small items that rode along; refactors
  waiting their turn.
- **lesson** — something learned the hard way, dated in `docs/history/lessons-learned.md`.

## Engine words, never a player's

- **the Pulse** — the engine's name for the simulation that plays a Battle Round: `src/pulse/`, `pulseTicks`,
  `startPulse`, [`pulse.md`](../system-design/pulse.md). It is not the Nexus Pulse.
- **match** — the kernel's word for a battle (`MatchState`); the **match layer** (`src/match/`) is the rules between the
  Build Phase and the kernel: openings, the regroup, banners.
- **the three worlds** — state, the Pulse and presentation ([`grid-engine.md`](../system-design/grid-engine.md)).
- **kernel** — the deterministic core (`src/pulse/`, `src/state/`, `src/grid/`, `src/events/`, `src/rng/`): no
  terminal, clock or `Math.random`.
- **logical time** — ticks, as the kernel counts them; presentation time is the screen's.
- **gameplay stream** — the seeded PCG32 randomness the rules draw from; the cosmetic randomness never touches it.
- **event** — what the kernel emits as a tick resolves (`entity.died`, `move.blocked`); an Activity Logs event is a
  different, declared thing.
- **content id** — a thing's name in content: `unit.citizen.trooper`, `structure.citizen.nexus`, `fx.light.flash`.

## Words that do two jobs

Say which job, every time.

| Word | One job | The other |
| --- | --- | --- |
| battle | a whole fight, rounds until a result | a unit's movement state, fighting what it sees |
| goal | what wins a battle (elimination) | where a unit's walk ends (`goalsNear`) |
| target | where a side's troops head (`target` in a trigger) | the enemy one unit is fighting |
| route | a place in the game (`skirmish?seed=1`, `src/cli/route.ts`) | a unit's walk round rock and buildings (`src/routing/`, the route saves) |
| hold | the ground a slot's troops stand on in a map | the `hold` stance; *Hold production* |
| draft | choosing a power from a hand | the save's field for build actions handed in so far |
| card | a building or power an army offers | the side panel's description of what has the map's attention |
| map | the ground (`crossing`, a map file) | the screen's region that draws the Grid |
| band | where an effect paints (`effects`, `highlights`) | a trigger's action kind: simulation or presentation |
| bench | the bench roster (units for tests) | the bench of engage saves (`sandboxes/engage/`) |
| ask | a Skirmish asked for in words | something waiting on Mario |
| slot | a side of a Skirmish (`p1`, `p2`) | a Story save slot |
| round | a Nexus Pulse, a Build Phase and a Battle Round | a feedback round |
| step | a milestone step | a unit's step on the Grid |
| level | a mission's entry in a story file | a log level (`--log-level`) |
| formation | the order troops march in | how build actions set the buildings that make units |
| skill | a Commander's own ability | an agent skill in `.claude/skills/` |
| pulse | the Nexus Pulse (a player's word) | the Pulse (the engine's); `pulse` in triggers counts rounds; the Popup pulse is a breath of light |

## Words we stopped using

The validator rejects the ones it can match (`scripts/check-repository.sh`, retired terminology); `docs/history/` keeps
the words it was written with. A line that quotes one on purpose ends with `<!-- stale-ok -->`.

| Old word | Say instead | Why |
| --- | --- | --- |
| turn, `--turn` | round (a player's), tick (the engine's), `--from-tick` | Both slots answer at once; there are no turns | <!-- stale-ok -->
| plan (as the name of a round's answer in a format, a command or a design page) | build actions | The owner's word for what a slot hands in; the code and a few screen lines still say `plan` |
| `--battle`, `--battles`, `--play-until-win`, `--wait`, `--ready` | `--play-to next`, a round, `end` | Either slot hands its build actions in alone, in any order |
| testing save, `skirmish-testing/` | sandbox, `sandboxes/` | It is a scene set by hand, not a saved game | <!-- stale-ok -->
| Nexus draft | Nexus Pulse | The moment is the Pulse; *draft* is choosing from the hand |
| Pulse, Battle step (for a round's battle on screen) | Battle Round | The player's word; the Pulse is the engine's |
| wave (for a round's battle) | Battle Round | A wave is what one building makes |
| Recall | regroup | Survivors form up at the front; nobody walks home |
| campaign, run, Challenge, Challenge runs | Story, Skirmish | One Commander's missions in order; a battle is too long for a run of many |
| the `duel` command | the `skirmish` command | The duel is the battle a Skirmish plays; one command plays it |
| unlock (for what a Nexus power does) | adds | *Unlock* is the tech tree's word alone |
| construct menu | build menu | One name for the list of buildings |
| Nexus Proxy | Grid Nexus | One name for the replica on the Grid |
| Veil, planning phase | Build Phase | The original specification's words | <!-- stale-ok -->
| battlefield | the Grid | The original specification's word | <!-- stale-ok -->
| canon | the design documents | The design is the current shelf, edited in place | <!-- stale-ok -->
| gate, gate report, `GATED` | milestone step, the pull request, `PLANNED` | Milestones and steps replaced gates | <!-- stale-ok -->
| `specs/`, `evidence/` | `docs/game-design/`, `docs/system-design/`; screenshots on the pull request | The folders were dissolved | <!-- stale-ok -->
| `--capability`, `CapabilityMode` | `--colors`, `ColorDepth` | One name for the colour depth everywhere |
| `--tile-width` | nothing | A tile is one column at every size |
