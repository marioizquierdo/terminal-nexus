# Milestone 6 — Nexus Pulse Phase

**Status:** CURRENT
**Current step:** 6B — The loop and the mission's trigger runner: back into the next Build Phase after Recall, until the mission's triggers end it.
**Depends on:** Milestone 5 (complete).

_Nothing is open for an agent right now: step 6B is built and waits for Mario's playtest, step 6C
waits for his word. Until then the work is his latest feedback, or nothing._

## The question

Can a player start the Nexus Pulse from a finished Build Phase, watch the unmodified kernel resolve it,
see a clear ending (the shooting stops, the survivors walk home, Recall completes) whether they won,
lost or ran out the clock, and then land in the next Build Phase? A mission is several of these
cycles; PERIMETER is three.

## What exists to build on

- The kernel from Milestone 1: deterministic, unchanged by this milestone, and the fallback victory
  check for battles with no scripted objective.
- The Build Phase from Milestone 5, which commits a plan and starts the Pulse from a `Battle Round`
  screen.
- The Pulse screen: running score, a feed, pause, speed, step, watch again, a timer that flashes before
  the stop, a lit border, then the result (won, lost, drawn or timed out, and why). Every timing is an
  Experiment.
- Recall in `src/match/`: survivors regroup at home producers. The state change is instant; the walk
  home is presentation only.
- The Build Phase menu rebuilt as a spike (one list, cards, a Controls page, counting-based key
  acceleration); its detail is in `docs/history/`.
- A mission as validated data (`src/mission/`) and its trigger runner (`src/match/mission.ts`), with
  PERIMETER's three waves as the fixture.
- Design: [`campaigns.md`](../game-design/campaigns.md) for missions and the objective shape,
  [`scripted-opponent.md`](../game-design/scripted-opponent.md) for the opponent the campaign will
  eventually need, and [`ui-patterns.md`](../system-design/ui-patterns.md) for screens.

## Steps

### Step 6A — Start, end, Recall

Done (pull request 49).

- [x] `[s] Start Pulse` is the menu's last row, reached by Up and Down, pressed by Enter, a click or `s`.
- [x] Starting opens a `Battle Round 1` screen ("Activate Nexus. Collect Resources. Spawn Units." unless
      the mission supplies its own text) with one row, `[s] Start`; Esc goes back.
- [x] The committed plan becomes the kernel's opening state and the unmodified kernel resolves it.
- [x] The ending is a warning, the shooting stopping, the survivors walking home, and a plain result.
      The owner's sketch of the timings is built as Experiments.
- [x] The title carries a timer to the stop, and only the timer flashes in the last three seconds. A soft
      sweeping light runs round the border at the same moment. No red banners.
- [x] Red is only for the player's Nexus being hurt (first hit, very low health, a lost Pulse), brief and
      faint, with an on/off Experiment.
- [x] The ending reads at every capability depth and in monochrome: a test plays it at all four, the
      flash is reversed video, and each phase is named in words.
- [x] Recall exists in `src/match/`, with tests.
- [x] The changed code was reviewed for simplification and the findings applied.

### Step 6B — The loop and the mission's trigger runner

Built; waiting for Mario's playtest (pull request 50).

- [x] After Recall, `[enter] Next round` opens the next Build Phase on what the last one left: buildings
      standing, survivors home, credits unspent. Keyboard, mouse and driver open the identical round.
      Restart and Play again go back to round 1.
- [x] The trigger runner's simulation actions (`spawn`, `order`, `commitPlan`, `win`, `lose`) are data
      validated when the mission loads, with every problem named. `order` has one verb, `advance`.
- [x] PERIMETER is the fixture: three rounds, the raid in three waves, a later arrival in rounds 2 and 3,
      the raid's own camp in round 3, won by holding the Nexus to the end of round 3. The placeholder Pulse
      and its Raid and Your units Experiments are gone.
- [x] The runner resolves each round on the unmodified kernel and reproduces step 6A's Pulse hash for hash.
- [x] A defensive mission's goal is read above the kernel's victory check, which is unchanged, so no rule
      changed.
- [x] The next wave shows on the map, see-through, and its intention is on the Explore Map card.
- [x] Two Experiments for what Mario should feel: Next round (key or automatic) and Incoming wave (shown
      or hidden).
- [x] The campaign's scripted opponent is thought through in `scripted-opponent.md`.
- [x] Tests, pictures, `ui-patterns.md` and a pull request.

### Step 6C — Minimal automatic production

Waits for Mario's word.

- [ ] The fixture Barracks trains its recipe on an interval during the Pulse, at the smallest size that
      makes a second round show something new. Pulled from [`backlog.md`](backlog.md). Until then the
      Barracks card says "Trains troopers" and trains nothing.

## Not in this milestone

- Any change to targeting, movement or combat.
- A second resource or a production rule beyond 6C (Milestone 7 owns the worker economy).
- An opponent policy beyond the mission's fixed trigger list. A campaign that defines a Pulse's whole
  opening state, so the player can explore the map and see what is coming, is later work.
- The trigger runner's presentation actions (briefings, barks): Milestone 9.
- `hold` and `withdraw` orders: refused when a mission loads.

## Open decisions this milestone waits on

- Should a side whose Grid Nexus still stands lose a Pulse because its units all died? Today the round
  simply stops with the raid at the gate. Nothing is blocked. (Q70)
- Does the kernel need an order primitive, so a scripted group can hold, withdraw or head for a place?
  Today `advance` is the only verb. Nothing is blocked. (Q69)

## The milestone is done when

- [ ] Mario has played the loop and the ending, and a fresh viewer can tell, unprompted, that the Pulse
      ended, why, and that units visibly came home.
- [ ] The ending's report says what it looked like, what read well, and what the warning meant for a
      sudden ending versus a scheduled one.
- [ ] PERIMETER stays hash-stable across runs and both runtimes.
- [ ] `./scripts/check-repository.sh` passes.
