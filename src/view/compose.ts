// The composition — engine.md 3.1, 3.3, 9.2, 9.3, and Q12's 8-row chrome budget.
//
//   80 columns = 1 border + 48 grid columns + 1 border + 30 side panel, at one column per tile.
//  128 columns = the same arithmetic at two columns per tile.
//   24 rows    = 1 border + 3 header + 16 grid rows + 3 footer + 1 border.
//
// The Grid pane is always the 48 x 16 minimum viewport. A Grid smaller than that is centred inside
// it and never gated (engine.md 3.3, fitting step 4), and the leftover is spent on centring — never
// on more Grid. Gate 1A Grids fit entirely, so there is no scrolling, no cursor, and no selection.

import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import { tilesOf } from "../grid/coords.ts"
import type { GridTerrain } from "../grid/types.ts"
import type { MatchState, PlayerId } from "../state/types.ts"
import { PLAYERS } from "../state/types.ts"
import type { BandCell, Cell, ReadonlyCellFrame } from "./frame.ts"
import { BANDS, composeBands } from "./frame.ts"
import type { CapabilityMode, StyleRole } from "./roles.ts"
import { SALVAGE_GLYPH, entityGlyph, playerRole, terrainGlyph } from "./theme.ts"

export type TileWidth = 1 | 2

/** The minimum viewport, in tiles — RULE (engine.md 3.3). */
export const VIEWPORT_TILES = { width: 48, height: 16 } as const
export const PANEL_COLUMNS = 30
export const HEADER_ROWS = 3
export const FOOTER_ROWS = 3

export function compositionSize(tileWidth: TileWidth): { width: number; height: number } {
  return {
    width: 1 + VIEWPORT_TILES.width * tileWidth + 1 + PANEL_COLUMNS,
    height: 1 + HEADER_ROWS + VIEWPORT_TILES.height + FOOTER_ROWS + 1,
  }
}

export type CompositionInput = Readonly<{
  scenarioId: string
  scenarioName: string
  seed: number
  pulseTicks: number
  grid: GridTerrain
  registry: ContentRegistry
  /** Authoritative state for the tick being shown. */
  state: MatchState
  /** Where each entity is drawn — interpolated, and never known to the simulation. */
  positions: ReadonlyMap<number, { x: number; y: number }>
  tick: number
  recent: readonly DomainEvent[]
  paused: boolean
  speed: number
  status: string
}>

function put(
  cells: BandCell[],
  band: number,
  x: number,
  y: number,
  glyph: string,
  role?: StyleRole,
  extra: Readonly<{ dim?: boolean; bold?: boolean; limit?: number }> = {},
): void {
  const style = {
    ...(role === undefined ? {} : { fgRole: role }),
    ...(extra.dim === true ? { dim: true } : {}),
    ...(extra.bold === true ? { bold: true } : {}),
  }
  cells.push({ band, x, y, cell: { glyph, style } })
}

/**
 * ASCII-safe is the baseline (engine.md 9.6): every cell is one column wide and printable. Authored
 * text — a scenario name, say — may hold typographic characters, so it is transliterated here
 * rather than trusted, and anything left over becomes a question mark. The alternative is a frame
 * that fails its own width-one invariant because someone typed an em dash.
 */
const TRANSLITERATE: Readonly<Record<string, string>> = {
  "\u2014": "-",
  "\u2013": "-",
  "\u2018": "'",
  "\u2019": "'",
  "\u201c": '"',
  "\u201d": '"',
  "\u2026": "...",
}

export function toAscii(value: string): string {
  let out = ""
  for (const character of value) {
    const replacement = TRANSLITERATE[character]
    if (replacement !== undefined) {
      out += replacement
      continue
    }
    const code = character.codePointAt(0) ?? 0
    out += code >= 0x20 && code <= 0x7e ? character : "?"
  }
  return out
}

function text(
  cells: BandCell[],
  band: number,
  x: number,
  y: number,
  value: string,
  role?: StyleRole,
  extra: Readonly<{ dim?: boolean; bold?: boolean; limit?: number }> = {},
): void {
  const limit = extra.limit ?? Number.POSITIVE_INFINITY
  const glyphs = [...toAscii(value)].slice(0, Math.max(0, limit))
  glyphs.forEach((glyph, index) => put(cells, band, x + index, y, glyph, role, extra))
}

export function gridOrigin(
  grid: GridTerrain,
  tileWidth: TileWidth,
): { column: number; row: number } {
  const offsetTilesX = Math.floor((VIEWPORT_TILES.width - Math.min(grid.width, VIEWPORT_TILES.width)) / 2)
  const offsetTilesY = Math.floor(
    (VIEWPORT_TILES.height - Math.min(grid.height, VIEWPORT_TILES.height)) / 2,
  )
  return { column: 1 + offsetTilesX * tileWidth, row: 1 + HEADER_ROWS + offsetTilesY }
}

export function composeFrame(
  input: CompositionInput,
  capability: CapabilityMode,
  tileWidth: TileWidth,
): ReadonlyCellFrame {
  void capability
  const size = compositionSize(tileWidth)
  const cells: BandCell[] = []
  const origin = gridOrigin(input.grid, tileWidth)
  const gridColumns = VIEWPORT_TILES.width * tileWidth

  // Band 1 — terrain.
  for (let y = 0; y < input.grid.height; y += 1) {
    for (let x = 0; x < input.grid.width; x += 1) {
      const terrainId = input.grid.tiles[y * input.grid.width + x]
      if (terrainId === undefined) continue
      const { glyph, role } = terrainGlyph(terrainId)
      const column = origin.column + x * tileWidth
      put(cells, BANDS.terrain, column, origin.row + y, glyph, role, { dim: true })
      for (let extra = 1; extra < tileWidth; extra += 1) {
        put(cells, BANDS.terrain, column + extra, origin.row + y, " ", role)
      }
    }
  }

  // Band 3 — ground items: salvage dropped where something died.
  for (const item of input.state.groundItems) {
    put(
      cells,
      BANDS.groundItems,
      origin.column + item.at.x * tileWidth,
      origin.row + item.at.y,
      SALVAGE_GLYPH,
      "item.salvage",
    )
  }

  // Bands 4, 5 and 6 — structures, workers and units, air. The Grid layers map onto them directly.
  for (const entity of input.state.entities) {
    const definition = input.registry.get(entity.contentId)
    const drawn = input.positions.get(entity.ordinal) ?? entity.anchor
    const band =
      definition.layer === "obstacles"
        ? BANDS.structures
        : definition.layer === "air"
          ? BANDS.air
          : BANDS.units
    for (const offset of definition.footprint) {
      const tile = { x: drawn.x + offset.x, y: drawn.y + offset.y }
      if (tile.x < 0 || tile.y < 0 || tile.x >= input.grid.width || tile.y >= input.grid.height) {
        continue
      }
      const glyph = entityGlyph(entity.contentId, entity.player, definition.footprint, offset)
      const column = origin.column + tile.x * tileWidth
      put(cells, band, column, origin.row + tile.y, glyph, playerRole(entity.player), {
        bold: definition.layer === "obstacles",
      })
      for (let extra = 1; extra < tileWidth; extra += 1) {
        put(cells, band, column + extra, origin.row + tile.y, " ", playerRole(entity.player))
      }
    }
  }

  // Band 10 — chrome: frame, header, footer, side panel.
  drawChrome(cells, input, size, tileWidth, gridColumns)

  return composeBands(size.width, size.height, cells)
}

function drawChrome(
  cells: BandCell[],
  input: CompositionInput,
  size: { width: number; height: number },
  tileWidth: TileWidth,
  gridColumns: number,
): void {
  const band = BANDS.chrome
  const right = 1 + gridColumns
  const paneLimit = right - 3
  const panelX = right + 2
  const panelLimit = size.width - 1 - panelX

  for (let x = 0; x < size.width; x += 1) {
    put(cells, band, x, 0, "-", "chrome.frame")
    put(cells, band, x, size.height - 1, "-", "chrome.frame")
  }
  for (let y = 1; y < size.height - 1; y += 1) {
    put(cells, band, 0, y, "|", "chrome.frame")
    put(cells, band, right, y, "|", "chrome.frame")
    put(cells, band, size.width - 1, y, "|", "chrome.frame")
  }
  for (const corner of [0, size.width - 1]) {
    put(cells, band, corner, 0, "+", "chrome.frame")
    put(cells, band, corner, size.height - 1, "+", "chrome.frame")
  }

  // Header — three rows, of the eight-row chrome budget (Q12: 2 border, 3 header, 3 footer).
  text(cells, band, 2, 1, "TERMINAL NEXUS", "chrome.title", { bold: true, limit: paneLimit })
  text(cells, band, 18, 1, "the pulse playground", "chrome.muted", {
    dim: true,
    limit: right - 19,
  })
  text(cells, band, 2, 2, input.scenarioName, "chrome.value", { limit: paneLimit })
  text(cells, band, 2, 3, `seed ${hexSeed(input.seed)}`, "chrome.label", { limit: paneLimit })

  // Footer — the position readout engine.md 3.3 requires, the controls, and the status line.
  const footerTop = size.height - 1 - FOOTER_ROWS
  text(
    cells,
    band,
    2,
    footerTop,
    `view (0,0)-(${input.grid.width - 1},${input.grid.height - 1}) of ` +
      `${input.grid.width}x${input.grid.height}  ${tileWidth} col/tile`,
    "chrome.label",
    { limit: paneLimit },
  )
  text(cells, band, 2, footerTop + 1, CONTROLS, "chrome.muted", { dim: true, limit: paneLimit })
  text(cells, band, 2, footerTop + 2, input.status, "chrome.value", { limit: paneLimit })

  // Side panel — 30 columns. During a Pulse it carries the pulse state, both sides' force totals,
  // and the feed that makes "who shot whom" readable before Gate 1B's effects exist.
  text(cells, band, panelX, 1, "NEXUS PULSE", "chrome.title", { bold: true, limit: panelLimit })
  text(cells, band, panelX, 2, input.scenarioId, "chrome.muted", { dim: true, limit: panelLimit })
  text(
    cells,
    band,
    panelX,
    3,
    `tick ${String(input.tick).padStart(4, "0")}/${input.pulseTicks}  ` +
      `${input.speed.toFixed(2)}x ${input.paused ? "[hold]" : "[run]"}`,
    "chrome.label",
    { limit: panelLimit },
  )

  const totals = forceTotals(input)
  PLAYERS.forEach((player, index) => {
    text(cells, band, panelX, 5 + index, totals[player], playerRole(player), { limit: panelLimit })
  })

  text(cells, band, panelX, 8, "recent", "chrome.label", { limit: panelLimit })
  input.recent.slice(-8).forEach((event, index) => {
    text(cells, band, panelX, 9 + index, feedLine(event), "chrome.value", { limit: panelLimit })
  })

  LEGEND.forEach((line, index) => {
    text(cells, band, panelX, size.height - 2 - LEGEND.length + index, line, "chrome.muted", {
      dim: true,
      limit: panelLimit,
    })
  })
}

/** Playback controls, sized to the Grid pane at 80 columns. */
const CONTROLS = "space pause  .,step  [] speed  r reset  q quit"

/**
 * The legend is not decoration: ownership is carried by letter case and every role is legible
 * without colour, so the reader needs to be told the code once (engine.md 9.6).
 */
const LEGEND: readonly string[] = [
  "A side lower   B side UPPER",
  "t trooper  m marksman",
  "w worker   ( h ) hauler",
  "n nexus    b barracks",
  "% salvage  # rock  * ore",
]

function hexSeed(seed: number): string {
  return `0x${(seed >>> 0).toString(16).toUpperCase().padStart(8, "0")}`
}

function forceTotals(input: CompositionInput): Record<PlayerId, string> {
  const counts: Record<PlayerId, { units: number; hp: number }> = {
    A: { units: 0, hp: 0 },
    B: { units: 0, hp: 0 },
  }
  for (const entity of input.state.entities) {
    const side = counts[entity.player]
    side.units += 1
    side.hp += entity.hp
  }
  return {
    A: `A  alive ${String(counts.A.units).padStart(2)}   hp ${String(counts.A.hp).padStart(4)}`,
    B: `B  alive ${String(counts.B.units).padStart(2)}   hp ${String(counts.B.hp).padStart(4)}`,
  }
}

/** `A:marksman#5` becomes `Am5`, so a whole event fits the panel's 28 usable columns. */
function shortId(id: string): string {
  const [player = "?", rest = ""] = id.split(":")
  const [name = "?", number = "?"] = rest.split("#")
  return `${player}${name.slice(0, 1)}${number}`
}

export function feedLine(event: DomainEvent): string {
  switch (event.kind) {
    case "attack.launched":
      return `${String(event.tick).padStart(3)} ${shortId(event.attacker)}>${shortId(event.target)} ${
        event.attackKind === "ranged" ? "shot" : "hit"
      } ${event.damage}`
    case "entity.died":
      return `${String(event.tick).padStart(3)} ${shortId(event.entity)} dies`
    case "structure.destroyed":
      return `${String(event.tick).padStart(3)} ${shortId(event.entity)} destroyed`
    case "pulse.ended":
      return `${String(event.tick).padStart(3)} ${event.winner ?? "draw"} ${event.reason}`
    default:
      return ""
  }
}

export const FEED_KINDS: readonly DomainEvent["kind"][] = [
  "attack.launched",
  "entity.died",
  "structure.destroyed",
  "pulse.ended",
]

/**
 * The resize gate — engine.md 9.6 makes it a RULE, and a terminal is a thing people drag. Below the
 * composition size the view shows this and freezes presentation time; resizing back resumes from
 * the same presentation time.
 */
export function gateFrame(
  width: number,
  height: number,
  required: { width: number; height: number },
): ReadonlyCellFrame {
  const cells: BandCell[] = []
  const lines = [
    "TERMINAL TOO SMALL",
    `need ${required.width} x ${required.height}`,
    `have ${Math.max(width, 0)} x ${Math.max(height, 0)}`,
    "resize to continue",
  ]
  lines.forEach((line, index) => {
    const x = Math.max(0, Math.floor((width - line.length) / 2))
    const y = Math.max(0, Math.floor(height / 2) - 2 + index)
    text(cells, BANDS.chrome, x, y, line, index === 0 ? "notice.gate" : "chrome.value", {
      bold: index === 0,
    })
  })
  return composeBands(Math.max(width, 1), Math.max(height, 1), cells)
}

export type { Cell }
