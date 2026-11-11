# Terminal Nexus — game modes

_The three modes — Skirmish, Story and Versus — over one battle: the words they share, what each is for, every way a
Skirmish can be set up (what the first build needs and what waits), and how each mode is tested. Story's own design is
[`story.md`](story.md)._

_Licence: structure and schemas Apache-2.0; names and fiction CC BY-SA 4.0._

## 1. The words

**The names** (RULE — settled 2026-11-11; the code catches up in the Skirmish milestone): every document, screen and new piece of code uses these. The code still says `campaign` and
`challenge` in places; the Skirmish milestone renames them ([`milestone-17-skirmish.md`](../milestones/milestone-17-skirmish.md)).

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
| **Battle file** | A file that sets up a Skirmish: everything the setup screen sets, and more |
| **Opponent** | What plans the other side of a Skirmish: a duel script (`balanced`, `rush`, `turtle` and their variants) driving a Commander Army |
| **Technology** | A card a mission in Story grants and later missions keep: a building, an upgrade, a Nexus power. The story file stores it in a level's `unlocks` |
| **Level** | The code's word for a mission's entry in its story file (`campaign?level=<id>`); say *mission* in writing |

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

**How the game grows** (the owner, 2026-11-11, [his words](../history/feedback/2026-11-11-game-modes.md)). Through
Skirmish, not through missions: polish the interface and the gameplay; add units and keep improving how units, formations
and balance are tested automatically; give each Commander more Nexus powers; make the opponent better, up to Claude
planning the other side as the player plans theirs. When the gameplay has a good foundation, Skirmish is shown to people
(the owner's friends first), and their play says what Story should be. **Story is built after that**, one Commander's
story at a time. PERIMETER is no longer where changes are tested.

**A mode is data over one battle** (RULE — `tests/architecture.test.ts`: a mode's code never reaches the view or the shell). A mode chooses battles and what carries between them; nothing below the mode
— the kernel, the Battle Round, the Build Phase screen, the renderer — knows which mode it is serving.

## 3. Skirmish

### 3.1 What it is

The player picks their Commander, the opponent's Commander and how it plays, a map and a few rules, and plays one
battle of up to eight rounds. **A Skirmish battle is a duel** ([`duels.md`](../system-design/duels.md)): the player
plans side A on the Build Phase screen, the opponent's script plans side B under the same rules, the two plans are
revealed together, and the Battle Round plays them. It ends when a Nexus falls, or after the last round on the larger
share of Nexus health kept.

What exists already: the duel and its scripts, three Commanders (Vasse, Averno, Dob Hunter), two duel maps (the Crossing
and the Pocket, `src/duel/maps.ts`), and a duel played on the Build Phase screen (today a Challenge battle). What it
lacks is a setup screen, a battle file, and an opponent good enough to play.

### 3.2 What a Skirmish is set up with

Two kinds of setting: **required**, which the Skirmish milestone builds; and **later**, ideas that are each
worth building once a Skirmish is fun without them. Every required setting has a default, so a Skirmish starts with
one key.

**Required:**

| Setting | Set on the screen | Set in a battle file | Default |
| --- | --- | --- | --- |
| Your Commander | yes | yes | Vasse |
| The opponent's Commander | yes | yes | Dob Hunter |
| The opponent's script | yes, as its play style | yes, by name | `balanced` |
| The map | yes | yes, by name | the Crossing |
| The seed | shown, editable | yes | from the clock |
| Rounds at most | no | yes | 8 |
| Battle Round length | no | yes, in ticks | 360 (30 seconds) |
| The opponent's credits: at the start and each round, as a share of the curve's | yes | yes | 100% |
| Each side's starting credits, exactly | no | yes | the curve's round 1 |
| Each side's roster (build menu and power pool) | no | yes | the Commander's whole army |
| Buildings and units already on the Grid, either side | no | yes | none beyond the Commander's starting package |
| Settings and Experiments | no | yes, as `--settings` text | the saved settings |

**There is no difficulty setting** (the owner, 2026-11-11): the opponent's script and its credits are what make a
Skirmish harder or easier, and the setup says them plainly. The scripts differ in plan, not in skill; a smarter
opponent is a milestone of its own.

**Later (IDEA):**

- **A Build Phase clock**, soft and optional, to bring a battle near fifteen minutes and add an RTS's pressure: an
  Experiment once Skirmish is played.
- **Modifiers**: named rules laid over a battle (faster rounds, double credits, no Turrets), the way StarCraft II's
  co-op mutators keep the same mission fresh. A battle file is where they would go.
- **A pre-battle pick**: choosing a few cards of the army before the battle, as Battle Aces chose eight units.
- **More than one opponent**, or an ally: needs more than two sides in the duel.
- **More maps**, a random map from a seed, and the player's own start position.
- **Presets**: named bundles of an opponent's script and credits ("a cautious Dob with a third more credits"), offered
  as challenges once playing shows which are worth offering.
- **A smarter opponent**: a planner that reads the public state and writes plans in the duel's own vocabulary
  ([`scripted-opponent.md`](scripted-opponent.md)).
- **Claude as the opponent**: a language model planning the other side each round, blind and at the same time as the
  player, under the same rules. The duel already takes a plan from a command or a file each round, which is how a model
  plays a side today ([`duels.md`](../system-design/duels.md), model against model). A milestone of its own; the game
  never needs a model to be played.
- **An endless stand outside a story**, for a high score and theme unlocks: Story's endless mission offered alone.
  Decided once Story's endless stand has been played.
- **Saving a battle and sharing its seed and file**, and a daily seed.

### 3.3 The battle file

A battle file is a JSON file (`--battle <file>`, planned) that sets up a Skirmish without the screen: anything the screen
sets, and the rest of the required list. It is the testing tool: any demo of a rule, a Commander or a starting position
becomes a battle a person can play and a duel can measure. Its shape, a first guess for the milestone to settle:

```json
{
  "map": "crossing",
  "seed": 7,
  "rounds": 8,
  "pulseTicks": 360,
  "opponentCredits": 1.0,
  "sides": {
    "A": { "commander": "vasse", "credits": 140 },
    "B": { "commander": "dob", "player": "script:rush",
           "roster": { "buildings": ["den"], "powers": [], "doctrines": [] },
           "units": [{ "unit": "unit.ravel.raider", "count": 4, "at": { "x": 40, "y": 12 } }] }
  },
  "settings": "battleBanner=on"
}
```

Here side A starts with 140 credits instead of the curve's 100, and side B fields only the Den. It builds on what
exists: the duel's `DuelSetup` (map, seed, rounds, Battle Round length, Commanders and rosters,
`src/duel/types.ts`) and the scenario format's way of placing units (`src/scenario/`). A battle file the loader refuses
is refused by name, every problem at once, the way a mission is.

### 3.4 How a Skirmish is tested

**A Skirmish is deterministic** (RULE for the duel it plays, `tests/duel.test.ts`: "a duel resolves the same every run"):
the same battle file, seed and plans give the same battle, hash for hash, on Node and Bun. That makes four ways to test one, from cheapest to fullest:

1. **Headless, script against script**: the duel commands (`npm run duel -- play`, `bench`), and a battle file given to
   them once it exists. For balance and for a rule's effect over many seeds.
2. **Headless, a player's plans**: the driver plays side A through the Build Phase's own functions, as `duel run` plays
   a Challenge battle today. For a flow end to end with no terminal.
3. **On screen, by keys**: the playtest script (`node scripts/playtest.mjs`) opening a Skirmish by its route and a battle
   file, pressing keys and returning every screen. For how it reads.
4. **By Mario**: `./bin/terminal-nexus.ts`, Skirmish on the title menu, or a battle file on the command line.

The Skirmish milestone makes a Skirmish the default place to see a change: the playtest skill, the browser page and the
pictures a pull request shows start from one, where today they start from PERIMETER. PERIMETER is then opened only for
a change about missions.

## 4. Story

A Commander's story, the same shape for every Commander: a tutorial, three or four technology missions whose
collections carry forward, an endless stand scored until the Nexus falls, and a final battle ([`story.md`](story.md)
is the design).

**A mission exists only inside Story** (RULE — settled 2026-11-11; the Skirmish milestone's rename holds it in code). Any mission still opens directly for testing, by its route
(`campaign?level=<id>` today, renamed with the mode), without playing the story before it.

Story comes after Skirmish has been played by people, because every mission is a Skirmish setup plus a script and words:
a mission built before the battle is fun would be built twice.

## 5. Versus — IDEA

Two people, one battle: hidden simultaneous plans and deterministic resolution already fit play over a network and play
by turns. Versus builds on Skirmish: the settings found to make the most enjoyable Skirmish are where a fair Versus
battle starts. The cheapest version already half exists: the duel plays through files, one plan a round
(`duel new`, `wait`, `submit`), so a battle by correspondence is close. Nothing is designed, and multiplayer stays out
of scope until a milestone asks for it.

## 6. What was retired

**Challenge runs**, a seeded series of battles with a draft between them, were retired on 2026-11-11 ([the owner's
words](../history/feedback/2026-11-11-game-modes.md)): a battle is too long for a run of many. Their design is
[kept in history](../history/challenge-runs-design.md). What survives:

- **The draft** — three cards weighted by rarity, gated by tier, with a pity offset — is the starting point for Story's
  technology choice between missions.
- **Building actions** (upgrades, modes, orders), **the kept front** and **the battle banner** are battle mechanics and
  belong to every mode.
- **The code** (`src/run/`, the title menu's Challenge row, `challenge?seed=<n>`) still plays until the Skirmish
  milestone replaces it with Skirmish.

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

- How an endless stand is scored (Q93), and which presets of opponent and credits are worth offering.
- How long a battle should be (Q75), which the worker economy is the first step able to time.
- Versus, modifiers and every other later idea of section 3.2: each is decided when a milestone asks for it.
