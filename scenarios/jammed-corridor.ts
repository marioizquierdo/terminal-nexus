import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "jammed-corridor",
  name: "Jammed corridor - arbitration under contention",
  notes: "Five troopers funnel into a one-tile corridor and contest the same tile every tick. Claims resolve by speed tier and then by one draw from the seeded stream, under a bounded pass count whose progress measure strictly decreases.",

  grid: { preset: "small-wide" },
  seed: 0x0000A00C,
  pulseTicks: 480,

  terrain: [
    "............#...........",
    "............#...........",
    "............#...........",
    "............#...........",
    "............#...........",
    "........................",
    "............#...........",
    "............#...........",
    "............#...........",
    "............#...........",
    "............#...........",
    "............#...........",
  ],
  terrainLegend: {
    ".": "terrain.plain",
    "#": "terrain.rock",
    "*": "terrain.deposit",
  },

  placements: [
    "                        ",
    "                        ",
    "                        ",
    "    t                   ",
    "    t               B   ",
    "    t                   ",
    "    t                   ",
    "    t                   ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
  ],
  placementLegend: {
    t: { player: "A", content: "unit.citizen.trooper" },
    B: { player: "B", content: "structure.citizen.barracks" },
  },
})
