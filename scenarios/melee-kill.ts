import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "melee-kill",
  name: "Melee kill - two troopers close on one",
  notes: "Two Citizen troopers walk into contact and kill a single defender. The rule: melee is an attempt to enter a tile an enemy holds, and damage inside one speed tier applies simultaneously.",

  grid: { preset: "small-wide" },
  seed: 0x0000A001,
  pulseTicks: 180,

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
    "          t  T          ",
    "          t             ",
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
