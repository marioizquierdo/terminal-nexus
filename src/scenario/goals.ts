// Every side that fields a fighting unit has somewhere to go (docs/system-design/testing-ground.md): its own target,
// or an enemy Grid Nexus to head for, as every side of the game has one. A battle where a side has neither is one the
// game never plays — its units fall back on engaging the nearest enemy wherever it is — so a checked-in map is
// refused one (`tests/scenario.test.ts`), and the engine tool warns of a map written by hand without one.

import type { ContentRegistry } from "../content/index.ts"
import type { MatchState, PlayerId, TargetArea } from "../state/types.ts"
import { followsTarget } from "../pulse/target.ts"

/** The sides of `state` that field a unit that follows a target, yet have no target and no enemy Nexus. */
export function sidesWithoutGoal(state: MatchState, registry: ContentRegistry): PlayerId[] {
  const missing: PlayerId[] = []
  for (const side of ["A", "B"] as const) {
    const enemy = side === "A" ? "B" : "A"
    const fights = state.entities.some((entity) => {
      if (entity.player !== side) return false
      const definition = registry.get(entity.contentId)
      return followsTarget(definition) && definition.attack !== undefined
    })
    if (!fights || state.targets?.[side] !== undefined) continue
    const nexus = state.entities.some((entity) => entity.player === enemy && registry.get(entity.contentId).nexus === true)
    if (!nexus) missing.push(side)
  }
  return missing
}

/** The rectangle round every entity `player` starts with: a goal for the other side, where the enemy stands. */
export function areaRound(state: MatchState, registry: ContentRegistry, player: PlayerId): TargetArea | null {
  const tiles = state.entities
    .filter((entity) => entity.player === player)
    .flatMap((entity) => registry.get(entity.contentId).footprint.map((offset) => ({ x: entity.anchor.x + offset.x, y: entity.anchor.y + offset.y })))
  if (tiles.length === 0) return null
  const xs = tiles.map((tile) => tile.x)
  const ys = tiles.map((tile) => tile.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x + 1, height: Math.max(...ys) - y + 1 }
}
