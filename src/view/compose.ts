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
import { footprintExtent, tilesOf } from "../grid/coords.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import type { MatchState, PlayerId } from "../state/types.ts"
import { PLAYERS } from "../state/types.ts"
import type { ActiveEffect, EffectBand, EffectCellSource } from "./effects/index.ts"
import { mergeEffectCells } from "./effects/index.ts"
import type { BandCell, Cell, ReadonlyCellFrame } from "./frame.ts"
import { BANDS, composeBands } from "./frame.ts"
import type { CapabilityMode, StyleRole } from "./roles.ts"
import { chromeGlyph, entityGlyph, playerRole, salvageGlyph, terrainGlyph } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"

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

/**
 * A dead entity, still drawn — never in `state`, which stays strictly true. `snapshot.ts` builds
 * these for a ranged kill: the target is gone from `state.entities` the instant it dies, but its
 * own tracer is still visibly travelling for the rest of its flight window, so without this a unit
 * would vanish before the shot that killed it arrives. Held for exactly as long as
 * `fx.death.collapse`/`fx.structure.collapse` are already held (`buildFlightHoldTicks`), so the
 * glyph disappears at the same instant the death effect takes over the tile, not before and not
 * after.
 */
export type HeldCorpse = Readonly<{
  ordinal: number
  contentId: string
  player: PlayerId
  anchor: Coord
}>

export type CompositionInput = Readonly<{
  scenarioId: string
  scenarioName: string
  seed: number
  pulseTicks: number
  grid: GridTerrain
  registry: ContentRegistry
  /** Authoritative state for the tick being shown. */
  state: MatchState
  /** The opening cast, so the legend describes the fight rather than only its survivors. */
  roster: readonly string[]
  /** Each side's health at tick zero, which is what the force bars are measured against. */
  openingHealth: ReadonlyMap<PlayerId, number>
  /** Where each entity is drawn — interpolated, and never known to the simulation. */
  positions: ReadonlyMap<number, { x: number; y: number }>
  tick: number
  recent: readonly DomainEvent[]
  paused: boolean
  speed: number
  status: string
  /** What the effect system is painting at this instant. Empty is a legal, complete frame. */
  effects?: readonly ActiveEffect[]
  /** ASCII is the baseline and the acceptance target; the pack dresses the field and the frame. */
  glyphPack?: GlyphPack
  /** Ranged kills still waiting for their own tracer to land — drawn, but never counted anywhere. */
  heldCorpses?: readonly HeldCorpse[]
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
/** Glyphs the Unicode pack may put on screen; everything else outside ASCII becomes a question mark. */
const PACK_SAFE = new Set(["\u00b7", "\u2593", "\u25c6", "\u25aa", "\u2500", "\u2502", "\u250c", "\u2510", "\u2514", "\u2518", "\u2504", "\u2506"])

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
    out += (code >= 0x20 && code <= 0x7e) || PACK_SAFE.has(character) ? character : "?"
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

function drawGridEdge(
  cells: BandCell[],
  grid: GridTerrain,
  origin: { column: number; row: number },
  tileWidth: TileWidth,
  pack: GlyphPack,
): void {
  const left = origin.column - 1
  const right = origin.column + grid.width * tileWidth
  const top = origin.row - 1
  const bottom = origin.row + grid.height
  if (left < 1 || top < 1 + HEADER_ROWS) return

  const horizontal = chromeGlyph(pack, "edgeHorizontal")
  const vertical = chromeGlyph(pack, "edgeVertical")
  for (let x = left + 1; x < right; x += 1) {
    put(cells, BANDS.terrain, x, top, horizontal, "chrome.muted", { dim: true })
    put(cells, BANDS.terrain, x, bottom, horizontal, "chrome.muted", { dim: true })
  }
  for (let y = top + 1; y < bottom; y += 1) {
    put(cells, BANDS.terrain, left, y, vertical, "chrome.muted", { dim: true })
    put(cells, BANDS.terrain, right, y, vertical, "chrome.muted", { dim: true })
  }
  for (const [x, y] of [
    [left, top],
    [right, top],
    [left, bottom],
    [right, bottom],
  ] as const) {
    put(cells, BANDS.terrain, x, y, chromeGlyph(pack, "edgeCorner"), "chrome.muted", { dim: true })
  }
}

const EFFECT_BAND_NUMBERS: Readonly<Record<EffectBand, number>> = {
  "ground-items": BANDS.groundItems,
  projectiles: BANDS.projectiles,
  effects: BANDS.effects,
  highlights: BANDS.highlights,
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
  const pack: GlyphPack = input.glyphPack ?? "ascii"
  const cells: BandCell[] = []
  const origin = gridOrigin(input.grid, tileWidth)
  const gridColumns = VIEWPORT_TILES.width * tileWidth

  // Band 1 — terrain.
  for (let y = 0; y < input.grid.height; y += 1) {
    for (let x = 0; x < input.grid.width; x += 1) {
      const terrainId = input.grid.tiles[y * input.grid.width + x]
      if (terrainId === undefined) continue
      const { glyph, role } = terrainGlyph(terrainId, pack)
      const column = origin.column + x * tileWidth
      // Featureless ground is drawn as a coarse lattice rather than a dot per tile: negative space
      // is material, and 288 identical marks compete with every unit and every effect on top of
      // them. Rock and deposits are features and are always drawn.
      const featureless = terrainId === "terrain.plain"
      const onLattice = x % 4 === 0 && y % 2 === 0
      put(
        cells,
        BANDS.terrain,
        column,
        origin.row + y,
        featureless && !onLattice ? " " : glyph,
        role,
        { dim: true },
      )
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
      salvageGlyph(pack),
      "item.salvage",
    )
  }

  // Bands 4, 5 and 6 — structures, workers and units, air. The Grid layers map onto them directly.
  // Tiles an entity occupies are remembered, because the corruption law says an effect may never
  // replace the only cell carrying a required semantic cue, and a unit's glyph is exactly that.
  const occupied = new Set<string>()
  // A held corpse is drawn exactly like a live entity — same band, same role, same bold rule — for
  // as long as its own ranged tracer is still travelling. It is never in `input.state.entities`, so
  // it never reaches `forceTotals` or anything else that counts the living.
  const drawnEntities: readonly {
    ordinal: number
    contentId: string
    player: PlayerId
    anchor: Coord
  }[] = [...input.state.entities, ...(input.heldCorpses ?? [])]
  for (const entity of drawnEntities) {
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
      const glyph = entityGlyph(entity.contentId, entity.player, offset)
      occupied.add(`${tile.x},${tile.y}`)
      const column = origin.column + tile.x * tileWidth
      put(cells, band, column, origin.row + tile.y, glyph, playerRole(entity.player), {
        bold: definition.layer === "obstacles",
      })
      for (let extra = 1; extra < tileWidth; extra += 1) {
        put(cells, band, column + extra, origin.row + tile.y, " ", playerRole(entity.player))
      }
    }
  }

  // A quiet rule around the play area, where the Grid is smaller than the pane. Without it a
  // lattice-drawn field has no visible edge, and a player cannot tell empty ground from off-Grid.
  // When the Grid fills the pane — the default 48 x 16 preset does — the frame's own border is
  // already that edge, so this draws nothing.
  drawGridEdge(cells, input.grid, origin, tileWidth, pack)

  // Bands 3, 7, 8 and 9 — effects. They may paint here and nowhere else (ascii-effects.md 1.1),
  // they are clipped to the Grid, and they can never move a glyph the simulation put down.
  //
  // Collected first, rather than pushed straight into `cells`, so that two effect cells landing on
  // the same tile and band this frame go through mergeEffectCells (src/view/effects/composite.ts)
  // before either one reaches the general "topmost wins" rule composeBands applies to everything
  // else. That merge is effects-only, on purpose: a live entity's own glyph must never be a blend of
  // two things, only two *effects* competing for the same tile are allowed to combine.
  const effectSources: EffectCellSource[] = []
  for (const painted of input.effects ?? []) {
    const band = painted.instance.band
    for (const cell of painted.cells) {
      if (
        cell.tile.x < 0 ||
        cell.tile.y < 0 ||
        cell.tile.x >= input.grid.width ||
        cell.tile.y >= input.grid.height
      ) {
        continue
      }
      effectSources.push({ band, cell })
    }
  }
  for (const source of mergeEffectCells(effectSources)) {
    const cell = source.cell
    const band = EFFECT_BAND_NUMBERS[source.band]
    const column = origin.column + cell.tile.x * tileWidth
    const row = origin.row + cell.tile.y
    const style = {
      ...(cell.role === undefined ? {} : { fgRole: cell.role }),
      ...(cell.bold === true ? { bold: true } : {}),
      ...(cell.dim === true ? { dim: true } : {}),
      ...(cell.inverse === true ? { inverse: true } : {}),
      // Only when it means something: fade 0 (or absent) is the role's own colour either way, and
      // omitting the key here keeps a frame with no faded cells identical to one from before Q25's
      // amendment existed, byte for byte.
      ...(cell.fade !== undefined && cell.fade > 0 ? { fade: cell.fade } : {}),
    }
    if (cell.glyph === "") {
      // An attribute change on whatever is already there — the damage flash, and only it. This is
      // the one way an effect may touch a cell an entity is standing on.
      cells.push({ band, x: column, y: row, style })
      continue
    }
    // The corruption law, enforced by the compositor rather than by recipe discipline: an effect
    // that would replace a unit, a structure or a wreck's glyph is dropped on that tile. The
    // screen may look wrong; the player must still be able to see what is attacking them.
    if (occupied.has(`${cell.tile.x},${cell.tile.y}`)) continue
    cells.push({ band, x: column, y: row, cell: { glyph: cell.glyph, style } })
  }

  // Band 10 — chrome: frame, header, footer, side panel.
  drawChrome(cells, input, size, tileWidth, gridColumns, pack)

  return composeBands(size.width, size.height, cells)
}

function drawChrome(
  cells: BandCell[],
  input: CompositionInput,
  size: { width: number; height: number },
  tileWidth: TileWidth,
  gridColumns: number,
  pack: GlyphPack,
): void {
  const band = BANDS.chrome
  const right = 1 + gridColumns
  const paneLimit = right - 3
  const panelX = right + 2
  const panelLimit = size.width - 1 - panelX

  const horizontal = chromeGlyph(pack, "horizontal")
  const vertical = chromeGlyph(pack, "vertical")
  for (let x = 0; x < size.width; x += 1) {
    put(cells, band, x, 0, horizontal, "chrome.frame")
    put(cells, band, x, size.height - 1, horizontal, "chrome.frame")
  }
  for (let y = 1; y < size.height - 1; y += 1) {
    put(cells, band, 0, y, vertical, "chrome.frame")
    put(cells, band, right, y, vertical, "chrome.frame")
    put(cells, band, size.width - 1, y, vertical, "chrome.frame")
  }
  put(cells, band, 0, 0, chromeGlyph(pack, "topLeft"), "chrome.frame")
  put(cells, band, size.width - 1, 0, chromeGlyph(pack, "topRight"), "chrome.frame")
  put(cells, band, 0, size.height - 1, chromeGlyph(pack, "bottomLeft"), "chrome.frame")
  put(cells, band, size.width - 1, size.height - 1, chromeGlyph(pack, "bottomRight"), "chrome.frame")

  // Header — three rows, of the eight-row chrome budget (Q12: 2 border, 3 header, 3 footer).
  text(cells, band, 2, 1, "TERMINAL NEXUS", "chrome.title", { bold: true, limit: paneLimit })
  text(cells, band, 18, 1, "the grid tool", "chrome.muted", {
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
  // While playback is held the status line says so: the panel's [hold] and a footer reading
  // "pulse running" are true of different things, and side by side they read as a contradiction.
  const status = input.paused
    ? `paused at tick ${String(input.tick).padStart(4, "0")}`
    : input.status
  text(cells, band, 2, footerTop + 2, status, "chrome.value", { limit: paneLimit })

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

  const legend = legendFor(input, pack)
  legend.forEach((line, index) => {
    text(cells, band, panelX, size.height - 2 - legend.length + index, line, "chrome.muted", {
      dim: true,
      limit: panelLimit,
    })
  })
}

/**
 * The legend is built from what is actually on this Grid, in this glyph pack. A fixed list was fine
 * while one faction existed and one pack; with two of each it starts lying, and a legend that lies
 * is worse than no legend — ownership and faction are exactly what a new viewer is decoding.
 */
function legendFor(input: CompositionInput, pack: GlyphPack): string[] {
  // Deduplicated by what a reader actually sees — two factions both call their Grid Nexus a nexus
  // and both draw it `n`, so it earns one line, not two.
  const entries = new Map<string, number>()
  for (const contentId of input.roster) {
    const definition = input.registry.get(contentId)
    // One row of the body is the whole identity: `>x<` and `(h)` are bodies, `.n.` is a roof. Capped
    // at three columns so a five-wide leviathan cannot widen the panel on its own.
    const { width } = footprintExtent(definition.footprint)
    const glyph = Array.from({ length: Math.min(3, width) }, (_unused, x) =>
      entityGlyph(definition.id, "A", { x, y: 0 }),
    ).join("")
    const key = `${glyph} ${definition.short}`
    entries.set(key, (entries.get(key) ?? 0) + 1)
  }

  // Six at most, the commonest first, so a crowded Grid does not push the feed off the panel.
  const listed = [...entries.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([label]) => label)
    .sort()

  const lines: string[] = ["lower case = A   UPPER = B"]
  for (let index = 0; index < listed.length; index += 2) {
    const left = (listed[index] ?? "").padEnd(14, " ")
    lines.push(`${left}${listed[index + 1] ?? ""}`.trimEnd())
  }
  lines.push(
    `${salvageGlyph(pack)} salvage  ${terrainGlyph("terrain.rock", pack).glyph} rock  ` +
      `${terrainGlyph("terrain.deposit", pack).glyph} ore`,
  )
  return lines
}

/** Playback controls, sized to the Grid pane at 80 columns. */
const CONTROLS = "space pause  .,step  [] speed  r reset  q quit"

function hexSeed(seed: number): string {
  return `0x${(seed >>> 0).toString(16).toUpperCase().padStart(8, "0")}`
}

/**
 * Force totals with a bar, because "hp 661" answers *how much* and not *how much is left* — and on
 * the Grid itself a wounded unit looks exactly like a fresh one. The bar is drawn from characters
 * rather than colour, so it survives monochrome, which is where it matters most.
 */
function forceTotals(input: CompositionInput): Record<PlayerId, string> {
  const counts: Record<PlayerId, { units: number; hp: number; max: number }> = {
    A: { units: 0, hp: 0, max: 0 },
    B: { units: 0, hp: 0, max: 0 },
  }
  for (const entity of input.state.entities) {
    const definition = input.registry.get(entity.contentId)
    // Structures are excluded: a 400-point Grid Nexus swamps the bar, so a side could lose its
    // whole army and still look nine tenths healthy. The Nexus has its own tell — it goes critical.
    if (definition.layer === "obstacles") continue
    const side = counts[entity.player]
    side.units += 1
    side.hp += entity.hp
  }
  // The denominator is what the side started with, so the bar shrinks as the fight goes on.
  const opening: Record<PlayerId, number> = { A: 0, B: 0 }
  input.openingHealth.forEach((health, player) => {
    opening[player] = health
  })

  const bar = (current: number, max: number): string => {
    const width = 10
    const filled = max <= 0 ? 0 : Math.max(current > 0 ? 1 : 0, Math.round((current / max) * width))
    return `${"#".repeat(Math.min(width, filled))}${"-".repeat(Math.max(0, width - filled))}`
  }

  return {
    A: `A ${String(counts.A.units).padStart(2)} [${bar(counts.A.hp, opening.A)}] ${String(counts.A.hp).padStart(4)}`,
    B: `B ${String(counts.B.units).padStart(2)} [${bar(counts.B.hp, opening.B)}] ${String(counts.B.hp).padStart(4)}`,
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
