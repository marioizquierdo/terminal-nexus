// The maps a level can name, by id — the small map table a campaign's levels point into (`map: "starter"` in
// `armies/vasse/army.json`) — and the two maps there are: the Build Phase's starter map, a Grid big enough that
// scrolling is unavoidable, with two structures already standing on it; and open ground, the Ground test's
// plain field, where two raids start the same distance from the Nexus on screen.
//
// Still code, not data: a map in an army is a later step. It lives here rather than beside the menu it is
// shown with (`./catalog.ts`, which re-exports it) because the armies name it and that menu is built from the
// armies: one file holding both would be a circular import.

import type { Coord, GridTerrain, TerrainId } from "../grid/types.ts"
import type { MapEdgeStyle, StandingStructure } from "./types.ts"

/**
 * 96 x 40 tiles — larger than the **maximum** viewport (72 x 24) on both axes, deliberately. A Grid
 * merely larger than the minimum viewport would stop scrolling the moment somebody opened a big
 * terminal, and the whole question this map asks is what scrolling feels like.
 */
export const STARTER_GRID_SIZE = { width: 96, height: 40 } as const

/** Where the cursor opens: on the Grid Nexus, its centre tile (the owner: "on
 *  top of the nexus by default"), so the first thing a player sees is their own base, everything else
 *  is somewhere to scroll to, and the first building armed lands on the nearest good spot beside it.
 *  `nexusTile(starterContext())` says the same; a test holds the two together. */
export const STARTER_START_CURSOR = { x: 18, y: 10 } as const

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
 * Built by a function rather than checked in as a `.map.json` scenario: a scenario file is
 * simulation input and the determinism suite replays every one of them twenty times. This Grid never
 * reaches the kernel. Deterministic all the same — no randomness, no clock, the same tiles each run.
 */
export function starterGrid(): GridTerrain {
  const { width, height } = STARTER_GRID_SIZE
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

/**
 * This map's own border (the owner: "I wonder if the map can define different borders to give it
 * personality"): a dashed heavy line, a wire fence round a military perimeter — PERIMETER's register
 * is "plain, military, correct". Drawn wherever the Grid reaches the map's edge. A proof of the hook,
 * not map design: a real map would carry this in its own definition, beside its tiles.
 */
export const STARTER_EDGE_STYLE: MapEdgeStyle = "fence"

/** Already standing when the screen opens: something to build next to, and something a careless
 *  placement can overlap and be refused for. */
export const STARTER_STANDING: readonly StandingStructure[] = [
  { contentId: "structure.citizen.nexus", anchor: { x: 17, y: 10 } },
  { contentId: "structure.citizen.barracks", anchor: { x: 25, y: 10 } },
]

/** A map a level is played on: its Grid, built fresh each time it is asked for; what already stands on it; its
 *  edge; and where the Build Phase's cursor opens on it. */
export type MapDefinition = Readonly<{
  grid: () => GridTerrain
  standing: readonly StandingStructure[]
  edgeStyle: MapEdgeStyle
  startCursor: Coord
}>

/** The starter map, whole. */
export const STARTER_MAP: MapDefinition = {
  grid: starterGrid,
  standing: STARTER_STANDING,
  edgeStyle: STARTER_EDGE_STYLE,
  startCursor: STARTER_START_CURSOR,
}

// --- Open ground: the Ground test's map ------------------------------------------------------------
//
// The Ground Experiment (the Commander round 6) asks how a reach and a walk should look when a terminal cell is
// about twice as tall as it is wide. Its test level (`ground-test`, `armies/vasse/army.json`) puts two raids the
// same distance from the Nexus on screen — one 12 rows above its top edge, one 24 columns past its right edge —
// and asks which arrives first. So this ground is open: plain, a few rocks as landmarks well off both ways in,
// and nothing between either raid and the base. The owner: "the map is not important, we will make new maps
// later. What matters is how intuitive it feels."
//
// **60 x 18 tiles**: wider than the view at 80 x 24 (49 x 18 tiles), so it scrolls a little across, and exactly
// as tall, so at the floor every row of it is on screen at once. That is on purpose. A battle's camera centres on
// the Nexus, and a view 18 rows tall shows only 8 of them above it: on a taller map the northern raid would start
// off the screen and walk into it, and the race would be watched from its middle. Here the camera has no room to
// move up or down, so both raids, the Nexus and the ground between them are in view from the Build Phase's first
// frame to the battle's last — under every Ground choice that draws a tile one column wide. (Square tiles draw it
// two: the eastern raid then really is twice as far on screen, and walks in from the right.)

/** The open ground's size, in tiles: 60 across, and the 18 rows the view has at 80 x 24. */
export const OPEN_GROUND_SIZE = { width: 60, height: 18 } as const

/**
 * The Grid Nexus's anchor on open ground: its three columns 17 to 19, its two rows 15 and 16. Low on the map, so
 * the 12 rows above it hold the northern raid with two rows to spare above it, and far enough west that the
 * eastern raid, 24 columns past its right edge, still stands inside the view at 80 x 24.
 */
const OPEN_GROUND_NEXUS: Coord = { x: 17, y: 15 }

/** Landmarks, not obstacles: none stands on the ground straight north of the Nexus or straight east of it, nor
 *  where the player can build, so a rock never decides which raid arrives first. */
const OPEN_GROUND_ROCKS: readonly Rect[] = [
  { x: 4, y: 4, width: 5, height: 1 }, // a low wall in the north-west
  { x: 7, y: 9, width: 2, height: 2 }, // a pillar west of the way down from the north
  { x: 29, y: 5, width: 2, height: 2 }, // a pillar between the two ways in, out of both
  { x: 51, y: 3, width: 3, height: 2 }, // the far north-east, past where the eastern raid starts
  { x: 55, y: 12, width: 2, height: 3 }, // behind the eastern raid
  { x: 2, y: 13, width: 2, height: 2 }, // the far west, beyond the Barracks
]

/** Open ground's tiles: plain, and its few rocks. Built fresh each time, deterministically, like the starter
 *  map's — no randomness, no clock. */
export function openGroundGrid(): GridTerrain {
  const { width, height } = OPEN_GROUND_SIZE
  const tiles: TerrainId[] = new Array<TerrainId>(width * height).fill("terrain.plain")
  for (const rect of OPEN_GROUND_ROCKS) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) tiles[y * width + x] = "terrain.rock"
    }
  }
  return { width, height, tiles }
}

/** Standing when the level opens: the Grid Nexus, and a Barracks well west of it — away from both ways in, so
 *  neither raid is nearer to it than to the Nexus, and its troopers come out five seconds into every round. */
export const OPEN_GROUND_STANDING: readonly StandingStructure[] = [
  { contentId: "structure.citizen.nexus", anchor: OPEN_GROUND_NEXUS },
  { contentId: "structure.citizen.barracks", anchor: { x: 9, y: 15 } },
]

/** Open ground, whole: a plain solid edge, and the cursor on the Nexus's centre tile, as on the starter map. */
export const OPEN_GROUND_MAP: MapDefinition = {
  grid: openGroundGrid,
  standing: OPEN_GROUND_STANDING,
  edgeStyle: "solid",
  startCursor: { x: OPEN_GROUND_NEXUS.x + 1, y: OPEN_GROUND_NEXUS.y },
}

/** Every map a level can name, by the name it uses. */
export const MAPS: Readonly<Record<string, MapDefinition>> = { starter: STARTER_MAP, "open-ground": OPEN_GROUND_MAP }
