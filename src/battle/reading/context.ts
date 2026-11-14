// What every reading of a Battle Round shares (`./index.ts`): who each entity is as the round goes on (units a building
// trains appear mid-round), what each costs, and where a tile lies between the two Nexuses. Kept up to date once a tick,
// before the readings see the tick.

import type { ContentDef, ContentRegistry } from "../../content/index.ts"
import { baseContentId } from "../../content/index.ts"
import type { ConstructItem } from "../../build/types.ts"
import type { DomainEvent } from "../../events/types.ts"
import type { Coord } from "../../grid/types.ts"
import type { MatchState } from "../../state/types.ts"
import type { Side } from "../types.ts"

/** A count of things by content id, how many in all, and what they cost in credits. */
export type Composition = Readonly<{ counts: Readonly<Record<string, number>>; count: number; value: number }>

/** The round's shared facts, as a reading sees them. */
export type RoundContext = Readonly<{
  sides: Readonly<Record<Side, ContentRegistry>>
  /** Whose an entity is and what, by id: known from the opening, and from each unit as it is trained. */
  owner: (id: string) => Side | undefined
  content: (id: string) => string | undefined
  definition: (id: string) => ContentDef | undefined
  /** A building on the Grid, or a unit? (A unit is anything not standing as a building: ground and air alike.) */
  isUnit: (id: string) => boolean
  /** What one of `contentId` costs `side` in credits: a building its card's cost; a unit what its building pays for one
   *  (the card's cost over the units it makes a round); 0 for what no card buys (a Nexus, a Commander). */
  value: (side: Side, contentId: string) => number
  /** Each side's Nexus tile, when it stands at the opening. */
  nexus: Readonly<Partial<Record<Side, Coord>>>
  /** How far a tile lies from `side`'s Nexus toward the enemy's, in whole percent (0 at its own, 100 at theirs). */
  toward: (side: Side, at: Coord) => number | null
  /** A composition of `ids`' things for `side`. */
  composition: (side: Side, contentIds: readonly string[]) => Composition
}>

/** The context a round is read in, and the step that keeps it current: call `step` with each tick before the readings. */
export function roundContext(
  start: MatchState,
  sides: Readonly<Record<Side, ContentRegistry>>,
  catalogs: Readonly<Record<Side, readonly ConstructItem[]>>,
): Readonly<{ context: RoundContext; step: (events: readonly DomainEvent[]) => void }> {
  const owners = new Map(start.entities.map((entity) => [entity.id, entity.player as Side] as const))
  const contents = new Map(start.entities.map((entity) => [entity.id, entity.contentId] as const))
  const definition = (id: string): ContentDef | undefined => {
    const side = owners.get(id)
    const contentId = contents.get(id)
    return side === undefined || contentId === undefined ? undefined : sides[side].get(contentId)
  }
  const values: Record<Side, Map<string, number>> = { A: new Map(), B: new Map() }
  for (const side of ["A", "B"] as const) {
    for (const item of catalogs[side]) {
      values[side].set(item.contentId, item.cost)
      if (item.spawns !== undefined) {
        const made = item.spawns.perWave * item.spawns.waves
        if (made > 0 && !values[side].has(item.spawns.unit)) values[side].set(item.spawns.unit, Math.round(item.cost / made))
      }
    }
  }
  const value = (side: Side, contentId: string): number => values[side].get(baseContentId(contentId)) ?? 0
  const nexus: Partial<Record<Side, Coord>> = {}
  for (const entity of start.entities) if (definition(entity.id)?.nexus === true) nexus[entity.player as Side] = entity.anchor
  const toward = (side: Side, at: Coord): number | null => {
    const own = nexus[side]
    const theirs = nexus[side === "A" ? "B" : "A"]
    if (own === undefined || theirs === undefined) return null
    const dx = theirs.x - own.x
    const dy = theirs.y - own.y
    const length = dx * dx + dy * dy
    if (length === 0) return null
    return Math.round(100 * Math.min(1, Math.max(0, ((at.x - own.x) * dx + (at.y - own.y) * dy) / length)))
  }
  const composition = (side: Side, contentIds: readonly string[]): Composition => {
    const counts: Record<string, number> = {}
    let total = 0
    for (const contentId of contentIds) {
      counts[contentId] = (counts[contentId] ?? 0) + 1
      total += value(side, contentId)
    }
    return { counts, count: contentIds.length, value: total }
  }
  return {
    context: {
      sides,
      owner: (id) => owners.get(id),
      content: (id) => contents.get(id),
      definition,
      isUnit: (id) => {
        const layer = definition(id)?.layer
        return layer !== undefined && layer !== "obstacles"
      },
      value,
      nexus,
      toward,
      composition,
    },
    step(events) {
      for (const event of events) {
        if (event.kind !== "entity.spawned") continue
        owners.set(event.entity, event.player as Side)
        contents.set(event.entity, event.contentId)
      }
    },
  }
}
