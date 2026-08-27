# Milestone 2 — the progression system: unlocks, teaching, and the two decisions that matter

**Document role:** Design proposal for Milestone 2 — the unlock system, the mechanic-unveiling rule, and the explicit teaching plan for an autobattler's two pre-Pulse decisions
**Status:** Proposal for owner review; nothing here is canon, and nothing here authorizes code
**Updated:** 2026-08-27
**License:** Apache-2.0 for the mechanism; the mission-facing wording is CC BY-SA 4.0

Read [`research-notes.md`](research-notes.md) first — every "because" below traces to a named game
there. This document is deliberately written as *systems*, not as a list of per-mission ideas, because
the failure mode Milestone 2 exists to prevent is eight milestones each improvising the same decision
differently.

---

## 1. What this document proposes, and what it does not

**Proposes:** one unlock system, one rule for introducing mechanics, and two explicit teaching
curricula — one per pre-Pulse decision.

**Does not:** author content. Every unlock below is named as a **role** ("the military producer
becomes buildable"), never as a new content id with stats. `commander-armies.md` Section 1 reserves
roster authoring for Milestone 4, and `AGENTS.md` Section 2's do-not-build list still holds. Where a
role maps onto content that already exists on the bench, it says so.

**Does not:** assume the campaign concept. The mission names below are the belief ramp's
(`../../specs/campaigns.md` Section 4.1). If **Q39** is answered with a different concept
([`campaign-concepts.md`](campaign-concepts.md)), the *systems* in Sections 2 through 7 survive
unchanged and only Section 8's table gets rewritten — which is why the table is last and separate.

---

## 2. The unlock system — the Manifest

### 2.1 The fiction does the design work for free

The canon already has the right frame and nobody has to invent one: the Prime Nexus "begins expressing
ancient permissions through Citizen engineering and military doctrine"
(`../../specs/campaigns.md` Section 4). An unlock is therefore not a *reward the game grants* — it is
a **permission the Nexus releases**. That single reframe buys three things at no cost: one word for
the whole system, a reason it is one-directional, and a reason the player is told about it in the
debrief rather than on a results screen with a fanfare. PERIMETER's own debrief already narrates its
own unlock without knowing it did: "The fabricator ran through the night without fuel anyone can
identify, printing barracks components to a standard none of our engineers wrote."

Call the record the **Manifest**. It is a list of permissions, not a score.

### 2.2 The whole system, in five rules

1. **An unlock is exactly one thing: a content id.** Units, structures and upgrades are already
   `ContentId`s in the engine's own content interfaces (`../../specs/engine.md` Section 8). There is
   one unlockable kind, not four; a "Commander ability" is an `upgrade.*` id and needs no separate
   category.
2. **The trigger is mission completion, and it is the only trigger.** Not achievements, not optional
   objectives, not a currency, not score. `campaigns.md` Section 2's `MissionDefinition` already has
   `unlocks: readonly string[]`; this makes that field the sole mechanism.
3. **At most one unlock per mission.** Not a soft target — a rule. It forces the designer to pick the
   *one* thing, it keeps the debrief's announcement to one line, and it matches the rate at which a
   glyph-only game can actually teach a new silhouette
   ([`research-notes.md`](research-notes.md) Section 8).
4. **An unlock must change the construct menu or the draft.** If completing a mission grants something
   the player cannot *see and use* during the next Build Phase, it is not an unlock — it is flavour,
   and it gets written as a debrief line and granted nothing. This one rule kills "unlock a stat
   bonus," "unlock a lore entry," and "unlock a difficulty," all of which are the failure modes this
   system exists to avoid.
5. **Unlocks are additive and permanent; missions restrict, the Manifest never subtracts.** A mission
   may say "you have this, but not here" through `MissionDefinition.availableContent` — that is a
   mission-authoring lever, used constantly by the games in the research notes, and it is *not* a
   change to the Manifest. This distinction is what lets the campaign stage a "you lost everything"
   mission (see [`story-and-cast.md`](story-and-cast.md) Section 5) without the progression system
   needing an exception.

### 2.3 The record's shape

Q31 already recommends a flat, checked-in list rather than a save system, and nothing here needs more
than that:

```json
{
  "campaign": "citizen-opening",
  "completed": ["perimeter"],
  "unlocked": ["structure.citizen.barracks"]
}
```

Two arrays. No tiers, no counts, no timestamps, no percentages. `completed` exists because the
campaign menu needs to draw progress and because the next mission's availability is derived from it;
`unlocked` is the Manifest. Everything a progress panel wants to show is a function of those two
arrays and the campaign definition — which means there is exactly one thing to persist when a real
save format arrives, and it is small enough to be a rounding error in `replay-format.md`'s own schema
later.

### 2.4 How the player is told — three existing surfaces, zero new screens

| When | Surface | What it says | Who builds it |
| --- | --- | --- | --- |
| End of mission | The debrief's closing system line | One two-line reversal in the canon's own register, e.g. `PERMISSION RELEASED: FABRICATOR PATTERN` / `PATTERN PREDATES THE FABRICATOR` | Milestone 9 (cutscenes) — it is authored text, not a mechanism |
| Between missions | The campaign menu's army panel | The Manifest as a list; entries new since the last mission marked with a single leading `+` | Milestone 4, which already builds this panel |
| Next Build Phase | The construct menu itself | The new entry, present, with its cost and effect text; first appearance carries one extra line of description | Milestone 5, which already builds this menu |

The third row is the real one. The other two are announcements; the construct menu is where an unlock
becomes a decision, which is the only place it can actually mean anything. This is why rule 4 exists.

### 2.5 What was considered and refused

Each of these is a real option some game in the research notes uses well, refused for a stated reason
rather than overlooked:

| Refused | Used well by | Why not here |
| --- | --- | --- |
| Meta-currency for unlocks | Into the Breach (achievement coins) | Requires an achievement system, a currency, and a store screen — three systems to deliver one grant in a six-mission campaign |
| Unlock into a random draft pool | Slay the Spire | Its own community reports the dilution problem; our draft is 2–3 options wide, where dilution bites far harder than in a 350-card game |
| Discovery-driven unlocks | FTL | The next mission must be able to *assume* what the player has; a linear campaign cannot author against "maybe" |
| Optional-objective unlocks | Fire Emblem gaiden chapters | Doubles per-mission authoring and splits the teaching; the campaign then cannot rely on any lesson |
| Unlock tiers / rarity | most of the genre | A second vocabulary the player must learn, for six grants |
| Per-unit upgrade trees | most RTS campaigns | Redundant with the Citizens' own faction rule: "an upgrade applies to every unit of its class, including units already fielded" (`../../specs/commander-armies.md` Section 4.1). The faction identity is the simplification |
| Ranks, medals, stars per mission | Into the Breach reputation; Advance Wars ranks | Implies replay-for-score, which implies scoring, which implies balance evidence this project does not have |
| A difficulty selector | nearly everything | No balance evidence yet; per-mission tuning is authored data anyway, so a mission that is too hard gets fixed rather than flagged |

That table is the answer to "simplify aggressively" in its most useful form: not a promise to keep
things small, but a written record of the eight specific things that were on the table and are now
off it, so a later session does not re-add one by drift.

---

## 3. One more simplification, and it is the biggest

**There is no separate progression system.** The Manifest, the campaign's linear mission order, and
the construct menu are the whole of it. There is no XP, no level, no research tree, no reputation, no
meta-upgrade layer between missions. The player's power curve across the campaign comes from exactly
two sources: the six things the Manifest grants, and the upgrade they pick each Build Phase.

That is worth stating as a load-bearing decision rather than an omission, because every one of the
refused rows in 2.5 is an attempt to add a *second* progression axis on top of that, and the reason to
refuse them individually is the same reason: the campaign is six missions long. A second axis needs
enough missions to be felt, and there aren't any.

---

## 4. The One Lesson Rule

Advance Wars' Field Training names each battle after the single thing it teaches
([`research-notes.md`](research-notes.md) Section 2). This is that discipline written down so it
survives eight milestones and more than one author.

### 4.1 The rule

1. **A mission declares exactly one lesson**, and the lesson is a field in the mission definition
   (`teaches`), not a comment. One mission, one idea the player has never had to think about before.
2. **The lesson is load-bearing for the outcome.** If a player can complete the mission without
   engaging the lesson, the mission does not teach it — it merely contains it. Advance Wars' Base
   Capture cannot be won without capturing; PERIMETER cannot be won without committing a plan and
   letting it resolve.
3. **Introduce, isolate, then combine.** The lesson first appears with nothing competing for
   attention; the same mission gives at least one repeat use; the *next* mission combines it with a
   prior lesson but does not stack a new lesson on top of the combination. This is
   `../../specs/campaigns.md` Section 3's own "introduce one important tool in a constrained
   situation, let the player use it enough to understand its strategic purpose, and then combine it
   with prior tools" — made into three checkable steps.
4. **A mission's unlock is the next mission's lesson-enabler, or an earlier lesson's amplifier — never
   a third subject.** This is the rule that binds Section 2 to Section 4 and stops the campaign
   becoming two unrelated sequences (a teaching order and a rewards order) that happen to run in
   parallel.
5. **The lesson is legible without lore.** Same standard the factions are already held to
   (`../../specs/terminal-nexus-lore.md` Section 8.6): a player who skipped the briefing should be
   able to say what the mission taught them. And per
   [`research-notes.md`](research-notes.md) Section 9, it must be legible in at least two channels —
   never the Grid alone.
6. **One lesson, one unlock, one relationship change, one local question, one new mystery.** Already
   the canon's own per-mission contract (`campaigns.md` Section 3, lore Section 10.5); the rule above
   is just the first item of it taken literally.

### 4.2 Making it cheap for the developer

`teaches` and `unlocks` are two fields, and `./scripts/check-repository.sh` is already the project's
habitual place for structural invariants. A ten-line addition can assert: every mission declares
exactly one `teaches`; no two missions in a campaign declare the same one; `unlocks.length <= 1`; and
every id in `unlocks` resolves to real content. That turns an editorial intention into a build
failure, which is the only form of design discipline that survives a year.

Recommended as a **warning, not a failure**, for `teaches` uniqueness specifically, with an explicit
escape: a mission that genuinely needs to revisit a prior lesson declares it and the check says so out
loud rather than blocking. A validator that a designer has to fight is a validator that gets deleted.

This is a reversible tooling decision a session may take alone under
`../../specs/project-governance.md` Section 2 — recorded here so the *reason* is written down, not
registered as a question.

---

## 5. The precondition both curricula rest on: the Build Phase must telegraph the Pulse

Into the Breach's design goal — "every death felt like your own fault" — is achievable only because
the player is shown what is about to happen before they commit
([`research-notes.md`](research-notes.md) Section 1). The Nexus Pulse is non-interactive in exactly
the same sense. So:

**Every piece of information the player needs to evaluate a Build Phase decision must be on screen
during Build Phase.** Concretely, for PERIMETER:

- **The raid's arrival is drawn.** The approach edge is marked on the Grid, and the arrival tick of
  each scripted wave is stated. This is not a reveal of hidden information: the scripted schedule is
  authored data, the mission's briefing already tells the player the enemy is "inbound from the
  northwest ridge," and the fiction gives the reason for the precision — "it has already assigned the
  contact a name, a heraldry, and an estimated time of arrival." The mission's *own written text*
  already promises the telegraph. It would be strange not to build it.
- **The construct menu shows effect, not only cost.** Q30's Option A already includes cost/effect and
  a legality panel; this is a reason that scope is a floor rather than a nicety.
- **The draft's options are decidable from what is already visible.** An option whose value can only
  be known after the Pulse is a coin flip, and in a resolution the player cannot correct, a coin flip
  is the worst possible object.

**Developer cost, stated plainly:** the arrival telegraph is new Build Phase UI, and Milestone 5's
scope is deliberately small (Q30, Q37). This is the one recommendation in this whole pass that widens
a gated milestone, and it should be raised *with* Milestone 5 rather than assumed by it. See
[`two-audiences-audit.md`](two-audiences-audit.md) row 3.

---

## 6. Curriculum A — teaching "pick the right upgrade"

The draft is one pick per Build Phase, always, at the same moment — TFT's fixed-moment structure, for
the same reason: a decision the player can plan toward beats a decision that surprises them
([`research-notes.md`](research-notes.md) Section 7). Two options in the first three missions, three
from the fourth.

The teaching moves, in order, each one an **explicit authored beat** rather than something the player
might notice:

| Mission | The teaching move | The beat that names it |
| --- | --- | --- |
| 1 | **Both options win.** Two visibly opposed options — one helps the line hold, one helps you build faster — and the telegraphed raid makes either readable as sensible. The lesson is *that there is a pick*, not that there is a right one | One line at the draft: the interface offering, in the Citizens' register, without advising |
| 2 | **The pick is about the map, not the army.** One option is only good because this mission has wrecks in it — which the player can see. Lesson: read the mission, then the option | A pre-battle line pointing at the ground, not the choice |
| 3 | **The pick has to cover an absence.** With the Commander gone mid-Pulse, the useful pick is the one that holds without her. Lesson: pick for the situation you are about to be in | The mission's own `SYMBOL ABSENT` system line, which is already written |
| 4 | **The pick is the mission.** Three options now, and one arrives already chosen, marked `SOURCE: NEXUS`. Lesson: the pick has an opportunity cost — felt, because one was taken from you | Already written into the mission's premise |
| 5–6 | **No new draft teaching.** The draft is a habit and gets recombined with everything else | — |

Two rules generalize out of that column, and they are the reusable part:

- **An offered option must be decidable from information already on screen** (Section 5).
- **The debrief names the pick and one consequence.** "Plating held four hits it would not have held"
  — one authored line per option, and the loop from decision to outcome closes. Without it the player
  picks, watches an outcome, and has no way to attribute it, which in a non-interactive resolution
  means they learn nothing at all. This is cheap: it is one line of text per draft option, authored
  once.

---

## 7. Curriculum B — teaching "build a support-capable base"

"Support-capable" means: the base keeps producing, keeps its workers alive, and keeps the fight fed
*while the player cannot intervene*. No reference in the research notes teaches this, because no
reference has both a base and a resolution the player is locked out of
([`research-notes.md`](research-notes.md), final section). So it is derived rather than borrowed.

The derivation: the player's ability to intervene is already zero during the Pulse. What varies across
missions is **which layer of base competence the mission's failure will expose**. So teach by removing
the player's substitutes, one layer at a time:

| Mission | Layer taught | How the mission enforces it | What failure looks like |
| --- | --- | --- | --- |
| 1 | **Placement** — geometry, before anything is a rate | Player places only one or two units; the second objective is "keep the workers alive"; the raid's approach is telegraphed | A worker dies somewhere the player did not cover, visibly, on a small Grid |
| 2 | **Rate** — a base is a production rate, not a snapshot | Cannot be won with what is placed at commit; the producer has to make things during the Pulse | Player wins the first engagement and loses the second, having built nothing during |
| 3 | **Redundancy** — two of the thing that matters | With the Commander absent, a single producer's loss ends the mission | One structure dies and the run is over, legibly |
| 5 | **Protection** — workers flee, and need somewhere to flee *to* | The mission's own worker-count beat is about exactly this | Workers survive the fight and are lost anyway, in the open |

And one teacher that costs nothing because the faction already is it: **the Citizens' alignment bonus
teaches base geometry by being strong.** "Structures in unbroken orthogonal runs gain integrity or
arcs... the player draws Citizen geometry because it is strong, not because it is themed"
(`../../specs/commander-armies.md` Section 4.1). If the first buildable structure (Mission 1's unlock)
has an obvious adjacency payoff in Mission 2, the lesson delivers itself with no tutorial text at all.
That is the highest-leverage single item in this document: a faction identity already written, doing
teaching work for free.

**The explicit beat requirement.** The user's brief asked for these to be teaching *moments*, not
incidental to fiction. The rule: **each mission carries exactly one authored line that names its
lesson, spoken in the faction's own voice.** PERIMETER already has its: *VASSE: Whatever that rhythm
is, we build between its beats now.* That line is not decoration — it is the teaching beat for the
Build/Pulse loop, and it works because it names the lesson without explaining a mechanic. Every
mission gets one, and it is a required field alongside `teaches`.

---

## 8. The ramp, assembled

Contingent on **Q39** (campaign concept). Unlocks are named as **roles**, not content ids, except
where an id already exists on the bench — authoring roster content is Milestone 4's, per
`commander-armies.md` Section 1.

| # | Mission | The one lesson | Unlock granted (role) | Why that unlock, at that moment |
| --- | --- | --- | --- | --- |
| 1 | PERIMETER | The loop: you commit a plan, and the Pulse resolves without you | The military producer becomes buildable — `structure.citizen.barracks`, which exists, pre-placed here and buildable after | Mission 2 cannot be won by placement alone; it needs production *during* the fight |
| 2 | RIGHT OF SALVAGE | Salvage: the economy is made of the fight's own wreckage | A defensive structure role | Mission 3 asks the line to hold while the Commander is absent |
| 3 | RESTORATION | The Commander can die and play continues | The draft widens from two options to three | Mission 4's lesson *is* the draft; it must already be a habit before it starts misbehaving |
| 4 | PRECOMMITTED | The upgrade draft as a real choice — and one arrives already made | A longer-ranged unit role | Mission 5 needs an army big enough to lose count of |
| 5 | TWELVE OF TWELVE | The report and the replay are objects you read, not truths you accept | A mobility or repositioning upgrade role | Mission 6's hazard is evaded, not killed |
| 6 | ANNEX ZERO | A neutral hazard, hostile to nobody and lethal anyway | — (arc ends; the Manifest feeds skirmish) | — |

Every row satisfies rule 4.4: each unlock is the next mission's lesson-enabler. That is the property
worth checking whenever a row changes.

**One honest exception, recorded rather than smoothed over.** Mission 5's fiction wants the player to
*read a replay* — but a replay viewer changes neither the construct menu nor the draft, so under rule
2.2.4 it cannot be an unlock. It is a **menu feature gated by campaign progress**, which is a
different system with a different owner (Milestone 4's screen), and keeping the two apart is itself
part of the simplification. Mission 5's actual unlock stays a content role.

---

## 9. What this leaves for Mario

Two forks in this document are genuinely the owner's, and both are registered in
[`../../specs/open-questions.md`](../../specs/open-questions.md) with recommendations:

- **Q40** — is a mission's unlock fixed, or does the player choose one of two? (Recommendation: fixed.)
- **Q39** — the campaign concept itself, which decides whether Section 8's table is the right table at
  all. See [`campaign-concepts.md`](campaign-concepts.md).

Everything in Sections 2 through 7 is proposed as decidable now, because none of it depends on which
campaign gets built — the Manifest, the One Lesson Rule, the telegraph precondition, and both
curricula apply unchanged to any of the four concepts under consideration.
