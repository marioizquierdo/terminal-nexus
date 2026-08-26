# Milestone 2 — Level 1: Perimeter

**Document role:** Start-here implementation contract
**Status:** CURRENT
**Active gate:** 2A — the Build Phase loop
**Canon version:** 2.8
**Updated:** 2026-08-26
**License:** Apache-2.0; authored creative treatments are CC BY-SA 4.0

> **Where this stands, canon 2.8.** Milestone 1 (Gates 1A and 1B) is **formally accepted** —
> `project-governance.md` Section 5 has the acceptance entry. Mario's own words afterward, in full:
> "I am quite happy with the milestone... I would really like to approach it by building the campaign,
> one level at a time. After each level, we unlock new units and powers, show a bit of the story, etc.
> This way we will slowly build the commander armies and factions, at the same time that we build maps,
> and test the new units on a single level vs the computer enemy." That is a direct redirection of the
> roadmap, not an addition to it: this document used to describe "completing the Pulse" — routing,
> economy, production, visibility, replay format, all built horizontally in one wide pass before
> anything narrower — and it does not any more. That contract's full text is preserved, unchanged, in
> [`backlog-pulse-completion.md`](backlog-pulse-completion.md); nothing in it was wrong, and nothing in
> it is deleted. It is simply no longer one milestone's job to build all of it before anything else
> starts. Every fixture, question, and locked contract it names is still exactly as true as it was.
>
> **This also reopens [`campaigns.md`](campaigns.md) Section 1's own stated boundary** — "campaigns...
> must wait until battle presentation, deterministic Nexus Pulses, base construction, and a two-faction
> microgame are fun" — which assumed the horizontal order this pivot replaces. Amended in that document
> directly, citing this decision, rather than left standing as a contradiction the next session has to
> notice on its own (`milestone-1-spike-battle.md` Section 7's own working note: canon drift from a
> changed decision is not caught by the nearest doc comment, only by someone going looking).

## 1. What this milestone builds

> **PERIMETER — the first mission of the belief ramp ([`campaigns.md`](campaigns.md) Section 4.1) —
> built as a real, playable vertical slice: a hidden Build Phase, a handoff into the existing Nexus
> Pulse kernel, a scripted opponent, a written briefing and debrief, and one explicit unlock. Small
> enough that "one level" is not a euphemism for "a whole milestone under a different name," and real
> enough that the next level repeats the same shape rather than inventing a new one.**

This is a genuine pivot in *how* Terminal Nexus gets built, not only in what gets built next. Every
milestone through Milestone 1 was horizontal: complete one system's whole surface, gated on evidence,
before the next system starts. This milestone is the first **vertical** one: build the thinnest
possible slice through every layer — kernel, content, presentation, narrative — for exactly one
mission, prove the slice is worth repeating, and let the *next* level be where the second slice
teaches whatever the first one could not. `AGENTS.md` Section 4's "prefer direct code... extract a
framework only after two real uses reveal the boundary" applies to whole systems here, not only
functions: Build Phase, the briefing/debrief display, and the unlock record are all being built for
their **first** real use, on purpose, rather than designed in the abstract for a campaign that does
not exist yet.

**Why PERIMETER specifically, and why it is unusually cheap to attempt right now:** its own written
fiction ("two squads, one fabricator... a hostile force is inbound from the northwest ridge") already
matches the **existing disposable fixture content** almost exactly — `unit.citizen.trooper`,
`unit.citizen.marksman`, `unit.citizen.worker`, `structure.citizen.nexus`, and a barracks-style
producer are already on the bench (`src/content/citizen.ts`), and the Ravel fixture roster
(`src/content/ravel.ts`) already reads as raiders. **This milestone reuses that bench content as
PERIMETER's armies. It does not author a Commander Army.** `AGENTS.md` Section 2 is explicit that
Commander Army authoring stays reserved for Milestone 4, and `commander-armies.md` still reserves
rosters — that constraint is unchanged by the pivot and is not being quietly worked around. What
changes is the *wrapper* around already-disposable content: a Build Phase, a story, and an unlock are
real campaign structure even when the units inside them are still bench fixtures with no balance
claim, exactly as Milestone 1's own fixtures always were.

**The commander herself, Edda Vasse, is not being built as a mechanic here.** She appears in
PERIMETER's own text, but the belief-ramp table (`campaigns.md` Section 4.1) assigns Commander
death/absence/restoration specifically to Mission 3 (RESTORATION) as *its* teaching moment — building
that lifecycle now would be building ahead of the level that actually needs it. For Level 1, Vasse is
narration and (at most) a normal persistent unit; the full Commander mechanic
([`engine.md`](engine.md) Section 5.1) is out of scope here.

| Gate | Question | Status |
| --- | --- | --- |
| **2A — the Build Phase loop** | Can a player place a small, fixed-budget base in a hidden Build Phase, hand off into the unmodified Nexus Pulse kernel, and see a fixed win/loss condition resolve against a scripted opponent — on one real map, with no story dressing at all? | **CURRENT** |
| **2B — the level wrapper** | Does dressing 2A's mechanism in PERIMETER's own written briefing and debrief, a minimal Build-Phase side panel, and an explicit unlock record make it read as a campaign level rather than a bench scenario? | GATED on 2A |

**Not in this milestone:** a second resource, storage/warehouses, the upgrade draft, Nexus powers,
the full Commander lifecycle, real routing/pathfinding fixes, visibility/hidden-information
projection, the replay format, multiplayer, any level beyond PERIMETER, any faction's campaign but the
Citizen opening, a real save/progression system, sound, or a graphical UI of any kind — "GUI" in
Mario's own request means the existing terminal side-panel presentation
([`engine.md`](engine.md) Section 9.2), extended, not a new rendering target. Everything in that list
that PERIMETER genuinely does not need stays in
[`backlog-pulse-completion.md`](backlog-pulse-completion.md) until a level's own content demands it.

## 2. Read before coding

1. [`campaigns.md`](campaigns.md) Section 4.1 (the belief ramp) and 4.2 (PERIMETER, in full — the
   briefing, pre-battle exchange, barks, and debrief this milestone displays are already written;
   do not rewrite them).
2. [`engine.md`](engine.md) Section 5 (match structure, Build Phase, Commander, structures, automatic
   production) and Section 6 (economy) — GUIDANCE, but the most load-bearing GUIDANCE this milestone
   has, since almost none of it has been built yet.
3. this document.
4. [`open-questions.md`](open-questions.md) Section 4, specifically Q29 through Q33 (registered by
   this pivot) plus Q13, Q14, Q15 (routing and worker flight, still open, still relevant to whatever
   map PERIMETER ships).
5. [`backlog-pulse-completion.md`](backlog-pulse-completion.md) — not to build from, but to recognise
   when something Gate 2A needs overlaps something already designed there, so it is amended rather
   than redesigned from nothing.
6. `AGENTS.md`, then existing source, tests, and evidence — the kernel, content schema, and view this
   milestone builds on are Milestone 1's, unchanged unless a section below says otherwise.

Copy [`templates/gate-report.md`](templates/gate-report.md) and fill in its first section before
writing code, exactly as Gate 1A required.

---

## 3. Gate 2A — the Build Phase loop (CURRENT)

### 3.1 Decision to earn

> **Does a hidden Build Phase, followed by the existing Nexus Pulse kernel unchanged, resolve one real
> mission map end to end — deterministically, against a scripted opponent — without needing anything
> this milestone has not already named?**

Allowed outcomes: **PASS**, **REVISE** (one named contract needs changing), **STOP/BLOCKED**.

### 3.2 What Build Phase actually needs, for exactly one level

`engine.md` Section 5 already describes Build Phase in full — hidden, simultaneous, turn-based,
untimed planning from the same public resolved state, plans revealing together at Pulse start. None
of that is being redesigned. What Gate 2A adds is the **smallest possible mechanism that satisfies
it** for a single, fixed mission:

- a player starts with a fixed roster already unlocked — the existing Citizen fixture content, not a
  new one — and a small starting resource amount;
- during Build Phase, the player may spend that resource on a short, fixed **construct menu**: place
  additional pre-existing units or one producer structure inside a legal zone near the starting Nexus;
- committing is turn-based and untimed, exactly as `engine.md` 5 already specifies; there is nothing
  to build here beyond "accept a plan, validate it, hold it hidden until reveal" — Gate 2A does not
  need simultaneous multiplayer commits, since PERIMETER has exactly one human side;
- at Pulse start, committed plans become operational and the unmodified kernel takes over. **Nothing
  in `src/pulse` changes shape for Build Phase itself** — it only gains one new kind of tick content
  (below), the same way economy and production were always empty phases waiting for exactly this.

**One new kernel capability, and only one:** automatic production
([`engine.md`](engine.md) Section 5.3) for a single producer structure — a fixed recipe, on a
recurring interval, spawning a fixed unit while resources and supply allow it. This is deliberately
**not** the unit-architecture spike's `ContentDef.spawn` (`specs/open-questions.md` Q26): that field
is a combat-only ability with no cost and no resource, and conflating it with an economy-driven
producer building is exactly the confusion Q26 flags as a risk. Gate 2A's producer spawn is new,
narrow content: a recipe, a cost, an interval, nothing else from Section 5.3's fuller picture
(contention between simultaneous producers, multiple recipes, research-modified output) is needed for
one fabricator on one map.

**The opponent is scripted, not adaptive** — `campaigns.md` Section 6's simplest tier. A fixed,
deterministic sequence of spawns and movements from the northwest, timed to the mission's own text
("inbound from the northwest ridge"), authored the same way a scenario fixture already is. This is
not the local-policy AI framework `project-governance.md` Section 10 describes for later missions; it
is closer to a second, one-sided scenario placement schedule than to an opponent that decides
anything. Building a real policy for one fixed, one-time script would be exactly the "generic
framework before two concrete uses reveal its contract" governance Section 2 forbids.

**Victory and loss are the existing rules, unchanged**: enemy Grid Nexus destroyed wins; nothing new
is needed for "hold the perimeter, keep the workers alive" to resolve through the kernel Milestone 1
already built.

### 3.3 The map

PERIMETER needs a real `.map.json` scenario, authored (not generated) the way every Milestone 1
fixture was: a starting Nexus and a small legal construction zone near it, open ground toward the
northwest matching the briefing's approach, and terrain shaped so the scripted raid actually arrives
from that direction. **Author the map to avoid Q15's known on-axis routing dead end** rather than
fixing routing itself — an approach lane that is not perfectly axis-aligned with the Nexus costs
nothing and sidesteps a real, unfixed kernel gap that this milestone does not own.

### 3.4 Automated acceptance

Everything Milestone 1's own determinism suite already checks, unchanged and still green — the new
production phase must not weaken any of it:

- the new producer content follows every kernel-change checklist item the unit-architecture spike
  already established: determinism preserved (`--verify` identical across many runs), no clock, no
  `Math.random`, `src/pulse` still imports nothing from `src/view`, and a named scenario file exercises
  the new production rule specifically;
- Build Phase commits are validated the same way any kernel command is — an illegal placement (outside
  the legal zone, over budget, over supply) is rejected with a reason, not silently clamped;
- the scripted opponent's schedule reproduces identically from the same seed, the same way every other
  scenario does;
- the whole PERIMETER map, Build Phase choice included, resolves to identical state and event hashes
  across many runs and across Bun and Node — the same cross-runtime bar Gate 1A set.

### 3.5 Human acceptance

A fresh viewer places a small base, watches the Pulse resolve, and can say — without narration from
whoever is running it — what they built, why, and whether the mission's own promise ("hold the
perimeter, keep the workers alive") reads as true or false at the end. No story text is shown yet;
that is Gate 2B's job. This gate is judged purely on whether the *mechanism* reads clearly.

### 3.6 Definition of done

- [ ] every check in 3.4 passes;
- [ ] the PERIMETER map exists as a checked-in `.map.json` fixture;
- [ ] a player can place at least one unit and the one producer structure during Build Phase, and see
      both operate correctly once the Pulse starts;
- [ ] the scripted Ravel raid arrives from the northwest and behaves identically every run from the
      same seed;
- [ ] victory and loss both resolve correctly on at least one recorded run each;
- [ ] `./scripts/check-repository.sh` passes;
- [ ] a gate report exists, ending in **PASS / REVISE / STOP / BLOCKED**;
- [ ] Mario has watched (or played) a full Build Phase → Pulse cycle on PERIMETER;
- [ ] new questions this gate raises are rows in [`open-questions.md`](open-questions.md), each with a
      recommendation.

Then stop. Gate 2B is where it gets to read as a mission rather than a bench scenario.

---

## 4. Gate 2B — the level wrapper (GATED on 2A)

### 4.1 Question

> **Does PERIMETER's own written material, a minimal Build-Phase side panel, and an explicit unlock
> record make Gate 2A's mechanism read as the first mission of a campaign?**

### 4.2 What gets built

**The written material, verbatim.** [`campaigns.md`](campaigns.md) Section 4.2 already has PERIMETER's
briefing (157 words), pre-battle exchange, mission-pool barks, one mid-mission interruption line, a
debrief (103 words), and an artifact entry — all written and accepted. Gate 2B's job is to **display**
this material, not write new material: the briefing before Build Phase starts, the pre-battle exchange
at Pulse start, at least one bark during the fight, the mid-mission interruption at the first Pulse
tick that plausibly reads as "its rhythm," and the debrief once the Pulse resolves. A full ASCII
cutscene tableau (`campaigns.md` Section 5) is explicitly **not** required for this — plain text,
displayed in the existing frame, is the smallest artifact that satisfies "show a bit of the story."
Building the fuller cutscene system now would be a framework built for one use; the second level is
what should decide whether it is worth one.

**A minimal Build-Phase side panel**, exactly the shape `engine.md` Section 9.2 already specifies and
no more: the construct menu Gate 2A's mechanism already has, its cost and effect, a placement-legality
panel that says *why* an illegal placement failed, and the legend. Radius preview only if Gate 2A's
producer structure has a radius worth previewing; if not, skip it rather than building a preview for
nothing.

**One explicit unlock record.** Not a save system — a flat, checked-in list (a JSON or TypeScript
file, whichever the implementing session finds more natural to validate) naming what PERIMETER
completing makes available to whatever mission is authored next. This is deliberately the cheapest
possible answer to "after each level, we unlock new units and powers": a fact the next level's own
contract can read and cite, not a persistence layer, a player-facing menu, or a progression UI.

### 4.3 Acceptance

Automated: the briefing, exchange, barks, and debrief render without error at every capability tier
and in monochrome, the same accessibility bar every Gate 1B effect already met; the unlock record is
schema-validated; nothing about Gate 2A's determinism moves.

Human, and this is the real gate: a fresh viewer reads the briefing, plays or watches the level, reads
the debrief, and says — unprompted — what happened and why it mattered. Revise if the mechanism and
the story feel like two unrelated things bolted together, or if the debrief describes an outcome the
player did not actually see happen.

---

## 5. What this milestone deliberately does not answer

**"Recall"** — Mario's own word, used alongside "the nexus pulse," for something not currently named
in canon. Registered as Q29 in [`open-questions.md`](open-questions.md) with a recommendation rather
than guessed at here: the closest existing rule is `engine.md` Section 5's "at Pulse end survivors
regroup near home producers... orphans are adopted by the nearest compatible producer or regroup near
the Grid Nexus" — the recommendation is to name *that* rule Recall, give it one presentation beat, and
build nothing new. If that turns out to be the wrong reading, no code above depends on the guess.

**"Bases"** are exactly `engine.md` Section 5.2's structures, placed during Build Phase — nothing new
is being defined by the word.

**"Unit spawns"** means two genuinely different things in the current canon, and this milestone is
careful to build only one of them: Gate 2A's producer-structure spawn (economy-driven, costed,
Section 5.3) and the unit-architecture spike's `ContentDef.spawn` (combat-only, free, Q26) are not the
same mechanism and must not be merged into one to save a field.

Q30 through Q33 (GUI-panel scope, the unlock record's exact shape, the scripted-opponent authoring
format, and whether PERIMETER's map needs a Q15 workaround or a real fix) are registered in
[`open-questions.md`](open-questions.md) with recommendations, not decided here — this milestone
proceeds under each recommendation and names it at the point in Sections 3–4 above where it applies.

## 6. Milestone completion

This milestone passes when both gates are accepted on PERIMETER specifically. Durable outputs:

- a Build Phase mechanism thin enough that a second level can reuse it without a rewrite;
- one new, narrow kernel capability (producer automatic-production) proven on real content, with the
  spike's combat-only `spawn` kept visibly distinct from it;
- the first campaign level, playable end to end, with its own written material actually on screen;
- an unlock record format the next level's contract can read;
- answers to Q29 through Q33, each promoted into the narrowest document that now owns it;
- explicit authorization — or refusal — to begin Level 2 (RIGHT OF SALVAGE, per the belief ramp),
  which `campaigns.md` Section 4.1 already names as the mission that introduces the salvage economy —
  the next slice of [`backlog-pulse-completion.md`](backlog-pulse-completion.md) this roadmap expects
  to pull in, once Level 1 has actually shipped.
