// Ordered semantic events — engine.md 7.
//
// Events carry **meaning, not appearance**, and they carry enough context that a renderer or a
// report never has to read mutable state to explain what it is drawing: the score behind a target
// choice, the claim that was contested, the health either side of a hit. Nothing here names a
// glyph, a colour, or a frame.

import type { Coord, Direction } from "../grid/types.ts"
import type { AttackKind } from "../content/types.ts"
import type { PlayerId, VictoryReason } from "../state/types.ts"

export type BlockReason = "edge" | "terrain" | "entity" | "settling"

export type ContestResolution = "speed-tier" | "random"

type Base = Readonly<{ tick: number }>

export type DomainEvent =
  | (Base &
      Readonly<{
        kind: "entity.spawned"
        entity: string
        ordinal: number
        player: PlayerId
        contentId: string
        at: Coord
        hp: number
      }>)
  | (Base &
      Readonly<{
        kind: "target.selected"
        entity: string
        ordinal: number
        target: string
        targetOrdinal: number
        distance: number
        /** The whole scoring function is "nearest enemy", so the score is the distance. */
        score: number
      }>)
  | (Base &
      Readonly<{
        kind: "target.lost"
        entity: string
        ordinal: number
        target: string
        targetOrdinal: number
      }>)
  | (Base &
      Readonly<{
        kind: "behavior.flee"
        entity: string
        ordinal: number
        threat: string
        threatOrdinal: number
        distance: number
      }>)
  | (Base &
      Readonly<{
        kind: "move.intended"
        entity: string
        ordinal: number
        from: Coord
        to: Coord
        direction: Direction
        /** Movement credit at the moment of the decision, and the cost of one step. */
        credit: number
        cost: number
      }>)
  | (Base &
      Readonly<{
        kind: "move.contested"
        tile: Coord
        winner: string
        winnerOrdinal: number
        losers: readonly string[]
        loserOrdinals: readonly number[]
        resolvedBy: ContestResolution
      }>)
  | (Base &
      Readonly<{
        kind: "move.blocked"
        entity: string
        ordinal: number
        desired: Coord
        reason: BlockReason
        /** The blocking entity's display id, when the reason is `entity`. */
        blocker: string | null
        /**
         * Credit is reported on the events that carry a movement decision, so that the log can show
         * credit state at DEBUG without the report ever reaching into the kernel.
         */
        credit: number
        cost: number
      }>)
  | (Base &
      Readonly<{
        kind: "entity.moved"
        entity: string
        ordinal: number
        from: Coord
        to: Coord
        facing: Direction
      }>)
  | (Base &
      Readonly<{
        kind: "attack.launched"
        attacker: string
        attackerOrdinal: number
        target: string
        targetOrdinal: number
        attackKind: AttackKind
        damage: number
        distance: number
        /**
         * Presentation metadata, part of the event and its hash, read by **no rule**
         * (engine.md 4.3). Damage is authoritative at this tick whatever the window says.
         */
        flightWindowTicks: number
      }>)
  | (Base &
      Readonly<{
        kind: "damage.applied"
        entity: string
        ordinal: number
        source: string
        sourceOrdinal: number
        amount: number
        hpBefore: number
        hpAfter: number
      }>)
  | (Base &
      Readonly<{
        kind: "entity.died"
        entity: string
        ordinal: number
        player: PlayerId
        contentId: string
        at: Coord
        killer: string | null
      }>)
  | (Base &
      Readonly<{
        kind: "structure.destroyed"
        entity: string
        ordinal: number
        player: PlayerId
        contentId: string
        at: Coord
        killer: string | null
      }>)
  | (Base &
      Readonly<{
        kind: "entity.detonated"
        entity: string
        ordinal: number
        player: PlayerId
        contentId: string
        at: Coord
        radius: number
        damage: number
        /** Everything inside the radius, friend and foe alike, in ordinal order. */
        caught: readonly string[]
      }>)
  | (Base &
      Readonly<{
        kind: "salvage.dropped"
        at: Coord
        amount: number
        source: string
        sourceContentId: string
      }>)
  | (Base &
      Readonly<{
        kind: "arbitration.bounded"
        passes: number
        unresolved: readonly string[]
      }>)
  | (Base &
      Readonly<{
        kind: "pulse.ended"
        winner: PlayerId | null
        reason: VictoryReason
      }>)

export type DomainEventKind = DomainEvent["kind"]

export const DOMAIN_EVENT_KINDS: readonly DomainEventKind[] = [
  "entity.spawned",
  "target.selected",
  "target.lost",
  "behavior.flee",
  "move.intended",
  "move.contested",
  "move.blocked",
  "entity.moved",
  "attack.launched",
  "damage.applied",
  "entity.died",
  "structure.destroyed",
  "entity.detonated",
  "salvage.dropped",
  "arbitration.bounded",
  "pulse.ended",
]
