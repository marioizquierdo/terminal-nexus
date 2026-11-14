// A building placed in a sandbox's Battle Round does what its army's card says it does: it trains its wave, the same
// recipe and first-wave time a battle gives it (docs/system-design/sandboxes.md, "A building's wave"). The decision is the owner's: "if you are testing a building, you are placing it in there in
// battle mode, and the sandbox has enough resources, then the buildings will start doing its thing."

import { test } from "node:test"
import assert from "node:assert/strict"
import { ARMIES } from "../src/armies/index.ts"
import { defaultValue } from "../src/build/all-settings.ts"
import { FIXTURE_REGISTRY, withProduction } from "../src/content/index.ts"
import { TICKS_PER_SECOND } from "../src/state/types.ts"
import type { BattleOpening } from "../src/skirmish/opening/index.ts"
import { openBattle } from "../src/skirmish/opening/index.ts"
import { playSandboxRound } from "../src/skirmish/sandbox-round.ts"

const ground = Array.from({ length: 16 }, () => ".".repeat(40))
const BARRACKS = "structure.citizen.barracks"

function opening(content = BARRACKS): BattleOpening {
  return {
    id: "training-fixture",
    name: "Training fixture",
    grid: { width: 40, height: 16 },
    seed: 5,
    pulseTicks: 600,
    terrain: ground,
    terrainLegend: { ".": "terrain.plain" },
    placements: {
      A: { at: { x: 6, y: 8 }, rows: ["b"], legend: { b: { content } } },
      B: { at: { x: 36, y: 14 }, rows: ["t"], legend: { t: { content: "unit.citizen.trooper" } } },
    },
    targets: { A: { x: 36, y: 0, width: 2, height: 2 }, B: { x: 30, y: 14, width: 2, height: 2 } },
  }
}

const card = (structure: string) => {
  for (const army of ARMIES.armies) for (const each of army.buildings ?? []) if (each.structure === structure && each.spawns !== undefined) return each.spawns
  throw new Error(`no card with spawns for ${structure}`)
}

const spawnedLater = (events: readonly { kind: string; tick?: number }[]) => events.filter((event) => event.kind === "entity.spawned" && (event.tick ?? 0) > 0)

test("a Barracks in a Battle Round sandbox trains its card's units: perWave times waves", () => {
  const spawns = card(BARRACKS)
  const round = playSandboxRound(opening())
  const made = spawnedLater(round.run.events as never)
  assert.equal(made.length, spawns.perWave * spawns.waves)
  const units = round.run.finalState.entities.filter((entity) => entity.player === "A" && entity.contentId === spawns.unit)
  assert.equal(units.length, spawns.perWave * spawns.waves)
  assert.ok(spawns.waves * 1 >= 1 && round.run.events.some((event) => event.kind === "entity.spawned" && event.tick === defaultValue("firstWave") * TICKS_PER_SECOND))
})

test("a building with no card that spawns stays idle, and a recipe a caller gave is not doubled up", () => {
  assert.equal(openBattle(opening("structure.citizen.nexus")).registry.get("structure.citizen.nexus").production, undefined)
  const own = withProduction(FIXTURE_REGISTRY, { [BARRACKS]: { output: "unit.citizen.trooper", perWave: 1, waves: 2, firstTicks: 60, intervalTicks: 120 } })
  const round = playSandboxRound(opening(), { registry: own })
  assert.equal(spawnedLater(round.run.events as never).length, 2)
})
