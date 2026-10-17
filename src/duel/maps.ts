// The maps a duel is played on: two Grid Nexuses, one a side, and the ground between them. Written as rows of text so
// a person, a test and a language model all read the same picture: `.` open ground, `#` rock, `*` a deposit.
//
// A duel map says where each side's Nexus stands (the side's own faction Nexus is set down there: a Citizen's or a
// Ravel's, `src/duel/sides.ts`) and where each side's troops stand when they hold rather than attack. Symmetric by
// design, west against east, so neither side's ground is the better one.

import type { Coord, GridTerrain, TerrainId } from "../grid/types.ts"
import type { TargetArea } from "../state/types.ts"
import type { Side } from "./types.ts"

/** A duel map: its picture, where each Nexus stands (the anchor of its footprint, its north-west tile), and where a
 *  side holding its ground gathers. */
export type DuelMap = Readonly<{
  id: string
  name: string
  notes: string
  rows: readonly string[]
  nexus: Readonly<Record<Side, Coord>>
  hold: Readonly<Record<Side, TargetArea>>
}>

const TERRAIN: Readonly<Record<string, TerrainId>> = { ".": "terrain.plain", "#": "terrain.rock", "*": "terrain.deposit" }

/** The Grid of a duel map's rows. Throws for a row of another width or a character it does not know. */
export function duelGrid(map: DuelMap): GridTerrain {
  const height = map.rows.length
  const width = map.rows[0]?.length ?? 0
  const tiles: TerrainId[] = []
  map.rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`duel map "${map.id}": row ${y} is ${row.length} wide, not ${width}`)
    for (const character of row) {
      const terrain = TERRAIN[character]
      if (terrain === undefined) throw new Error(`duel map "${map.id}": "${character}" in row ${y} is not ground the map knows`)
      tiles.push(terrain)
    }
  })
  return { width, height, tiles }
}

/** Rows of `width` by `height`, open but for the rectangles of rock given. */
function drawn(width: number, height: number, rocks: readonly Readonly<{ x: number; y: number; width: number; height: number }>[]): string[] {
  const rows = Array.from({ length: height }, () => Array.from({ length: width }, () => "."))
  for (const rock of rocks) {
    for (let y = rock.y; y < rock.y + rock.height; y += 1) for (let x = rock.x; x < rock.x + rock.width; x += 1) (rows[y] as string[])[x] = "#"
  }
  return rows.map((row) => row.join(""))
}

/**
 * The Crossing: 72 by 28, a Nexus at each end of the middle row and a ridge down the centre with one wide gap, so the
 * armies meet in the middle or go round. Pillars on either side give a line somewhere to stand. Every Nexus is twenty
 * columns from the gap, a crossing of about twenty seconds at a trooper's pace.
 */
const CROSSING: DuelMap = {
  id: "crossing",
  name: "The Crossing",
  notes: "Two Nexuses at the ends of the middle row, a ridge down the centre with a gap eight rows wide, and pillars to hold beside.",
  rows: drawn(72, 28, [
    { x: 35, y: 0, width: 2, height: 10 },
    { x: 35, y: 18, width: 2, height: 10 },
    { x: 22, y: 6, width: 2, height: 2 },
    { x: 22, y: 20, width: 2, height: 2 },
    { x: 48, y: 6, width: 2, height: 2 },
    { x: 48, y: 20, width: 2, height: 2 },
  ]),
  nexus: { A: { x: 6, y: 13 }, B: { x: 63, y: 13 } },
  hold: { A: { x: 14, y: 11, width: 4, height: 6 }, B: { x: 54, y: 11, width: 4, height: 6 } },
}

/**
 * The Pocket: 22 by 12, the two Nexuses ten columns apart, so their build ranges meet in the middle from the first
 * round. A quick duel, and the place a test puts two sides that both reach the same ground.
 */
const POCKET: DuelMap = {
  id: "pocket",
  name: "The Pocket",
  notes: "A small open field with the two bases close enough that their build ranges meet in the middle from the first round.",
  rows: drawn(22, 12, []),
  nexus: { A: { x: 3, y: 5 }, B: { x: 16, y: 5 } },
  hold: { A: { x: 7, y: 4, width: 2, height: 4 }, B: { x: 13, y: 4, width: 2, height: 4 } },
}

/** Every duel map, by id. */
export const DUEL_MAPS: Readonly<Record<string, DuelMap>> = { crossing: CROSSING, pocket: POCKET }
