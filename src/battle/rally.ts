// **A battle's rally points** (the owner, 2026-11-26, F324): where each side's troops head for a Battle Round, read
// from its plan (`BuildActions.rally`) on the battlefield as the round opens. A tile, the side's own Nexus or the
// enemy's; absent or off the battlefield, the default in front of the side's base, the same tile the Skirmish screen starts the
// rally point on, so the `skirmish` command and the screen play one default. The area, the refusal and the route are
// the rules layer's (`src/match/rally.ts`); this is where a battle's plan meets them.

import { defaultValue } from "../build/all-settings.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { Coord, MapTerrain } from "../engine/geometry/types.ts"
import { TERRAIN } from "../engine/geometry/types.ts"
import type { MatchState, TargetArea } from "../engine/state/types.ts"
import { isRallyPlace, rallyArea, rallyGroundOf, rallyRefusal, rallyWords, ringedArea } from "../match/rally.ts"
import type { RallyRefusal, RallySpot, RallyStructure } from "../match/rally.ts"
import { BATTLE_MAPS, battleTerrain } from "./maps.ts"
import type { BattleMap } from "./maps.ts"
import { armyOf } from "./sides.ts"
import type { BattleState, BuildActions, Side } from "./types.ts"

const mapIn = (battle: Pick<BattleState, "setup">): BattleMap => (typeof battle.setup.map === "string" ? (BATTLE_MAPS[battle.setup.map] as BattleMap) : battle.setup.map)

const otherSide = (side: Side): Side => (side === "A" ? "B" : "A")

/** A side's Nexus as the map places it: its anchor and its army's Nexus footprint. */
export function nexusOf(battle: Pick<BattleState, "setup" | "sides">, content: Readonly<Record<Side, ContentRegistry>>, side: Side): RallyStructure {
  return { anchor: mapIn(battle).nexus[side], footprint: content[side].get(armyOf(battle, side).nexus).footprint }
}

const middleOf = (structure: RallyStructure): Coord => {
  const xs = structure.footprint.map((tile: Coord) => tile.x)
  const ys = structure.footprint.map((tile: Coord) => tile.y)
  return { x: structure.anchor.x + (Math.min(...xs) + Math.max(...xs)) / 2, y: structure.anchor.y + (Math.min(...ys) + Math.max(...ys)) / 2 }
}

/**
 * **The default rally point** (the owner, 2026-11-25: "in front of your base ... so I can form an army"): `share`
 * percent of the way from the middle of the side's Nexus to the middle of the enemy's, on the nearest tile troops can
 * stand on (ring by ring outward; on a ring, the first in reading order). `null` at 100 or more: the enemy Nexus. The
 * share is the Rally point start Experiment's (`rallyStart`); the battle plays its default.
 */
export function defaultRallyTile(
  battle: Pick<BattleState, "setup" | "sides">,
  content: Readonly<Record<Side, ContentRegistry>>,
  side: Side,
  share: number = defaultValue("rallyStart"),
): Coord | null {
  if (share >= 100) return null
  const terrain = battleTerrain(mapIn(battle))
  const from = middleOf(nexusOf(battle, content, side))
  const to = middleOf(nexusOf(battle, content, otherSide(side)))
  const goal = { x: Math.round(from.x + ((to.x - from.x) * share) / 100), y: Math.round(from.y + ((to.y - from.y) * share) / 100) }
  return nearestOpen(terrain, goal)
}

/** The tile nearest `goal` troops can stand on — not rock, on the battlefield — ring by ring outward, on a ring the first
 *  in reading order; `null` on a battlefield of rock. */
function nearestOpen(terrain: MapTerrain, goal: Coord): Coord | null {
  const open = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= terrain.width || y >= terrain.height) return false
    const ground = terrain.tiles[y * terrain.width + x]
    return ground === undefined || !TERRAIN[ground].impassable
  }
  for (let ring = 0; ring < Math.max(terrain.width, terrain.height); ring += 1) {
    for (let y = goal.y - ring; y <= goal.y + ring; y += 1) {
      for (let x = goal.x - ring; x <= goal.x + ring; x += 1) {
        if (Math.max(Math.abs(x - goal.x), Math.abs(y - goal.y)) === ring && open(x, y)) return { x, y }
      }
    }
  }
  return null
}

/** A side's rally point as the round reads it: the spot played, its area, and — when the plan's own spot was refused —
 *  why, in the words its report says. */
export type RallyRead = Readonly<{ spot: RallySpot; area: TargetArea; refusal?: string }>

const REFUSALS: Readonly<Record<RallyRefusal, string>> = {
  off: "off the battlefield",
  rock: "rock, where no troops can stand",
  crowded: "no ground to stand on there",
  unreachable: "no way there from its Nexus",
}

/**
 * **Where a side's troops head this round**, on the battlefield as it opens (a rally point on a building just placed
 * takes its footprint): the plan's spot — a tile's area (`rallyArea`), or a Nexus's footprint and a ring of one; a rock
 * tile's nearest open ground — or, with none, or one off the battlefield, the default (`defaultRallyTile`), or the
 * enemy's Nexus when the default is it. Nothing else is refused: a spot crowded with buildings, or one rock closes
 * off, is still marched toward (the battle engine walks its troops to the nearest tiles they can reach, and breaches).
 */
export function rallyOf(
  battle: Pick<BattleState, "setup" | "sides">,
  opened: MatchState,
  side: Side,
  plan: Pick<BuildActions, "rally">,
  content: Readonly<Record<Side, ContentRegistry>>,
): RallyRead {
  const home = nexusOf(battle, content, side)
  const ground = rallyGroundOf(opened, (player) => content[player])
  const placeArea = (spot: RallySpot & string): TargetArea => ringedArea(opened.terrain, spot === "HOME_NEXUS" ? home : nexusOf(battle, content, otherSide(side)))
  const fallback = (): RallyRead => {
    const tile = defaultRallyTile(battle, content, side)
    return tile === null ? { spot: "ENEMY_NEXUS", area: placeArea("ENEMY_NEXUS") } : { spot: tile, area: rallyArea(ground, tile) }
  }
  const spot = plan.rally
  if (spot === undefined) return fallback()
  if (isRallyPlace(spot)) return { spot, area: placeArea(spot) }
  // F338 (the owner, 2026-11-26: "if the UX shows that I can place the banner, then the units should march towards the
  // new location"): a spot on the battlefield is always marched to. Off it is the only refusal; on rock with nothing
  // built there the troops head for the nearest open ground; a spot with no ground to stand on in its area, or with no
  // way there, is still their target: they walk as near as they can, fighting what is in the way.
  const refusal = rallyRefusal(ground, spot)
  if (refusal === "off") return { ...fallback(), refusal: `rally point at ${rallyWords(spot)}: ${REFUSALS.off} (${opened.terrain.width} by ${opened.terrain.height}), so the troops went to the default` }
  if (refusal === "rock") {
    const open = nearestOpen(opened.terrain, spot)
    if (open === null) return { ...fallback(), refusal: `rally point at ${rallyWords(spot)}: ${REFUSALS.rock}, so the troops went to the default` }
    return { spot: open, area: rallyArea(ground, open), refusal: `rally point at ${rallyWords(spot)}: ${REFUSALS.rock}, so the troops went to the nearest open ground, ${rallyWords(open)}` }
  }
  return { spot: { x: spot.x, y: spot.y }, area: rallyArea(ground, spot) }
}
