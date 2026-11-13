# Terminal Nexus — duels

_The duel is the battle a Skirmish plays: two Commander Armies on one map, a round at a time, each side planned blind
by a script, a person or a model. How its rounds play, the brief a player reads and the build actions it answers with, the
formation a player builds by, and what its numbers can and cannot say. The code is `src/duel/`, pure; a person plays it
as a Skirmish ([`game-modes.md`](../game-design/game-modes.md)), the `skirmish` command plays it headless
([`src/cli/skirmish.ts`](../../src/cli/skirmish.ts), whose opening comment is its manual), and how a test uses that
is [`sandboxes.md`](sandboxes.md), testing through Skirmishes._

It began as the development bench for armies (the owner, 2026-10-17: "put each commander nexus on one side of the map
and play a pvp ... script vs script", and a model planning each side from "the relevant logs plus current map state,
plus game instructions"). It is not multiplayer and has no screen of its own: it is the rules, and a brief and a format
for build actions any player can use. Armies are written by [`army-authoring.md`](army-authoring.md). Its code calls the two
sides A and B; a Skirmish calls them slots `p1` (west) and `p2` (east).

## 1. How a duel plays

**Each round is a mission's round, for two sides at once** (RULE — `src/duel/round.ts`, `tests/duel.test.ts`):

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

**A duel ends** when a Nexus falls, or after its last round: then the side whose Nexus kept the larger share of its
health wins; on an even share, the side that dealt more damage over the duel; on that too, a draw.

**What a side starts with**: its faction's Grid Nexus on its end of the map, its Commander and her starting package
(`start` in her army), and round 1's credits. Maps are files in `maps/`, read by `src/duel/maps.ts`: the Crossing (72 by 28, a ridge with one
gap) and the Pocket (22 by 12, the bases close enough that their build ranges meet).

**A side that is not its Commander's whole army** has a **roster** (RULE — `Roster`, `src/duel/types.ts`; `restrictedTo`, `src/duel/sides.ts`; `tests/duel.test.ts`): the building cards on its build menu and the Nexus powers in the pool its Pulse deals from, by id, and the Doctrines it keeps from the first round. Everything else its army could field is left out as if the army never had it; a building a listed power adds still joins the menu when the power is kept. The retired Challenge run played its player on one ([the retired design](../history/challenge-runs-design.md)), and a Skirmish's battle file may name one ([`game-modes.md`](../game-design/game-modes.md)); the opponent, and every duel the measurement commands play, has none and fields the whole army.

## 2. Playing one

A duel is played as a Skirmish: on the Build Phase screen (`src/cli/skirmish-play.ts`), or headless by the `skirmish`
command, a round a command, many battles over seeds, every pairing of Commanders, or two sessions handing in build actions through
one save file. Both play every round through one function (`playNext`, `src/skirmish/play.ts`), so a duel played on
screen and one played headless are the same duel. The command's options and examples are its opening comment
([`src/cli/skirmish.ts`](../../src/cli/skirmish.ts)); the save it plays from is [`skirmish-saves.md`](skirmish-saves.md).

## 3. The brief and the build actions

**The brief** (`src/duel/brief.ts`) is what a player on the Build Phase screen could know, as data for a script and as
text for a model: the round, the Commander and her skills, credits and supply, both Nexuses' health, the hand, what it
can build (cost, tier, what it trains and how strong that is a credit, what it needs standing, its own skills), the map
drawn with every glyph (its side lower case, the enemy upper case), the places it can name, the enemy's buildings,
units and kept powers (kept powers are public), last round's report for both sides, and a line for every round so far.
Never the enemy's build actions.

**The build actions** are one JSON object a round, read leniently (`src/duel/build-actions.ts`): the first `{ ... }` in
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
in the next duel's brief; a script reads the brief's data, which carries none.

## 4. How tight an army fights: formations

Units come out on the roofs of the buildings that made them, so where a side builds decides how tight its army fights
([the formations report](../history/reports/2026-10-20-formations.md): a block of Barracks meets the enemy about 3
columns from its middle, set apart about 14). **The build actions' `formation` makes that a choice** (RULE — `src/duel/round.ts`,
`tests/duel-formation.test.ts`). It places only the buildings that train units; a Turret or a Supply Depot goes where
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
before formations (`balanced-zones` plays the same duel). A script picks its producers from the brief's buildings
that train units, so a new one (a bomber's nest, a mortar pit) is placed by its formation once it is in the army's
menu.

**The scripted players with area damage**: `rush-area`, `balanced-area`, `turtle-area`, each also by a formation
(`rush-area-block`). The scripts value a building by what it trains, health times damage, which scores a unit that
only bursts at nothing, so a bare script never buys a Battery (mortars) or a Fuse Shed (bombers). With `-area` it buys
one first each round, or the building it needs standing so it opens next round, and spends the rest as its script
would (`withArea`, `src/duel/players.ts`; the brief marks such a building `area`). It is how a duel measures area damage
against a tight army ([the report](../history/reports/2026-10-21-area-damage.md)).

**The record says it**: each side's round report carries the formation its plan named (`formation`), the round's
lines say `built 3 (block)`, and a measurement names each side's player with it (`rush-block` against
`rush-apart`), so a summary can say who won by formation ([`measurement.md`](measurement.md)).

**A duel side can be played from the Build Phase screen** (`src/cli/skirmish-play.ts`: a Skirmish): the
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

## 6. What a duel measures, and what biases it

- **No side wins by where it stands** (since 2026-10-19; before, one end of the map won nearly every mirror duel,
  which end by the plan). Every tie the rules break goes by what the deciding unit faces, then a seeded draw
  ([`pulse.md`](pulse.md), "No side wins by where it stands"), so the same Commander and plan win from either end
  about as often (`tests/fairness.test.ts`). A tally of Commanders (`skirmish --commanders`) still plays every pairing from both sides: the two ends are
  each other's mirror, but a seed's hand and draws are not.
- **A duel that ends on time is judged on the Nexuses' health, then on damage**, which a stalemate decides by small
  margins. A duel that ends with a Nexus falling says more.
- **Strength a credit is in the brief** (each building's units' health times damage a second, a credit): Ravel
  buildings train about half what Citizen ones do by that measure, because a Ravel unit's worth is partly its burst on
  death, which the measure leaves out.

## 7. Reading a battle

**What a battle says is read in one place** (RULE — `src/duel/reading.ts`, `tests/reading.test.ts`), so the brief, the
round's report, the `skirmish` command, a script and a model all read the same facts. A reading reads the record and
never feeds the rules: a round plays the same whether or not it is read.

- **The score** (`scoreOf`): each side's damage dealt over the battle and its Nexus's share of health, and who leads by
  the rule a battle that runs out of rounds is judged by (the healthier Nexus, then the damage). The brief says it
  every round: `Score: You lead on damage: damage dealt 518 to 382; both Nexuses whole.` A battle judged on damage is
  no longer won on a total nobody sees (from the agent's play of 2026-11-13).
- **A round's reading** (`roundReader`, played through by `playRound` and kept in its report as `reading`):
  - **the front**, where the fighting was between the two Nexuses, in whole percent, 0 at a side's own and 100 at the enemy's — the map's
    tempo in one number: on the Pocket the scripts fight from tick 1, on the Crossing in the middle by tick 130;
  - **first contact**, the tick units first hurt each other;
  - **the nearest an enemy came** to each Nexus, in tiles;
  - **what hit each Nexus**, damage by the content that dealt it, its own side's blasts included;
  - **each building lost, and what destroyed it** (`2 Barracks by Bomber`);
  - **what a side's own blasts and splashes cost it**: a death's blast hurts friend and foe unless its content says
    enemies alone ([`pulse.md`](pulse.md)), and now the player is told.

  The brief prints the side's own reading under the last round (`Front: …`, `Your Nexus was hit by: …`), and each round's
  report in the command prints both sides' in a line.
- **The battle drawn as text** (`battlePicture`, `src/duel/picture.ts`): the ground, each building in its art, each unit
  by its name's first letter, p1's in lower case and p2's in upper case; a unit on a roof is counted under the picture
  rather than drawn over the building. The brief's map is it, between rounds; `skirmish --show 0,120,end` draws each
  Battle Round played at those ticks and as it ends, after the round's report, so an agent reading text sees the battle
  at the moment it asks about. Played from any kept round (`--out` keeps each round's save), that is the inspection a
  test needs: load the round, give its build actions, `--play-to next --show <ticks>`, and nothing is saved over.
- **A script that reads** (`reader`, `src/duel/players.ts`): builds as `balanced`, then plays the stance that has traded
  better over the battle, trying each once (every round's report is in the brief's data, `reports`), attacks when both
  sides held, attacks a Nexus under half, holds a lead on Nexus health in the last round and attacks when behind; puts a
  Turret by its Nexus first when the enemy reached it, and sets its producers apart once the enemy has a building
  standing whose units aim at the thickest knot (a block otherwise was tried: on the Pocket's small build range it
  left credits unspent, and lost). Measured on 2026-11-13 ([the table](../history/feedback/2026-11-13-reading-the-battle.md)):
  better than `balanced` on the Pocket and faster against a rush, worse on the Crossing, where a hold gives back the
  kept front. Its note says why each round. A new reading is a new field here, read
  by the brief and offered to every script at once.
