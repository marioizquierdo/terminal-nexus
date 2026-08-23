import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "structure-destruction",
  name: "Structure destruction - a Grid Nexus falls",
  notes: "Four troopers and a marksman bring down a 3x2 Grid Nexus. A multi-tile structure is damaged and destroyed as one entity, range measures to its nearest occupied tile, and destroying it ends the Pulse.",

  grid: { preset: "small-wide" },
  seed: 0x0000A008,
  pulseTicks: 480,

  terrain: [
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
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
      at: { x: 3, y: 3 },
      rows: [
        "t",
        "t",
        "r",
        "t",
        "t",
      ],
      legend: {
        t: { content: "unit.citizen.trooper" },
        r: { content: "unit.citizen.marksman" },
      },
    },
    B: {
      at: { x: 19, y: 5 },
      rows: [
        "n",
      ],
      legend: {
        n: { content: "structure.citizen.nexus" },
      },
    },
  },
})
