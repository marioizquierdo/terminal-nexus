// EXPERIMENT ONLY — two alternatives to Recall (`recall.ts`) the owner is weighing, played by a duel that asks for one
// (`DuelSetup.recall`); nothing else calls them and the default is still `recall`.
//
// - **stay** (`stayPut`): every survivor stays exactly where the Battle Round left it. Everything else Recall does still
//   happens: transient fields back to a fresh entity's (`freshEntityFields`), a structure that mends regains that much,
//   the clock, outcome, cooling tiles and fire cleared.
// - **fallback** (`fallBack`): every survivor walks back toward the home Recall would send it to, by at most
//   `FALLBACK_DISTANCE` (the Grid's distance: a row counts two columns), never past it. One that reaches its home in that
//   distance is set down exactly where Recall would set it (on its roof, or beside its Nexus); the others on the free
//   ground nearest the point along the way, under the same collision rule Recall uses (no two bodies share a tile, on
//   any layer). Each keeps roughly its place in the line, since each moves along its own way home.

import type { ContentDef, ContentRegistry } from "../content/index.ts"
import { freshEntityFields } from "../content/index.ts"
import { gridDistance } from "../grid/coords.ts"
import { OccupancyIndex, maskFrom } from "../grid/occupancy.ts"
import type { Coord } from "../grid/types.ts"
import { ENTITY_LAYERS } from "../grid/types.ts"
import type { EntityState, MatchState, PlayerId } from "../state/types.ts"
import { centreTile, enemyNexusMiddle, nearestFit } from "./placement.ts"
import { recall } from "./recall.ts"
import type { RecallMove, RecallResult } from "./types.ts"

/** How far a survivor falls back, by the Grid's distance (a row counts two columns). */
export const FALLBACK_DISTANCE = 12

/** The recall rules a duel may play by: `home`, today's. */
export const RECALL_RULES = ["home", "fallback", "stay"] as const
export type RecallRule = (typeof RECALL_RULES)[number]

function definitionsOf(state: MatchState, registry: ContentRegistry, sides?: Readonly<Partial<Record<PlayerId, ContentRegistry>>>): (entity: EntityState) => ContentDef {
  const definitions = new Map<number, ContentDef>()
  for (const entity of state.entities) definitions.set(entity.ordinal, (sides?.[entity.player] ?? registry).get(entity.contentId))
  return (entity) => definitions.get(entity.ordinal) as ContentDef
}

/** The state after the rule's between-rounds bookkeeping, survivors at `anchors` (or where they stand). */
function settled(state: MatchState, definitionOf: (entity: EntityState) => ContentDef, anchors: ReadonlyMap<number, Coord>): MatchState {
  const entities: EntityState[] = state.entities.map((entity) => {
    const definition = definitionOf(entity)
    return {
      ...entity,
      anchor: anchors.get(entity.ordinal) ?? entity.anchor,
      ...freshEntityFields(definition),
      hp: definition.mends === undefined ? entity.hp : Math.min(definition.maxHp, entity.hp + definition.mends),
    }
  })
  const { burning: _burning, ...rest } = state
  return { ...rest, tick: 0, outcome: null, vacatedTiles: [], entities }
}

/** **stay**: survivors where they stand. */
export function stayPut(state: MatchState, registry: ContentRegistry, sides?: Readonly<Partial<Record<PlayerId, ContentRegistry>>>): RecallResult {
  const definitionOf = definitionsOf(state, registry, sides)
  const moves: RecallMove[] = state.entities
    .filter((entity) => definitionOf(entity).layer !== "obstacles")
    .map((entity) => ({ ordinal: entity.ordinal, player: entity.player, contentId: entity.contentId, from: entity.anchor, to: entity.anchor, home: "none" as const }))
  return { state: settled(state, definitionOf, new Map()), moves }
}

/** **fallback**: survivors back toward home by `distance`, never past it. */
export function fallBack(state: MatchState, registry: ContentRegistry, sides?: Readonly<Partial<Record<PlayerId, ContentRegistry>>>, distance = FALLBACK_DISTANCE): RecallResult {
  const definitionOf = definitionsOf(state, registry, sides)
  const home = recall(state, registry, sides)
  const homeAt = new Map(home.moves.map((move) => [move.ordinal, move] as const))
  const structures = state.entities.filter((entity) => definitionOf(entity).layer === "obstacles")
  const survivors = state.entities.filter((entity) => definitionOf(entity).layer !== "obstacles")
  const standing = structures.map((entity) => ({ player: entity.player, anchor: entity.anchor, definition: definitionOf(entity) }))

  const index = new OccupancyIndex(state.grid)
  for (const structure of structures) index.add(definitionOf(structure).layer, structure.ordinal, structure.anchor, definitionOf(structure).footprint)

  const anchors = new Map<number, Coord>()
  // Who reaches home in the distance: set down where Recall would, first (Recall's own places never overlap each other).
  const along = new Map<number, Coord>()
  for (const survivor of survivors) {
    const move = homeAt.get(survivor.ordinal) as RecallMove
    const way = gridDistance(move.from, move.to)
    if (way <= distance) {
      anchors.set(survivor.ordinal, move.to)
      index.add(definitionOf(survivor).layer, survivor.ordinal, move.to, definitionOf(survivor).footprint)
    } else {
      const t = distance / way
      along.set(survivor.ordinal, { x: Math.round(move.from.x + (move.to.x - move.from.x) * t), y: Math.round(move.from.y + (move.to.y - move.from.y) * t) })
    }
  }
  // The rest: nearest their point along the way first (the ones furthest back first, then by ordinal), each on the free
  // ground nearest it.
  const rest = survivors.filter((survivor) => along.has(survivor.ordinal))
  const homeDistance = (survivor: EntityState): number => gridDistance(along.get(survivor.ordinal) as Coord, (homeAt.get(survivor.ordinal) as RecallMove).to)
  rest.sort((a, b) => homeDistance(a) - homeDistance(b) || a.ordinal - b.ordinal)
  for (const survivor of rest) {
    const definition = definitionOf(survivor)
    const target = along.get(survivor.ordinal) as Coord
    const mask = maskFrom(index, { layers: ENTITY_LAYERS, terrain: definition.layer === "air" ? "ignore" : "impassable" })
    const here = centreTile(target, definition.footprint)
    const toward = enemyNexusMiddle(standing, survivor.player, here)
    const to = nearestFit(mask, definition.footprint, here, 80, here, toward)
    if (to === null) throw new Error(`fallBack: no free tile for ${survivor.id}`)
    index.add(definition.layer, survivor.ordinal, to, definition.footprint)
    anchors.set(survivor.ordinal, to)
  }
  const moves: RecallMove[] = survivors.map((survivor) => ({
    ordinal: survivor.ordinal,
    player: survivor.player,
    contentId: survivor.contentId,
    from: survivor.anchor,
    to: anchors.get(survivor.ordinal) as Coord,
    home: (homeAt.get(survivor.ordinal) as RecallMove).home,
  }))
  return { state: settled(state, definitionOf, anchors), moves }
}

/** Recall by `rule`. */
export function recallBy(rule: RecallRule, state: MatchState, registry: ContentRegistry, sides?: Readonly<Partial<Record<PlayerId, ContentRegistry>>>): RecallResult {
  if (rule === "stay") return stayPut(state, registry, sides)
  if (rule === "fallback") return fallBack(state, registry, sides)
  return recall(state, registry, sides)
}
