// The Build Phase's placeholder content: a Grid big enough that scrolling is unavoidable, two
// structures already standing on it, and three things to build.
//
// **None of this is Commander Army authoring** — `AGENTS.md` Section 2 reserves that for Milestone
// 12. The three rows differ in footprint (3x2, 2x2, 1x1) so that placement exercises three anchor
// calculations, three legality shapes and three ways to straddle a rock, and they are drawn from
// the existing fixture rosters rather than invented.

import type { GridTerrain, TerrainId } from "../grid/types.ts"
import type { Force, PulseSetup } from "../match/types.ts"
import type { CrewSize, RaidSize } from "./experiments.ts"
import type { ConstructItem, MapEdgeStyle, NexusPowerOption, StandingStructure } from "./types.ts"

/**
 * 96 x 40 tiles — larger than the **maximum** viewport (72 x 24) on both axes, deliberately. A Grid
 * merely larger than the minimum viewport would stop scrolling the moment somebody opened a big
 * terminal, and the whole question this gate asks is what scrolling feels like.
 */
export const SPIKE_GRID_SIZE = { width: 96, height: 40 } as const

/** Where the cursor opens: on the Grid Nexus, its centre tile (owner, 2026-09-29, feedback F30: "on
 *  top of the nexus by default"), so the first thing a player sees is their own base, everything else
 *  is somewhere to scroll to, and the first building armed lands on the nearest good spot beside it.
 *  `nexusTile(spikeContext())` says the same; a test holds the two together. */
export const SPIKE_START_CURSOR = { x: 18, y: 10 } as const

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

/**
 * This map's own border (feedback F25: "I wonder if the map can define different borders to give it
 * personality"): a dashed heavy line, a wire fence round a military perimeter — PERIMETER's register
 * is "plain, military, correct". Drawn wherever the Grid reaches the map's edge. A proof of the hook,
 * not map design: a real map would carry this in its own definition, beside its tiles.
 */
export const SPIKE_EDGE_STYLE: MapEdgeStyle = "fence"

/** Already standing when the screen opens: something to build next to, and something a careless
 *  placement can overlap and be refused for. */
export const SPIKE_STANDING: readonly StandingStructure[] = [
  { contentId: "structure.citizen.nexus", anchor: { x: 17, y: 10 } },
  { contentId: "structure.citizen.barracks", anchor: { x: 25, y: 10 } },
]

/**
 * What the Build Phase can spend its allotment on. Three footprints, three costs, three one-line
 * reasons to pick one over another.
 *
 * The costs are round numbers chosen so the allotment buys a few things and not everything — a
 * budget that affords the whole menu is not a budget. They are not balance; `AGENTS.md` Section 2
 * reserves real costs for Milestone 12.
 *
 * Nothing here is army-specific, which is PERIMETER's answer rather than an omission: its menu draws
 * entirely from the Citizen common tier, and the Nexus draft holds the army-specific choice
 * (milestone-02-campaign-design.md Section 4.2).
 */
export const SPIKE_CATALOG: readonly ConstructItem[] = [
  {
    hotkey: "1",
    contentId: "structure.citizen.barracks",
    label: "Barracks",
    cost: 40,
    effect: "Trains troopers each Pulse",
  },
  {
    hotkey: "2",
    contentId: "structure.bench.hatchery",
    label: "Hatchery",
    cost: 30,
    effect: "Spawns swarmers, slowly",
  },
  {
    hotkey: "3",
    contentId: "structure.bench.beamturret",
    label: "Turret",
    cost: 15,
    effect: "Shoots what comes close",
  },
]

/**
 * What the player has to spend. The whole catalog costs 85 and a second barracks takes the total
 * past this, so the menu is a choice. How a resource is *earned* is Milestone 7's; this is an
 * opening allotment and nothing more.
 */
export const SPIKE_ALLOTMENT = 100

/**
 * The Nexus draft this gate proves the mechanism against. Two placeholder options, not a real
 * choice: each is a plain number, so the difference a pick makes is checkable without needing
 * Milestone 8's actual Commander Vasse content to exist first.
 */
export const SPIKE_NEXUS_DRAFT: readonly NexusPowerOption[] = [
  // Each description fits the 28 glyphs a panel row has at the 80-column floor — the longer
  // "starting allotment" wording was cut off mid-word there.
  {
    hotkey: "1",
    name: "Reserve Fund",
    description: "Adds 30 resource to spend.",
    bonusAllotment: 30,
  },
  {
    hotkey: "2",
    name: "War Chest",
    // 2000, not a balanced number (owner, 2026-09-28, feedback F24): enough to place buildings freely
    // while playtesting placement. Placeholder content, like the whole draft.
    description: "Adds 2000 resource to spend.",
    bonusAllotment: 2000,
  },
]

/** The placeholder Nexus Pulse's gameplay seed — "PULS" — and its length: 360 ticks, thirty seconds, the
 *  tick limit a raid that never arrives, or never finishes, runs into. */
export const SPIKE_PULSE_SEED = 0x50554c53
export const SPIKE_PULSE_TICKS = 360

/** Where the player's own units begin the Pulse — just east of the Nexus, toward where the raid comes
 *  from — and where the raid does: the far edge of a Grid view opened on the base. A building committed
 *  on either point moves the units mustered there aside (`src/match/opening.ts`). */
const CREW_MUSTER = { x: 22, y: 10 } as const
const RAID_MUSTER = { x: 46, y: 10 } as const

const TROOPER = "unit.citizen.trooper"
const MARKSMAN = "unit.citizen.marksman"
const RUNNER = "unit.ravel.runner"
const RAIDER = "unit.ravel.raider"

const many = (contentId: string, count: number): string[] => Array.from({ length: count }, () => contentId)

/** The two squads PERIMETER's briefing gives the player ("two squads, one fabricator"). */
const CREW_UNITS: readonly string[] = [...many(TROOPER, 3), ...many(MARKSMAN, 2)]

/**
 * The raids, by size. **Placeholder content, not PERIMETER's waves** — those are gate 6B's — tuned
 * against this map and these buildings so the probe reads as a choice: with nothing built the crew loses,
 * with a single Turret it is a wash, and with two Turrets and a Hatchery the raid is beaten. The heavy raid
 * needs the whole budget. Ravel units, as PERIMETER's briefing names its raiders.
 */
const RAIDS: Readonly<Record<RaidSize, readonly string[]>> = {
  none: [],
  probe: [...many(RUNNER, 4), ...many(RAIDER, 3)],
  heavy: [...many(RUNNER, 6), ...many(RAIDER, 4)],
}

/**
 * The Nexus Pulse the spike starts when the Build Phase is committed: the player's own units beside the
 * Nexus (unless the "Your units" Experiment says none), a raid of the "Raid" Experiment's size at the far
 * edge, one seed, one length. What the player built comes from the plan, not from here.
 */
export function spikePulse(choice: Readonly<{ raid: RaidSize; crew: CrewSize }>): PulseSetup {
  const forces: Force[] = []
  if (choice.crew === "some") forces.push({ player: "A", muster: CREW_MUSTER, units: CREW_UNITS })
  const raid = RAIDS[choice.raid]
  if (raid.length > 0) forces.push({ player: "B", muster: RAID_MUSTER, units: raid })
  return { seed: SPIKE_PULSE_SEED, pulseTicks: SPIKE_PULSE_TICKS, forces }
}
