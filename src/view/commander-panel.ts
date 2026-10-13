// ***The Commander panel***: the player's Commander at a glance, in the side panel of the Build Phase and of the
// Battle Round — her portrait, her name and health, her skill, and where she is in her life: ready, fighting,
// out and the round she is back for, or restored this round by the Nexus Pulse (the owner, 2026-10-12: "giving
// them character and presence in the UI, checking if the resurrection mechanic through Nexus Pulses works well
// and is clear in the UI"):
//
//    _=_  VASSE           80/80
//   (-_-) By the Book
//   /|#|\ out, back round 3
//
// Information, not a menu row: nothing here is a choice, so the keyboard never lands on it and a click does
// nothing. Three rows, set just above the panel's last controls. In the Build Phase the coming raid's words come
// first: where the full panel would cost the raid a group or the troops' line, she takes one line instead, over
// Start Battle Round (`@ VASSE out, back round 3`). And while she is out, the map keeps her place: a dim `@` beside the Nexus that will
// restore her, with the rounds until it does (`drawAbsentCommander`), so the empty place reads as "she is coming
// back" rather than "she is gone".
//
// Everything here is read from what the screen already has — the context's field, absences and restorations, a
// Battle Round's own state at this instant — and nothing here is a rule: when she falls and when she is back are
// the match layer's (`src/match/commander.ts`).

import type { BuildContext } from "../build/state.ts"
import { nexusTile } from "../build/state.ts"
import type { BuildState } from "../build/state.ts"
import { setting } from "../build/all-settings.ts"
import type { BuildLayout } from "../build/layout.ts"
import { cellForTile } from "../build/layout.ts"
import { visibleRange } from "../build/camera.ts"
import { CARD_TEXT } from "../content/cards.ts"
import { ROUNDS_ABSENT } from "../match/commander.ts"
import { TERRAIN } from "../grid/types.ts"
import { gridDistance, inBounds, tilesOf } from "../grid/coords.ts"
import type { Coord } from "../grid/types.ts"
import type { PlayerId } from "../state/types.ts"
import type { BandCell } from "./frame.ts"
import { BANDS } from "./frame.ts"
import { text } from "./draw.ts"
import type { StyleRole } from "./roles.ts"
import { entityGlyph, playerRole } from "./theme.ts"
import type { BuildCompositionInput } from "./build.ts"
import type { PulseFrame } from "./pulse-scene.ts"

/** How many rows the panel takes. */
export const COMMANDER_ROWS = 3

/** Where she is in her life, as the panel's third row says it. */
export type CommanderState =
  | Readonly<{ kind: "ready" }>
  | Readonly<{ kind: "fighting" }>
  | Readonly<{ kind: "restored" }>
  /** Out: fallen this Battle Round or sitting a round out, and the round the Nexus Pulse restores her at the
   *  start of — `null` when that is past the mission's last round. `fell` says she fell in this Battle Round. */
  | Readonly<{ kind: "out"; back: number | null; fell: boolean }>

/** The player's Commander as the panel draws her. */
export type CommanderStatus = Readonly<{
  player: PlayerId
  contentId: string
  /** As her card names her: "Vasse". */
  name: string
  portrait: readonly string[]
  /** Her skill's name ("By the Book"), or `null` without one. */
  skill: string | null
  hp: number
  maxHp: number
  state: CommanderState
}>

/** The third row's words and their role. */
export function stateWords(state: CommanderState): Readonly<{ text: string; role: StyleRole }> {
  switch (state.kind) {
    case "ready":
      return { text: "ready", role: "chrome.value" }
    case "fighting":
      return { text: "fighting", role: "chrome.value" }
    case "restored":
      return { text: "restored this round", role: "chrome.hotkey" }
    case "out": {
      const fell = state.fell ? "fell" : "out"
      return { text: state.back === null ? `${fell}, out this mission` : `${fell}, back round ${state.back}`, role: "notice.gate" }
    }
  }
}

/** Her name as her card gives it. */
function nameOf(contentId: string, fallback: string): string {
  return CARD_TEXT[contentId]?.title ?? fallback
}

/** Out for the round, and the round she is back for (`null` past the mission's end). */
function outState(context: Pick<BuildContext, "round">, returnsInRound: number, fell: boolean): CommanderState {
  const of = context.round?.of
  return { kind: "out", back: of === undefined || returnsInRound <= of ? returnsInRound : null, fell }
}

/** Her health as the Battle Round will start it: the Experiment "Vasse's health" while it is tuned. */
function maxHpOf(context: Pick<BuildContext, "registry">, state: BuildState, contentId: string): number {
  return context.registry.get(contentId).commander === true ? setting(state, "commanderHealth") : context.registry.get(contentId).maxHp
}

/** The player's Commander as the Build Phase sees her, or `null` for a level with none. */
export function buildPhaseCommander(context: BuildContext, state: BuildState): CommanderStatus | null {
  const commander = context.commander
  if (commander === undefined) return null
  const { contentId } = commander
  const maxHp = maxHpOf(context, state, contentId)
  const base = {
    player: "A" as const,
    contentId,
    name: nameOf(contentId, commander.name),
    portrait: commander.portrait,
    skill: context.registry.get(contentId).aura?.name ?? null,
    maxHp,
  }
  const absence = (context.absent ?? []).find((entry) => entry.player === "A" && entry.contentId === contentId)
  if (absence !== undefined) return { ...base, hp: 0, state: outState(context, absence.returnsInRound, false) }
  const standing = (context.field ?? []).find((entity) => entity.player === "A" && entity.contentId === contentId)
  const restored = (context.restored ?? []).some((entry) => entry.player === "A" && entry.contentId === contentId)
  return { ...base, hp: standing?.hp ?? maxHp, state: restored ? { kind: "restored" } : { kind: "ready" } }
}

/** What a Battle Round's panel knows of her at this instant: her entity in the state, if she stands. */
export type BattleCommander = Readonly<{ hp: number | null; maxHp: number }>

/**
 * The player's Commander as the Battle Round sees her at this instant: fighting with the health she has, fallen in
 * it (out for the next round, back for the one after), or sitting it out — or `null` for a level with none.
 */
export function battleCommander(context: BuildContext, round: number, now: BattleCommander): CommanderStatus | null {
  const commander = context.commander
  if (commander === undefined) return null
  const { contentId } = commander
  const base = {
    player: "A" as const,
    contentId,
    name: nameOf(contentId, commander.name),
    portrait: commander.portrait,
    skill: context.registry.get(contentId).aura?.name ?? null,
    maxHp: now.maxHp,
  }
  const absence = (context.absent ?? []).find((entry) => entry.player === "A" && entry.contentId === contentId)
  if (absence !== undefined) return { ...base, hp: 0, state: outState(context, absence.returnsInRound, false) }
  if (now.hp === null) return { ...base, hp: 0, state: outState(context, round + 1 + ROUNDS_ABSENT, true) }
  return { ...base, hp: now.hp, state: { kind: "fighting" } }
}

/** Her as a Battle Round's frame has her at this instant: her entity in its state, if she stands, at the health the
 *  battle runs on. */
export function pulseCommander(context: BuildContext, pulse: Pick<PulseFrame, "sample" | "registry">, round: number): CommanderStatus | null {
  const contentId = context.commander?.contentId
  if (contentId === undefined) return null
  const entity = pulse.sample.state.entities.find((candidate) => candidate.player === "A" && candidate.contentId === contentId)
  const maxHp = pulse.registry.has(contentId) ? pulse.registry.get(contentId).maxHp : context.registry.get(contentId).maxHp
  return battleCommander(context, round, { hp: entity === undefined ? null : entity.hp, maxHp })
}

/** One run of a row's words. */
type Part = Readonly<{ text: string; role: StyleRole; bold?: boolean; dim?: boolean; right?: boolean }>

/** The panel's rows for `width` glyphs: the portrait on the left of each, when she has one, and her words beside
 *  it — name and health, skill, state. Out, the portrait and her name are drawn dim. */
export function commanderRows(status: CommanderStatus, width: number): readonly (readonly Part[])[] {
  const out = status.state.kind === "out"
  const side = playerRole(status.player)
  const face = status.portrait.length === COMMANDER_ROWS ? status.portrait : []
  const words = stateWords(status.state)
  const health = out ? `-/${status.maxHp}` : `${status.hp}/${status.maxHp}`
  const rows: Part[][] = [
    [{ text: status.name.toUpperCase(), role: side, bold: !out, dim: out }, { text: health, role: out ? "chrome.muted" : "chrome.value", right: true }],
    [{ text: status.skill ?? "", role: "chrome.label", dim: out }],
    [{ text: words.text, role: words.role }],
  ]
  return rows.map((row, index) => {
    const portrait = face[index]
    if (portrait === undefined) return row
    return [{ text: `${portrait} `, role: side, dim: out }, ...row]
  })
}

/** Draw the panel's rows from `top`, `width` glyphs from the panel's column: a part marked `right` ends at the
 *  row's right edge. */
export function drawCommanderRows(cells: BandCell[], layout: BuildLayout, top: number, status: CommanderStatus, width: number): void {
  commanderRows(status, width).forEach((row, index) => drawParts(cells, layout, top + index, row, width))
}

/** One row of parts from the panel's column, `width` glyphs: a part marked `right` ends at the row's right edge. */
function drawParts(cells: BandCell[], layout: BuildLayout, row: number, parts: readonly Part[], width: number): void {
  let at = layout.panelColumn
  const end = layout.panelColumn + width
  for (const part of parts) {
    const from = part.right === true ? Math.max(at + 1, end - part.text.length) : at
    const limit = end - from
    if (limit <= 0) break
    text(cells, BANDS.chrome, from, row, part.text, part.role, {
      limit,
      ...(part.bold === true ? { bold: true } : {}),
      ...(part.dim === true ? { dim: true } : {}),
    })
    at = from + part.text.length
  }
}

/** Where the Build Phase's panel puts her (`sidePanelPlan`, `raid-panel.ts`): the full panel from row `top`, or one
 *  line on row `row` when the raid's words need the room. */
export type CommanderPlace = Readonly<{ form: "full"; top: number } | { form: "line"; row: number }>

/** The words of her one-line form: her glyph and name, then her state, short, and her health when she stands. */
export function commanderLine(status: CommanderStatus, width: number): readonly Part[] {
  const out = status.state.kind === "out"
  const side = playerRole(status.player)
  const state =
    status.state.kind === "out"
      ? stateWords(status.state)
      : { text: status.state.kind === "restored" ? "restored" : status.state.kind === "fighting" ? "fighting" : "ready", role: stateWords(status.state).role }
  const parts: Part[] = [
    { text: `${entityGlyph(status.contentId, status.player, { x: 0, y: 0 })} `, role: side, bold: !out, dim: out },
    { text: `${status.name.toUpperCase()} `, role: side, bold: !out, dim: out },
    { text: state.text, role: state.role },
  ]
  const used = parts.reduce((sum, part) => sum + part.text.length, 0)
  const health = `${status.hp}/${status.maxHp}`
  if (!out && used + 1 + health.length <= width) parts.push({ text: health, role: "chrome.value", right: true })
  return parts
}

/** The Build Phase's Commander panel where the plan puts it: full, or one line. */
export function drawCommanderPanel(cells: BandCell[], input: BuildCompositionInput, place: CommanderPlace | null): void {
  const status = buildPhaseCommander(input.context, input.state)
  if (place === null || status === null) return
  const width = input.layout.panelLimit - 1
  if (place.form === "full") drawCommanderRows(cells, input.layout, place.top, status, width)
  else drawParts(cells, input.layout, place.row, commanderLine(status, width), width)
}

/**
 * ***Her place while she is out***: a dim `@` beside the player's Grid Nexus — on the free tile nearest it, east
 * first — and beside it the number of rounds until the Nexus Pulse restores her. Drawn only while she is out and
 * will be back within the mission. Not where she will stand: the Nexus sets her down on the free tile nearest it
 * as the round opens, which the plan may still change.
 */
export function drawAbsentCommander(cells: BandCell[], input: BuildCompositionInput, taken: ReadonlySet<string>): void {
  const { context, state, layout } = input
  const status = buildPhaseCommander(context, state)
  if (status === null || status.state.kind !== "out" || status.state.back === null) return
  const nexus = nexusTile(context)
  if (nexus === null) return
  const at = besideNexus(context, nexus, taken)
  if (at === null) return
  const range = visibleRange(state.camera, state.viewport)
  const rounds = String(status.state.back - (context.round?.number ?? 1))
  const style = { fgRole: playerRole(status.player), dim: true } as const
  const glyphs: Array<Readonly<{ tile: Coord; glyph: string }>> = [{ tile: at, glyph: entityGlyph(status.contentId, status.player, { x: 0, y: 0 }) }]
  const next = { x: at.x + 1, y: at.y }
  if (inBounds(context.grid, next) && !taken.has(`${next.x},${next.y}`)) glyphs.push({ tile: next, glyph: rounds })
  for (const { tile, glyph } of glyphs) {
    if (tile.x < range.firstX || tile.x > range.lastX || tile.y < range.firstY || tile.y > range.lastY) continue
    const cell = cellForTile(layout, state.camera, tile)
    cells.push({ band: BANDS.units, x: cell.x, y: cell.y, cell: { glyph, style } })
  }
}

/** The free tile nearest the Nexus, outside it, by the Grid's own distance — east, then the top, first among equals —
 *  or `null` with none within four rows. */
function besideNexus(context: BuildContext, nexus: Coord, taken: ReadonlySet<string>): Coord | null {
  const candidates: Coord[] = []
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -8; dx <= 8; dx += 1) candidates.push({ x: nexus.x + dx, y: nexus.y + dy })
  }
  const free = candidates.filter((tile) => {
    if (!inBounds(context.grid, tile) || taken.has(`${tile.x},${tile.y}`)) return false
    const terrain = context.grid.tiles[tile.y * context.grid.width + tile.x]
    return terrain === undefined || !TERRAIN[terrain].impassable
  })
  free.sort((a, b) => gridDistance(nexus, a) - gridDistance(nexus, b) || b.x - a.x || a.y - b.y)
  return free[0] ?? null
}

/** Every tile something stands on, or will as the round starts: what the dim `@` and its number keep off. */
export function takenOnMap(context: BuildContext, state: BuildState): Set<string> {
  const taken = new Set<string>()
  const hold = (contentId: string, anchor: Coord): void => {
    for (const tile of tilesOf(anchor, context.registry.get(contentId).footprint)) taken.add(`${tile.x},${tile.y}`)
  }
  for (const structure of context.standing) hold(structure.contentId, structure.anchor)
  for (const placement of state.planned) hold(placement.contentId, placement.anchor)
  for (const entity of context.field ?? []) hold(entity.contentId, entity.anchor)
  for (const entity of context.incoming ?? []) hold(entity.contentId, entity.anchor)
  return taken
}
