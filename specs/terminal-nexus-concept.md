# Terminal Nexus — concept

**Document role:** One-page product definition
**Status:** Canonical
**Canon version:** 2.0
**Updated:** 2026-08-19
**License:** CC BY-SA 4.0 for creative direction; Apache-2.0 for technical product requirements

## The game in one sentence

**Terminal Nexus is a fast, terminal-native strategy game in which players build compact bases during hidden, simultaneous planning, then watch persistent armies resolve those decisions through vivid deterministic ASCII battles called Nexus Pulses.**

It combines the modern satisfaction of drafting and autobattlers with the physical economy of an old-school RTS: workers, supply, production buildings, research, terrain, fortifications, faction asymmetry, and a prominent commander represented by `@`.

## Who it is for

Terminal Nexus is made first for programmers, terminal enthusiasts, and strategy players who want a complete tactical experience during a 5–12-minute build break. It should install easily, launch almost instantly, remain comfortable over an ordinary remote shell, and reward both a quick experiment and repeated mastery.

The terminal is not a novelty wrapper. Fixed cells, symbols, ANSI color, keyboard fluency, replayable text data, small binaries, remote play, and mod-friendly TypeScript are native strengths of the design.

## How a match works

A match alternates between two phases:

1. **Build Phase.** Both players study the same resolved battlefield and secretly commit construction, production state, and one Nexus upgrade choice. Planning is turn-based and untimed.
2. **Nexus Pulse.** Plans reveal simultaneously. New buildings activate, workers choose jobs, producers spawn fixed recipes when resources and supply allow, and armies move and fight automatically for a fixed number of deterministic logical ticks.

After a Pulse, surviving units regroup near their home producers. Casualties and destroyed buildings remain consequential. The next Build Phase begins from the new public state. The match ends when one battlefield Nexus is destroyed.

The player does not micromanage units during a Pulse. Their agency comes from base geometry, expansion, resource capacity, supply, production mix, defenses, research drafts, commander development, and prediction of the opponent's hidden plan.

The emotional loop is:

> **Build. Commit. Pulse. Understand. Adapt.**

## What makes it special

- **A base is a spatial puzzle.** Buildings extend connected construction territory, protect economic routes, shape paths, and create spawn and regroup anchors.
- **Automatic battle preserves strategic authorship.** The spectacle is hands-off, but its causes should be readable in the player's previous decisions.
- **Persistence creates short stories.** Survivors matter, workers flee, factories can be lost, salvage can be contested, and a commander can fall and later return.
- **Modern drafting disrupts solved build orders.** The Nexus offers a small randomized upgrade draft; research changes its quality, breadth, and flexibility.
- **Faction identity is mechanical and symbolic.** Strategy, geometry, glyphs, motion, color, prose, portraits, and effects all express the same civilization.
- **The simulation is deterministic.** A seed and complete committed plans reproduce the same outcome. Playback speed, animation frames, palette, and renderer never alter play.
- **The architecture invites creation.** First-party maps, armies, campaigns, effects, and themes use inspectable definitions that may become a future modding surface.

## The fantasy

Across the galaxy, ancient pyramidal world machines called Prime Nexuses have awakened. Each remains rooted to its home territory, yet can replicate a smaller Nexus onto a distant battlefield and send one psychically connected leader with it. These rare leaders—Commanders, or **Nexus Symbols**—receive incomplete visions and may be restored by their Prime Nexus after death.

The civilizations controlling these machines cannot agree whether the network is a weapon, a trial, a god, an ecological disaster, or an opportunity. Some believe its wars are selecting the one structure that will become the **Terminal Nexus**.

The five long-term factions are Citizens, Ravels, Glitch, Feudals, and Alder. Initial integrated development begins with Citizens and Ravels.

See [`terminal-nexus-lore.md`](terminal-nexus-lore.md) for the canonical universe and [`commander-armies.md`](commander-armies.md) for future playable rosters.

## Product promise

The player should be able to:

- build an expressive settlement in a handful of decisions;
- commit a plan without real-time mechanical pressure;
- watch symbols turn that plan into a legible battle story;
- understand why the battle unfolded as it did;
- recover from losses and discover a different build;
- finish quickly and immediately want one more match.

## Current scope

No playable game exists yet. The first milestone must prove two things in order:

1. a TypeScript terminal path can own a precise cell frame, animate smoothly, package credibly, and restore the terminal safely;
2. authored moving symbols can communicate weight, causality, danger, and personality at 80×24.

Combat rules, economy, base construction, campaigns, public mod loading, multiplayer, sound, and model-driven opponents remain gated behind those proofs.

Start implementation with [`milestone-1-spike-battle.md`](milestone-1-spike-battle.md).

## Design statement

Terminal Nexus should feel as though a strategy game, a myth, and a terminal protocol were always the same thing.

The ambition is not to imitate a graphical RTS with fewer pixels. It is to discover what strategy feels like when every cell is simultaneously a rule, a character, a piece of architecture, and a sign from something impossibly old.

> **Build the settlement. Commit the protocol. Watch the symbols become history.**
