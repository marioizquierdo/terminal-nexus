import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "ravel-mirror-skirmish",
  name: "Ravel mirror — open field",
  notes:
    "The Ravel counterpart to citizen-mirror-skirmish.ts - same shape, same purpose: a same-faction mirror match, the case that tests whether ownership colour alone (engine.md's 'ownership keeps the colour' RULE) is enough to tell the two sides apart when glyph family can't help, since both sides use the identical Ravel roster. Built while looking into the owner's mirror-match colour question (specs/open-questions.md).",

  grid: { preset: "small-wide" },
  seed: 0x5eed0002,
  pulseTicks: 240,

  terrain: [
    "........................",
    "........................",
    "....##..............##..",
    "....##..............##..",
    "........................",
    "..........*..*..........",
    "..........*..*..........",
    "........................",
    "....##..............##..",
    "....##..............##..",
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
    "  x                  X  ",
    "  x                  X  ",
    "  z                  Z  ",
    "  S                  s  ",
    "                        ",
    "                        ",
    "                        ",
    "  S                  s  ",
    "  z                  Z  ",
    "  x                  X  ",
    "                        ",
  ],
  placementLegend: {
    x: { player: "A", content: "unit.ravel.runner" },
    z: { player: "A", content: "unit.ravel.slinger" },
    S: { player: "A", content: "unit.ravel.scav" },
    X: { player: "B", content: "unit.ravel.runner" },
    Z: { player: "B", content: "unit.ravel.slinger" },
    s: { player: "B", content: "unit.ravel.scav" },
  },
})
