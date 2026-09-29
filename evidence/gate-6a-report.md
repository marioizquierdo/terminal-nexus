# Gate report — Milestone 6, Gate 6A: Start, end, Recall

**Document role:** Gate evidence report for Gate 6A
**Status:** PASS — built and evidenced; awaiting Mario's playtest (acceptance is his). Reworked once from his first look at the pull request: Section 11 is that round, and where it disagrees with Sections 3-6 (the alarm), it wins
**Canon version:** 2.26
**Updated:** 2026-09-29
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.26 (no change planned; canon proposals go to Section 9 and wait for acceptance).
- **Milestone and gate:** Milestone 6 — Nexus Pulse Phase, gate 6A, "Start, end, Recall"
  (`milestones/milestone-06-pulse-phase.md`). Promoted to CURRENT on 2026-09-29 when Mario accepted
  Milestone 5.
- **Question this gate answers:** can a player press `p`, answer yes, watch the Build Phase's plan
  become a Nexus Pulse that the unmodified kernel resolves, and then tell — unprompted — that the Pulse
  ended, why (won, lost, or ran out of time), and that the survivors went home?
- **Smallest artifact that can answer it:** the existing `--spike` screen (terminal and browser page),
  with the `p` question's "yes" now handing the committed plan to the kernel through the application
  shell. Everything new is a connection, not a rewrite:
  - **Start**: the committed plan (standing structures + planned buildings) plus a placeholder
    starting force and a placeholder raid, as data on the Build Phase's context (like the placeholder
    Nexus powers), becomes the kernel's opening state and is resolved once (`buildTimeline`, ~60 ms).
  - **The Pulse on screen**: the Build Phase's own frame (top bar, closed Grid rectangle with the map's
    edge, panel on the left, bottom bar, popups), drawing the resolved Pulse through the same
    cursor-driven camera — because a 96 × 40 map does not fit the 48 × 16 pane the old Pulse view
    draws. The panel carries the forces, the recent events and the controls.
  - **The end**: the sequence Mario sketched (`milestone-06-pulse-phase.md` Section 2.2) as a pure
    function of presentation time — an alarm, the fight stopping, effects in flight finishing, survivors
    walking home, then a result that names the outcome and its reason. Four timings are Experiments.
  - **Recall**: the rule `engine.md` Section 5 already states (survivors regroup near home producers,
    orphans near the Grid Nexus, production cooldowns reset), as a pure end-of-Pulse function in a new
    rules-layer folder (`src/match/`), beside the kernel and never inside its tick.
- **Automated evidence planned:**
  - the kernel is unchanged: `git diff origin/main -- src/pulse src/state src/scenario src/grid
    src/content/types.ts` is empty, and every existing determinism and rules test stays green;
  - the opening state is deterministic and validated (overlaps, rock, bounds); the same plan gives the
    same state and event hashes across repeated runs, and effects, cosmetic seed, glyph pack, speed and
    pause change none of them;
  - Recall: survivors land on free tiles near their home (a compatible producer, else the Nexus, else
    they stay), never overlap under their collision masks, and cooldowns reset; deterministic;
  - the ending plan: phases in order at every Experiment value; the result appears once the walk-back
    ends; walk-back positions run from where the fight left each unit to its Recall tile;
  - all three endings (won, lost, timed out) reachable from the spike's own data and legible in frames,
    in monochrome too — the words carry the cue, not the colour;
  - keyboard, mouse and driver start the Pulse identically; the playback keys are named commands with a
    click on their panel rows; a restart from the game menu goes back to a fresh Build Phase;
  - the Build Phase's reducer and the rules layer still name no clock; the view still never reaches the
    kernel; `tests/architecture.test.ts` says so.
- **Human observation planned:** Mario plays the merged build, watches the ending, flips the four
  ending Experiments in Settings (`d`), and pastes his export. He is asked whether the alarm reads as
  anticipation or noise, and whether the result is clear without being told.
- **Explicit exclusions:** the loop back into a second Build Phase, the trigger runner, waves and
  `win`/`lose` triggers, Q36's defender-wins-on-time-out rule (all 6B); automatic production (6C);
  PERIMETER's real map, units and three waves; live numbers on the map cursor; sound; hiding the
  enemy's opening from the Build Phase; routing for the walk home (a straight glide); any kernel change.
- **Stop conditions:** the Pulse cannot start or end legibly without changing `src/pulse` (that is a
  finding, and the gate stops there); a clock creeps into the reducer or `src/match`; keyboard, mouse and
  driver stop producing the same start; a state field only presentation reads is needed in `MatchState`
  (Recall would need a "home producer" link in state — a schema change that is not this gate's).

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux 6.18 (x86-64 container) |
| Runtime and exact version | Node v22.22.2; Bun 1.3.11 |
| Dependencies and exact versions | from `package-lock.json` (`npm ci`): TypeScript 7.0.2, `@opentui/core` 0.5.6, `gifenc` 1.0.3, `pngjs` 7.0.0, `@types/node` 22.20.1 |
| Hardware, if it affects measurements | container CPU; timings below are indicative only |
| Date measured | 2026-09-29 |

Commands, copy-pasteable, in the order a stranger would run them:

```bash
# install
npm ci
# build
bun scripts/build-web.mjs
# test
npm run typecheck && npm test && npm run test:bun && ./scripts/check-repository.sh
# run
./bin/terminal-nexus.ts --spike
./bin/terminal-nexus.ts --spike --keys "n 2 1 Enter s s"       # open already in the Pulse
node scripts/playtest.mjs --keys "n 2 1 Enter s s wait~4000*8" --print final
```

Baseline before this gate (the merged Milestone 5 build): typecheck clean, Node 585 / 585.

## 3. What was built

Built by one agent in one session, in five commits (record, frame, rules layer, the Pulse on screen,
tests) plus this evidence and documentation. **The kernel is untouched** — see Section 4.

**What a player does and sees (first build; Section 11 replaces the key and the alarm).** Plan something, press `p`, answer `y`. The screen keeps its top bar,
its closed map rectangle, its bottom bar and its popups, and becomes the Nexus Pulse: the panel on the
left shows the clock, one line per side (units, a health bar, the number) and the last five events in
words (`3.5s trooper > raider`), coloured by side; the view opens on the player's Nexus and the arrows
look around while the Pulse plays; Space pauses, `[` and `]` change the speed, `.` and `,` step, `r`
watches it again, and the two panel rows are clickable. The Pulse ends in four beats — an **alarm**
(`PULSE ENDING` flashing in the top bar, the panel and the map's frame, four seconds before the
shooting stops), a **cease fire**, **Recall** (the survivors walk home over two seconds) and a
**result**: `VICTORY`, `DEFEAT`, `DRAW` or `TIME'S UP`, why, and how many of the player's units came
home, on the panel and again as one sentence on the status line. Esc opens the game menu; its Restart
is the way to a fresh Build Phase until 6B builds the loop.

**The pieces, by layer:**

- **`src/match/` — a rules layer beside the kernel, new.** `openingState` turns a plan (structures by
  anchor) plus a force to muster and a Pulse's seed and length into the kernel's `MatchState`, following
  the scenario loader's own conventions so the kernel cannot tell it from a `.map.json` start; it throws
  a named `PulseSetupError` for anything that would put two things on one tile, on rock or off the Grid.
  `recall` is the end-of-Pulse regroup `engine.md` Section 5 states and nothing had implemented: each
  survivor goes to the free tile nearest its side's nearest producer of its kind, else its Grid Nexus,
  else stays; transient fields reset to a fresh entity's; the clock, outcome and cooling tiles clear. It
  returns the new state *and* the moves, so the walk on screen and the next Build Phase read one answer.
  Neither is called from `stepTick`; `tests/architecture.test.ts` says so.
- **`src/view/` — the Pulse as a picture.** `ending.ts`: the ending's moments from the last tick, the
  effects' end and four flags (`endingTimes`), the phases in order (`phaseAt`), the alarm's flash
  (`alarmLit`, 350 ms half period, held lit under reduced motion), the walk home (`walkPositions`,
  whole tiles along a straight line, eased) and the words of every result (`resultOf`).
  `pulse-live.ts`: `PulsePresenter` — the one place a resolved Pulse meets a clock, taking `now` as a
  number, with pause / speed / step / restart from the existing `Playback`, and the two look-at
  commands it asks of the Build Phase (`due`). `pulse-scene.ts`: the panel, the feed, the top-bar
  subtitle, the key help, the status line and the alarm's flash on the map's frame, all pure.
  `snapshot.ts` gained `sampleAt` (a single moment's state, positions, feed and effects) and
  `composeAt` was rebuilt on it with byte-identical output; `grid-layer.ts` is the terrain drawing the
  Build Phase and the Pulse now share.
- **`src/build/` — the Build Phase's reducer knows almost nothing of it.** Three commands: `pulse` (a
  playback control), `look-at` (centre the view — sent by the presenter, so the terminal, the browser
  page and a script see the same thing) and `pulse-failed` (take the commit back and say why, if the
  kernel cannot start from the plan). `BuildSession` takes a `startPulse` option and owns the presenter;
  the keyboard adapter has the playback keys (only while a Pulse is on screen and no popup is open);
  the mouse adapter sends clicks on the two panel rows as `pulse`; the layout knows where those rows
  are. Six Experiments: **Alarm lead**, **Walk-back delay**, **Walk-back time**, **Centre on Nexus**
  (the ending's own) and **Raid** and **Your units** (the spike's placeholder force sizes).
  A context with no `startPulse` still just freezes the plan, as it did before this gate.
- **`src/cli/` — the application shell.** `pulse-run.ts` is the one function that reaches from a
  committed plan to the kernel (`openingState` → `buildTimeline` → `recall`), handed to the Build Phase
  as `startPulse` so `src/build` and `src/view` never import the kernel. `spike.ts`'s live loop hands
  the presenter the clock, runs the frame timer while anything is moving, and holds the Pulse still
  behind the resize gate.
- **Tooling.** The scripted playtest has a `wait` / `wait~MS` step and composes the Pulse at its own
  clock; `scripts/capture-spike-screenshots.mjs` has `pulseGif` and the ending's stills (the retired
  committed-panel shot is replaced by the Pulse's first moment); the playtest skill, `DEVELOPMENT.md` and
  `docs/ui-patterns.md` section 7c say how it works.

## 4. Automated results

| Check | Result |
| --- | --- |
| `npm run typecheck` (both configs) | clean |
| `npm test` (Node 22.22.2) | **646 / 646** (585 before this gate; 61 new) |
| `npm run test:bun` (Bun 1.3.11) | all files pass, the browser-page test included |
| `./scripts/check-repository.sh` | passes; canon 2.26; gate 6A |
| Kernel untouched | `git diff origin/main --stat -- src/pulse src/state src/scenario src/grid src/content src/events src/rng src/report` prints nothing |
| Browser page | `bun scripts/build-web.mjs` builds (200 KB, 100 source files, nothing Node-only reachable); headless Chromium on `#keys=<plan> s Enter` shows the Pulse six seconds in, its timer at 0:10 (first build: `p y`, 6.0 s of 30.0 s) |
| Same plan, same Pulse | five repeat runs give the same state and event hashes, equal to calling `resolvePulse` directly on the same opening state; **identical under Node and Bun** (state `9b03136f…b551`, events `93638c7e…7616`, 175 ticks) |
| Every ending reachable from the spike's own data | see below |
| Cost | committing a plan, resolving the Pulse and working out Recall: median 24 ms (Node), 29 ms (Bun), worst 83 ms on a cold start; composing and encoding one Pulse frame at 80 × 24: 1.8 ms (Node), 1.9 ms (Bun), 5.7 KB of ANSI for a full frame (the backend sends only changed cells) |

**Every ending is reachable** (`tests/pulse-run.test.ts`, one row per scenario):

| Scenario | Result | Why the kernel ended it |
| --- | --- | --- |
| two Turrets and a Hatchery | VICTORY | annihilation of the raid |
| nothing built | DEFEAT | annihilation of the player's force |
| a heavy raid, nothing built | DEFEAT | annihilation |
| one Turret | DRAW | both forces wiped out |
| no raid (Experiment) | TIME'S UP | tick limit (a side that never had units cannot be annihilated) |
| no units of your own | DEFEAT | the player's Nexus destroyed |

**New tests, by what they prove** — `tests/match.test.ts` (16): the opening state is deterministic,
validated and equal to what the loader builds; Recall's rule case by case (producer, orphan, none,
overlap, cooldown reset), determinism, and that the kernel's tick never calls it. `tests/ending.test.ts`
(9): the moments and their order at every Experiment value (over 500 combinations), the alarm's flash,
the walk, the words. `tests/pulse-run.test.ts` (8): the connection, above. `tests/pulse-screen.test.ts`
(23): the screen becomes the Pulse; the ending's words at each moment; results that never run off an 80 ×
24 screen; the walk; reduced motion; the alarm's frame; the playback keys and where they are refused;
clickable rows; the view looking at the Nexus; Watch again; an Experiment felt at once; the frame timer;
time held behind the resize gate; Restart; a Pulse the kernel cannot start; **the ending at all four colour
depths** (the alarm is reversed video, monochrome emits no colour code, no two moments look alike).
`tests/build-lifecycle.test.ts` (+2): the live loop plays a Pulse on its own clock and holds it behind the
resize gate. `tests/playtest.test.ts` (+2): the `wait` step, and a script that plays a whole Pulse.
`tests/build-nexus.test.ts`: keyboard, mouse and a driver script start the identical Pulse.
`tests/architecture.test.ts` (+3): the kernel and the match layer reach neither the view nor the shell;
the Build Phase's animation, the Pulse's ending and the presenter take time as a number and name no clock.

## 5. Human observations

*(First build — the alarm described here was replaced in round 2; `pulse-alarm.png` is retired and `pulse-last-seconds.png` is its successor. See Section 11.)*

**No human has played this build.** What an agent saw, reading the pictures in `evidence/screenshots/`
(`pulse-start`, `-fight`, `-alarm`, `-result-victory`, `-result-defeat`, `-result-timeup`,
`-experiments`, and the GIF `pulse-ending`), running `scripts/playtest.mjs` flows, and loading the browser
page in headless Chromium:

- **The alarm** lights three things at once — the top bar's second word, the panel's headline row and
  the map's whole frame turn red in reversed video — for 350 ms, dark for 350 ms, and the fight carries on
  underneath for its last four seconds. It is impossible to miss, and it does not cover a single glyph
  on the map.
- **Cease fire** freezes the units' positions while the last shots' effects land (a cluster of explosion
  glyphs where the last raiders fell, in the winning run); the panel says so and the status line agrees.
- **Recall** shows the survivors sliding to the tiles Recall gave them over two seconds; nothing else moves.
- **The result** is in the top bar (`nexus pulse - victory`), the panel (a headline in green, red or plain,
  the reason, `3 of yours came home.`, and how to go on) and the status line. In a lost Pulse the raid's
  survivors are still standing on the map, since they have nowhere to go home to.
- **Nobody has judged the timings.** That is what the Experiments are for, and what Mario is asked to do.

## 6. Interpretation

*(First build — "the alarm" below is the first version of the warning; Section 11 says what replaced it. The finding about a pre-resolved Pulse holds for the timer and the light too.)*

**What the sketch asked, and what it looks like built.** Mario's 2026-09-17 sequence — an alarm, then
after 3–5 seconds the units stop shooting, a second later they walk back, two seconds later the Build
Phase begins, the camera on the Nexus — is built at its own numbers (4 s, 1 s, 2 s), each an Experiment.
The one part that cannot be watched yet is "the Build Phase begins": with no loop until 6B, the walk
ends on the result instead.

**What the alarm turned out to mean for a sudden ending versus a scheduled one** (the milestone's own
question). Because the kernel resolves the whole Pulse before the first frame, the presenter knows the
last tick in advance in *both* cases, so the alarm is the same thing both times: a warning placed a fixed
lead ahead of the last tick. For a scheduled ending (the 30-second limit) that is a countdown — it
starts at 26 s. For a sudden one (the last raider falling at 14.6 s, or a Nexus) it is a foretelling: the alarm sounds four
seconds before the deciding blow, which reads as "the end is near" without saying who wins. That works
only because the timeline is pre-resolved. A Pulse resolved live (a networked match, a streamed one) could
not sound an alarm ahead of a sudden ending; the sketch's own wording — the alarm as a flourish *after*
the ending is decided — is the reading that survives, and would have the stop and the walk delayed rather
than the alarm moved. Nothing built here prevents it (the alarm lead is a number); it is worth saying
before anything live is built.

**What may read badly, for Mario to feel.** The alarm sounds over a fight still being decided, so it may
read as part of the battle rather than as the end being called; four seconds may be long, or short. The
result appears in three places at once, which is redundant on purpose (words first, colour second). The
walk home is a straight glide that ignores rock. The seven-unit raid against five is a fixture — nothing
here says whether the Pulse's real length or pace is right.

**Whether the plan reaches the kernel intact** — the gate's technical question — it does: the kernel
resolved exactly the plan the player made (a test reads the Turrets back at the tiles they were placed
on), through code that changes nothing about how it resolves.

## 7. Failures, surprises, and discarded approaches

**Found before writing any code:**

- **The Recall rule does not run.** `open-questions.md` Q29's answer says the end-of-Pulse regroup
  "already runs", and `milestone-06-pulse-phase.md` calls it "already correct, unbuilt as a
  presentation beat". A search of `src/` and `tests/` for `regroup` and `recall` finds nothing: the
  rule is written in `engine.md` Section 5 and implemented nowhere, and `MatchState` has no link from a
  unit to a producer. So Recall is built here as a state change, not only a beat.
- **The old Pulse view cannot draw the Build Phase's map.** `composeFrame` draws every tile at a fixed
  48 × 16 pane with the pre-5F chrome (a panel on the right, "the grid tool" in the header). The
  Build Phase's Grid is 96 × 40.
- **The spike's Barracks does nothing in the kernel** (no `spawn`, and the production phase is empty),
  so "Trains troopers each Pulse" is not yet true. 6C's job; noted so nobody is surprised.

**Found while building and checking:**

- **A real bug, found by a test: the resize gate.** Below 80 × 24 the live loop shows "terminal too
  small" and stops drawing, but a Pulse's clock has no timer behind that notice, so on resizing back it
  counted the whole gap as time played and jumped ahead. The gate now holds the Pulse still
  (`onResize` rebases the clock while gated) and a test asserts the exact second it resumes from.
- **Looking found what the text tests did not.** With every test green, reading the pictures showed a
  status line cut off at 80 columns for a time-out, a time-out reason that was untrue when there was no
  raid at all ("both sides still standing"), `0 of yours came home` where "None of yours" reads better,
  panel prose touching the divider, and internal tags ("Milestone 6") in the Experiments' questions.
  All fixed, and one test now pins that no ending's words run off an 80 × 24 screen. The same lesson as
  `docs/lessons-learned.md` says: read the picture before calling it done.
- **A shot that could no longer be taken.** Regenerating the evidence failed on `build-nexus-committed`:
  accepting the question no longer stops at the committed panel, it starts the Pulse. The shot is
  replaced by the Pulse's first moment; the old picture stays in `evidence/screenshots/` as gate 5D's
  evidence, as `build-nexus-draft.png` was left before it. The committed panel remains what a build with
  no Pulse to start draws.
- **In a scripted Pulse, time only moves forward.** A test (or a screenshot flow) that jumps to the
  result and then asks for the alarm sees the result. Each such check plays its own Pulse from the top.
- **A panel 27 columns wide cuts words.** The feed's first wording (`5.3s trooper hits raider`) lost
  the ends of the longest unit names; the feed is now `5.3s trooper > raider`, coloured by side, and the
  result panel runs down a running row instead of fixed ones.
- **The kernel cannot end a Pulse against no raid except on the tick limit**: annihilation needs a side
  that started with units, so "Raid: none" is TIME'S UP and nothing else. That is the kernel's rule
  (Milestone 1), noted here because it is what makes the third ending reachable at all.
- **Small ones:** the architecture test rejected this gate's own comment for quoting the name of the
  unseeded random function it was forbidding (reworded); the playtest harness had to advance the Pulse
  after every step or the frame after `y` still showed the old view; a Restart test wrongly pressed
  Space inside the game menu, where Space is that menu's Enter.

**Discarded approaches:**

- *Reusing the old Pulse view* (`composeFrame`, `grid watch`'s): it cannot draw a 96 × 40 map at its own
  fixed 48 × 16 pane, and has the pre-5F chrome. The Pulse draws through the Build Phase's frame instead.
- *Recall inside the kernel's tick*, or a link from a unit to its producer in `MatchState`: a schema
  change to Milestone 1's state, which this gate's stop conditions forbid. Recall is a pure function
  beside the kernel that reads the state as it is.
- *The presenter changing the Build Phase's state directly* to centre the view: it sends a named command
  (`look-at`) like any other adapter, so scripts and the browser page behave the same.
- *A clock in the view*: time is a number handed in, so a whole Pulse, alarm and walk included, is tested
  without waiting a second.
- *A separate Pulse screen loop*: two screens with two sets of chrome would have drifted apart; the Pulse
  is a mode of the Build Phase's own screen.


## 8. Decision

**PASS.** Every item of the frame is built and has a test or a picture behind it: the plan reaches the
unmodified kernel intact, every ending the kernel has is reachable and legible at every colour depth,
keyboard, mouse and a script start the identical Pulse, and nothing about how a Pulse is watched can
change what happened. None of the stop conditions was met: the kernel needed no change, no clock entered
the reducer or the rules layer, and Recall needed no new field in the match state. Acceptance is Mario's
playtest — no human has yet watched the ending, which is what the milestone's own question ends on.

## 9. Canon impact

**None applied; the canon version stays 2.26.** Proposed, to apply when Mario accepts the gate:

- `engine.md` Section 5 (Recall): say what Recall does as built — a pure function of the state a Pulse
  ended in, beside the kernel and never inside its tick; survivors go to the free tile nearest their
  side's nearest producer of their kind, else their Grid Nexus, else stay; transient fields reset. And
  the Pulse's start: the Build Phase's plan becomes the kernel's opening state by the scenario loader's
  own conventions (`src/match/opening.ts`).
- `engine.md` Section 9 (the interface) and Section 10: the Nexus Pulse is a mode of the Build Phase's
  own screen — `docs/ui-patterns.md` section 7c, promoted: the ending is four beats in a fixed order,
  every one a function of presentation time; a result is words first and colour second; nothing the
  player does while watching changes the Pulse.
- `milestone-06-pulse-phase.md` Section 2.2: record what was built and the finding about the alarm — that
  it can only sound ahead of a sudden ending because the Pulse is resolved before it is played.
- `open-questions.md`: Q36 already carries a note of what the screen now shows for a time-out (done, not
  versioned). **No new question was registered**: every choice was reversible or is an Experiment.
- Already done in this pull request, not canon: the governance ledger and history, `AGENTS.md` Section 2,
  the Milestone 6 tracker, `docs/next-steps.md`, `docs/ui-patterns.md`, `DEVELOPMENT.md` and the playtest
  skill.

## 10. Next authorized action

Mario plays the Pulse — plan, `[s] Start`, `s` or Enter, and watch to the result — flips the ending's Experiments (`d`),
and pastes his settings export into the pull request; an agent settles each Experiment it answers
(adopt the value, delete the Experiment, record the answer). Gate 6B (the loop into the next Build
Phase, the trigger runner's simulation band, PERIMETER's three waves, Q36) waits for his word;
`docs/next-steps.md` has the prompt to start it. Nothing else is authorized.

## 11. Round 2 — the owner's first look at the pull request (2026-09-29)

Mario's feedback, in the log at `docs/feedback/2026-09-29-pr48-pulse.md` (F41-F46): the Build Phase needs a
visible way to end the phase, like a strategy game's "end turn" button; the alarm's red was far too
intense ("a nuclear boom"), though the anticipation was right; the Pulse title should show a timer and only
that timer should flash in the last three seconds; the border of the screen should light up like a
lighthouse calling, not a red alert; red is for the Nexus being damaged, and even then shorter and gentler;
then review the code for simplification.

**What changed.**

- **`[s] Start`.** A boxed button at the bottom right of the menu panel, on every Build Phase screen, in the
  hotkey colour (dim, with its reason on a click, until the Nexus power is picked). `s` or a click asks once;
  the popup is "START PULSE 1?" with `[s] Start Pulse 1` highlighted and `[n] Keep building`; Enter, Space or
  `s` accept. `p` and `y` still work, unlisted. The three-row box collides with the menu's effect line and the
  bound-key help at 80 × 24, so the help is written beside the button when it fits there and above it when
  not (`panelBindings` in `src/view/build.ts`), and the layout module owns the box (`startButton`).
- **The timer.** The panel's title is `NEXUS PULSE 1` with the time left to the last shot at its right end
  (`0:12`); for the last three seconds (the Experiment **Final warning**, 3000 ms, 0 = off) that timer alone
  flashes — reversed video, 0.3 s on and 0.3 s off, held lit under reduced motion. Nothing else on the
  screen flashes, and the alarm's banners, red status line and red frame are gone.
- **The light.** In the same seconds a soft light sweeps once every two seconds clockwise round the map's
  border, from a faint glow to a bright head with an 18-cell tail, a colour pulled toward white and never
  a glyph; in monochrome the border goes bold as it passes; under reduced motion it is a steady glow.
- **Red.** Only for the player's Nexus being hurt: its first hit (0.2 s), its health below a quarter (a
  0.15 s blip every 1.5 s until it falls), and the result of a lost Pulse (0.25 s), at most 0.6 of the way
  to the danger colour, a tint of the border and nothing else; none under reduced motion; the Experiment
  **Red alerts** turns it off.

**Interpretation flagged for Mario.** "When losing" is read as *the moment a lost Pulse's result appears*.
If he meant "while my side is behind in the fight", that is a different, more frequent signal and he
should say so. With the placeholder data, a lost Pulse where the Nexus is never hit (nothing built against
the default raid) flashes red only at the result; the first-hit and low-health flashes show with **Your
units: none** (the raid then reaches the Nexus at 11.6 s).

**Evidence.**

| Check | Result |
| --- | --- |
| `npm run typecheck` (both configs) | clean |
| `npm test` (Node 22.22.2) | **665 / 665** (646 at the first build): 9 new for the Start button and its popup, the ending's own tests rewritten (14), the Pulse screen's rewritten for the timer, the light and the red, and one for Pause once the result stands |
| `npm run test:bun` (Bun 1.3.11) | all 49 files pass |
| `./scripts/check-repository.sh` | passes; canon 2.26; gate 6A |
| Kernel untouched | `git diff origin/main -- src/pulse src/state src/scenario src/grid src/content src/events src/rng src/report` is empty |
| Browser page | rebuilt from the committed tree (202 KB, 100 source files); headless Chromium on `#keys=n 2 1 Enter 3 Enter 3 Enter s Enter` shows the Pulse with its timer counting down |
| Pictures | new: `build-start-button`, `pulse-last-seconds`, `pulse-nexus-hit`; redone: `build-nexus-confirm`, `pulse-start`, `pulse-fight`, `pulse-experiments`, and the GIF `pulse-ending`; retired: `pulse-alarm`. Each was opened and looked at before the pull request linked it; the light was also rendered in the light theme, monochrome and 16 colours |
| The review changed no pixel | after the simplification pass every picture and the GIF re-rendered byte-identical |

Tests worth naming: the timer is the only reversed cell inside the panel and never more than the four
characters of `0:03`; the light is confined to the border and its head moves and returns after one period;
red is faint (peak 0.6), brief (under a third of a Pulse's frames), absent from a cleanly won Pulse, off
with the Experiment and under reduced motion; every phase is told apart at all four colour depths with no
colour code in monochrome; the lifecycle test plays the timer on the live loop's own clock.

**Review (the `simplify` pass, four independent reviewers: reuse, simplification, efficiency, altitude).**
It found the same few things in different words. **Applied:** the corruption law's tail was written three
times — one `paintEffectCells` now serves the Pulse view, the Build Phase and the old Pulse composer; the
force bar, the tile centre and the grid distance were copied and are shared; per-frame work done again and
again is done once (the ending's moments, the border's cells, the light's per-frame maths, the force counts,
the units that came home, the feed's last five lines, tile keys as numbers rather than strings); the Pulse
number, the presenter's dead presentation options and the frame-timer merge lost their detours; the reducer
no longer names an Experiment (`FIRST_PULSE_EXPERIMENT_ROW` lives with the list); `START_KEY` and the
button's bottom row are data; dead and unused exports, an unused `player` field and the alarm's stale
comments are gone; the tests share `click`, `atHome`, the winning key script (derived from the plan, not
retyped) and the SGR reader. **A real mismatch the review found and fixed:** the Pause row was hit-tested
after the result stood though no row was drawn — Space or a click there toggled an invisible pause; Pause
is now ignored once the result stands, with a test. **Skipped, with reasons:** the two biggest per-frame
costs (rebuilding the frame's rules and repainting the terrain, together about 40% of a roughly 1 ms
frame) are old code, and a cache needs invalidation rules — a separate change; two duplicates sit in the
kernel's directories, which this gate may not touch (the opening's copy of the scenario loader's tail, and a
"is a structure" test written at a dozen sites — the right home is `src/content/`); "a Pulse is on screen"
has three sources, and a commit that is applied and then reverted if the kernel cannot start is a
redesign of the commit path that gate 6B rewrites anyway (the loop back into the next Build Phase);
one table for each control's key, label and row, and the composition input built by hand in three
places, are the same kind of change; routing the result headline's colour through the status tone
resolver would change how a victory looks (the two disagree on purpose — a look, not a cleanup).

**Failures, surprises, discarded approaches (round 2).**

- **A failing assertion looked like a 15-minute hang.** `tests/build-lifecycle.test.ts` leaves the live loop
  running when an assertion throws, so Node never exits. Run it with `--test-timeout=30000` when editing
  it; the failure is then a line, not a stall.
- **A test tried to move a Pulse's clock backwards** (it is forward-only by design), and one asked for
  "the ceasefire" at 1.5 s after the stop — which is already Recall (the walk starts a second after the
  stop). Both are tests' mistakes, fixed, and both are what the earlier round's note about scripted Pulses
  predicted.
- **Reversed video is not only the timer's.** The cursor and a spark are reversed too, out on the map, so
  "only the timer flashes" is asserted inside the panel and the light's cells on the border, not over
  the whole frame.
- **The timer touched the divider** until it was pulled in one column, as the panel's prose is; the
  screenshot showed it, the text tests did not.
- **The first Start button collided** with the armed row's effect line and the key help at 80 × 24 (seven
  tests failed at once); the help now goes beside the button.
- **Discarded:** a blinking or inverse status line for the last seconds (a second thing to flash, which he
  asked against); red on the timer itself at the very end (the timer is the one cue, and it should stay the
  colour of everything else); a light that lights the whole border at once (it reads as a frame flash, not a
  lighthouse).

**Decision (round 2): PASS, still awaiting his playtest.** Nothing in this round widened the gate: no loop
into a second Build Phase, no trigger runner, no automatic production.

**Next authorized action (unchanged):** he plays it, flips **Final warning** and **Red alerts** if he wants,
pastes his settings export, says whether "when losing" is the result or the fight, and an agent settles
what it answers. Gate 6B waits for his word.
