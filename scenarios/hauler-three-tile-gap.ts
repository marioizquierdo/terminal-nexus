import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "hauler-three-tile-gap",
  name: "Hauler - three-tile gap admits it",
  notes: "The 3x1 hauler is the case that breaks a collision system written for one-tile actors. A mover tests its whole footprint against its mask, so a three-tile opening in a wall is exactly wide enough and it passes through.",

  grid: { preset: "small-wide" },
  seed: 0x0000A005,
  pulseTicks: 240,

  terrain: [
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "##########...###########",
    "........................",
    "........................",
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
      at: { x: 11, y: 2 },
      rows: [
        "h",
      ],
      legend: {
        h: { content: "unit.citizen.hauler" },
      },
    },
    B: {
      at: { x: 11, y: 9 },
      rows: [
        "b",
      ],
      legend: {
        b: { content: "structure.citizen.barracks" },
      },
    },
  },
})
