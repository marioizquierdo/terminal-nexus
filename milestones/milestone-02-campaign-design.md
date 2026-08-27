# Milestone 2 — Campaign Design

**Document role:** Milestone tracker — decide the shape of Level 1 before any of milestones 3-10 build against it
**Status:** CURRENT
**Active gate:** 2 — Campaign Design (one design pass; this milestone is not sub-gated)
**Depends on:** Milestone 1 (accepted)
**Updated:** 2026-08-27
**License:** Apache-2.0; the mission decisions below touch CC BY-SA 4.0 narrative material already written in `campaigns.md`

> **Design work, not code.** This milestone's own artifact is a decision, written down precisely
> enough that milestones 3 through 10 can build against it without re-deriving it — the same
> discipline [`../AGENTS.md`](../AGENTS.md) Section 1 asks of every gate ("state the current
> question, the smallest artifact, required evidence, exclusions") applied to design itself. Nothing
> here is source code, and nothing here is a story beyond what
> [`../specs/campaigns.md`](../specs/campaigns.md) Section 4.2 already wrote for PERIMETER. If a
> decision below turns out wrong once milestone 5 or 6 actually plays it, that milestone's own report
> is where it gets revised — this document is a starting position, not something later milestones
> must contort themselves to preserve.

> **Brainstorm pass complete, 2026-08-27 — Section 4 below is now a *first draft under review*.**
> Mario asked for genuine exploration before commitment: research, real alternatives, and formalized
> systems rather than a locked plan. That pass lives in
> [`../evidence/milestone-02-campaign-design/`](../evidence/milestone-02-campaign-design/) and is
> summarised in Section 7 below. It did not overturn Section 4, but it did register four decisions as
> genuinely the owner's — **Q39** (which campaign concept the first arc builds), **Q40** (fixed unlock
> versus a choice), **Q41** (where the lose-everything set-piece sits), and **Q42** (the second
> Commander) — and Section 4 should be read as proceeding under Q39's recommendation rather than as
> settled.

## 1. Question

**What does PERIMETER — the campaign's first mission — actually need to contain, before any of
milestones 3 through 10 write a line of code against it?** Concretely: which units, which map, what
Build Phase budget, what the scripted opponent does and when, and what the mission is teaching versus
what it is deliberately still simple about.

## 2. Why this is its own milestone

Mario, describing the pivot: "we can formalize this a bit better... the first step will be to build
the first level of the campaign... this initial task actually involves doing all the milestones: UI,
menus, pulse phases, build, upgrade nexus abilities, etc." Eight milestones' worth of code (3 through
10) all point at one mission. Every one of them will make a cheaper, better decision if the mission's
own shape is fixed first, in one place, rather than re-guessed independently by whichever milestone
gets there first. This is exactly the "smallest artifact that answers the question" move
([`../AGENTS.md`](../AGENTS.md) Section 1) applied one level up: the artifact here is a specification,
not a build.

A pre-merge review of the whole milestone sequence (2026-08-26) already settled two process-level
questions this milestone would otherwise have had to raise itself — Mario's own framing was that
campaign design "will define roughly how to organize this, not only for the game itself, but also for
the development process," and these are exactly that: **Q37**, that milestone 5 opens with a short
static-mockup pass before building the real Build Phase GUI, rather than this milestone trying to
design that GUI ahead of time; and **Q38**, whether PERIMETER's own map needs to actually scroll
(4.3 below). Both are still `OPEN` in [`../specs/open-questions.md`](../specs/open-questions.md) —
this document proceeds under their recommendations rather than treating them as answered.

## 3. Read before deciding

1. [`../specs/campaigns.md`](../specs/campaigns.md) Section 4.1 (the belief ramp) and 4.2 — PERIMETER's
   briefing, pre-battle exchange, barks, mid-mission interruption, debrief, and artifact entry are
   **already written**. Nothing here should contradict them; where a mechanical decision below
   constrains what could be shown, the text wins and the mechanism bends.
2. [`../specs/commander-armies.md`](../specs/commander-armies.md) Section 4.1 (Citizens' mechanical
   identity: standards propagate, alignment bonus, shared cadence) and 4.4 (Commander Edda Vasse:
   "fortify, verify, then advance").
3. [`../specs/engine.md`](../specs/engine.md) Section 5 (Build Phase, Commander, structures, automatic
   production) and Section 6 (economy) — GUIDANCE, mostly unbuilt, and what milestones 5-8 build from.
4. The existing fixture content: `src/content/citizen.ts` (`unit.citizen.worker`, `.trooper`,
   `.marksman`, `structure.citizen.nexus`, `structure.citizen.barracks`) and `src/content/ravel.ts`
   (`unit.ravel.raider`, `.runner`, `.slinger`, `structure.ravel.den`, `structure.ravel.nexus`) — built
   for Milestone 1, disposable, but already close to what PERIMETER's own fiction describes.
5. [`../specs/open-questions.md`](../specs/open-questions.md) Q15 (routing dead end), Q29 (Recall),
   Q32, Q33 — this milestone finalizes the last two.
6. [`../specs/open-questions.md`](../specs/open-questions.md) Q37 (the Build Phase GUI spike — why
   it belongs to milestone 5's own opening, not a design step here) and Q38 (whether PERIMETER's map
   needs real scrolling — 4.3 below proceeds under its recommendation).

## 4. Decisions

### 4.1 Units — reuse, do not author

PERIMETER's own briefing: "two squads, one fabricator" for the player, "a hostile force... inbound
from the northwest ridge" identified by name and heraldry for the enemy. That maps directly onto
existing disposable content:

- **Player (Citizen):** `unit.citizen.worker` (a small starting crew), `unit.citizen.trooper` and
  `unit.citizen.marksman` (the two squads), `structure.citizen.nexus` (already placed),
  `structure.citizen.barracks` reused as "the fabricator" the debrief already refers to.
- **Enemy (Ravel):** `unit.ravel.raider` and `unit.ravel.runner` as the raiding party;
  `structure.ravel.den` if the scripted schedule needs a visible source for reinforcements rather than
  a pure off-map trigger (Section 4.4 below).

**No new unit content for PERIMETER itself.** This is deliberate, not a shortcut: `AGENTS.md` Section
2 still reserves Commander Army authoring for Milestone 4, and everything above is already-disposable
bench content with no balance claim, exactly as Milestone 1 shipped it. If milestone 8's Commander
work or milestone 10's second-mission polish finds a real gap, that is a new, explicit decision made
there — not assumed here.

### 4.2 Build Phase budget — small and legible over rich

The player starts with the Nexus, the barracks/fabricator, and the starting crew already placed
(matching "a perimeter that exists chiefly in this briefing" — not much is built yet when the mission
opens). During Build Phase, the player may spend a small starting resource amount on:

- a short, fixed construct menu: one or two additional troopers/marksmen, and nothing else purchasable
  for PERIMETER specifically. Milestone 7's worker economy determines how that resource is actually
  earned during the Pulse itself (harvesting from a deposit), but Build Phase's own opening allotment
  should be small enough that the interesting decisions are placement and composition, not a spreadsheet.

This is intentionally the smallest version of Build Phase that milestone 5 can build against — richer
menus are a later mission's decision, not this one's.

### 4.3 The map

A Grid with Nexus and barracks near one edge, open ground toward the approach the raid comes from.

**Q38 is OPEN; this section proceeds under its recommended answer.**
[`../specs/campaigns.md`](../specs/campaigns.md) Section 4.1's belief-ramp text describes PERIMETER as
"a small Grid that never scrolls" — written before milestone 5's own charter (build and test real
scrolling) existed. A map sized to strictly fit the viewport would leave milestone 5's scrolling work
either untested against the actual campaign or tested against a second, throwaway fixture instead of
the mission meant to prove it. This document assumes the map grows just large enough to need a little
scrolling while still reading as small and contained — the belief-ramp's *feel*, not its literal
geometry, is the invariant. If Mario answers Q38 differently, only this section and `campaigns.md`
Section 4.1's own wording need to change; nothing else here depends on it.

**Q33, decided:** author the approach lane off-axis from the Nexus, not fixed by a routing patch. Q15
(`../specs/backlog-pulse-completion.md`) is real and still unowned by any single milestone; PERIMETER
does not need to be the mission that fixes it.

### 4.4 The scripted opponent

**Q32, decided:** a tick-gated trigger list, not a policy module — `{ atTick, action }` entries
authored and validated the same way a `.map.json` file already is (`../specs/campaigns.md` Section 6's
"scripted tutorial" tier). PERIMETER's own raid: an initial group already visible at Pulse start
(from `structure.ravel.den`, if it earns a place on the map, or pre-placed if not), reinforcements
arriving on a fixed schedule from the northwest, advancing toward the Nexus. No reaction to what the
player does — that is a later mission's opponent, once one genuinely needs to teach it.

### 4.5 What PERIMETER teaches, and what it deliberately does not yet

Per the belief ramp (`../specs/campaigns.md` Section 4.1, row 1): **the Build Phase / Nexus Pulse loop
on a small Grid that never scrolls.** The belief the player holds going in ("Operator is my job
title") is allowed to feel true — nothing in Level 1 needs to unsettle it yet. (Q38, still open,
questions whether "never scrolls" survives contact with milestone 5's own charter to build and test
real scrolling; see 4.3.)

Deliberately not this mission's job, even though the milestones that follow build the mechanism:

- the Commander's death/absence/restoration cadence (Mission 3, RESTORATION's own teaching moment —
  see milestone 8's own note and Q34);
- a real upgrade draft depth beyond "one or two options exist" (Nexus powers stay a later mission);
- worker-flight danger, salvage economy, or contested wrecks (Mission 2, RIGHT OF SALVAGE's own job —
  milestone 10 authors that mission using its own new content, once it exists).

## 5. Q29 — answered by this pivot

Mario's own description of milestone 6 ("Nexus Pulse") settles Q29 outright: "instantly recall all
units back to their proper location next to their home buildings." That is precisely
[`../specs/engine.md`](../specs/engine.md) Section 5's existing end-of-Pulse regroup rule, named
**Recall**, confirmed to mean exactly what Q29's Option A recommended — not a new mid-Pulse mechanic.
Moved to Answered in [`../specs/open-questions.md`](../specs/open-questions.md).

## 6. Definition of done

- [x] the unit list above is confirmed against the actual fixture content — done in
      [`../evidence/milestone-02-campaign-design/perimeter-sketch.md`](../evidence/milestone-02-campaign-design/perimeter-sketch.md)
      Section 1, which also records two findings: there is no distinct worker producer on the bench,
      and the raid deliberately gets no Grid Nexus;
- [x] a real `.map.json` sketch or written layout exists for PERIMETER's Grid, terrain, and starting
      placements — `perimeter-sketch.md` Section 2: a 60 × 20 Grid (`large-extra-wide`) with terrain
      rows, occupied tile ranges for every starting entity, and the Q33 off-axis constraint written
      down as a constraint future edits must preserve;
- [x] the trigger-list shape for the scripted raid is written down precisely enough that milestone 6
      can implement it without a second design pass — `perimeter-sketch.md` Section 3, including the
      simplification to **one verb** (`spawn`, not `spawn` plus `activate`) and the six determinism
      rules that shape needs;
- [x] Q29 is moved to Answered (done before this session);
- [ ] Q32 and Q33 are moved to Answered, citing this document — **held on purpose.** Both are
      PERIMETER-specific, and Q39 could change whether PERIMETER opens the campaign at all; closing
      them now would mean closing them twice. Recommended for closure in the same pass that answers
      Q39;
- [x] Q38 is explicitly proceeded-under-recommendation, and the map sketch reflects that answer —
      the 60 × 20 size is chosen specifically so the Grid scrolls at the 80 × 24 terminal floor and
      fits whole at the viewport maximum;
- [ ] Mario has looked at the decisions above and either confirmed them or asked for a specific change.

## 7. The brainstorm pass, 2026-08-27

Six documents in
[`../evidence/milestone-02-campaign-design/`](../evidence/milestone-02-campaign-design/). Read them in
this order:

| Document | What it settles |
| --- | --- |
| [`research-notes.md`](../evidence/milestone-02-campaign-design/research-notes.md) | Nine games read for one mechanism each — Into the Breach, Advance Wars, Fire Emblem, StarCraft II, Slay the Spire, FTL, Teamfight Tactics, Cogmind, Dwarf Fortress — and what each is worth here. The four claims they agree on are what everything downstream leans on |
| [`progression-system.md`](../evidence/milestone-02-campaign-design/progression-system.md) | The unlock system (**the Manifest**: one content id, granted on mission completion, at most one per mission, and it must change the construct menu or the draft), the eight things deliberately refused, the **One Lesson Rule**, and explicit teaching curricula for the two decisions an autobattler actually has |
| [`campaign-concepts.md`](../evidence/milestone-02-campaign-design/campaign-concepts.md) | Section 4's plan compared against three genuinely different openings on six axes → **Q39** |
| [`story-and-cast.md`](../evidence/milestone-02-campaign-design/story-and-cast.md) | The story at conceptual scale, three ways to open through Nexus events, the six-rung escalation ladder (ground → material → person → authorship → instruments → indifference), how Vasse gets introduced, the second-Commander mission → **Q42**, and the lose-everything set-piece → **Q41** |
| [`perimeter-sketch.md`](../evidence/milestone-02-campaign-design/perimeter-sketch.md) | This milestone's concrete Definition-of-Done items, per Section 6 above |
| [`two-audiences-audit.md`](../evidence/milestone-02-campaign-design/two-audiences-audit.md) | Every recommendation checked against the player's experience and the developer's, with the five rows where one wins at the other's expense named rather than smoothed |

The gate report closing this pass is
[`../evidence/milestone-02-campaign-design/report.md`](../evidence/milestone-02-campaign-design/report.md).
