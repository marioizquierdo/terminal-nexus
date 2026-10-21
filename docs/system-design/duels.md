# Terminal Nexus — duels

_Two Commander Armies fought out on one map, headless: script against script, model against model, or any mix. How a duel plays, the command line, the brief a player reads and the plan it answers with, the formation a player builds by, how to run model-against-model games for testing, and what the numbers can and cannot say._

A duel is the development bench for armies (the owner, 2026-10-17: "put each commander nexus on one side of the map
and play a pvp ... script vs script", and a model planning each side from "the relevant logs plus current map state,
plus game instructions"). It is not multiplayer and has no screen: it is the rules (`src/duel/`), a brief and a plan
format any player can use, and a command (`bin/duel.ts`). Armies are written by [`army-authoring.md`](army-authoring.md).

## 1. How a duel plays

**Each round is the campaign's round, for two sides at once** (RULE — `src/duel/round.ts`, `tests/duel.test.ts`):

1. **The Nexus Pulse** deals each side a hand from its army's powers by its Commander's schedule, each side on its own
   seed. A side keeps one card, or none. War Chest is never dealt.
2. **The Build Phase**: each side's plan places buildings by the Build Phase's own rules (`legalityAt`: build range,
   room round a building that trains, rock, cost; the tech tree as the round opens). The two plans are blind to each
   other and revealed together; a building both sides put on the same ground is built by neither, and paid back.
3. **The Battle Round**: each side's troops take its stance — `attack` marches on the enemy Nexus, `hold` gathers in
   front of its own — and the kernel runs it, **each side on its own content** (`PulseContext.sides`): what one side's
   powers changed is that side's alone, though both may field troopers.
4. **Between rounds**: Recall brings survivors home, a Commander who fell is out by her own rule, credits carry over,
   and each side adds the curve's credits for the round and what its abilities earned (Dob's bounty).

**A duel ends** when a Nexus falls, or after its last round: then the side whose Nexus kept the larger share of its
health wins; on an even share, the side that dealt more damage over the duel; on that too, a draw.

**What a side starts with**: its faction's Grid Nexus on its end of the map, its Commander and her starting package
(`start` in her army), and round 1's credits. Maps are `src/duel/maps.ts`: the Crossing (72 by 28, a ridge with one
gap) and the Pocket (22 by 12, the bases close enough that their build ranges meet).

## 2. The command line

```text
node bin/duel.ts play  --a vasse --b dob [--player-a script:balanced] [--player-b script:rush] [--seed 1] [--rounds 8] [--out dir]
node bin/duel.ts bench [--commanders vasse,dob] [--players balanced,rush,turtle] [--seeds 1-6] [--rounds 8] [--out file.json]
node bin/duel.ts new    --dir D --a vasse --b dob [--seed 1] [--rounds 6]
node bin/duel.ts wait   --dir D --side A [--timeout 100]
node bin/duel.ts submit --dir D --side A --plan plan.json
node bin/duel.ts status --dir D
```

- **`play`** fights one duel in one process. A player is `script:balanced`, `script:rush`, `script:turtle`
  (`src/duel/players.ts`), each also by a formation (`script:rush-block`, `script:rush-apart`: formations, below), or
  `cmd:<command>`: the command runs once a round with the brief's text on its input, and what it prints is the plan
  — the hook for a model on the command line.
- **`bench`** plays every pairing **from both sides** over the seeds, so a side's advantage on the map cancels out, and
  prints who won. With no `--commanders`, every Commander the armies have.
- **`new` / `wait` / `submit`** play a duel through files, for players that are other processes: `new` writes
  `state.json` and each side's `brief-<side>-<round>.md` (and `.json`); `wait` blocks until a side has a brief to
  answer and prints it (or prints `THE DUEL IS OVER`); `submit` hands in a plan, and the second side's plan plays the
  round and writes `report-<round>.md`. A lock keeps two sides submitting at once from playing a round twice.

## 3. The brief and the plan

**The brief** (`src/duel/brief.ts`) is what a player on the Build Phase screen could know, as data for a script and as
text for a model: the round, the Commander and her skills, credits and supply, both Nexuses' health, the hand, what it
can build (cost, tier, what it trains and how strong that is a credit, what it needs standing, its own skills), the map
drawn with every glyph (its side lower case, the enemy upper case), the places it can name, the enemy's buildings,
units and kept powers (kept powers are public), last round's report for both sides, and a line for every round so far.
Never the enemy's plan.

**The plan** is one JSON object, read leniently (`src/duel/plan.ts`): the first `{ ... }` in whatever the player
wrote.

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

## 4. How tight an army fights: formations

Units come out on the roofs of the buildings that made them, so where a side builds decides how tight its army fights
([the formations report](../history/reports/2026-10-20-formations.md): a block of Barracks meets the enemy about 3
columns from its middle, set apart about 14). **A plan's `formation` makes that a choice** (RULE — `src/duel/round.ts`,
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

**The record says it**: each side's round report carries the formation its plan named (`formation`), the round's
lines say `built 3 (block)`, and a measurement names each side's player with it (`rush-block` against
`rush-apart`), so a summary can say who won by formation ([`measurement.md`](measurement.md)).

## 5. Model against model, for testing

A cheap model plays a side well enough to put an army through its paces. The recipe this repository has run (from a
Claude Code session; any agent that can run a shell command works):

1. `node bin/duel.ts new --dir <D> --a vasse --b dob --seed 11 --rounds 6`.
2. Start one agent per side, in the background, on a small model, each with this task (its side and directory filled
   in): _"Repeat until the duel is over: run `node bin/duel.ts wait --dir <D> --side <S> --timeout 100` (run it again
   if it says still waiting; stop if it says THE DUEL IS OVER); decide a plan from the brief; write it as one JSON
   object to `<D>/my-plan-<S>.json`; run `node bin/duel.ts submit --dir <D> --side <S> --plan <D>/my-plan-<S>.json`.
   Only run those two commands and write your plan file; read nothing else. When it is over, reply with the result line
   and one sentence on your strategy."_
3. Read the result: `node bin/duel.ts status --dir <D>`, or `<D>/result.md`; every round's report is beside it.

Play each pairing from both sides (A and B swapped) and over several seeds before reading anything into it. A six-round
duel takes about a minute and some 75 thousand tokens of a small model a side. Small agents wander: several of the
first sixteen made one call to a tool they were told not to use (all refused or harmless); name the only commands they
may run, and prefer `cmd:` on a machine with a command-line model.

**What a model's games are and are not.** A scripted or small-model player is not a good player: it shows what an army
does in the hands of a plain plan, where its strengths come from, and where the rules or the brief let a player down.
It does not show balance. Read the numbers for direction, the reports for why.

## 6. What a duel measures, and what biases it

- **No side wins by where it stands** (since 2026-10-19; before, one end of the map won nearly every mirror duel,
  which end by the plan). Every tie the rules break goes by what the deciding unit faces, then a seeded draw
  ([`pulse.md`](pulse.md), "No side wins by where it stands"), so the same Commander and plan win from either end
  about as often (`tests/fairness.test.ts`). A bench still plays every pairing from both sides: the two ends are
  each other's mirror, but a seed's hand and draws are not.
- **A duel that ends on time is judged on the Nexuses' health, then on damage**, which a stalemate decides by small
  margins. A duel that ends with a Nexus falling says more.
- **Strength a credit is in the brief** (each building's units' health times damage a second, a credit): Ravel
  buildings train about half what Citizen ones do by that measure, because a Ravel unit's worth is partly its burst on
  death, which the measure leaves out.
