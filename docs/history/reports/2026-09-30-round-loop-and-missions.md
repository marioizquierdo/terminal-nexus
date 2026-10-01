# Gate report — Milestone 6, Gate 6B: The loop and the trigger runner

---

## 1. Frame — written before coding

- **Canon version:** 2.30 (no change planned; canon proposals go to Section 9 and wait for acceptance).
- **Milestone and gate:** Milestone 6 — Nexus Pulse Phase, gate 6B, "The loop and the trigger runner's
  simulation band" (`docs/milestones/milestone-06-pulse-phase.md`). Active since 2026-09-30, when Mario
  accepted gate 6A.
- **Question this gate answers:** after Recall, does the player land in the next Build Phase with what
  survived — and does a mission, written as data, decide what each Pulse brings and when the whole
  thing is won or lost, on the unmodified kernel, hash-stable across runs and runtimes?
- **Smallest artifact that can answer it:**
  - **A mission as data** (`src/mission/`): named regions and a trigger list — a condition and a list of
    actions — with the simulation band at the size PERIMETER needs: `spawn` (units at a region, with a
    group name, an order and an optional line of intention), `order`, `commitPlan` (the raid's own
    structures for a Pulse), `win`, `lose`. Conditions: a moment in a Pulse (`{ pulse, tick }`), a Pulse's
    end, a side's Nexus destroyed. Validated when loaded: every reference, every range, and that the
    mission always ends.
  - **A trigger runner** (`src/match/`), beside the kernel: builds a Pulse's opening state from what the
    last Pulse left (after Recall), the new plan and the tick-0 actions; steps the kernel's own
    `stepTick` and applies a later `spawn` between ticks with the kernel's own conventions and events;
    then reads the Pulse-end triggers for the mission's verdict — continue, won or lost.
  - **The loop on screen**: after the result, `[enter] Next round` (or, as an Experiment, on its own) opens
    Build Phase 2 on what survived — the player's buildings and units where Recall put them, the raid's
    leftovers where they stood, the unspent credits — and the round's Battle Round screen says what the
    mission wrote for it. The last round's result says whether the mission was won or lost.
  - **PERIMETER's three waves** on the Build Phase's map, replacing the placeholder Pulse and its Raid and
    Your units Experiments.
  - **The start of intentions** (the owner's direction at 6A's acceptance): the next Pulse's arrivals are
    shown on the map during the Build Phase, and a spawned group may carry a line of intention the
    Explore Map card reads. On/off as an Experiment.
- **Automated evidence planned:**
  - the kernel is unchanged: `git diff origin/main -- src/pulse src/state src/scenario src/grid
    src/content/types.ts src/events src/rng` is empty;
  - validation refuses, by name, every broken mission shape (unknown region, unit or structure, a
    `spawn` at a Pulse's end, a tick past the Pulse, a Pulse past the mission, duplicate ids, an order
    for a group nobody spawned, an order the kernel cannot carry out, a last Pulse that decides nothing);
  - a whole mission resolved twice, and on Node and Bun, gives the same state and event hashes per Pulse;
    resolving tick by tick equals the runner; the cosmetic seed and every Experiment but the plan change
    nothing about state;
  - a mid-Pulse spawn appears at its tick with the kernel's own `entity.spawned` event, and counts for
    victory;
  - the carried state: survivors keep their health and ids, destroyed buildings stay gone, a building
    planned on a unit moves the unit aside;
  - the three endings a mission can have reachable from PERIMETER's own data (won, lost on a fallen
    Nexus, and a round lost but the mission going on);
  - keyboard, mouse and a driver play a round into the next Build Phase identically; Restart restarts
    the mission;
  - `tests/architecture.test.ts`: the Build Phase and the view still never reach the kernel.
- **Human observation planned:** Mario plays PERIMETER through, flips **Next round** and **Incoming
  wave**, pastes his export, and says whether the loop reads without being told.
- **Explicit exclusions:** automatic production (6C); the presentation band (`focus`, `card`, `say`,
  `bark` — Milestone 9); a real opponent policy; PERIMETER's own map (Q38); an order the kernel can carry
  out other than "engage the nearest enemy"; saving a mission; any kernel change.
- **Stop conditions:** a wave cannot arrive, or the verdict cannot be decided, without changing
  `src/pulse` (a finding, and the gate stops there); a clock or unseeded randomness enters `src/mission`
  or `src/match`; keyboard, mouse and driver stop landing in the same next Build Phase.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux 6.18 (x86-64 container) |
| Runtime and exact version | Node v22.22.0; Bun 1.3.14 |
| Dependencies and exact versions | from `package-lock.json` (`npm ci`), unchanged by this gate: TypeScript 7.0.2, `@opentui/core` 0.5.6, `gifenc` 1.0.3, `pngjs` 7.0.0, `@types/node` 22.20.1 |
| Hardware, if it affects measurements | container CPU; timings below are indicative only |
| Date measured | 2026-09-30 |

Commands, copy-pasteable, in the order a stranger would run them:

```bash
# install
npm ci
# test
npm run typecheck && npm test && npm run test:bun && ./scripts/check-repository.sh
# the kernel is untouched
git diff origin/main --stat -- src/pulse src/state src/scenario src/grid src/content/types.ts src/events src/rng src/report
# run: PERIMETER, round 1
./bin/terminal-nexus.ts --spike
# a round played by keys, then Enter into round 2
node scripts/playtest.mjs --keys "n 1 3 click:24,8 click:24,8 3 click:22,7 click:22,7 2 click:21,13 click:21,13 s s wait~20000 wait~20000 Enter" --print final
# the pictures
node scripts/capture-spike-screenshots.mjs --only mission-round-2
```

Baseline before this gate (the merged gate 6A and menu spike): typecheck clean, Node 791 / 791.

## 3. What was built

**What a player does and sees.** The screen plays PERIMETER, three rounds. Round 1 opens with the
Build Phase's top bar saying `build phase - round 1 of 3`, and on the map, see-through, the player's two
squads beside the Nexus and the raid's probe north of the ridge — the round's arrivals, where they will
stand. Explore Map over a raider reads "Runner — Incoming — Probe the line at the ridge. — ARRIVES as the
round starts". The Battle Round screen says the mission's words for the round ("A hostile force is
inbound from the ridge. Hold the perimeter."). The Pulse plays as in 6A; its result says the fight first
(`VICTORY — The raid was wiped out.`), then "Round 1 of 3 is over. The Nexus stands.", and the row where
Pause was is `[enter] Next round`. Enter (or Space, `n`, a click) opens **Build Phase 2**: the Turrets
and the Hatchery the player built stand, the survivors are home, the credits not spent carry over (a new
Nexus power is dealt), the second wave waits at the ridge, and the bottom line says "Round 1: victory.
Build Phase 2 - the Nexus stands." Round 3 brings the raid's own camp (a den north of the ridge) and a
reserve seven seconds in from the east. Its result is the mission's: **MISSION COMPLETE — The perimeter
held.** or **MISSION FAILED — The Nexus fell.**, with the last fight's words under it, and `[enter] Play
again`. Restart, from the game menu, is the mission from round 1.

**The pieces, by layer.**

- **`src/mission/` — a mission as data, new.** `types.ts`: regions; triggers `{ id, when, do }` with three
  conditions (a moment `{ pulse, tick }`, `{ event: "pulse.end" }`, `{ event: "nexus.destroyed", side }`)
  and the simulation band — `spawn` (units, a region, a group, an order, an intention), `order`,
  `commitPlan`, `win`, `lose` — in the shapes of campaigns.md's own sketch; a mission never contains a
  function. `validate.ts`: every problem at once, by name — unknown regions, units and structures, a
  structure spawned or a unit planned, counts, ticks and Pulses out of range, duplicate ids, an order for a
  group nobody spawned or before it arrives, an order the kernel cannot carry out, a win at a moment, a
  plan off tick 0 or off the map, a region off the map, round text for a round that is not there, and a
  last Pulse whose end decides nothing. `perimeter.ts`: the fixture. Pure data; the architecture test
  keeps it from ever reaching the kernel, the rules layer, the view, the shell or the Build Phase.
- **`src/match/mission.ts` — the trigger runner, new.** `missionOpening`: the carried state, the
  player's new structures, the scripted side's `commitPlan` and the tick-0 arrivals, through
  `openingState`. `resolveMissionPulse`: the unmodified `stepTick`, tick by tick; a later `spawn` is
  applied between two ticks with the kernel's own conventions and its own `entity.spawned` event, and the
  kernel's roster (what each side has fielded, which the victory check reads) is widened by the arrival;
  at the end, the Pulse-end triggers in list order give the verdict. `laterArrivals`: the forecast of
  later arrivals for the Build Phase. `openingState` (`src/match/opening.ts`) now takes a `carried`
  state: everything in it keeps its ordinal, id and health; new things get ordinals from where the last
  Pulse stopped; a unit on a tile the plan builds on steps to the nearest free tile.
- **`src/cli/pulse-run.ts` — the shell's connection, rewritten.** `missionPlay(mission)` gives the three
  functions the screen needs: `firstRound` (validates the mission against the map, adds the round, the
  round text and the forecast), `startPulse` (the runner, a timeline, Recall, the verdict) and
  `nextRound` (a new context from Recall's state: the player's structures as standing, every other entity
  as the field, the credits left as the allotment, the next forecast, the opening line). `SPIKE_MISSION`
  is PERIMETER. The placeholder `spikePulse`, its seed and length constants and `BuildContext.pulse` are
  gone.
- **`src/build/` — the session swaps rounds; the reducer barely knows.** `BuildContext` gained `round`,
  `carried`, `field`, `incoming` and `openingStatus`; `claimedTiles` counts the raid's structures;
  `createBuildState` reads the round's number. `BuildSession` gained `nextRound` and a `next-round`
  command, handled like `pulse` — never by the reducer — which only acts once the result stands and
  swaps in the next context (or round 1's, for Play again and Restart). The keyboard and mouse adapters
  send it from the result (Enter, Space, `n`, the row). The cards read field units and incoming ones
  (`fieldCard`, `incomingCard`), in their side's colour; `src/content/cards.ts` has words for the units on
  the map now.
- **`src/view/` — the loop drawn.** `missionResultOf` (`ending.ts`): the fight's words, the mission's
  line and the row's label; `MISSION COMPLETE`/`FAILED` when a trigger ended it. The Pulse panel draws the
  mission line and `[enter] Next round` / `Play again`. `drawGrid` draws the field and the incoming wave
  (dim, faded, yielding to buildings). The top bar counts rounds. `PulsePresenter` can send `next-round`
  on its own (the Next round Experiment) and keeps the frame timer running until it does.
- **Experiments.** **Next round** (key / auto; first guess key) and **Incoming wave** (shown / hidden;
  first guess shown), in a section "THE MISSION". **Raid** and **Your units** are deleted; an old export
  that names them reads back quietly as retired names.
- **Tooling.** Six 6B stills and a GIF (`scripts/capture-spike-screenshots.mjs`); the 6A Pulse shots stay
  as that gate's evidence. `DEVELOPMENT.md` and the playtest skill describe the mission and its key
  scripts. `docs/game-design/scripted-opponent.md` — the owner's "start thinking about it": waves, intentions, and
  where the Campaign's opponent AI grows from.

## 4. Automated results

| Check | Result |
| --- | --- |
| `npm run typecheck` (both configs) | clean |
| `npm test` (Node 22.22.0) | **811 / 811** (791 before; 20 new: `tests/mission.test.ts` 12, `tests/mission-loop.test.ts` 7, architecture 1; the 6A Pulse tests rewritten onto a test mission) |
| `npm run test:bun` (Bun 1.3.14) | all test files pass |
| `./scripts/check-repository.sh` | passes; canon 2.30; gate 6B |
| Kernel untouched | `git diff origin/main --stat -- src/pulse src/state src/scenario src/grid src/content/types.ts src/events src/rng src/report` prints nothing |
| 6A's Pulse, as a mission | gate 6A's placeholder written as a test mission (same forces, muster points, seed, length) resolves through the runner to **gate 6A's own pinned hashes** — state `9b03136f…`, events `93638c7e…`, 175 ticks (`tests/pulse-run.test.ts`) |
| A whole mission, twice and on two runtimes | PERIMETER with the strong plan, round by round: `104bc24a…`/`5ae0cfec…` (139 ticks, continue), `6278de90…`/`23dc5e35…` (95, continue), `4693d588…`/`fa44569f…` (360, won) — **identical under Node and Bun**, and five repeat runs agree |
| Runner equals the kernel | a round with nothing arriving after tick 0 gives the same final state and the same event list as `resolvePulse` on its opening state |
| Cost | starting a round (runner, timeline, Recall): median 12.6 ms Node, 14.9 ms Bun, worst about 50 ms cold; opening the next round (context and forecast): 0.2 ms |

**PERIMETER's outcomes, measured against scripted plans** (Reserve Fund each round unless the War Chest
is named; `tests/mission.test.ts` and a probe script):

| Plan | Round 1 | Round 2 | Round 3 | Mission |
| --- | --- | --- | --- | --- |
| nothing built | squads win (annihilation, 11.6 s) | squads wiped out at 5.3 s — the round stops, raid at the gate | Nexus destroyed at 25.8 s | **lost** (`fallen`) |
| one Turret, round 1 | win | lost (squads wiped out) | Nexus destroyed | **lost** |
| a Turret each round | win | lost | Nexus destroyed at 29.4 s | **lost** |
| two Turrets and a Hatchery, then a Turret each round | win | lost at 7.9 s (the flank arrives) | time runs out, Nexus at 256 / 400 | **won** (`hold`) |

**New tests, by what they prove.** `tests/mission.test.ts`: PERIMETER validates; seventeen broken shapes
each refused by name, and every problem reported at once; a whole mission hashes the same five times; a
round with nothing later equals `resolvePulse`; a later arrival comes at its tick with the kernel's spawn
event and fresh ordinals and acts from the next; an arrival counts for victory (a side that only arrives
later can be wiped out); the raid's den reveals at round 3's start; survivors keep id, ordinal and health;
what was destroyed stays destroyed; a building planned on a survivor moves it and nobody shares a tile;
PERIMETER won by holding, lost when the Nexus falls, a lost round not a lost mission; list order decides
between a win and a lose. `tests/mission-loop.test.ts`: Enter opens round 2 on what round 1 left (the
buildings standing, credits carried, a new power dealt, survivors on the map, the wave incoming with its
intention, the top bar and the bottom line, the cursor on the Nexus); Enter, Space, `n`, a click and the
driver open the identical round; nothing moves on before the result; the whole mission to MISSION FAILED,
Play again and Restart back to round 1; Battle Round 2 in the mission's words; Next round on auto; the
incoming wave's card and the Experiment hiding it.

## 5. Human observations

**No human has played this build.** What an agent saw, reading the pictures in `docs/screenshots/`
(`mission-round-1`, `mission-incoming-card`, `mission-round-1-result`, `mission-round-2`,
`mission-battle-round-2`, `mission-complete`, `mission-failed`, `mission-experiments`, and the GIF
`mission-next-round`) and running `scripts/playtest.mjs` flows through all three rounds:

- **The incoming wave reads as "not here yet"**: dim green at the ridge, dim orange beside the Nexus for
  the squads in round 1, clearly different from the survivors drawn at full strength in round 2.
- **Build Phase 2 is plainly the same base, later**: the Turrets and the Hatchery stand, two marksmen and
  the swarmers are home, the credits read 70 where 130 were, and the next wave is visible before anything
  is planned.
- **The result's order reads right**: the fight's headline, then the round's standing, then the row that
  goes on. The last round's `MISSION COMPLETE — The perimeter held.` over the fight's TIME'S UP is the
  Q36 answer on screen.
- **Nobody has judged whether the loop feels right, or the waves' sizes.** That is what the playtest and
  the two Experiments are for.

## 6. Interpretation

**The loop closes on the unmodified kernel.** Everything a mission does between Pulses — carrying the
state, adding what arrives, reading the goal — sits in the rules layer. The strongest evidence is the
hash: 6A's Pulse, re-expressed as a mission, is byte for byte the Pulse 6A played.

**Q36 needed no rule.** The time-out draw stays a draw; the mission says what it means. A kernel flag for
"defender wins on time-out" would have added a rule to serve one mission's words.

**What the kernel's rules do to a defence mission is the real finding** (Section 7): its annihilation rule
ends a round the moment the player's units are gone, even with the raid at the gate and a flank still due.
It is consistent — the raid's survivors carry into the next round, visible in the Build Phase — and it
makes the second round short and the third decisive, which might even be good pacing; but it is not what
"hold until their schedule ends" promised. It is Mario's to feel first (Q70).

**Intentions are words today.** Every unit engages the nearest enemy; "Break through at the ridge" comes
true because the nearest enemy is that way. The design note (`docs/game-design/scripted-opponent.md`) argues the
order primitive (Q69) is the smallest kernel change that makes an intention something the kernel keeps,
and the seam the Campaign's opponent AI will be built on.

**What may read badly, for Mario to feel.** Whether seeing the whole wave in advance is right for a first
mission (Incoming wave); whether the result should wait for a key (Next round); whether a new Nexus power
every round, on top of the carried credits, is too generous (the placeholder draft adds 30 or 2000 a
round); the wave sizes, tuned so that an empty base loses and a real defence holds, and nothing finer.

## 7. Failures, surprises, and discarded approaches

**Found before writing code:**

- **The kernel has no order and no door for scripted intents.** campaigns.md puts the simulation band
  "inside the kernel, as scripted intents"; there is nothing inside the kernel to receive one. So a later
  arrival is applied between ticks, beside the kernel, and `order` has one verb — `advance`, which is the
  kernel's own rule. Registered as Q69.
- **The victory check reads a roster from the opening state.** An arrival at tick 84 would never count for
  annihilation. The runner widens the roster it hands the kernel when something arrives; the roster is an
  input, so no kernel file changes, and a test holds it.

**Found while building:**

- **Annihilation ends a defence round early** (Q70): with nothing built, round 2 stops at 5.3 s when the
  squads fall, and its flank never arrives; in an earlier wave tuning, a strong defence's round 3 ended the
  moment its last swarmer died, the Nexus untouched and nine raiders still standing.
- **Melee crowding caps the damage on a Nexus.** The first wave-3 tuning left an empty base's Nexus at 2
  of 400 health — twenty-odd raiders could not all reach it. Adding more melee changed nothing; three
  ranged slingers did. The waves are tuned by outcome, not by count.
- **A real bug the pictures found: round 2 drawn with round 1's map.** The live loop and the playtest
  harness composed each frame with the context they were started with, so after Enter the screen showed
  round 1's credits and arrivals while the state was round 2's. Both now draw the session's current round
  (`BuildSession.round`), and the test helper does too.
- **A test mission leaked PERIMETER's words**: `firstRound` spread the base context, which already carried
  PERIMETER's round text. A mission with none now sets none.
- **Ghosts over buildings**: an arrival's see-through ghost was drawn over a building planned on its tile.
  Units — incoming or survivors — now yield to buildings on the map, as they do when the Pulse starts.
- **A raid's unit carded in the player's colour**: the card icon assumed side A. It takes the side now,
  and only a building rises through placement frames when its card opens.
- **The 6A Pulse tests needed their six endings** (defeat, draw, time's up, a fallen Nexus…), which PERIMETER
  cannot all reach in round 1. Rather than keep the placeholder alive for tests, they run on a small test
  mission with the placeholder's own forces — the hash check above is the proof nothing moved.
- **Validation caught my own test fixtures twice** (round text for rounds a one-round mission lacks) —
  the check doing its job.

**Discarded approaches:**

- *Spawning the next wave at the start of the Build Phase*, so it is really on the map: that is state
  changed outside a Pulse. The forecast shows it instead, computed by the same function that will place
  it.
- *Refusing a building on a survivor's tile*: survivors regroup beside the Nexus, exactly where a player
  builds next. They step aside instead, as a muster point already did.
- *A kernel roster that says the defender has no units* (to stop annihilation): a hidden rule by
  misstatement. Registered as Q70 option C and recommended against.
- *Keeping `BuildContext.pulse` for tests*: dead code for a path no player takes.

## 8. Decision

**PASS.** Every item of the frame is built and has a test or a picture behind it: the loop runs PERIMETER
round by round into its end; the trigger runner's simulation band is validated data resolved on the
unmodified kernel, hash-stable across runs and runtimes, and reproduces 6A's Pulse exactly; keyboard,
mouse and a driver open the identical next round; Q36 is resolved with no rule change. No stop condition
was met: the kernel needed no change, no clock or randomness entered `src/mission` or `src/match`. Two
kernel-level questions are registered (Q69, Q70) with recommendations. Acceptance is Mario's playtest.

## 9. Canon impact

**None applied; the canon version stays 2.30.** Proposed, to apply when Mario accepts the gate:

- `campaigns.md` Section 2.1 (GUIDANCE): record the vocabulary as built — the three conditions, the
  simulation band's five actions, `intent` as presentation data on a spawn, "the first win or lose in list
  order decides", load-time validation — and that the simulation band runs beside the kernel (tick 0 into
  the opening state, later arrivals between ticks) until the kernel has a door for intents.
- `engine.md` Section 5 (RULE, unchanged in substance): a later Pulse of a mission starts from the state
  Recall left — survivors keep identity and health, a unit steps aside for a planned building — and the
  Recall text gate 6A proposed (a pure function beside the kernel) with it.
- `open-questions.md`: Q36 to Answered (no rule change); Q69 and Q70 stay open.
- `docs/system-design/ui-patterns.md` sections 12 and 14 (already written in this pull request, working document): what
  else is on the map, *the incoming wave*, *the loop*, the round in the top bar.
- `AGENTS.md` Section 4: "A mission is a sequence of Build Phase / Nexus Pulse cycles driven by triggers" —
  add that the trigger runner lives beside the kernel and that `order` is `advance` only until Q69.

## 10. Next authorized action

Mario plays PERIMETER through — three rounds, Enter between them — flips **Next round** and **Incoming
wave** (`d`, under THE MISSION), pastes his settings export, and says whether a round ending with the raid
at the gate reads right (Q70). Gate 6C (automatic production) waits for his word; the order primitive
(Q69) is proposed as its own gate. Nothing else is authorized.
