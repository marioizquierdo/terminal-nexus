# Milestone 2 — story, cast, and two structural set-pieces

**Document role:** Design proposal for Milestone 2 — the campaign's story at conceptual scale, how it opens, how the Ravel conflict escalates, how Vasse is introduced, a mission with a different Commander, and where the "lose everything and rebuild" beat would sit
**Status:** Proposal for owner review; nothing here is canon, and nothing here authorizes writing or code
**Updated:** 2026-08-27
**License:** Narrative material is CC BY-SA 4.0; structural analysis is Apache-2.0

Assumes Concept 0 ([`campaign-concepts.md`](campaign-concepts.md)) while **Q39** is open. Sections 1
through 3 are Concept-0-specific. Sections 4 and 5 are structural and survive any of the four
concepts.

---

## 1. The story, told in a few words

The brief asked for conceptual and terse — matching PERIMETER's own briefing rather than expanding on
it. So: no new prose, only spines.

**The campaign, in one line:**

> Something enormous woke up and started issuing us equipment. We took it.

**The arc, in three words:** **Recognised → Equipped → Enrolled.**

That is the belief ramp (`../../specs/campaigns.md` Section 4.1) compressed to the point where a
writer can hold all of it at once. Mission 1 is recognition; missions 2 through 4 are equipment;
missions 5 and 6 are the discovery that accepting equipment was enrolment in something with its own
purposes.

**The six missions, one line each, none over twelve words:**

| # | Mission | The line |
| --- | --- | --- |
| 1 | PERIMETER | Hold the fence. The pyramid is watching the fight. |
| 2 | RIGHT OF SALVAGE | Take the wreckage. The Nexus already knew whose it was. |
| 3 | RESTORATION | Vasse falls. The machine files it as a scheduling matter. |
| 4 | PRECOMMITTED | One decision was made for us. It was a defensive one. |
| 5 | TWELVE OF TWELVE | The count is correct. We watched it be wrong. |
| 6 | ANNEX ZERO | Something older arrives, hostile to nobody. The annex stops being located. |

**The one-word question the campaign never answers:** *Operator.*

---

## 2. Opening the campaign through Nexus events

The belief ramp's own first rule is that "revelations arrive as mechanics wherever possible"
(`campaigns.md` Section 4.1). Three ways to open, in increasing cost:

### Option 1 — the Pulse is the event *(costs nothing; already written)*

Do not open with a cutscene at all. The first Nexus event the player experiences is the first Nexus
Pulse they trigger themselves, and PERIMETER's already-written mid-mission interruption is the whole
revelation: *VASSE: Whatever that rhythm is, we build between its beats now.*

One sentence, delivered at the instant the mechanic first runs, that reframes the game's central loop
as something the characters are *accommodating* rather than operating. It is the ramp's own rule
executed perfectly, and it exists already. **This is the floor: the campaign is not worse than good
without spending anything.**

### Option 2 — the two-line cold open *(costs one tableau)*

Before the menu, before the briefing, two lines in the canon's own reversal form
(`terminal-nexus-lore.md` Section 10.2):

```text
SEISMIC ALERT
RECLASSIFIED: HARMONIC
```

Then the tableau: the pyramid, already up, drawn at a scale that does not fit the frame — the
`campaigns.md` Section 5 image, "The buried ruin had not grown. It had remembered its size."

Cheap, and it does the one thing Concept 0's opening otherwise lacks: the player meets the machine
before they meet a war.

### Option 3 — the interface arrives with the machine *(the expensive, best version)*

The cold open runs on a **pre-Nexus interface**. Plain colonial survey chrome. No `Operator`. No
Build Phase, no Nexus Pulse — those words do not exist yet. Then the pyramid rises, and the interface
*changes*: the vocabulary the entire rest of the game uses arrives at that instant, unannounced and
unexplained.

This is the strongest single idea in this pass. It plants mission 6's payload — that "Operator" is a
title that came *with* the software, not a rank anyone invented — in the first minute, as a mechanic
rather than a claim, and it never says a word about it. The interface misbehaves; it never testifies
(lore Section 7), and a vocabulary swap testifies to nothing.

It is also the most expensive cutscene the project could commission, because it needs a second
interface skin that appears once. See [`two-audiences-audit.md`](two-audiences-audit.md) row 10.

**Recommendation:** ship Option 1 (free, already written), add Option 2 when Milestone 9 has a
cutscene mechanism, and keep Option 3 as an explicit ambition costed against a later milestone rather
than smuggled into Milestone 9's scope.

---

## 3. Escalation, and how Vasse gets introduced

### 3.1 The escalation ladder — six words

The mistake available here is escalating by *quantity*: wave two is bigger than wave one. The better
ladder escalates by **what Corvane wants**, which costs nothing mechanically and changes the meaning
of every mission:

> **ground → material → person → authorship → instruments → indifference**

| # | What the enemy wants | What that does to the player |
| --- | --- | --- |
| 1 | **Ground.** Corvane tests the fence. Wire cutters, banter, an orderly withdrawal | Establishes the war as ordinary, which is what makes everything after it land |
| 2 | **Material.** Corvane wants the wreckage, not the position | The first reframe: the war is about what things are *made of*. And the Nexus names Corvane before contact — the itch |
| 3 | **The person.** Corvane targets the Symbol. Vasse dies | The ladder's honest rung: ground, then material, then a named human being |
| 4 | **Authorship.** The enemy is no longer only Corvane — the interface has another user | The antagonist stops being a person; the player's own tools are participants |
| 5 | **Instruments.** Corvane recedes. What is wrong is the player's own reporting | The war becomes epistemic. Nothing is attacking, and something is very wrong |
| 6 | **Indifference.** Corvane, in parley. Both sides against something that does not acknowledge either | The war was never the point, and both armies find that out together |

Six rungs, each a change in kind rather than degree, and none of them requires an enemy that is
mechanically stronger than the last. That matters for a project with no balance evidence: escalation
that lives in *intent* costs nothing to tune.

### 3.2 Introducing Commander Vasse

Q34 and Milestone 8 put Vasse on the Grid in Mission 1, while the belief ramp spends her death and
restoration at Mission 3. That looks like a tension. It is actually the correct structure, and it
should be stated as a deliberate choice rather than a compromise:

**Vasse is introduced by being ordinary, and becomes a Commander in the debrief.**

- **In the briefing**, she is a fact, not a choice: "Commander Vasse holds the ground with what walked
  out of the annex." The player is not asked to care yet.
- **On the Grid**, she is a strong unit that walks around. The *mechanic* (death, absence,
  restoration) exists and is testable — Milestone 8's actual deliverable — but the mission does not
  teach it, and per Q34's own recommendation PERIMETER should not force her death.
- **In the debrief**, she becomes something else, in two sentences that are already written:
  "Commander Vasse has accepted provisional connection status. Her first standing order: nobody thanks
  the pyramid."

That last line is the introduction. The character arrives fully formed in eight words — dry, faintly
hostile to the thing that chose her, and funny — and the mechanical fact (she is now restorable)
arrives at the same instant as the characterisation. This is Advance Wars' pacing exactly: the
commander layer lands *after* the units and the ground are understood
([`research-notes.md`](research-notes.md) Section 2), and it is Fire Emblem's principle that the
lesson and the cast introduction are one beat (Section 3 there).

Her first bark — *"By the book. The new book."* — is three words of character delivered at first
contact, and it is also, quietly, the campaign's thesis.

**Nothing new needs writing.** The introduction is already on the page; what this section decides is
only that it is deliberately *not* front-loaded.

---

## 4. A mission with a different Commander

Design only. `AGENTS.md` Section 2 and Q34 both hold: Milestone 8 builds one Commander (Vasse), and
authoring a second Commander Army is Milestone 4's reserved work. Everything below names people
already proposed in `../../specs/commander-armies.md` Section 4.4, so nothing new is invented.

### 4.1 The candidates

| Who | Faction | Their disagreement (already canon) | As what |
| --- | --- | --- | --- |
| **Marshal Avern Teag** | Citizens | "Security is not a phase of the emergency; it is the permanent condition." The faction's contradiction wearing a uniform | Ally, then rival |
| **Director Oru Denz**, "the Paver" | Citizens | Expansion as defence; believes the manifest destiny without the stoicism | Rival |
| **Speaker Corvane** | Ravels | The Nexus picked a conspiracy, not a government | Antagonist (already), or a one-mission perspective flip |
| **Old Marrow** | Ravels | The network itself should come down — every Nexus, his own included | A second, different antagonist |

### 4.2 Four placements, costed

**(a) Teag as a constraining voice at Mission 4 — cheapest, and thematically the sharpest.**
PRECOMMITTED's subject is "someone else made a choice for me." Teag arriving as a human authority who
*approves your build* — a second entity making your decisions, one explicable and one not — rhymes
with the Nexus precommitting a draft option, and lets the mission ask which of the two is worse.
Cost: a voice and one Build Phase constraint. No units, no package, no roster.

**(b) Teag as the playable Commander for one mission — the actual "mission with a different
Commander."** You are Teag: you may build anything, and you may not advance. Victory is surviving
with the perimeter *larger* than it started. The lesson is the wall as a strategy — and the discovery
that it works, which is the uncomfortable part. Cost: a starting package and one different draft on
otherwise identical faction content, which is genuinely the cheapest real Commander swap available.
Name: **CHANGE ORDER**, from the faction's own characterisation ("answers a defeat by filing a change
order", lore Section 8.1).

**(c) Corvane playable for one mission — the perspective flip.** You learn your enemy's rules by using
them. Enormous teaching value; enormous cost (a real Ravel package, against
`commander-armies.md` Section 6's authoring order).

**(d) Old Marrow as a second, differently-motivated antagonist.** A mission where the enemy's objective
is not "kill you" but "bring the Nexus down" — including his own. Costs a second scripted schedule and
no new player content, and it is the cheapest way to teach that an opponent can have an objective.

### 4.3 Recommendation

**Teag. (a) inside the belief ramp at Mission 4, and (b) as the opening of arc 2 — not inside the six.**

The reason (b) does not belong inside the ramp is the One Lesson Rule
([`progression-system.md`](progression-system.md) Section 4): a mission where the player has a
different Commander teaches two things at once — its own lesson, and "your Commander changed." All six
lessons in the ramp are already spoken for, and inserting a seventh means demoting one. Arc 2's
opening has no such constraint, and it pairs naturally with Concept C
([`campaign-concepts.md`](campaign-concepts.md)) — the Citizens-versus-Citizens opening that was too
grey for hour one and is exactly right for hour six, once the faction's internal argument means
something to the player.

Placement (a) costs almost nothing and gives the player the character six missions before they play
her, which is what makes (b) land when it arrives.

Registered as **Q42**.

---

## 5. The "epic opening, then lose everything, then rebuild" set-piece

Explored, not designed to build. The brief was explicit that this level gets built last, and this
section's conclusion agrees with that for reasons of its own.

### 5.1 What the trope actually needs

The trope's engine is **contrast**, and contrast has a precondition most implementations get wrong:
the player must have *used* the power, not merely been shown it. Metroid Prime's opening gives the
player the full suit and lets them fight with it before stripping it; Homeworld's second mission
returns the fleet to a homeworld that no longer exists after the player has spent a mission believing
in it. (Both from general knowledge rather than a source read this session — unlike the Into the
Breach reading below, which is cited in [`research-notes.md`](research-notes.md) Section 1.) Into the Breach solves the same problem differently and cheaply — the game's entire framing is
that you are the survivors of a timeline that was already lost, so the loss is premise rather than
scene.

So the requirements are: real power, really used, then removed for a reason the player reads as **not
their fault**, and a rebuild whose smallness is legible against the memory. The failure mode is
specific and nasty: an unwinnable mission that reads as "I was cheated" is worse than no prologue at
all.

### 5.2 Three placements

**A — Mission 0, a prologue before PERIMETER.**
You command annex security at full strength: a real base, a real army, real upgrade choices. The
Activation happens *during* the mission — the pyramid rises through your base and destroys it. You
lose the map to the ground, not to an enemy. Then PERIMETER is literally "what walked out of the
annex."

- *Fits the fiction exactly.* `campaigns.md` Section 4 already says the Prime Nexus rises "destroying
  the research annex," and PERIMETER's briefing already opens "Fourteen hours ago the survey annex
  stopped existing." The prologue is a scene the canon has already written the aftermath of.
- *Carries the Section 2 Option 3 idea natively.* The prologue is the one mission that plausibly runs
  on the pre-Nexus interface, so the vocabulary swap happens at the moment the pyramid rises. Both
  ideas pay for one cutscene between them.
- *Needs:* a larger map; scripted terrain destruction at a tick (an engine capability
  `commander-armies.md` Section 4.3 already names as unbuilt, wanted by Alder); a defeat that is a
  scripted outcome rather than a failure state; and — the real cost — **a full-power roster for one
  mission**, authored, never seen again. That is precisely the roster authoring
  `commander-armies.md` Section 1 forbids before Milestone 4.

**B — recontextualize PERIMETER itself as the rebuild.**
No new mission. PERIMETER's opening Build Phase simply shows the annex's wreckage and salvage already
on the Grid, and the briefing does the rest — it already does: "a perimeter that exists chiefly in
this briefing." Cost: near zero. Weakness: the player never held the big army, and telling is not
contrast. This is the consolation prize, and it is a real one.

**C — after the ramp, as the arc-2 turn.**
Put the beat at the *end* of arc 1 instead of before it. The player has spent six missions
accumulating a Manifest; then a mission takes it all away. The big army is the army the player
actually built — no throwaway roster, no authored power fantasy, and the contrast is earned rather
than granted.

It also needs **no change to the progression system**: the Manifest never subtracts, but a mission may
restrict through `availableContent` ([`progression-system.md`](progression-system.md) Section 2.2,
rule 5). The player still owns everything; they just do not have it *here*. That the system already
supports this without an exception is a good sign the system is shaped right.

### 5.3 Recommendation

**C as the design, A as the ambition, B as the free consolation — and build none of it now.**

C is stronger than A on the trope's own terms (earned contrast beats granted contrast) and costs a
fraction as much. A remains worth wanting, for the interface-swap reason more than the spectacle, and
if it is ever built it should be built **last**: it is the mission that most needs mature tooling —
scripted terrain destruction, a second interface skin, and a defeat that is not a failure state — and
the one where getting it wrong damages the game's first ten minutes rather than its middle.

B costs a sentence of Build Phase set-dressing and can go in whenever PERIMETER is authored.

Registered as **Q41**.
