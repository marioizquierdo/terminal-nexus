# Terminal Nexus — engine design

_The shape of the engine: the three worlds, the responsibility layers, the architectural invariants and the vocabulary, with a map to the documents that hold each part. This page owns the rules other pages repeat; they point here._

## 0. How to read this document

This is a **design document, not a rulebook.** Most of it is a recommendation written before the
thing existed, so that a session facing a fork has something better than a coin flip.

Every statement is one of three kinds:

| Marker | Means | What you may do |
| --- | --- | --- |
| **RULE** | Built and depended on. The code implements it and a named test or module holds it, named beside the marker, or the line says that none does yet, which means the decision is settled but unbuilt: "(RULE — settled; no code holds it yet)" | Follow it. Changing it is a design change: the sentence, the code and the test change together in one pull request, and the description says so for Mario |
| **GUIDANCE** | The recommended default. **Anything unmarked is GUIDANCE** | Follow it by default. Depart when the work shows better, and say why in the pull request |
| **IDEA** | A sketch kept so it is not lost. Nothing depends on it | Read it for context. Build it only when a milestone step asks for it |

Two rules apply everywhere and outrank convenience:

1. **Descriptive completeness is not authorization.** A shape described here is not a shape you may
   build today; the current milestone step decides what gets built. Building something because it is
   described here is the signal to stop.
2. **Direct code beats a framework.** Write the specific thing the current proof needs. Extract a
   general contract only after a *second* real use shows where the seam is. Most interfaces in these
   documents are sketches of seams not yet found.

---

## 1. The three worlds — RULE

**RULE — `tests/architecture.test.ts`, `tests/determinism.test.ts`, `tests/rng.test.ts`.** This is the
separation the whole engine exists to protect.

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

Three laws follow:

1. **Only the Pulse mutates state.** Not presentation, not input, not a mission script, not a content hook.
2. **Presentation cannot influence the Pulse.** Frame rate, dropped frames, playback speed, pause,
   window size, colour depth and reduced motion are invisible to it. A Pulse resolved with no screen
   at all resolves identically.
3. **The two random streams never touch.** Gameplay randomness is seeded, serialized and replayed;
   cosmetic randomness is whatever it wants to be. A particle never consumes a gameplay draw, and the
   gameplay stream is never asked for something a particle needs.

The test of all three: **resolve an entire match with the renderer deleted**, and rewrite the entire
renderer without a single simulation test changing.

**Canonical state carries nothing that only presentation reads**, the seam most likely to erode
quietly. Facing ([`grid.md`](grid.md)) is the one deliberate exception, so that a renderer does not
guess a direction and jitter (whether facing affects the rules was Q9, answered as no). Add no second
one: interpolation hints, animation state and camera position belong in the presentation model, not in
the state the Pulse hashes.

---

## 2. Responsibility layers

The boundaries are right; the module names will move as code arrives. **RULE —
`tests/architecture.test.ts`: the layers stay separate.** The kernel, content, opening, projection,
presentation, adapters and shell never reach into one another against the arrows below.

| Layer | Owns | Must not own |
| --- | --- | --- |
| Rules kernel | ticks, state transitions, randomness, occupancy, movement, targeting, damage, economy, legality, victory | terminal objects, wall clocks, network calls, glyphs, prose |
| Content definitions | units, attacks, structures, upgrades, Commanders, armies, factions, maps, semantic themes | mutable match authority, backend classes |
| Rules runtime | starting state, objectives, triggers, mission progress, win/loss requests, unlocks | direct mutation bypassing the kernel |
| Player projection | visibility-filtered state, legal public actions, visible ordered events | hidden-plan leakage, invented facts |
| Presentation | semantic cues, animation state, portraits, cell frames or graphical scenes, accessibility | damage, targeting, legal placement, victory |
| Platform adapters | terminal, browser, native input, output, resize, streams, device lifecycle; the keyboard, mouse and driver input adapters that turn events into shell commands ([`input.md`](input.md)) | interpreting ANSI or pixels as game state; giving one adapter a command another cannot issue |
| Application shell | CLI, configuration, content selection, saves, replays, diagnostics, composition, the command vocabulary every input adapter feeds | secret rule changes |

```text
content + opening + committed plans
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

Shared contracts stay leaves of the import graph: nothing downstream of the kernel is imported by the
kernel (RULE — `tests/architecture.test.ts`).

**The renderer boundary** (RULE — `tests/architecture.test.ts`, `tests/backend-opentui.test.ts`): the
simulation emits visibility-filtered semantic views and events; the terminal compositor emits an
engine-owned cell frame; platform backends (OpenTUI, direct ANSI, the browser page, any future
graphical or networked renderer) are adapters that draw that frame and carry input back. The kernel
never reaches the view, and the view never reaches the kernel.

**Language and runtime.** The engine and its content are TypeScript-first (RULE — `tsconfig.json`,
`npm run typecheck`). **The terminal library and the JavaScript runtime are independent choices;
neither implies the other** (RULE — `src/view/backends/ports.ts`: every backend implements the same
ports, and the suite runs on Node and on Bun). Direction: [`runtime.md`](runtime.md).

---

## 3. The invariants

Each is a RULE; the test or module that holds it is beside it, or the line says no code holds it yet.
The three worlds and the layers above are not repeated here.

| Invariant | Held by | Detail |
| --- | --- | --- |
| The kernel is pure: no terminal, clock, network or renderer; no `Math.random`; the same opening, seed and tick count hash identically on Node and Bun | `tests/architecture.test.ts`, `tests/determinism.test.ts` | [`pulse.md`](pulse.md) |
| Gameplay randomness is one seeded PCG32 stream; cosmetic randomness is a hash of an effect instance's identity, never a stream; the Nexus Pulse, a rule outside the kernel, deals from a seeded stream of its own, so a hand never moves a battle | `tests/rng.test.ts`, `tests/effects.test.ts`, `tests/nexus-draft.test.ts` | [`pulse.md`](pulse.md), [`effects.md`](effects.md) |
| The simulation emits canonical state and ordered semantic events: events carry meaning, not appearance, and no renderer reads cells back into mechanics | `tests/architecture.test.ts` | [`pulse.md`](pulse.md) |
| The simulation never knows a glyph; it knows semantic ids such as `unit.worker` | `tests/architecture.test.ts` | [`presentation.md`](presentation.md) |
| `(0,0)` is the north-west tile, `x` grows east, `y` grows south, sandbox rows read north to south: one convention in every module | `tests/sandboxes.test.ts` | [`grid.md`](grid.md) |
| The Grid has five layers; layers define render order only, and collision is a mask composed from a chosen set of layers | `tests/grid.test.ts` | [`grid.md`](grid.md) |
| Every entity has an anchor, a footprint and a facing; units as well as structures may span tiles, a mover tests its whole footprint, range measures to the nearest occupied tile | `tests/grid.test.ts` | [`grid.md`](grid.md) |
| A unit stands two squares tall: every distance, range, reach and radius counts a row up or down as two columns (`ROW_DISTANCE`), a step takes as long as the distance it covers, a reach is a diamond as wide as it is tall on screen, and touching is a side shared, which melee reaches with its range of 1 | `tests/rows.test.ts`, `tests/grid-pictures.test.ts` | [`grid.md`](grid.md), [`pulse.md`](pulse.md) |
| The viewport is clamped between 48 × 16 and 72 × 24 tiles, the cursor drives scrolling, there is no minimap, and 80 × 24 is the floor and the acceptance target | `tests/build-camera.test.ts` | [`grid.md`](grid.md) |
| Orientation is a rendering choice; portrait and landscape change no coordinate | (RULE — settled; no code holds it yet) | [`grid.md`](grid.md) |
| Speed tier is initiative and lower acts first, for movement claims and attacks alike; it is not a movement rate | `tests/rules.test.ts` | [`pulse.md`](pulse.md) |
| A Grid Nexus is a flag on a content definition, never a content id the kernel recognises | `src/content/types.ts` | [`grid.md`](grid.md), [`content.md`](content.md) |
| Composition produces an engine-owned cell frame; cells carry style roles, never literal colours; monochrome seven-bit ASCII is the floor | `tests/roles.test.ts`, `tests/view.test.ts` | [`presentation.md`](presentation.md) |
| A tile is one terminal column at every size, so a reach is as wide as it is tall on screen, and a picture of an area the rules decide (a reach, the build range, a room, an aura, a blast) draws the rules' own tiles | `tests/rows-view.test.ts`, `tests/build-camera.test.ts`, `tests/effects.test.ts` | [`presentation.md`](presentation.md) |
| Effects are pure functions of absolute presentation time; presentation has four families (animations, particles, shading, tweens) and an animation's completion is scheduled data, never a callback | `tests/effects.test.ts`, `tests/animation.test.ts`, `tests/tween.test.ts` | [`effects.md`](effects.md) |
| The corruption law: effects live in the `effects` band or above and never remove the only carrier of a semantic cue; the compositor drops any effect cell that would replace an entity's glyph | `tests/effects.test.ts` | [`effects.md`](effects.md) |
| Faction identity lives in the glyph family and the effect language; ownership keeps the colour, so a mirror match stays legible and monochrome stays whole | (RULE — settled; no code holds it yet) | [`presentation.md`](presentation.md) |
| Every interactive action is a named command; keyboard, mouse and driver are three adapters onto one vocabulary; every menu item shows its hotkey and a click activates what it lands on | `tests/title-menu-adapters.test.ts`, `tests/build-focus.test.ts` | [`input.md`](input.md) |
| The Build Phase screen follows one set of interface patterns: focus, cancel, lists, popups, cards, hand-offs, the one-line bottom bar, the Grid pane's edge | the tests named in that document | [`ui-patterns.md`](ui-patterns.md) |
| The browser playtest page is a development tool, never a platform: it runs the terminal's own screen loops and converts only frames, input bytes and settings storage | `tests/web.test.ts` | [`runtime.md`](runtime.md) |
| Logs are one structured shape: an event is declared before it is logged, a logger takes its clock as an argument and keeps a bounded memory, the kernel and the match layer never log, and nothing the rules decide reads a log | `tests/log.test.ts`, `tests/architecture.test.ts` | [`runtime.md`](runtime.md) |
| A mission is a sequence of rounds, each a Nexus Pulse, a Build Phase and the Battle Round after it, driven by triggers; simulation actions run inside the kernel as validated intents, presentation actions never touch state, and a scripted Battle Round is still a Pulse | `tests/mission.test.ts`, `tests/mission-loop.test.ts` | [`story.md`](../game-design/story.md) |

Design commitments the game documents own, GUIDANCE until built and played:

- A Commander Army is the playable content boundary: a faction and Grid Nexus, a Commander, starting
  units and structures, blueprints and a real tech tree, upgrades, Nexus powers and Specials. A
  faction is a wide pool and an army fields a few of them; the match only ever sees an army. "A deck
  of cards" is not the model ([`commander-armies.md`](../game-design/commander-armies.md)).
- A mode is data over one battle: Skirmish, Story and Versus; nothing below the mode knows which it serves, and
  a mission exists only inside Story ([`game-modes.md`](../game-design/game-modes.md)).
- A Nexus power is a name and one plain line, with no player-facing classification, and, for now, a dealt one
  may be left unpicked; a mission has goals rather than a fixed length
  ([`commander-armies.md`](../game-design/commander-armies.md), [`story.md`](../game-design/story.md)).
- Each Nexus is named for the faction that holds it, with Prime or Grid appended where it matters;
  Prime Nexuses stay home and replicate Grid Nexuses ([`lore.md`](../game-design/lore.md)).
- Lore is a platform, not a plot: when clearer ASCII and a richer story compete, the Grid wins
  ([`lore.md`](../game-design/lore.md)).
- Content is TypeScript-first and mostly declarative ([`content.md`](content.md)).

## 4. Vocabulary

Every word the project made its own is defined once, in the [glossary](../game-design/glossary.md).
A new word goes there in the pull request that brings it in.

## 5. How troops move

The chapter is [`movement.md`](movement.md): what a player should be able to predict, every number, the
three states, the building blocks and their pictures. The rules with their tests are in
[`pulse.md`](pulse.md), routes. GUIDANCE unless marked. Three commitments belong here, because they
shape the architecture:

- **A unit is in one of three states, worked out fresh every tick** (`MoveState`, `src/pulse/march.ts`):
  march, battle or retreat.
- **Routes are small parts, each tested alone** (`src/routing/`): ground, goals, the distance field,
  step choice and arbitration. One field serves every unit heading for the same goal with the same body,
  worked out every tick from that tick's Grid and only as far as asked, so a fallen building or a moved
  crowd is in the next tick's routes with nothing kept up to date.
- **Every tie is broken by what a unit faces and then the seeded stream, never by reading order**, so a
  mirrored battle stays a mirror (RULE — [`pulse.md`](pulse.md), no side wins by where it stands).

A new way of moving (stepping back from damage, leaping forward, a beacon to gather at) is a new goal, a
new field or a move that is not a step, on the same parts ([`movement.md`](movement.md), where modifiers
plug in). "Pathfinding" in this game means troop movement (the owner, 2026-10-26: "in this game
'pathfinding' is more than just moving, it is 'troops movement'").

## 6. The parts

- [`grid.md`](grid.md) — the Grid: size and shape, orientation, viewport and scrolling, layers and collision masks, placement and footprints, distance.
- [`pulse.md`](pulse.md) — the Pulse: logical time, movement credit, tick order, determinism and replay, routes, match structure, economy, events.
- [`movement.md`](movement.md) — troop movement, from what a player predicts to the machinery underneath.
- [`measurement.md`](measurement.md) — how a battle is measured, so results before and after a rule change compare.
- [`content.md`](content.md) — content interfaces.
- [`presentation.md`](presentation.md) — the cell frame, composition, the tile, bands, effects, accessibility.
- [`input.md`](input.md) — the command vocabulary, the three adapters, hotkeys and bindings.
- [`runtime.md`](runtime.md) — terminal lifecycle, delivery, tools and modding, scaling.
- [`effects.md`](effects.md) — animations, particles, shading and tweens.
- [`ui-patterns.md`](ui-patterns.md) — every screen, menu, popup and key.
- [`testing.md`](testing.md) — what the suite proves.
