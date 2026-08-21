import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "tick-limit-draw",
  name: "Tick-limit draw - a wall neither can cross",
  notes: "An unbroken rock wall divides the Grid. Neither trooper can reach the other, both are reported stuck, and the Pulse ends on its tick count as a draw.",

  grid: { preset: "small-wide" },
  seed: 0x0000A00B,
  pulseTicks: 120,

  terrain: [
    "............#...........",
    "............#...........",
    "............#...........",
    "............#...........",
    "............#...........",
    "............#...........",
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
    "                        ",
    "                        ",
    "  t                 T   ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
  ],
  placementLegend: {
    t: { player: "A", content: "unit.citizen.trooper" },
    T: { player: "B", content: "unit.citizen.trooper" },
  },
})
