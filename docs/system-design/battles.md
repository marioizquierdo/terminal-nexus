# Terminal Nexus — battles

_The battle is the battle a Skirmish plays: two Commander Armies on one map, a round at a time, each side planned blind
by a script, a person or a model. How its rounds play, the brief a player reads and the build actions it answers with, the
formation a player builds by, and what its numbers can and cannot say. The code is `src/battle/`, pure; a person plays it
as a Skirmish ([`game-modes.md`](../game-design/game-modes.md)), the `skirmish` command plays it headless
([`src/cli/skirmish.ts`](../../src/cli/skirmish.ts), whose opening comment is its manual), and how a test uses that
is [`sandboxes.md`](sandboxes.md), testing through Skirmishes._

It began as the development bench for armies (the owner, 2026-10-17: "put each commander nexus on one side of the map
and play a pvp ... script vs script", and a model planning each side from "the relevant logs plus current map state,
plus game instructions"). It is not multiplayer and has no screen of its own: it is the rules, and a brief and a format
for build actions any player can use. Armies are written by [`army-authoring.md`](army-authoring.md). Its code calls the two
sides A and B; a Skirmish calls them slots `p1` (west) and `p2` (east).

## 1. How a battle plays

**Each round is a mission's round, for two sides at once** (RULE — `src/battle/round.ts`, `tests/battle.test.ts`):

1. **The Nexus Pulse** deals each side a hand from its army's powers by its Commander's schedule, each side on its own
   seed. A side keeps one card, or none. War Chest is never dealt.
2. **The Build Phase**: each side's build actions place buildings by the Build Phase's own rules (`legalityAt`: build range,
   room round a building that trains, rock, cost; the tech tree as the round opens). The two sides' build actions are blind to each
   other and revealed together; a building both sides put on the same ground is built by neither, and paid back.
3. **The Battle Round**: each side's troops take its stance — `attack` marches on the enemy Nexus, `hold` gathers in
   front of its own — and the kernel runs it, **each side on its own content** (`PulseContext.sides`): what one side's
   powers changed is that side's alone, though both may field troopers.
4. **Between rounds**: survivors stay on the Grid and regroup across their march line (`src/match/regroup.ts`), a Commander who fell is out by her own rule, credits carry over,
   and each side adds the curve's credits for the round and what its abilities earned (Dob's bounty).

**A round opens in one function** (`roundOpening`, `src/battle/round-opening.ts`): the Commanders due back set down, the
buildings, the first round's Commander and starting package, the call-ups. `playRound` opens every Battle Round with it, and
the Skirmish's Build Phase asks it what arrives, so the see-through units on the screen are the ones the battle sets down.

**A battle ends** when a Nexus falls, or after its last round: then the side whose Nexus kept the larger share of its
health wins; on an even share, the side that dealt more damage over the battle; on that too, a draw.

**What a side starts with**: its faction's Grid Nexus on its end of the map, its Commander and her starting package
(`start` in her army), and round 1's credits. Maps are files in `maps/`, read by `src/battle/maps.ts`: the Crossing (72 by 28, a ridge with one
gap) and the Pocket (22 by 12, the bases close enough that their build ranges meet).

**The maps for testing** (measured with the scripts, 2026-11-13; a script is no good player, so read these as where a
map leans, and add to them when a battle teaches more):

| Map | Good for testing | Bad for testing |
| --- | --- | --- |
| **The Crossing** | A long battle: the kept front, economy and scaling over eight rounds, area damage against a big army, a stance held or pressed; most battles end on time, judged on damage | A quick answer (rounds run to the limit); whether a Nexus can be taken (one rarely falls); round-1 play |
| **The Pocket** | Round 1 and 2 decisions, a rush and the answer to it, blind building on contested ground (the build ranges meet, so two sides often plan the same tile), a Nexus under fire: units meet at tick 1 and a Nexus falls in two to four rounds | Anything that needs room: formations (a block rarely fits the small build range and leaves credits unspent), the long game, movement round obstacles |

**A side that is not its Commander's whole army** has a **roster** (RULE — `Roster`, `src/battle/types.ts`; `restrictedTo`, `src/battle/sides.ts`; `tests/battle.test.ts`): the building cards on its build menu and the Nexus powers in the pool its Pulse deals from, by id, and the Doctrines it keeps from the first round. Everything else its army could field is left out as if the army never had it; a building a listed power adds still joins the menu when the power is kept. The retired Challenge run played its player on one ([the retired design](../history/challenge-runs-design.md)), and a Skirmish's battle file may name one ([`game-modes.md`](../game-design/game-modes.md)); the opponent, and every battle the measurement commands play, has none and fields the whole army.

## 2. Playing one

A battle is played as a Skirmish: on the Build Phase screen (`src/cli/skirmish-play.ts`), or headless by the `skirmish`
command, a round a command, many battles over seeds, every pairing of Commanders, or two sessions handing in build actions through
one save file. Both play every round through one function (`playNext`, `src/skirmish/play.ts`), so a battle played on
screen and one played headless are the same battle. The command's options and examples are its opening comment
([`src/cli/skirmish.ts`](../../src/cli/skirmish.ts)); the save it plays from is [`skirmish-saves.md`](skirmish-saves.md).

## 3. The brief and the build actions

**The brief** (`src/battle/brief.ts`) is what a player on the Build Phase screen could know, as data for a script and as
text for a model: the round, the Commander and her skills, credits and supply, both Nexuses' health, the hand, what it
can build (cost, tier, what it trains and how strong that is a credit, what it needs standing, its own skills), the map
drawn with every glyph (its side lower case, the enemy upper case), the places it can name, the enemy's buildings,
units and kept powers (kept powers are public), last round's report for both sides, and a line for every round so far.
Never the enemy's build actions.

**The build actions** are one JSON object a round, read leniently (`src/battle/build-actions.ts`): the first `{ ... }` in
whatever the player wrote. A build file holds them for one round or many, each entry with the `round` it is for (`3`,
`"2-4"`, `"*"`), the first that fits winning (the `skirmish` command's manual says how a run plays them).

```json
{ "power": 1, "build": [{ "building": "barracks", "at": "forward" }, { "building": "depot", "at": "back" }], "formation": "block", "stance": "attack", "note": "why" }
```

`power` is the hand's card number (0 for none); `build` is in order, while credits last, each `at` one of `nexus`,
`forward` (ahead of the furthest building, so a base pushed forward builds further forward), `back`, `north`,
`south`, or an `x` and `y`; `formation`, which may be left out, is `block`, `apart` or `zones` (formations,
below); `stance` is `attack` or `hold`. What the rules refuse is said in the next brief, and a field it cannot
read (a formation it does not know) is dropped with the problem said.

The brief also says, in a section of its own, that where a side builds decides how tight its army fights and what that
wins and loses, and lists what the enemy's buildings can train with what those units do, an attack that hits an area
said as one (a splash, burning ground, a burst, aiming at the thickest knot), so a player can weigh a formation
against the army it faces.

**A player that reads words also gets the play strategies** ([`play-strategies.md`](../game-design/play-strategies.md)):
what battles have taught so far, as advice with its measurement, just before the build actions it is asked for. The page is read
when the brief is written (`playStrategies`, `src/cli/play-strategies.ts`), from its marker to its end, so an entry added there is
in the next battle's brief; a script reads the brief's data, which carries none.

## 4. How tight an army fights: formations

Units come out on the roofs of the buildings that made them, so where a side builds decides how tight its army fights
([the formations report](../history/reports/2026-10-20-formations.md): a block of Barracks meets the enemy about 3
columns from its middle, set apart about 14). **The build actions' `formation` makes that a choice** (RULE — `src/battle/round.ts`,
`tests/battle-formation.test.ts`). It places only the buildings that train units; a Turret or a Supply Depot goes where
its own placement says. Every spot is still one the Build Phase allows (`legalityAt`), and both ends of the map play
it as each other's mirror.

| Formation | Where each building that trains units goes | What it is for |
| --- | --- | --- |
| `block` | touching another of the side's producers along a side (standing or placed this round), as near where the plan asks for the first of them as that allows; the first ever goes nearest there | the waves come off the roofs together and meet the enemy as one; an area attack catches many at once |
| `apart` | as far from every other producer as it can, up to 10 (nearest tiles, a row counting two columns), and on a tie nearest where the plan asks for the first | the waves come out apart and reach the fight one after another; an area attack catches few |
| `zones` | where its own placement says, a named place or a tile | no formation: how every plan placed before there were formations, and what a plan that names none still does |

**Where a formation is centred** is where the plan asks for its first building that trains units (its `at`, or its
`x` and `y`); the others' own places are not read. **When the shape will not fit** — a block hemmed in by rock or the
edge of the build range, or no spot the full gap from the others — a block takes the nearest legal spot, touching or
not, and `apart` the spot furthest from the others it can have: in the first round on the Crossing both shapes fit
whole; in later rounds a side set apart is often nearer its neighbours than the full gap. **Neither builds past its
centre toward the enemy while it has room behind it**: without that, a side set apart pushed its base further forward
each round than a block did (the building furthest forward moves `forward` with it), and block against apart
measured how far forward a base stood as much as how tight its army fought.

**The scripted players by a formation**: `balanced-block`, `rush-apart`, `turtle-block` and so on, each its script's
own plan with the formation set: the balanced player's block grows from where its first producer goes (forward), the
rush's forward, the turtle's behind its Nexus. A script's bare name names no formation, and plays exactly as it did
before formations (`balanced-zones` plays the same battle). A script picks its producers from the brief's buildings
that train units, so a new one (a bomber's nest, a mortar pit) is placed by its formation once it is in the army's
menu.

**The scripted players with area damage**: `rush-area`, `balanced-area`, `turtle-area`, each also by a formation
(`rush-area-block`). The scripts value a building by what it trains, health times damage, which scores a unit that
only bursts at nothing, so a bare script never buys a Battery (mortars) or a Fuse Shed (bombers). With `-area` it buys
one first each round, or the building it needs standing so it opens next round, and spends the rest as its script
would (`withArea`, `src/battle/players.ts`; the brief marks such a building `area`). It is how a battle measures area damage
against a tight army ([the report](../history/reports/2026-10-21-area-damage.md)).

**The record says it**: each side's round report carries the formation its plan named (`formation`), the round's
lines say `built 3 (block)`, and a measurement names each side's player with it (`rush-block` against
`rush-apart`), so a summary can say who won by formation ([`measurement.md`](measurement.md)).

**A battle side can be played from the Build Phase screen** (`src/cli/skirmish-play.ts`: a Skirmish): the
plan's buildings at their exact anchors, the power picked, the buildings held (`hold`, Hold production), the actions
taken on its buildings (`actions`: `{x, y, action}`, taken after its buildings are placed, from the credits they leave,
and said in its report; the `-upgrade` scripts buy them), and the
troops attacking, since the Build Phase has no stance. `placementsOf` says where a scripted plan's buildings would
go, so the screen plays a scripted side through the Build Phase's own functions.

## 5. No turns, and model against model

**Both sides plan from the same moment** (RULE — the owner, 2026-11-12: "there are no turns: all players move
simultaneously during the build phase"): each side's brief is written from the battle as the Build Phase opens, before
either side's build actions exist, so a script, a person and a model may answer in any order and see the same battle.
What two sides' actions would do to each other is settled when the Battle Round starts, together, never by who handed
them in first (a building on the same ground, above; no turns, in [`concept.md`](../game-design/concept.md)).

A cheap model plays a side well enough to put an army through its paces: each round, each model reads its brief and
answers with its build actions, and the round plays both. The recipe, its cost and how to read what it shows are
[`sandboxes.md`](sandboxes.md), testing through Skirmishes. A scripted or small-model player is not a good
player: its games show what an army does in the hands of a plain plan, not balance.

## 6. What a battle measures, and what biases it

- **No side wins by where it stands** (since 2026-10-19; before, one end of the map won nearly every mirror battle,
  which end by the plan). Every tie the rules break goes by what the deciding unit faces, then a seeded draw
  ([`pulse.md`](pulse.md), "No side wins by where it stands"), so the same Commander and plan win from either end
  about as often (`tests/fairness.test.ts`). A tally of Commanders (`skirmish --commanders`) still plays every pairing from both sides: the two ends are
  each other's mirror, but a seed's hand and draws are not.
- **A battle that ends on time is judged on the Nexuses' health, then on damage**, which a stalemate decides by small
  margins. A battle that ends with a Nexus falling says more.
- **Strength a credit is in the brief** (each building's units' health times damage a second, a credit): Ravel
  buildings train about half what Citizen ones do by that measure, because a Ravel unit's worth is partly its burst on
  death, which the measure leaves out.

## 7. Reading a battle

**What a battle says is read in one place, the battle reading** (RULE — `src/battle/reading/`, `tests/reading.test.ts`),
so the brief, the round's report, the score, the `skirmish` command, the measurement, a script and a model read the same
facts. It is the only reader of a round's events: every number of the battle (what a side fielded, trained, lost and
killed, the damage it dealt, its Nexus's health, its Commander's fall, what its abilities did) is a reading, and
`totals.ts` holds the sums over them (`lostOf`, `lostCount`, `dealtOf`). A reading reads the record and never feeds the
rules: a round plays the same whether or not it is read.

**Public and private.** A round's report (`RoundReport`) has two halves, and the split is the brief's. `reading` is the
Battle Round: fought in the open, every part of it public, both sides see all of it. `sides` (`SideReport`) is the Build
Phase: a side's commander, credits, spent, earned, kept power, hand, built, actions, refused, stance, formation and note,
all its own, and no reading touches them. The brief says so in a line, and keeps to it as data: the other side's part of
each round's `sides` reaches a brief without its credits, what it spent and earned, its hand, what the rules refused it
and its note (`seenBy`, `src/battle/brief.ts`), and `reading` reaches it whole. The command's own round report, which a
tester reads, shows both sides whole.

**A save holds each round's reading with its report.** A save written before this has none; the loader refuses it by the
round (`state.history[n]`), and `node scripts/make-example-saves.ts` writes the examples again.

**The readings**, each one small file (`Tracker`: shown each tick, asked for its value as the round ends), kept plain —
a count, a total, a place — with the meaning left to the reader:

| Reading | What it says, for each side | File |
| --- | --- | --- |
| **score** | damage dealt over the battle, its Nexus's share of health, who leads and on which rule (the rule a battle the rounds run out on is judged by), from the rounds' other readings | `score.ts` |
| **army** | its units as the round opened and as it ended, those its buildings trained and what it lost: each a composition — how many of each, how many in all, and the **army value** in credits (each unit at what its building pays for one: the card's cost over the units it makes a round; a Commander and a starting unit count nothing); whether its Commander fell; what its abilities did, counted by name | `army.ts` |
| **buildings** | what stands at the end (a composition with its value), what is damaged and how badly — the Nexus among them, as any building — each one destroyed, with what destroyed it, and its Nexus's health as the round opened and ended, and its most | `buildings.ts` |
| **advance** | where its army stood between its Nexus (0%) and the enemy's (100%) as the round opened and as it ended — the end less the start is how far the army moved — and the nearest an enemy came to its Nexus | `advance.ts` |
| **damage** | the damage it took, by the content that dealt it, and how much of that was its own blasts and splashes (a death's blast hurts friend and foe unless its content says enemies alone), and what it dealt to the enemy: to units, to buildings, to the Nexus | `damage.ts` |
| **engagements** | where and when the sides fought: an engagement starts at a hit of one side on the other, takes in every hit within 5 tiles of one already in it, and ends after 5 seconds with no hit there; it says when, where and how wide, and for each side the damage dealt there, the units engaged (a composition with its value) and what it lost there | `engagements.ts` |

`context.ts` keeps what they share (who each entity is, what it costs, where a tile lies between the Nexuses) and
`lines.ts` says them in words, counted by `namedCounts`. **A new reading is a new file and one line in `index.ts`**; the
round's report keeps it, and the brief and every script get it at once. Add one only for a question a test or a script asks; a reading nobody
reads is deleted.

**Where they are said.** Each brief: the score every round, and under the last round the side's army and the enemy's,
its buildings, the advance, the damage it took and each engagement. Each round's report in the `skirmish` command: both
sides' in a line each, then each engagement.

**The ASCII screenshot** (`asciiScreenshot`, `src/view/ascii-screenshot.ts`): the Grid exactly as the game's screen
draws it — the same layers and glyphs (`drawGridLayers`, shared with the screen's own frame), featureless ground as the
screen's sparse lattice, a unit on a roof drawn over its building — written out as text. What the picture cannot say
is said beside it, never in it: a ruler and row numbers, a legend (each glyph; each building with its art and where it
stands, since a symbol has no case and two sides' buildings can look alike) and the **overlaps**, each cell where one
thing stands over another and what is under it (a unit on a roof; later a flyer over the ground). The brief's map is
one, between rounds. `skirmish --show 0,120,end` takes one of each Battle Round played at those ticks and as it ends,
from the same view the screen plays (so a unit mid-step stands where the screen shows it), after the round's report;
`--show-effects` adds the effects on screen at that instant. Played from any kept round (`--out` keeps each round's
save), that is the inspection a test needs: load the round, give its build actions, `--play-to next --show <ticks>`,
and nothing is saved over. It is not a **screenshot**, which is an image of the screen (PNG: `scripts/playtest.mjs`,
the grid-screenshots skill): an agent reads the one as text and looks at the other.

**A script that reacts** (`reactive`, `src/battle/players.ts`): builds as `balanced`, then plays the stance that has
traded better over the battle, trying each once (every round's report is in the brief's data, `reports`), attacks when
both sides held, attacks a Nexus under half, holds a lead on Nexus health in the last round and attacks when behind;
puts a Turret by its Nexus first when its Nexus is hurt or an enemy came within 8 tiles, and sets its producers apart
once the enemy has a building standing whose units aim at the thickest knot. Its note says why each round.

**How the scripts did against each other, 2026-11-13** (as p1, every pairing of Commanders, seeds 1 to 3, 8 rounds, 18
battles a row; a record of that day, to be measured again rather than trusted after a change):

| p1 against | the Pocket: reactive | the Pocket: steady | the Crossing: reactive | the Crossing: steady |
| --- | --- | --- | --- | --- |
| `agro` | 18–0 | 18–0 | 18–0, in 3.0 rounds | 18–0, in 4.1 |
| `defensive` | 15–3 | 12–6 | 14–4 | 18–0 |
| `steady` | 10–8 | 8–10 | 6–12 | 8–10 |

Reacting pays on the Pocket; on the Crossing steady pressure from round 3 still wins more, since a hold gives back the
kept front, which no one round's trade shows.
