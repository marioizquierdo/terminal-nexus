# Terminal Nexus — sandboxes and trials

_What a sandbox is for, what it leaves out and how each absence is handled, the part of a round it can be in, and how a
change to troops is tested before it is believed: which tool answers which question, the loop a change goes through,
the shape of a trial and how to extend each part of it, how to read one, how two builds are compared, the sandboxes
there are, and the principles earlier rounds learned. Every unmarked statement is GUIDANCE._

## 1. What a sandbox is for

**A sandbox is a testing ground, the context of a unit test.** It is a slice of the Grid where units fight each other
or move around obstacles, set up to test one rule, effect, movement or ability in isolation, without the game built
around it: no Nexus power, credits, Build Phase economy, Commander or round count. Place what the question needs,
play one round, read what happened.

**It measures what happens in the slice**: damage, deaths, paths, timings, effects, how units engage. **It does not
measure who wins the game.** The Grid Nexus (its powers, its hand), credits, the Build Phase economy and the whole
battle are the `skirmish` command's to measure (section 12), and the power curve is the measurement's
([`measurement.md`](measurement.md)). A sandbox that needs the Nexus to answer its question is a Skirmish.

A sandbox is a Skirmish save (`sandboxes/`, [`skirmish-saves.md`](skirmish-saves.md)) whose `start` writes the round
by hand, both slots `script:idle`. `grid <save>` and `skirmish --load <save> --play-to next` open the same round.

A game like this is balanced by iteration: a new unit or Commander, a number tuned, a targeting or movement rule, how an
army arranges itself, a new class, a kind of ground. The engine resolves a battle in a fraction of a second with no
terminal, so the cheap way to know whether a change is good is to play it hundreds of times on the same grounds before
and after, read what moved, and watch the few battles that explain it. This page is the shape of that, not a catalogue:
the tool measures a few general things, and a session that needs another measure adds it, the same way the last one did
(section 7). A measure nobody reads any more is deleted.

## 2. Which tool answers which question

| The question | The tool |
| --- | --- |
| What happened in this one battle, tick by tick? | `grid <save> --headless --log-level info`, `--events` for the machine stream (the [`grid` skill](../../.claude/skills/grid/SKILL.md)) |
| Does it look right in motion? | `grid <save>` to watch; the `grid-screenshots` and `playtest` skills for pictures |
| Is this better, how often, how surely, at what cost? | a **trial**: `grid <save> --seeds 1-12 --swap` with a variant, or a trial file |
| What did my change move? | `grid <trial> --against HEAD --profile` |
| Did a refactor change no outcome at all? | `node scripts/profile-routes.ts --out <file>` before and after, then `diff` |
| How does a battle play on from this position, with these players? | a **Skirmish save**: `skirmish --load <save> --p1 script:turtle --p2 script:rush --play-to next`, a round a command, or build actions of your own with `--p1 build:b.json` (section 12) |
| How does it read on screen, round by round? | the **scripted playtest from a save**: `node scripts/playtest.mjs --load saves/crossing-round-4.save.json --keys "..."` (no `--load`: `saves/crossing-new.save.json`); `--p1 script:<profile>` watches both scripts; a playtest note (`!`) opens at its moment with `--note`. Which save shows what is in DEVELOPMENT.md, how to see a change |
| How do whole armies play, with a Build Phase each round? | **Skirmishes headless**: the `skirmish` command, script against script over seeds (`--seeds`), every pairing of Commanders (`--commanders`), or a model a side (section 12); many with `measure run --parts duels` |
| How does the power curve play? | `measure run --spec quick` or `full`, `measure compare` ([`measurement.md`](measurement.md), the [`remeasure` skill](../../.claude/skills/remeasure/SKILL.md)) |
| Must this stay true? | a rule's sandbox and its test ([`testing.md`](testing.md)), or a trial file's `expect` run by a test |

Trials ask about troops: how units move, choose, arrange themselves and fight, on ground chosen to show it. Battles and
measurements ask about the game: what Build Phase choices do over rounds. A change to troops starts with trials and
ends with whatever Skirmishes and battles its `remeasure` row asks for.

## 3. What a slice leaves out

**Any unit or building the game has stands in a sandbox with none of the game around it** (RULE —
`tests/sandbox-spawn.test.ts`). The test loops over every content id the registry holds, each on either side, alone,
against a trooper, among both Nexuses and sent to a target, and requires that it runs without throwing, leaves a
sound state and leaves the same state and event hashes every run. A new unit is covered the moment it exists; one that
breaks in a slice is fixed **in the kernel or match code**, so it handles the absence, and never by teaching the
sandbox format to supply it.

What the game builds around a unit, and what the unit does without it:

| What is absent | What happens | Where |
| --- | --- | --- |
| **Banner** (the stance's rally point) | A side with no target heads for the enemy's Grid Nexus, and with none engages the nearest enemy. A sandbox that wants a banner writes a `target` in a start: that is the banner, mocked as the area the side heads for and holds. A stance's second leg (aggressive: there, then on) is the match layer's (`src/match/banner.ts`) and a sandbox has none. | the kernel reads `targets` (`src/pulse/target.ts`) and never a banner |
| **Own Grid Nexus** | The side's march has no guide line (the band) and its units march from where they stand. A Nexus is only a building here; it is placed like one. | `src/pulse/march.ts` |
| **Enemy Grid Nexus** | Units engage the nearest enemy. With no enemy at all they stand, and the round ends on its ticks, a draw. | `src/pulse/perception.ts` |
| **Commander** | A Commander is a regular troop. A Commander's content id (`unit.citizen.vasse`) is placed like any unit and fights with its own attack and abilities; nothing else needs her on the Grid. | `src/pulse/abilities.ts` reads `commander` for abilities only |
| **Credits** | A bounty or a salvage drop is noted as an event with its credits; the rules between rounds add them up. The kernel never reads credits, so a sandbox earns none and loses nothing. | `src/abilities/`, `src/match/earnings.ts` |
| **Round number, Nexus Pulse, hand, cards** | The kernel has none: the round count, the hand and the cards are the match layer's and the Build Phase's. A sandbox is one round with no hand dealt. | `src/match/` |
| **Lane** | The Grid has none. What the kernel calls a lane (`march.ts`) is a side's guide line, absent without a Nexus. | `src/pulse/march.ts` |
| **A building's wave** | A building spawns nothing by itself: a wave is a recipe the battle gives a building from its army's card (`src/match/training.ts`), and a sandbox gives none, so a Barracks placed in one stands idle. The bench Hatchery has a spawner of its own and does spawn. Whether a sandbox may ask for the card's wave is open: recommended, a start's opt-in, since the default must keep every pinned number. | `src/content/index.ts` (`withProduction`) |
| **A fitted building** (an upgrade or mode, `structure.x+fitting`) | Not placed: only the loader's registry resolves one, and a sandbox's is the fixture registry. | `src/content/fitted.ts` |

A side that fights with nowhere to go (no target, no enemy Nexus) falls back on the nearest enemy wherever it is, a
battle the game never plays. Checked-in sandboxes still give every fighting side a goal (section 11), because a
measurement of a battle the game never plays misleads; a probe in the scratchpad needs none.

## 4. Build Phase or Battle Round

A sandbox says which part of a round it is in, so a unit's state is clear. **The Battle Round is the default**, so
every sandbox keeps its meaning and its pinned numbers.

| `start.phase` | What plays | What a unit and a building do |
| --- | --- | --- |
| `"battle-round"` (absent) | The kernel, from the opening, for `roundTicks` or until the round ends (`src/pulse/`). | Units march, choose, strike, spawn and die; a building shoots or spawns by its content. |
| `"build-phase"` | No kernel: the regroup's walk, `REGROUP_TICKS` long whatever `roundTicks` say (`src/match/regroup.ts`). | Everything stands placed and idle, as the Build Phase finds it between two rounds. What a round's end resets is reset (`freshEntityFields`), a building that `mends` mends, and a unit with an enemy within reach steps back toward its own Nexus and forms up. Nothing attacks, trains, spawns or burns. A side with neither Commander nor Nexus has no line to form on, and its units stand. |

`playPhase` (`src/skirmish/opening/phase.ts`) plays either, and `playSandboxRound`, `grid`'s watch and every measurement
play a sandbox through it, so one file reads the same through each door. The Build Phase run has no events but who is
placed where, so a test reads its states. A ghost (the building armed on the Build Phase's map) is the screen's and is
not state: the Build Phase sandbox shows the placed building. A trial plays battles and refuses a sandbox in the Build
Phase; `sandboxes/rules/build-phase-between-rounds.save.json` shows the difference, and `tests/sandbox-phase.test.ts`
holds each row of the table.

## 5. The loop

1. **Write the question**, and what would answer it: "units at a narrow pass change target less, and battles are not
   slower".
2. **Pick the bench**: a trial file that asks something close (`grid engage-bench`), or a map with a variant. A new map
   only for a new shape of ground.
3. **Make the change and compare** with the reference: `grid engage-bench --against HEAD --profile --jobs 4` plays the
   working tree beside the last commit.
4. **Read every table**, not only who won, and only the rows marked `*` as changed. A rule can win the same and cost four
   times the work, or stall fewer units by leaving them idle.
5. **Watch the battles worth watching** by the command the summary prints for each. A number says something happens;
   one battle watched says why.
6. **Keep what is worth asking again**: a trial file with what it expects, run by a test; the numbers in the pull request.

Recipes by kind of change, as starting points:

- **A unit's numbers**: `--tune <unit>.<field>=<n>` on the trials it fights in; then `--against HEAD` once written.
- **A new unit**: put it in an army, `--army-a trooper:6,<unit>:6` or `--set A.marksman=<unit>`; does its army win, and
  do its units ever reach the fight (struck, first strike)? Its slice test is already written (section 3).
- **A targeting or movement rule**: the bench `--against HEAD --profile`; engagement and cost first, outcomes should
  move only on purpose; then the quick spec's battles.
- **How an army arranges itself**: mixed armies in several orders with `--army-a`; when the back of the army first
  strikes; `measure formations` for armies leaving their buildings.
- **A kind of ground**: `--terrain "#=scrub"` on the bench, or a new map of the shape.
- **A refactor**: fingerprints before and after; no line may differ.

## 6. The shape of a trial

```text
sandbox ─variant─▶ map for one battle ──engine──▶ states and events ──record──▶ battle record
 (sandboxes/) (pure) (shuffled, mirrored)  (kernel and content,        (BattleRecorder:      │
                                                this build or another)      the same for battles)  │
                                                         ▲                                       ▼
                                                     meter: cost                  cells (map × variant): stats, marks
                                                  (clock, route work)                 │                │
                                                                              summary tables     expectations
                                                                              battles worth watching
```

| Part | Where | What it is |
| --- | --- | --- |
| Sandbox | `sandboxes/**/*.save.json`, `src/skirmish/sandboxes.ts`, `src/skirmish/start.ts` | the ground, the armies, each side's target, as a Skirmish save's `start` ([`skirmish-saves.md`](skirmish-saves.md)); found by id, opened by `openBattle` (`src/skirmish/opening/open.ts`) and played by `playSandboxRound` (`src/skirmish/sandbox-round.ts`), the one path `grid`, the `skirmish` command and the measurement share |
| Variant | `src/skirmish/opening/variant.ts` | a pure function of a map and its content to another: a unit, an army, a tune, a terrain, a target; and `shuffled` and `mirrored`, which make each seed's opening |
| Trial | `src/measure/trial.ts` | the spec (maps, seeds, variants, expectations), its runs in order, each played by an `Engine` and timed by a `Meter`, both passed in |
| Engine | `src/cli/engine.ts` | the kernel, content and opening (`openBattle`) of a build's folder: this one, or another commit's checked out beside it |
| Record | `src/measure/battle.ts` | one battle in numbers, built from its states and events alone, the same for a trial, a battle and a mission |
| Cells | `src/measure/trial-cells.ts` | each map and variant's battles summed up: shares with intervals, medians, whether two differ beyond chance, expectations, battles worth watching |
| Summary | `src/measure/trial-summary.ts` | the printed tables and the command that replays a battle |
| Command | `src/cli/trial.ts`, `src/cli/trial-worker.ts`, `src/cli/profile.ts` | trial files and options, processes, `--against`, the clock and route counts |

Two things hold it together. **Nothing touches the kernel**: a variant is a different opening played by the same rules,
a record reads what the kernel already emits, and a profile wraps a class from outside, so a trial can never make a
battle differ from the game's. **Everything but the command is pure**: the same trial plays the same battles on every
machine, in one process or many, which is what lets two builds be compared at all.

## 7. Extending it

Extend the tool when a question needs a number the summary does not show; a one-off probe in the scratchpad is fine for
a question asked once, and a probe written twice belongs in the tool.

- **A measure** (a count a battle should report): add an optional field to `SideRecord` and count it in
  `BattleRecorder.observe` from the tick's events and state (`src/measure/battle.ts`); sum it in `armyCell`
  (`trial-cells.ts`); give it a name in `TRIAL_MEASURES` if a trial may expect it; add a column in `trialLines`
  (`trial-summary.ts`); and, if battles should show it, a phrase in `src/measure/summary.ts`. A record written before has
  no such field, so read it as absent, not zero. If no event says what you need, an event is declared in the kernel
  first (`src/events/types.ts`): that is a kernel change, with its own tests.
- **A variant** (another way to change a map): a pure function in `variant.ts`, a field of `Variant` applied in
  `applyVariant`, a command-line option in `variantFromArgs` and `VARIANT_OPTIONS` (`src/cli/trial.ts`), and its flags
  in `variantFlags` (`trial-summary.ts`) so a battle worth watching can be replayed with it. `tests/trial.test.ts` checks
  that variants compose with mirroring and shuffling.
- **A cost** (work the kernel does): wrap the class that does it in `routeCounter` (`src/cli/profile.ts`), add its count
  to `BattleCost` and `CostCell`. Counts the same on every machine are worth more than times.
- **A trial file**: `sandboxes/trials/<id>.trial.json` (section 8), naming the sandboxes it plays. Give it `expect` and a test runs it.

## 8. Trials and trial files

`grid --help` lists every option a trial and a variant take; the variant options work on every `grid` action, so
`grid <save> --seed 7 --swap --army-a ...` watches the battle a trial pointed at. What the help leaves unsaid:

- **Seeds**: twelve from both ends for a question, three for a look.
- **`--swap`** plays each seed again with the map mirrored end for end and the sides swapped; rows name sides by army,
  so what an end gives cancels out. Always, for which army is better.
- **`--shuffle`** swaps each side's units among the places of units of their size and formation line, by the seed.
- **`--jobs 4`** plays the same battles in four processes, merged in order.
- **`--against <ref>`, `--baseline <file>`, `--out <file>`, `--json`**: section 10; `--json` prints the cells as data.

```text
grid engage-gap2-melee-vs-mix --seeds 1-12 --swap --shuffle --army-a trooper:6,skyraider:6
grid engage-bench                                    # a trial file; fails when what it expects does not hold
grid engage-bench --against HEAD --profile --jobs 4  # the working tree beside the last commit, with what a tick cost
```

A trial file keeps a question:

```json
{
  "id": "engage-bench",
  "question": "How fast are battles decided, and do units engage, on each ground?",
  "notes": "What it is for and how it is set up, for a person.",
  "maps": ["engage-open-melee-vs-mix", "engage-gap2-melee-vs-mix"],
  "seeds": "1-12", "swap": true, "shuffle": true,
  "base": { "tune": { "trooper.maxHp": 50 } },
  "variants": { "as built": {}, "air mix": { "army": { "A": "trooper:6,skyraider:6" } } },
  "expect": [{ "map": "engage-gap2-melee-vs-mix", "variant": "as built", "measure": "winB", "atLeast": 0.9 }]
}
```

`variants` are played in order and each row is marked against the first (none: the maps as built). `base` is what
every variant starts from, and variant options on the command line go on top of it. `expect` names a measure from
`TRIAL_MEASURES` and a bound; `grid` fails when one does not hold, and `tests/engage-bench.test.ts` runs the bench's.

## 9. Reading a trial

```text
engage-gap2-melee-vs-mix
  outcome     A wins            decided  contact  lost A/B           supply A/B
  as built    0%  [0%–14%]      44.2s    5.4s     12.0/4.8 of 12/12  12/12
  engagement  struck A/B  first A/B    idle A/B  stalled A/B  switches A/B
  as built    67%/100%    12.6s/6.3s   0.0/0.0   5.0/0.2      2.8/1.2
  cost        ms/tick   fields/tick  settled/tick
  as built    0.518     9.8          489
```

- **Outcome**: the share side A's army won with its 95% interval (Wilson's: over 24 battles a 50% is anything from 31%
  to 69%); the median time to a result over battles that had one; the first strike; units lost; the supply each army
  took, the game's own price of a unit. Compare armies at equal supply.
- **Engagement**: the share of each army that ever struck, and the median second it first did (how long the back of an
  army waits); units **idle** (five seconds neither moving, striking nor blocked: standing at a target or holding a line,
  or given nothing to do) and **stalled** (five seconds blocked: trying, in vain), a battle; target **switches** a unit
  (a new target while the old one stood).
- **Cost** (`--profile`): milliseconds a tick are the machine's and its load's (compare them on one machine, at one
  `--jobs`); fields built and anchors settled a tick are the kernel's route work and **the same on every machine**, so they
  compare two algorithms.
- **Marks**: a `*` is a difference from the row compared with beyond chance (about 95%); a time or a cost must also move
  by a twentieth. No `*`, no claim.
- **Worth watching**: for each map and variant, the upset, the slowest battle and the most stalled, when one stands out,
  each with the command that replays it exactly (`tests/trial.test.ts` holds it to that).

## 10. Comparing two builds

- **`--against <ref>`**: the trial is played by that commit's kernel and content as well, in a temporary worktree removed
  after; the maps, trial and record are the working tree's, so both are asked the same question. `--against HEAD`
  compares uncommitted work with the last commit, `--against origin/main` a branch with main.
- **`--out` then `--baseline`**: the same by a file written before, when the change spans commits.
- **Fingerprints** (`scripts/profile-routes.ts --out`): every map's and some battles' event and state hashes; a refactor's
  proof is no line differing. `--detail` says where route time went, question by question.
- **Battles and missions**: `measure run ... --out`, then `measure compare`.

## 11. The sandboxes

| Folder | What its sandboxes are for |
| --- | --- |
| `sandboxes/rules/` | one rule each, as small as shows it |
| `sandboxes/units/` | one unit's mechanic each, the proving grounds |
| `sandboxes/movement/` | one shape a route must manage each |
| `sandboxes/engage/` | **the bench**: twelve units a side on six grounds (open, gaps of six and two rows, a corridor, two lanes), each side's target the enemy Nexus, exactly symmetric |
| `sandboxes/showcase/` | whole battles to look at |
| `sandboxes/trials/` | trial files |

A sandbox's id is its file name, and every command finds one by it (RULE — `sandboxCatalog`). **Every side that fights has
somewhere to go**, its own target or an enemy Nexus, as in every battle the game plays (RULE — `sidesWithoutGoal`,
`tests/sandboxes.test.ts`); a sandbox in the Build Phase has no fighting side and needs none. A new sandbox for the bench
is drawn at 48 by 16, mirrored exactly, each side's target the enemy Nexus, and checked even before anything is read on
it: the same army on both sides, `--swap`, a dozen seeds. To write one, see the [`grid` skill](../../.claude/skills/grid/SKILL.md).

## 12. Testing through Skirmishes

**A Skirmish played headless is the one the screen plays** (RULE — `src/skirmish/play.ts`, `tests/skirmish-save.test.ts`):
the `skirmish` command and the game's screen open a battle by the same steps and play every round through `playNext`,
so the same save, seed and build actions give the same battle, hash for hash, on Node and Bun. The command's manual is the
comment it opens with ([`src/cli/skirmish.ts`](../../src/cli/skirmish.ts), `npm run skirmish -- --help`); this section
is how each kind of test uses it, cheapest first. The battle it plays, the brief and the build actions are [`battles.md`](battles.md);
the save file is [`skirmish-saves.md`](skirmish-saves.md).

**A rule or a unit, in one Battle Round**: a sandbox (section 11) plays its round and prints `grid`'s report.

```bash
npm run skirmish -- --load sandboxes/rules/melee-kill.save.json --play-to next
grid melee-kill --headless --log-level info             # the same round, tick by tick
```

**Script against script**, a round at a time or to the end, with the battle's log and every round kept to read back:

```bash
npm run skirmish -- --map crossing --p1 script:agro --p2 script:defensive --play-to end \
  --log .playtest/battle.log --log-level info --out .playtest/rounds
```

**Many seeds and a tally**: one new battle a seed, a line each, then who won how often and how (`--seeds 1-20`). Swap
the slots' scripts and play again before reading a side into it: the two ends are mirrors, a seed's hands are not.

```bash
npm run skirmish -- --map pocket --p1 script:steady --p2 script:agro --play-to end --seeds 1-20
```

**Every pairing of Commanders**, each from both ends of the map, once a seed, after a change to an army, a power or an
ability. Read a pairing across both sides; a sweep under one script is a lead to explain from a battle's report, not a
result.

```bash
npm run skirmish -- --map crossing --p1 script:steady --p2 script:steady --commanders all --seeds 1-6 --rounds 8 --play-to end
```

How tight an army fights (`rush-block` against `rush-apart`) and the power curve over many battles are the measurement's
(`measure run --parts duels --formations block,apart`, [`measurement.md`](measurement.md)).

**Build actions of your own, round by round**, as an agent plays: the brief, a build file written from it, the build
actions checked (exit 2 when the rules refuse part of them, each refusal with its reason), then played and saved over
the file, the next brief printed.

```bash
cp saves/crossing-round-4.save.json tmp/s.json
npm run skirmish -- -f tmp/s.json                                    # p1's brief
npm run skirmish -- -f tmp/s.json --p1 build:tmp/b.json              # checked, nothing built
npm run skirmish -- -f tmp/s.json --p1 build:tmp/b.json --play-to next
```

**Several rounds written ahead**: a build file is a list of entries by round (`"round": 3`, `"2-4"`, `"*"`, the first
that fits winning), and those rounds play blind, with no brief between them. A test pins an opening this way, or plays
a fixed plan to the end against a script; the battle stops at the first round the file has no entry for and prints
the brief.

```bash
npm run skirmish -- --map pocket --p1 build:tmp/rounds.json --p2 script:agro --play-to end
```

**A person's save played on**: copy Mario's save and play it with scripts in both slots (`--p1 script:turtle --p2
script:rush --play-to next`), or change its `draft` to try other build actions; `--out` keeps every round as a save of
its own to compare, copy and play on.

**Model against model**: there are no turns, so the session running the test is the table. Make the save with both
slots players; each round, `npm run skirmish -- -f <file>` prints both slots' briefs, the session hands each brief to
its agent (one small model a slot, continued round to round so it keeps what it learned), each answers with one JSON
object of build actions, and `npm run skirmish -- -f <file> --p1 build:<p1 file> --p2 build:<p2 file> --play-to next`
plays the round and prints the next briefs. Either slot may also hand its actions in alone (`-f <file> --p1
build:<file>`, kept as the save's draft) and the other's later with `--play-to next`: the order never matters, since
both read the same brief. Tell each agent to answer with the JSON only and run nothing: small agents wander. A
six-round battle costs some 75 thousand tokens of a small model a slot. `--load <file>` afterwards prints every
round's report.

```bash
npm run skirmish -- --map crossing --p1-commander averno --p2-commander dob --p1 build: --p2 build: --seed 11 --save .playtest/m1.save.json
```

**A battle set up for a person**: every save the command writes at a Build Phase opens on the game's screen
(`./bin/terminal-nexus.ts --load <file>`, which the command prints), so an agent can prepare the moment to play — a
round reached by scripts, a script for the opponent — and hand Mario one line.

**On screen, by keys**: the scripted playtest opens a save (`node scripts/playtest.mjs --load <save>`; told nowhere,
`saves/crossing-new.save.json`) and returns every screen as text, the title menu and the setup screen included;
`--p1 script:<profile>` watches two scripts. **An agent playing a whole Skirmish first** (Milestone 20) writes a
player's diary before a person is asked. **A person** plays last: Skirmish on the title menu, `--load <save>`, or the
browser page, and `!` saves the moment as a note that opens again where it was (`--note <file>`).

**What these games are and are not.** A scripted or small-model player is not a good player: it shows what an army
does in the hands of a plain plan, where its strengths come from, and where the rules or the brief let a player down.
It does not show balance. Read the numbers for direction, the reports for why, and say so every time.

## 13. Principles

- **Set a battle up as the game sets it up.** A rule once seemed to cut blocked time by nine tenths: its units had
  stopped trying, on maps that gave no side a target. Hence the goal rule, and idle units counted beside stalled ones.
- **Check a map even before trusting it.** A bench drawn as mirrors gave one end 27 battles to 7: a Nexus placed by its
  corner. A mirror match from both ends shows it.
- **Vary the opening and play enough.** One layout turns on tie draws alone; both ends and a dozen seeds before a few
  percent means anything.
- **Read the whole row.** Better metrics find more problems: the first count of target switches found units at a narrow
  pass changing target every tick, at four times the route work, while their win rate gave no sign of it.
- **Watch one battle** before believing a number that moved a lot.
- **Scripted armies are not players**, and twelve units a side are not forty: confirm on battles and in the owner's games.
