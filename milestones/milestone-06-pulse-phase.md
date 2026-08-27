# Milestone 6 — Nexus Pulse Phase

**Document role:** Milestone tracker — the explicit Build→Pulse handoff, victory/defeat, and Recall
**Status:** GATED
**Depends on:** Milestone 5 (Build Phase produces what this Pulse resolves)
**Updated:** 2026-08-26
**License:** Apache-2.0

> **The kernel underneath this is already built and accepted (Milestone 1).** Nothing here changes
> how the Pulse resolves — that stays the deterministic kernel, unmodified. What is new is the
> player-facing moment around it: the explicit trigger, knowing when it is over, and what the screen
> does at that instant.

## 1. Question

Can a player explicitly start the Nexus Pulse from a completed Build Phase, watch the unmodified
kernel resolve it, and see a clear, legible ending — battle stopping, survivors heading back, Recall
completing — regardless of whether they won, lost, or reached the mission's own tick limit?

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

- [ ] "Start Nexus Pulse" is a real, explicit action from the Build Phase screen;
- [ ] Q36 is resolved (built, or explicitly deferred with a reason) before this gate closes;
- [ ] the Pulse-end sequence — stop, finish in-flight effects, Recall — is legible at every capability
      tier and in monochrome;
- [ ] a gate report exists, ending in **PASS / REVISE / STOP / BLOCKED**;
- [ ] `./scripts/check-repository.sh` passes.
