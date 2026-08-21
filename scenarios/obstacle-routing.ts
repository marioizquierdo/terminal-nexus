import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "obstacle-routing",
  name: "Obstacle routing - around a rock spine",
  notes: "A greedy step with a deterministic sidestep is the routing floor for Gate 1A. A trooper facing a six-tile rock spine slides along its face until a step that closes distance opens up, and rounds it. The goal is a static structure so the fixture measures routing rather than two movers orbiting each other.",

  grid: { preset: "small-wide" },
  seed: 0x0000A007,
  pulseTicks: 360,

  terrain: [
    "........................",
    "........................",
    "........................",
    "............#...........",
    "............#...........",
    "............#...........",
    "............#...........",
    "............#...........",
    "............#...........",
    "........................",
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
    "                        ",
    "                        ",
    "                  B     ",
    "      t                 ",
    "                        ",
    "                        ",
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
