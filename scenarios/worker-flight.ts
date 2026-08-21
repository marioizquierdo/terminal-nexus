import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "worker-flight",
  name: "Worker flight - a worker runs from a marksman",
  notes: "A hostile attacker inside range + 2 sends the worker away from it. With no friendly Grid Nexus on the Grid it flees directly away from the nearest threat (Q13), outruns a slower marksman, and is finally cornered against the east edge.",

  grid: { preset: "small-wide" },
  seed: 0x0000A004,
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

  placements: [
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "  r   W                 ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
  ],
  placementLegend: {
    r: { player: "A", content: "unit.citizen.marksman" },
    W: { player: "B", content: "unit.citizen.worker" },
  },
})
