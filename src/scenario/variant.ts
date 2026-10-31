// A map made into another for a trial (docs/system-design/testing-ground.md): the same ground with another unit in a
// slot, another army on a side, its units shuffled by a seed, the whole map mirrored end for end, a unit's numbers
// tuned, a terrain swapped, a target moved. Each is a pure function of a map (and the content it is read with) to a
// map, so a trial is the same battles on every machine, and nothing here touches the kernel: a variant is a different
// opening, played by the same rules.

import type { ContentDef } from "../content/types.ts"
import { lineOf } from "../content/types.ts"
import type { ContentRegistry } from "../content/index.ts"
import { createRegistry } from "../content/index.ts"
import { footprintCentre, footprintExtent } from "../grid/coords.ts"
import { isTerrainId } from "../grid/types.ts"
import type { PlayerId, TargetArea } from "../state/types.ts"
import { presetDimensions } from "./presets.ts"
import type { PlacementBlock, PlacementEntry, ScenarioDefinition } from "./types.ts"

export class VariantError extends Error {}

const SIDES: readonly PlayerId[] = ["A", "B"]

/** The map's width and height. */
export function sizeOf(scenario: ScenarioDefinition): Readonly<{ width: number; height: number }> {
  return "preset" in scenario.grid ? presetDimensions(scenario.grid.preset) : scenario.grid
}

/**
 * A content id from a short name: the id itself when `registry` holds it, else the one id whose last part is the name
 * (`trooper` for `unit.citizen.trooper`). Throws for none or several, naming them.
 */
export function contentNamed(registry: ContentRegistry, name: string): string {
  if (registry.has(name)) return name
  const matches = registry.ids().filter((id) => id.endsWith(`.${name}`))
  if (matches.length === 1) return matches[0] as string
  if (matches.length === 0) throw new VariantError(`no content called "${name}"`)
  throw new VariantError(`"${name}" could be ${matches.join(", ")}: name one`)
}

type Placed = { symbol: string; x: number; y: number }

/** Every symbol a block places, at the tile it is written on. */
function placedIn(block: PlacementBlock): Placed[] {
  const at = block.at ?? { x: 0, y: 0 }
  const placed: Placed[] = []
  block.rows.forEach((row, dy) => {
    ;[...row].forEach((symbol, dx) => {
      if (symbol !== " ") placed.push({ symbol, x: at.x + dx, y: at.y + dy })
    })
  })
  return placed
}

/** A block of `placed` symbols with `legend`, written from the Grid's north-west corner. */
function blockOf(placed: readonly Placed[], legend: PlacementBlock["legend"], height: number): PlacementBlock {
  const rows: string[][] = Array.from({ length: height }, () => [])
  for (const { symbol, x, y } of placed) {
    const row = rows[y] as string[]
    while (row.length < x) row.push(" ")
    row[x] = symbol
  }
  return { at: { x: 0, y: 0 }, rows: rows.map((row) => Array.from(row, (cell) => cell ?? " ").join("").trimEnd()), legend }
}

function withBlock(scenario: ScenarioDefinition, side: PlayerId, block: PlacementBlock): ScenarioDefinition {
  return { ...scenario, placements: { ...scenario.placements, [side]: block } }
}

function blockFor(scenario: ScenarioDefinition, side: PlayerId): PlacementBlock {
  const block = scenario.placements[side]
  if (block === undefined) throw new VariantError(`${scenario.id} places nothing for side ${side}`)
  return block
}

/**
 * `side`'s `what` made `content` (`--set A.t=raider`): `what` is a legend symbol, or a content id (or short name) the
 * side places, every symbol of which changes.
 */
export function withContent(scenario: ScenarioDefinition, registry: ContentRegistry, side: PlayerId, what: string, content: string): ScenarioDefinition {
  const block = blockFor(scenario, side)
  const made = contentNamed(registry, content)
  const symbols =
    what in block.legend && what.length === 1
      ? [what]
      : Object.entries(block.legend)
          .filter(([, entry]) => entry.content === contentNamed(registry, what))
          .map(([symbol]) => symbol)
  if (symbols.length === 0) throw new VariantError(`side ${side} of ${scenario.id} places no "${what}"`)
  const legend: Record<string, PlacementEntry> = { ...block.legend }
  for (const symbol of symbols) legend[symbol] = { content: made }
  return withBlock(scenario, side, { ...block, legend })
}

const isUnit = (definition: ContentDef): boolean => definition.layer !== "obstacles" && definition.nexus !== true

/**
 * `side`'s one-tile units replaced by `army`, in order from its front (the column nearest the enemy) to its back, top
 * to bottom in each column (`--army A=trooper:6,skyraider:6`). Its buildings and bigger units stay; an army of more units
 * than the side has one-tile slots is refused, and one of fewer leaves the back slots empty.
 */
export function withArmy(
  scenario: ScenarioDefinition,
  registry: ContentRegistry,
  side: PlayerId,
  army: readonly Readonly<{ content: string; count: number }>[],
): ScenarioDefinition {
  const block = blockFor(scenario, side)
  const entryOf = (symbol: string): PlacementEntry | undefined => block.legend[symbol]
  const oneTile = (symbol: string): boolean => {
    const entry = entryOf(symbol)
    if (entry === undefined) return false
    const definition = registry.get(entry.content)
    return isUnit(definition) && definition.footprint.length === 1
  }
  const placed = placedIn(block)
  const kept = placed.filter((each) => !oneTile(each.symbol))
  const facesEast = side === "A"
  const slots = placed
    .filter((each) => oneTile(each.symbol))
    .sort((a, b) => (a.x === b.x ? a.y - b.y : facesEast ? b.x - a.x : a.x - b.x))
  const contents = army.flatMap(({ content, count }) => Array.from({ length: count }, () => contentNamed(registry, content)))
  if (contents.length > slots.length) throw new VariantError(`side ${side} of ${scenario.id} has ${slots.length} one-tile slots, not ${contents.length}`)
  for (const content of contents) {
    if (registry.get(content).footprint.length !== 1) throw new VariantError(`${content} is not one tile: an army fills one-tile slots`)
  }
  const legend: Record<string, PlacementEntry> = {}
  for (const each of kept) legend[each.symbol] = entryOf(each.symbol) as PlacementEntry
  const free = [..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"].filter((symbol) => !(symbol in legend))
  const symbolFor = new Map<string, string>()
  const armyPlaced: Placed[] = contents.map((content, index) => {
    let symbol = symbolFor.get(content)
    if (symbol === undefined) {
      symbol = free.shift()
      if (symbol === undefined) throw new VariantError("too many kinds of unit for one block")
      symbolFor.set(content, symbol)
      legend[symbol] = { content }
    }
    const slot = slots[index] as Placed
    return { symbol, x: slot.x, y: slot.y }
  })
  return withBlock(scenario, side, blockOf([...kept, ...armyPlaced], legend, sizeOf(scenario).height))
}

/** A whole number from `seed` and `n`, well mixed: a shuffle's draw, a pure function of the two and no stream's. */
function mix(seed: number, n: number): number {
  let value = (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(n + 1, 0xc2b2ae35)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0
  return (value ^ (value >>> 16)) >>> 0
}

/**
 * Each side's units swapped among the places of units of their size and their formation line (melee with melee, ranged
 * with ranged: `lineOf`), by `seed` (`--shuffle`): the same army in the same shape, its ranged units still behind its
 * melee ones as a player would set them, a different unit in each place, so that a trial over many seeds is not one
 * opening played again. Buildings, and the Nexus, keep their places.
 */
export function shuffled(scenario: ScenarioDefinition, registry: ContentRegistry, seed: number): ScenarioDefinition {
  let next = scenario
  for (const side of SIDES) {
    const block = scenario.placements[side]
    if (block === undefined) continue
    const placed = placedIn(block)
    const bySize = new Map<string, Placed[]>()
    for (const each of placed) {
      const entry = block.legend[each.symbol]
      if (entry === undefined) continue
      const definition = registry.get(entry.content)
      if (!isUnit(definition)) continue
      const { width, height } = footprintExtent(definition.footprint)
      const key = `${width}x${height} ${lineOf(definition) ?? "none"}`
      bySize.set(key, [...(bySize.get(key) ?? []), each])
    }
    let draw = side === "A" ? 0 : 1000
    for (const group of bySize.values()) {
      const symbols = group.map((each) => each.symbol)
      for (let index = symbols.length - 1; index > 0; index -= 1) {
        const pick = mix(seed, draw) % (index + 1)
        draw += 1
        ;[symbols[index], symbols[pick]] = [symbols[pick] as string, symbols[index] as string]
      }
      group.forEach((each, index) => {
        each.symbol = symbols[index] as string
      })
    }
    next = withBlock(next, side, blockOf(placed, block.legend, sizeOf(scenario).height))
  }
  return next
}

/**
 * The map mirrored end for end and its sides swapped (`--swap`): what side A placed, side B places at the mirrored
 * tiles, and the other way round, the terrain and the targets mirrored with them. Played beside the map itself, it
 * cancels whatever an end of the map, or reading order, gives a side, so a trial says which army wins, not which end.
 */
export function mirrored(scenario: ScenarioDefinition, registry: ContentRegistry): ScenarioDefinition {
  const { width, height } = sizeOf(scenario)
  const flip = (block: PlacementBlock): PlacementBlock => {
    const placed = placedIn(block).map((each) => {
      const entry = block.legend[each.symbol]
      const footprint = entry === undefined ? [{ x: 0, y: 0 }] : registry.get(entry.content).footprint
      const wide = footprintExtent(footprint).width
      const centre = footprintCentre(footprint).x
      // The footprint's west column moves to the mirrored east one; the symbol stays on its centre column.
      const west = each.x - centre
      return { ...each, x: width - wide - west + centre }
    })
    return blockOf(placed, block.legend, height)
  }
  const flipArea = (area: TargetArea): TargetArea => ({ ...area, x: width - area.x - area.width })
  const placements: Partial<Record<PlayerId, PlacementBlock>> = {}
  if (scenario.placements.A !== undefined) placements.B = flip(scenario.placements.A)
  if (scenario.placements.B !== undefined) placements.A = flip(scenario.placements.B)
  const targets: Partial<Record<PlayerId, TargetArea>> = {}
  if (scenario.targets?.A !== undefined) targets.B = flipArea(scenario.targets.A)
  if (scenario.targets?.B !== undefined) targets.A = flipArea(scenario.targets.B)
  const { targets: _targets, ...rest } = scenario
  return {
    ...rest,
    terrain: scenario.terrain.map((row) => [...row].reverse().join("")),
    placements,
    ...(Object.keys(targets).length === 0 ? {} : { targets }),
  }
}

/** Every `from` tile of the map made `to` terrain (`--terrain "#=terrain.scrub"`). */
export function withTerrain(scenario: ScenarioDefinition, from: string, to: string): ScenarioDefinition {
  const terrain = to.startsWith("terrain.") ? to : `terrain.${to}`
  if (!isTerrainId(terrain)) throw new VariantError(`no terrain "${to}"`)
  if (!(from in scenario.terrainLegend)) throw new VariantError(`${scenario.id} has no terrain symbol "${from}"`)
  return { ...scenario, terrainLegend: { ...scenario.terrainLegend, [from]: terrain } }
}

/** `side`'s target made `area` (`--target A=x,y,w,h`). */
export function withTarget(scenario: ScenarioDefinition, side: PlayerId, area: TargetArea): ScenarioDefinition {
  return { ...scenario, targets: { ...scenario.targets, [side]: area } }
}

/**
 * `registry` with numbers of its content changed (`--tune trooper.maxHp=60,marksman.attack.range=8`): each key a
 * content id or short name, then the path of a field it has (or `vision`, which any unit may have), set to a number,
 * `true`, `false` or a word. Throws for a field the content does not have, so a misspelt tune is never a silent one.
 */
export function tuned(registry: ContentRegistry, tunes: Readonly<Record<string, string>>): ContentRegistry {
  const changed = new Map<string, Record<string, unknown>>()
  for (const [key, raw] of Object.entries(tunes)) {
    const parts = key.split(".")
    let split = -1
    for (let at = parts.length - 1; at >= 1; at -= 1) {
      const name = parts.slice(0, at).join(".")
      if (registry.has(name) || registry.ids().filter((id) => id.endsWith(`.${name}`)).length === 1) {
        split = at
        break
      }
    }
    if (split < 0) throw new VariantError(`--tune ${key}: no content named in it`)
    const id = contentNamed(registry, parts.slice(0, split).join("."))
    const path = parts.slice(split)
    const definition = changed.get(id) ?? structuredClone(registry.get(id) as Record<string, unknown>)
    let holder = definition
    for (const step of path.slice(0, -1)) {
      const inner = holder[step]
      if (typeof inner !== "object" || inner === null) throw new VariantError(`--tune ${key}: ${id} has no "${step}"`)
      holder[step] = { ...(inner as Record<string, unknown>) }
      holder = holder[step] as Record<string, unknown>
    }
    const field = path[path.length - 1] as string
    if (!(field in holder) && !(path.length === 1 && field === "vision")) {
      throw new VariantError(`--tune ${key}: ${id} has no "${path.join(".")}" (it has ${Object.keys(holder).sort().join(", ")})`)
    }
    const value = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw === "true" ? true : raw === "false" ? false : raw
    holder[field] = value
    changed.set(id, definition)
  }
  return createRegistry(registry.ids().map((id) => (changed.get(id) as ContentDef | undefined) ?? registry.get(id)))
}

/** What a trial changes about a map: every part optional, applied in the order listed here. */
export type Variant = Readonly<{
  /** `"A.t": "raider"`: a side's legend symbol, or every symbol of a content it places, made another content. */
  set?: Readonly<Record<string, string>>
  /** `"A": "trooper:6,skyraider:6"`: a side's one-tile units replaced, front to back. */
  army?: Readonly<Partial<Record<PlayerId, string>>>
  /** `"#": "scrub"`: a terrain symbol made another terrain. */
  terrain?: Readonly<Record<string, string>>
  /** A side's target moved. */
  targets?: Readonly<Partial<Record<PlayerId, TargetArea>>>
  /** `"trooper.maxHp": "60"`: content numbers changed, for every map of the trial. */
  tune?: Readonly<Record<string, string | number | boolean>>
  /** How long the battle may run, in ticks. */
  ticks?: number
}>

/** `"trooper:6,skyraider:6"` read as an army. */
export function parseArmy(text: string): { content: string; count: number }[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const [content, count] = part.split(/[:*]/)
      const n = count === undefined ? 1 : Number(count)
      if (content === undefined || content === "" || !Number.isInteger(n) || n < 1) throw new VariantError(`an army is "unit:count,unit:count", not "${part}"`)
      return { content, count: n }
    })
}

function sideOf(key: string, what: string): PlayerId {
  if (key === "A" || key === "B") return key
  throw new VariantError(`${what}: "${key}" is not a side (A or B)`)
}

/** The map and content `variant` makes of `scenario` and `registry`. */
export function applyVariant(
  scenario: ScenarioDefinition,
  registry: ContentRegistry,
  variant: Variant,
): Readonly<{ scenario: ScenarioDefinition; registry: ContentRegistry }> {
  const content = variant.tune === undefined ? registry : tuned(registry, Object.fromEntries(Object.entries(variant.tune).map(([key, value]) => [key, String(value)])))
  let made = scenario
  for (const [key, to] of Object.entries(variant.set ?? {})) {
    const dot = key.indexOf(".")
    if (dot < 0) throw new VariantError(`--set ${key}: write it side.symbol=content, as A.t=raider`)
    made = withContent(made, content, sideOf(key.slice(0, dot), "--set"), key.slice(dot + 1), to)
  }
  for (const [side, army] of Object.entries(variant.army ?? {})) {
    if (army !== undefined) made = withArmy(made, content, sideOf(side, "--army"), parseArmy(army))
  }
  for (const [from, to] of Object.entries(variant.terrain ?? {})) made = withTerrain(made, from, to)
  for (const [side, area] of Object.entries(variant.targets ?? {})) {
    if (area !== undefined) made = withTarget(made, sideOf(side, "--target"), area)
  }
  if (variant.ticks !== undefined) made = { ...made, pulseTicks: variant.ticks }
  return { scenario: made, registry: content }
}
