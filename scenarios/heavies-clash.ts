import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "heavies-clash",
  name: "Heavies clash - a colossus and a leviathan meet in the open",
  notes:
    "The multi-tile showcase, and the first fixture where the biggest thing on the Grid is a unit rather than a Nexus. A 3x3 Citizen colossus and a 5x2 Ravel leviathan walk at each other across deliberately open ground, each escorted by the small units that used to be the whole roster - so the size difference reads against something familiar. Terrain is sparse on purpose: a five-tile-wide body needs a five-tile-wide gap, and the greedy routing floor of milestone-1-spike-battle.md 3.7 has no answer for a corridor narrower than the thing walking down it (specs/open-questions.md Q15). One damaged trooper starts at 12 of 40 health, which is the placement legend's `hp` doing the thing it exists for - a fixture that opens mid-fight without spending ticks getting there.",

  grid: { preset: "medium-extra-wide" },
  seed: 0x0000c001,
  pulseTicks: 480,

  terrain: [
    "................................................",
    "................................................",
    ".........##...................##................",
    ".........##...................##................",
    "................................................",
    "................................................",
    "..............*..................*..............",
    "..............*..................*..............",
    "................................................",
    "................................................",
    ".........##...................##................",
    ".........##...................##................",
    "................................................",
    "................................................",
    "................................................",
    "................................................",
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
        "m",
        "     t",
        " c",
        "     t",
        "m",
        " d",
      ],
      legend: {
        c: { content: "unit.citizen.colossus" },
        t: { content: "unit.citizen.trooper" },
        m: { content: "unit.citizen.marksman" },
        // The same trooper, opening the Pulse already most of the way dead.
        d: { content: "unit.citizen.trooper", hp: 12 },
      },
    },
    B: {
      at: { x: 39, y: 3 },
      rows: [
        "       z",
        "     x",
        "l",
        "     x",
        "       z",
        "     v",
      ],
      legend: {
        l: { content: "unit.ravel.leviathan" },
        x: { content: "unit.ravel.runner" },
        z: { content: "unit.ravel.slinger" },
        v: { content: "unit.ravel.fuelwagon" },
      },
    },
  },
})
