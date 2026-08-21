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

  placements: [
    "                        ",
    "                        ",
    "                        ",
    "      t     v v         ",
    "      t                 ",
    "      t     v v         ",
    "      t    x            ",
    "      t     v v         ",
    "      t                 ",
    "            v v         ",
    "                        ",
    "                        ",
  ],
  placementLegend: {
    t: { player: "A", content: "unit.citizen.trooper" },
    x: { player: "B", content: "unit.ravel.runner" },
    v: { player: "B", content: "unit.ravel.fuelwagon" },
  },
})
