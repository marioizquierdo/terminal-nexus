// STATE — what is true. Plain serializable data that knows nothing about time passing and nothing
// about drawing (grid-engine.md). Only the Pulse mutates it.

import type { Coord, Direction, GridTerrain, VacatedEntry } from "../grid/types.ts"
import type { RngState } from "../rng/pcg32.ts"

export type PlayerId = "A" | "B"

export const PLAYERS: readonly PlayerId[] = ["A", "B"]

export type EntityState = Readonly<{
  /** Identity and the one iteration order. Assigned at spawn, never reused. */
  ordinal: number
  /** The display identity used by reports and events: `A:trooper#1`. */
  id: string
  player: PlayerId
  contentId: string
  hp: number
  /** The entity's coordinate and centre of authority (grid.md). */
  anchor: Coord
  /**
   * Presentation-only, and the single deliberate exception to "state carries nothing only
   * presentation reads" (grid-engine.md). Whether facing should ever affect
   * a rule was settled as no (Q9, answered). Derived from the last step, or from the current target
   * when stationary. No rule reads it.
   */
  facing: Direction
  /** Integer movement credit (pulse.md). Capped at one step's cost. */
  moveCredit: number
  /** Ticks remaining before this entity may attack again. */
  cooldown: number
  /** Ordinal of the entity this one selected in the perception phase, if any. */
  targetOrdinal: number | null
  /**
   * Ticks remaining before `attack.windupTicks` lets this entity's first shot at a newly-held target
   * fire. Zero for content with no `windupTicks` and, permanently, once spent — content/types.ts's
   * `freshEntityFields` is the one place that decides the starting value.
   */
  windup: number
  /** Ticks remaining until `spawn` next attempts to create an entity. Zero for content with no `spawn`. */
  spawnCooldown: number
  /** Consecutive successful hits against the *current* target only — `attack.focusRamp`'s memory,
   * reset the instant perception reassigns a new target (including losing one). */
  focusStreak: number
  /**
   * Commitment to a target (`COMMIT_TICKS`, `src/pulse/perception.ts`): the nearest this entity has come to the target
   * it holds since it chose it (the Grid's distance), and the ticks since it last closed on it or had it in attack
   * range. Absent when it holds no target, and `commitStall` absent at zero, so a state with no fight in it hashes as
   * it did before commitment existed.
   */
  commitGap?: number | undefined
  commitStall?: number | undefined
  /**
   * A producer's recipe (`ContentDef.production`), counted: ticks remaining until its next wave comes, how
   * many of its waves have come this Pulse, and how many units of them it still owes — set down on the first
   * tick there is room beside it. Present only on a producer — absent, not zero, on everything else, so a
   * state with no producer in it serializes and hashes byte for byte as it did before production
   * existed, which is also why adding them did not bump `SCHEMA_VERSION`.
   */
  productionCooldown?: number
  produced?: number
  owed?: number
  /**
   * For a unit a building trained: that building's ordinal, and the tile it came out on (its anchor as it was set
   * down on the roof). Recall once sent it home there, onto the roof of the building that made it; since survivors stay
   * on the Grid and regroup (`src/match/regroup.ts`) no rule reads it, and it is kept for one that may. Absent on
   * everything no building trained, so a state with none hashes as it did before; and a building's ordinal is never
   * reused, so a fallen home is simply not found.
   */
  home?: number
  homeAt?: Coord
}>

export type GroundItem = Readonly<{
  at: Coord
  amount: number
  sourceId: string
  sourceContentId: string
}>

/**
 * A rectangle of the Grid a side's fighting units head for — a campaign level's target for the player's
 * troops (pulse.md, perception and intents). Inclusive of its north-west tile, `width` by `height` tiles.
 */
export type TargetArea = Readonly<{ x: number; y: number; width: number; height: number }>

/**
 * A patch of ground set burning by a landing hit (`AttackDef.burn`): every unit and worker within `radius` of
 * `centre`, measured as range is, of either side, takes `damage` on each tick that is a whole number of `everyTicks`
 * after `startedTick`, until `untilTick` (inclusive). `source` and `sourceOrdinal` are the shooter's, for the record
 * (it may have fallen since); `player` its side. Ordered by when they were lit, then by `sourceOrdinal`.
 */
export type BurningGround = Readonly<{
  centre: Coord
  radius: number
  damage: number
  everyTicks: number
  startedTick: number
  untilTick: number
  player: PlayerId
  source: string
  sourceOrdinal: number
}>

export type VictoryReason = "nexus-destroyed" | "annihilation" | "tick-limit"

export type Outcome = Readonly<{
  /** `null` is a draw: the tick count ran out with both sides standing. */
  winner: PlayerId | null
  reason: VictoryReason
  tick: number
}>

export type MatchState = Readonly<{
  schemaVersion: number
  /** Ticks elapsed. A resolved Pulse leaves this at the tick the run ended on. */
  tick: number
  /** Replay metadata that cannot change inside a ruleset version (pulse.md). */
  ticksPerSecond: number
  grid: GridTerrain
  /** Ordered by `ordinal`. Dead entities are removed; the event stream carries their story. */
  entities: readonly EntityState[]
  groundItems: readonly GroundItem[]
  /**
   * Tiles a death vacated recently enough to still be blocked — the settle rule the owner's first
   * playtest asked for. Pruned every tick; empty almost always, present only while a corpse's tile
   * is still cooling.
   */
  vacatedTiles: readonly VacatedEntry[]
  outcome: Outcome | null
  rng: RngState
  nextOrdinal: number
  /**
   * Where each side's fighting units head when no enemy is within their reach: the target a campaign
   * level names for a side (pulse.md). A side with none heads for the enemy's Grid Nexus, engaging what comes
   * within its reach on the way (`headsForNexus`, `src/pulse/perception.ts`). Only the trigger runner sets it (`src/match/mission.ts`),
   * at a Pulse's start or between two ticks; the kernel reads it and never changes it.
   *
   * Absent, never empty, when no side has one — so a state without a target serializes and hashes byte for
   * byte as it did before targets existed, which is also why adding it did not bump `SCHEMA_VERSION`, the
   * way the production timers did not.
   */
  targets?: Readonly<Partial<Record<PlayerId, TargetArea>>>
  /**
   * The ground burning now (`BurningGround`): lit by a landing hit, put out when its time ends, and put out by
   * the regroup between rounds. Absent, never empty, when nothing burns, so a state without fire hashes byte for byte as
   * it did before fire existed, as `targets` and the production timers did.
   */
  burning?: readonly BurningGround[]
}>

/**
 * Bumped to 2: `MatchState` gained `vacatedTiles` for the post-death settle rule. Bumped to 3:
 * `EntityState` gained `windup`, `spawnCooldown`, and `focusStreak` for the unit-architecture
 * spike's siege-crawler, spawner, and focus-turret rule shapes.
 */
export const SCHEMA_VERSION = 3
