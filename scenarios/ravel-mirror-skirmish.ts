import { defineScenario } from "../src/scenario/index.ts"

export default defineScenario({
  id: "ravel-mirror-skirmish",
  name: "Ravel mirror — open field",
  notes:
    "The Ravel counterpart to citizen-mirror-skirmish.ts - same shape, same purpose: a same-faction mirror match, the case that tests whether ownership colour alone (engine.md's 'ownership keeps the colour' RULE) is enough to tell the two sides apart when glyph family can't help, since both sides use the identical Ravel roster. Built while looking into the owner's mirror-match colour question (specs/open-questions.md). Shares citizen-mirror-skirmish's terrain fix (2026-08-22): the rock pair mirrors at columns 4-5 and 18-19 on a 24-wide Grid, not 4-5 and 20-21, which put B's column-21 units inside impassable rock and the loader now refuses.",

  grid: { preset: "small-wide" },
  seed: 0x5eed0002,
  pulseTicks: 240,

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
    "#": "terrain.rock",
    "*": "terrain.deposit",
  },

  placements: {
    A: {
      at: { x: 2, y: 1 },
      rows: [
        "x",
        "x",
        "z",
        "s",
        "",
        "",
        "",
        "s",
        "z",
        "x",
      ],
      legend: {
        x: { content: "unit.ravel.runner" },
        z: { content: "unit.ravel.slinger" },
        s: { content: "unit.ravel.scav" },
      },
    },
    B: {
      at: { x: 21, y: 1 },
      rows: [
        "x",
        "x",
        "z",
        "s",
        "",
        "",
        "",
        "s",
        "z",
        "x",
      ],
      legend: {
        x: { content: "unit.ravel.runner" },
        z: { content: "unit.ravel.slinger" },
        s: { content: "unit.ravel.scav" },
      },
    },
  },
})
