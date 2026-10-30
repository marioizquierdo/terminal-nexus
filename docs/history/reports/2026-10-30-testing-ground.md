# The testing ground — 2026-10-30

_Mario asked for a benchmark and testing ground to try new units, buildings, formations and terrain, a spec for it, a
better `grid` for configuring and reading trials, the scenario folders reorganised and the legacy maps removed. This is
what was built and what the first trials found. The design is [the testing ground](../../system-design/testing-ground.md)._

## What was built

- **The maps in folders by purpose**: `rules/`, `units/`, `movement/`, `engage/` (the bench), `showcase/`, and
  `trials/` for trial files. A map is found by its id wherever it sits (`grid melee-kill`).
- **Five maps retired**, each covered by another or by a trial: the speed parade (a demo whose timing drifted under a
  test twice), the Ravel mirror skirmish and the sniper crossfire (nothing read them), obstacle routing (the route
  scenarios' dead end and pocket show it better), and trooper against marksman (a matchup a trial now plays on any ground).
- **Every side that fights has somewhere to go.** Thirty-nine maps gave a side neither a target nor an enemy Nexus,
  a battle the game never plays. Each such side now heads for where the enemy starts, and a test refuses a map without
  a goal. Four pinned battles moved and were re-pinned with reasons (the Aid Station, the bench medic, the bomber, the
  mortar); three fixtures were re-laid to keep showing their rule as the game would play it: the ram's bench puts the
  barracks, its side's target, in its sight; Vasse herself is the raid's target in her aura's scene; Dob's bounty plays
  on a seed where his dice come up.
- **Trials** in `grid`: a map over many seeds, from both ends (`--swap`), its units shuffled within their formation
  line (`--shuffle`), as built beside a variant the options make (`--set`, `--army-a`, `--tune`, `--terrain`,
  `--target-a`); a summary of win rate with its interval, time to a result, first contact, the share of each army that
  ever struck and how soon, units stalled and lost, and each army's supply; a `*` where a difference is beyond chance.
  Trial files hold the questions worth asking again, with what they expect, and a round robin of armies; `--out` and
  `--baseline` compare a trial before and after a change. About ten battles a second.

## What the first trials found

| Trial | Finding |
| --- | --- |
| The mirror check | The mixed army against itself on the gap-six map won 27 battles to 7: side B's Nexus stood two columns nearer the middle and both targets missed their Nexus by a column, on all six engage maps. Rebuilt symmetric, the mirror draws every battle. |
| `engage-bench` | On the rebuilt maps: twelve troopers win open ground in 29 seconds and every unit strikes; they lose every battle at the two-row gap, a third never striking; half of them flyers win every one there; a corridor costs 40 seconds against 29. |
| Ground type | The two-row ridge drawn as slow scrub instead of rock: the troopers go from losing every battle to winning every one. |
| `pick-for-the-ground` | Against the same mixed army at twelve supply, the pike army and the air mix win on every ground; all marksmen, and the runner swarm, lose on every ground. |
| `army-round-robin` | Seven armies of the factions' units, every one against every other: twelve troopers lead four grounds, pikes the two-row gap; twelve runners beat no army anywhere. Runners tuned to 28 health and 7 damage lead the open and the corridor: three leaders over five grounds. |
| Commitment off, `--baseline` | Letting a target go after a tick rather than 2½ seconds decides the two-lanes battle 22% sooner and wins all 24 rather than 20; the other grounds move by a second and a half or less. A lead to weigh, not a verdict. |
| Search one sight, `--baseline` | Looking up to one sight away for a reachable enemy rather than four changes nothing on the bench. |

## The second round: the tools themselves

Mario, on the same pull request: the testing ground is not for finding the best army but for testing changes, and
every change to come (a unit, a Commander, a targeting or movement algorithm, how an army arranges itself, a class)
will need it; look back at how sessions tested things and improve the tools. Looking back, the troop movement rounds
had rebuilt the same scratch scripts several times over: an arena of grounds and armies with an aggregation script,
a worktree and an environment switch per rule variant, a script following each stall to the head of its queue, one
counting target changes, loops over seeds, a wrapped kernel for timing. What was built from them:

- **A battle's record** now counts idle units (standing five seconds neither moving, striking nor blocked: the flaw
  that once made a rule look good), target switches (a new target while the old one stood), and what each stall's
  queue ended at. Duels' and campaign levels' summaries show the first two.
- **`--profile`**: what a tick cost, by the clock and by the kernel's route work (fields built, anchors settled, route
  questions), the counts the same on every machine; where route time went, question by question.
  `scripts/profile-routes.ts` shares the one profiler.
- **`--against <ref>`**: the same trial played by another commit's kernel and content, each row beside it. **`--jobs`**:
  a trial across processes, the same battles merged in order.
- **Worth watching**: each summary ends with the upsets, the slowest, the most stalled and the most switching battles,
  each with the command that replays that very battle.
- **The trial code in three parts** (playing, what the battles say, the printed tables), the engine and the clock
  passed in rather than reached for.
- **The spec rewritten as a playbook**: which tool answers which question, the loop a change goes through, a recipe for
  each kind of change, every measure and its expectation name, and the table of what was done by hand.

The first look at the new counts found units at a two-row gap switching targets 67 times each a battle, against none
on open ground, and building 9.3 distance fields a tick against 2.3: a unit whose target is walled in picks another
walled-in one, then the first again, every tick. Measured with `--against HEAD`, letting go only when another enemy can
be reached cut switches at the gap from 69 a unit to 2.8 and in the corridor from 15 to 1.5, with no outcome moving
beyond chance and every expectation of the bench holding. It changes how units choose, so it waits for the owner.

## Left for later

- Trials play in one process; the round robin takes a minute and a half. Splitting one across processes, as `measure
  --jobs` does, is the next speed-up if trials grow.
- Supply is the trial's price of an army; buildings and cards cost credits a fixed map does not spend.
- A shuffle of alike units changes nothing: an army of one melee and one ranged unit plays the same opening on every
  seed. A jitter of a tile, or several layouts a map, would vary it more.
- The kernel's constants (commitment, search, vision's default) are tried by editing the code and comparing with
  `--baseline`; a trial cannot set them, by design: a rule is code, and a trial is a different opening by the same rules.
