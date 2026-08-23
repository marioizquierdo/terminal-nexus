import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "obstacle-routing",
  name: "Obstacle routing - around a rock spine",
  notes: "A greedy step with a deterministic sidestep is the routing floor for Gate 1A. A trooper facing a six-tile rock spine slides along its face until a step that closes distance opens up, and rounds it. The goal is a static structure so the fixture measures routing rather than two movers orbiting each other. Revised after Milestone 1 playtesting: under Manhattan distance every step changes distance by exactly +/-1, never 0, so the old 'sidestep that holds distance level' no longer exists - a mover square-on the goal's row (or column) has exactly one improving direction, and if a wall takes it there is no fallback, ever (specs/open-questions.md Q15). The barracks now sits south of the spine's row range instead of sharing the trooper's row, so the approach stays genuinely off-axis (both east and south improve) until the trooper clears the spine's south end and can go straight to the door.",

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

  placements: {
    A: {
      at: { x: 6, y: 5 },
      rows: [
        "t",
      ],
      legend: {
        t: { content: "unit.citizen.trooper" },
      },
    },
    B: {
      at: { x: 19, y: 9 },
      rows: [
        "b",
      ],
      legend: {
        b: { content: "structure.citizen.barracks" },
      },
    },
  },
})
