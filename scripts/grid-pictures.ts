#!/usr/bin/env node
// The pictures in the grid design's account of distance, reach and movement (docs/system-design/grid.md), drawn by
// the game's own code: distances, reaches and the rings a group is set down on by `src/grid`, and walks by the
// kernel itself, tick by tick, on open ground. In the document each picture sits in the code block under a
// `<!-- grid-picture: name -->` line, and tests/grid-pictures.test.ts fails when one is not what this draws.
//
//   node scripts/grid-pictures.ts           print every picture
//   node scripts/grid-pictures.ts --write   redraw the pictures in the grid design

import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { ENTITY_LAYERS, OccupancyIndex, gridDistance, maskFrom, rowsWithin, tilesWithin } from "../src/grid/index.ts"
import type { Coord, Footprint, GridTerrain } from "../src/grid/index.ts"
import { nearestFit } from "../src/match/index.ts"
import { contextFor, stepTick } from "../src/pulse/index.ts"
import { TICKS_PER_SECOND, loadScenario } from "../src/scenario/index.ts"
import type { MatchState } from "../src/state/types.ts"

/** The design document the pictures are in, from the repository's root. */
export const GRID_DESIGN = fileURLToPath(new URL("../docs/system-design/grid.md", import.meta.url))

const ONE: Footprint = [{ x: 0, y: 0 }]
const ORIGIN: Coord = { x: 0, y: 0 }
/** The unit every walk is drawn with: the Citizen trooper, the plainest walker. */
const WALKER = "unit.citizen.trooper"

/** A picture's lines, each right-trimmed: what a code block in the document holds. */
const picture = (lines: readonly string[]): string => lines.map((line) => line.trimEnd()).join("\n")

/** Every tile's distance from `T`, four columns either side and two rows up and down. */
function distances(): string {
  const lines: string[] = []
  for (let dy = -2; dy <= 2; dy += 1) {
    let line = ""
    for (let dx = -4; dx <= 4; dx += 1) line += dx === 0 && dy === 0 ? "T" : String(gridDistance(ORIGIN, { x: dx, y: dy }))
    lines.push(line)
  }
  return picture(lines)
}

type Block = Readonly<{ rows: readonly string[]; caption: readonly string[] }>

/** A reach drawn round `T` in the box its tiles fill: a dot on every tile within it. */
function reachBlock(radius: number, caption: (tiles: number) => readonly string[]): Block {
  const tiles = tilesWithin(ORIGIN, ONE, radius)
  const within = new Set(tiles.map((tile) => `${tile.x},${tile.y}`))
  const up = Math.max(...tiles.map((tile) => Math.abs(tile.y)))
  const rows: string[] = []
  for (let dy = -up; dy <= up; dy += 1) {
    let row = ""
    for (let dx = -radius; dx <= radius; dx += 1) row += dx === 0 && dy === 0 ? "T" : within.has(`${dx},${dy}`) ? "." : " "
    rows.push(row)
  }
  return { rows, caption: caption(tiles.length) }
}

/** Blocks side by side, each centred in its own column over its caption, the drawings centred on one row. */
function sideBySide(blocks: readonly Block[], gap = 5): string {
  const tallest = Math.max(...blocks.map((block) => block.rows.length))
  const captionRows = Math.max(...blocks.map((block) => block.caption.length))
  const lines: string[] = Array.from({ length: tallest + 1 + captionRows }, () => "")
  blocks.forEach((block, index) => {
    const width = Math.max(...block.rows.map((row) => row.length), ...block.caption.map((line) => line.length))
    const column = (text: string): string => {
      const left = Math.floor((width - text.length) / 2)
      return " ".repeat(left) + text + " ".repeat(width - text.length - left)
    }
    const above = (tallest - block.rows.length) / 2
    for (let line = 0; line < lines.length; line += 1) {
      const drawn = block.rows[line - above]
      const caption = block.caption[line - tallest - 1]
      const text = drawn !== undefined ? column(drawn) : caption !== undefined ? column(caption) : " ".repeat(width)
      lines[line] += (index === 0 ? "" : " ".repeat(gap)) + text
    }
  })
  return picture(lines)
}

/** A reach of 1, 2, 4 and 6 round `T`, each with how many tiles it covers. */
function reaches(): string {
  return sideBySide([1, 2, 4, 6].map((radius) => reachBlock(radius, (tiles) => [`reach ${radius}`, `${tiles} tiles`])))
}

/** A reach of 4 and one of 5: the same rows, the odd one a column longer on each. */
function wholeRows(): string {
  const rows = (radius: number): string => `${rowsWithin(radius)} rows up and down`
  return sideBySide([4, 5].map((radius) => reachBlock(radius, () => [`reach ${radius}`, rows(radius)])), 8)
}

/** Plain ground, `width` by `height`. */
function plainGround(width: number, height: number): GridTerrain {
  return { width, height, tiles: Array.from({ length: width * height }, () => "terrain.plain" as const) }
}

/** The first thirteen tiles a group set down round one point fills, in order, `a` first: the opening's own search
 *  (`nearestFit`), each unit claiming its tile before the next one looks, on open ground. */
function rings(): string {
  const around: Coord = { x: 7, y: 4 }
  const index = new OccupancyIndex(plainGround(15, 9))
  const mask = maskFrom(index, { layers: ENTITY_LAYERS, terrain: "impassable" })
  const order: Coord[] = []
  for (let unit = 0; unit < 13; unit += 1) {
    const anchor = nearestFit(mask, ONE, around, 24)
    if (anchor === null) throw new Error("no room to set a unit down on open ground")
    index.add("units", unit, anchor, ONE)
    order.push(anchor)
  }
  const left = Math.min(...order.map((tile) => tile.x))
  const top = Math.min(...order.map((tile) => tile.y))
  const lines: string[] = []
  order.forEach((tile, unit) => {
    const y = tile.y - top
    while (lines.length <= y) lines.push("")
    const line = (lines[y] as string).padEnd(tile.x - left + 1, " ")
    lines[y] = line.slice(0, tile.x - left) + "abcdefghijklm"[unit] + line.slice(tile.x - left + 1)
  })
  return picture(lines)
}

/** A walker's steps, alone on open ground, heading for its side's target: each tick it stepped on, and where to. */
type Walk = readonly Readonly<{ tick: number; from: Coord; to: Coord }>[]

/** Open ground, 30 by 20, one walker standing on `from`, and its side's target the one tile `to`. */
function openGround(from: Coord, to: Coord): MatchState {
  const rows = Array.from({ length: from.y + 1 }, (_, y) => (y === from.y ? `${" ".repeat(from.x)}w` : ""))
  return loadScenario(
    {
      id: "grid-pictures",
      name: "a walk on open ground",
      grid: { width: 30, height: 20 },
      seed: 1,
      pulseTicks: 600,
      terrain: Array.from({ length: 20 }, () => ".".repeat(30)),
      terrainLegend: { ".": "terrain.plain" },
      placements: { A: { rows, legend: { w: { content: WALKER } } } },
      targets: { A: { x: to.x, y: to.y, width: 1, height: 1 } },
    },
    { registry: FIXTURE_REGISTRY },
  ).state
}

/** The kernel's own walk from `from` to `to`: the Pulse resolved tick by tick until the walker stands on `to`. */
function walk(from: Coord, to: Coord): Walk {
  let state = openGround(from, to)
  const context = contextFor(state, FIXTURE_REGISTRY, 600)
  const steps: { tick: number; from: Coord; to: Coord }[] = []
  let at = from
  while (state.outcome === null && state.tick < 600 && (at.x !== to.x || at.y !== to.y)) {
    const result = stepTick(state, context)
    for (const event of result.events) {
      if (event.kind !== "entity.moved") continue
      steps.push({ tick: event.tick, from: event.from, to: event.to })
      at = event.to
    }
    state = result.state
  }
  if (at.x !== to.x || at.y !== to.y) throw new Error(`the walk from ${from.x},${from.y} never reached ${to.x},${to.y}`)
  return steps
}

/** The arrow for a step: the way it went. */
function arrow(from: Coord, to: Coord): string {
  if (to.x > from.x) return ">"
  if (to.x < from.x) return "<"
  return to.y > from.y ? "v" : "^"
}

/** A walk drawn on a blank picture: `t` where it starts, each tile it steps onto marked by the way it came, `X` on
 *  the tile it ends on. */
function drawWalk(lines: string[], way: Walk, offset: Coord): void {
  const put = (tile: Coord, glyph: string): void => {
    const y = tile.y - offset.y
    while (lines.length <= y) lines.push("")
    const line = (lines[y] as string).padEnd(tile.x - offset.x + 1, " ")
    lines[y] = line.slice(0, tile.x - offset.x) + glyph + line.slice(tile.x - offset.x + 1)
  }
  const first = way[0]
  if (first === undefined) return
  put(first.from, "t")
  way.forEach((step, index) => put(step.to, index === way.length - 1 ? "X" : arrow(step.from, step.to)))
}

/** Seconds, as the battle's clock says them: one decimal. */
const seconds = (tick: number): string => `${(tick / TICKS_PER_SECOND).toFixed(1)} s`

/** Two troopers set off on the same tick, one eight columns across and one four rows down: the same length on
 *  screen, and by the kernel's own walk they get there together. */
function walking(): string {
  const start: Coord = { x: 2, y: 2 }
  const across = walk(start, { x: start.x + 8, y: start.y })
  const down = walk(start, { x: start.x, y: start.y + 4 })
  const lines: string[] = []
  drawWalk(lines, across, start)
  drawWalk(lines, down, { x: start.x, y: start.y - 2 })
  const there = (way: Walk): string => seconds(way.at(-1)?.tick ?? 0)
  const label = (line: number, text: string): void => {
    lines[line] = `${(lines[line] ?? "").padEnd(13, " ")}${text}`
  }
  label(0, `8 columns across: there at ${there(across)}`)
  label(lines.length - 1, `4 rows down: there at ${there(down)}`)
  return picture(lines)
}

/** A trooper walking to a tile eight columns across and four rows down: the kernel's own way there. */
function stairs(): string {
  const start: Coord = { x: 2, y: 2 }
  const way = walk(start, { x: start.x + 8, y: start.y + 4 })
  const lines: string[] = []
  drawWalk(lines, way, start)
  return picture(lines)
}

/** Every picture the grid design shows, by the name its marker gives. */
export function gridPictures(): Readonly<Record<string, string>> {
  return {
    distance: distances(),
    reaches: reaches(),
    "whole-rows": wholeRows(),
    walking: walking(),
    stairs: stairs(),
    rings: rings(),
  }
}

/** A marker line, then the code block under it, whose lines are the picture: read line by line up to the fence that
 *  closes it, so an empty block never reaches into the text after it. */
const MARKED = /<!-- grid-picture: ([a-z-]+) -->\n```text\n((?:(?!```)[^\n]*\n)*)```/g

/** What a document's pictures say against what the code draws: the document with every picture redrawn, the names
 *  whose picture differs, any picture the document lacks, and any marker that names no picture. */
export function redraw(markdown: string, pictures: Readonly<Record<string, string>>): Readonly<{
  text: string
  drifted: readonly string[]
  missing: readonly string[]
  unknown: readonly string[]
}> {
  const drifted: string[] = []
  const unknown: string[] = []
  const seen = new Set<string>()
  const text = markdown.replace(MARKED, (whole, name: string, lines: string) => {
    const drawn = pictures[name]
    if (drawn === undefined) {
      unknown.push(name)
      return whole
    }
    seen.add(name)
    if (lines.replace(/\n$/u, "") !== drawn) drifted.push(name)
    return `<!-- grid-picture: ${name} -->\n\`\`\`text\n${drawn}\n\`\`\``
  })
  const missing = Object.keys(pictures).filter((name) => !seen.has(name))
  return { text, drifted, missing, unknown }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pictures = gridPictures()
  if (process.argv.includes("--write")) {
    const result = redraw(readFileSync(GRID_DESIGN, "utf8"), pictures)
    writeFileSync(GRID_DESIGN, result.text)
    console.log(`redrawn: ${result.drifted.join(", ") || "none"}; missing: ${result.missing.join(", ") || "none"}; unknown markers: ${result.unknown.join(", ") || "none"}`)
  } else {
    for (const [name, drawn] of Object.entries(pictures)) console.log(`<!-- grid-picture: ${name} -->\n${drawn}\n`)
  }
}
