import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "on-axis-deadlock",
  name: "On-axis deadlock - two units stop nose to nose across a rock",
  notes:
    "The failure the owner saw in the 2026-08-22 playtest, isolated so it is one line of log instead of a needle in a 720-tick run. A trooper and a runner sit on the same row with a two-tile rock between them. Each one's only distance-closing direction is straight into the rock, so under the greedy step of milestone-1-spike-battle.md 3.7 neither has a fallback and both stop forever - even though a route exists, one tile north, costing two extra steps. This is not the unreachable-goal case hauler-two-tile-gap covers, and it is not the sliding case obstacle-routing covers: the goal is reachable and the router simply cannot see it, because no step that increases distance is ever a candidate. Closing it needs real routing, which is Milestone 2's (specs/open-questions.md Q15). Until then this fixture is the regression test that says the gap is still exactly this shape and no wider, and the thing to run first when routing lands.",

  grid: { preset: "small-wide" },
  seed: 0x0000a008,
  pulseTicks: 240,

  terrain: [
    "........................",
    "........................",
    "........................",
    "........................",
    "..........##............",
    "..........##............",
    "..........##............",
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
    "         t  x           ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
  ],
  placementLegend: {
    t: { player: "A", content: "unit.citizen.trooper" },
    x: { player: "B", content: "unit.ravel.runner" },
  },
})
