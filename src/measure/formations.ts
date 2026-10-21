// Formations (the pathfinding milestone, step 16H): the owner's test of units walking out over the roofs — "the real
// test is playing a simulated game and checking if it is possible to make good unit formations that can foster
// interesting strategies". Each side builds four Barracks one of three ways in front of its Grid Nexus, on an open
// field, and its troopers come off the roofs and march on the other's Nexus; how tight each army stands when it first
// meets the enemy, and who wins, over many seeds. And each shape against a blast: the other side the same shape with
// two siege crawlers among its troopers, whose shots hit an area.
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

/** A side as a shape: its Nexus at its end of the middle row, its four Barracks before it, and with `blast`, two siege
 *  crawlers in front of them. */
function sideOf(side: PlayerId, shape: Shape, blast: boolean): PlacementBlock {
  const footprintOf = (id: string) => REGISTRIES.route.get(id).footprint
  const entries: { at: Coord; content: string }[] = [{ at: centreTile(mirrored(side, { x: 2, y: 13 }, 3), footprintOf(NEXUS)), content: NEXUS }]
  for (const anchor of WEST[shape]) entries.push({ at: centreTile(mirrored(side, anchor, BODY.width), footprintOf(BARRACKS)), content: BARRACKS })
  if (blast) {
    for (const anchor of [{ x: 22, y: 11 }, { x: 22, y: 16 }]) entries.push({ at: centreTile(mirrored(side, anchor, 2), footprintOf(CRAWLER)), content: CRAWLER })
  }
  return placements(entries)
}

/** The battle of `west`'s shape against `east`'s, the east side given the blast when `blast` is true. */
export function formationScenario(west: Shape, east: Shape, blast = false): ScenarioDefinition {
  return {
    id: `formation-${west}-against-${east}${blast ? "-with-a-blast" : ""}`,
    name: `${west} against ${east}${blast ? " with a blast" : ""}`,
    grid: { width: WIDTH, height: HEIGHT },
    seed: 1,
    pulseTicks: 1800,
    terrain: Array.from({ length: HEIGHT }, () => ".".repeat(WIDTH)),
    terrainLegend: { ".": "terrain.plain" },
    placements: { A: sideOf("A", west, false), B: sideOf("B", east, blast) },
  }
}

/** One formation battle on one seed. */
export type FormationBattle = Readonly<{ west: Shape; east: Shape; blast: boolean; seed: number; battle: BattleRecord }>

/** Every shape against every shape, from both ends, and every shape against itself with a blast, on each seed, the
 *  units leaving the roofs by `exit`. */
export function measureFormations(seeds: readonly number[], exit: RoofExit = "route"): FormationBattle[] {
  const battles: FormationBattle[] = []
  for (const blast of [false, true]) {
    for (const west of SHAPES) {
      for (const east of blast ? [west] : SHAPES) {
        const scenario = formationScenario(west, east, blast)
        for (const seed of seeds) battles.push({ west, east, blast, seed, battle: measureScenario(scenario, seed, REGISTRIES[exit]).battle })
      }
    }
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
    for (const { west, east, blast, battle } of battles) {
      if (blast) continue
      if (west === shape && battle.sides.A.spreadAtContact !== null) spreads.push(battle.sides.A.spreadAtContact)
      if (east === shape && battle.sides.B.spreadAtContact !== null) spreads.push(battle.sides.B.spreadAtContact)
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
      for (const { west, east, blast, battle } of battles) {
        if (blast) continue
        const firstSide: PlayerId | null = west === first && east === second ? "A" : west === second && east === first ? "B" : null
        if (firstSide === null || (first === second && firstSide === "B")) continue
        if (battle.winner === null) neither += 1
        else if (first === second) battle.winner === "A" ? (a += 1) : (b += 1)
        else battle.winner === firstSide ? (a += 1) : (b += 1)
      }
      lines.push(`  ${first} against ${second}: ${a} to ${b}${neither > 0 ? `, ${neither} drawn` : ""}${first === second ? " (west to east)" : ""}`)
    }
  }
  lines.push("", "Against a blast (the same shape across, with two siege crawlers whose shots hit an area): troopers lost, wins:")
  for (const shape of SHAPES) {
    const mine = battles.filter((entry) => entry.blast && entry.west === shape)
    const lost = mine.map((entry) => entry.battle.sides.A.lost)
    const wins = mine.filter((entry) => entry.battle.winner === "A").length
    lines.push(`  ${shape.padEnd(6)} lost ${mean(lost)} of ${mean(mine.map((entry) => entry.battle.sides.A.fielded))}, won ${wins} of ${mine.length}`)
  }
  return lines
}
