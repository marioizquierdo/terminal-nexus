// The duel (src/duel/): two Commander Armies on one map, a round at a time — each side's Nexus Pulse and Build Phase
// planned blind and revealed together, then a Battle Round between them. Here: a duel resolves the same every run, a
// plan is held to the Build Phase's rules, what one side keeps changes its own content and never the other's, two
// buildings on one tile are both refused, a plan is read leniently, the brief says what a player needs, and the file
// protocol plays a round once both plans are in.

import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { main } from "../src/cli/duel.ts"
import type { DuelSetup, DuelState, SidePlan } from "../src/duel/index.ts"
import { briefOf, duelArmy, handOf, loadoutOf, newDuel, playDuel, playRound, readPlan, SCRIPTED } from "../src/duel/index.ts"
import { hashOf } from "../src/state/canonical.ts"

const setup = (extra: Partial<DuelSetup> = {}): DuelSetup => ({ map: "crossing", seed: 3, rounds: 3, pulseTicks: 240, commanders: { A: "vasse", B: "dob" }, ...extra })
const hold: SidePlan = { build: [], stance: "hold" }

test("a duel resolves the same every run: the same setup and plans give the same duel, round by round", () => {
  const players = { A: SCRIPTED.balanced!, B: SCRIPTED.rush! }
  const once = playDuel(setup(), players)
  const twice = playDuel(setup(), players)
  assert.equal(hashOf(once), hashOf(twice))
  assert.ok(once.result !== null && once.history.length >= 1)
  // Another seed deals other hands.
  assert.notDeepEqual(handOf(newDuel(setup({ seed: 4 })), "A").map((card) => card.id), handOf(newDuel(setup()), "A").map((card) => card.id), "two seeds dealt the same hand")
})

test("each side fields its own army: its Commander, its faction's Nexus, its buildings and a starting package", () => {
  const vasse = duelArmy("vasse")
  const dob = duelArmy("dob")
  assert.equal(vasse.nexus, "structure.citizen.nexus")
  assert.equal(dob.nexus, "structure.ravel.nexus")
  assert.ok(vasse.buildings.some((card) => card.id === "barracks") && !vasse.buildings.some((card) => card.id === "den"))
  assert.ok(dob.buildings.some((card) => card.id === "den") && !dob.buildings.some((card) => card.id === "barracks"))
  // War Chest, the owner's testing tool, is never dealt in a duel.
  assert.ok(!vasse.powers.some((card) => card.always === true))
  const { state, report } = playRound(newDuel(setup()), { A: hold, B: hold })
  assert.deepEqual(report.sides.A.fielded, { Trooper: 3, Marksman: 2, Vasse: 1 })
  assert.deepEqual(report.sides.B.fielded, { Runner: 5, Slinger: 2, Dob: 1 })
  // Credits carry over, and the next round adds the curve's: 100, then 120 more.
  assert.equal(state.sides.A.credits, 100 + 120)
})

test("a plan is held to the Build Phase's rules: its menu, its tree, its credits and the legal ground, every refusal said", () => {
  const plan: SidePlan = {
    build: [
      { building: "garrison", at: "forward" },
      { building: "barracks", at: "forward" },
      { building: "den", at: "forward" },
      { building: "barracks", x: 0, y: 0 },
      { building: "barracks", at: "north" },
      { building: "barracks", at: "south" },
    ],
    stance: "hold",
  }
  const { report } = playRound(newDuel(setup()), { A: plan, B: hold })
  const { built, refused, spent } = report.sides.A
  assert.equal(built.length, 2, built.join("; "))
  assert.equal(spent, 80)
  assert.match(refused[0] ?? "", /^garrison: needs Barracks standing as the round opens$/)
  assert.match(refused[1] ?? "", /^den: not a building you can build/)
  assert.match(refused[2] ?? "", /^barracks: outside your build range$/)
  assert.match(refused[3] ?? "", /^barracks: costs 40, 20 left$/)
})

test("what a side keeps changes its own content, never the other side's: Unfiled Ordnance on Averno's troopers alone", () => {
  let state: DuelState = newDuel(setup({ commanders: { A: "averno", B: "vasse" } }))
  // Keep Unfiled Ordnance for A by naming it in A's kept list, as a round would have.
  state = { ...state, sides: { ...state.sides, A: { ...state.sides.A, kept: ["unfiled-ordnance"] } } }
  const a = loadoutOf(duelArmy("averno"), state.sides.A).registry
  const b = loadoutOf(duelArmy("vasse"), state.sides.B).registry
  assert.deepEqual(a.get("unit.citizen.trooper").detonation, { radius: 2, damage: 8 })
  assert.equal(b.get("unit.citizen.trooper").detonation, undefined)
  // In the battle too: only A's troopers burst.
  const { report } = playRound(state, { A: { build: [{ building: "barracks", at: "forward" }], stance: "attack" }, B: { build: [{ building: "barracks", at: "forward" }], stance: "attack" } })
  assert.ok(report.ticks > 0)
})

test("two buildings planned on one tile, one by each side, are both refused and paid back", () => {
  // On the Pocket the two bases' build ranges meet in the middle from the first round: both sides name the same tile.
  const state = newDuel(setup({ map: "pocket", commanders: { A: "vasse", B: "averno" } }))
  const tile = { x: 9, y: 5 }
  const { report } = playRound(state, { A: { build: [{ building: "depot", ...tile }], stance: "hold" }, B: { build: [{ building: "depot", ...tile }], stance: "hold" } })
  for (const side of ["A", "B"] as const) {
    assert.deepEqual(report.sides[side].refused, ["Supply Depot at 9,5: the enemy built there at the same moment, so neither was built"])
    assert.deepEqual([report.sides[side].built, report.sides[side].spent], [[], 0])
  }
  // A tile only one side names is built.
  const alone = playRound(state, { A: { build: [{ building: "depot", ...tile }], stance: "hold" }, B: hold })
  assert.deepEqual(alone.report.sides.A.built, ["depot at 9,5"])
})

test("a plan is read leniently: the first JSON object in the text, a building as a bare name, a bad field dropped and said", () => {
  const read = readPlan('Sure! Here is my plan:\n```json\n{"power": 2, "build": ["barracks", {"building": "depot", "at": "behind"}], "stance": "charge", "note": "go"}\n```')
  assert.deepEqual(read.plan, { power: 2, build: [{ building: "barracks" }, { building: "depot" }], stance: "hold", note: "go" })
  assert.deepEqual(read.problems, ['build 2: "at" should be one of nexus, forward, back, north, south; it goes by its Nexus', '"stance" should be attack or hold; it holds'])
  assert.deepEqual(readPlan("no idea").plan, { build: [], stance: "hold" })
})

test("the brief says what a player needs: the round, the Commander and her skills, the hand, the buildings, the map, the plan's form", () => {
  const brief = briefOf(newDuel(setup({ commanders: { A: "dob", B: "vasse" } })), "A")
  assert.equal(brief.data.side, "A")
  assert.equal(brief.data.hand.length, 3)
  assert.ok(brief.data.buildings.some((building) => building.id === "den" && building.strength > 0))
  assert.ok(brief.data.buildings.some((building) => building.id === "chop-shop" && !building.open))
  for (const words of ["round 1 of 3", "Dob Hunter", "Bounty:", "Loaded Dice:", "## The Nexus Pulse's hand", "chop-shop", "LOCKED", "## The map", '"stance"']) {
    assert.ok(brief.text.includes(words), `the brief does not say ${words}`)
  }
  // The map: his Nexus in lower case on the west, hers in upper case on the east.
  assert.ok(brief.data.map.some((row) => row.includes("/n\\")) && brief.data.map.some((row) => row.includes("[=]")))
})

test("the file protocol: a round plays once both sides have handed in a plan, and each side's next brief is written", () => {
  const dir = mkdtempSync(join(tmpdir(), "duel-"))
  try {
    const lines: string[] = []
    const write = (line: string): void => {
      lines.push(line)
    }
    assert.equal(main(["new", "--dir", dir, "--a", "vasse", "--b", "averno", "--rounds", "2", "--ticks", "120"], write), 0)
    writeFileSync(join(dir, "a.json"), '{"power": 1, "build": [{"building": "barracks", "at": "forward"}], "stance": "hold"}')
    writeFileSync(join(dir, "b.json"), '{"power": 0, "build": [], "stance": "attack"}')
    main(["submit", "--dir", dir, "--side", "A", "--plan", join(dir, "a.json")], write)
    assert.ok(lines.some((line) => /waiting for side B/.test(line)))
    main(["submit", "--dir", dir, "--side", "B", "--plan", join(dir, "b.json")], write)
    assert.ok(lines.some((line) => /^round 1: ended/.test(line)))
    lines.length = 0
    assert.equal(main(["wait", "--dir", dir, "--side", "B", "--timeout", "1"], write), 0)
    assert.match(lines.join("\n"), /# Duel, round 2 of 2: you are side B/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
