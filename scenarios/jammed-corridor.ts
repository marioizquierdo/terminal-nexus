import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "jammed-corridor",
  name: "Jammed corridor - arbitration under contention",
  notes:
    "Three approach lines - west, north, south - converge on one tile at a T-junction, three deep on each line so the contest recurs rather than resolving once. Revised after Milestone 1 playtesting: removing diagonal movement means a mover can no longer cut a corner past a wall's corner, so the previous single-gap geometry stopped producing genuine three-way ties - the approach that used to jam now files through in single steps. The bait is a lone worker rather than a multi-row structure, so every approach line's nearest-tile target is the same single point and the tie is unambiguous.",

  grid: { preset: "small-wide" },
  seed: 0x0000a00c,
  pulseTicks: 480,

  terrain: [
    "........................",
    "..........#.............",
    "...........#............",
    "...........#............",
    "...........#............",
    "........................",
    "...........#............",
    "...........#............",
    "...........#............",
    "..........#.............",
    "........................",
    "........................",
  ],
  terrainLegend: {
    ".": "terrain.plain",
    "#": "terrain.rock",
    "*": "terrain.deposit",
  },

  placements: [
    "                        ",
    "                        ",
    "          t             ",
    "          t             ",
    "          t             ",
    "       ttt          W   ",
    "          t             ",
    "          t             ",
    "          t             ",
    "                        ",
    "                        ",
    "                        ",
  ],
  placementLegend: {
    t: { player: "A", content: "unit.citizen.trooper" },
    W: { player: "B", content: "unit.citizen.worker" },
  },
})
