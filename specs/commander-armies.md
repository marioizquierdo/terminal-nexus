# Terminal Nexus — Commander Armies

**Document role:** Playable faction packages: Commanders, units, structures, upgrades, and Nexus powers
**Status:** Canonical placeholder; rosters intentionally undefined
**Canon version:** 2.2
**Updated:** 2026-08-20
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

## 4. Authoring template

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

## 5. Initial authoring order

1. Define the smallest Citizen Commander Army needed by Milestone 4.
2. Define the smallest Ravel Commander Army that creates a meaningful asymmetric match.
3. Run deterministic simulations and human matches before adding breadth.
4. Add second Commanders only after the common faction package is stable enough that a variation is cheaper than a new faction.
5. Treat Glitch, Feudals, and Alder as lore and art direction until Citizens/Ravels prove the complete loop.

Full skirmish mode should eventually expose each legal Commander Army without requiring campaign completion. Campaigns introduce and unlock their contents gradually.
