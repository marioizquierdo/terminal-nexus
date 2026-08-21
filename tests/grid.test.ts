// The Grid, its layers, and collision masks — milestone-1-spike-battle.md 3.9, "Grid and collision".

import { test } from "node:test"
import assert from "node:assert/strict"
import { createRegistry, CITIZEN_CONTENT, rectFootprint } from "../src/content/index.ts"
import type { ContentDef } from "../src/content/index.ts"
import { OccupancyIndex, footprintDistance, maskFrom, tilesOf } from "../src/grid/index.ts"
import type { GridTerrain, TerrainId } from "../src/grid/index.ts"
import { contextFor, occupancyFor, stepTick } from "../src/pulse/index.ts"
import { loadScenario } from "../src/scenario/index.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { loadScenarioFile, resolveScenario, scenarioFiles } from "./helpers.ts"

function plainGrid(width: number, height: number): GridTerrain {
  return { width, height, tiles: new Array<TerrainId>(width * height).fill("terrain.plain") }
}

test("no two entities overlap in a mask that includes both their layers, at any tick", async () => {
  for (const name of scenarioFiles()) {
    const scenario = await loadScenarioFile(name)
    const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
    const context = contextFor(loaded.state, loaded.registry, scenario.pulseTicks)
    let state = loaded.state
    while (state.outcome === null && state.tick < scenario.pulseTicks) {
      // The index itself refuses a double occupancy, so building one per tick is the assertion.
      assert.doesNotThrow(
        () => occupancyFor(state, context),
        `${name}: two entities shared a tile on one layer at tick ${state.tick}`,
      )
      const seen = new Map<string, string>()
      for (const entity of state.entities) {
        const definition = loaded.registry.get(entity.contentId)
        for (const tile of tilesOf(entity.anchor, definition.footprint)) {
          assert.ok(
            tile.x >= 0 && tile.y >= 0 && tile.x < state.grid.width && tile.y < state.grid.height,
            `${name}: ${entity.id} has a footprint tile outside the Grid at tick ${state.tick}`,
          )
          const key = `${definition.layer}:${tile.x},${tile.y}`
          const other = seen.get(key)
          assert.equal(
            other,
            undefined,
            `${name}: ${entity.id} and ${String(other)} share ${key} at tick ${state.tick}`,
          )
          seen.set(key, entity.id)
        }
      }
      state = stepTick(state, context).state
    }
  }
})

test("a worker and a ground unit may share a tile", async () => {
  // Collision is a mask composed from chosen layers, so at some tick a unit and a worker stand on
  // the same tile — asserted rather than forbidden.
  const scenario = await loadScenarioFile("share-tile-worker-unit.ts")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  const context = contextFor(loaded.state, loaded.registry, scenario.pulseTicks)
  let state = loaded.state
  let overlapped = false
  while (state.outcome === null && state.tick < scenario.pulseTicks && !overlapped) {
    const occupied = new Map<string, string>()
    for (const entity of state.entities) {
      const key = `${entity.anchor.x},${entity.anchor.y}`
      const other = occupied.get(key)
      if (other !== undefined) overlapped = true
      occupied.set(key, entity.contentId)
    }
    state = stepTick(state, context).state
  }
  assert.ok(overlapped, "a worker and a unit never shared a tile in share-tile-worker-unit")
})

test("a ground unit is blocked by a structure on a different layer", () => {
  const grid = plainGrid(8, 4)
  const index = new OccupancyIndex(grid)
  const barracks = FIXTURE_REGISTRY.get("structure.citizen.barracks")
  const trooper = FIXTURE_REGISTRY.get("unit.citizen.trooper")
  index.add(barracks.layer, 0, { x: 3, y: 1 }, barracks.footprint)
  index.add(trooper.layer, 1, { x: 1, y: 1 }, trooper.footprint)

  const mask = maskFrom(index, {
    layers: trooper.collidesWith,
    terrain: "impassable",
    ignore: [1],
  })
  assert.equal(mask.blockerAt({ x: 3, y: 1 }), 0, "the structure did not block across layers")
  assert.equal(mask.blocked({ x: 2, y: 1 }), false)
})

test("an air entity can share a tile with a ground entity (Q8)", () => {
  // The layer exists from day one and stays empty of content; the rule is proven without a unit
  // nobody asked for being added to the fixture.
  const skiff: ContentDef = {
    id: "test.air.skiff",
    short: "skiff",
    layer: "air",
    footprint: rectFootprint(1, 1),
    maxHp: 10,
    speedTier: 1,
    collidesWith: ["air"],
    behavior: "advance",
    salvage: 0,
  }
  const registry = createRegistry([...CITIZEN_CONTENT, skiff])
  const grid = plainGrid(6, 3)
  const index = new OccupancyIndex(grid)
  const trooper = registry.get("unit.citizen.trooper")
  index.add(trooper.layer, 0, { x: 2, y: 1 }, trooper.footprint)

  const airMask = maskFrom(index, { layers: skiff.collidesWith, terrain: "ignore" })
  assert.equal(airMask.blocked({ x: 2, y: 1 }), false, "the ground unit blocked an air mover")
  index.add(skiff.layer, 1, { x: 2, y: 1 }, skiff.footprint)

  const groundMask = maskFrom(index, {
    layers: trooper.collidesWith,
    terrain: "impassable",
    ignore: [0],
  })
  assert.equal(groundMask.blocked({ x: 2, y: 1 }), false, "the air unit blocked a ground mover")
})

test("a 3x1 hauler is refused a two-tile gap and admitted a three-tile one", () => {
  const hauler = FIXTURE_REGISTRY.get("unit.citizen.hauler")
  assert.equal(hauler.footprint.length, 3)

  const build = (gap: number): GridTerrain => {
    const width = 9
    const height = 3
    const tiles: TerrainId[] = new Array<TerrainId>(width * height).fill("terrain.plain")
    for (let x = 0; x < width; x += 1) {
      const insideGap = x >= 3 && x < 3 + gap
      tiles[1 * width + x] = insideGap ? "terrain.plain" : "terrain.rock"
    }
    return { width, height, tiles }
  }

  for (const [gap, expected] of [
    [2, false],
    [3, true],
  ] as const) {
    const grid = build(gap)
    const index = new OccupancyIndex(grid)
    const mask = maskFrom(index, { layers: hauler.collidesWith, terrain: "impassable" })
    assert.equal(
      mask.footprintFits({ x: 3, y: 1 }, hauler.footprint),
      expected,
      `a ${gap}-tile gap should ${expected ? "admit" : "refuse"} the hauler`,
    )
  }
})

test("the hauler scenarios agree with the mask: three crosses the wall, two never does", async () => {
  const crossed = async (name: string): Promise<boolean> => {
    const resolved = await resolveScenario(name)
    return resolved.run.events.some((event) => event.kind === "entity.moved" && event.to.y > 6)
  }
  assert.equal(await crossed("hauler-three-tile-gap.ts"), true)
  assert.equal(await crossed("hauler-two-tile-gap.ts"), false)
})

test("a multi-tile entity is damaged and destroyed as one entity", async () => {
  const resolved = await resolveScenario("structure-destruction.ts")
  const destroyed = resolved.run.events.filter((event) => event.kind === "structure.destroyed")
  assert.equal(destroyed.length, 1, "a 3x2 Grid Nexus died more than once")
  const nexus = destroyed[0]
  assert.ok(nexus !== undefined && nexus.kind === "structure.destroyed")
  assert.equal(nexus.contentId, "structure.citizen.nexus")

  // Every hit landed on the entity, never on one of its six tiles.
  const damage = resolved.run.events.filter(
    (event) => event.kind === "damage.applied" && event.ordinal === nexus.ordinal,
  )
  assert.ok(damage.length > 1)
})

test("range measures to the nearest occupied tile of a multi-tile target", () => {
  const nexus = FIXTURE_REGISTRY.get("structure.citizen.nexus")
  const trooper = FIXTURE_REGISTRY.get("unit.citizen.trooper")
  // The anchor is five tiles east; its nearest occupied tile is three.
  const anchor = { x: 10, y: 5 }
  const target = { x: 13, y: 5 }
  assert.equal(footprintDistance(anchor, trooper.footprint, target, nexus.footprint), 3)
  // And it is measured to the entity, so the far corner never decides the answer.
  assert.equal(footprintDistance(anchor, trooper.footprint, { x: 8, y: 4 }, nexus.footprint), 0)
})
