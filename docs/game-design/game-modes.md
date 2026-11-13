# Terminal Nexus — game modes

_The three modes — Skirmish, Story and Versus — over one battle: the words they share, what each is for, every way a
Skirmish can be set up (what the first build needs and what waits), and how each mode is tested. Story's own design is
[`story.md`](story.md)._

_Licence: structure and schemas Apache-2.0; names and fiction CC BY-SA 4.0._

## 1. The words

**The names** (RULE — settled 2026-11-11, and the code's since the Skirmish milestone's title menu step): every
document, screen and new piece of code uses these. The routes are `skirmish` and `story`, the story files are in
`stories/`; `campaign` and `challenge` routes are refused with what replaced them.

| Word | Means |
| --- | --- |
| **Battle** | One Grid, two sides, rounds until a result: the unit of play. The engine's word is *match*; nothing above a battle is visible to the kernel |
| **Round** | A Nexus Pulse, a Build Phase and the Battle Round that follows ([`concept.md`](concept.md)) |
| **Mode** | What decides which battles are played, in what order, against whom, and what carries between them |
| **Skirmish** | One battle against a scripted Commander Army, set up by the player. The centre of the game and of its testing |
| **Story** | A Commander's story: missions in order, with technologies carried from one to the next, ending in a final battle |
| **Versus** | One battle between two people. Later |
| **Mission** | A battle with a script, words and a goal. **A mission exists only inside Story** |
| **Endless stand** | A kind of mission: waves that grow until the Nexus falls, scored by how far the player got. It comes before a story's final battle |
| **Slot** | One side of a battle, fixed by the map: its Commander and its **controller**, who plans it (`Player: marioiz`, `Scripted: agro`, later `Agent: curious`) |
| **Save file** | A Skirmish's setup and, once played, the battle as it stands at the opening of a Build Phase: what the setup screen, Load game, the command line and every test start from ([`skirmish-saves.md`](../system-design/skirmish-saves.md)) |
| **Opponent** | What plans the other side of a Skirmish: a script profile (`balanced`, `rush`, `turtle` and their variants, in `players/scripts/`) driving a Commander Army |
| **Technology** | A card a mission in Story grants and later missions keep: a building, an upgrade, a Nexus power. The story file stores it in a level's `unlocks` |
| **Level** | The code's word for a mission's entry in its story file (`story?mission=<id>`); say *mission* in writing |

**Retired names**: *Campaign* is now Story; *Challenge* and its *run* of many battles are retired (section 6). The
word *run* is free again; do not use it for a mode.

## 2. Why these three, and why Skirmish first

A battle is long: about 1½ to 2½ minutes a round and six or seven rounds, so ten to twenty minutes, more for a player
who takes their time ([single battles](../history/reports/2026-11-11-single-battles.md)). A mode that strings many
battles together, as a roguelike run does, becomes an evening; the games that do that well have battles of seconds.
So the game is built around **the single battle**, the way StarCraft and Age of Empires are: Skirmish to play one,
Story to learn and to live a Commander's story, Versus to play another person.

**Skirmish comes first** (RULE — settled 2026-11-11; the milestone order holds it). It is the playable loop, the testing tool (any setup becomes a battle anyone can play,
show and measure), and the base Versus builds on. Every rule, unit and screen is judged in a Skirmish before it is
taught in a mission. A Story mission is a Skirmish setup with a script and words around it.

**On equal ground** (the owner, 2026-11-12, [his words](../history/feedback/2026-11-12-the-new-focus.md): "the main idea
of fighting an enemy on equal ground before we start adding other challenges like scripted missions"). By default both
sides of a Skirmish play the same rules on the same power curve, with the same credits; the opponent differs only in
how it plans. A handicap (the opponent's credits) is a setting the player chooses, never a default.

**How the game grows** (the owner, 2026-11-11, [his words](../history/feedback/2026-11-11-game-modes.md)). Through
Skirmish, not through missions: polish the interface and the gameplay; add units and keep improving how units, formations
and balance are tested automatically; give each Commander more Nexus powers; make the opponent better, up to Claude
planning the other side as the player plans theirs. When the gameplay has a good foundation, Skirmish is shown to people
(the owner's friends first), and their play says what Story should be. The order, reviewed on 2026-11-12: Skirmish set
up and saved; units that counter each other; a narrow worker economy; a Skirmish worth showing, ending with friends;
then agent players, further content and Nexus powers, and a deeper planner if friends ask for one
([the milestones](../milestones/README.md)). **Story is built after that**, one Commander's
story at a time. PERIMETER is no longer where changes are tested.

**Fun before polish** (the owner, 2026-11-12). Friends play when the owner says the basic game is fun — at the earliest
when "A Skirmish worth showing" (Milestone 20) ends: comfortable to play, the banner a real decision, what the enemy did readable, a battle
that stays open past its second round, and a few ways to set it up. New effects, art and terminology wait behind that.

**A mode is data over one battle** (RULE — `tests/architecture.test.ts`: a mode's code never reaches the view or the shell). A mode chooses battles and what carries between them; nothing below the mode
— the kernel, the Battle Round, the Build Phase screen, the renderer — knows which mode it is serving.

## 3. Skirmish

### 3.1 What it is

The player picks a map, then a Commander and a controller for each of its slots, a goal and a few modifiers, and plays
one battle of up to eight rounds. **A Skirmish battle is a duel** ([`duels.md`](../system-design/duels.md)): the player
plans side A on the Build Phase screen, the opponent's script plans side B under the same rules, the two plans are
revealed together, and the Battle Round plays them. It ends when a Nexus falls, or after the last round on the larger
share of Nexus health kept.

**Reading the opponent.** The two plans stay hidden while both sides build. As the Battle Round starts, what the enemy did
that Build Phase (its new buildings and upgrades, its Nexus power, its banner) is marked and said in a line; after the
battle its base stands as it is, its new things marked, to be read before the next plan (Milestone 20's step of
that name). Guessing what the enemy chose, and answering it a round later, is the bet each round asks for.

What exists already: the duel and its scripts, three Commanders (Vasse, Averno, Dob Hunter), two maps (the Crossing
and the Pocket), the setup screen (Skirmish on the title menu: New game, Load game), Save game, spectating two scripts,
playtest notes, and the `skirmish` command, which plays the same battle without a screen. What it lacks is an opponent
good enough to play.

### 3.2 What a Skirmish is set up with

Two kinds of setting: **required**, which the Skirmish milestone builds; and **later**, ideas that are each
worth building once a Skirmish is fun without them. Every required setting has a default, so a Skirmish starts with
one key. How each is written in a save file and on the command line is [`skirmish-saves.md`](../system-design/skirmish-saves.md);
the setup screen asks them in this order.

**Required:**

| Setting | Set on the screen | Set in a save file | Default |
| --- | --- | --- | --- |
| The map (it fixes the slots) | yes | yes, by name | the Crossing |
| Each slot's Commander | yes | yes | Vasse (A), Dob Hunter (B) |
| Each slot's controller: `Player`, `Scripted` with a profile, later `Agent` | yes | yes | Player (A), `Scripted: steady` (B; the `balanced` script) |
| A script profile's options, among them its credits as a share of the curve's | yes | yes | 100% |
| The goal | yes | yes | Elimination |
| Modifiers | yes | yes | none |
| The seed | shown, editable | yes | from the clock |
| Rounds at most, Battle Round length | no | yes | 8, 360 ticks (30 seconds) |
| Each side's starting credits, roster, and units and buildings already on the Grid | no | yes (`start`) | the curve's round 1, the whole army, the starting package |
| Settings and Experiments | no | yes, as `--settings` text | the saved settings |

**There is no difficulty setting** (the owner, 2026-11-11): the opponent's script and its credits are what make a
Skirmish harder or easier, and the setup says them plainly. The scripts differ in plan, not in skill; a script that
answers the player is Milestone 20's, a deeper planner Milestone 19's.

**Goals and modifiers** (the owner, 2026-11-12): **Elimination** (destroy the enemy Nexus, or have the healthier one
after the last round) is the goal built first. Modifiers are named rules over a battle; two are built first,
`fast-rounds` and `double-income`, and the list is a place to experiment: the ones that make a battle better stay, the
others are removed.

**Later (IDEA):**

- **More goals**: Economy, Creative, each with its own win.
- **More modifiers** (no Turrets, a Build Phase clock), the way StarCraft II's co-op mutators keep the same mission fresh.
- **A pre-battle pick**: choosing a few cards of the army before the battle, as Battle Aces chose eight units.
- **More than two slots**, or an ally: needs more than two sides in the duel and maps that hold them.
- **More maps**, a random map from a seed, and the player's own start position.
- **Agent players**: a language model planning a slot each round, blind and at the same time as the player, under the
  same rules, in a style its profile describes (Milestone 21). The game never needs a model to be played.
- **An endless stand outside a story**, for a high score and theme unlocks: Story's endless mission offered alone.
  Decided once Story's endless stand has been played.
- **Sharing a save**, and a daily seed. A save file checked in is already a preset: "a cautious Dob with a third more
  credits" is a file.

### 3.3 Save files

A Skirmish is saved and loaded at the opening of a Build Phase, from the game menu and from the command line
([`skirmish-saves.md`](../system-design/skirmish-saves.md) is the format). A save file is a battle anyone can pick up:
a person carries on from it, an agent plays it on headless with any slot given to a script, and every demo of a rule, a
Commander or a starting position is one, the engine's rule maps included (the sandboxes, `sandboxes/`, each
opening on a Battle Round written by hand). A save checked in is already a preset.

### 3.4 One battle, on screen or not

**A Skirmish is deterministic** (RULE for the duel it plays, `tests/duel.test.ts`: "a duel resolves the same every run"):
the same save, seed and plans give the same battle, hash for hash, on Node and Bun, whether a person plays it on the
screen or the `skirmish` command plays it headless. That is what makes it the place every change is tried: headless
script against script, an agent planning round by round, the playtest pressing keys, an agent's player's diary
(Milestone 20), then a person, with `!` saving the moment as a note that opens again where it was. How a test does
each is [`sandboxes.md`](../system-design/sandboxes.md), testing through Skirmishes.

A Skirmish is the default place to see a change: the browser page and the playtest script open on a save, and the
Build Phase pictures of a battle start from one. PERIMETER is opened only for a change about missions.

## 4. Story

A Commander's story, the same shape for every Commander: a tutorial, three or four technology missions whose
collections carry forward, an endless stand scored until the Nexus falls, and a final battle ([`story.md`](story.md)
is the design).

**A mission exists only inside Story** (RULE — settled 2026-11-11, held in code since the Skirmish milestone's rename).
Any mission still opens directly for testing, by its route (`story?mission=<id>`), without playing the story before it.

Story comes after Skirmish has been played by people, because every mission is a Skirmish setup plus a script and words:
a mission built before the battle is fun would be built twice.

## 5. Versus — IDEA

Two people, one battle: hidden simultaneous plans and deterministic resolution already fit play over a network and play
by turns. Versus builds on Skirmish: the settings found to make the most enjoyable Skirmish are where a fair Versus
battle starts. The cheapest version already half exists: each slot's build actions for a round may be handed in to one
save file alone, in any order, and the round plays both, so a battle by correspondence is close. Nothing is designed, and multiplayer stays out
of scope until a milestone asks for it.

## 6. What was retired

**Challenge runs**, a seeded series of battles with a draft between them, were retired on 2026-11-11 ([the owner's
words](../history/feedback/2026-11-11-game-modes.md)): a battle is too long for a run of many. Their design is
[kept in history](../history/challenge-runs-design.md). What survives:

- **The draft** — three cards weighted by rarity, gated by tier, with a pity offset — is the starting point for Story's
  technology choice between missions.
- **Building actions** (upgrades, modes, orders), **the kept front** and **the battle banner** are battle mechanics and
  belong to every mode.
- **The battle on the Build Phase screen** and its result: the Skirmish plays them (`src/cli/skirmish-play.ts`). The
  run's own code (`src/run/`, its draft popup, its summary, the army files' `run` field, `challenge?seed=<n>`,
  `duel run`) was removed with the Skirmish milestone's title menu step.

## 7. Content every mode can deal

**RULE: every card carries `rarity`, `tier` and `role` from the day it is authored**, so that every way of dealing it
can read it (`RARITIES` and `ROLES`, `src/armies/types.ts`; `tests/armies.test.ts`). Two things deal cards: **the
Nexus Pulse**, inside a battle, every round, from the army's power pool by a schedule that ramps rarity by round
([`commander-armies.md`](commander-armies.md)); and **Story's technology choice**, between missions. Rarity says how
rare a card is (`common`, `uncommon`, `rare`, `legendary`); tier, the earliest point it may be offered (`1`, `2`, `3`).
They are two axes on purpose: a tier-1 rare is a strong early card seldom offered; a tier-3 common an ordinary late one.

Three rules of thumb (GUIDANCE):

1. **Commons must be enough to win with.** A battle dealt only commons is winnable against the default opponent; if a rare is
   required, the balance is wrong, not the rarity (Rosewater's rarity doctrine).
2. **Complexity lives at uncommon and rare.** A common does one readable thing.
3. **The dealer reads the role.** Three offers of the same role is a dead hand; the dealer prefers variety across roles
   before it weighs rarity.

**"The army is a deck" is parked, not decided** ([`commander-armies.md`](commander-armies.md) has the retraction):
*card*, *rarity*, *tier* and *draft* are working words for an offer, weighted and gated, that a player accepts or
declines. Nexus powers are almost always strictly good, so a deckbuilder's "adding things can make my draws worse"
does not hold for them.

Balance is **measured, then judged**: duels and Skirmish battles played by scripts and the driver, then by people
([`measurement.md`](../system-design/measurement.md)). Metrics diagnose; they do not define fun.

## 8. References

| Source | Cited for |
| --- | --- |
| **StarCraft, Age of Empires** | the single battle against the computer as a mode of its own (Age of Empires' *Skirmish*; StarCraft's *Versus* for people) |
| **Mechabellum** ([store](https://store.steampowered.com/app/669330/Mechabellum/)) | a build-then-watch battle of many rounds, technology bought between them, both sides' choices revealed together |
| **Castle Fight** ([map](https://maps.w3reforged.com/featured-maps/castle-fight)) | the ancestor: buildings that spawn units that march on the enemy by themselves |
| **Battle Aces** ([wiki](https://en.wikipedia.org/wiki/Battle_Aces)) | a short RTS with a pre-battle pick of units; cancelled in 2025, a warning that a single-battle game lives on its opponent |
| **Frozen Synapse** ([wiki](https://giantbomb.com/wiki/Games/Frozen_Synapse)) | hidden simultaneous plans; previewing a plan against a guess at the enemy's; a one-turn mode against others' plans |
| **StarCraft II co-op** ([patch 3.3](https://www.pcgamesn.com/starcraft-ii-legacy-of-the-void/starcraft-2-patch-33)) | mutators and weekly mutations: the same battle kept fresh by new rules |
| **StarCraft II, Wings of Liberty** ([campaign](https://liquipedia.net/starcraft2/Campaign)) | a campaign that branches by technology, two exclusive choices at a time, inside one story (Story's model) |
| **Slay the Spire** — Giovannetti, *Metrics Driven Design and Balance*, GDC 2019 ([talk](https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics)) | the rarity pity offset; pick-rate and win-rate balancing; metrics diagnose |
| **Mark Rosewater** — *Nuts & Bolts #4: Higher Rarities* ([Wizards](https://magic.wizards.com/en/news/making-magic/nuts-bolts-higher-rarities-2012-02-27)) | the rarity doctrine of section 7 |

## 9. What this does not decide

- How an endless stand is scored (Q93), and which saves are worth offering as challenges.
- How long a battle should be (Q75), which the worker economy is the first step able to time.
- Versus, goals beyond Elimination, modifiers beyond the first two, and every other later idea of section 3.2: each is
  decided when a milestone asks for it.
