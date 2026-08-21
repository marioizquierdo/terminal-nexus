# Terminal Nexus — ASCII effects and particles

**Document role:** The effect system: contract, starter vocabulary, and the craft rules behind it
**Status:** Canonical direction; the vocabulary is proven or discarded by Milestone 1 Gate 1B
**Canon version:** 2.5
**Updated:** 2026-08-20
**License:** Apache-2.0 for the contract and schemas; CC BY-SA 4.0 for the authored vocabulary

## 0. Why this document exists

A one-cell actor has almost no information in it. A `m` is a letter. What makes it read as a soldier
with mass, moving with intent, dying badly, is **the four frames around it** — anticipation, travel,
impact, debris, settle.

This is the part of Terminal Nexus most likely to decide whether the game is any good, and it is also
the part most likely to be added late, cheaply, as "some flashes." Cogmind's roughly one thousand
procedural particle effects are the standing proof that this is a system, authored deliberately, with
its own vocabulary and its own consistency problems.

So it gets a document, and it gets tested **early** — Gate 1B of Milestone 1 exists for exactly this,
and the Pulse Playground is where it gets played with.

**Authority markers** are as defined in [`engine.md`](engine.md) Section 0: **RULE** and
**GUIDANCE**.

## 1. What an effect is, and is not — RULE

An effect is a **pure function from absolute presentation time to sparse cells.**

```ts
type EffectBand = "ground-items" | "projectiles" | "effects" | "highlights"

interface EffectContext {
  readonly timeMs: number          // absolute presentation time, not time-since-start
  readonly cosmeticSeed: number    // from the cosmetic stream only
  readonly tileWidth: 1 | 2
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

Five rules, all load-bearing:

1. **Absolute time in, cells out.** `f(t)` must not depend on `f(t-1)`. No accumulated state, no
   "step the particle." A frame at *t* is identical whether every earlier frame rendered or the
   renderer skipped forty of them. This is what makes pause, step, speed change, resize, and a slow
   terminal all free.
2. **Effects cannot touch state.** No damage, no movement, no resources, no victory. An effect that
   needs to know something must be given it in `params` when the instance is created.
3. **Cosmetic randomness only.** Derive every random value from `cosmeticSeed` and the instance, never
   from the gameplay stream. A particle that consumes a gameplay draw desynchronises the replay, and
   it will take a day to find.
4. **Tile coordinates, never columns.** The compositor maps tiles to columns at the current tile
   width. An effect that computes in columns breaks at the other width.
5. **Effects never carry a required cue alone.** If the only way to know something was hit is a
   two-frame flash, then a player who blinked, a player with reduced motion, or a player on a slow
   link did not see it. The settled state must always say it too.

### 1.1 Bands — RULE

Effects may only paint in `ground-items`, `projectiles`, `effects`, or `highlights`. They may never
paint in `terrain`, `structures`, `units`, or `air` — those belong to the simulation, and the
corruption law in [`engine.md`](engine.md) Section 9.4 depends on that separation holding absolutely.

## 2. The shape of a good effect — GUIDANCE

Every effect worth authoring has **beats**, not a duration. Name them, then decide their timings:

```text
  ANTICIPATION  →  ACTION  →  IMPACT  →  DECAY  →  SETTLE
     "it is       "it is    "it       "the       "what
      about to     happen-   landed"   world is   is left"
      happen"      ing"                reacting"
```

Most bad terminal effects are missing anticipation and settle. A shot that appears and vanishes reads
as a glitch; a shot that telegraphs, travels, lands, scatters, and leaves a mark reads as a weapon.

Practical timings at 12 logical ticks per second and roughly 30 frames per second — one tick is
~83 ms, one frame is ~33 ms:

| Beat | Typical | Notes |
| --- | --- | --- |
| Anticipation | 80–160 ms | One to two ticks. Enough to be seen, not enough to feel like lag |
| Action | 60–250 ms | Travel time for ranged; near-instant for melee |
| Impact | 60–120 ms | The loudest frames. Two to four frames |
| Decay | 150–400 ms | Debris, scatter, dissipation |
| Settle | 0 ms or permanent | Scorch, rubble, salvage — this is often *state*, not an effect |

**Anything under about 60 ms did not happen.** Two frames is the floor for a beat a player must
notice.

## 3. Craft rules — GUIDANCE

These are the rules the roguelike tradition already paid for. They are cheap to follow and expensive
to discover. See [`ascii-art-references.md`](ascii-art-references.md) for sources.

1. **Author the worst frame first.** Late Pulse, both armies engaged, three effects overlapping. If
   that reads, the calm frames will. Designing the calm frame first guarantees a beautiful opening and
   an unreadable climax.
2. **Different weapons need different physical languages.** If every attack is a burst of `*`, every
   event becomes the same computer effect and the Grid stops telling a story. A kinetic round, a beam,
   an explosion, and a corruption should not share a glyph family.
3. **Similar things must look similar; a tier-3 effect is a tier-1 effect that grew up.** Not a
   different effect. This is the single hardest consistency problem in a large effect set, and the
   only defence is authoring families rather than instances.
4. **Reserve visual weight.** Inverse cells, full-width flashes, and screen-wide shifts belong to rare
   authority and catastrophe. Spend them on a Nexus going critical, not on a rifle.
5. **Negative space is material.** An explosion is mostly the empty cells around it. Filling the
   affected area is what makes ASCII effects look like static.
6. **Directional glyphs carry force.** `/` `\` `|` `-` `^` `v` `<` `>` imply vectors. Use the glyph
   that points the way the energy went; a symmetric burst reads as weightless.
7. **Decay is not fade-out.** Terminals have no alpha. Decay is fewer cells, sparser, dimmer, and
   drifting — a thinning, not a dissolve.
8. **Fresh eyes are the only real test.** The author of an effect cannot see it any more after twenty
   minutes.

## 4. Every effect owes three forms — RULE

Author all three **at the same time**, never in a later accessibility pass. An effect is not finished
until it has all three, and the compositor must be able to select between them.

| Form | Obligation |
| --- | --- |
| **Full** | The intended effect at full capability and full motion |
| **Reduced motion** | Keeps anticipation, impact, and settle. Drops travel, drift, scatter, and decorative movement. **Causality must survive** — you must still be able to tell what hit what |
| **Monochrome** | Carries the same meaning with no colour at all. If it needs colour, it is not finished |

The reduced-motion form is usually the full form with the middle removed and the impact held longer.
The monochrome form usually needs a different glyph, not a different brightness.

## 5. Starter vocabulary — GUIDANCE

Ten effects, enough to render a complete Nexus Pulse. This is the set Gate 1B authors, tests, and
either keeps or rewrites. **Glyphs below are illustrative** — the recipe emits roles and shapes, and
the theme maps them.

| Id | Cue | Band | Beats | Sketch |
| --- | --- | --- | --- | --- |
| `fx.move.trail` | actor moved | `effects` | decay only, ~120 ms | One or two dim cells behind the actor, on the vector it came from. The cheapest effect in the game and the one that does the most — it is what makes a letter read as *moving* rather than *teleporting between tiles* |
| `fx.melee.wind` | melee attack declared | `effects` | anticipation, ~100 ms | A single directional glyph on the attacker's facing edge. The tell that a blow is coming |
| `fx.melee.clash` | melee attack landed | `effects` | impact + short decay | Two or three frames of hard directional marks at the contested edge, thinning outward |
| `fx.ranged.telegraph` | ranged attack declared | `effects` | anticipation, ~80 ms | A bright mark at the shooter, on the firing vector. Without this, ranged fire looks like it comes from nowhere |
| `fx.ranged.tracer` | attack → impact window | `projectiles` | action | A travelling glyph interpolated along the tile line, oriented to the vector: `-` `\` `|` `/`. Presentation only — the simulation resolved this at a tick |
| `fx.impact.burst` | damage applied | `effects` | impact + decay | A small asymmetric scatter biased *away* from the shooter. Asymmetry is what sells direction of force |
| `fx.damage.flash` | damage applied | `highlights` | impact, 2 frames | An attribute change on the target's own cell. The one effect allowed to touch a unit's cell — as an attribute, never as a glyph replacement |
| `fx.death.collapse` | actor died | `effects` | impact, decay, settle | Expanding then thinning debris over the actor's footprint. Must be visibly heavier than `fx.impact.burst` — dying and being hit are the two events players confuse most |
| `fx.structure.collapse` | structure destroyed | `effects` | slow, ~600 ms | Footprint-sized, slower, settling downward. Scale with footprint area, not a constant. Settles into salvage, which is state |
| `fx.nexus.critical` | Nexus below threshold | `effects` | sustained, looping | A slow pulse across the Nexus footprint, phase-locked to absolute time so it is identical on every client. The one sustained effect, and the one allowed real visual weight |

Three notes the implementing session will want:

- `fx.move.trail` matters more than anything else in the list. If only one effect gets authored well,
  make it this one.
- `fx.ranged.telegraph` and `fx.ranged.tracer` share a window: the tracer's `durationMs` is the gap
  between the attack event and the impact event, which the simulation already provides.
- `fx.damage.flash` is deliberately in `highlights` rather than `effects`, so that the corruption law
  cannot let a Glitch effect swallow it.

## 6. Determinism and testing — RULE

An effect is a pure function, so it is **directly testable without a terminal**:

- `f(t)` for a fixed instance, seed, tile width, and capability returns byte-identical cells every
  time;
- sampling `f(t)` at *t* alone equals sampling it after rendering every intervening frame;
- an effect emits nothing outside `[startMs, startMs + durationMs)`;
- an effect emits nothing in a forbidden band;
- an effect emits nothing outside the Grid clip;
- every glyph it emits has terminal width one;
- the full, reduced-motion, and monochrome forms all exist and all emit something at the impact beat.

Snapshot the composed frame at fixed timestamps and diff it. **Do not test effects by watching them**
— watch them to judge them, test them to keep them.

## 7. What this system is not

Not authorized, not designed, not to be built:

- an effect DSL or scripting language — effects are typed TypeScript functions;
- an ECS, particle pool, or physics integrator;
- simulated projectiles that can be intercepted;
- sound. **TBD, dedicated pass required.** The cue subscription points here are a clean future
  attachment surface, and that is the only claim being made;
- procedural generation of effects from parameters. Author them by hand until there are enough to
  see the pattern, which is the same rule as everything else in this project.
