import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "ranged-kill",
  name: "Ranged kill - two marksmen against one trooper",
  notes: "The fixture arithmetic in milestone 3.6 made visible: two marksmen land six shots during the trooper's approach and it dies before contact. Ranged damage is authoritative at the tick it resolves; the flight window on the event is presentation metadata no rule reads.",

  grid: { preset: "small-wide" },
  seed: 0x0000A002,
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
    "    r           T       ",
    "    r                   ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
  ],
  placementLegend: {
    r: { player: "A", content: "unit.citizen.marksman" },
    T: { player: "B", content: "unit.citizen.trooper" },
  },
})
