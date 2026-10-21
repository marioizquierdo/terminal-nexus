// Formations (the pathfinding milestone, step 16H): the owner's test of units walking out over the roofs — "the real
// test is playing a simulated game and checking if it is possible to make good unit formations that can foster
// interesting strategies". Each side builds four Barracks one of three ways in front of its Grid Nexus, on an open
// field, and its troopers come off the roofs and march on the other's Nexus; how tight each army stands when it first
// meets the enemy, and who wins, over many seeds. And each shape against area damage (the owner, 2026-10-21: "let's
// start testing area of damage versus clamping"): the same shape across with a support whose attacks hit an area —
// two siege crawlers, two Citizen mortars whose shells leave the ground burning, or four Ravel bombers that run into
// the thickest knot and burst — and the support alone, standing before the other side's Nexus as its whole defence.
//
// Pure, like every measurement here: the same shapes and seeds measure the same on every machine.

import type { ContentRegistry } from "../content/index.ts"
import { FIXTURE_REGISTRY, withProduction } from "../content/index.ts"
import type { Coord } from "../grid/types.ts"
import { centreTile } from "../match/index.ts"
import type { RoofExit } from "../match/index.ts"
import type { PlacementBlock, ScenarioDefinition } from "../scenario/types.ts"
import type { PlayerId } from "../state/types.ts"
import type { BattleRecord } from "./battle.ts"
import { measureScenario } from "./suites.ts"

/** How a side's four Barracks stand. */
export type Shape = "block" | "apart" | "line"

export const SHAPES: readonly Shape[] = ["block", "apart", "line"]

/** What each shape is, in a few words. */
export const SHAPE_WORDS: Readonly<Record<Shape, string>> = {
  block: "a block of four, two by two, touching",
  apart: "four set apart, a square with room between them",
  line: "a line of four, touching, across the way to the enemy",
}

const WIDTH = 72
const HEIGHT = 28
const BARRACKS = "structure.citizen.barracks"
// The bench's passive Grid Nexus: the formations ask how armies meet each other. Against a Nexus that shoots back (the
// game's own since 2026-10-21) twelve troopers seldom bring it down, and nearly every one of these battles is a draw.
const NEXUS = "structure.bench.nexus"
const CRAWLER = "unit.bench.siegecrawler"

/** What hits an area, set beside a side's own shape or alone before its Nexus. */
export type Support = "crawlers" | "mortars" | "bombers"

export const SUPPORTS: readonly Support[] = ["crawlers", "mortars", "bombers"]

/** What each support is, and where it stands (west-side tiles; the east side's mirror them): the crawlers and the
 *  bombers in front of the Barracks, the mortars behind them, within their long reach of the field. */
const SUPPORT: Readonly<Record<Support, Readonly<{ content: string; at: readonly Coord[]; words: string }>>> = {
  crawlers: { content: CRAWLER, at: [{ x: 22, y: 11 }, { x: 22, y: 16 }], words: "two siege crawlers, whose shots hit everything within two" },
  mortars: { content: "unit.citizen.mortar", at: [{ x: 8, y: 10 }, { x: 8, y: 17 }], words: "two mortars, whose shells leave the ground burning" },
  bombers: { content: "unit.ravel.bomber", at: [{ x: 24, y: 10 }, { x: 24, y: 12 }, { x: 24, y: 15 }, { x: 24, y: 17 }], words: "four bombers, which burst in the thickest knot" },
}

/** What the east side brings in a battle: its own shape, with a support or none; or a support alone before its Nexus. */
export type Opponent = Readonly<{ shape: Shape | null; support: Support | null }>
const TROOPER = "unit.citizen.trooper"
const BODY = { width: 3, height: 2 }

/** The north-west tiles of the west side's four Barracks for a shape; the east side's mirror them. */
const WEST: Readonly<Record<Shape, readonly Coord[]>> = {
  block: [
    { x: 12, y: 12 },
    { x: 15, y: 12 },
    { x: 12, y: 14 },
    { x: 15, y: 14 },
  ],
  apart: [
    { x: 10, y: 6 },
    { x: 18, y: 9 },
    { x: 18, y: 17 },
    { x: 10, y: 20 },
  ],
  line: [
    { x: 14, y: 10 },
    { x: 14, y: 12 },
    { x: 14, y: 14 },
    { x: 14, y: 16 },
  ],
}

/** Every Barracks makes three troopers a wave, two waves a battle: twelve fit what a Grid Nexus gives. */
const RECIPE = { output: TROOPER, perWave: 3, waves: 2, firstTicks: 60, intervalTicks: 120 }

/** The registry the formations are played on: the fixtures, the Barracks making its waves, its units leaving its roof
 *  by `exit` (the "Way off the roof" Experiment). */
export function formationRegistry(exit: RoofExit = "route"): ContentRegistry {
  return withProduction(FIXTURE_REGISTRY, { [BARRACKS]: { ...RECIPE, ...(exit === "ground" ? { exit } : {}) } })
}

const REGISTRIES: Readonly<Record<RoofExit, ContentRegistry>> = { route: formationRegistry("route"), ground: formationRegistry("ground") }

/** A side's own tile for a west-side tile: itself for the west, its mirror across the field for the east. */
function mirrored(side: PlayerId, anchor: Coord, width: number): Coord {
  return side === "A" ? anchor : { x: WIDTH - anchor.x - width, y: anchor.y }
}

/** One side's placement block: each content at the centre tile of where it stands. */
function placements(entries: readonly Readonly<{ at: Coord; content: string }>[]): PlacementBlock {
  const symbols = "abcdefghijklmnopqrstuvwxyz"
  const rows: string[][] = []
  const legend: Record<string, { content: string }> = {}
  entries.forEach(({ at, content }, index) => {
    const symbol = symbols[index] as string
    while (rows.length <= at.y) rows.push([])
    const row = rows[at.y] as string[]
    while (row.length <= at.x) row.push(" ")
    row[at.x] = symbol
    legend[symbol] = { content }
  })
  return { rows: rows.map((row) => row.join("")), legend }
}

/** A side: its Nexus at its end of the middle row, its four Barracks before it in `shape` (none for `null`), and
 *  `support` beside them. */
function sideOf(side: PlayerId, shape: Shape | null, support: Support | null): PlacementBlock {
  const footprintOf = (id: string) => REGISTRIES.route.get(id).footprint
  const entries: { at: Coord; content: string }[] = [{ at: centreTile(mirrored(side, { x: 2, y: 13 }, 3), footprintOf(NEXUS)), content: NEXUS }]
  for (const anchor of shape === null ? [] : WEST[shape]) entries.push({ at: centreTile(mirrored(side, anchor, BODY.width), footprintOf(BARRACKS)), content: BARRACKS })
  if (support !== null) {
    const { content, at } = SUPPORT[support]
    const width = Math.max(...footprintOf(content).map((tile) => tile.x)) + 1
    for (const anchor of at) entries.push({ at: centreTile(mirrored(side, anchor, width), footprintOf(content)), content })
  }
  return placements(entries)
}

/** The east side in a few words, for a scenario's id and name. */
const opponentName = (west: Shape, east: Opponent): string =>
  east.shape === null ? `${west}-against-${east.support}-alone` : `${west}-against-${east.shape}${east.support === null ? "" : `-with-${east.support}`}`

/** The battle of `west`'s shape against `east`: a shape, with a support or none, or a support alone. `true` for the old
 *  blast, the siege crawlers beside the same shape. */
export function formationScenario(west: Shape, east: Shape | Opponent, blast = false): ScenarioDefinition {
  const opponent: Opponent = typeof east === "string" ? { shape: east, support: blast ? "crawlers" : null } : east
  const id = opponentName(west, opponent)
  return {
    id: `formation-${id}`,
    name: id.replaceAll("-", " "),
    grid: { width: WIDTH, height: HEIGHT },
    seed: 1,
    pulseTicks: 1800,
    terrain: Array.from({ length: HEIGHT }, () => ".".repeat(WIDTH)),
    terrainLegend: { ".": "terrain.plain" },
    placements: { A: sideOf("A", west, null), B: sideOf("B", opponent.shape, opponent.support) },
  }
}

/** One formation battle on one seed: the west's shape against the east's opponent. */
export type FormationBattle = Readonly<{ west: Shape; east: Opponent; seed: number; battle: BattleRecord }>

/** Every shape against every shape, from both ends; and every shape against each support alone before the other's
 *  Nexus, whose damage is then the area attack's alone; on each seed, the units leaving the roofs by `exit`. (A support
 *  beside the same shape across measured only that it is more army: every shape lost almost every trooper.) */
export function measureFormations(seeds: readonly number[], exit: RoofExit = "route"): FormationBattle[] {
  const opponents: { west: Shape; east: Opponent }[] = []
  for (const west of SHAPES) for (const east of SHAPES) opponents.push({ west, east: { shape: east, support: null } })
  for (const support of SUPPORTS) for (const west of SHAPES) opponents.push({ west, east: { shape: null, support } })
  const battles: FormationBattle[] = []
  for (const { west, east } of opponents) {
    const scenario = formationScenario(west, east)
    for (const seed of seeds) battles.push({ west, east, seed, battle: measureScenario(scenario, seed, REGISTRIES[exit]).battle })
  }
  return battles
}

/** What a set of formation battles says, in plain words: per shape, how tight it stood at first contact; per pairing,
 *  who won; and against the blast, what each shape lost. */
export function formationLines(battles: readonly FormationBattle[]): string[] {
  const lines: string[] = []
  const mean = (values: readonly number[]): string => (values.length === 0 ? "-" : (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1))
  lines.push("How tight each shape stands when it first meets the enemy (columns from its middle, a row counting two):")
  for (const shape of SHAPES) {
    const spreads: number[] = []
    for (const { west, east, battle } of battles) {
      if (east.support !== null) continue
      if (west === shape && battle.sides.A.spreadAtContact !== null) spreads.push(battle.sides.A.spreadAtContact)
      if (east.shape === shape && battle.sides.B.spreadAtContact !== null) spreads.push(battle.sides.B.spreadAtContact)
    }
    lines.push(`  ${shape.padEnd(6)} ${mean(spreads).padStart(5)}   ${SHAPE_WORDS[shape]}`)
  }
  lines.push("", "Who wins, each shape against each, from both ends (wins of the first, of the second, neither):")
  for (let one = 0; one < SHAPES.length; one += 1) {
    for (let two = one; two < SHAPES.length; two += 1) {
      const first = SHAPES[one] as Shape
      const second = SHAPES[two] as Shape
      let a = 0
      let b = 0
      let neither = 0
      for (const { west, east: opponent, battle } of battles) {
        if (opponent.support !== null) continue
        const east = opponent.shape
        const firstSide: PlayerId | null = west === first && east === second ? "A" : west === second && east === first ? "B" : null
        if (firstSide === null || (first === second && firstSide === "B")) continue
        if (battle.winner === null) neither += 1
        else if (first === second) battle.winner === "A" ? (a += 1) : (b += 1)
        else battle.winner === firstSide ? (a += 1) : (b += 1)
      }
      lines.push(`  ${first} against ${second}: ${a} to ${b}${neither > 0 ? `, ${neither} drawn` : ""}${first === second ? " (west to east)" : ""}`)
    }
  }
  lines.push("", "Against area damage alone, standing before the other side's Nexus: the damage it did, the troopers it killed, and")
  lines.push("how long the Nexus behind it stood (ticks), each shape marching on it:")
  for (const support of SUPPORTS) {
    lines.push(`  ${SUPPORT[support].words}:`)
    for (const shape of SHAPES) {
      const mine = battles.filter((entry) => entry.west === shape && entry.east.support === support && entry.east.shape === null)
      const dealt = mean(mine.map((entry) => entry.battle.sides.B.dealt))
      const lost = mean(mine.map((entry) => entry.battle.sides.A.lost))
      const ticks = mean(mine.map((entry) => entry.battle.ticks))
      const won = mine.filter((entry) => entry.battle.winner === "A").length
      lines.push(`    ${shape.padEnd(6)} took ${dealt.padStart(6)} damage, lost ${lost.padStart(4)} troopers; the Nexus fell at ${ticks}${won < mine.length ? `, taken in ${won} of ${mine.length}` : ""}`)
    }
  }
  return lines
}
