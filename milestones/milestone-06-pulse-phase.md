# Milestone 6 — Nexus Pulse Phase

**Document role:** Milestone tracker — the explicit Build→Pulse handoff, victory/defeat, and Recall
**Status:** GATED
**Depends on:** Milestone 5 (Build Phase produces what this Pulse resolves)
**Updated:** 2026-09-17
**License:** Apache-2.0

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

**The alarm implies the ending is known a few seconds early — and that is only true for some endings.**
A Pulse that ends because it ran out of ticks is predictable: the warning can start before the last
tick resolves. A Pulse that ends because a Grid Nexus was destroyed or a side was wiped out is not
predictable — it just happens. So either the alarm is specific to the scheduled ending and a sudden
one gets a different, sharper treatment, or the alarm plays *after* the fact everywhere and reads as a
"stand down" signal rather than a countdown. **This is the one question in the sketch that a playtest
will not answer on its own, because it depends on which of the two it is trying to be.** Worth deciding
what the alarm *means* before choosing how it looks.

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
      Pulse hands back into the next Build Phase until the mission's triggers end it;
- [ ] PERIMETER's trigger list (`campaigns.md` Section 2.1's sketch) runs its simulation band —
      waves spawn and advance at their tick, `win` fires on the final `pulse.end` — hash-stable
      across runs and runtimes like any other kernel input;
- [ ] Q36 is resolved (built, or explicitly deferred with a reason) before this gate closes;
- [ ] the Pulse-end sequence — stop, finish in-flight effects, Recall — is legible at every capability
      tier and in monochrome;
- [ ] the owner's ending sketch (Section 2.2) has been built roughly, watched, and reported on — what
      read well, what did not, and what the alarm turned out to mean for a sudden ending versus a
      scheduled one. A gate report that does not say what the ending actually looked like has not
      answered this milestone's question;
- [ ] a gate report exists, ending in **PASS / REVISE / STOP / BLOCKED**;
- [ ] `./scripts/check-repository.sh` passes.
