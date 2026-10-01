# Terminal Nexus — engine design

## 0. How to read this document

This is a **design document, not a rulebook.** Most of it is a recommendation written before the
thing existed. It is here so that a session facing a fork has something better than a coin flip —
not so that a session builds an interface nobody has needed yet.

Every section carries an authority marker. Respect it literally:

| Marker | Means | What you may do |
| --- | --- | --- |
| **RULE** | Committed. It is load-bearing, and something else already depends on it | Follow it. Changing it needs owner acceptance and a canon version bump |
| **GUIDANCE** | A recommendation, not yet earned by working code | Follow it by default. Depart when the work shows better — and record why in the gate report |

Most of this document is GUIDANCE. Where a section describes something that is not designed yet, it
says so in its own words; that is still GUIDANCE, and it still means *do not build this today*.

Two rules apply everywhere and outrank convenience:

1. **Descriptive completeness is not authorization.** A shape described here is not a shape you may
   build today. The milestone marked CURRENT decides what gets built.
2. **Direct code beats a framework.** Write the specific thing the current proof needs. Extract a
   general contract only after a *second* real use shows you where the seam actually is. Most of the
   interfaces below are sketches of seams we have not found yet.

If you find yourself building something in this document because it is in this document, stop.

---

## 1. The three worlds

**Authority: RULE.** This is the separation the whole engine exists to protect. Everything else is
detail.

Terminal Nexus keeps three things apart that most games blend together:

```text
┌─ STATE ────────────────────────────────────────────────────────────┐
│  What is true. The Grid, its layers, every entity's placement,      │
│  health, resources, and ownership. Plain serializable data.         │
│  Knows nothing about time passing, and nothing about drawing.       │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ PULSE ────────────────────────────────────────────────────────────┐
│  How state changes. A pure function stepping state forward in       │
│  fixed logical ticks. All randomness comes from one seeded stream.  │
│  Same inputs → same outputs, forever, on any machine.               │
│  Emits ordered events describing what happened and why.             │
│  Has no clock, no terminal, no frames, no colour.                   │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ PRESENTATION ─────────────────────────────────────────────────────┐
│  What it looks like. Consumes state and events, samples them at     │
│  an arbitrary wall-clock time, and composes cells. Interpolates,    │
│  animates, throws particles, shakes, recolours, and lies about      │
│  timing freely — because none of it can change an outcome.          │
│  Has its own separate cosmetic random stream.                       │
└────────────────────────────────────────────────────────────────────┘
```

The three laws that follow from this:

1. **Only the Pulse mutates state.** Nothing else writes to it. Not presentation, not input, not a
   scenario script, not a content hook.
2. **Presentation cannot influence the Pulse.** Frame rate, dropped frames, playback speed, pause,
   window size, colour depth, and reduced motion are all invisible to it. A Pulse resolved on a
   machine with no screen at all resolves identically.
3. **The two random streams never touch.** Gameplay randomness is seeded, serialized, and replayed.
   Cosmetic randomness is whatever it wants to be. A particle must never consume a draw from the
   gameplay stream, and the gameplay stream must never be asked for something a particle needs.

The practical test: **you must be able to resolve an entire match with the renderer deleted**, and
you must be able to rewrite the entire renderer without a single simulation test changing.

One corollary, because it is the seam most likely to erode quietly: **canonical state carries nothing
that only presentation reads.** Facing (Section 3.5) is the single deliberate exception, pending Q9 —
it is in state so that a renderer does not have to guess a direction and produce jitter. Do not add a
second one. Interpolation hints, animation state, and camera position are presentation's, and they
belong in the presentation model of Section 2, not in the state the Pulse hashes.

---

## 2. Responsibility layers

**Authority: GUIDANCE.** The boundaries are right; the exact module names will move as code arrives.

| Layer | Owns | Must not own |
| --- | --- | --- |
| Rules kernel | ticks, state transitions, randomness, occupancy, movement, targeting, damage, economy, legality, victory | terminal objects, wall clocks, network calls, glyphs, prose |
| Content definitions | units, attacks, structures, upgrades, Commanders, armies, factions, maps, semantic themes | mutable match authority, backend classes |
| Scenario runtime | starting state, objectives, triggers, mission progress, win/loss requests, unlocks | direct mutation bypassing the kernel |
| Player projection | visibility-filtered state, legal public actions, visible ordered events | hidden-plan leakage, invented facts |
| Presentation | semantic cues, animation state, portraits, cell frames or graphical scenes, accessibility | damage, targeting, legal placement, victory |
| Platform adapters | terminal, browser, native input, output, resize, streams, device lifecycle; the keyboard, mouse, and driver input adapters that turn events into shell commands (Section 9.7) | interpreting ANSI or pixels as game state; giving one adapter a command another cannot issue |
| Application shell | CLI, configuration, content selection, saves, replays, diagnostics, composition, the command vocabulary every input adapter feeds | secret rule changes |

Runtime flow:

```text
content + scenario + committed plans
                 ↓
       deterministic kernel  ── seeded gameplay RNG
                 ↓
 canonical state + ordered DomainEvent[]
                 ↓
 visibility projection → PlayerView + visible events
                 ↓
      presentation model  ── separate cosmetic RNG
                 ├─ terminal compositor → ReadonlyCellFrame → backend
                 ├─ browser or native graphical renderer
                 └─ accessibility or spectator renderer
```

Shared contracts stay leaves of the import graph. Nothing downstream of the kernel may be imported
by the kernel.

---

## 3. The parts

This document is the overview. The design is in its parts, one document each:

- [`grid.md`](grid.md) — the Grid: size and shape, orientation, viewport and scrolling, layers and collision masks, placement and footprints, distance.
- [`pulse.md`](pulse.md) — the Pulse: logical time, movement credit, tick order, determinism and replay, match structure, economy, events.
- [`content.md`](content.md) — content interfaces.
- [`presentation.md`](presentation.md) — the cell frame, composition, tile width, bands, effects, accessibility.
- [`input.md`](input.md) — the command vocabulary, the three adapters, hotkeys and bindings.
- [`runtime.md`](runtime.md) — terminal lifecycle, delivery, tools and modding, scaling.
- [`effects.md`](effects.md) — animations, particles, shading and tweens.
- [`ui-patterns.md`](ui-patterns.md) — every screen, menu, popup and key.
- [`testing.md`](testing.md) — what the suite proves.
