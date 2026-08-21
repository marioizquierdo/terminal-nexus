import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "share-tile-worker-unit",
  name: "Shared tile - a worker and a unit overlap",
  notes: "Collision is a mask composed from chosen layers, not a rule about layers. A trooper collides with obstacles and units but not with workers, so it walks straight over its own side's worker and the two share a tile.",

  grid: { preset: "small-wide" },
  seed: 0x0000A00D,
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
    "                        ",
    "                        ",
    "  t   w             T   ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
  ],
  placementLegend: {
    t: { player: "A", content: "unit.citizen.trooper" },
    w: { player: "A", content: "unit.citizen.worker" },
    T: { player: "B", content: "unit.citizen.trooper" },
  },
})
