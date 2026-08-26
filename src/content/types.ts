import type { Coord, EntityLayer, Footprint } from "../grid/types.ts"

/** A rational tiles-per-second rate. Never a float — engine.md 4.1, 4.2. */
export type MovementRate = Readonly<{ numerator: number; denominator: number }>

export type AttackKind = "melee" | "ranged" | "heal"

/**
 * Area damage centred on a point, hitting friend and foe alike — the same `{radius, damage}` shape
 * `ContentDef.detonation` already uses. Pulled out under its own name (unit-design-architecture spike)
 * once a second use needed it: an attack's `splash` and a death's `detonation` are the same mechanism
 * at two different trigger moments, not two mechanisms that happen to share a shape.
 */
export type AreaDamage = Readonly<{
  /** Manhattan tiles, measured from the impact point to the nearest occupied tile of each victim. */
  radius: number
  damage: number
}>

export type AttackDef = Readonly<{
  kind: AttackKind
  /** Manhattan tiles, measured to the nearest occupied tile of the target — grid/coords.ts. */
  range: number
  /** For `kind: "heal"`, this is the amount restored, not damage dealt. */
  damage: number
  cooldownTicks: number
  /**
   * Presentation metadata only. The flight window on a ranged attack event is
   * `ceil(distance / projectileTilesPerTick)` ticks, and **no rule reads it** — engine.md 4.3.
   */
  projectileTilesPerTick?: number
  /**
   * Ticks this actor must hold a target in range, off cooldown, before its *first* shot at it may
   * fire — spent only while genuinely holding position to fire, never while marching. One-time: once
   * spent it never rearms, so a unit that already opened fire keeps firing at its normal cadence even
   * if it loses and reacquires a target. The siege-crawler rule shape (unit-design-architecture spike):
   * "moves, then anchors, with a delay, then shoots" needed a one-time hold that plain `cooldownTicks`
   * (which recurs every shot) cannot express on its own.
   */
  windupTicks?: number
  /**
   * If present, a landing hit deals `splash.damage` in `splash.radius` of the *target's* tile to
   * everyone there, friend and foe alike, instead of `damage` to the target alone — the siege-crawler
   * rule shape's AOE half. `damage` is unused when `splash` is set.
   */
  splash?: AreaDamage
  /**
   * Escalating damage the longer this attacker stays locked onto the *same* resolved target,
   * consecutive successful hits only — reset the instant perception reassigns a new target (including
   * losing one). The focus-turret rule shape: `effectiveDamage = round(damage * min(maxPercent, 100 +
   * focusStreak * perHitPercent) / 100)`. Punishes a target for standing and eating it, not for merely
   * existing. Integer percentages, not a fraction — every canonical value the kernel hashes is an
   * integer (`state/canonical.ts`), content definitions included, so `0.5` here is not a legal value
   * even though it would be a legal *runtime* multiplier; the division happens only at attack time,
   * never in the stored definition.
   */
  focusRamp?: Readonly<{ perHitPercent: number; maxPercent: number }>
}>

export type Behavior = "advance" | "flee" | "static" | "support"

/**
 * Volatile munitions — the Ravel rule shape from `commander-armies.md` Section 4.1: many Ravel
 * things detonate when they die, theirs and what they kill, and chains are legal and bounded.
 *
 * It is a **fixture rule on the bench**, not authored Commander Army content: it exists
 * because a Ravel army without it fails the alignment test in `terminal-nexus-lore.md` Section 8.6,
 * where a themed reskin of a generic ability fails and a rule that *is* the characterisation passes.
 * Milestone 4 confirms or discards it when it selects the real microgame.
 */
export type Detonation = AreaDamage & {
  /**
   * If set, this entity detonates the instant an eligible enemy (per `targetLayers`) is within this
   * range, instead of only on death — the contact/suicide-bomber rule shape (unit-design-architecture
   * spike). Absent (default) preserves every existing detonation as death-only.
   */
  triggerRange?: number
}

export type ContentDef = Readonly<{
  id: string
  /** The short name used in report lines: `A:trooper#1`. */
  short: string
  layer: EntityLayer
  footprint: Footprint
  maxHp: number
  movementRate?: MovementRate
  /**
   * Initiative. **Lower acts first**, for movement claims and for attacks alike (engine.md 4.3).
   * It is not a movement rate; that is `movementRate`.
   */
  speedTier: number
  attack?: AttackDef
  /** The layers this entity collides with — engine.md 3.4.1. Terrain impassability is separate. */
  collidesWith: readonly EntityLayer[]
  behavior: Behavior
  /** Dropped as a ground item on death. Nothing consumes it yet; there is no economy. */
  salvage: number
  /** If present, this entity detonates when it dies, damaging friend and foe alike. */
  detonation?: Detonation
  /**
   * This entity is the player's Grid Nexus, and losing it loses the Pulse. A flag rather than a
   * content id: Gate 1A hardcoded `structure.citizen.nexus`, which stopped being true the moment a
   * second faction existed.
   */
  nexus?: boolean
  /**
   * Hard restriction: this entity may only perceive hostiles on these layers as viable targets — for
   * a normal `attack` and for a contact `detonation.triggerRange` alike, since both are resolved from
   * whatever perception already decided. Undefined means every layer, which preserves every existing
   * definition's behaviour and every hash exactly. This is a *targeting* mask, never a *collision*
   * one — engine.md 3.4.1's point that collision and targeting are separate questions applies here
   * too: touching this never touches `collidesWith`, and vice versa. The ground-air asymmetry rule
   * shape (unit-design-architecture spike): a ground melee unit that should never be able to touch a
   * flyer sets this to exclude `"air"`; nothing else about it changes.
   */
  targetLayers?: readonly EntityLayer[]
  /**
   * Soft bias: among the hostiles this entity could target (after `targetLayers`), prefer one on
   * these layers if any is in sight; fall back to the ordinary nearest-enemy scan only when none is.
   * The siege-giant rule shape: "prefers structures" without ever being *unable* to fight back when
   * none remain.
   */
  targetPreference?: readonly EntityLayer[]
  /**
   * While alive, every `intervalTicks` this entity attempts to create one more `contentId` for its
   * own player on a free adjacent tile, holding off whenever `maxAlive` of that content id already
   * live for that player. The spawner rule shape (unit-design-architecture spike) — a combat ability
   * a living unit performs, not an economy: no cost, no resource, nothing Milestone 2's production
   * phase would recognise as its own. See `Q26` in `specs/open-questions.md` for the scope line this
   * still has to answer before a real roster could use it.
   */
  spawn?: Readonly<{ contentId: string; intervalTicks: number; maxAlive: number }>
  /**
   * The instant this entity dies (before its own `detonation`, if any, goes off), create `count` more
   * `contentId` for its own player near where it fell. The golem rule shape: dying multiplies instead
   * of only damaging — the same "an ending creates more of the story" spirit as volatile munitions,
   * running through the spawn primitive instead of the blast one.
   */
  splitOnDeath?: Readonly<{ contentId: string; count: number }>
}>

/**
 * The default per-entity fields every fresh instance of this content starts with — shared by the
 * scenario loader (a scenario's own initial placements, `scenario/load.ts`) and the kernel's own
 * spawn point (a unit created mid-Pulse, `pulse/spawn.ts`), so a fresh entity's defaults are declared
 * once rather than kept in sync by hand in two files that create entities for two different reasons.
 * Lives here rather than in `state/types.ts` because it reads `ContentDef` fields; `state` stays
 * unaware of content.
 */
export function freshEntityFields(definition: ContentDef): Readonly<{
  moveCredit: number
  cooldown: number
  targetOrdinal: null
  windup: number
  spawnCooldown: number
  focusStreak: number
}> {
  return {
    moveCredit: 0,
    cooldown: 0,
    targetOrdinal: null,
    windup: definition.attack?.windupTicks ?? 0,
    spawnCooldown: definition.spawn?.intervalTicks ?? 0,
    focusStreak: 0,
  }
}

export function rectFootprint(width: number, height: number): Footprint {
  const tiles: Coord[] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles.push({ x, y })
    }
  }
  return tiles
}
