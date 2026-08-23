import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "ravel-cascade",
  name: "Ravel cascade - everything is fuel",
  notes:
    "The Ravel signature moment, isolated: one chain of detonating fuel wagons deletes a line - or their own. A Citizen line kills the nearest wagon, its blast reaches the next, and the cascade runs until it runs out of fuel. Chains are bounded because an entity can only die once, so the whole cascade resolves inside the tick that started it.",

  grid: { preset: "small-wide" },
  seed: 0x0000B002,
  pulseTicks: 240,

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
      at: { x: 6, y: 3 },
      rows: [
        "t",
        "t",
        "t",
        "t",
        "t",
        "t",
      ],
      legend: {
        t: { content: "unit.citizen.trooper" },
      },
    },
    B: {
      at: { x: 11, y: 3 },
      rows: [
        " v v",
        "",
        " v v",
        "x",
        " v v",
        "",
        " v v",
      ],
      legend: {
        v: { content: "unit.ravel.fuelwagon" },
        x: { content: "unit.ravel.runner" },
      },
    },
  },
})
