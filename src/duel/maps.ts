// The maps a duel is played on: two Grid Nexuses, one a side, and the ground between them. Written as rows of text so
// a person, a test and a language model all read the same picture: `.` open ground, `#` rock, `*` a deposit.
//
// A duel map says where each side's Nexus stands (the side's own faction Nexus is set down there: a Citizen's or a
// Ravel's, `src/duel/sides.ts`) and where each side's troops stand when they hold rather than attack. Symmetric by
// design, west against east, so neither side's ground is the better one.

import type { Coord, GridTerrain, TerrainId } from "../grid/types.ts"
import type { TargetArea } from "../state/types.ts"
import type { Side } from "./types.ts"
import crossing from "../../maps/crossing.map.json" with { type: "json" }
import pocket from "../../maps/pocket.map.json" with { type: "json" }

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

/** A map file (`maps/<id>.map.json`): the picture and, by slot (`p1` west is side A, `p2` east is side B), where each
 *  Nexus stands and where its troops hold. The same shape a Skirmish save draws a map in. */
type MapFile = Readonly<{
  id: string
  name: string
  notes: string
  rows: readonly string[]
  nexus: Readonly<Record<"p1" | "p2", Coord>>
  hold: Readonly<Record<"p1" | "p2", TargetArea>>
}>

/** A map file as the duel reads it, by side. */
const fromFile = (file: MapFile): DuelMap => ({
  id: file.id,
  name: file.name,
  notes: file.notes,
  rows: file.rows,
  nexus: { A: file.nexus.p1, B: file.nexus.p2 },
  hold: { A: file.hold.p1, B: file.hold.p2 },
})

/**
 * The maps that ship, in `maps/`: **the Crossing**, 72 by 28, a Nexus at each end of the middle row and a ridge down
 * the centre with one gap eight rows wide, pillars on either side to hold beside, every Nexus twenty columns from the
 * gap; and **the Pocket**, 22 by 12, the two Nexuses ten columns apart, so their build ranges meet in the middle from
 * the first round: a quick battle, and where a test puts two sides that both reach the same ground.
 */
export const DUEL_MAPS: Readonly<Record<string, DuelMap>> = { crossing: fromFile(crossing), pocket: fromFile(pocket) }
