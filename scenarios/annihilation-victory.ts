import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "annihilation-victory",
  name: "Annihilation - workers count",
  notes: "A side is annihilated when every entity on workers, units and air is dead - workers included (Q13). The defending worker flees into a rock pocket it cannot leave, and the Pulse ends only once it dies too.",

  grid: { preset: "small-wide" },
  seed: 0x0000A00A,
  pulseTicks: 480,

  terrain: [
    "........................",
    "........................",
    "........................",
    "........................",
    "...................####.",
    "......................#.",
    "...................####.",
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
      at: { x: 2, y: 5 },
      rows: [
        "t",
        "r",
      ],
      legend: {
        t: { content: "unit.citizen.trooper" },
        r: { content: "unit.citizen.marksman" },
      },
    },
    B: {
      at: { x: 15, y: 5 },
      rows: [
        "r    w",
      ],
      legend: {
        r: { content: "unit.citizen.marksman" },
        w: { content: "unit.citizen.worker" },
      },
    },
  },
})
