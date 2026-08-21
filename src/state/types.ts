// STATE — what is true. Plain serializable data that knows nothing about time passing and nothing
// about drawing (engine.md 1). Only the Pulse mutates it.

import type { Coord, Direction, GridTerrain } from "../grid/types.ts"
import type { RngState } from "../rng/pcg32.ts"

export type PlayerId = "A" | "B"

export const PLAYERS: readonly PlayerId[] = ["A", "B"]

export function opponentOf(player: PlayerId): PlayerId {
  return player === "A" ? "B" : "A"
}

export type EntityState = Readonly<{
  /** Identity and the one iteration order. Assigned at spawn, never reused. */
  ordinal: number
  /** The display identity used by reports and events: `A:trooper#1`. */
  id: string
  player: PlayerId
  contentId: string
  hp: number
  /** The entity's coordinate and centre of authority — engine.md 3.5. */
  anchor: Coord
  /**
   * Presentation-only, and the single deliberate exception to "state carries nothing only
   * presentation reads" (engine.md 1, Q9). Derived from the last step, or from the current target
   * when stationary. No rule reads it.
   */
  facing: Direction
  /** Integer movement credit — engine.md 4.2. Capped at one step's cost. */
  moveCredit: number
  /** Ticks remaining before this entity may attack again. */
  cooldown: number
  /** Ordinal of the entity this one selected in the perception phase, if any. */
  targetOrdinal: number | null
}>

export type GroundItem = Readonly<{
  at: Coord
  amount: number
  sourceId: string
  sourceContentId: string
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
  /** Replay metadata that cannot change inside a ruleset version — engine.md 4.4. */
  ticksPerSecond: number
  grid: GridTerrain
  /** Ordered by `ordinal`. Dead entities are removed; the event stream carries their story. */
  entities: readonly EntityState[]
  groundItems: readonly GroundItem[]
  outcome: Outcome | null
  rng: RngState
  nextOrdinal: number
}>

export const SCHEMA_VERSION = 1

export function entityByOrdinal(state: MatchState, ordinal: number): EntityState | null {
  for (const entity of state.entities) {
    if (entity.ordinal === ordinal) return entity
  }
  return null
}

/**
 * The kernel keeps `entities` sorted by ordinal, so a plain structural hash is stable. This is the
 * only ordering the rules ever rely on.
 */
export function assertOrdered(state: MatchState): void {
  for (let index = 1; index < state.entities.length; index += 1) {
    const previous = state.entities[index - 1]
    const current = state.entities[index]
    if (previous === undefined || current === undefined) continue
    if (previous.ordinal >= current.ordinal) {
      throw new Error(`entities are not ordered by ordinal at index ${index}`)
    }
  }
}
