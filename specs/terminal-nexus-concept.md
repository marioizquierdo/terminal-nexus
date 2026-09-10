# Terminal Nexus — concept

**Document role:** One-page product definition
**Status:** Canonical
**Canon version:** 2.15
**Updated:** 2026-09-10
**License:** CC BY-SA 4.0 for creative direction; Apache-2.0 for technical product requirements

## The game in one sentence

**Terminal Nexus is a fast, terminal-native strategy game in which players build compact bases during hidden, simultaneous planning, then watch persistent armies resolve those decisions through vivid deterministic ASCII battles called Nexus Pulses.**

It combines the modern satisfaction of drafting and autobattlers with the physical economy of an old-school RTS: workers, supply, production buildings, research, terrain, fortifications, faction asymmetry, and a prominent commander represented by `@`.

## Who it is for

Terminal Nexus is made first for programmers, terminal enthusiasts, and strategy players who want a complete tactical experience during a 5–12-minute build break. It should install easily, launch almost instantly, remain comfortable over an ordinary remote shell, and reward both a quick experiment and repeated mastery.

The terminal is not a novelty wrapper. Fixed cells, symbols, ANSI color, keyboard fluency, replayable text data, small binaries, remote play, and mod-friendly TypeScript are native strengths of the design.

## How a match works

A match alternates between two phases:

1. **Build Phase.** Both players study the same resolved Grid and secretly commit construction, production state, and one Nexus upgrade choice. Planning is turn-based and untimed.
2. **Nexus Pulse.** Plans reveal simultaneously. New buildings activate, workers choose jobs, producers spawn fixed recipes when resources and supply allow, and armies move and fight automatically for a fixed number of deterministic logical ticks.

After a Pulse, surviving units regroup near their home producers. Casualties and destroyed buildings remain consequential. The next Build Phase begins from the new public state. The match ends when one Grid Nexus is destroyed.

The player does not micromanage units during a Pulse. Their agency comes from base geometry, expansion, resource capacity, supply, production mix, defenses, research drafts, commander development, and prediction of the opponent's hidden plan.

The emotional loop is:

> **Build. Commit. Pulse. Understand. Adapt.**

## How the game is played

Two single-player modes share that match, and both are designed for from the start
([`game-modes.md`](game-modes.md)):

- **Campaign** — the first-time player experience and the world's canon: a short, authored sequence
  of missions that teaches one mechanic at a time, unlocks the cards it introduces, and tells the
  story. Judged on whether a new player comes out able to play a run, and whether the world feels
  real — never on length.
- **Challenge** — seeded runs: a series of battles against escalating Commander Armies, with a run
  draft between battles — add a card, remove one, or upgrade one — so the build is polished battle
  by battle. The same seed gives the same run. This is where replay value lives.

Skirmish (one battle, any legal army) falls out of the same pieces; multiplayer comes later, on the
same deterministic match. A mode is data over one match loop and one army shape — nothing below the
mode knows which one it is serving.

## What makes it special

- **A base is a spatial puzzle.** Buildings extend connected construction territory, protect economic routes, shape paths, and create spawn and regroup anchors.
- **Automatic battle preserves strategic authorship.** The spectacle is hands-off, but its causes should be readable in the player's previous decisions.
- **Persistence creates short stories.** Survivors matter, workers flee, factories can be lost, salvage can be contested, and a commander can fall and later return.
- **Modern drafting disrupts solved build orders.** The Nexus offers a small randomized upgrade draft; research changes its quality, breadth, and flexibility.
- **A Commander Army is a deck.** The faction is the pool of everything it can field; an army brings a few structures and a small pool of Nexus powers to one fight. A campaign grows the deck mission by mission, and the same shape leaves room for drafting modes later.
- **It plays at typing speed.** Every menu item shows its hotkey, every hotkey is also a click, and the whole game can be driven from a command stream — by a proficient player, by a mouse, or by an agent playtesting it.
- **Faction identity is mechanical and symbolic.** Strategy, geometry, glyphs, motion, color, prose, portraits, and effects all express the same civilization.
- **The simulation is deterministic.** A seed and complete committed plans reproduce the same outcome. Playback speed, animation frames, palette, and renderer never alter play.
- **The architecture invites creation.** First-party maps, armies, campaigns, effects, and themes use inspectable definitions that may become a future modding surface. This is deliberate and it is why the foundation is being built so carefully: the game is designed for a world where players extend games **with their own agents** — missions, Commander Armies, cards, short stories — which is also how this project builds itself. Content is data with small named vocabularies, and the setting under-specifies on purpose, so there is room to add ([`terminal-nexus-lore.md`](terminal-nexus-lore.md) Section 10.6).

## The fantasy

Across the galaxy, ancient pyramidal world machines called Prime Nexuses have awakened. Each remains rooted to its home territory, yet can replicate a smaller Nexus onto a distant Grid and send one psychically connected leader with it. These rare leaders—Commanders, or **Nexus Symbols**—receive incomplete visions and may be restored by their Prime Nexus after death.

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

No playable game exists yet. The first milestone puts a few units on a Grid, lets them fight without anyone steering them, and asks three questions in this order:

1. **Is it deterministic?** The same scenario, seed, and tick count resolve into the same events and the same final state, every run, with no terminal involved.
2. **Is it legible?** A viewer who did not simulate it can follow who moved, who shot whom, and who died — at 80×24, with colour switched off.
3. **Is it good?** Anticipation, impact, and debris turn a readable battle into one worth watching again.

Each question is worthless without the one before it. A battle that looks great and does not replay identically is a demo; a battle that replays identically and cannot be read is a log file.

The Build Phase, base construction, economy, campaigns, packaging and remote delivery, public mod loading, multiplayer, sound, and model-driven opponents all remain gated behind those proofs.

Start with the milestone marked CURRENT in [`../milestones/README.md`](../milestones/README.md) — Milestone 1, [Grid Battles](../milestones/milestone-01-grid-battles.md), is complete and accepted, and the campaign's first level is being built across the milestones after it. Before deciding anything the canon leaves open, check [`open-questions.md`](open-questions.md). For the visual direction these proofs are chasing, see [`../concept/README.md`](../concept/README.md).

## Design statement

Terminal Nexus should feel as though a strategy game, a myth, and a terminal protocol were always the same thing.

The ambition is not to imitate a graphical RTS with fewer pixels. It is to discover what strategy feels like when every cell is simultaneously a rule, a character, a piece of architecture, and a sign from something impossibly old.

> **Build the settlement. Commit the protocol. Watch the symbols become history.**
