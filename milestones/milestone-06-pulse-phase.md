# Milestone 6 — Nexus Pulse Phase

**Document role:** Milestone tracker — the explicit Build→Pulse handoff, victory/defeat, and Recall
**Status:** CURRENT
**Active gate:** 6A — Start, end, Recall: connect the Build Phase's commit to the Pulse playback.
**Built and reported (PASS), awaiting Mario's playtest** (2026-09-29, `../evidence/gate-6a-report.md`).
"Start Nexus Pulse" is an explicit action from the Build Phase's `[s] Start Pulse` row, then the end condition, the
stop / finish-in-flight / Recall sequence, and a result a viewer can read unprompted. The kernel is
Milestone 1's and did not change. 6B and 6C wait for the owner's word.
**Depends on:** Milestone 5 (Build Phase produces what this Pulse resolves — accepted 2026-09-29)
**Updated:** 2026-09-30
**License:** Apache-2.0

> **Promoted to CURRENT, 2026-09-29**, when Mario accepted Milestone 5 and gave his word to start this
> one. What exists to build on: the Build Phase commits a plan behind one yes/no question (`p`), and the
> Pulse playback already runs in the terminal and in the browser page (`src/cli/watch.ts`). What does
> not exist: the step between them, a Pulse that ends anywhere a viewer can read, and a player-visible
> result. Gate 6A is that step and nothing more — no loop back into a second Build Phase, no trigger
> runner, no automatic production (6B and 6C).

> **Gate 6A is built, 2026-09-29** (`../evidence/gate-6a-report.md`, PASS; awaiting Mario's playtest).
> `[s] Start Pulse` (the menu's last row), then Enter on the Battle Round 1 screen, starts the Nexus Pulse on the Build Phase's own screen: the plan he committed, plus a
> placeholder crew and raid, becomes the kernel's opening state, the unmodified kernel resolves it, and
> the Pulse plays with a running score, a feed of what is happening, pause, speed, step and watch-again.
> It ends the way section 2.2's sketch asked — a warning, the shooting stopping, the survivors walking
> home, a plain result (won, lost, drawn or timed out, and why) — with the timings as Experiments
> (press `d`); the warning is a flashing timer and a light on the border (round 2, below). Recall, which the rules described and no code ran, exists for the first time
> (`src/match/`). What it does **not** do, on purpose: go back into a second Build Phase (6B), run a
> trigger list (6B), or make the Barracks train anything (6C). Restart, from the game menu, is the way
> back until 6B builds the loop.

> **Gate 6A, round 2 — the owner's look at the pull request, 2026-09-29**
> ([`../docs/feedback/2026-09-29-pr48-pulse.md`](../docs/feedback/2026-09-29-pr48-pulse.md), F41-F46).
> Definition of done:
>
> - [x] the Build Phase menu advertises the action that finishes it: a boxed `[s] Start` button, clickable,
>       dim while a Nexus power is still waiting (F41 — became the menu's last row in round 3, F47);
> - [x] the question is `START PULSE 1?` with `[s] Start Pulse 1` and `[n] Keep building`; Enter, Space
>       and `s` start it (F42 — became the Battle Round screen in round 3, F49-F50);
> - [x] the Pulse's title carries a timer to the stop, and in the last three seconds only that timer
>       flashes; no red banners (F43);
> - [x] the same seconds light the map's border with a soft sweeping light, not a red alert (F44);
> - [x] red is only for the player's Nexus being hurt — first hit, very low health, a lost Pulse — brief
>       and faint, with an on/off Experiment (F45);
> - [x] the branch's changed code has been reviewed for simplification and the findings applied (F46).

> **Gate 6A, round 3 — the owner's second look at the pull request, 2026-09-29**
> ([`../docs/feedback/2026-09-29-pr48-round-3.md`](../docs/feedback/2026-09-29-pr48-round-3.md), F47-F51).
> Definition of done:
>
> - [x] `[s] Start Pulse` is a regular row at the bottom of the menu, reached by Up/Down and pressed by
>       Enter like every other row, and by a click or `s` (F47);
> - [x] the rule "a menu can always be walked with Up, Down and Enter; hotkeys and clicks are extras" is
>       in `docs/ui-patterns.md` (F48);
> - [x] the start confirmation is a screen titled `Battle Round 1` whose text is "Activate Nexus. Collect
>       Resources. Spawn Units." unless a mission supplies its own (F49);
> - [x] its one row is `[s] Start`; Esc goes back and `n` is no longer a key (F50);
> - [x] the menu reorganisation is his to start, on a spike of its own (F51 — he started it on
>       2026-09-30; built as the menu spike below, awaiting his playtest).

> **The menu spike — the owner's reorganisation of the Build Phase menu, 2026-09-30**
> ([`../docs/feedback/2026-09-30-menu-spike.md`](../docs/feedback/2026-09-30-menu-spike.md), F52-F60).
> Gate 6A's round 3 left this for a spike of its own (F51); it is Build Phase interface work, built on
> its own pull request while 6A waits for his playtest, and it does not start 6B. Definition of done:
>
> - [x] a row whose action is under way reads `[x] Label  >>` — `[x]` the key that ends it, `>>` in
>       place of its value — for every row alike (F53);
> - [x] a menu row that hands the keyboard to the map sends an arrow from its `>>` to the cursor, which
>       blinks twice when it lands; an Experiment switches it off and sets its speed (F54);
> - [x] Left and Right on the menu only flicker the row; a placement begun on the menu comes back to it
>       with the row flashing once (F55);
> - [x] no group headings: one list, a blank line between Explore Map, Nexus and the buildings (F56);
> - [x] `$ 100`, no maximum, top right of the panel, in the cost column (F57);
> - [x] no key help or description lines in the panel; an armed building's panel is its card under
>       `[x] Name  >>` (F58);
> - [x] the bottom bar is one row: the last key's answer, else a contextual hint from one place in the
>       code; no position readout (F59);
> - [x] the game menu has `[c] Controls and hotkeys`, a scrolling page of keys and clicks (F60);
> - [x] tests, canon, `docs/ui-patterns.md`, the gate report's section on it, pictures, and a pull
>       request.

> **The menu spike, round 2 — the owner's play of it, 2026-09-30**
> ([`../docs/feedback/2026-09-30-menu-spike-round-2.md`](../docs/feedback/2026-09-30-menu-spike-round-2.md),
> F61-F76, with his settings export). Definition of done:
>
> - [x] the Left/Right flicker greys the row's words and leaves its background (F61);
> - [x] an active row is the hotkey colour and one `>`, no underline; a card's header keeps the row's
>       own hotkey, which cancels (F67, F70);
> - [x] the menu reads Explore Map, Nexus, the credits line (`◆ 130`, the map's resource symbol, on the
>       blank line above the buildings), the buildings, Start Pulse; no credits on the cards (F71, F72);
> - [x] the arrow leaves from the row's own place; the row slides up to be the card's title and the card
>       fades and types in, in about 150 ms, with an Experiment for the length (F63, F68);
> - [x] Explore Map sends a see-through cursor (80% opacity, blended with what it crosses) instead of the
>       arrow, and, opened from the menu, first moves the cursor to clear ground by the arming rule (F64-F66);
> - [x] while a building is armed, other buildings, Explore Map and Start Pulse are refused until it is
>       placed or cancelled (its own digit cancels) (F69);
> - [x] `x` never opens the game menu, and a right click behaves like `x`; no "[esc] Back" rows in popups
>       (F62, F73);
> - [x] every list stops at its ends, a held arrow ramps like the map cursor, Shift/PageUp/Home jump to
>       the ends (F75);
> - [x] `docs/ui-patterns.md` reorganised, and pointed to from `AGENTS.md` and `CLAUDE.md` (F74);
> - [x] his settings export is the default; the settled Experiments are gone into one table of tuned
>       values; the focus arrow, the card animation, the hold window, the raid and your units remain (F76);
> - [x] tests, canon, pictures, the playable page and the pull request — and, at his request the same
>       day, a general review of the whole pull request: names after the design, three bugs fixed, the
>       view split by concept, the tests grouped by concept.

> **The menu spike, round 3 — the owner's play of round 2 and the review, 2026-09-30**
> ([`../docs/feedback/2026-09-30-menu-spike-round-3.md`](../docs/feedback/2026-09-30-menu-spike-round-3.md),
> F77-F81, with his third settings export). Definition of done:
>
> - [x] his export: the focus arrow (250 ms) and the card reveal (400 ms) settled into the tuned values,
>       "your units: some" the placeholder Pulse's default, the hold window 200 ms as he asked (F81, F79);
> - [x] the popup's scroll bar: the track is the plain border, the thumb has a texture of its own (F78);
> - [x] taps accelerate by counting (a double tap within 400 ms, a fast one within 300 ms; 2 tiles on the
>       third tap after a fast gap, 4 after three more), a held key moves on the game's own capped cadence,
>       on the map and in every list (F79);
> - [x] "Key releases" (auto / off): the kitty keyboard protocol asked for, read where the terminal
>       answers, and always popped on exit (F79);
> - [x] the Battle Round screen's border breathes, lighter and darker, with an Experiment for its length
>       (F80);
> - [x] a dedicated navigation session queued in `docs/next-steps.md` (F79);
> - [x] tests, canon, pictures, the playable page and the pull request.

> **The kernel underneath this is already built and accepted (Milestone 1).** Nothing here changes
> how the Pulse resolves — that stays the deterministic kernel, unmodified. What is new is the
> player-facing moment around it: the explicit trigger, knowing when it is over, and what the screen
> does at that instant.

## 1. Question

Can a player explicitly start the Nexus Pulse from a completed Build Phase, watch the unmodified
kernel resolve it, and see a clear, legible ending — battle stopping, survivors heading back, Recall
completing — regardless of whether they won, lost, or reached the mission's own tick limit — **and
then land in the next Build Phase**, since a mission is several of these cycles
([`../specs/campaigns.md`](../specs/campaigns.md) Section 2.1, canon 2.10; PERIMETER is proposed as
three, [`milestone-02-campaign-design.md`](milestone-02-campaign-design.md) Section 4.4)?

## 2. What gets built

- **"Start Nexus Pulse"** is an explicit player action, not automatic — the moment Build Phase's
  hidden plans reveal and become operational
  ([`../specs/engine.md`](../specs/engine.md) Section 5, already RULE, unbuilt as a real UI trigger).
- **Activation and movement** reuse the existing deterministic kernel exactly as Milestone 1 shipped
  it, running against whatever Milestone 5's Build Phase produced and Milestone 2's scripted trigger
  list for the raid. No kernel change is expected here; if one turns out to be needed, that is a
  finding for this milestone's own gate report, not an assumption going in.
- **Recall, confirmed** ([`../specs/open-questions.md`](../specs/open-questions.md) Q29, answered by
  this pivot): at Pulse end, survivors regroup near home producers — already RULE
  (`engine.md` Section 5), already correct, unbuilt as a presentation beat. The state change is
  instant, per the existing rule; a short regroup animation on top of it is presentation only,
  changing nothing about state — exactly the "presentation may interpolate... without changing
  simulation" invariant (`../AGENTS.md` Section 4).
- **A Pulse-end presentation sequence**: once the end condition is detected, no new attack initiates
  even mid-tick, effects already in flight finish their own authored windows (nothing about that
  changes), then Recall plays. This is choreography on top of an ending the kernel already computed,
  not a new kernel phase.
- **The loop, and the trigger list that drives it.** After Recall the mission's triggers decide what
  comes next: the next Build Phase (`startBuild`), or `win`/`lose` when the mission's objective says
  so. This milestone builds the trigger runner's simulation band at the size PERIMETER needs —
  `spawn` and `order` for the waves, `commitPlan` for the raid's own later Pulses, `win` on the final
  `pulse.end` — as data validated at load time, under Q39's recommendation. Conditions are evaluated
  on state and events only. Milestone 9 adds the presentation band on top.
  [`../specs/campaigns.md`](../specs/campaigns.md) Section 2.2 has the `ObjectiveDefinition` shape
  and the architecture this milestone builds to: the kernel's own victory check (`engine.md` Section
  4.3) is unchanged and stays the fallback for Skirmish and Challenge battles with no scripted
  objective; a mission's own goal is resolved entirely here, one level up, by its own `win`/`lose`
  trigger.
- **Automatic production, minimally, if Milestone 2's finding 4.6.2 stands**: the fixture barracks
  producing its recipe on an interval during the Pulse, pulled from
  [`../specs/backlog-pulse-completion.md`](../specs/backlog-pulse-completion.md) — otherwise a
  three-Pulse mission has nothing new to show in its second and third. Mario decides in Milestone 2;
  named here so the dependency is visible.

### 2.1 Gates

- **6A — Start, end, Recall.** "Start Nexus Pulse" as an explicit action; the end condition; the
  stop / finish-in-flight / Recall sequence; a result the viewer can read unprompted.
- **6B — The loop and the trigger runner's simulation band.** Back into the next Build Phase after
  Recall; `spawn`, `order`, `commitPlan`, `win`, `lose` as validated, load-time-checked data; PERIMETER's
  three waves as the fixture; Q36 resolved or explicitly deferred.
- **6C — Minimal automatic production**, if Milestone 2's finding 4.6.2 stands: the fixture barracks
  producing its recipe on an interval, pulled from backlog at the smallest size that makes a second
  Pulse show something new.

### 2.2 How the ending should feel — the owner's sketch, to be tested, not decided

Mario, 2026-09-17, unprompted while reviewing something else: *"The pulse ending is not clear yet, we
will know after playtests. I have the feeling we need some visual warning, like an alarm, then after
3-5 seconds, the units stop shooting, 1 second later they start walking back, 2 seconds later the
build phase begins (no need to wait for units to be back) they all appear back in the base and the UI
changes. The camera is centered at the nexus. But again, we have to test this first to know what looks
good and informative."*

Recorded here because this gate is where it gets built, and because the sequence above is specific
enough to try directly rather than re-derive. **It is a starting point for a playtest, not a
specification** — his own framing, and the right one: this is exactly the kind of thing Milestone 1
only got right after the Pulse ran end to end and someone watched it.

As a first thing to build and look at:

| At | What happens | Which world it belongs to |
| --- | --- | --- |
| 0s | A visual warning — an alarm — and the camera moves to centre on the Grid Nexus | Presentation only |
| +3–5s | Units stop shooting | The kernel has already stopped; this is when the screen shows it |
| +6s | Units start walking back | Presentation only — the state change already happened |
| +8s | The Build Phase begins. Units snap home, the interface changes | The Build Phase's own start |

Four things worth knowing before building it:

**The walk-back is free to cut short, and the sketch already assumes that.** "No need to wait for units
to be back — they all appear back in the base" is exactly what the rules already say: at Pulse end
survivors regroup instantly in state, and the walk home is a presentation flourish on top of a move
that already happened. So the Build Phase can open on schedule regardless of where the animation got
to, and nothing about the simulation cares. The sketch and the architecture agree, which is a good
sign for both.

**The timings are in seconds, not ticks, and should stay that way.** Everything above is presentation
time. None of it may feed back into the Pulse, and none of it changes how long the Pulse itself ran.

**The alarm is pacing, not a countdown.** Mario, asked directly: it is "just an idea for UX, to create
anticipation and not just stop the pulse right away." So it plays *after* the ending is decided, as the
transition's opening beat — which means it needs nothing predicted in advance and works the same way
whether the Pulse ran out of ticks or a Grid Nexus just died. Build it as a flourish on an ending that
already happened, not as a warning about one that is coming.

**Centring the camera on the Grid Nexus is new**, and it is a genuinely good idea for a reason beyond
the ending: it puts the player where the next Build Phase starts, so the transition does not also ask
them to find their own base again.

## 3. New question this raises

**Does PERIMETER's own defensive framing ("hold the perimeter") need a victory shape the kernel does
not have yet?** Today's victory check (`engine.md` Section 4.3, RULE) is: enemy Grid Nexus destroyed,
annihilation, or the tick count runs out — and reaching the tick limit is currently a neutral draw,
not a win for either side. A mission whose whole objective is "survive the raid" plausibly wants
"still standing when the scripted raid's own schedule ends" to read as a **win**, not a draw.
**Recommendation: extend victory's tick-limit branch to accept a mission-supplied objective override**
(a small, explicit flag content or the scenario file can set — "defender wins on time-out" — rather
than a bespoke new condition per mission) **and confirm on PERIMETER's own fixture whether the plain
tick-limit draw already reads correctly before building anything new.** Register as Q36 in
[`../specs/open-questions.md`](../specs/open-questions.md); this is a RULE-level change
(`engine.md` Section 5's own authority marker), so it needs a named scenario and the same kernel-change
discipline every prior rule change in this project has followed — determinism preserved, no new
`Math.random`, a test named for the rule.

## 4. Explicitly not this milestone

Any change to targeting, movement, or combat resolution; a new resource or production rule (Milestone
7); a real opponent policy beyond the fixed trigger list Milestone 2 already decided.

## 5. Acceptance

Automated: the existing Gate 1A/1B determinism suite stays green against PERIMETER's own fixture;
if Q36 lands a victory-condition change, it gets the exact same evidence bar as any other kernel rule
— a named scenario, hash-stable across many runs and both runtimes, diffed against `main` the same
way the unit-architecture spike caught its own regression.

Human: a fresh viewer can tell, unprompted, that the Pulse ended, why (won, lost, or timed out), and
that units visibly came home — not just that the screen stopped moving.

## 6. Definition of done

- [ ] "Start Nexus Pulse" is a real, explicit action from the Build Phase screen, and a completed
      Pulse hands back into the next Build Phase until the mission's triggers end it (6A built the
      action and the ending; the hand-back is 6B);
- [ ] PERIMETER's trigger list (`campaigns.md` Section 2.1's sketch) runs its simulation band —
      waves spawn and advance at their tick, `win` fires on the final `pulse.end` — hash-stable
      across runs and runtimes like any other kernel input;
- [ ] Q36 is resolved (built, or explicitly deferred with a reason) before this gate closes;
- [x] the Pulse-end sequence — stop, finish in-flight effects, Recall — is legible at every capability
      tier and in monochrome (6A: a test plays it at all four depths; the timer's flash is reversed video,
      and each phase is also named in words);
- [ ] the owner's ending sketch (Section 2.2) has been built roughly, watched, and reported on — what
      read well, what did not, and what the alarm turned out to mean for a sudden ending versus a
      scheduled one. A gate report that does not say what the ending actually looked like has not
      answered this milestone's question (6A built it and reported what it looks like; **watched** waits
      for Mario's playtest);
- [ ] a gate report exists, ending in **PASS / REVISE / STOP / BLOCKED**;
- [ ] `./scripts/check-repository.sh` passes.
