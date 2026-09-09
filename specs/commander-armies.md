# Terminal Nexus — Commander Armies

**Document role:** Playable faction packages: Commanders, units, structures, upgrades, and Nexus powers
**Status:** Canonical identity direction; rosters intentionally undefined
**Canon version:** 2.12
**Updated:** 2026-09-09
**License:** Creative identity is CC BY-SA 4.0; mechanical definitions and schemas are Apache-2.0

## 1. Purpose

A **Commander Army** is the playable content package that defines every choice available to one player during a battle. The faction supplies the broad doctrine, economy, visual language, and most common content. The chosen Commander supplies a starting package, smaller asymmetries, Nexus powers, upgrade emphasis, and a few roster changes.

The player therefore chooses a Commander Army, not an abstract faction plus an unrelated hero.

This document will eventually define:

- each Commander/Nexus Symbol;
- starting Nexus, resources, workers, Commander, and starting army;
- legal units and the structures that produce them;
- economic, supply, research, outpost, capture, and defensive structures;
- upgrades and draft families;
- Commander abilities and Nexus powers;
- faction rules and Commander-specific exceptions;
- semantic glyph roles, inspection portraits, barks, and effect motifs;
- intended strengths, weaknesses, counters, and build archetypes.

No complete roster has been earned yet. Do not invent production-ready stats before Milestone 12 selects the minimum Citizens-versus-Ravels microgame.

**Two fixture armies exist on the bench** (Milestone 1) and neither is a Commander Army: a Citizen set from `milestone-1-spike-battle.md` 3.6, and a Ravel set added at Gate 1B so `grid` could show two styles of fight rather than one fight twice. They are disposable, tuned for contrast rather than balance, and Milestone 12 is still what selects the real microgame. What they proved is worth carrying forward:

- three of the four Ravel rule shapes in Section 4.1 needed nothing new from the kernel — rates off the Citizen cadence, lower speed tiers, richer salvage;
- the fourth, **volatile munitions**, needed a rule, and it is the one that made the faction legible without a word of lore. A stats-only Ravel army failed the alignment test in `terminal-nexus-lore.md` Section 8.6; the rule passed it. Chains are bounded because an entity can only die once, so a cascade resolves inside the tick that started it;
- **jackpot drafts** and **scrap doctrine** were not built, because both need an economy and a draft. They remain the two Ravel shapes with no evidence behind them;
- building the second army was also an audit: it found a Citizens-only assumption inside the kernel within an hour. That is an argument for authoring the second of anything early.

For faction philosophy, conflicts, colors, and glyph vocabulary, read [`terminal-nexus-lore.md`](terminal-nexus-lore.md). For mechanical interfaces, read [`engine.md`](engine.md).

## 2. Relationship between faction and Commander

Each faction should eventually support two or three Commanders. Commanders share most faction content, but each may vary:

- the starting package;
- one or two legal units or structures;
- faction-rule modifiers;
- Nexus powers;
- draft weights or upgrade families;
- the relative value of economy, defense, production, research, or Commander investment;
- one political or philosophical interpretation of the faction.

The differences should be smaller than the differences between factions but large enough to produce a distinct opening and one recognizable build path.

The Commander is a prominent frontline `@`, not only a portrait or menu choice. It returns after a one-cycle absence when killed. Commander-focused builds should be viable but should compete with army, economy, science, and fortification strategies.

### 2.1 The faction is the pool; the army is the deck — RULE for the boundary and the three tiers; GUIDANCE for the numbers

**Owner direction, canon 2.10.** Mario: "the faction is like the whole pool of 'cards' and the army
is like the actual deck used during a single fight." A faction defines *everything its civilization
can field* — every unit, structure, upgrade, and Nexus power. A Commander Army fields **a few of
them**. Nothing a match, a Pulse, or a renderer touches ever sees a faction; it sees an army. That
boundary is what the rest of this section protects.

What a player can do during one match splits three ways, and the split *is* the gameplay:

| Tier | What it holds | Who decides it | When it is available |
| --- | --- | --- | --- |
| **Common structures** | the structures every Commander of the faction can always build, and the units those structures produce | the faction | always; never drafted, never unlocked |
| **Army structures** | the special structures this Commander Army brought — a subset of the faction's structure pool — and their units | the Commander Army: authored, grown through a campaign's unlocks, or drafted in a future drafting mode | fixed for the whole match |
| **Nexus powers** | the powers the Grid Nexus can deal — a subset of the faction's power pool | the army defines the pool; **the Nexus deals a small hand from it at the start of every Build Phase, and the player keeps one** | dealt each Build Phase |

Around those three sit the things that frame the deck rather than fill it: the Commander, the
starting package, the faction's rules (Section 4.1) and the Commander's exceptions to them.

**Consequences worth designing for now, before a roster exists:**

- **Keep the common tier small.** Economy, supply, one basic producer, one basic defence. If the
  shared core is most of what a player builds, two Commanders of the same faction play the same and
  the deck stops mattering — the oldest lesson of every deck-building game. Anything with a signature
  belongs in the army tiers.
- **Deck size is a number, and a fixed one.** An army carries at most *N* army structures and *M*
  Nexus powers. The numbers are Milestone 12's to decide on evidence — three to five structures and
  six to ten powers are the working guesses — but a cap is not optional: a cap is what makes a choice
  a choice, and what makes drafting a game rather than a menu.
- **Legality is data validation.** An army may reference only content from its own faction's pools,
  within the caps, checked at load time the way every scenario field already is. This is the
  deck-legality check of every card game, and it is what makes accepting a player-defined Commander
  safe later: the loader, not a reviewer, says whether a deck is legal.
- **Three producers, one shape.** A first-party authored army, a campaign's progression (the unlock
  record of Q31 is literally cards added to the player's deck between missions, and Milestone 4's
  army panel is the deck laid out), and **the run draft** of Challenge mode — add, remove, or
  upgrade a card between battles ([`game-modes.md`](game-modes.md) Section 3.2) — all produce the
  same `CommanderArmyDefinition`. The match never knows which one did. A player-built army at match
  start is a fourth producer of the same shape, still undesigned.
- **Every card carries `rarity`, `tier`, and `role` from the day it is authored**
  ([`game-modes.md`](game-modes.md) Section 4). Rarity is how often a draft offers it, tier is the
  earliest depth it may appear at, role is what it is for — and both modes read all three: the
  Campaign unlocks by tier, a run deals by rarity and varies by role. A card without tags cannot be
  dealt, which is the cheapest possible way to make sure nobody forgets them.
- **Alder fits without an exception.** Their refusal (Q11) is a near-empty Nexus power pool and a
  larger structure pool — expressed by the numbers, not by a special case in the model.

The sketch, in the same spirit as [`engine.md`](engine.md) Section 8 — names will move the first
time real content touches them:

```ts
interface FactionDefinition {
  readonly id: ContentId
  readonly commonStructures: readonly ContentId[]  // tier 1: always buildable by any Commander
  readonly structurePool: readonly ContentId[]     // tier 2 candidates
  readonly nexusPowerPool: readonly ContentId[]    // tier 3 candidates
  readonly upgradePool: readonly ContentId[]
  readonly rules: readonly ContentId[]             // the faction's rule shapes (Section 4.1)
  readonly commanders: readonly ContentId[]
}

interface CommanderArmyDefinition {
  readonly id: ContentId
  readonly faction: ContentId
  readonly commander: ContentId
  readonly startingPackage: ContentId
  readonly structures: readonly ContentId[]        // ⊆ faction.structurePool, at most N
  readonly nexusPowers: readonly ContentId[]       // ⊆ faction.nexusPowerPool, at most M
  readonly upgrades: readonly ContentId[]          // ⊆ faction.upgradePool
  readonly ruleExceptions: readonly ContentId[]
}
```

Where this shows on screen: the Build Phase construct menu lists the common tier and the army tier
as two groups under one digit sequence, and the Nexus draft is its own panel — three tiers, three
places, so a player learns the split by looking at it
([`engine.md`](engine.md) Section 9.2, [`../milestones/milestone-05-build-phase.md`](../milestones/milestone-05-build-phase.md)).

### 2.2 Nexus, faction, and Commander — the affinity model — GUIDANCE

There are **five Prime Nexuses, one per faction** ([`terminal-nexus-lore.md`](terminal-nexus-lore.md)
Sections 3–5). A Prime is rooted and never travels; it replicates a Grid Nexus and sends one
psychically connected Commander with it. Many people claim a connection. Few receive an answer.

**A Commander is not the faction's employee. They are the Nexus's signature.** The gap between those
two things is design space, and it is wider than "which faction am I playing":

| Affinity | The story | What it means mechanically |
| --- | --- | --- |
| **Native** | of the faction, loyal to it | the default: one faction's pools |
| **Estranged** | of the faction, at odds with what it has become | same pools; the doctrine argues with the faction's own rule shapes |
| **Unsanctioned** | the Nexus chose someone the faction would never have (Anthem, Section 4.4) | same pools, an unusual starting package, one rule exception |
| **Foreign** | not of the faction — a client people, a contractor, a prisoner, something with no faction at all | the army is the faction's; the Commander's own powers are not |
| **Dual-bound** | two Primes answer the same person | the army's legality names two factions and draws from both pools |
| **Proxy** | the connection runs through a record, a relic, or a process rather than a living person | powers key on death, absence, and restoration rather than presence |

**None of these needs a special case in the model**, which is the reason to write them down before a
roster exists: an army is already a deck validated against named pools (Section 2.1), so *dual-bound*
is an army whose legality check names two factions, and *proxy* is an army whose powers lean on the
death/absence/restoration cadence [`engine.md`](engine.md) Section 5.1 already specifies. Affinity is
fiction plus data. It is not new machinery.

Two constraints keep it from turning to mush:

- **The faction still owns the roster.** A Foreign or Dual-bound Commander does not get a private
  army — they get an unusual *hand* of pools they are legal for. A player must still learn one
  faction to play them.
- **Affinity must be legible in play, not only in the codex.** The alignment test
  (`terminal-nexus-lore.md` 8.6) applies to Commanders too: if a Dual-bound Commander does not
  visibly behave like someone two machines are arguing over, the affinity is decoration.

## 3. Strategy-design requirements

Terminal Nexus should layer counterplay across several dimensions rather than reduce every matchup to one unit triangle:

- unit abilities and target profiles;
- aggression, defense, economy, and long-term research;
- fast disruption versus slow compounding value;
- formation and spawn geometry;
- supply and production contention;
- worker pressure, salvage, and territory denial;
- Commander presence, death, absence, and restoration;
- map terrain and chokepoints;
- drafted upgrades that enable specific build combinations.

Faction asymmetry reduces the number of options each player must understand while preserving depth across matchups. Every Commander Army needs:

- at least two credible strategic plans;
- an exploitable weakness;
- a readable reason its counters work;
- recovery paths that do not erase consequences;
- a mechanical identity visible without reading lore.

## 4. Faction mechanical identities — direction

This section records each faction's **mechanical identity**: the rule-shapes that make its philosophy
playable, the signature moment those shapes exist to produce, and the smallest engine capability each
one needs. It contains no stats, no rosters, and no authorization — Milestone 12 still selects the
deliberately tiny Citizens-versus-Ravels microgame, and everything here competes for a place in it or
in later milestones.

The standard every entry must meet is the alignment test from
[`terminal-nexus-lore.md`](terminal-nexus-lore.md) Section 8.6: **a player who has never read a word
of lore should be able to state the faction's philosophy from play alone.** A themed reskin of a
generic ability fails that test. A rule that *is* the characterisation passes it.

### 4.1 The rule is the character

**Citizens — Build.**

| Rule shape | What it does | What it teaches without words |
| --- | --- | --- |
| Standards propagate | An upgrade applies to every unit of its class, including units already fielded | A good idea belongs to everyone; the many move as one |
| Alignment bonus | Structures in unbroken orthogonal runs gain integrity or arcs | The player draws Citizen geometry because it is strong, not because it is themed |
| Shared cadence | Every Citizen ground unit steps on the same beat | The army is one machine, and the player is its engineer |
| Scheduled everything | Citizen recipes and drafts carry the game's lowest variance | A standard is a promise; the schedule is kept |

**Ravels — Break free.**

| Rule shape | What it does | What it teaches without words |
| --- | --- | --- |
| Volatile munitions | Many Ravel things detonate on death — theirs, and what they kill; chains are legal and bounded | Everything is fuel, and endings are loud |
| Jackpot drafts | The widest, wildest Nexus draft: cheap redraws, real duds, real jackpots | Improvisation is a rules verb, not a mood |
| Scrap doctrine | Faster salvage extraction, and detonations shed extra salvage | Even losses pay forward; freedom eats what empire wastes |
| Off the beat | Movement rates deliberately off the common cadence — `6/5` against `1/1` | Nothing marches; everything scrambles |

**Glitch — Recompile.**

| Rule shape | What it does | What it teaches without words |
| --- | --- | --- |
| Recompilation | Producers consume nearby salvage to discount or accelerate recipes | The dead — anyone's dead — are a deposit |
| Attrition inversion | Sustained trades bend toward Glitch by arithmetic | You cannot win a war of losses against the thing that eats losses |
| Corruption | Area unsettlement that taxes enemy movement, drawn under the corruption law (Q4) | Where the swarm has been, the Grid itself runs wrong |
| Convergence | Glitch variance decreases as the match runs — early rolls mutate, late rolls lock | Iteration: every error narrows the next build |

**Feudals — Obey.**

| Rule shape | What it does | What it teaches without words |
| --- | --- | --- |
| Fealty adjacency | Doctrine effects flow from a liege to adjacent vassals; the org chart is drawn on the Grid | Power is a chain, and the chain is literal |
| Living shields | Submitters intercept damage for adjacent higher castes | The caste system is a damage-routing rule |
| Consecrated artillery | The longest range in the game, usable only under a Cleric's standing rite | Every power routes through hierarchy; nothing fires alone |
| Conditional certainty | In sanctioned formation, the game's most reliable outcomes; with the hierarchy broken, its least | Obedience converts chance into certainty |

**Alder — Outgrow.**

| Rule shape | What it does | What it teaches without words |
| --- | --- | --- |
| Displacement | Signature attacks move enemies instead of damaging them — into water, thorns, or each other's paths | Position is the resource, and the Grid is the weapon |
| Growth | Alder works are planted cheap and mature over Pulses — sapling, grove, bastion | Time is currency, and patience compounds |
| Cycles | Grid-wide scheduled events — flood, bloom, frost — that both players can read and only Alder can seed | Announced physics, not traps: inevitability you can watch coming |
| Phase variance | Alder outcomes are certain but scheduled; the uncertainty an opponent feels is *when*, never *whether* | Nature does not gamble; it takes turns |
| Refusal | Little or no Nexus draft; progression lives in a wider catalogue of grown structures instead | They take nothing from the core — what they have, they grew |

Alder's refusal is mechanical, settled at concept level (Q11): **little or no Nexus draft, and more
complexity in the structures they can grow.** Where every other faction deepens through drafted
upgrades, Alder deepens through its catalogue of works — the faction with the least to choose from at
the Nexus and the most to choose from on the Grid. The exact split waits for a milestone that
authorizes Alder content.

### 4.2 Variance is doctrine

Every faction declares a relationship to chance, because a probability distribution is a philosophy a
player can feel without reading a word:

| Faction | Relationship to chance | The philosophy it expresses |
| --- | --- | --- |
| Citizens | Minimal variance — a delta function | A standard is a promise; the schedule is kept |
| Ravels | Maximal variance — fat tails, real jackpots, real duds | Luck is the universe still open at the top |
| Glitch | Variance converging toward zero as the match runs | Iteration: every error narrows the next build |
| Feudals | Variance conditional on formation | Obedience converts chance into certainty; disorder is punished |
| Alder | Variance in phase, never in outcome | Inevitability: the *when* breathes, the *whether* does not |

All of it draws from the seeded gameplay stream ([`engine.md`](engine.md) Section 4.4). A "lucky"
faction is still deterministic per seed, replay-exact, and testable — volatility is a shape of the
distribution, not an exemption from determinism. The player-facing consequence differs anyway: a
Citizens replay teaches the plan; a Ravels replay retells the story.

### 4.3 Signature moments and the capabilities they need

Each faction's signature moment (defined in [`terminal-nexus-lore.md`](terminal-nexus-lore.md)
Section 8) implies a smallest engine capability. Where the current engine cannot express the moment,
that is recorded here as roadmap input, not worked around in fiction:

| Signature moment | Faction | Smallest capability that unlocks it |
| --- | --- | --- |
| The line holds | Citizens | Derived per-tick modifiers: bonuses computed as a pure function of the state at tick start (adjacency, alignment, overlapping arcs). Fits the narrow-hook sketch in [`engine.md`](engine.md) Section 8 |
| The cascade | Ravels | Event-triggered effects: on-death area damage resolving inside the tick's Resolution step, with cascades bounded by a decreasing progress measure — the same discipline arbitration already has |
| The second wave is larger | Glitch | Production recipes with Grid-state inputs: a producer consuming salvage tiles within a radius. A small extension of `ProductionRecipe` |
| The shield dies standing | Feudals | Damage interception: a Resolution-step rule redirecting damage between adjacent units, deterministic under the existing tick order |
| The Grid turns | Alder | Two capabilities: forced displacement — moves imposed on enemies, resolved through the same collision masks and tie-breaks as voluntary intents — and scheduled terrain mutation — tiles changing cost or passability at a declared tick, emitted as first-class events |

Scheduled terrain mutation also serves Glitch corruption as a temporary movement-cost overlay — one
capability, two factions, opposite meanings. That kind of leverage is what makes a capability worth
its complexity. Every capability above must execute inside the deterministic kernel and emit events;
none may live in presentation, and none is authorized until a milestone needs it.

### 4.4 Proposed Commanders

Identity proposals only — names, stances, and the disagreement each embodies. Rosters, stats, and
starting packages remain undefined until a milestone authorizes them. Each trio or pair deliberately
stages the faction's internal argument, per the design law's requirement that Commanders disagree.

**Citizens**

- **Commander Edda Vasse** — the provisional Symbol of the origin campaign: a perimeter officer who
  never asked for the connection. Doctrine: fortify, verify, then advance. Her disagreement: the
  Nexus should answer to civilian audit the day the emergency ends.
- **Director Oru Denz**, "the Paver" — doctrine: expansion as defense; roads, outposts, and coverage
  as weapons. His disagreement: he believes the manifest destiny without the stoicism.
- **Marshal Avern Teag** — doctrine: the wall, everywhere. Her disagreement: security is not a phase
  of the emergency; it is the permanent condition. The faction's contradiction, wearing a uniform.

**Ravels**

- **Speaker Corvane** — the Symbol the Ravel Prime chose at the Activation. Doctrine: hit the supply,
  free the workers, vanish. Their disagreement: the Nexus picked a conspiracy, not a government, and
  Corvane intends to keep it that way.
- **Pella Vey** — the scavenger of *Nothing to Declare*, flying with the freed process `?`. Doctrine:
  salvage first, jackpot drafts, nothing wasted. Her disagreement: freedom includes freeing Glitch
  processes, which unnerves everyone else at the fire.
- **Old Marrow** — a demolitionist elder. Doctrine: everything detonates, on a timer if possible. His
  disagreement: the network itself should come down — every Nexus, theirs included.

**Glitch**

- **Custodian Vessel** — the Queen's oldest signed process. Doctrine: convert, archive, preserve the
  patterns of the fallen. Its disagreement: assimilation is rescue.
- **The Deprecator** — a newer signature. Doctrine: pure attrition; delete without archiving. Its
  disagreement: archiving is sentiment, and sentiment is an error. The quiet horror is that the Queen
  signs both.

**Feudals**

- **Duo Sere-and-Vail** — a paired sovereign, one office in two bodies. Doctrine: formation supremacy
  and artillery liturgy. Their disagreement: the castes are eternal because they are true.
- **Cleric-Militant Ottavan** — doctrine: the rites, weaponized. His disagreement: the Duos reign,
  but the Clerics rule.
- **Anthem** — a Submitter the Nexus chose as a Symbol, to the church's horror. Doctrine: the wall
  fights for itself. Their disagreement: obedience should flow sideways — the castes holding each
  other up, not the throne. The *Open Hand* seed, become a Commander.

**Alder**

- **Warden Oleth** — patience absolute. Doctrine: cycles, floods, and sieges measured in seasons.
  Their disagreement: the war is weather; outlast it.
- **Thorn-Regent Cail** — the interventionist. Doctrine: prune early — displace, divide, and remove
  claimants before they mature. Her disagreement: refusal without action is complicity. The faction's
  contradiction, wearing armor.

### 4.5 What a Nexus power may do — the six instruments — GUIDANCE (Q42)

[`engine.md`](engine.md) Section 5.4 says the Grid Nexus "offers a small draft of upgrades" and
admits none of it is designed. This is that design, at the only level that has to be settled before a
panel renders one: **six kinds of effect**, derived from what the lore already says a Prime holds and
grants — "patterns, permissions, and incomplete technologies," unlocked as "a protocol tier, artifact
permission, pattern, vision, or route" ([`terminal-nexus-lore.md`](terminal-nexus-lore.md) Section 3).

| Instrument | Effect | Example | What the UI has to show |
| --- | --- | --- | --- |
| **Permit** | adds a structure to the construct menu for the rest of the match | a wall segment; an artillery battery; a forward outpost | a new row in the menu, marked new |
| **Requisition** | puts materiel on the Grid now — units, at a place, at a moment | a squad arrives beside the Nexus at Pulse start | where it lands and when |
| **Revision** | changes a content definition for the rest of the match | every trooper gains integrity — for Citizens, *including the ones already fielded* | which definitions moved, and that fielded units are included |
| **Amendment** | changes a rule for the rest of the match | movement costs less inside your own coverage; adjacent defences pool integrity | the rule in one line, and where it applies |
| **File** | changes the Commander | an aura, a death trigger, a restoration behaviour | the Commander's own panel |
| **Survey** | grants information | next Pulse's arrival lane and composition | the information, marked as sourced from the Nexus |

Three things this taxonomy is for:

1. **It bounds the card schema before three milestones render it.** Six shapes is a small union that
   Milestones 5, 8, and 11 can all draw; a seventh should have to argue for itself.
2. **It makes information a card rather than a default.** `Survey` exists so that knowing what is
   coming is something a player *spends a pick on* — which is what keeps a hidden simultaneous plan
   worth hiding. A HUD that always shows the next wave has quietly deleted the game's central tension.
3. **The names are faction vocabulary over one mechanism.** Citizens issue permits and revisions;
   Ravels would call the same six a score, a haul, a rig, a bodge. One taxonomy, five vocabularies —
   the same trick the glyph-family/ownership-colour split already uses.

Nothing here is authorized to build. Milestone 8 builds two or three instruments for one mission;
Milestone 12 is where the pool earns breadth.

### 4.6 Starter Commander candidates — five cards, for selection — GUIDANCE (Q43)

Five candidates for the Citizens' first playable Commander, written as direction rather than
definition: **the first three are conservative**, built on archetypes that are known to work and on
the three proposals Section 4.4 already names; **the last two are deliberately risky**, and exist to
find out how much of Terminal Nexus's own strangeness a Commander can carry. Instrument names below
are illustrative (Section 4.5's six kinds), not a locked pool.

All five are bound to **the Apex** (`terminal-nexus-lore.md` Section 3.1). The differences between
them are doctrine and *affinity* (Section 2.2) — which is the point of showing five.

#### 1 · Commander Edda Vasse — "the Perimeter" — Native, unwilling — **conservative, the default**

**Personality.** Dry, procedural, tired. Answers awe with paperwork and grief with a form. Her
composure is not calm; it is a decision she makes every morning. *"By the book. The new book."*

**Backstory.** A perimeter officer who happened to be the nearest living witness when the Apex woke,
and has been receiving countersignatures for orders she never filed ever since.

**Play-style — hold and repair.** The forgiving one. Slow, tough, recoverable: defences are cheap,
damage is reversible between Pulses, and a line drawn well is worth more than a line drawn wide. A
player who misplays a Pulse with Vasse loses ground, not the mission.

**Signature synergy — repair × adjacency.** Citizens' alignment bonus already rewards unbroken
orthogonal runs; her instruments make those runs *heal each other*, so geometry compounds instead of
merely adding. The lesson she teaches is the faction's whole thesis: a good plan holds under load.

**Instruments.**

- `PERMIT: BULWARK` — a cheap 1×3 wall segment (Section 7's own wall-as-unit note, as a structure).
- `PERMIT: AID STATION` — repairs adjacent structures and units each Pulse.
- `AMENDMENT: MUTUAL SUPPORT` — structures in an unbroken run share integrity; breaking the run ends it.
- `REVISION: PLATE` — every trooper gains integrity, fielded ones included.
- `FILE: STANDING ORDER` — units adjacent to Vasse take reduced damage while holding ground.
- `SURVEY: EARLY WARNING` — next Pulse's arrival lane and composition, during Build Phase. *Verify, then advance.*

**Why her.** She is the tutorial's own argument, she is already written into PERIMETER's briefing and
barks (`campaigns.md` Section 4.2), and her mistakes are survivable — which is the entire job of a
first Commander. **What she costs:** she cannot take ground. A Vasse player who never learns to
attack will stall in Level 4.

#### 2 · Director Oru Denz — "the Paver" — Native, instrumental — conservative

**Personality.** Relentlessly cheerful, speaks fluent infrastructure, believes the manifest destiny
without the stoicism that is supposed to come with it. Treats a war as a scheduling problem with
better funding.

**Backstory.** A works director who filed a road permit with the Apex as a joke, and received it
approved, countersigned, and back-dated to a year before the colony existed.

**Play-style — coverage and tempo.** The macro archetype: outposts, roads, more workers, more ground.
Fragile early and frightening late; the player learns why territory *is* the resource.

**Signature synergy — coverage × movement.** His own ground is faster to cross, so his reinforcements
arrive earlier than the map says they should — a defence that works by being everywhere slightly
sooner rather than by being thick anywhere.

**Instruments.**

- `PERMIT: OUTPOST` — projects construction coverage forward and anchors regroup (the outpost idea Q23 parked).
- `AMENDMENT: ROADWORKS` — tiles inside your coverage cost less to cross. (Scheduled terrain mutation — one capability, three factions; Section 4.3.)
- `PERMIT: DEPOT` — forward storage and production.
- `REQUISITION: SECOND SHIFT` — an extra worker at each producer, this Pulse only.
- `REVISION: PREFAB` — structures placed adjacent to existing ones cost less.
- `SURVEY: CORE SAMPLE` — reveals a deposit the survey missed.

**Why him.** He teaches the economy without a lecture, and he is the natural second campaign: the
player who held the line with Vasse now learns to spread. **What he costs:** a bad opening is
genuinely punishing, which is why he is not first.

#### 3 · Marshal Avern Teag — "the Wall" — Native, and the Apex agrees with her — conservative

**Personality.** Cold, exact, and entirely reasonable, which is the problem. Security is not a phase
of the emergency; it is the permanent condition, and she can show you the projections.

**Backstory.** She signed the colony's emergency powers into permanence, and the Apex countersigned a
revision she had not written yet.

**Play-style — area denial and artillery.** Static power: range, splash, and slowing. Approaching her
is expensive; so is leaving her position. The clearest "power fantasy" of the three, and the most
punishing to play greedily.

**Signature synergy — slow × splash.** Enemies crossing her coverage move at a crawl, and the
batteries behind the wall have all the time in the world.

**Instruments.**

- `PERMIT: BATTERY` — long-range splash artillery with a wind-up (the kernel has `attack.splash` and `windupTicks`).
- `AMENDMENT: CURFEW` — enemy movement costs more inside your construction coverage.
- `AMENDMENT: INTERLOCK` — adjacent defensive structures pool integrity into one pool.
- `REVISION: ENTRENCH` — units that did not move gain armour and range.
- `FILE: MARTIAL AUTHORITY` — Teag commandeers a structure: it fires this Pulse on her initiative.
- `PERMIT: CHECKPOINT` — a gate that is passable to your units and not to theirs.

**Why her.** She is the third distinct verb (Vasse holds, Denz spreads, Teag denies) and she teaches
range, splash, and chokepoints. **What she costs:** she is the one who can lose a mission by being
unable to leave, and she is the closest thing the Citizens have to a villain — which the campaign
should use rather than sand off.

#### 4 · Ory Kadresh — "Countersign" — **Dual-bound** (the Apex and the Ravel Prime) — risky

**Personality.** Transactional warmth. Allergic to ceremony, fluent in both bureaucracies, keeps
everyone's secrets and bills for the storage. Neither faction is sure she is theirs; both are certain
she is not the other's.

**Backstory.** A frontier freight broker with standing arrangements on both sides of the line, who
woke after the Activation to find that two Primes had countersigned the same person.

**Play-style — mixed manifest, unstable supply.** Her deck is legal against two faction pools, so she
fields Citizen structure with Ravel volatility. The hook: **which Nexus answers is decided by how you
played the last Pulse.** Build and hold, and the Apex answers — permits, revisions, schedule. Lose
things and break things, and the Ravel Prime answers — requisitions, detonations, salvage. The header
says which patron is currently on the line, and the player steers it by how they fight.

**Signature synergy — patron-flipping.** A deliberate loss can be an opening. Nothing else in the game
rewards *choosing* which half of your deck to make live; done well it reads as a person playing two
machines against each other, which is exactly who she is.

**Instruments.**

- `PERMIT: CUSTOMS HOUSE` — salvage converts faster, and yields to whoever holds the house.
- `HAUL: JACKPOT` (Requisition, Ravel side) — something arrives. The manifest was optimistic.
- `AMENDMENT: CROSS-STANDARD` — Ravel units adopt the Citizen cadence for one Pulse and march in step, which horrifies everyone present.
- `FILE: NO FIXED ADDRESS` — she restores at any friendly structure, not only at the Nexus.
- `SURVEY: MANIFEST` — the enemy's next wave, and one of your own future offers, early.

**Why her, and the risk.** She is the clearest demonstration that the deck model already supports
cross-faction play with no new machinery (Section 2.2), and she is superb in Challenge runs, where
volatility is the product. **She is a bad first Commander**: two vocabularies and real variance is the
opposite of a forgiving tutorial. Ship her third or later, or as a Challenge-only unlock. The design
risk to watch: if the patron flip is not *readable in one glance*, she is just noise.

#### 5 · Wren Aldiss, Revision Seven — "Ledger" — **Proxy** — risky

**Personality.** Punctual, courteous, and entirely calm about things that should not be calming.
Refers to herself the way the file does — *"Revision Seven is in position"* — and once, quietly,
recalled a death that is not in her own record.

**Backstory.** An officer who has died in the line often enough that the Apex's file on her is more
detailed than she is, and it is the file the connection now runs through.

**Play-style — spend the Commander.** Aggressive and sacrificial: her death is a *resource*. Dying
pays out immediately and improves the file permanently; the cost is the absence cadence the rules
already impose — one full Build Phase and Pulse without her, which is a real hole in a five-Pulse
mission. The highest skill ceiling of the five and the only one whose build asks the player to lose
something on purpose.

**Signature synergy — death × schedule.** Her instruments make her absence *productive*, so the
question stops being "can I keep her alive" and becomes "when do I spend her" — the most Citizens
question imaginable, asked about a person.

**Instruments.**

- `FILE: REVISION` — each restoration improves her, permanently and slightly.
- `FILE: POSTHUMOUS ORDERS` — on her death a requisition fires at the tile she fell on. The paperwork was ready.
- `AMENDMENT: CONTINUITY OF OPERATIONS` — while the Symbol is absent, producers run to a tighter schedule. The machine keeps time without her.
- `PERMIT: RECORDS ANNEX` — banks one revision, so a lost Pulse does not cost the file.
- `SURVEY: PRIOR ATTEMPT` — she has notes on this engagement. She should not have notes on this engagement.

**Why her, and the risk.** She turns a rule that already exists (`engine.md` 5.1's death/absence/
restoration cadence, built by Milestone 8) into an identity, and she is the natural bridge into
RESTORATION's own story beat. **The discipline she needs:** she flirts with deliberate mystery #6 —
*is a restored Commander continuous with the person who died?* — and she must **pose** it, never
settle it. Every line she gets should be legible as either "she is fine" or "she is a very good copy,"
and no line, ever, should decide. If a draft of her explains what restoration does to a person, that
draft is wrong (`terminal-nexus-lore.md` Section 7).

#### Choosing among them

**Recommendation, registered as Q43:** build **Vasse** first and design the campaign screen for a
*choice* of three, because the menu shape is what is expensive to retrofit — the other two
conservative Commanders are content against a shape that already exists. Keep Kadresh and Aldiss out
of the first-time experience: they are what Challenge mode and the later campaign are for, and both
teach the wrong lesson first.

## 5. Authoring template

Use this template only when a milestone authorizes an army definition:

```text
# <Faction> — <Commander>

Identity:
Nexus Symbol:
Strategic thesis:
Internal contradiction:

Starting package:
- resources
- workers
- starting units
- structures

Army rules:
- shared faction rules
- Commander exceptions

Units:
- role, producer, supply, cadence, counters, glyph role

Structures:
- common (the faction's, always available) versus army (this deck's, within the cap — Section 2.1)
- rarity, tier, role tags (game-modes.md Section 4)
- role, footprint, radius, worker/production behavior, glyph role

Nexus powers:
- the army's pool, within the cap, from which each Build Phase's hand is dealt
- rarity, tier, role tags (game-modes.md Section 4)
- timing, cost, target, authoritative effect, presentation cue

Upgrade pool:
- low/mid/high-tier families
- intended combinations and counterplay

Visual language:
- Grid glyphs
- portrait motif
- movement, projectile, impact, restoration

Balance hypotheses:
- strong against
- vulnerable to
- degenerate strategy risks
- fixtures and metrics
```

Every literal glyph is theme data mapped from a semantic role. Every exceptional mechanic executes through a validated engine capability or narrow hook. Flavor text never becomes an implicit rule.

## 6. Initial authoring order

1. Define the smallest Citizen Commander Army needed by Milestone 12.
2. Define the smallest Ravel Commander Army that creates a meaningful asymmetric match.
3. Run deterministic simulations and human matches before adding breadth.
4. Add second Commanders only after the common faction package is stable enough that a variation is cheaper than a new faction.
5. Treat Glitch, Feudals, and Alder as lore and art direction until Citizens/Ravels prove the complete loop.

Full skirmish mode should eventually expose each legal Commander Army without requiring campaign completion. Campaigns introduce and unlock their contents gradually. A drafting mode — players assembling an army from the faction pool at match start, or defining their own Commanders — is a third producer of the same army shape (Section 2.1), kept possible by that shape and deliberately undesigned until a milestone wants it.

## 7. Working notes — personal, not canon, not authorization

The owner asked, in passing, whether there might already be commander-army ideas worth writing down.
Section 4 already answers that more thoroughly than a passing question expected — the doctrine
tables, the signature-moment capability mapping, and the named Commander proposals are not a sketch,
they read like design work already mostly done. So rather than add more names or more doctrine, these
are a handful of small ideas that occurred to me *this session*, specifically because of what I was
staring at in the kernel while reviewing and writing — offered the same way Section 4 already frames
its own content: "competes for a place... none is authorized until a milestone needs it." Nothing
here should be read as more settled than that.

- **Tried since this was written**: the unit-design-architecture spike (`evidence/
  unit-architecture-spike.md`) built the wall-segment idea below as a deliberate control case — a
  known-clean baseline to test the exercise's own harness against — and it needed nothing new, exactly
  as predicted. It lives in the spike's own bench roster (`src/content/proving-grounds.ts`), not here:
  still not a Commander Army, and this note is a pointer, not a promotion.
- **A Citizen unit that is a wall segment, not a wall builder.** Section 4.1's alignment bonus already
  rewards unbroken orthogonal runs of structures; multi-tile footprints are already RULE
  (`engine.md` 3.5). A slow, high-integrity Citizen unit whose footprint is a straight 1×3 or 1×4
  line — marched into place and left standing — turns "the player draws Citizen geometry because it
  is strong" from a structure-placement idea into a Grid one: formation *is* the unit, not just
  the base layout around it. Nothing about this needs a new engine capability, only content shaped to
  use two rules that already exist.
- **A Ravel death that denies ground, not just deals damage.** This session shipped the settle-delay
  rule — a death's tile stays blocked for a short window after the entity is gone
  (`vacatedTiles`, `engine.md`). A Ravel unit whose detonation *extends* that window inside its blast
  radius — not just damaging what's caught, but making the ground itself slower to reclaim — combines
  two things the kernel already has into a new expressive beat for "everything is fuel, and endings
  are loud," at what looks like a small kernel cost (a radius-scoped write to an already-existing
  table) rather than a new system.
- **A large, slow unit is already interesting for a reason nobody had to design.** "Range is measured
  to the nearest occupied tile of the target's footprint, not its anchor" (`engine.md` 3.5) means a
  big, dangerous, multi-tile siege unit is *easier* to hit than a small one just by existing at that
  size — real tension, falling straight out of two RULEs already locked, not a mechanic anyone needs
  to invent. Worth remembering when a "big scary unit" gets designed later: the footprint rule is
  already doing half the balancing work.
- **One idea I'd warn against, not recommend.** While designing this session's replay format
  (`replay-format.md` 3.1), I needed a precise definition of "an engagement" — attacks clustered in
  space and time. It is tempting to let a Commander power react to that same idea — "bonus effect if
  cast into an active fight." I would not reuse the *replay's* engagement detector for it: that
  algorithm is deliberately a post-hoc report-layer read over an already-resolved event log (Section
  3.1 explains why), and letting gameplay rules depend on it would either mean the kernel re-deriving
  report logic inside the Pulse, or presentation-adjacent code influencing simulation — the exact
  boundary `engine.md` Section 1 exists to hold. If a "reacts to a fight in progress" power is ever
  wanted, it needs its own simple, kernel-native notion of local density (nearby hostile count within
  a radius, computed live, the way perception already scans), not a borrowed copy of a tool built for
  a different job.
