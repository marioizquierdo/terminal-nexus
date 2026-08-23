import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "citizen-mirror-skirmish",
  name: "Citizen mirror — open field",
  notes:
    "Two matched squads across open ground. The baseline everything else compares to. The Grid is symmetric about its vertical centre line and the check is arithmetic, not visual: on a 24-wide Grid the mirror of column 4 is column 19, so the two rock pairs sit at 4-5 and 18-19 and the two squads at column 2 and column 21. It was not a mirror until 2026-08-22 - the eastern rocks were at 20-21, which is where four of B's seven units stood, entombed inside impassable terrain from tick zero. The loader now refuses that placement outright.",

  grid: { preset: "small-wide" }, // 24 x 12, fits the viewport with no scrolling
  seed: 0x5eed0001,
  pulseTicks: 240, // 20 simulation seconds at 12 ticks/s

  // One character per tile. Dimensions must match the grid. Rows read north to south.
  terrain: [
    "........................",
    "........................",
    "....##........##........",
    "....##........##........",
    "........................",
    "..........*..*..........",
    "..........*..*..........",
    "........................",
    "....##........##........",
    "....##........##........",
    "........................",
    "........................",
  ],
  terrainLegend: {
    ".": "terrain.plain",
    "#": "terrain.rock", // impassable, not attackable
    "*": "terrain.deposit",
  },

  // Second overlay, same dimensions. Space means nothing here.
  placements: [
    "                        ",
    "  m                  M  ",
    "  m                  M  ",
    "  r                  R  ",
    "  w                  W  ",
    "                        ",
    "                        ",
    "                        ",
    "  w                  W  ",
    "  r                  R  ",
    "  m                  M  ",
    "                        ",
  ],
  placementLegend: {
    m: { player: "A", content: "unit.citizen.trooper" },
    r: { player: "A", content: "unit.citizen.marksman" },
    w: { player: "A", content: "unit.citizen.worker" },
    M: { player: "B", content: "unit.citizen.trooper" },
    R: { player: "B", content: "unit.citizen.marksman" },
    W: { player: "B", content: "unit.citizen.worker" },
  },
})
