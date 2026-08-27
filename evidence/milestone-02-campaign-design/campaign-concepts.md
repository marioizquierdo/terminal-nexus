# Milestone 2 — four campaign concepts, side by side

**Document role:** Design alternatives for Milestone 2 — the incumbent campaign concept pressure-tested against three genuinely different ones, with tradeoffs and a recommendation
**Status:** Proposal for owner review; the decision is registered as Q39 and is Mario's, not a session's
**Updated:** 2026-08-27
**License:** Narrative material is CC BY-SA 4.0; the analysis is Apache-2.0

The brief for this pass was explicit: do not converge on the first workable idea, and do not
unilaterally re-commit to the draft already in
[`../../milestones/milestone-02-campaign-design.md`](../../milestones/milestone-02-campaign-design.md)
Section 4. So this document treats the existing plan as **Concept 0** — one entrant among four, judged
on the same axes as the rest — and the decision is registered as **Q39**.

The three alternatives are not variations. Each changes the opening, and two change what the player
*is*.

---

## The axes they are judged on

Six, chosen because each one has actually decided something in this project before:

1. **Teaching fit** — how well the opening mission teaches the Build → Pulse loop, given that the
   player cannot steer the Pulse.
2. **Content cost** — how much of the disposable bench roster (`src/content/citizen.ts`,
   `src/content/ravel.ts`) it can reuse versus how much must be authored, against
   `commander-armies.md` Section 1's standing ban on early roster authoring.
3. **Writing already banked** — `campaigns.md` Section 4.2 contains a finished PERIMETER: briefing,
   pre-battle exchange, six barks, mid-mission interruption, debrief, and artifact entry, all inside
   the lore budgets. Discarding it is a real cost, not a sunk one.
4. **Engine surface required** — what the kernel would need that it does not have.
5. **Distinctiveness** — how much the first ten minutes look like nothing else.
6. **Milestone disruption** — how many of milestones 3 through 10 would need rewriting.

---

## Concept 0 — THE PERIMETER OPENING *(incumbent)*

**Opening:** The pyramid has risen and destroyed the survey annex. You are expedition security holding
a perimeter that "exists chiefly in this briefing." A Ravel raid is inbound from the northwest ridge.
Hold, and keep the workers alive.

**You are:** Citizens, defending. **Tone:** institutional composure with wonder underneath.

| Axis | Reading |
| --- | --- |
| Teaching fit | Good. Defence teaches placement and worker protection, which are Curriculum B's first two layers. Weaker at teaching composition and movement, which the bench content is actually strongest at |
| Content cost | Lowest of the four. Every unit and structure the mission names already exists on the bench |
| Writing banked | ~400 finished words, all of it usable, none of it wasted |
| Engine surface | One open item (Q36: does "survive the raid" read as a win, or a draw?) |
| Distinctiveness | Modest. "Hold the line against the first wave" is the most common opening in the genre |
| Milestone disruption | None. Eight milestones already point here |

**The strongest thing about it:** the fiction and the mechanism already agree, in writing, including a
detail nobody planned — the briefing promises that the structure "has already assigned the contact a
name, a heraldry, and an estimated time of arrival," which is the Into the Breach telegraph
([`research-notes.md`](research-notes.md) Section 1) written into the story before anyone knew the
design needed it.

**The weakest thing about it:** the opening minute is a competent genre opening, and the game's actual
identity — an enormous indifferent machine — arrives as set dressing behind a fight.

---

## Concept A — SALVAGE FIRST *(open on the Ravels)*

**Opening:** You are Speaker Corvane's raiding coalition, arriving at a human claim you did not know
existed, around a structure nobody can classify. Mission 1 is the attack in PERIMETER, played from the
other side.

**You are:** Ravels, attacking. **Tone:** warm, fast, funny; improvisation as doctrine.

| Axis | Reading |
| --- | --- |
| Teaching fit | Mixed, and worse than it looks. Attacking teaches movement and composition well — which is what the bench content best demonstrates. But the Ravels' declared identity is *maximal variance* (`commander-armies.md` Section 4.2), and a lesson the player cannot reproduce is not a lesson. Teaching an autobattler with the high-variance faction is teaching arithmetic with dice |
| Content cost | Moderate. Ravel bench content exists, but the two Ravel rule shapes with **no evidence behind them** — jackpot drafts and scrap doctrine (`commander-armies.md` Section 1) — are precisely the ones a Ravel campaign would need first |
| Writing banked | Discards PERIMETER's ~400 words, or repurposes the exchange only |
| Engine surface | The draft with redraws (jackpot drafts) is new; so is salvage economy at mission 1 rather than mission 2 |
| Distinctiveness | High. Playing the "aliens" first is a real inversion, and lore Section 8's own framing supports it: each faction campaign replays the belief ramp against its own reading |
| Milestone disruption | Substantial. Milestone 8 (Vasse) and Milestone 10 (RIGHT OF SALVAGE) both re-scope |

**The strongest thing about it:** the outsider frame is honest teaching. A player who is told "I don't
know what this is either" is in the same position as the character, and the campaign never has to
pretend the protagonist understands more than the player.

**The weakest thing about it:** it makes the least-proven faction carry the tutorial, and it
contradicts `commander-armies.md` Section 6's authoring order (smallest Citizen army first) for
reasons of taste rather than evidence.

---

## Concept B — THE QUIET SITE *(no enemy in mission 1)*

**Opening:** The pyramid has risen. There is no raid yet. What is walking the site is an ancient
golem, executing a maintenance function — hostile to nobody, lethal anyway, and utterly indifferent to
your perimeter. Mission 1 is: survive it, protect the workers, build around a thing you cannot fight.
Mission 2 is when the Ravels arrive, and the war is a *relief*.

**You are:** Citizens, coping. **Tone:** awe and dread first; the institution assembles itself on top.

| Axis | Reading |
| --- | --- |
| Teaching fit | Excellent in principle, and this is the surprise of the exercise. A hazard that does not target you is the purest possible first statement of "you cannot steer the Pulse — you can only prepare for it." It teaches the game's actual thesis in mission 1 instead of mission 6 |
| Content cost | Highest. A golem is content nobody has, and it is not a reskin: it needs a behaviour no bench unit has (indifferent, functional, unowned) |
| Writing banked | PERIMETER's material survives, displaced to mission 2 — the briefing needs rewriting, the exchange and barks do not |
| Engine surface | Real and new: a neutral third party with no owner, and a victory condition for a mission with no opponent. Q36 gets harder, not easier — today's victory check is Nexus destroyed, annihilation, or a tick-limit draw (`engine.md` Section 4.3) |
| Distinctiveness | Highest of the four by a wide margin. Nothing in the genre opens this way |
| Milestone disruption | Large. It pulls ANNEX ZERO's own lesson (neutral hazards) to mission 1, which unravels the belief ramp's ordering |

**The strongest thing about it:** it is the only concept whose opening *is* the game's premise rather
than a frame around it.

**The weakest thing about it:** it spends the campaign's last and best card first, and it needs the
engine capability the project is furthest from having.

---

## Concept C — MIRROR *(Citizens against Citizens)*

**Opening:** Before any alien contact, two human claimants dispute the site. Expedition security under
Vasse holds the annex; a rival colonial authority — Marshal Teag or Director Denz, both already
proposed in `commander-armies.md` Section 4.4 — arrives to take custody of it. Same manual, same
units, opposite orders.

**You are:** Citizens, against Citizens. **Tone:** cold, procedural, uncomfortable.

| Axis | Reading |
| --- | --- |
| Teaching fit | The best of the four, mechanically. In a mirror, every enemy unit is a unit the player can build, so every lesson lands twice — you learn the trooper by fighting the trooper. This is the cheapest possible doubling of teaching bandwidth |
| Content cost | Lowest possible — literally zero. `scenarios/citizen-mirror-skirmish.map.json` already exists, and Q18 (ownership keeps the colour, so a mirror stays legible) is already answered |
| Writing banked | Discards PERIMETER's Corvane material; keeps Vasse |
| Engine surface | None. Mirror matches are the best-evidenced thing this engine does |
| Distinctiveness | Low-to-moderate. Human-vs-human openings are common, though "the enemy has your exact army" is rarer than it should be |
| Milestone disruption | Moderate. It delays the Ravels, who are the antagonist ladder the whole arc is built on |

**The strongest thing about it:** it is free, and it teaches better than the incumbent.

**The weakest thing about it:** it makes the campaign's first hour tonally grey. The Activation — the
event the entire game is about — becomes background to an administrative dispute, and the player meets
the faction's internal argument (Vasse versus Teag) before they understand the faction.

---

## Side by side

| | 0 — PERIMETER | A — SALVAGE FIRST | B — QUIET SITE | C — MIRROR |
| --- | --- | --- | --- | --- |
| You are | Citizens, defending | Ravels, attacking | Citizens, coping | Citizens, disputing |
| Teaching fit | Good | Mixed (variance) | Excellent, in principle | Best |
| Content to author | None | Moderate | Highest | None |
| Writing preserved | All | Little | Most, displaced | Some |
| New engine surface | One open question | Draft redraws, early salvage | Neutral actor, new victory shape | None |
| Distinctiveness | Modest | High | Highest | Low–moderate |
| Milestones disrupted | None | Substantial | Large | Moderate |
| Tone of hour one | Composure | Mischief | Dread | Bureaucratic cold |

---

## Recommendation

**Concept 0, with Concept B's cold open grafted on, and Concept C reserved as the arc-2 opening.**

Three reasons, in the order they actually weigh:

1. **The genuine improvement available is not a different campaign — it is a different first minute.**
   Concept B's real asset is not the golem; it is that the player meets the machine before they meet a
   war. That asset can be imported into Concept 0 for the price of one cutscene: open the campaign on
   the Activation itself — the seismic alert reclassified as harmonic, the pyramid already up — and
   then run PERIMETER exactly as written. See [`story-and-cast.md`](story-and-cast.md) Section 2 for
   the specific opening, including the version of it that costs nothing at all.
2. **Concept 0's own written material already contains the design's hardest requirement.** The
   briefing promises a telegraphed arrival ("a name, a heraldry, and an estimated time of arrival"),
   which is exactly the fairness precondition an un-steerable Pulse needs
   ([`progression-system.md`](progression-system.md) Section 5). That is not a coincidence worth
   discarding.
3. **Concept C is not a rejected idea; it is a mis-placed one.** Citizens-versus-Citizens is the
   natural *second* arc opening, once the player understands the faction well enough for its internal
   argument to mean something — which is also where the different-Commander mission wants to sit
   ([`story-and-cast.md`](story-and-cast.md) Section 4). Answering Q39 with Concept 0 does not spend
   Concept C; it schedules it.

**What would change my recommendation.** If the priority is *distinctiveness over cost*, Concept B is
the honest answer and I would not argue hard against it — it is the only concept whose opening is the
game's own premise. The reason it is not the recommendation is the neutral-actor engine surface and
the fact that it spends ANNEX ZERO's card in mission 1, not that the idea is weaker.

**What is being proceeded under while Q39 is open.** Everything in
[`progression-system.md`](progression-system.md) Sections 2 through 7 holds for all four concepts and
is being written as though decided. [`perimeter-sketch.md`](perimeter-sketch.md) assumes Concept 0
explicitly, and says so at its own top; if Q39 lands elsewhere, that one document is what gets
rewritten, and nothing else here does.
