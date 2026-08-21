import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "mutual-kill",
  name: "Mutual kill - two equal troopers, one tick",
  notes: "Two troopers of the same speed tier start adjacent and trade until both reach zero on the same tick. Both die: attacks in a tier are computed against the state at tier start, so neither survives by being iterated first.",

  grid: { preset: "small-wide" },
  seed: 0x0000A003,
  pulseTicks: 120,

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
    "          tT            ",
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
