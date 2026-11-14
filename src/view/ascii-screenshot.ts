// PRESENTATION — an ASCII screenshot: the Grid exactly as the game's screen draws it, cell for cell, written out as text
// for a reader that reads text (an agent, a test, a log). Not an image: a screenshot is a picture of the screen
// (PNG, `scripts/playtest.mjs`, the grid-screenshots skill); an ASCII screenshot is the Grid's own cells.
//
// The picture is the screen's and nothing else: the same layers in the same bands (`drawGridLayers`), the same glyphs,
// featureless ground drawn as the screen's sparse lattice, a unit on a roof drawn over its building, effects only when
// asked for. What the picture cannot say is said beside it, never inside it: a ruler of column tens above and row
// numbers to the left, a legend of the glyphs in it, and the overlaps — each cell where one thing stands over another
// (a unit on a building's roof; later a flyer over the ground), and what is under it.
//
// Pure: the same sample gives the same screenshot.

import type { Coord } from "../grid/types.ts"
import type { PlayerId } from "../state/types.ts"
import type { GridLayersInput } from "./compose.ts"
import { drawGridLayers } from "./compose.ts"
import type { BandCell } from "./frame.ts"
import { composeBands, frameToText } from "./frame.ts"
import { entityGlyph } from "./theme.ts"

/** An ASCII screenshot: the Grid's rows as drawn, the ruler and row numbers round them, the legend and the overlaps. */
export type AsciiScreenshot = Readonly<{
  /** The Grid's cells, a row of text a row of tiles, exactly as the screen draws them. */
  grid: readonly string[]
  /** The same rows with a ruler of column tens above and each row's number to the left. */
  framed: readonly string[]
  /** What each glyph in the picture is: `t Trooper (p1)`; a building with its art row by row and where it stands,
   *  `[B] |_| Barracks (p2) at 19,4`. */
  legend: readonly string[]
  /** Each cell where one thing stands over another: `x 12, y 5: p1 trooper over p2 barracks`. */
  overlaps: readonly string[]
  /** Whether the effects were drawn: then a mark the legend does not name is an effect. */
  effects: boolean
}>

/** How the screenshot names a side and a content id, for the legend and the overlaps. */
export type ScreenshotNames = Readonly<{ side: (player: PlayerId) => string; content: (contentId: string) => string }>

const DEFAULT_NAMES: ScreenshotNames = {
  side: (player) => player,
  content: (contentId) => contentId.slice(contentId.lastIndexOf(".") + 1),
}

/** **An ASCII screenshot** of the Grid from what a frame draws: the state, where each entity is drawn, and the effects
 *  and fire when they are to be seen. */
export function asciiScreenshot(input: GridLayersInput, names: ScreenshotNames = DEFAULT_NAMES): AsciiScreenshot {
  const cells: BandCell[] = []
  drawGridLayers(cells, input, (tile) => tile)
  const grid = frameToText(composeBands(input.grid.width, input.grid.height, cells)).split("\n")
  while (grid.length < input.grid.height) grid.push("")
  const rows = grid.map((row) => row.padEnd(input.grid.width, " "))

  const ruler = `   ${Array.from({ length: input.grid.width }, (_, x) => (x % 10 === 0 ? String(x / 10) : " ")).join("")}`
  const framed = [ruler, ...rows.map((row, y) => `${String(y).padStart(2, " ")} ${row}`)]

  const legend = new Map<string, string>()
  const standing = new Map<string, Array<Readonly<{ player: PlayerId; contentId: string; layer: string }>>>()
  for (const entity of input.state.entities) {
    const definition = input.registry.get(entity.contentId)
    const at: Coord = input.positions.get(entity.ordinal) ?? entity.anchor
    // A building's art row by row, and where it stands: a symbol has no case, so two sides' buildings can look alike.
    const rowsOf = new Map<number, string>()
    for (const offset of definition.footprint) rowsOf.set(offset.y, (rowsOf.get(offset.y) ?? "") + entityGlyph(entity.contentId, entity.player, offset))
    const glyph = [...rowsOf.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row).join(" ")
    const where = definition.layer === "obstacles" ? ` at ${at.x},${at.y}` : ""
    legend.set(`${glyph} ${names.content(entity.contentId)} (${names.side(entity.player)})${where}`, glyph)
    for (const offset of definition.footprint) {
      const key = `${at.x + offset.x},${at.y + offset.y}`
      standing.set(key, [...(standing.get(key) ?? []), { player: entity.player, contentId: entity.contentId, layer: definition.layer }])
    }
  }
  const order = (layer: string): number => (layer === "air" ? 2 : layer === "obstacles" ? 0 : 1)
  const overlaps: string[] = []
  for (const [key, here] of standing) {
    if (here.length < 2) continue
    const [x, y] = key.split(",")
    const top = [...here].sort((a, b) => order(b.layer) - order(a.layer))
    overlaps.push(`x ${x}, y ${y}: ${top.map((thing) => `${names.side(thing.player)} ${names.content(thing.contentId)}`).join(" over ")}`)
  }
  overlaps.sort((a, b) => {
    const [ax, ay] = (a.match(/\d+/gu) ?? []).map(Number)
    const [bx, by] = (b.match(/\d+/gu) ?? []).map(Number)
    return (ay ?? 0) - (by ?? 0) || (ax ?? 0) - (bx ?? 0)
  })
  return { grid: rows, framed, legend: [...legend.keys()].sort(), overlaps, effects: input.effects !== undefined }
}

/** An ASCII screenshot as lines to print: the framed Grid, then the legend and the overlaps, each under its heading. */
export function asciiScreenshotLines(screenshot: AsciiScreenshot): string[] {
  return [
    ...screenshot.framed,
    `Legend: ${screenshot.legend.join("; ") || "nothing on the Grid"}. Ground: . open (every fourth tile drawn, as on screen), # rock, * ore, % salvage.`,
    `Overlaps (the top one is what is drawn): ${screenshot.overlaps.length === 0 ? "none" : screenshot.overlaps.join("; ")}.`,
    ...(screenshot.effects ? ["Effects are on: any mark the legend does not name (' , | / : and the like) is a shot, a burst or fire's light, not a thing on the Grid."] : []),
  ]
}
