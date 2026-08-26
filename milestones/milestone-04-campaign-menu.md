# Milestone 4 — Campaign Menu

**Document role:** Milestone tracker — start or load a campaign; show progress, army, and enemy intel
**Status:** GATED
**Depends on:** Milestone 3 (game menu hands off here)
**Updated:** 2026-08-26
**License:** Apache-2.0; narrative labels shown on screen inherit `campaigns.md`'s CC BY-SA 4.0

> **Mostly infrastructure for now, and that is expected.** Level 1 is the *first* mission — there is
> no prior unlock, no prior enemy sighting, nothing this screen can show yet except a baseline. The
> point of building it now is that Milestone 10's second mission (RIGHT OF SALVAGE) is what actually
> exercises it: progress moves, an army grows, and enemy intel finally has something in it. Building
> the screen empty-but-correct now is cheaper than building it once there is content to justify it and
> discovering the shape was wrong.

## 1. Question

From the game menu's "Start New Game" or "Load Game," can a player reach one screen that shows
campaign progress, the current mission, their own army (unlocked units, buildings, Nexus powers, and
generals), and enemy intel (discovered enemy units, buildings, Nexus powers, generals, and past
mission reports) — and launch the current mission from it?

## 2. What gets built

- **Campaign state**: which campaign, which mission is current, and what the unlock record
  ([`../specs/open-questions.md`](../specs/open-questions.md) Q31 — a flat, checked-in list, not a
  real save format yet) says is available. For Level 1's own first playthrough this is nearly empty
  by construction: nothing is unlocked before Mission 1 is completed.
- **Army panel**: unlocked units, buildings, Nexus powers, and generals (Commanders — the term
  "generals" here means exactly [`../specs/commander-armies.md`](../specs/commander-armies.md)'s
  Commander/Nexus Symbol, not a new roster concept). Reads the unlock record; does not compute
  anything new.
- **Enemy intel panel**: discovered enemy units, buildings, Nexus powers, generals, and mission
  reports. **This is new ground** — nothing in `engine.md` or `campaigns.md` currently specifies a
  persistent, cross-mission "what has the player seen of the enemy" record; `PlayerView`
  (`engine.md` Section 7) is a live, per-Pulse visibility filter, not a remembered log. Register the
  exact discovery rule (does seeing a unit once during a Pulse mark it "discovered" forever after?)
  as a new open question before building this panel — see Section 4 below.
- **Mission reports**: the existing headless report already produces a per-mission outcome (ticks,
  losses, victory reason, hashes — `../milestones/milestone-01-grid-battles.md` Section 3.3). Reusing
  that as the persisted "mission report" this screen shows is cheaper than inventing a second summary
  format, and keeps the report module's existing job (derive everything from the event stream and
  final state) intact.
- **Launch**: selecting the current mission hands off into Milestone 5's Build Phase for that
  mission's map.

## 3. Explicitly not this milestone

A real save/progression system (Q31 stays open — this milestone reads and writes the same flat record
Milestone 3's "Load Game" reads, nothing richer); a full mission-select map or branching campaign
graph (`campaigns.md`'s belief ramp is linear through the missions this roadmap has actually built);
enemy intel content beyond the mechanism — Level 1 has nothing to discover yet.

## 4. New question this raises

**What counts as "discovered" enemy intel, and when does it get recorded?** Candidates: (a) any enemy
entity the player's own `PlayerView` has ever rendered during any Pulse, logged the instant it is
first seen; (b) only entities that survive to a Pulse's end, so a unit glimpsed and immediately killed
still counts, but presentation noise does not inflate the log; (c) explicit, mission-authored reveals
only (a mission's own script decides what the player "learns," independent of what rendered).
**Recommendation: (a), the simplest rule that needs no new authoring per mission** — logged
automatically off the existing `PlayerView`/event stream, the same "derive it from what already
exists" discipline the report module already follows. Register as Q35 in
[`../specs/open-questions.md`](../specs/open-questions.md) before this milestone's own gate closes.

## 5. Definition of done

- [ ] Q35 is registered with a recommendation;
- [ ] the campaign-menu screen renders correctly with an empty army/intel state (Level 1's own case)
      and does not assume there is always something to show;
- [ ] launching the current mission correctly hands off into Milestone 5;
- [ ] mission reports reuse the existing report module rather than a second summary format;
- [ ] a gate report exists, ending in **PASS / REVISE / STOP / BLOCKED**;
- [ ] `./scripts/check-repository.sh` passes.
