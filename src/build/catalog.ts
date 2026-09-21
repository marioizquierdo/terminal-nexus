// The spike's disposable content: a Grid big enough that scrolling is unavoidable, two structures
// already standing on it, and three things to build.
//
// **None of this is Commander Army authoring.** `AGENTS.md` Section 2 reserves that for Milestone 12,
// and PERIMETER's own construct menu is Milestone 5's gate 5B. These three rows exist because
// placement is only interesting when the footprints differ — 3x2, 2x2 and 1x1 exercise three
// different anchor calculations, three different legality shapes, and three different ways to
// straddle a rock — and they are drawn from the existing fixture rosters rather than invented.

import type { MenuItem } from "../menu/types.ts"
import type { GridTerrain, TerrainId } from "../grid/types.ts"
import type { ConstructItem, StandingStructure } from "./types.ts"

/**
 * 96 x 40 tiles — larger than the **maximum** viewport (72 x 24) on both axes, deliberately. A Grid
 * merely larger than the minimum viewport would stop scrolling the moment somebody opened a big
 * terminal, and the whole question this gate asks is what scrolling feels like.
 */
export const SPIKE_GRID_SIZE = { width: 96, height: 40 } as const

/** Where the cursor opens: just south of the Grid Nexus, so the first thing a player sees is their
 *  own base and everything else is somewhere to scroll to. */
export const SPIKE_START_CURSOR = { x: 18, y: 13 } as const

type Rect = Readonly<{ x: number; y: number; width: number; height: number }>

/** Solid blocks of rock. Landmarks, not noise: scrolling is only legible if the places you scroll to
 *  look different from the place you left. */
const ROCK_RECTS: readonly Rect[] = [
  { x: 8, y: 5, width: 14, height: 1 }, // north-west wall, running east
  { x: 8, y: 5, width: 1, height: 8 }, //  and its corner, running south
  { x: 30, y: 3, width: 10, height: 2 }, // a ridge with a gap in it, which a plan can slip through
  { x: 44, y: 3, width: 10, height: 2 },
  { x: 6, y: 18, width: 2, height: 2 }, // pillars down the west side
  { x: 12, y: 22, width: 2, height: 2 },
  { x: 18, y: 26, width: 2, height: 2 },
  { x: 4, y: 33, width: 20, height: 2 }, // the long south-west wall
  { x: 66, y: 30, width: 6, height: 3 }, // south-east blocks
  { x: 76, y: 34, width: 8, height: 2 },
]

/** The north-east crater: a hollow ring of rock with deposits inside it, reachable only round the
 *  edge — the most distinctive thing on the map, and the furthest from where the cursor starts. */
const CRATER: Rect = { x: 70, y: 4, width: 14, height: 8 }

const DEPOSITS: readonly Readonly<{ x: number; y: number }>[] = [
  { x: 14, y: 12 },
  { x: 15, y: 12 },
  { x: 14, y: 13 },
  { x: 52, y: 8 },
  { x: 53, y: 8 },
  { x: 75, y: 7 },
  { x: 76, y: 7 },
  { x: 77, y: 8 },
  { x: 26, y: 30 },
  { x: 27, y: 30 },
  { x: 26, y: 31 },
  { x: 84, y: 22 },
  { x: 85, y: 22 },
  { x: 85, y: 23 },
]

/**
 * Built by a function rather than checked in as a `.map.json` scenario on purpose: a scenario file
 * is simulation input, and every one of them is replayed twenty times by the determinism suite. This
 * Grid never reaches the kernel — nothing here spends a tick — so making the test suite carry a
 * 96 x 40 fixture would cost real time to prove nothing. Deterministic all the same: no randomness,
 * no clock, the same tiles every run.
 */
export function spikeGrid(): GridTerrain {
  const { width, height } = SPIKE_GRID_SIZE
  const tiles: TerrainId[] = new Array<TerrainId>(width * height).fill("terrain.plain")
  const set = (x: number, y: number, id: TerrainId): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    tiles[y * width + x] = id
  }

  for (const rect of ROCK_RECTS) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) set(x, y, "terrain.rock")
    }
  }

  // The crater's wall only — a hollow ring, so there is somewhere inside it worth reaching.
  for (let x = CRATER.x; x < CRATER.x + CRATER.width; x += 1) {
    set(x, CRATER.y, "terrain.rock")
    set(x, CRATER.y + CRATER.height - 1, "terrain.rock")
  }
  for (let y = CRATER.y; y < CRATER.y + CRATER.height; y += 1) {
    set(CRATER.x, y, "terrain.rock")
    set(CRATER.x + CRATER.width - 1, y, "terrain.rock")
  }

  // A diagonal chain across the middle, which is what a cursor walking east actually has to go
  // round — the one obstacle placed where somebody will meet it rather than where it looks good.
  for (let step = 0; step < 13; step += 1) set(34 + step * 2, 16 + step, "terrain.rock")

  for (const deposit of DEPOSITS) set(deposit.x, deposit.y, "terrain.deposit")

  return { width, height, tiles }
}

/** Already standing when the screen opens: something to build next to, and something a careless
 *  placement can overlap and be refused for. */
export const SPIKE_STANDING: readonly StandingStructure[] = [
  { contentId: "structure.citizen.nexus", anchor: { x: 17, y: 10 } },
  { contentId: "structure.citizen.barracks", anchor: { x: 25, y: 10 } },
]

/** Three footprints, three hotkeys. `label` is exactly what the row shows after its bracketed key,
 *  so the composer and the mouse adapter measure the same row. */
export const SPIKE_CATALOG: readonly ConstructItem[] = [
  { hotkey: "1", contentId: "structure.citizen.barracks", label: "Barracks   3x2" },
  { hotkey: "2", contentId: "structure.bench.hatchery", label: "Hatchery   2x2" },
  { hotkey: "3", contentId: "structure.bench.beamturret", label: "Turret     1x1" },
]

/**
 * The construct menu as menu rows — the same `MenuItem` shape the top-level menu and Settings use,
 * so the list widget's "hotkey, arrows and Enter, or a click" behaviour and `menuIndexAt`'s
 * hit-testing both apply here without a second implementation of either.
 */
export function menuItemsFor(catalog: readonly ConstructItem[]): readonly MenuItem[] {
  return catalog.map((item) => ({ id: item.contentId, hotkey: item.hotkey, label: item.label }))
}
