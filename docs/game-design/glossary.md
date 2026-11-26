# Terminal Nexus — glossary

_The project's general words, one line each, with the page that holds its rules. One word names one thing in the
documents, on screen, in the save file, on the command line and in the code. Every unmarked statement is GUIDANCE._

## What belongs here

This page is the quick check that a word is not ambiguous. Before naming a thing — a screen, a setting, a flag, a file,
a heading, a line a player reads — look the word up: if it is here, use it as written and for nothing else.

- **A term earns an entry** when it is a general abstraction used across the game, its documents or its tools:
  something a player, a designer or an agent writing code meets in more than one place.
- **It does not earn one** when it is a detail of one module: a field name, a helper, a setting's internal value, one
  step of one rule. That detail belongs in its module's page or a code comment.
- **Before adding a term**, check that it is not already here under another word, that it names exactly one thing, and
  that it is not in [Words we stopped using](#words-we-stopped-using); a word in
  [Words that do two jobs](#words-that-do-two-jobs) is always said with which job it is doing.
- **One line each**: the word in bold, what it names, the page that holds its rules. Where the code keeps an older
  word, the entry says so.

The words are in four layers, alphabetical within each: [the game](#the-game) (what a player reads and does, with the screen's words in a list of their own),
[the world](#the-world) (lore and factions), [making and testing](#making-and-testing) (setting up, playing, measuring
and planning the game) and [the engine and the code](#the-engine-and-the-code).

## The game

- **ability** — what a unit does on its own, by a kind from one table (`src/engine/abilities/`): an aura, a bounty, loaded
  dice. A Commander's own ability is her **skill** (Vasse's By the Book, Dob's Bounty and Loaded Dice).
- **advance** — how far each side's army moved toward the enemy Nexus during a round; a battle reading
  ([`battles.md`](../system-design/battles.md)).
- **affinity** — how a Commander is bound to a Nexus: **Native**, **Estranged**, **Unsanctioned**, **Foreign**,
  **Dual-bound**, **Proxy**. Averno is Native with a **leak**: a card from the Ravel Nexus in some rounds' hands
  ([`commander-armies.md`](commander-armies.md)).
- **army** — every unit a side has on the battlefield, its Commander included; what a Commander brings to a battle as
  a package is the **Commander Army** ([`movement.md`](../system-design/movement.md), its words).
- **army group** — a side's units that can fight together: each within 5 tiles of another in it, chained (the
  **engagement**'s reach, so a round's report and the troops' aiming share one rule); worked out about once an in-game
  second; its centre is the Commander when she is in it, else the unit nearest its middle; a side's Nexus is always an
  army group of its own, and a building that shoots joins the army group within reach. Its **front** faces its nearest
  enemy army group. Designed; built in the pull request after the rally point's ([`movement.md`](../system-design/movement.md)).
- **army group formation** — an army group's ranks across the line to its nearest enemy army group, the formation's
  priority list front to back.
- **army value** — what an army cost, in credits: each unit valued at what its building pays for one unit, its card's
  cost divided by the units it makes a round ([`battles.md`](../system-design/battles.md)).
- **banner** — the flag drawn at a rally point (`!`, `⚑` with Unicode symbols). The code still says *banner* for the
  rally point itself (`src/build/banner.ts`, `BuildActions.banner`).
- **battle** — one battlefield, two sides, rounds until a result: the unit of play. The code is `src/battle/` (`BattleState`,
  `BattleSetup`, `BattleResult`); the battle engine says *match* ([`battles.md`](../system-design/battles.md)).
- **battle reading** — what a battle says, read in one place (`src/battle/reading/`) for the brief, the round's report
  and the scripts: the score; each side's army (composition and army value at the round's start and end, its losses);
  its buildings (standing, damaged, lost and what destroyed each); the advance; the nearest an enemy came to each Nexus;
  damage taken by source; and the engagements. Every reading is **public** (what the Battle Round shows both sides); the Build Phase's
  credits, hand and build actions are private, and no reading touches them ([`battles.md`](../system-design/battles.md)).
- **Battle Round** — the fixed-tick, deterministic battle that ends each round and plays both sides' build actions out
  in ASCII; the player's word everywhere. The code calls it the Pulse (`src/engine/pulse/`).
- **build actions** — a side's answer for one round: the power it keeps, what it builds and where, its building
  actions, its formation and its stance; both sides answer blind. The code and a few screen lines still say *plan*.
- **Build Phase** — the hidden, simultaneous, untimed phase where each player makes their build actions; saving and
  loading happen only here. There are no turns ([`concept.md`](concept.md)).
- **build range** — the ground a new building needs a tile in: within the construction radius of the Nexus and of
  every standing building linked to it.
- **building**, **unit** — what a player places in the Build Phase, and what a building makes to fight; a Commander is
  a unit too. A building that makes units is a **producer**. Content ids and the battle engine say *structure*
  (`structure.citizen.barracks`).
- **building action** — something done to a standing building in the Build Phase: an upgrade, a mode, or an order
  ("Hold production"). No building has levels.
- **card** — a building or a Nexus power as an army file defines it, once, and a mode offers it, tagged with its
  **rarity** (common to legendary), **tier** (1 to 3) and **role**. `Offer` in code.
- **catch-up** — what keeps an early lead small without rubber-banding: the curve, commons first, public kept powers,
  the defender's ground ([`commander-armies.md`](commander-armies.md)).
- **Commander** — the leader a player plays, with her own unit, powers and army: Vasse, Averno and Dob so far. On the
  battlefield a persistent `@` (Averno's is `&`); she falls in most battles and the Nexus Pulse restores her
  ([`commander-armies.md`](commander-armies.md)).
- **Commander Army** — everything one player brings: faction, Commander, starting units and buildings, blueprints,
  upgrades, Nexus powers and Specials. The owner calls it her *deck*, a name for the package, never deck behaviour.
- **credits** — what everything costs, on screen and in the code. Each round's income follows the **credits curve**,
  part of the **expected power curve** every army is designed against (`src/armies/curve.ts`).
- **deposit**, **salvage** — the two sources of the one resource: a finite tile workers harvest, and what a destroyed
  building drops ([`pulse.md`](../system-design/pulse.md)).
- **distance** — columns across plus two for each row up or down, between the nearest tiles of two footprints; every
  **reach**, **range** and radius counts in it, and a reach of 1 is touching ([`battlefield.md`](../system-design/battlefield.md)).
- **engagement** — units of both sides fighting in one place: it starts at a first hit, takes in every hit within 5
  tiles of one already in it, and ends after 5 seconds with no hit there. Each has where and when, damage and losses by
  side, and the units engaged by side ([`battles.md`](../system-design/battles.md)).
- **fast forward** — a Battle Round that has settled (no hit to its end, the units close to where they end) played
  faster until its last seconds, labelled; any key returns it to normal speed ([`ui-patterns.md`](../system-design/ui-patterns.md)).
- **faction** — the side a Commander belongs to, with its Nexus, units and buildings: the whole pool an army fields a
  few of. Citizen and Ravel are built.
- **formation** — the order an army marches in (flankers, melee, ranged; then by class); also how build actions set
  the producers: touching (`block`), apart (`apart`) or where each placement says (`zones`)
  ([`movement.md`](../system-design/movement.md), [`battles.md`](../system-design/battles.md)).
- **general upgrade** — an improvement to every unit or every building of a kind, from a Nexus power or a building's
  standing; never one unit at a time.
- **goal** — what wins. **Elimination**: destroy the enemy Nexus, or have the healthier one after the last round; the
  only goal built ([`skirmish-saves.md`](../system-design/skirmish-saves.md)).
- **battlefield** — the rectangle of tiles a battle is fought on; the map draws it on screen ([`battlefield.md`](../system-design/battlefield.md)).
- **group** — units a mission trigger brings onto the battlefield together, at a chosen tick, with a name and an intention;
  never a wave.
- **map** — the ground and its slots: where each Nexus stands and where its troops hold. The built-in maps are the
  Crossing and the Pocket, each with a note on what it is good and bad for testing
  ([`battles.md`](../system-design/battles.md)); a map file is the same as JSON (`BattleMap`).
- **mission** — a battle with a script, words and a goal, played in rounds driven by triggers; only inside Story. Won
  by its **main goal**, with a harder **bonus goal** that grants a technology ([`story.md`](story.md)).
- **mode** — what decides which battles are played, in what order, against whom, and what carries between them:
  **Skirmish**, **Story**, **Versus** ([`game-modes.md`](game-modes.md)).
- **Nexus power** — a named effect with one plain line of description, dealt in a **hand** at each Nexus Pulse from
  its **Nexus power pool** (never "pool" alone); the player may **keep** one, listed as **ACTIVE**. **draft** is
  choosing from the hand ([`commander-armies.md`](commander-armies.md)).
- **Nexus Pulse** — the moment each round opens, when the Nexus deals its Commander a hand of Nexus powers.
- **PERIMETER**, **RIGHT OF SALVAGE** — Vasse's first mission, the tutorial, and her first technology mission.
- **rally point** — where a side's troops head and hold for a Battle Round: a tile, or a named place (`HOME_NEXUS`,
  `ENEMY_NEXUS`; later a map's hotspots); in a plan, `rally`. Placed in the Build Phase as Start Battle Round opens, by
  default in front of the base (the Rally point start Experiment). The banner is only its flag
  ([`movement.md`](../system-design/movement.md), [`ui-patterns.md`](../system-design/ui-patterns.md)).
- **prelude** — the moment between Enter and a Battle Round's first tick: both sides' rally arrows, and the enemy's new
  buildings and units revealed one by one; the round's timer starts after it ([`ui-patterns.md`](../system-design/ui-patterns.md)).
- **raid** — a group a mission's opponent sends, with its **intention**: one line saying what it means to do, shown in
  the panel ([`scripted-opponent.md`](scripted-opponent.md)).
- **marching** — troops walking toward their rally point, keeping the formation's order and facing the enemy; an army
  group has **arrived** when its centre is near the rally point and it is not engaged, and then forms up there.
- **engaging** (in combat) — a unit with an enemy in its vision leaves the march and fights; where the sides fight is an
  **engagement**. **Re-targeting** is a unit choosing a new enemy to attack: its target fell, or a better one came within
  reach.
- **regroup** — what happens when a Battle Round ends: survivors step back and form up on their rally point (or back to it), facing the enemy, so the
  next round starts from **the kept front** ([`movement.md`](../system-design/movement.md)).
- **result** — how a battle ends: `BATTLE WON`, `BATTLE LOST`, `BATTLE DRAWN` (`<COMMANDER> WINS` when two scripts
  play); a Battle Round's own end reads `VICTORY`, `DEFEAT`, `DRAW` or `TIME'S UP`.
- **rock**, **scrub**, **burning ground** — ground nothing walks through (air flies over it); ground that weighs two
  steps; a patch a shell set alight, weighing four, which is state, not an effect ([`battlefield.md`](../system-design/battlefield.md)).
- **roof** — the tiles of a producer: its wave comes out on the roof and walks off it toward the fight; **room** is the
  ground it keeps free round it.
- **round** — one Nexus Pulse, one Build Phase and one Battle Round, in that order: "round 2 of 3". The Build Phase
  code counts it as `pulseNumber`, a mission's triggers as `pulse`. The most a battle lasts is its **round limit**.
- **score** — who leads, and on what, if the battle ended now: Nexus health by share, then the damage dealt over the
  battle; a battle reading (`scoreOf`).
- **Skirmish** — one battle against a scripted Commander Army, set up by the player: the centre of the game and of its
  testing ([`game-modes.md`](game-modes.md)).
- **stance** — retired with the rally point: what was `hold` is a rally point on `HOME_NEXUS`, `attack` on `ENEMY_NEXUS`.
- **starter map** — the Build Phase's one disposable map and the few buildings it offers; not a mission.
- **Story** — a Commander's story: missions in order, with **technologies** carried from one to the next, ending in a
  final battle; its parts are the tutorial, technology missions, the **endless stand** and the final battle
  ([`story.md`](story.md)). A story in progress is a **save slot**.
- **supply** — the cap on how many units a side may field; supply buildings raise it.
- **target** — the area the battle engine sends a side's fighting units to (in a battle, its rally point's area): they engage what comes within reach on the way, and stand there
  ([`pulse.md`](../system-design/pulse.md)).
- **tech tree**, **blueprint**, **Special**, **research**, **upgrade** — what grows an army between rounds and
  missions ([`commander-armies.md`](commander-armies.md)): a blueprint is what a player may build, a building what they
  did build; only the tech tree **unlocks**, a Nexus power **adds** ("Adds building: Aid Station.").
- **tile** — one place on the battlefield, drawn one column wide ([`presentation.md`](../system-design/presentation.md)).
- **troop movement** — the owner's word for pathfinding: where an army goes, how it forms up and how it fights its way
  there; its words are in [`movement.md`](../system-design/movement.md).
- **vision** — how far a unit sees an enemy to turn to it: 6 columns, 3 rows, unless content says.
- **wave** — the units one producer makes at once in a Battle Round, set down together on its roof; never a round's
  battle and never a mission's group.
- **worker** — a unit that gathers rather than fights; today it only runs.

### On the screen

[`ui-patterns.md`](../system-design/ui-patterns.md) holds every rule here.

- **build menu** — the menu's buildings, each with its cost: what can be placed this round; never "construct menu".
- **card** (on screen) — the side panel's description of what has the map's attention: what is under the cursor, or
  the building being placed.
- **Controls page** — every key and click by where the player is (`[c]` or `?`).
- **focus**, **highlight bar** — where the keyboard is (the menu or the map cursor, never both), and the one "you are
  here" on the menu.
- **game menu** — Esc on the Build Phase: Settings, Controls and hotkeys, Activity logs, Save game, Restart, Quit.
- **menu** — the Build Phase's side panel: one list of rows, with **the credits line** above the buildings.
- **placing**, **Explore Map**, **plain navigation** — the map's three modes: a building armed with its **ghost** at
  the cursor; the panel describing what is under the cursor (`[e]`); the bare cursor.
- **popup** — one overlay shape: a title and rows, closed by Esc or a click outside; a **message** has nothing to
  choose.
- **resize gate** — the TERMINAL TOO SMALL screen shown below the minimum size instead of a cropped battlefield.
- **row**, **hotkey** — one line of a list, and its key shown as `[x]`; a hotkey that is not shown does not exist.
- **Skirmish screen**, **setup screen** — the title menu's `[1] Skirmish` (`New game`, `Load game`), and the screen that
  picks the map and each slot's Commander and controller.
- **title menu** — the first screen: Skirmish, Story, Settings, About, Exit.
- **top bar**, **side panel**, **map**, **bottom line** — the screen's four regions.

## The world

Who these people are is in [`lore.md`](lore.md); what playing them is like, in [`commander-armies.md`](commander-armies.md).

- **the Activation**, **the Return** — the awakening of the Prime Nexuses, and the arrival people dreamed of before it.
- **Ancients**, **Ancient Original**, **golem**, **artifact** — the network's makers, the rare beings that come through
  it, its maintenance bodies, and the objects that woke with it. Deliberately unexplained.
- **bark**, **pre-battle exchange**, **briefing**, **debrief** — 3–8 words from an ordinary unit; three lines between
  two Commanders; a mission's words before and after, played as a **cutscene** ([`lore.md`](lore.md)).
- **Citizen**, **Ravel**, **Glitch**, **Feudal**, **Alder** — the five factions (Citizens, Ravels; Glitch and Alder
  have no plural). Glitch call their Nexus the **Silent Queen Nexus**; a Feudal **Duo** is one office in two bodies,
  over **Clerics** and **Submitters**.
- **claimant** — a civilization that holds a Prime Nexus.
- **the Eternals** — what awakens in a story's final battle ([`story.md`](story.md)).
- **Nexus Symbol**, **Symbol** — the culture's word for a Commander: a person a Nexus chose and restores after death.
- **Operator** — how the interface addresses the player; each faction reads the title differently.
- **Nexus**, **Prime Nexus** — the pyramid each side defends on the battlefield, which must not fall, and, in the
  lore, the one at home that sends it. A Nexus is named for its faction (the Citizen Nexus), never a proper name.
- **restored** — what the Nexus Pulse does to a fallen Commander, the next round for most.
- **Terminal Nexus** — the unknown end the replicas' wars may be choosing; also the game's name.

## Making and testing

- **Activity Logs** — the screen's record of what happened, by declared **event** and **filter** (`src/log/`),
  exported as text. A log is a record, never an input.
- **agent profile** — a language model's playing style, a Markdown file in `players/agents/`. Later.
- **army file** — `armies/<id>/army.json`, an army as data, stacked: `armies/all`, the faction armies, one army per
  Commander ([`army-authoring.md`](../system-design/army-authoring.md)).
- **ASCII screenshot** — the battlefield as the game's screen draws it, written out as text (`skirmish --show`), with an
  **overlaps** list under it naming what stands beneath each cell (a unit on a roof); the brief's map is drawn the same
  way. Never a screenshot ([`battles.md`](../system-design/battles.md)).
- **ask** — a Skirmish asked for in words (`map`, `seed`, `p1` …), read alike from the `skirmish` command's flags, the
  game's flags and a route; also something waiting on Mario: **play**, **watch**, **decide** or **do**, at most five
  ([`next-steps.md`](../milestones/next-steps.md)).
- **backlog**, **carry-over**, **cleanup queue** — work no milestone owns yet; small items that rode along; refactors
  waiting their turn.
- **the bench**, **bench roster** — `sandboxes/engage/`, twelve units a side on open ground and through a gap; and the
  Citizen, Ravel and Proving Grounds units the sandboxes and tests use.
- **brief** — what a player reads before a round: the battlefield, the hand, the credits, what each building costs and does,
  the score and the last round's battle reading. A person, a script and a model read the same one
  ([`battles.md`](../system-design/battles.md)).
- **build file** — build actions as JSON, for one round or many (`"round": 3`, `"2-4"`, `"*"`).
- **controller** — who plays a slot each round: `player`, `script:<profile>`, later `agent:<profile>`; the setup screen
  shows `Player: <name>`, `Scripted: <profile>` ([`skirmish-saves.md`](../system-design/skirmish-saves.md)).
- **display options** — `--colors`, `--theme`, `--glyphs` (the **glyph pack**) and `--reduced-motion`
  ([`DEVELOPMENT.md`](../../DEVELOPMENT.md)); **reduced motion** snaps every movement.
- **Experiment** — a design choice put behind a switch in Settings, so Mario can feel both answers and send back the
  settings export; it names the question it serves, and once settled it becomes a tuned value.
- **feedback round** — one batch of Mario's feedback, logged item by item and worked through; never a battle's round.
- **levelled log**, **report** — a Battle Round's events as fixed-column lines at a log level (`--log-level`), closed by
  a **report** line with the outcome, losses and hashes; the `skirmish` command prints them (`src/report/`).
- **lesson** — something learned the hard way, dated in `docs/history/lessons-learned.md`.
- **measurement** — battles played the same way before and after a change, so the numbers compare: sandboxes, duels
  (scripted battles over seeds) and missions (`bin/measure.ts`, [`measurement.md`](../system-design/measurement.md)).
- **milestone**, **step** — one question about the game, small enough to play and judge (`PLANNED`, `CURRENT`,
  `COMPLETE`); and one pull request's worth of it, the **current step** the one in scope
  ([`milestones/`](../milestones/README.md)).
- **mirror** — a battle of one Commander against herself, or a sandbox drawn the same from both ends.
- **modifier** — a named rule laid over a battle from the next round: `fast-rounds`, `double-income`.
- **open question** — a decision only Mario can make, in [the register](../milestones/open-questions.md) with a
  recommendation.
- **opponent** — what plans the other side: a script profile driving a Commander Army.
- **playtest** — playing a change: Mario at the screen, or an agent pressing keys through the scripted playtest
  (`scripts/playtest.mjs`); **the playtest page** is the browser build published as a private page.
- **playtest note** — a moment saved with `!` on any screen; `--note <file>` opens it there.
- **route** — a place in the game written like a web address without its site (`skirmish?map=pocket`); `--at`, the
  title menu and the browser page read it ([`routing.md`](../system-design/routing.md)).
- **RULE**, **GUIDANCE**, **IDEA** — a statement built and held by a test, the default, a sketch
  ([`architecture.md`](../system-design/architecture.md)).
- **sandbox** — a save whose `start` sets the battlefield up by hand: one Battle Round of the battle engine from that battlefield, to
  test one rule, effect, movement or ability, like a unit test's context. It measures what happens on the battlefield
  (damage, deaths, paths, timings), not who wins; the whole game is the `skirmish` command's. In `sandboxes/`, or a
  session's scratchpad ([`skirmish-saves.md`](../system-design/skirmish-saves.md), a battlefield set up by hand).
- **save file** — a setup and the battle as it stands at the opening of a Build Phase (`*.save.json`); every way into
  a Skirmish opens one ([`skirmish-saves.md`](../system-design/skirmish-saves.md)).
- **screenshot** — an image (PNG) of the screen, made by the scripted playtest and the capture scripts. Never an ASCII
  screenshot, which is the `skirmish` command's `--show`.
- **script** — a coded player (`src/battle/players.ts`): `balanced`, `rush`, `turtle` and their variants, and
  `reactive`, which plans from the battle reading; a **script profile** is one with its options, in
  `players/scripts/`. None is a good player.
- **Settings** — one list from the game menu's `[s]`; every setting is declared once in `src/build/all-settings.ts`
  as **player**, **experiment** or **tuned** ([`ui-patterns.md`](../system-design/ui-patterns.md)).
- **settings export** — every setting and Experiment as `name = value` text, with the build's commit; `--settings`
  reads it back.
- **setup** — everything chosen before round 1: map, seed, slots, goal, modifiers, round limit and ticks.
- **shelf** — where a document sits: current, planning or history ([`docs/README.md`](../README.md)).
- **the `skirmish` command** — `bin/skirmish.ts`, a Skirmish played headless; its manual is the comment
  `src/cli/skirmish.ts` opens with.
- **slot** — one side of a Skirmish, `p1` (west) or `p2` (east): its Commander and its controller. The battle's code
  calls them side A and side B.
- **spectating** — a battle with no player slot: two scripts, watched.
- **spike** — a small, throwaway build that answers one question reading cannot ([`DEVELOPMENT.md`](../../DEVELOPMENT.md)).
- **story file** — `stories/<id>/story.json`, a Commander's missions as data; a mission's entry is a **level**.
- **trigger** — a condition and the actions a mission takes when it holds, in the **simulation** band or the
  **presentation** band ([`story.md`](story.md)).
- **tuned value** — a number set by feel and kept in one place (`src/build/tuning.ts`); never copied into prose.
- **unit test**, **verifier** — a check kept in `tests/`, run on every build and pull request, fast, holding one rule at
  the layer that owns it; and the check a session runs to show its own task works (the `skirmish` or `measure` command,
  the scripted playtest, a probe or a throwaway test), kept only if it becomes a unit test
  ([`testing.md`](../system-design/testing.md)).

## The engine and the code

- **battle engine** — the deterministic core (`src/engine/`): given a state on a map, content and a seed, it plays a
  Battle Round tick by tick and records its events; no rounds, credits, players or screens, no clock or `Math.random`.
  Every Battle Round runs on it, the game's, the `skirmish` command's, the measurement's and a test's
  ([`architecture.md`](../system-design/architecture.md), the layers).
- **content id** — a thing's name in content: `unit.citizen.trooper`, `structure.citizen.nexus`, `fx.light.flash`.
- **the corruption law** — an effect may recolour something but never replace its glyph; a **glyphless** write keeps
  the glyph under it and changes only its colour.
- **distance field** — the walking cost from every tile to a goal, shared by every unit going there; the code calls the
  parts that build it routes (`src/engine/routing/`, [`movement.md`](../system-design/movement.md)).
- **effect** — a pure function from presentation time to cells, made by a **recipe** and painted in a **band**; it
  never touches state. Its **four families** are animations, particles, shading and tweens, and each owes **three
  forms**: full, reduced motion and monochrome ([`effects.md`](../system-design/effects.md)).
- **event** — what the battle engine emits as a tick resolves (`entity.died`); an Activity Logs event is a different,
  declared thing.
- **footprint** — the tiles a body covers; with its **anchor** and **facing**, where it stands
  ([`battlefield.md`](../system-design/battlefield.md)).
- **gameplay stream**, **cosmetic seed** — the seeded PCG32 randomness the rules draw from, and the hash effects draw
  theirs from; they never touch.
- **logical time**, **presentation time** — ticks, as the battle engine counts them; and the clock the screen and effects read.
- **match** — the battle engine's word for a battle (`MatchState`); the **rules between rounds** (`src/match/`) build each
  Battle Round's opening from the battle so far: the regroup, banners, Commanders returning, training.
- **movement state** — **march**, **battle** or **retreat**, the one a unit is always in (`MoveState`)
  ([`movement.md`](../system-design/movement.md)).
- **named command** — an action with a name, which keyboard, mouse and a script all send
  ([`input.md`](../system-design/input.md)).
- **opening** — the state a Battle Round starts from; a sandbox's `start` draws one by hand
  (`src/skirmish/opening/`).
- **the Pulse** — the battle engine's tick loop, which plays a Battle Round (`src/engine/pulse/`,
  [`pulse.md`](../system-design/pulse.md)); not the Nexus Pulse.
- **style role** — what a cell carries instead of a colour (`src/view/roles.ts`); a **reserved colour** means one thing
  (red, the player's own Nexus hurt).
- **the three worlds** — state, the Pulse and presentation ([`architecture.md`](../system-design/architecture.md)).
- **tick** — one step of a Battle Round's simulation; a Battle Round lasts 360 of them, thirty in-game seconds, unless a
  setup says otherwise.
- **in-game second** — 12 ticks: how long anything inside the simulation lasts is said in ticks or in-game seconds,
  never in milliseconds.
- **frame** — one drawing of the screen; how many a second the screen draws has nothing to do with the simulation.
- **real time** — time on the clock, in milliseconds, for what is outside the simulation only: playback speed, effects,
  key timing, the Build Phase's animations.

## Words that do two jobs

Say which job, every time.

| Word | One job | The other |
| --- | --- | --- |
| battle | a whole fight, rounds until a result | a unit's movement state, fighting what it sees |
| goal | what wins a battle (elimination) | where a unit's walk ends (`goalsNear`) |
| target | where a side's troops head (`target` in a trigger) | the enemy one unit is fighting |
| route | a place in the game (`skirmish?seed=1`, `src/cli/route.ts`) | a unit's walk round rock and buildings (`src/engine/routing/`, the `route-*` sandboxes) |
| hold | the ground a slot's troops stand on in a map | the `hold` stance; *Hold production* |
| draft | choosing a power from a hand | the save's field for build actions handed in so far |
| card | a building or power an army offers | the side panel's description of what has the map's attention |
| map | the ground (the Crossing, a map file) | the screen's region that draws the battlefield |
| band | where an effect paints (`effects`, `highlights`) | a trigger's action kind: simulation or presentation |
| bench | the bench roster (units for tests) | the engage sandboxes (`sandboxes/engage/`) |
| ask | a Skirmish asked for in words | something waiting on Mario |
| slot | a side of a Skirmish (`p1`, `p2`) | a Story save slot |
| round | a Nexus Pulse, a Build Phase and a Battle Round | a feedback round |
| step | a milestone step | a unit's step on the battlefield |
| level | a mission's entry in a story file | a log level (`--log-level`) |
| formation | the order troops march in | how build actions set the buildings that make units |
| skill | a Commander's own ability | an agent skill in `.claude/skills/` |
| pulse | the Nexus Pulse (a player's word) | the Pulse (the engine's); `pulse` in triggers counts rounds; the Popup pulse Experiment is a breath of light |

## Words we stopped using

The validator rejects the ones it can match (`scripts/check-repository.sh`, retired terminology); `docs/history/` keeps
the words it was written with. A line that quotes one on purpose ends with `<!-- stale-ok -->`.

| Old word | Say instead | Why |
| --- | --- | --- |
| duel, `src/duel/`, `duels.md`, the `duel` command | battle, `src/battle/`, `battles.md`, the `skirmish` command | One word for the battle a Skirmish plays. The measurement keeps *duels* as the name of its part that plays scripted battles over seeds (`measure run --parts duels`) | <!-- stale-ok -->
| `reader` (the script) | `reactive` | It reacts to the battle reading; *reader* sounded like the reading itself |
| front (as a battle reading) | advance | How far each army moved toward the enemy Nexus; the kept front is the regroup's ground |
| turn, `--turn` | round (a player's), tick (the engine's), `--from-tick` | Both slots answer at once; there are no turns | <!-- stale-ok -->
| plan (as the name of a round's answer in a format, a command or a design page) | build actions | The owner's word for what a slot hands in; the code and a few screen lines still say `plan` |
| `--battle`, `--battles`, `--play-until-win`, `--wait`, `--ready` | `--play-to next`, a round, `end` | Either slot hands its build actions in alone, in any order |
| testing save, `skirmish-testing/` | sandbox, `sandboxes/` | It is a scene set by hand, not a saved game | <!-- stale-ok -->
| Nexus draft | Nexus Pulse | The moment is the Pulse; *draft* is choosing from the hand |
| Pulse, Battle step (for a round's battle on screen) | Battle Round | The player's word; the Pulse is the engine's |
| wave (for a round's battle) | Battle Round | A wave is what one building makes |
| Recall | regroup | Survivors form up at the front; nobody walks home |
| campaign, run, Challenge, Challenge runs | Story, Skirmish | One Commander's missions in order; a battle is too long for a run of many |
| unlock (for what a Nexus power does) | adds | *Unlock* is the tech tree's word alone |
| construct menu | build menu | One name for the list of buildings |
| Nexus Proxy | Nexus | One name for the replica on the battlefield |
| Veil, planning phase | Build Phase | The original specification's words | <!-- stale-ok -->
| Grid, Grid Nexus, Grid pane | battlefield (or map), Nexus, the map | Plain strategy-game words; the ground needs no name of its own | <!-- stale-ok -->
| board (what a sandbox sets up) | battlefield | One word for the ground, whoever set it up |
| canon | the design documents | The design is the current shelf, edited in place | <!-- stale-ok -->
| gate, gate report, `GATED` | milestone step, the pull request, `PLANNED` | Milestones and steps replaced gates | <!-- stale-ok -->
| `specs/`, `evidence/` | `docs/game-design/`, `docs/system-design/`; screenshots on the pull request | The folders were dissolved | <!-- stale-ok -->
| `grid` (the command), `bin/grid.ts`, the engine tool, `grid-engine.md` | the `skirmish` command, `architecture.md` | A sandbox is a save the `skirmish` command plays and draws; one command for one game | <!-- stale-ok -->
| engine, `src/engine/pulse/`, `src/engine/state/`, `src/engine/geometry/` | battle engine, `src/engine/` | Named for what it does: plays a Battle Round from a state | <!-- stale-ok -->
| trial, trial file, variant | `skirmish --seeds`, or a copy of the sandbox changed for the question | One way to play a battlefield, not a second tool | <!-- stale-ok -->
| `sandboxes.md` | `skirmish-saves.md` (a battlefield set up by hand), `testing.md` | A sandbox is a save; testing is one page | <!-- stale-ok -->
| `--capability`, `CapabilityMode` | `--colors`, `ColorDepth` | One name for the colour depth everywhere |
| `--tile-width` | nothing | A tile is one column at every size |
