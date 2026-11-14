// A save's `start` (docs/system-design/skirmish-saves.md): what a person places by hand before round 1, a slot at a
// time: the units and buildings already on the Grid, written as a picture with a legend, and where its troops head.
// A save with a `start` is a **sandbox** (`sandboxes/`): it opens on a Battle Round written by hand, which
// is what it tests, and both slots plan nothing (`script:idle`).
//
// Pure: it turns a save's text, already read, into the opening the kernel starts from (`BattleOpening`,
// `src/skirmish/opening/`), and names what is wrong with a `start`. It imports the save's types only, so the browser
// page can open a sandbox without the battle.

import type { Coord, TerrainId } from "../grid/types.ts"
import type { PlayerId, TargetArea } from "../state/types.ts"
import { BATTLE_MAPS } from "../battle/maps.ts"
import { isObject, isWhole } from "../content/shape.ts"
import { SANDBOX_PHASES } from "./opening/phase.ts"
import type { SandboxPhase } from "./opening/phase.ts"
import type { BattleOpening, PlacementBlock, PlacementEntry } from "./opening/types.ts"
import type { SaveFile, SaveMap, Slot } from "./save.ts"

/** The ground a map drawn in a save reads when it gives no legend: `.` open, `#` rock, `*` a deposit. */
export const MAP_LEGEND: Readonly<Record<string, TerrainId>> = { ".": "terrain.plain", "#": "terrain.rock", "*": "terrain.deposit" }

/**
 * One slot's start: what it has on the Grid when the first Battle Round opens, and where its troops head.
 *
 * `rows` are one character per tile, north to south, from `at` (the Grid's north-west corner unless given); a space is
 * nothing. Each character is the **centre tile** of what the legend names, whatever its size, and the legend may start
 * it hurt (`hp`). A slot with no `target` heads for the enemy Nexus, as every side of the game does.
 */
export type StartSlot = Readonly<{
  at?: Coord
  rows?: readonly string[]
  legend?: Readonly<Record<string, PlacementEntry>>
  target?: TargetArea
}>

/** What each slot places by hand before round 1, and the `phase` the sandbox is in: the Battle Round unless it says
 *  `"build-phase"` (`src/skirmish/opening/phase.ts`). */
export type SaveStart = Readonly<Partial<Record<Slot, StartSlot>>> & Readonly<{ phase?: SandboxPhase }>

const SIDE: Readonly<Record<Slot, PlayerId>> = { p1: "A", p2: "B" }


/** The problems with a save's `start`, by their place in the file. Whether the units fit the ground is the
 *  opening's to say, once the shape is right. */
export function startProblems(start: unknown): string[] {
  if (!isObject(start)) return ["start: { p1?, p2? }, what each slot places by hand before round 1"]
  const problems: string[] = []
  for (const [slot, value] of Object.entries(start)) {
    const at = `start.${slot}`
    if (slot === "phase") {
      if (!(SANDBOX_PHASES as readonly unknown[]).includes(value)) problems.push(`start.phase: one of ${SANDBOX_PHASES.join(", ")}, the part of a round the sandbox is in`)
      continue
    }
    if (slot !== "p1" && slot !== "p2") {
      problems.push(`${at}: a start has the slots p1 and p2, and a phase`)
      continue
    }
    if (!isObject(value)) {
      problems.push(`${at}: { at?, rows, legend, target? }`)
      continue
    }
    for (const key of Object.keys(value)) if (!["at", "rows", "legend", "target"].includes(key)) problems.push(`${at}.${key}: a start has at, rows, legend and target`)
    const origin = value["at"]
    if (origin !== undefined && (!isObject(origin) || !isWhole(origin["x"]) || !isWhole(origin["y"]))) problems.push(`${at}.at: { x, y }, where the rows' north-west corner stands`)
    const rows = value["rows"]
    const legend = value["legend"]
    if (rows !== undefined && (!Array.isArray(rows) || !rows.every((row) => typeof row === "string"))) problems.push(`${at}.rows: the slot's units as rows of text, one character a tile`)
    if (rows !== undefined && legend === undefined) problems.push(`${at}.legend: what each character of the rows places`)
    if (legend !== undefined) {
      if (!isObject(legend)) problems.push(`${at}.legend: { "<character>": { content, hp? } }`)
      else {
        for (const [symbol, entry] of Object.entries(legend)) {
          if ([...symbol].length !== 1) problems.push(`${at}.legend."${symbol}": a legend names one character`)
          if (!isObject(entry) || typeof entry["content"] !== "string" || (entry["hp"] !== undefined && !isWhole(entry["hp"]))) {
            problems.push(`${at}.legend."${symbol}": { content, hp? }, a content id and its starting health`)
          }
        }
      }
    }
    const target = value["target"]
    if (target !== undefined && (!isObject(target) || !["x", "y", "width", "height"].every((key) => isWhole(target[key])))) {
      problems.push(`${at}.target: { x, y, width, height }, where its troops head`)
    }
  }
  return problems
}

/** A map's rows and legend, whether the save names a built-in map or draws one. */
function groundOf(map: string | SaveMap): Readonly<{ id: string; name: string; rows: readonly string[]; legend: Readonly<Record<string, TerrainId>> }> {
  if (typeof map !== "string") return { id: map.id, name: map.name ?? map.id, rows: map.rows, legend: map.legend ?? MAP_LEGEND }
  const known = BATTLE_MAPS[map]
  if (known === undefined) throw new Error(`no map "${map}"`)
  return { id: known.id, name: known.name, rows: known.rows, legend: MAP_LEGEND }
}

/**
 * The opening a sandbox starts its Battle Round from: its map's ground, each slot's start as the side it plays
 * (`p1` is A, `p2` is B), its seed and its round's ticks. Opened by `openBattle` (`src/skirmish/opening/open.ts`),
 * which checks that every unit fits the ground. Throws for a save with no `start`.
 */
export function openingOf(save: SaveFile): BattleOpening {
  const start = save.start
  if (start === undefined) throw new Error("this save has no start: it opens on a Build Phase, played by the battle")
  const ground = groundOf(save.setup.map)
  const placements: Partial<Record<PlayerId, PlacementBlock>> = {}
  const targets: Partial<Record<PlayerId, TargetArea>> = {}
  for (const slot of ["p1", "p2"] as const) {
    const given = start[slot]
    if (given === undefined) continue
    const side = SIDE[slot]
    if (given.rows !== undefined) {
      placements[side] = { ...(given.at === undefined ? {} : { at: given.at }), rows: given.rows, legend: given.legend ?? {} }
    }
    if (given.target !== undefined) targets[side] = given.target
  }
  const notes = save.notes ?? (typeof save.setup.map === "string" ? undefined : save.setup.map.notes)
  return {
    id: ground.id,
    name: save.name ?? ground.name,
    ...(notes === undefined ? {} : { notes }),
    grid: { width: ground.rows[0]?.length ?? 0, height: ground.rows.length },
    seed: save.setup.seed,
    pulseTicks: save.setup.roundTicks,
    terrain: ground.rows,
    terrainLegend: ground.legend,
    placements,
    ...(Object.keys(targets).length === 0 ? {} : { targets }),
    ...(start.phase === undefined ? {} : { phase: start.phase }),
  }
}
