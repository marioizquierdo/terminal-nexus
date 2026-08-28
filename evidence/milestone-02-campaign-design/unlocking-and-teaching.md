# Unlocking, and teaching one thing at a time

**Document role:** How unlocks work, the one-new-idea-per-mission rule, and how to teach the two decisions an autobattler actually has
**Status:** Draft for Mario to react to — Decision C is in Section 1.6
**Updated:** 2026-08-28
**License:** Apache-2.0

You described the intent already: finish a mission, unlock bases and Nexus powers, and the player
learns the units gradually. This is that, written as an actual system so every mission does not have to
reinvent it — and cut down as far as I could get it.

---

## 1. The unlock system

### 1.1 The whole thing, in five rules

1. **An unlock is one thing, and it is always the same kind of thing: a unit, a structure, or an
   upgrade.** Not four categories with four sets of rules. A commander ability is just an upgrade.
2. **You get it for finishing the mission. That is the only way to get anything.** No achievements, no
   optional objectives, no currency, no score.
3. **At most one per mission.** A rule, not a target. It forces you to choose the one thing that
   matters, it keeps the announcement to a single line, and it matches roughly how fast a player can
   learn a new symbol on a screen made of symbols.
4. **It has to change the build menu.** If finishing a mission grants something the player cannot see
   and use next time they build, it is not an unlock — it is flavour, and it should be a line in the
   debrief that grants nothing. This one rule kills "unlock a small stat bonus," "unlock a lore entry,"
   and "unlock a difficulty setting," which are the three ways this kind of system usually rots.
5. **Unlocks are permanent and only ever add.** A mission is still allowed to say "you own this, but
   not on this map" — that is ordinary mission design and every game in the research does it. But the
   list itself never shrinks. That distinction is what lets you stage a "you have lost everything"
   mission later without the progression system needing an exception.

### 1.2 What it is stored as

Two lists.

```json
{
  "campaign": "citizen-opening",
  "completed": ["perimeter"],
  "unlocked": ["fabricator"]
}
```

No tiers, no counts, no percentages, no medals. Everything a progress screen wants to show is
computable from those two lists plus the campaign definition, which means when a real save system
eventually exists there is exactly one small thing to save.

### 1.3 How the player finds out

Three places that already have to exist. No new screens:

- **The debrief tells them**, in one line, in the game's own deadpan voice. The kind of thing that
  reads as an institution reporting a fact and accidentally reporting something else:
  `PERMISSION RELEASED: FABRICATOR PATTERN` / `PATTERN PREDATES THE FABRICATOR`.
- **The campaign menu lists them** between missions, with anything new since last time marked.
- **The build menu contains it**, next mission, with its cost and what it does.

The third one is the real one. The other two are announcements. The build menu is where the unlock
stops being a notification and becomes a decision — which is the entire reason for rule 4.

### 1.4 Eight things I deliberately left out

Each of these is something a real game does well. Written down with the reason, so nobody re-adds one
by accident in six months:

| Left out | Who does it well | Why not here |
| --- | --- | --- |
| A currency you spend on unlocks | Into the Breach buys squads with achievement coins | Three systems — achievements, a currency, a shop — to deliver one grant, in a six-mission campaign |
| Unlocks that go into a random pool | Slay the Spire adds cards to what *might* appear | Its own players complain that unlocking more makes runs less consistent, and speedrunners deliberately keep the pool small. Your upgrade choice is two or three options wide, where dilution bites much harder than in a game with hundreds of cards |
| Unlocks you have to discover | FTL hides ships behind specific random events | The next mission has to be able to *assume* what the player has. You cannot write a teaching sequence against "maybe" |
| Optional side missions that grant things | Fire Emblem's side chapters | Doubles the authoring per mission and splits the teaching, so no later mission can rely on any lesson |
| Rarity or tiers | most of the genre | A second vocabulary the player has to learn, for six grants total |
| Per-unit upgrade trees | most strategy campaigns | Redundant with the Citizens' own identity — a Citizen upgrade is supposed to apply to every unit of that class automatically, including ones already built. The faction rule *is* the simplification |
| Ranks, medals or stars per mission | Advance Wars ranks, Into the Breach reputation | Implies replaying for score, which implies scoring, which implies balance data you do not have |
| A difficulty selector | nearly everything | No balance data yet, and per-mission tuning is just data — a mission that is too hard gets fixed, which is the same work and produces a better mission |

### 1.5 The biggest simplification of all

**There is no separate progression system.** The unlock list, the mission order, and the build menu are
all of it. No experience points, no levels, no research tree, no between-mission upgrade shop. The
player's power across the campaign comes from exactly two places: the six things they unlock, and the
one upgrade they pick each build phase.

That is worth saying out loud rather than leaving as an omission, because every row in the table above
is an attempt to add a *second* progression axis on top of that, and they all fail for the same reason:
a second axis needs enough missions to be felt, and six is not enough.

### 1.6 Decision C — fixed unlock, or a choice of two?

| Option | What it buys | What it costs |
| --- | --- | --- |
| **Fixed** — the mission grants the thing it declares | The next mission can *assume* what the player has, which is what makes a teaching sequence possible at all. One line of debrief text, no new screen | Less interesting per mission |
| **Choose one of two** | Genuinely more interesting, and it makes the campaign menu a place where something happens | Doubles the authoring (two options, both worth taking), and every later mission has to work under every possible combination of past choices. Needs a new screen |

**Recommendation: fixed** — but store it as a *list* with one item in it, so widening it later is a data
change and not a redesign.

The real argument for fixed is not simplicity. It is that a teaching campaign has to know what the
player knows, and "choose one of two" turns that into a probability distribution.

---

## 2. One new idea per mission

You said it yourself: adding one mechanic at a time, starting simple. This is that, made specific
enough to survive several people working on it.

The clearest existing example is the original Advance Wars tutorial, where each battle is *named after
the single thing it teaches*: Troop Orders, Terrain Intel, Base Capture, Unit Repair, Copter Tactics,
Climate Status. Commander powers come last, after the units and the terrain are understood. The
discipline is not in the ideas being small — it is in committing to the name.

### 2.1 The rule

1. **A mission teaches exactly one thing the player has never had to think about.** It is a declared
   field in the mission, not a comment.
2. **You cannot finish the mission without engaging it.** Otherwise the mission does not teach the
   thing, it merely contains it. Advance Wars' Base Capture cannot be won without capturing.
3. **Introduce it alone, use it again in the same mission, combine it in the next one — and do not
   stack a new idea on top of the combination.**
4. **A mission's unlock is what the *next* mission's lesson needs.** This is the rule that ties the two
   systems together and stops the campaign becoming a teaching order and a rewards order that happen to
   run alongside each other.
5. **The lesson must be legible to someone who skipped the briefing** — and legible in at least two
   places at once, never only as a symbol on the map. Dwarf Fortress is the standing reminder of what
   glyph-only communication costs in reach; when it finally shipped commercially it came with a tileset
   and a tutorial, and the simulation underneath had not changed.
6. **One lesson, one unlock, one relationship that changes, one question answered, one mystery opened.**

### 2.2 Making it stick without becoming bureaucracy

The mission files can carry two fields — what it teaches, and what it unlocks — and the repository's
existing checker can assert that both exist, that no two missions claim the same lesson, that the
unlock list has at most one entry, and that the thing being unlocked is real. That is about ten lines
of script and it turns an intention into a build failure, which is the only kind of design discipline
that survives a year.

With one caveat: make the "no two missions teach the same thing" part a **warning with an escape
hatch**, not a hard failure. A mission that genuinely wants to revisit an earlier lesson should be able
to say so. A checker that fights the designer is a checker that gets deleted.

### 2.3 The six missions, with their lesson and their unlock

Unlocks are described by their **job**, not invented as real content — deciding the actual roster is
separate work.

| # | Mission | The one new idea | What it unlocks | Why that unlock now |
| --- | --- | --- | --- | --- |
| 1 | PERIMETER | You commit a plan, and the fight resolves without you | The fabricator becomes something you can build | Mission 2 cannot be won by placement alone; you need to be producing *during* the fight |
| 2 | RIGHT OF SALVAGE | The economy is made of the fight's own wreckage | A defensive structure | Mission 3 asks the line to hold without your commander |
| 3 | RESTORATION | Your commander can die and the fight continues | The upgrade choice widens from two options to three | Mission 4 is *about* the upgrade choice; it has to be a habit before it starts misbehaving |
| 4 | PRECOMMITTED | The upgrade choice as a real decision — and one arrives already made for you | A longer-ranged unit | Mission 5 needs an army big enough to lose count of |
| 5 | TWELVE OF TWELVE | The report and the replay are things you *read*, not things you trust | Something that moves or repositions | Mission 6's hazard is something you get out of the way of, not something you kill |
| 6 | ANNEX ZERO | A neutral hazard, hostile to nobody and lethal anyway | — (arc ends) | — |

Every row satisfies rule 4: each unlock is what the next mission's lesson needs. That is the property
to re-check whenever a row changes.

**One honest exception.** Mission 5's story wants the player to sit down and read a replay — but a
replay viewer does not change the build menu, so by rule 4 it cannot be an unlock. It is a **menu
feature that opens up as you progress**, which is a different thing with a different owner. Keeping
those two apart is itself part of the simplification, and mission 5's actual unlock stays a unit.

---

## 3. Teaching the two decisions that actually matter

Once the Pulse starts the player is a spectator. So there are exactly two decisions in the game, and
both happen beforehand: **which upgrade to take**, and **whether the base can support the fight**.
Everything below is about teaching those two specifically, as deliberate moments rather than as things
a player might happen to notice.

No game in the research teaches the second one, because none of them has both a base *and* a fight you
are locked out of. Advance Wars, Fire Emblem and Into the Breach are all turn-based and directly
controlled; StarCraft is real-time and directly controlled; the only true autobattler in the list has
no base building at all — its preparation is shopping and positioning. So that curriculum is reasoned
from scratch rather than borrowed.

### 3.1 Teaching "pick the right upgrade"

The shape: **one pick per build phase, always, at the same moment.** Two options in the first three
missions, three from the fourth. Teamfight Tactics offers three choices at three fixed, known points in
a game, and the options are deliberately comparable in power rather than one being obviously better —
both of those are worth copying. Rerolling is not: cheap redraws are supposed to be a *Ravel* trait,
and giving them to the Citizens spends a faction's signature on a convenience.

| Mission | The teaching move |
| --- | --- |
| 1 | **Both options are winning picks.** Two visibly opposed choices — one helps the line hold, one helps you build faster — and the telegraphed raid makes either one readable as sensible. The lesson is *that there is a pick*, not that there is a right one |
| 2 | **The pick is about the map, not the army.** One option is good only because this mission has wreckage in it, which the player can see. Lesson: read the mission first, the option second |
| 3 | **The pick has to cover an absence.** With the commander gone mid-fight, the useful choice is the one that holds without her. Lesson: pick for the situation you are about to be in |
| 4 | **The pick is the mission.** Three options now, and one arrives already chosen, marked as coming from the machine. Lesson: the choice has a cost — felt, because one was taken away from you |
| 5–6 | Nothing new. It is a habit now, and it gets recombined with everything else |

Two rules generalise out of that, and they are the reusable part:

- **Every option must be judgeable from what is already on screen** during the build phase.
- **The debrief names the pick and one consequence** — *"the plating held four hits it would not have
  held"*. One authored line per option. Without it the player chooses, watches an outcome, and has no
  way to connect the two, which in a fight they cannot steer means they learn nothing at all.

### 3.2 Teaching "build a base that can support the fight"

The player's ability to intervene is already zero. What changes mission to mission is **which layer of
base competence the mission's failure will expose**. So teach by removing their substitutes, one layer
at a time:

| Mission | The layer | How the mission forces it | What failing looks like |
| --- | --- | --- | --- |
| 1 | **Placement** | You place only one or two things; the second objective is keeping workers alive; the approach is marked | A worker dies somewhere you did not cover, visibly, on a small map |
| 2 | **Rate** — a base is a production rate, not a snapshot | It cannot be won with what is on the map at commit; the producer has to be making things during the fight | You win the first engagement and lose the second, having built nothing in between |
| 3 | **Redundancy** — two of whatever matters | With the commander absent, losing one producer ends the mission | One building dies and it is over, legibly |
| 5 | **Protection** — workers run away, and need somewhere to run *to* | The mission's own count-of-the-dead beat is about exactly this | The workers survive the fight and are lost anyway, in the open |

And one teacher that is free because the faction already is it: **the Citizens' structure-alignment
bonus teaches base geometry by being strong.** Buildings in an unbroken line reinforce each other, so
the player draws Citizen geometry because it wins, not because a tooltip told them to. If the first
buildable structure has an obvious adjacency payoff in mission 2, that lesson delivers itself with no
tutorial text at all. That is the highest-leverage single item in this document — an identity you have
already written, doing teaching work for nothing.

### 3.3 Making them moments, not accidents

**Every mission carries exactly one authored line that names its lesson, in the faction's own voice.**
Not a tutorial popup — a line of dialogue that happens to be about the thing you are meant to notice.
The first mission already has its: *"Whatever that rhythm is, we build between its beats now."* That
sentence is not decoration. It names the lesson without explaining a mechanic, which is the difference
between writing and a manual.
