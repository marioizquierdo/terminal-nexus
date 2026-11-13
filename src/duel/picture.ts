// A battle drawn as text (docs/system-design/duels.md, "Reading a battle"): the map's ground, every building in its
// art, and every unit by the first letter of its name — p1's (side A's) in lower case, p2's (side B's) in upper case.
// A unit standing on a building's roof is not drawn over the building's art; the roofs' units are counted under the
// picture instead. The brief draws the Grid between rounds with it, and `skirmish --show` draws a Battle Round at the
// ticks asked for.
//
// Presentation of the duel: pure, and read by nothing the rules decide.

import { artFor } from "../content/art.ts"
import type { ContentRegistry } from "../content/index.ts"
import { tilesOf } from "../grid/coords.ts"
import type { Coord } from "../grid/types.ts"
import type { DuelMap } from "./maps.ts"
import type { Side } from "./types.ts"

/** A thing on the Grid as the picture needs it: what it is, whose, where, and (for a unit) its health. */
export type Pictured = Readonly<{ contentId: string; player: Side; anchor: Coord; hp?: number }>

const letter = (contentId: string): string => contentId.slice(contentId.lastIndexOf(".") + 1, contentId.lastIndexOf(".") + 2)

/** **The battle as rows of text**: a header of column tens, then each row numbered; and under it, the units on roofs. */
export function battlePicture(map: DuelMap, things: readonly Pictured[], registry: (side: Side) => ContentRegistry): string[] {
  const width = map.rows[0]?.length ?? 0
  const height = map.rows.length
  const rows = map.rows.map((row) => [...row])
  const roofs = new Map<string, Readonly<{ name: string; at: Coord }>>()
  const onRoof: Record<string, number> = {}
  const put = (tile: Coord, glyph: string, side: Side): void => {
    if (tile.x < 0 || tile.y < 0 || tile.x >= width || tile.y >= height) return
    ;(rows[tile.y] as string[])[tile.x] = side === "B" ? glyph.toUpperCase() : glyph.toLowerCase()
  }
  const isBuilding = (thing: Pictured): boolean => registry(thing.player).get(thing.contentId).layer === "obstacles"
  for (const thing of things.filter(isBuilding)) {
    const art = artFor(thing.contentId)
    for (const tile of tilesOf(thing.anchor, registry(thing.player).get(thing.contentId).footprint)) {
      put(tile, art?.[tile.y - thing.anchor.y]?.[tile.x - thing.anchor.x] ?? letter(thing.contentId), thing.player)
      roofs.set(`${tile.x},${tile.y}`, { name: thing.contentId.slice(thing.contentId.lastIndexOf(".") + 1), at: thing.anchor })
    }
  }
  for (const thing of things.filter((thing) => !isBuilding(thing))) {
    const roof = roofs.get(`${thing.anchor.x},${thing.anchor.y}`)
    if (roof === undefined) put(thing.anchor, letter(thing.contentId), thing.player)
    else {
      const key = `${thing.player === "A" ? "p1" : "p2"} ${thing.contentId.slice(thing.contentId.lastIndexOf(".") + 1)} on the ${roof.name} at ${roof.at.x},${roof.at.y}`
      onRoof[key] = (onRoof[key] ?? 0) + 1
    }
  }
  const header = `   ${Array.from({ length: width }, (_, x) => (x % 10 === 0 ? String(x / 10) : " ")).join("")}`
  const lines = [header, ...rows.map((row, y) => `${String(y).padStart(2, " ")} ${row.join("")}`)]
  const roofed = Object.entries(onRoof)
  if (roofed.length > 0) lines.push(`On roofs: ${roofed.map(([what, count]) => `${count} ${what}`).join("; ")}.`)
  return lines
}
