# Terminal Nexus — the testing ground

_Where a change to troops is tried before it is believed: a new unit, a number tuned, a formation, a kind of ground, a
rule of how units move or choose what to fight. What the maps are and where they live, how a trial is played and
read, how to change a map without writing a new one, the trials kept as tests, recipes for the usual questions, what
earlier trials found, and what a trial cannot say. Every unmarked statement is GUIDANCE._

A change to how troops behave is good when it does one of three things, and the testing ground measures all three on
the same battles before and after:

- **Battles are decided.** A fight that ends sooner, or ends at all, rather than standing still or running out of time.
- **Units engage.** More of an army ever strikes, and sooner; fewer stand stalled behind their own front.
- **The choice matters.** The army to field depends on the ground: no army wins everywhere, and no army is never worth
  fielding. A player's Build Phase is only a decision if this holds.

And through all three, **who wins, and how surely**: a win rate over enough battles, with the interval that says how
much a few dozen battles can tell.

## 1. The maps

Every checked-in map is a `.map.json` file under `scenarios/`, in one folder for what it is for. **A map's id is its
file name**, unique across the folders, and every command finds a map by its id alone (`grid melee-kill`), so a map
moves between folders without anything that names it changing (RULE — `mapCatalog`, `src/scenario/load-map-file.ts`).

| Folder | What its maps are for | Read by |
| --- | --- | --- |
| `scenarios/rules/` | One rule each, as small as shows it: a kill, a death's salvage, the end of a battle, an aura, a bounty, burning ground | `tests/scenario.test.ts`, `tests/rules.test.ts` and the rule's own tests |
| `scenarios/units/` | One unit's mechanic each, the proving grounds' bench: a ram that prefers buildings, a spawner, a shove, a split | `tests/proving-grounds.test.ts` |
| `scenarios/movement/` | One shape a route must manage each: a dead end, a pocket, a gap, a crowd, a corridor, a falling wall, slow ground, workers fleeing, footprints through gaps | `tests/route-scenarios.test.ts`, `tests/march.test.ts`, `tests/grid.test.ts` |
| `scenarios/engage/` | **The bench**: twelve units a side on six grounds, each side's target the enemy Nexus, played to a result | the trials, `tests/engage-scenarios.test.ts` |
| `scenarios/showcase/` | Whole battles to look at: the mirror skirmish, Citizens against Ravels, the grand battle, the heavies | screenshots, the browser page, performance |
| `scenarios/trials/` | Trial files (section 4): which maps, seeds and variants a question is played over, and what it expects | `grid`, `tests/engage-scenarios.test.ts` |

**Every side that fights has somewhere to go** (RULE — `sidesWithoutGoal`, `src/scenario/goals.ts`;
`tests/scenario.test.ts`): its own target, or an enemy Nexus to head for, as every side of the game has one. A battle
where a side has neither is one the game never plays (its units fall back on engaging the nearest enemy wherever it
is), so a checked-in map without a goal is refused, and `grid` warns of a hand-written one. A rule fixture with no
Nexus gives each side the rectangle the enemy starts in as its target.

**The engage maps** are exactly symmetric: side B's places are side A's mirrored end for end, each side's target is the
enemy Nexus's footprint, and only the armies differ. A map that is not symmetric decides battles by its ends, not its
armies; the first trial of this bench found that the engage maps as first drawn were not (section 6).

| Map | Ground | Side A | Side B |
| --- | --- | --- | --- |
| `engage-open-melee-vs-mix` | open | twelve troopers | six troopers, six marksmen |
| `engage-gap6-mix-mirror` | a ridge with a gap six rows wide, the Crossing's shape small | the mixed army | the same |
| `engage-gap2-melee-vs-mix` | a gap two rows wide: the wrong ground for melee | twelve troopers | the mix |
| `engage-gap2-airmix-vs-mix` | the same gap | six troopers, six skyraiders | the mix |
| `engage-corridor-melee-vs-mix` | a corridor four rows wide and twenty long | twelve troopers | the mix |
| `engage-lanes-melee-vs-mix` | two gaps three rows wide | twelve troopers | the mix |

A new question about troops usually needs no new map: a variant (section 3) puts another army, unit, ground or target
on one of these. A new map earns its place when the question is a new shape of ground: draw it at 48 by 16 (the engine
tool's pane, `tests/scenario.test.ts`), make it symmetric, give each side the enemy Nexus as its target, and add it to
the bench trial with what it is expected to show.

## 2. Playing a trial

A trial is the same map played over many seeds, as it is and as a variant changes it, every battle recorded the way a
measurement records one ([`measurement.md`](measurement.md), what a battle's record holds), and summed up.

```text
grid engage-gap2-melee-vs-mix --seeds 1-12 --swap --shuffle --army-a trooper:6,skyraider:6
```

plays the map as built and as the options make it, twelve seeds each, and each seed twice:

- **`--swap`**: once as drawn and once mirrored end for end with the sides swapped, side A's army now playing from the
  east (`mirrored`, `src/scenario/variant.ts`). The summary names sides by army, not by end, so whatever an end or the
  order units are read in gives a side cancels out. Use it for every question of which army is better.
- **`--shuffle`**: each side's units swapped among the places of units of their size and formation line by the seed
  (`shuffled`): the same army in the same shape, ranged behind melee as a player sets them, a different unit in each
  place. Units that are all alike shuffle to the same opening; the seed still changes the battle's own draws.

A trial file plays a question kept in `scenarios/trials/` (section 4):

```text
grid engage-bench                         # the bench, as built, against what it expects
grid army-round-robin --seeds 1-3         # fewer seeds, for a look
grid army-round-robin --tune runner.maxHp=28,runner.attack.damage=7   # every battle with a unit tuned
```

`--json` prints the summary as data; `--out <file>` writes every battle's record and the summary; `--baseline <file>`
sets each row beside the same trial written down before a change (section 5). A trial plays about ten battles a second
on one core: the bench's 144 in about fifteen seconds, the round robin's 1260 in under a minute and a half.

**Any `grid` action takes the variant options**, so the one battle a trial's summary points at can be watched or read:
`grid engage-gap2-melee-vs-mix --seed 7 --swap --army-a trooper:6,skyraider:6` watches it, `--headless --log-level
info` reads its story.

## 3. Changing a map without writing one

| Option | What it does | For |
| --- | --- | --- |
| `--set A.t=raider` | side A's legend symbol `t` made another content; `A.trooper=raider` makes every trooper side A places one | a new unit in an old army's place |
| `--army-a trooper:6,skyraider:6` | side A's one-tile units replaced, front (the column nearest the enemy) to back, top to bottom in each column; `--army-b` for B | another army on the same ground, at the same count |
| `--tune trooper.maxHp=60` | a content's number changed for the trial: any field it has (`attack.range`, `speedTier`, `vision`), refused when it has no such field | a unit's numbers before they are written into its army |
| `--terrain "#=scrub"` | every tile of a terrain symbol made another terrain | the same shape of ground, slow instead of closed |
| `--target-a x,y,w,h` | side A's target moved; `--target-b` for B | where an army is sent, as a stance will |
| `--ticks 1200` | how long a battle may run | a battle the default cuts short |

Content is named by its id or its last part (`trooper` for `unit.citizen.trooper`); a name two contents share is
refused with both. Every variant is a pure function of the map and the content, outside the kernel: a variant is a
different opening played by the same rules, so nothing a trial does can make two runs differ.

**Cost.** Each row says the supply each army took, the game's own price of a unit (a pikeman takes two places). Compare
armies at the same supply; an army that wins by fielding more is not the better army. Supply is not the whole price: the
buildings that make units and the cards that change them cost credits, which a trial on a fixed map does not spend.

## 4. Trial files

A trial file is `scenarios/trials/<id>.trial.json`:

```json
{
  "id": "pick-for-the-ground",
  "question": "Does the army to field depend on the ground?",
  "notes": "What it is for and how it is set up, for a person.",
  "maps": ["engage-open-melee-vs-mix", "engage-gap2-melee-vs-mix"],
  "seeds": "1-12",
  "swap": true,
  "shuffle": true,
  "base": { "tune": { "runner.maxHp": 28 } },
  "variants": {
    "melee": { "army": { "A": "trooper:12" } },
    "air mix": { "army": { "A": "trooper:6,skyraider:6" } }
  },
  "expect": [
    { "map": "engage-gap2-melee-vs-mix", "variant": "melee", "measure": "winB", "atLeast": 0.9 }
  ]
}
```

- **`variants`**, by name, in order; the first is what the others are marked against. Each holds any of `set`, `army`,
  `tune`, `terrain`, `targets` and `ticks`, as the options above. None: the maps as built.
- **`armies`** instead of `variants`: a round robin, every army against every other on each map
  (`"melee": "trooper:12"`). The summary ranks the armies on each map by their share of points (a win one, a draw half),
  says what each beat, which army led on each map, whether one led on every map, and whether one beat nobody anywhere.
- **`base`**: what every variant starts from. Variant options given on the command line with a trial file go on top
  of its base, so one command plays the whole trial with a unit tuned.
- **`expect`**: what the trial must show, each a measure of the cells it names (a map, a variant, or every one), at
  least or at most a value. `grid` fails when one does not hold, so a trial is also a test
  (`tests/engage-scenarios.test.ts` plays the bench's on six seeds). The measures are `winA`, `winB`, `draws`,
  `imbalance` (how far apart the two win rates are), `timeouts`, `decidedSeconds`, `contactSeconds`, `struckA`,
  `struckB`, `firstStrikeA`, `firstStrikeB`, `stalledA` and `stalledB` (`TRIAL_MEASURES`, `src/measure/trial.ts`).

The trials kept:

| Trial | Question | Expects |
| --- | --- | --- |
| `engage-bench` | How fast are battles decided, and do units engage, on each ground, with the army it was drawn for? | the melee army wins the open and the lanes and loses the narrow pass; flyers carry the narrow pass; the mirror is even; a corridor costs time; nearly every unit strikes where the army suits the ground |
| `pick-for-the-ground` | Does the army to field depend on the ground? Six armies against the same mixed one, on five grounds | nothing yet: a reading |
| `army-round-robin` | Does the best army depend on the ground? Seven armies of the factions' units, twelve supply each, every one against every other | nothing yet: a reading |

## 5. Reading a trial

```text
engage-gap2-melee-vs-mix
  variant   A wins           decided  contact  struck A/B  first A/B    stalled A/B  lost A/B           supply A/B
  as built  0%  [0%–14%]     45.2s    5.4s     62%/100%    13.8s/6.3s   4.2/0.0      12.0/4.7 of 12/12   12/12
  as given  100%* [86%–100%] 26.1s*   4.3s     100%/91%    5.0s/6.0s    0.0/0.0      4.0/12.0 of 12/12   12/12
```

| Column | What it is |
| --- | --- |
| A wins | the share of battles side A's army won, and the 95% interval of that share (Wilson's): over 24 battles a 50% is anything from 31% to 69% |
| decided | the median time to a result, over the battles that had one; "ran out of time" counts those that had none |
| contact | the median second of a battle's first strike |
| struck | the share of each army's units that ever struck or shot (a heal is not a strike) |
| first | the median second each army's striking units first struck: how long the back of an army waits |
| stalled | units a battle that stood blocked five seconds or more in one run: queued for good, in all but name |
| lost | units lost a battle, of those fielded |
| supply | what each army cost (section 3) |

A **`*`** marks a win rate or a time that differs from the first variant's, or with `--baseline` from the same
variant before, by more than chance would make it (about 95%); a time must also differ by a twentieth or more, since
seeds that play alike make a small change certain and still not worth a reader's attention. No `*`, no claim.

**Before and after a change** to the kernel, a content file or a map:

```text
grid engage-bench --out before.json        # on the code before
# make the change
grid engage-bench --baseline before.json   # each row beside itself before, marked where it moved
```

Write the before file on the same machine and the same trial; keep it out of the repository unless it is a result kept
for the record, which goes to [`docs/history/measurements/`](../history/measurements/README.md) as a measurement does.

## 6. What trials have found

The last round of troop movement was measured by hand-written arenas; these are the lessons that made this bench, and
what it found when first played. Each was a real answer to a real question.

- **The wrong army for the ground loses by a wide margin, whatever the rule.** Twelve troopers through a gap two rows
  wide lose all 24 battles to the mixed army; a third of them never strike, and the ones that do wait 14 seconds. Half
  of them made flyers win all 24: flyers do not queue (`engage-bench`). The same ridge drawn as slow scrub rather than
  rock (`--terrain "#=scrub"`) lets the troopers through, and they win every battle: the kind of ground decides as much
  as its shape.
- **A measurement must be set up as the game sets it up.** A rule once seemed to cut blocked time by nine tenths: its
  units had stopped trying to move, on maps that gave no side a target. Every map now gives each side a goal, and every
  trial row sets how many units struck beside how many stood stalled.
- **A map that should be even must be checked even.** The mixed army against itself on the gap-six map won 27 battles to
  B's 7: side B's Nexus sat two columns nearer the middle, and both targets missed their Nexus by a column. Rebuilt
  symmetric, the mirror draws every battle, both armies spent. Play a mirror with `--swap` before trusting a new map.
- **A round robin reads breadth.** Seven armies of twelve supply on five grounds (`army-round-robin`): twelve troopers
  lead four grounds, three pikemen and six marksmen lead the narrow pass, and twelve runners beat no army anywhere.
  Tuned to 28 health and 7 damage, the runners lead the open and the corridor: three leaders over five grounds. Two
  leaders is a narrow game; an army that never wins is one a player never needs.
- **A rule change read before and after.** Units that let a target go after a tick instead of 2½ seconds (commitment
  off) decided the two-lanes battle 22% sooner and won all 24 of it rather than 20; the other grounds moved by a
  second and a half or less. Looking for a reachable enemy up to one sight away rather than four changed nothing on
  the bench. Leads to weigh, not verdicts: the bench is twelve units a side, and commitment was kept for what a player sees.

## 7. What a trial cannot say

- **Scripted armies are not players.** A trial's armies stand where a map puts them and march on the enemy Nexus; a
  player builds, picks a stance and answers the last round. A trial says which army does better on this ground, sent
  this way; duels and Mario's own games say more ([`duels.md`](duels.md)).
- **Twelve units a side.** Queues, flanks and crowds grow with numbers; a result on the bench may shrink or grow on the
  Crossing with forty.
- **Supply is part of a price.** Armies compared at equal supply are compared at equal places in the army, not at equal
  credits.
- **Alike units shuffle alike.** An army of one kind of melee unit and one kind of ranged starts the same on every seed;
  its battles differ by the kernel's own draws, which on a symmetric map with the same army are none: a mirror draws.
- **A trial is not the record.** A result kept for the record is a measurement ([`measurement.md`](measurement.md)),
  with its build and its rules; a trial is how a question is asked while working, and its file is how it is asked again.

## 8. Where it is

| Path | What |
| --- | --- |
| `src/scenario/variant.ts` | the variants: `withContent`, `withArmy`, `shuffled`, `mirrored`, `withTerrain`, `withTarget`, `tuned`, `applyVariant` |
| `src/scenario/goals.ts` | `sidesWithoutGoal`, the goal check |
| `src/measure/trial.ts` | playing a trial, its cells, measures, expectations, the summary and the standings |
| `src/cli/trial.ts` | trial files, the command line's variant, `--out` and `--baseline` |
| `tests/trial.test.ts`, `tests/engage-scenarios.test.ts` | the variants and the trial; the bench's expectations |
