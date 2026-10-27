// Making room for a new building (the owner, 2026-10-26: "Placing a building moves troops — friendly AND enemy ... a
// building placed where units stand pushes them out, using pathfinding, deterministically; on screen the units move
// smoothly to their new positions, and they may push and re-arrange other units around them").
//
// A pure function of the state between rounds and the buildings a plan puts down, worked out by the rules layer
// beside the kernel, never inside it: the opening applies it as the Battle Round starts (`opening.ts`), and the Build
// Phase draws the same walks while the player plans (presentation only; for its own plan, since the enemy's is
// revealed with the round).
//
// The rule, building by building in the order given:
//
// - every unit on the ground (or a worker) whose body the new building covers is **displaced**, whoever's it is; a
//   flyer passes over a building and stays;
// - the displaced go one at a time — those standing nearest the building's middle first, then the northern, then by
//   ordinal — each walking (one column a step across, two a row, the Grid's own distance) to the **nearest place off
//   every building** that no one displaced before it has taken: a search outward from where it stands, over the ground
//   it can walk (never rock, never another building);
// - **a ripple**: a unit already standing on the place it takes is displaced in its turn, after it, and makes room the
//   same way (never back onto a place taken), starting its walk as the one that pushed it arrives; nobody is displaced
//   twice by one building, so the ripple always ends;
// - a unit with nowhere to go stays where it is (the opening then refuses the round, as it refuses a force with no
//   room: a Grid with no free ground at all).
//
// Its walks are steps in ticks of the Build Phase's presentation clock (`ROOM_STEP_TICKS` a step), the same shape as
// the regroup's, so the view plays both the same way.

import type { ContentDef, ContentRegistry } from "../content/index.ts"
import { footprintBox, tilesOf } from "../grid/coords.ts"
import type { Coord } from "../grid/types.ts"
import { TERRAIN } from "../grid/types.ts"
import type { EntityState, MatchState, PlayerId } from "../state/types.ts"
import type { RegroupPath, RegroupStep, StructurePlacement } from "./types.ts"

/** How long a displaced unit takes over each step of its way out, in ticks at 12 a second: four steps a second. */
export const ROOM_STEP_TICKS = 3

export type RoomResult = Readonly<{
  /** The state with every displaced unit where it went; nothing else changes. */
  state: MatchState
  /** One per unit that moved, by ordinal: where it stood, each step (by tick, from the moment the building went down)
   *  and where it ends. */
  paths: readonly RegroupPath[]
}>

/**
 * **Room made for `structures`**, in the order given, on `state` (the state between rounds: units where they stand).
 * Deterministic: the same state and buildings give the same walks on every machine.
 */
export function makeRoom(
  state: MatchState,
  structures: readonly StructurePlacement[],
  registry: ContentRegistry,
  sides?: Readonly<Partial<Record<PlayerId, ContentRegistry>>>,
): RoomResult {
  const contentFor = (player: PlayerId): ContentRegistry => sides?.[player] ?? registry
  const definitionOf = (entity: Pick<EntityState, "player" | "contentId">): ContentDef => contentFor(entity.player).get(entity.contentId)
  const grid = state.grid
  const key = (tile: Coord): number => tile.y * grid.width + tile.x
  const inside = (tile: Coord): boolean => tile.x >= 0 && tile.y >= 0 && tile.x < grid.width && tile.y < grid.height

  const built = new Set<number>()
  for (const entity of state.entities) {
    if (definitionOf(entity).layer === "obstacles") for (const tile of tilesOf(entity.anchor, definitionOf(entity).footprint)) built.add(key(tile))
  }
  const anchors = new Map<number, Coord>(state.entities.map((entity) => [entity.ordinal, entity.anchor]))
  const steps = new Map<number, RegroupStep[]>()
  const froms = new Map<number, Coord>()
  /** Whether an entity is moved by a building: on the ground or a worker, never a flyer, never a building. */
  const pushable = (entity: EntityState): boolean => {
    const layer = definitionOf(entity).layer
    return layer !== "obstacles" && layer !== "air"
  }
  const bodies = state.entities.filter(pushable)

  for (const structure of structures) {
    const player = structure.player ?? "A"
    const footprint = contentFor(player).get(structure.contentId).footprint
    const own = tilesOf(structure.anchor, footprint)
    for (const tile of own) built.add(key(tile))
    const box = footprintBox(structure.anchor, footprint)
    const middle = { x: box.left + box.right, y: box.top + box.bottom }
    const covers = (entity: EntityState, anchor: Coord, tiles: ReadonlySet<number>): boolean =>
      tilesOf(anchor, definitionOf(entity).footprint).some((tile) => tiles.has(key(tile)))
    const ownKeys = new Set(own.map(key))

    // Nearest the building's middle first (in half tiles, a row counting two columns), then the northern, then by ordinal.
    const nearMiddle = (entity: EntityState): number => {
      const at = anchors.get(entity.ordinal) as Coord
      const body = footprintBox(at, definitionOf(entity).footprint)
      return Math.abs(body.left + body.right - middle.x) + 2 * Math.abs(body.top + body.bottom - middle.y)
    }
    const queue = bodies
      .filter((entity) => covers(entity, anchors.get(entity.ordinal) as Coord, ownKeys))
      .sort((a, b) => nearMiddle(a) - nearMiddle(b) || (anchors.get(a.ordinal) as Coord).y - (anchors.get(b.ordinal) as Coord).y || a.ordinal - b.ordinal)
      .map((entity) => ({ entity, start: 0 }))
    const queued = new Set(queue.map((each) => each.entity.ordinal))
    const taken = new Set<number>()
    for (let index = 0; index < queue.length; index += 1) {
      const { entity, start } = queue[index] as (typeof queue)[number]
      const definition = definitionOf(entity)
      const from = anchors.get(entity.ordinal) as Coord
      // The tiles of the building it stands under: the way out may cross them, and no other building.
      const under = new Set(tilesOf(from, definition.footprint).map(key))
      const onItself = (tile: Coord): boolean => under.has(key(tile)) || ownKeys.has(key(tile))
      const way = wayOut(from, entity.player === "A" ? 1 : -1, (anchor) => {
        const tiles = tilesOf(anchor, definition.footprint)
        if (!tiles.every((tile) => inside(tile) && !TERRAIN[grid.tiles[key(tile)] as keyof typeof TERRAIN].impassable)) return "wall"
        if (tiles.some((tile) => taken.has(key(tile)))) return "wall"
        // A building it stands under it may walk out across; any other is a wall.
        if (tiles.some((tile) => built.has(key(tile)))) return tiles.some((tile) => built.has(key(tile)) && !onItself(tile)) ? "wall" : "through"
        return "room"
      })
      if (way === null) continue
      const to = way[way.length - 1] as Coord
      for (const tile of tilesOf(to, definition.footprint)) taken.add(key(tile))
      anchors.set(entity.ordinal, to)
      if (!froms.has(entity.ordinal)) froms.set(entity.ordinal, from)
      const walked = steps.get(entity.ordinal) ?? []
      way.slice(1).forEach((tile, step) => walked.push({ tick: start + (step + 1) * ROOM_STEP_TICKS, to: tile }))
      steps.set(entity.ordinal, walked)
      // The ripple: whoever stands where it ends makes room in turn, from the moment it arrives.
      const arrives = start + (way.length - 1) * ROOM_STEP_TICKS
      const landing = new Set(tilesOf(to, definition.footprint).map(key))
      const pushed = bodies
        .filter((other) => other.ordinal !== entity.ordinal && !queued.has(other.ordinal) && covers(other, anchors.get(other.ordinal) as Coord, landing))
        .sort((a, b) => a.ordinal - b.ordinal)
      for (const other of pushed) {
        queued.add(other.ordinal)
        queue.push({ entity: other, start: Math.max(0, arrives - ROOM_STEP_TICKS) })
      }
    }
  }

  const paths: RegroupPath[] = [...froms.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ordinal, from]) => {
      const entity = state.entities.find((each) => each.ordinal === ordinal) as EntityState
      return { ordinal, player: entity.player, contentId: entity.contentId, from, to: anchors.get(ordinal) as Coord, steps: steps.get(ordinal) ?? [], slot: null }
    })
  return {
    state: paths.length === 0 ? state : { ...state, entities: state.entities.map((entity) => (froms.has(entity.ordinal) ? { ...entity, anchor: anchors.get(entity.ordinal) as Coord } : entity)) },
    paths,
  }
}

/**
 * The way from `from` to the nearest anchor `ground` calls room, as the anchors walked, `from` first — or `null` when
 * there is none. A search outward by the Grid's own distance (a step across one, a step up or down two), over anchors
 * that are room or that it may pass `through`; ties go forward first (toward `forward`'s side: +1 east), then back, then
 * north, then south, so a mirrored map gives mirrored ways.
 */
function wayOut(from: Coord, forward: 1 | -1, ground: (anchor: Coord) => "room" | "through" | "wall"): Coord[] | null {
  const name = (tile: Coord): string => `${tile.x},${tile.y}`
  const order: readonly Coord[] = [
    { x: forward, y: 0 },
    { x: -forward, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ]
  const cost = new Map<string, number>([[name(from), 0]])
  const before = new Map<string, Coord | null>([[name(from), null]])
  const buckets: Coord[][] = [[from]]
  const settled = new Set<string>()
  for (let distance = 0; distance < buckets.length; distance += 1) {
    const bucket = buckets[distance] ?? []
    for (let index = 0; index < bucket.length; index += 1) {
      const here = bucket[index] as Coord
      if (settled.has(name(here)) || cost.get(name(here)) !== distance) continue
      settled.add(name(here))
      if (distance > 0 && ground(here) === "room") {
        const way: Coord[] = []
        for (let at: Coord | null = here; at !== null; at = before.get(name(at)) ?? null) way.push(at)
        return way.reverse()
      }
      if (distance > 0 && ground(here) === "wall") continue
      for (const step of order) {
        const next = { x: here.x + step.x, y: here.y + step.y }
        if (settled.has(name(next))) continue
        if (ground(next) === "wall") continue
        const at = distance + (step.y === 0 ? 1 : 2)
        if (at >= (cost.get(name(next)) ?? Number.POSITIVE_INFINITY)) continue
        cost.set(name(next), at)
        before.set(name(next), here)
        while (buckets.length <= at) buckets.push([])
        ;(buckets[at] as Coord[]).push(next)
      }
    }
  }
  return null
}
