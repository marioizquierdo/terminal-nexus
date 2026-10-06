# Terminal Nexus — ASCII effects and particles

_How animations, particles, shading and tweens are defined, timed, authored and tested; the authored effect vocabulary (the glyphs and visual direction) is CC BY-SA 4.0, the recipes' code Apache-2.0._

## Why effects get their own page

A one-cell actor has almost no information in it. A `m` is a letter. What makes it read as a soldier
with mass, moving with intent, dying badly, is the frames around it: anticipation, travel, impact,
debris, settle.

This is the part of Terminal Nexus most likely to decide whether the game is any good, and the part
most likely to be added late, cheaply, as "some flashes". Cogmind's roughly one thousand procedural
particle effects are the standing proof that this is a system, authored deliberately, with its own
vocabulary and its own consistency problems. So it is tested early, and `grid` (the engine tool, see
[`runtime.md`](runtime.md)) is where effects are played with.

The markers are defined in [`grid-engine.md`](grid-engine.md): **RULE**, **GUIDANCE** (anything
unmarked) and **IDEA**.

## What an effect is, and is not — RULE

An effect is a **pure function from absolute presentation time to sparse cells.**

```ts
type EffectBand = "ground-items" | "projectiles" | "effects" | "highlights"

interface EffectContext {
  readonly timeMs: number          // absolute presentation time, not time-since-start
  readonly cosmeticSeed: number    // from the cosmetic stream only
  readonly reducedMotion: boolean
  readonly capability: CapabilityMode
}

interface EffectInstance {
  readonly recipe: ContentId
  readonly band: EffectBand
  readonly startMs: number
  readonly durationMs: number
  readonly origin: Coord           // tile coordinates, never columns
  readonly target?: Coord
  readonly params: Readonly<Record<string, number | string>>
}

/** Returns the cells this effect paints at ctx.timeMs, or nothing if it is not active. */
type EffectRecipe = (
  instance: EffectInstance,
  ctx: EffectContext,
) => readonly PositionedCell[]
```

Six rules, all load-bearing:

1. **Absolute time in, cells out.** RULE — `tests/effects.test.ts`, `tests/tween.test.ts`,
   `tests/animation.test.ts`. `f(t)` must not depend on `f(t-1)`. No accumulated state, no "step the
   particle". A frame at *t* is identical whether every earlier frame rendered or the renderer skipped
   forty of them. This is what makes pause, step, speed change, resize and a slow terminal all free:
   presentation time is independent of the Pulse's logical time.
2. **Effects cannot touch state.** RULE — `tests/architecture.test.ts` (the kernel never reaches the
   view), `tests/effects.test.ts` ("effects are derived from the event stream, and turning them off
   changes only the picture"). No damage, no movement, no resources, no victory. An effect that needs
   to know something is given it in `params` when the instance is created.
3. **Cosmetic randomness only, and it is a hash rather than a stream.** RULE —
   `tests/effects.test.ts` ("cosmetic randomness is a hash, not a stream", "the cosmetic seed cannot
   reach the kernel"), `tests/determinism.test.ts` (changing only the cosmetic seed changes nothing
   about state or events); implemented in `src/view/effects/random.ts`. Derive every random value
   from `cosmeticSeed` and the instance's own identity, never from the gameplay stream. A generator
   cannot do this job: a stream's answers depend on how many times it has been asked, so the same
   effect would scatter differently depending on which frames rendered, which rule 1 forbids. Hashing
   `(cosmeticSeed, recipe, startMs, origin, salt)` gives stable randomness at any time, in any order,
   on any machine, and makes the separation structural: there is no stream here to share with
   gameplay. A particle that consumes a gameplay draw desynchronises the replay, and it takes a day to
   find. The seeded gameplay generator is PCG32 and never reaches an effect.
4. **Tile coordinates, never columns.** GUIDANCE. A tile is one cell, and the compositor places it through the
   camera; an effect names tiles and never counts columns. Text is not an effect: Vasse's line beside her is
   laid out a letter a tile, so the scene draws it, under the corruption law, rather than a recipe
   (`src/view/pulse-scene.ts`).
5. **An effect that shows an area the rules decide draws the rules' own tiles** (RULE for the blast —
   `tests/effects.test.ts`, "what flashes is what was hit"). A blast flashes the ground it reaches and nothing
   else: its ring is the outline of the ground reached so far (`outlineWithin`), round the whole body that blew
   up, so a blast of 2 spreads two columns either side and one row up and down. A shape that claims no area —
   death debris and its shockwave, sparks, an impact's shard, the tracer's line, the intro highlight's ring —
   is decoration, never drawn to say how far something reached.
6. **Effects never carry a required cue alone.** GUIDANCE. If the only way to know something was hit
   is a two-frame flash, a player who blinked, a player with reduced motion or a player on a slow link
   did not see it. The settled state must always say it too.

### Bands — RULE

RULE — `tests/effects.test.ts` ("every effect paints in a legal band, and never in one the simulation
owns"). Effects may only paint in `ground-items`, `projectiles`, `effects` or `highlights`. They never
paint in `terrain`, `structures`, `units` or `air`: those belong to the simulation, and the corruption
law in [`presentation.md`](presentation.md) depends on that separation holding absolutely.

**Band separation is not enough on its own, and the compositor closes the gap.** RULE —
`src/view/effects/composite.ts`, `tests/build-placement.test.ts` ("sparks … never land on a
building: the corruption law holds"). A legal band still draws over the Grid, so an effect cell landing
on an occupied tile replaces the only cell carrying that entity's semantic cue. The compositor
therefore **drops any effect cell that would replace an entity glyph**, and permits exactly one kind
of write onto an occupied tile: a **glyphless** cell that keeps the glyph beneath it and applies only
its attributes. That is the mechanism `fx.damage.flash` uses, and why that effect may touch a unit's
own cell at all. Recipes are not asked to remember this; they cannot break it. Corruption effects
never occupy the `units` or `structures` bands, and never remove the only carrier of a required
semantic cue.

### The presentation toolkit — RULE

Everything that moves or glows without changing state belongs to one of **four families**, and every
one of them is a pure function of absolute presentation time (RULE — `tests/effects.test.ts`,
`tests/animation.test.ts`, `tests/tween.test.ts`):

- **Animations** — a short run of footprint-sized frames drawn on an entity's own cells (a building
  rising, later a unit's attack pose), with a little metadata: each frame's share of the time, and
  whether the last frame clears, holds, or loops (`src/view/animation.ts`). The only family that may
  change the glyph an entity stands on, because it is that entity's drawing.
- **Particles** — short-lived glyphs thrown around something (`src/view/effects/particles.ts` and the
  Pulse recipes). The compositor drops any that would land on an occupied tile.
- **Shading** — glyphless colour or attribute changes (a light, a tint, a rainbow, the damage flash)
  over characters already drawn (`src/view/effects/shading.ts`). The only kind of effect cell allowed
  onto an occupied tile. The name keeps the word "shader" and admits that a rainbow sweep is not a
  light.
- **Tweens** — a number or point moving between two values over a window of time, along an easing
  curve (`src/view/tween.ts`): the camera's slide and the cursor's glide ([`grid.md`](grid.md)), the
  Build Phase's focus arrow, see-through cursor and card reveal (below), and the expansions inside
  recipes.

**Each entity animates on a track: the list of timestamped requests made of it**, and what it draws at
time *t* is a pure function of that list. RULE — `tests/animation.test.ts`. The requests are *play*
(with a stacking policy: replace what is playing, queue after it, or ignore the request), *cancel*,
*speed change* and *finish*. A request made at time *a* never changes a frame before *a*. Only *play*
is used live today; the others exist, tested, so the next use needs no new shape.

**Completion is scheduled data, never a callback.** RULE — `tests/animation.test.ts` ("follow-ups are
data scheduled at the completion time", "replace … its follow-ups never happen"). A play may carry
follow-ups — effects, or further plays — scheduled at the moment it completes, by playing out or being
finished. A play that is cancelled or replaced never completes, so its follow-ups never happen.
Nothing fires from the renderer, and nothing reaches state: the effects library exists so the project
can experiment with different effects without any side effect on the gameplay.

Light and sparks are generic recipes (`fx.light.flash`, `fx.sparks.burst`), parameterised by origin,
footprint and size, usable by anything: a placement and a Commander beginning to speak today, a death or an
impact later.

## The shape of a good effect

Every effect worth authoring has **beats**, not a duration. Name them, then decide their timings:

```text
  ANTICIPATION  →  ACTION  →  IMPACT  →  DECAY  →  SETTLE
     "it is       "it is    "it       "the       "what
      about to     happen-   landed"   world is   is left"
      happen"      ing"                reacting"
```

Most bad terminal effects are missing anticipation and settle. A shot that appears and vanishes reads
as a glitch; a shot that telegraphs, travels, lands, scatters and leaves a mark reads as a weapon.

Practical timings at 12 logical ticks per second and roughly 30 frames per second, where one tick is
about 83 ms and one frame about 33 ms:

| Beat | Typical | Notes |
| --- | --- | --- |
| Anticipation | 80–160 ms | One to two ticks. Enough to be seen, not enough to feel like lag |
| Action | 60–250 ms | Travel time for ranged; near-instant for melee |
| Impact | 60–120 ms | The loudest frames. Two to four frames |
| Decay | 150–400 ms | Debris, scatter, dissipation |
| Settle | 0 ms or permanent | Scorch, rubble, salvage — this is often *state*, not an effect |

**Anything under about 60 ms did not happen.** Two frames is the floor for a beat a player must
notice.

## Craft rules

These are the rules the roguelike tradition already paid for. They are cheap to follow and expensive
to discover. See [`ascii-art-references.md`](../game-design/ascii-art-references.md) for sources.

1. **Author the worst frame first.** Late Pulse, both armies engaged, three effects overlapping. If
   that reads, the calm frames will. Designing the calm frame first guarantees a beautiful opening and
   an unreadable climax.
2. **Different weapons need different physical languages.** If every attack is a burst of `*`, every
   event becomes the same computer effect and the Grid stops telling a story. A kinetic round, a beam,
   an explosion and a corruption should not share a glyph family.
3. **Similar things must look similar; a tier-3 effect is a tier-1 effect that grew up.** Not a
   different effect. This is the hardest consistency problem in a large effect set, and the only
   defence is authoring families rather than instances.
4. **Reserve visual weight.** Inverse cells, full-width flashes and screen-wide shifts belong to rare
   authority and catastrophe. Spend them on a Nexus going critical, not on a rifle.
5. **Negative space is material.** An explosion is mostly the empty cells around it. Filling the
   affected area is what makes ASCII effects look like static.
6. **Directional glyphs carry force.** `/` `\` `|` `-` `^` `v` `<` `>` imply vectors. Use the glyph
   that points the way the energy went; a symmetric burst reads as weightless.
7. **Decay is not fade-out.** Terminals have no alpha. Decay is fewer cells, sparser, dimmer and
   drifting: a thinning, not a dissolve.

   **One narrow departure — RULE** (`tests/effects.test.ts`: "fade is never set outside
   fx.damage.flash - the departure stays narrow"). `CellStyle.fade`
   ([`presentation.md`](presentation.md)) gives `fx.damage.flash` alone a real, continuous
   alpha-toward-background blend across its own short window, plus a summed version of the same scalar
   when several flashes land on one tile in the same frame (`resolveLighting`,
   `src/view/effects/composite.ts`; `tests/effects.test.ts` "a real damage flash … carries fade all the
   way to the composed frame"). The scalar is `fgRole`-only, `0` the role's own colour to `1` the
   theme's background, and is resolved only at 256 colours and truecolor. This is not a reversal of the
   rule above: it is an exception for the one effect that is already an attribute-only write on a cell
   that is never its own glyph. Every other effect still decays by thinning. Do not reach for `fade`
   to make a glyph-bearing effect (debris, a blast ring, a death collapse) dissolve instead of thin.

   **Three interface departures, which are the interface's and not effects':** the card reveal fades the Build
   Phase panel's own text with `fade` (chrome, never an effect's glyph); the raid's intent trail, a map mark
   rather than an effect, draws its arrows faded and lets the copy each moving arrow leaves behind fade away
   within half a step; and the see-through cursor uses a real alpha, the `seeThrough` field
   ([`presentation.md`](presentation.md)), because it is a cursor passing over the map, not an effect decaying
   on it. None licenses fading a glyph-bearing effect.
8. **Fresh eyes are the only real test.** The author of an effect cannot see it any more after twenty
   minutes.

## Every effect owes three forms — RULE

RULE — `tests/effects.test.ts` ("all three forms exist and all three emit at the impact beat",
"reduced motion keeps causality"). Author all three at the same time, never in a later accessibility
pass. An effect is not finished until it has all three, and the compositor must be able to select
between them.

| Form | Obligation |
| --- | --- |
| **Full** | The intended effect at full capability and full motion |
| **Reduced motion** | Keeps anticipation, impact and settle. Drops travel, drift, scatter and decorative movement. **Causality must survive**: you must still be able to tell what hit what |
| **Monochrome** | Carries the same meaning with no colour at all. If it needs colour, it is not finished |

The reduced-motion form is usually the full form with the middle removed and the impact held longer.
The monochrome form usually needs a different glyph, not a different brightness.

## Starter vocabulary

The Pulse's effects, the placement effects and the Build Phase's interface effects: enough to render a
complete Nexus Pulse and the Build Phase's motion. **Glyphs below are illustrative**: the recipe emits roles and shapes,
and the theme maps them.

**This table is the list of effects, and the code holds it in both directions.** RULE —
`tests/effects.test.ts` ("the starter vocabulary is authored, all of it"): an effect that is not in the
table is undocumented, a listed effect that is not authored is a lie, and the test asserts the exact
size of the set, so the count moves only on purpose.

| Id | Cue | Band | Beats | Sketch |
| --- | --- | --- | --- | --- |
| `fx.move.trail` | actor moved | `effects` | decay only, ~120 ms | One or two dim cells behind the actor, on the vector it came from. The cheapest effect in the game and the one that does the most: it makes a letter read as *moving* rather than *teleporting between tiles*. Drawn in dust, not in `-` `\|` `/` `\`, which are the language of shots and blows |
| `fx.melee.wind` | melee attack declared | `effects` | anticipation, ~100 ms | A single directional glyph on the attacker's facing edge. The tell that a blow is coming |
| `fx.melee.clash` | melee attack landed | `effects` | impact + short decay | Two or three frames of hard directional marks at the contested edge, thinning outward |
| `fx.ranged.telegraph` | ranged attack declared | `effects` | anticipation, ~80 ms | A bright mark at the shooter, on the firing vector. Without this, ranged fire looks like it comes from nowhere |
| `fx.ranged.tracer` | attack → impact window | `projectiles` | action | A travelling glyph interpolated along the tile line, oriented to the vector: `-` `\` `\|` `/`. Presentation only: the simulation resolved this at a tick. Shares a window with the telegraph: its `durationMs` is the gap between the attack event and the impact event, which the simulation already provides |
| `fx.impact.burst` | damage applied | `effects` | impact + decay | A small asymmetric scatter biased *away* from the shooter. Asymmetry is what sells direction of force |
| `fx.damage.flash` | damage applied | `highlights` | impact, 2 frames | An attribute change on the target's own cell. The one effect allowed to touch a unit's cell, as an attribute, never as a glyph replacement. Deliberately in `highlights` rather than `effects`, so a Glitch effect cannot swallow it |
| `fx.death.collapse` | actor died | `effects` | impact, decay, settle | Expanding then thinning debris over the actor's footprint. Must be visibly heavier than `fx.impact.burst`: dying and being hit are the two events players confuse most |
| `fx.structure.collapse` | structure destroyed | `effects` | slow, ~600 ms | Footprint-sized, slower, settling downward. Scale with footprint area, not a constant. Settles into salvage, which is state |
| `fx.nexus.critical` | Nexus below threshold | `effects` | sustained, looping | A slow pulse across the Nexus footprint, phase-locked to absolute time so it is identical on every client. The one sustained effect, and the one allowed real visual weight |
| `fx.blast.detonation` | an entity detonated | `effects` | impact, spread, thinning | The ground the blast reaches, as the rule reaches it: a ring that is the outline of the tiles within its reach so far, round the whole body, spreading fast then slowing to its radius and thinning; a bright mark on the body's centre tile; sub-bursts on that ground, in even sectors of it as the screen shows it, drawn only on it. Reduced motion: the whole reach's outline, held, no sub-bursts. The second effect allowed real weight, because it is the one event that can end an army in a single tick. A death that damages a radius is not just a death |
| `fx.sparks.burst` | something happened to a thing standing there (a placement today) | `effects` | impact + decay (~400 ms) | Sparks launched from the ring one tile outside the footprint, flying outward and thinning to dust; never on a building. Randomness hashes a `key`/`id` identity when given (a player action: plan ordinal, structure, anchor), otherwise the start time. Reduced motion: a still mark at the four corners |
| `fx.light.flash` | the same moment, on the thing itself (a placement; a Commander beginning a line in battle) | `highlights` | impact + decay (~400 ms) | Shading: a glyphless tint over the footprint toward the theme's strongest ink, or a rainbow sweep, falling off. Reduced motion: a steady half-strength light. Monochrome: nothing, so the caller keeps its own cue (a placement draws its scaffold plain and the finished building bold) |
| `fx.focus.light` | a dialog line names a focus (the intro highlight: Vasse as PERIMETER opens, and the round she is restored) | `highlights` | sustained while the line shows: lit, then breathing | "She should have an intro highlight when she shows up." A see-through light on the ground around the focus, never on its own cells: the ring of tiles around its footprint, a row deep above and below and as many columns deep at the sides as a row counts, so it reads round, the outer columns at half the light so it reads as a glow. It breathes from 0.34 down to 0.12 at the "Popup pulse" Experiment's pace, from the frame the line appeared, so the Popup pulse at 0 holds it steady. Reduced motion: steady. Monochrome and 16 colours: the focus's own cells inverted, an attribute, never a glyph |
| focus arrow (interface) | a building armed from the menu | `chrome`, under every popup | action, eased out (250 ms, a tuned value shared with the see-through cursor) | "It almost seems like the energy of the building is transferred from the menu to the grid." A tween from the cell just right of the building's own row on the menu toward the cursor as drawn that frame, so it homes on a cursor that moves meanwhile, stopping one cell short of the cursor's tile; the head points the way it flies (`> < v ^`; Unicode `▶ ◀ ▼ ▲`, a row counting as two columns when the slope is read) and a four-cell trail follows, each cell the step that reached it (`- \| \ /`; `━ ┃ ╲ ╱`), the older two dim. Hotkey colour, bold. On a building's tile or the ghost being placed only the style changes. Never during a Pulse: the shot glyphs are the Pulse's language, and in the Build Phase nothing shoots. Keys work throughout. Reduced motion: dropped, since it is travel, and the blink after it keeps the cue. Monochrome: the glyphs carry it |
| cursor blink (interface) | the focus arrow or the see-through cursor landed | `highlights` | impact, `n` blinks | An Experiment, settled at 2 blinks. The cursor drawn in a menu row's pressed look (hotkey colour, inverse, bold, underlined) for the pressed flash's own duration (90 ms, a tuned value), with a gap of the same length between blinks: the menu's acknowledgement, moved to where the eye should go. At once under reduced motion or with the arrow off. The arrow and the blink stop for good when the keyboard leaves the map, a popup opens or the plan is committed. Monochrome: inverse and underline carry it |
| see-through cursor (interface) | Explore Map opened from the menu | `chrome`, under every popup | action, eased out, on the focus arrow's timeline | "Exploring is just moving the focus to the map": a copy of the map cursor, one tile wide, from Explore Map's row to the cursor as drawn, homing on it; glyphless writes carrying `seeThrough` (the cursor's role at an alpha, mixed with the cell's background and glyph colour) at 0.8 at the head, 0.45 and 0.2 one and two tile-steps behind; never on the real cursor's own cells, into which it settles. The glyph beneath always survives. Truecolor exact, 256 nearest, 16 and monochrome the plain cursor from alpha one half. Reduced motion: dropped with the arrow; the blink keeps the cue |
| card reveal (interface) | the side panel becomes a card (Explore Map opened, a building armed) | `chrome` | anticipation, action, settle (400 ms, a tuned value) | Three beats, 25% / 30% / 45%: the other rows fade (`fade` where colour blends, dim for the nearer-gone half at 16 colours and monochrome); the chosen row, drawn active, slides whole rows up to the header line; the separator and the card fade in, the name, subtitle and description typed, a building's icon playing its own placement frames. From one card to another only the last beat plays; closing is instant; a still frame is the finished card. Timed by the live loop from the state becoming a card. Reduced motion: none |
| popup border: opening, then breath (interface) | any popup is open | `chrome` | an opening played once (the Battle Round screen: two flashes, 530 ms), then sustained and looping (one breath per "Popup pulse" — a Settings name for the breath of light, unrelated to the Nexus Pulse — 2000 ms) | Experiments: "Popup pulse", "Battle Round flash", "Flash strength". A subtle, unobtrusive breath on every popup, and for the Battle Round screen an initial double flash with more contrast range, then the default breath. Only the border plays (never its title, text or shadow); which popup has which opening is a table in the view. The breath follows a sine: a tint toward `chrome.title` on the lighter half (up to 0.4) and a fade toward the background on the darker half (up to 0.25), both below the 16-colour half-way step. The double flash is two 220 ms flashes 90 ms apart, each lit fast and faded slowly, up to 0.8 of the way to `chrome.title`; it ends at rest and the breath starts from rest, so there is no jump. Both are timed from the frame that first showed the popup and restart when another popup replaces it; every still frame draws the border at rest. The flash is drawn every frame; while only the breath moves the live loop redraws 20 times a second, and it stops when the last popup closes. Reduced motion and monochrome: still. 16 colours: the flash only, as two steps onto the title's colour, then still. The screen's words carry the cue |
| raid's intent trail (interface) | a raid group is foreseen, in the Build Phase | `territory` | sustained and looping, a step per `trailStepMs` (400 ms, a tuned value) | The owner's "slow-moving line of arrows ... 1 arrow every 3 tiles, leaving a transparent arrow behind". An arrow every four along the group's way by the Grid's own distance, four columns or two rows, pointing a whole stair on; each step every arrow goes a column's distance on, a row taking two steps, the one beside the target going in as a new one comes out of the group, and an arrow that reaches another tile leaves a copy on the one it left that fades (0.6, then 0.8) and is gone at half a step. Open ground only, never over a glyph. The live loop asks for a frame only when it changes, and none while it is out of view. Holds still under a popup and on a committed plan, and starts again from the still trail. Reduced motion: still. Monochrome and 16 colours: the copy is the arrow's own dim look, then gone |

`fx.focus.light` is held by `tests/dialog.test.ts` and `tests/effects.test.ts`. The interface rows are held by `tests/build-handoff.test.ts` (focus arrow and blink),
`tests/see-through.test.ts` (the see-through cursor), `tests/build-card.test.ts` (card reveal),
`tests/build-breath.test.ts` (popup border) and `tests/raid-view.test.ts` (the raid's intent trail).

**Simultaneous instances of the same effect are staggered in presentation.** A detonation chain
resolves inside one tick, and drawn that way it is one frame of noise rather than a chain, so each
blast in a tick is held back a little longer than the last and the eye can follow it. Presentation may
lie about timing; it may not lie about what happened. (A same-tick ranged kill likewise holds its death
and blast until the tracer lands: `tests/effects.test.ts`, `tests/view.test.ts`.)

If only one effect gets authored well, make it `fx.move.trail`.

### Adding an effect to the vocabulary

The vocabulary is meant to grow: a recipe is an ordinary typed function in one record
(`EFFECT_RECIPES`, `src/view/effects/recipes.ts`), and nothing about adding one is architectural. It
is deliberately not *silent*: two guards make a new id a decision rather than an accident, and a
session that trips them updates them rather than routes around them.

1. **The table above**, held by the vocabulary test.
2. **`params` is flat.** `EffectParams` is `Record<string, number | string>`: scalars, no nested
   structures. That is a real constraint the first time one effect wants to hand another anything
   richer than a number, and it is the constraint to reconsider deliberately rather than widen in
   passing.

An effect that is a *variation* of an existing one (a bigger version, a faction's dialect of it)
should usually be the same recipe reading `instance.family` or a param, not a new id: a tier-3 effect
is a tier-1 effect that grew up.

## What the tests hold — RULE

RULE — `tests/effects.test.ts`. An effect is a pure function, so it is directly testable without a
terminal:

- `f(t)` for a fixed instance, seed and capability returns byte-identical cells every time;
- sampling `f(t)` at *t* alone equals sampling it after rendering every intervening frame;
- an effect emits nothing outside `[startMs, startMs + durationMs)`;
- an effect emits nothing in a forbidden band;
- an effect emits nothing outside the Grid clip;
- every glyph it emits has terminal width one;
- the full, reduced-motion and monochrome forms all exist and all emit something at the impact beat.
- a blast draws only tiles its rule reaches, in every form and body size, and under reduced motion exactly its
  reach's outline.

An effect for something the **player** does (a placement) hashes that action's identity
(`fx.sparks.burst`'s `key`) rather than its start time, so the same plan throws the same sparks however
fast it was typed (`tests/build-placement.test.ts`).

Snapshot the composed frame at fixed timestamps and diff it. **Do not test effects by watching them**:
watch them to judge them, test them to keep them.

## What this system is not

Departing from this list is not a preference: a session that builds one of these owes the pull request
the case that the work showed better, and that it is a *second* real use that shows where the seam
actually is, not the first one that would find it convenient.

Not designed, not to be built:

- an effect DSL or scripting language — effects are typed TypeScript functions;
- an ECS, particle pool or physics integrator (an animation track is none of these: it is a pure fold
  over a list of requests, holding nothing between frames);
- simulated projectiles that can be intercepted;
- sound — **IDEA**, dedicated pass required. The cue subscription points are a clean future attachment
  surface, and that is the only claim being made;
- procedural generation of effects from parameters. Author them by hand until there are enough to see
  the pattern, which is the same rule as everything else in this project.
