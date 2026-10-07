# Terminal Nexus — engine design

_The shape of the engine: the three worlds, the responsibility layers, the architectural invariants and the vocabulary, with a map to the documents that hold each part._

## 0. How to read this document

This is a **design document, not a rulebook.** Most of it is a recommendation written before the
thing existed. It is here so that a session facing a fork has something better than a coin flip,
not so that a session builds an interface nobody has needed yet.

Every statement is one of three kinds:

| Marker | Means | What you may do |
| --- | --- | --- |
| **RULE** | Built and depended on. The code implements it and a named test or module holds it, named beside the marker, or the line says that none does yet, which means the decision is settled but unbuilt: "(RULE — settled; no code holds it yet)" | Follow it. Changing it is a design change: the sentence, the code and the test change together in one pull request, and the description says so for Mario |
| **GUIDANCE** | The recommended default. **Anything unmarked is GUIDANCE** | Follow it by default. Depart when the work shows better, and say why in the pull request |
| **IDEA** | A sketch kept so it is not lost. Nothing depends on it | Read it for context. Build it only when a milestone step asks for it |

Two rules apply everywhere and outrank convenience:

1. **Descriptive completeness is not authorization.** A shape described here is not a shape you may
   build today. The current milestone step decides what gets built.
2. **Direct code beats a framework.** Write the specific thing the current proof needs. Extract a
   general contract only after a *second* real use shows you where the seam actually is. Most of the
   interfaces in these documents are sketches of seams we have not found yet.

If you find yourself building something here because it is described here, stop.

---

## 1. The three worlds — RULE

**RULE — `tests/architecture.test.ts`, `tests/determinism.test.ts`, `tests/rng.test.ts`.** This is the
separation the whole engine exists to protect. Everything else is detail.

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
that only presentation reads.** Facing (see [`grid.md`](grid.md)) is the single deliberate exception,
until the open question of whether facing affects the rules is answered (Q9): it is in state so that
a renderer does not have to guess a direction and produce jitter. Do not add a second one.
Interpolation hints, animation state and camera position are presentation's, and they belong in the
presentation model (below), not in the state the Pulse hashes.

---

## 2. Responsibility layers

The boundaries are right; the exact module names will move as code arrives. **RULE —
`tests/architecture.test.ts`: the layers stay separate.** The kernel, content, scenario, projection,
presentation, adapters and shell never reach into one another against the arrows below.

| Layer | Owns | Must not own |
| --- | --- | --- |
| Rules kernel | ticks, state transitions, randomness, occupancy, movement, targeting, damage, economy, legality, victory | terminal objects, wall clocks, network calls, glyphs, prose |
| Content definitions | units, attacks, structures, upgrades, Commanders, armies, factions, maps, semantic themes | mutable match authority, backend classes |
| Scenario runtime | starting state, objectives, triggers, mission progress, win/loss requests, unlocks | direct mutation bypassing the kernel |
| Player projection | visibility-filtered state, legal public actions, visible ordered events | hidden-plan leakage, invented facts |
| Presentation | semantic cues, animation state, portraits, cell frames or graphical scenes, accessibility | damage, targeting, legal placement, victory |
| Platform adapters | terminal, browser, native input, output, resize, streams, device lifecycle; the keyboard, mouse and driver input adapters that turn events into shell commands ([`input.md`](input.md)) | interpreting ANSI or pixels as game state; giving one adapter a command another cannot issue |
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
by the kernel (RULE — `tests/architecture.test.ts`).

**The renderer boundary** (RULE — `tests/architecture.test.ts`, `tests/backend-opentui.test.ts`): the
simulation emits visibility-filtered semantic views and events; the terminal compositor emits an
engine-owned cell frame; platform backends (OpenTUI, direct ANSI, the browser page, and any future
graphical or networked renderer) are adapters that draw that frame and carry input back. The kernel
never reaches the view, and the view never reaches the kernel.

**Language and runtime.** The engine and its content are TypeScript-first (RULE — `tsconfig.json`,
`npm run typecheck`). **The terminal library and the JavaScript runtime are independent choices;
neither implies the other** (RULE — `src/view/backends/ports.ts`: every backend implements the same
ports, and the suite runs on Node and on Bun). The runtime direction is in
[`runtime.md`](runtime.md).

---

## 3. The invariants

The architectural commitments every session needs, one line each, with the part that holds the detail.
Each is a RULE; the test or module that holds it is beside it, or the line says that no code holds it yet. The three worlds above and the layers
are not repeated here.

| Invariant | Held by | Detail |
| --- | --- | --- |
| The kernel is pure: no terminal, clock, network or renderer; no `Math.random`; the same scenario, seed and tick count hash identically on Node and Bun | `tests/architecture.test.ts`, `tests/determinism.test.ts` | [`pulse.md`](pulse.md) |
| Gameplay randomness is one seeded PCG32 stream; cosmetic randomness is a hash of an effect instance's identity, never a stream; the Nexus Pulse, a rule outside the kernel, deals from a seeded stream of its own, so a hand never moves a battle | `tests/rng.test.ts`, `tests/effects.test.ts`, `tests/nexus-draft.test.ts` | [`pulse.md`](pulse.md), [`effects.md`](effects.md) |
| The simulation emits canonical state and ordered semantic events: events carry meaning, not appearance, and no renderer reads cells back into mechanics | `tests/architecture.test.ts` | [`pulse.md`](pulse.md) |
| The simulation never knows a glyph; it knows semantic ids such as `unit.worker` | `tests/architecture.test.ts` | [`presentation.md`](presentation.md) |
| `(0,0)` is the north-west tile, `x` grows east, `y` grows south, scenario rows read north to south: one convention in every module | `tests/scenario.test.ts` | [`grid.md`](grid.md) |
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
| A mission is a sequence of rounds, each a Nexus Pulse, a Build Phase and the Battle Round after it, driven by triggers; simulation actions run inside the kernel as validated intents, presentation actions never touch state, and a scripted Battle Round is still a Pulse | `tests/mission.test.ts`, `tests/mission-loop.test.ts` | [`campaigns.md`](../game-design/campaigns.md) |

Design commitments the game documents own, GUIDANCE until built and played:

- A Commander Army is the playable content boundary: a faction and Grid Nexus, a Commander, starting
  units and structures, blueprints and a real tech tree, upgrades, Nexus powers and Specials. A
  faction is a wide pool and an army fields a few of them; the match only ever sees an army. "A deck
  of cards" is not the model ([`commander-armies.md`](../game-design/commander-armies.md)).
- A mode is data over one match loop and one army shape; Campaign and Challenge are uncorrelated
  ([`game-modes.md`](../game-design/game-modes.md)).
- A Nexus power is a name and one plain line, with no player-facing classification, and, for now, a dealt one
  may be left unpicked; a mission has goals rather than a fixed length
  ([`commander-armies.md`](../game-design/commander-armies.md),
  [`campaigns.md`](../game-design/campaigns.md)).
- Each Nexus is named for the faction that holds it, with Prime or Grid appended where it matters;
  Prime Nexuses stay home and replicate Grid Nexuses ([`lore.md`](../game-design/lore.md)).
- Lore is a platform, not a plot: when clearer ASCII and a richer story compete, the Grid wins
  ([`lore.md`](../game-design/lore.md)).
- Content is TypeScript-first and mostly declarative ([`content.md`](content.md)).

## 4. Vocabulary

- **Grid** — the rectangular integer playfield a match is fought on.
- **Grid Nexus**, **Prime Nexus** — the Nexus replica that sits on the Grid, and the one that stays home and replicates it.
- **round** — one Nexus Pulse, one Build Phase and one Battle Round, in that order: the unit the player counts, "round 2 of 3". In code the round's number is `pulseNumber`; identifiers are not renamed.
- **Nexus Pulse** — the moment each round opens, when the Grid Nexus speaks to its Commander and deals a hand of Nexus powers; the player may keep one during the Build Phase (for now the pick is optional). In the lore it is the Nexus's pulse, felt by its Symbol. It took the place of "the Nexus draft" as the name of that moment and of the dealing (the owner, 2026-10-07: "The Nexus Pulse signals the start of a new round"); "draft" is still the word for choosing from a hand.
- **Build Phase** — the hidden, simultaneous, untimed phase where each player builds their plan.
- **Battle Round** — the fixed-tick, deterministic battle that ends each round and resolves both plans in ASCII. It is the battle's name everywhere, on screen and in the writing, and the player never reads Pulse for it. The owner named it for the player first (2026-10-04: "We can refer to it as Nexus Pulse in lore and design, but Battle Round is better for the player and UI"), and for the design and the lore too once the Nexus Pulse became the round's opening (2026-10-07).
- **the Pulse** (engine) — the engine's name for the deterministic simulation step that resolves a Battle Round: `src/pulse/`, `pulseTicks`, `startPulse`, [`pulse.md`](pulse.md) and the three worlds above. Kept for now in the code and the engine documents; it is never a player's word, and it is not the Nexus Pulse.
- **mission** — a sequence of rounds driven by triggers, with goals rather than a fixed length.
- **group** — units a mission trigger brings onto the Grid together during a round, at a chosen tick, with a name and an intention. A group is never a wave (the owner, 2026-10-04).
- **wave** — the units one building spawns at once in a Battle Round, set down together beside it (the owner, 2026-10-05: "The first wave is at 5 seconds"). How many a wave, how many waves a round and the seconds between them are the building's own, on its card in its army; the first wave comes at the same moment for every building (`firstWave`). The word means only this: a round's battle is a Battle Round, and what a mission brings is a group.
- **Popup pulse** — an Experiment, unrelated to the above: a slow breath of light on a popup's border.
- **Recall** — what happens when a Battle Round ends: surviving units walk home, so the next round starts from what the last one left.
- **starter map** — the Build Phase's one disposable map and the small catalog of buildings it offers; it exists to be played and replaced, and is not a mission.
- **army file** — `armies/<id>/army.json`, an army written as data: it names the armies it builds on and sees only what they bring. `armies/all` holds the cards any Commander may use, `armies/vasse` her Commander and her campaign ([`content.md`](content.md)).
- **target** — the place a level sends a side's troops: they head for it, engage what comes within reach on the way, and stand there ([`pulse.md`](pulse.md)). PERIMETER's is the line.
- **build range** — the ground a new building needs a tile on: within the construction radius of the player's Grid Nexus and of every standing building linked to it, counted as any reach is; a building planned this round gives its range from the next ([`pulse.md`](pulse.md)).
- **room** — the tiles a building that makes units keeps free round it, so its waves have somewhere to appear: no other building may stand there ([`pulse.md`](pulse.md)).
- **distance** — columns across plus two for each row up or down, between the nearest tiles of two footprints: every range, reach and radius counts in it, a reach is every tile within it, and a reach of 1 is touching, a side shared ([`grid.md`](grid.md)).
- **route** — a place in the game written like a web address without its site (`settings`, `campaign?level=vasse-test-1&round=2`); `--at`, the title menu's rows and the browser page's `#at=` all read it ([`routing.md`](routing.md)).
- **bench rosters** — the Citizen, Ravel and Proving Grounds fixtures the tests and the engine tool use; they are not Commander Armies. "Placeholder" is kept for a stand-in number or piece of text, never for content.
- **Commander Army** — the playable package for one player: faction, Commander, starting units and structures, blueprints, upgrades, Nexus powers and Specials.
- **Nexus power** — a named effect with one plain line of description, dealt to the player in a hand at each Nexus Pulse.
- **Experiment** — a design choice put behind a switch in Settings, so Mario can feel both answers and send back the settings export.
- **tuned value** — a number kept in one place in the code (`src/build/tuning.ts`) because it is set by feel and expected to change.
- **menu** — the Build Phase's side panel: one list of rows, each with its hotkey.
- **build menu** — the menu's buildings, each with its cost: what the player can place this round (`constructMenu` and the `catalog` in code).
- **card** — the panel that replaces the menu while something has the map's attention: what is under the cursor, or the building being placed.
- **popup** — one overlay shape: a title and rows, closed by Esc or a click outside.
- **message** — a popup with nothing to choose.
- **hand-off** — a menu row giving the keyboard to the map, shown by a focus arrow or a see-through cursor travelling to the cursor.
- **see-through style** — a glyphless cell write that blends a colour into whatever is under it at a given opacity; the cursor uses it.
- **resize gate** — the TERMINAL TOO SMALL screen shown below the minimum size instead of a cropped Grid.

## 5. The parts

This document is the overview. The design is in its parts, one document each:

- [`grid.md`](grid.md) — the Grid: size and shape, orientation, viewport and scrolling, layers and collision masks, placement and footprints, distance.
- [`pulse.md`](pulse.md) — the Pulse: logical time, movement credit, tick order, determinism and replay, match structure, economy, events.
- [`content.md`](content.md) — content interfaces.
- [`presentation.md`](presentation.md) — the cell frame, composition, the tile, bands, effects, accessibility.
- [`input.md`](input.md) — the command vocabulary, the three adapters, hotkeys and bindings.
- [`runtime.md`](runtime.md) — terminal lifecycle, delivery, tools and modding, scaling.
- [`effects.md`](effects.md) — animations, particles, shading and tweens.
- [`ui-patterns.md`](ui-patterns.md) — every screen, menu, popup and key.
- [`testing.md`](testing.md) — what the suite proves.
