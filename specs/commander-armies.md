# Terminal Nexus — Commander Armies

**Document role:** Playable faction packages: Commanders, units, structures, upgrades, and Nexus powers
**Status:** Canonical identity direction; rosters intentionally undefined
**Canon version:** 2.7
**Updated:** 2026-08-21
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

No complete roster has been earned yet. Do not invent production-ready stats before Milestone 4 selects the minimum Citizens-versus-Ravels microgame.

**Two fixture armies exist on the bench** (Milestone 1) and neither is a Commander Army: a Citizen set from `milestone-1-spike-battle.md` 3.6, and a Ravel set added at Gate 1B so `grid` could show two styles of fight rather than one fight twice. They are disposable, tuned for contrast rather than balance, and Milestone 4 is still what selects the real microgame. What they proved is worth carrying forward:

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
one needs. It contains no stats, no rosters, and no authorization — Milestone 4 still selects the
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
- role, footprint, radius, worker/production behavior, glyph role

Nexus powers:
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

1. Define the smallest Citizen Commander Army needed by Milestone 4.
2. Define the smallest Ravel Commander Army that creates a meaningful asymmetric match.
3. Run deterministic simulations and human matches before adding breadth.
4. Add second Commanders only after the common faction package is stable enough that a variation is cheaper than a new faction.
5. Treat Glitch, Feudals, and Alder as lore and art direction until Citizens/Ravels prove the complete loop.

Full skirmish mode should eventually expose each legal Commander Army without requiring campaign completion. Campaigns introduce and unlock their contents gradually.

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
