// Ordered semantic events (pulse.md).
//
// Events carry **meaning, not appearance**, and they carry enough context that a renderer or a
// report never has to read mutable state to explain what it is drawing: the score behind a target
// choice, the claim that was contested, the health either side of a hit. Nothing here names a
// glyph, a colour, or a frame.

import type { Coord, Direction } from "../grid/types.ts"
import type { AttackKind } from "../content/types.ts"
import type { PlayerId, VictoryReason } from "../state/types.ts"

/** Why a unit could not take the step it wanted: the Grid's edge, rock, another entity, a tile still settling after a
 *  death, or no route at all — it stands as near its goal as it can get (`intents.ts`). */
export type BlockReason = "edge" | "terrain" | "entity" | "settling" | "no-route"

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
        /** The building that trained it, when a production recipe did (`ContentDef.production`). */
        trainedBy?: string
      }>)
  | (Base &
      Readonly<{
        kind: "target.selected"
        entity: string
        ordinal: number
        target: string
        targetOrdinal: number
        /** Nearest tile to nearest tile, a row counting two columns (`footprintDistance`, src/grid/coords.ts). */
        distance: number
        /** The whole scoring function is "nearest enemy", so the score is the distance. */
        score: number
        /**
         * For a unit that aims at a crowd (`ContentDef.aim`): how many of the target's own side stood within the unit's
         * area round it, the target included — what it was chosen by. Absent for every other unit, so their events are
         * byte for byte what they were.
         */
        crowd?: number
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
        /** Nearest tile to nearest tile, a row counting two columns (`footprintDistance`, src/grid/coords.ts). */
        distance: number
      }>)
  | (Base &
      Readonly<{
        /**
         * A marcher that was yielding to its army made way for an ally held up behind it (`march.ts`, `intents.ts`):
         * it swaps tiles with the ally (`"swap"`), or, the ally too big to swap with, takes its own step forward out of
         * the way (`"release"`). Said only when it makes way, never for the ticks it waits.
         */
        kind: "march.made-way"
        entity: string
        ordinal: number
        /** The ally it made way for. */
        ally: string
        allyOrdinal: number
        how: "swap" | "release"
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
        /** A unit moved by something other than its own walk — a push, a pull — from one tile to another. It walks on
         *  from where it lands (pulse.md, "A unit that did not walk"). */
        kind: "entity.displaced"
        entity: string
        ordinal: number
        from: Coord
        to: Coord
        /** What moved it. */
        by: string
        byOrdinal: number
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
        /** Nearest tile to nearest tile, a row counting two columns (`footprintDistance`, src/grid/coords.ts). */
        distance: number
        /**
         * Presentation metadata, part of the event and its hash, read by **no rule**
         * (pulse.md). Damage is authoritative at this tick whatever the window says.
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
        /**
         * The bearer of the aura that guarded this hit (an `aura` ability, `src/abilities/aura.ts`: Vasse's By the Book), when one
         * did — the hit then dealt the aura's share of what it would have. Absent for an unguarded hit, so
         * every event of a battle with no aura in it is byte for byte what it was. For presentation; no
         * rule reads it.
         */
        guardedBy?: string
        guardedByOrdinal?: number
      }>)
  | (Base &
      Readonly<{
        kind: "heal.applied"
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
        /** An ability did something on its own (`src/abilities/`): a lucky hit, a bounty earned. */
        kind: "ability.triggered"
        entity: string
        ordinal: number
        player: PlayerId
        /** The ability's kind (`"bounty"`), and the name its card gives it (`"Bounty"`). */
        ability: string
        name?: string
        /** What it touched, when it touched one: the unit hit, the enemy whose fall paid. */
        target?: string
        targetOrdinal?: number
        /** A number it changed: what a lucky hit dealt. */
        amount?: number
        /** Credits its side earned, to spend from its next Build Phase (`src/match/earnings.ts`). */
        credits?: number
      }>)
  | (Base &
      Readonly<{
        /** A landing hit set the ground burning (`AttackDef.burn`, `BurningGround`): round `centre`, measured as range
         *  is, every unit and worker of either side takes `damage` each `everyTicks` ticks until `untilTick`. */
        kind: "ground.lit"
        centre: Coord
        radius: number
        damage: number
        everyTicks: number
        untilTick: number
        player: PlayerId
        /** The shooter that lit it, and what it hit. */
        source: string
        sourceOrdinal: number
        target: string
        targetOrdinal: number
      }>)
  | (Base &
      Readonly<{
        /** Burning ground burnt, on one of its ticks: who stood on it, in ordinal order, each taking `damage` (the
         *  `damage.applied` events that follow say what each took, a guard counted). */
        kind: "ground.burned"
        centre: Coord
        radius: number
        damage: number
        player: PlayerId
        source: string
        sourceOrdinal: number
        caught: readonly string[]
      }>)
  | (Base &
      Readonly<{
        /** Burning ground went out: its time was up. What still burns as a Pulse ends is put out by Recall between
         *  rounds, with no event. */
        kind: "ground.out"
        centre: Coord
        radius: number
        player: PlayerId
        source: string
        sourceOrdinal: number
        startedTick: number
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
  "march.made-way",
  "move.intended",
  "move.contested",
  "move.blocked",
  "entity.moved",
  "entity.displaced",
  "attack.launched",
  "damage.applied",
  "heal.applied",
  "entity.died",
  "structure.destroyed",
  "entity.detonated",
  "ability.triggered",
  "ground.lit",
  "ground.burned",
  "ground.out",
  "salvage.dropped",
  "arbitration.bounded",
  "pulse.ended",
]
