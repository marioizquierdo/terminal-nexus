// Area damage against a tight army (step 16K; the owner, 2026-10-21: "implement those to test differences in
// formations with units"): aiming at a crowd (`ContentDef.aim`, the Ravel bomber and the Citizen mortar), burning ground
// (`AttackDef.burn`, `MatchState.burning`: lit by a landing hit, burning every unit and worker on it of either side by
// the kernel's own clock, weighed by the routes, put out by Recall), and the two units as their armies define them.

import { test } from "node:test"
import assert from "node:assert/strict"
import { ARMIES } from "../src/armies/index.ts"
import { contentProblems } from "../src/content/data.ts"
import { FIXTURE_REGISTRY, createRegistry, rectFootprint } from "../src/content/index.ts"
import type { ContentDef, ContentRegistry } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import type { Coord } from "../src/grid/index.ts"
import { recall } from "../src/match/index.ts"
import { contextFor, stepTick } from "../src/pulse/index.ts"
import { BURNING_WEIGHT } from "../src/pulse/routes.ts"
import { onPatch } from "../src/pulse/burning.ts"
import { loadScenario } from "../src/scenario/index.ts"
import type { PlacementBlock, ScenarioDefinition } from "../src/scenario/index.ts"
import { hashState } from "../src/state/serialize.ts"
import type { BurningGround, MatchState, PlayerId, TargetArea } from "../src/state/types.ts"
import { resolveScenario } from "./helpers.ts"

const TROOPER = "unit.citizen.trooper"
const BOMBER = "unit.ravel.bomber"
const MORTAR = "unit.citizen.mortar"

// --- A field placed by hand ----------------------------------------------------------------------------------------

type Placed = readonly [x: number, y: number, content: string]

function block(placed: readonly Placed[]): PlacementBlock {
  const symbols = "abcdefghijklmnopqrstuvwxyz"
  const rows: string[][] = []
  const legend: Record<string, { content: string }> = {}
  placed.forEach(([x, y, content], index) => {
    const symbol = symbols[index] as string
    while (rows.length <= y) rows.push([])
    const row = rows[y] as string[]
    while (row.length <= x) row.push(" ")
    row[x] = symbol
    legend[symbol] = { content }
  })
  return { rows: rows.map((row) => row.join("")), legend }
}

/** An open Grid, 50 by 30, each side placed as given, its targets, rock on every tile `rocks` names. */
function field(
  sides: Readonly<Partial<Record<PlayerId, readonly Placed[]>>>,
  { targets = {}, rocks = [], registry = FIXTURE_REGISTRY }: Readonly<{ targets?: Partial<Record<PlayerId, TargetArea>>; rocks?: readonly Coord[]; registry?: ContentRegistry }> = {},
): MatchState {
  const placements: Partial<Record<PlayerId, PlacementBlock>> = {}
  for (const side of ["A", "B"] as const) {
    const placed = sides[side]
    if (placed !== undefined) placements[side] = block(placed)
  }
  const rock = (x: number, y: number): boolean => rocks.some((tile) => tile.x === x && tile.y === y)
  const scenario: ScenarioDefinition = {
    id: "area-field",
    name: "area field",
    grid: { width: 50, height: 30 },
    seed: 1,
    pulseTicks: 400,
    terrain: Array.from({ length: 30 }, (_, y) => Array.from({ length: 50 }, (_, x) => (rock(x, y) ? "#" : ".")).join("")),
    terrainLegend: { ".": "terrain.plain", "#": "terrain.rock" },
    placements,
    ...(Object.keys(targets).length === 0 ? {} : { targets }),
  }
  return loadScenario(scenario, { registry }).state
}

/** Every state after the first, and every event, resolved tick by tick for at most `ticks`. */
function play(state: MatchState, ticks: number, registry: ContentRegistry = FIXTURE_REGISTRY): Readonly<{ states: MatchState[]; events: DomainEvent[] }> {
  const context = contextFor(state, registry, ticks)
  const states: MatchState[] = []
  const events: DomainEvent[] = []
  let at = state
  while (at.outcome === null && at.tick < ticks) {
    const result = stepTick(at, context)
    at = result.state
    states.push(at)
    events.push(...result.events)
  }
  return { states, events }
}

const at = (state: MatchState, x: number, y: number): MatchState["entities"][number] => {
  const found = state.entities.find((entity) => entity.anchor.x === x && entity.anchor.y === y)
  assert.ok(found !== undefined, `nothing stands at ${x},${y}`)
  return found
}

/** Content that stands where it is put and does nothing: a post on the units' layer, one on the workers', one in the
 *  air, and a wall. What fire hurts is told apart on them. */
const STILL: readonly ContentDef[] = [
  { id: "unit.test.post", short: "post", layer: "units", footprint: rectFootprint(1, 1), maxHp: 100, speedTier: 2, collidesWith: ["obstacles", "units"], behavior: "static", salvage: 0 },
  { id: "unit.test.digger", short: "digger", layer: "workers", footprint: rectFootprint(1, 1), maxHp: 100, speedTier: 2, collidesWith: ["obstacles", "workers"], behavior: "static", salvage: 0 },
  { id: "unit.test.kite", short: "kite", layer: "air", footprint: rectFootprint(1, 1), maxHp: 100, speedTier: 2, collidesWith: ["air"], behavior: "static", salvage: 0 },
  { id: "structure.test.wall", short: "wall", layer: "obstacles", footprint: rectFootprint(1, 1), maxHp: 100, speedTier: 9, collidesWith: ["obstacles", "workers", "units"], behavior: "static", salvage: 0 },
]
const STILL_REGISTRY = createRegistry([...FIXTURE_REGISTRY.ids().map((id) => FIXTURE_REGISTRY.get(id)), ...STILL])

/** A patch of burning ground, lit by side A's first unit at tick 0. */
function patch(centre: Coord, overrides: Partial<BurningGround> = {}): BurningGround {
  return { centre, radius: 4, damage: 4, everyTicks: 12, startedTick: 0, untilTick: 72, player: "A", source: "A:mortar#99", sourceOrdinal: 98, ...overrides }
}

// --- The units ------------------------------------------------------------------------------------------------------

test("the bomber and the mortar are their factions' data: frail and fast, slow and far-reaching, each aiming at a crowd, each trained by a tier-2 building of its own", () => {
  const bomber = FIXTURE_REGISTRY.get(BOMBER)
  assert.equal(bomber.maxHp, 20)
  assert.deepEqual(bomber.movementRate, FIXTURE_REGISTRY.get("unit.ravel.runner").movementRate, "as fast as a runner")
  assert.equal(bomber.attack, undefined)
  assert.deepEqual(bomber.detonation, { radius: 4, damage: 36, triggerRange: 1 })
  assert.equal(bomber.aim, "crowd")
  assert.deepEqual(bomber.targetLayers, ["units", "workers"])
  // A trooper survives one burst; a runner does not.
  assert.ok(FIXTURE_REGISTRY.get(TROOPER).maxHp > 36 && FIXTURE_REGISTRY.get("unit.ravel.runner").maxHp <= 36)

  const mortar = FIXTURE_REGISTRY.get(MORTAR)
  const rate = (definition: ContentDef): number => (definition.movementRate?.numerator ?? 0) / (definition.movementRate?.denominator ?? 1)
  assert.ok(rate(mortar) < rate(FIXTURE_REGISTRY.get(TROOPER)), "slower than a trooper")
  assert.equal(mortar.attack?.range, 10)
  assert.equal(mortar.attack?.cooldownTicks, 54)
  // Two jobs (the owner, 2026-10-21): a burst for the enemy alone, then a fire for four seconds that hurts everyone.
  assert.deepEqual(mortar.attack?.splash, { radius: 2, damage: 12, hits: "enemies" })
  assert.equal(mortar.attack?.damage, 12, "the card's damage is the burst's")
  assert.deepEqual(mortar.attack?.burn, { radius: 4, damage: 8, everyTicks: 12, ticks: 48 })
  // Standing in it all that time, an enemy takes the burst and four burns, past a trooper's health.
  assert.ok(12 + 4 * 8 > (FIXTURE_REGISTRY.get(TROOPER).maxHp ?? 0))
  assert.equal(mortar.aim, "crowd")
  assert.deepEqual(mortar.targetLayers, ["units", "workers"])

  const card = (army: string, id: string) => ARMIES.arsenals[army]?.buildings.find((building) => building.id === id)
  assert.deepEqual(card("ravel", "fuse-shed")?.spawns?.unit, BOMBER)
  assert.deepEqual([card("ravel", "fuse-shed")?.tier, card("ravel", "fuse-shed")?.requires], [2, ["den"]])
  assert.deepEqual(card("citizen", "battery")?.spawns?.unit, MORTAR)
  assert.deepEqual([card("citizen", "battery")?.tier, card("citizen", "battery")?.requires], [2, ["barracks"]])
  // Each Commander builds on her faction, so each sees her faction's new building.
  assert.ok(card("vasse", "battery") !== undefined && card("averno", "battery") !== undefined && card("dob", "fuse-shed") !== undefined)
})

test("the loader holds a unit that aims at a crowd to having an area, and a burn's radius to whole rows", () => {
  const unit = { id: "unit.test.aimer", layer: "units", size: [1, 1], maxHp: 10, card: { title: "A", subtitle: "B", description: "C" }, glyph: ["a"] }
  assert.deepEqual(contentProblems([{ ...unit, aim: "crowd" }], 'army "data"'), [
    'the content "unit.test.aimer" aims at a crowd, and has no area to count one in: a splash, a burn or a detonation',
  ])
  assert.deepEqual(contentProblems([{ ...unit, aim: "crowd", detonation: { radius: 2, damage: 5 } }], 'army "data"'), [])
  const shell = { kind: "ranged", range: 4, damage: 1, cooldownTicks: 10, burn: { radius: 3, damage: 1, everyTicks: 12, ticks: 24 } }
  assert.deepEqual(contentProblems([{ ...unit, attack: shell }], 'army "data"'), [
    `the content "unit.test.aimer"'s burn radius is 3: a reach is 1, which is touching, or even, a whole number of rows`,
  ])
})

// --- Aiming at a crowd ------------------------------------------------------------------------------------------------

test("a bomber runs past the nearest enemy to the thickest knot and bursts in it (bomber-crowd)", async () => {
  const { run } = await resolveScenario("bomber-crowd.map.json")
  const bomber = run.initialState.entities.find((entity) => entity.contentId === BOMBER)
  const lone = run.initialState.entities.find((entity) => entity.anchor.x === 8 && entity.anchor.y === 2)
  assert.ok(bomber !== undefined && lone !== undefined)
  const chose = run.events.find((event) => event.kind === "target.selected" && event.entity === bomber.id)
  assert.ok(chose?.kind === "target.selected")
  assert.notEqual(chose.target, lone.id, "it went for the nearest, not the crowd")
  assert.equal(chose.crowd, 9, "the middle of the block, all nine round it")
  const nearestBy = (event: DomainEvent): number => (event.kind === "target.selected" && event.entity === lone.id ? event.distance : Number.POSITIVE_INFINITY)
  assert.ok(chose.distance > Math.min(...run.events.map(nearestBy)), "the lone trooper was nearer")
  const blast = run.events.find((event) => event.kind === "entity.detonated" && event.entity === bomber.id)
  assert.ok(blast?.kind === "entity.detonated")
  assert.ok(blast.caught.length >= 6, `the burst caught only ${blast.caught.join(" ")}`)
  assert.ok(!blast.caught.includes(lone.id), "the lone trooper was caught")
  // 36 a burst: every trooper caught survives one.
  assert.equal(run.events.filter((event) => event.kind === "entity.died" && event.player === "B").length, 0)
})

test("aiming at a crowd: the most of a side round it first, the nearest of those next; the same from the other end of the Grid", () => {
  // A bomber at 10,10: a lone trooper 4 away; a pair 12 away across; another pair 16 away down. Each pair is a crowd
  // of two. The bomber takes the nearer pair's nearer trooper.
  const choose = (mirror: boolean): Coord | null => {
    const x = (column: number): number => (mirror ? 49 - column : column)
    const bomberSide: PlayerId = mirror ? "B" : "A"
    const other: PlayerId = mirror ? "A" : "B"
    const state = field({
      [bomberSide]: [[x(10), 10, BOMBER]],
      [other]: [
        [x(14), 10, TROOPER],
        [x(22), 10, TROOPER],
        [x(23), 10, TROOPER],
        [x(10), 18, TROOPER],
        [x(11), 18, TROOPER],
      ],
    })
    const { states } = play(state, 1)
    const after = states[0] as MatchState
    const bomber = after.entities.find((entity) => entity.contentId === BOMBER)
    const target = after.entities.find((entity) => entity.ordinal === bomber?.targetOrdinal)
    return target === undefined ? null : { x: x(target.anchor.x), y: target.anchor.y }
  }
  assert.deepEqual(choose(false), { x: 22, y: 10 })
  assert.deepEqual(choose(true), { x: 22, y: 10 }, "mirrored, the bomber chose another")
})

test("a unit that does not aim at a crowd still takes the nearest", () => {
  const state = field({ A: [[10, 10, "unit.citizen.marksman"]], B: [[14, 10, TROOPER], [22, 10, TROOPER], [23, 10, TROOPER]] })
  const after = play(state, 1).states[0] as MatchState
  const marksman = after.entities.find((entity) => entity.contentId === "unit.citizen.marksman")
  assert.equal(after.entities.find((entity) => entity.ordinal === marksman?.targetOrdinal)?.anchor.x, 14)
  const chose = play(state, 1).events.find((event) => event.kind === "target.selected")
  assert.ok(chose?.kind === "target.selected" && chose.crowd === undefined, "a unit that does not aim at a crowd says nothing of one")
})

// --- Burning ground ---------------------------------------------------------------------------------------------------

test("a mortar's landing shell lights the ground at its target's tile, the tick it lands, for its burn's ticks", () => {
  // A post 10 columns from the mortar: in reach, so it stands and fires after its windup.
  const state = field({ A: [[5, 10, MORTAR]], B: [[15, 10, "unit.test.post"]] }, { registry: STILL_REGISTRY })
  const { events } = play(state, 80, STILL_REGISTRY)
  const shot = events.find((event) => event.kind === "attack.launched")
  const lit = events.find((event) => event.kind === "ground.lit")
  assert.ok(shot?.kind === "attack.launched" && lit?.kind === "ground.lit")
  assert.equal(lit.tick, shot.tick)
  assert.deepEqual(lit.centre, { x: 15, y: 10 })
  assert.deepEqual([lit.radius, lit.damage, lit.everyTicks, lit.untilTick], [4, 8, 12, shot.tick + 48])
  assert.equal(lit.source, shot.attacker)
  const burns = events.filter((event) => event.kind === "ground.burned").map((event) => event.tick)
  assert.equal(burns[0], shot.tick + 12, "fire first burns a beat after it is lit")
})

test("a mortar's burst hurts only the enemy round its target, and the fire it leaves burns both sides for four seconds", () => {
  // Two enemy posts and two of the mortar's own side, all within the burst's 2 and the fire's 4 of the target.
  const state = field(
    { A: [[5, 10, MORTAR], [17, 10, "unit.test.post"], [15, 11, "unit.test.post"]], B: [[15, 10, "unit.test.post"], [13, 10, "unit.test.post"]] },
    { registry: STILL_REGISTRY },
  )
  const { states, events } = play(state, 120, STILL_REGISTRY)
  const shot = events.find((event) => event.kind === "attack.launched")
  assert.ok(shot?.kind === "attack.launched")
  const hp = (tick: number, x: number, y: number): number => at(states[tick - 1] as MatchState, x, y).hp
  // The burst, the tick the shell lands: 12 to each enemy, nothing to its own.
  assert.deepEqual([hp(shot.tick, 15, 10), hp(shot.tick, 13, 10)], [88, 88])
  assert.deepEqual([hp(shot.tick, 17, 10), hp(shot.tick, 15, 11)], [100, 100], "the burst hurt the mortar's own side")
  // The fire: 8 a second to everyone on it, either side, four times, and out 48 ticks after it was lit.
  const burns = events.filter((event) => event.kind === "ground.burned" && event.tick <= shot.tick + 48).map((event) => event.tick)
  assert.deepEqual(burns, [12, 24, 36, 48].map((beat) => shot.tick + beat))
  const out = events.find((event) => event.kind === "ground.out")
  assert.equal(out?.tick, shot.tick + 48)
  const after = shot.tick + 50
  assert.ok(after < shot.tick + 54, "the mortar fired again before the fire was counted")
  assert.deepEqual([hp(after, 15, 10), hp(after, 13, 10)], [56, 56])
  assert.deepEqual([hp(after, 17, 10), hp(after, 15, 11)], [68, 68], "the fire spared the mortar's own side")
})

test("a death's blast that hits only enemies passes over its own side; without, it hurts both", () => {
  const blast = (hits: boolean): readonly number[] => {
    const bomb: ContentDef = {
      id: "unit.test.bomb", short: "bomb", layer: "units", footprint: rectFootprint(1, 1), maxHp: 10, speedTier: 2, collidesWith: ["obstacles", "units"],
      behavior: "static", salvage: 0, detonation: { radius: 4, damage: 30, ...(hits ? { hits: "enemies" as const } : {}) },
    }
    const registry = createRegistry([...STILL_REGISTRY.ids().map((id) => STILL_REGISTRY.get(id)), bomb])
    // The bomb (side A) between a post of its own and one of the enemy's, each 4 columns off; a fire of one tile's
    // reach on the bomb alone sets it off.
    const state: MatchState = {
      ...field({ A: [[20, 10, "unit.test.bomb"], [24, 10, "unit.test.post"]], B: [[16, 10, "unit.test.post"]] }, { registry }),
      burning: [patch({ x: 20, y: 10 }, { radius: 1, damage: 50 })],
    }
    const { states } = play(state, 13, registry)
    const last = states[states.length - 1] as MatchState
    return [at(last, 24, 10).hp, at(last, 16, 10).hp]
  }
  assert.deepEqual(blast(true), [100, 70], "its own post caught, or the enemy's spared")
  assert.deepEqual(blast(false), [70, 70])
})

test("burning ground burns every unit and worker on it, of either side, each beat until its time is up, then goes out; never a flyer or a building", () => {
  const state: MatchState = {
    ...field(
      {
        A: [[20, 10, "unit.test.post"], [22, 10, "unit.test.kite"], [20, 11, "structure.test.wall"], [30, 10, "unit.test.post"]],
        B: [[21, 10, "unit.test.post"], [19, 10, "unit.test.digger"], [24, 10, "unit.test.post"], [20, 12, "unit.test.post"]],
      },
      { registry: STILL_REGISTRY },
    ),
    burning: [patch({ x: 20, y: 10 })],
  }
  const { states, events } = play(state, 90, STILL_REGISTRY)
  const burned = events.filter((event) => event.kind === "ground.burned")
  assert.deepEqual(burned.map((event) => event.tick), [12, 24, 36, 48, 60, 72])
  const last = states[states.length - 1] as MatchState
  const hp = (x: number, y: number): number => at(last, x, y).hp
  // Six burns of 4: both sides' units and workers on it.
  assert.equal(hp(20, 10), 76)
  assert.equal(hp(21, 10), 76)
  assert.equal(hp(19, 10), 76)
  assert.equal(hp(24, 10), 76, "four columns across is on it")
  assert.equal(hp(20, 12), 76, "two rows down is on it")
  // Off it, in the air, or a building: untouched.
  assert.equal(hp(30, 10), 100)
  assert.equal(hp(22, 10), 100, "a flyer burnt")
  assert.equal(hp(20, 11), 100, "a building burnt")
  const out = events.filter((event) => event.kind === "ground.out")
  assert.deepEqual(out.map((event) => event.tick), [72])
  // Burning while it burns, and gone once out: a state with nothing burning carries no `burning` at all.
  assert.ok(states.slice(0, 71).every((each) => each.burning?.length === 1))
  assert.ok(states.slice(71).every((each) => !("burning" in each)), "a state with no fire still carries the field")
  // The hits name the shooter, which has fallen (it was never on this Grid): by its id.
  const hit = events.find((event) => event.kind === "damage.applied")
  assert.ok(hit?.kind === "damage.applied" && hit.source === "A:mortar#99")
})

test("two patches on one tile are one hit, and a kill by fire is the shooter's", () => {
  const state: MatchState = {
    ...field({ B: [[20, 10, "unit.test.post"], [40, 20, "unit.test.post"]], A: [[2, 2, "unit.test.post"]] }, { registry: STILL_REGISTRY }),
    burning: [patch({ x: 20, y: 10 }, { damage: 30 }), patch({ x: 21, y: 10 }, { damage: 30, source: "A:post#1", sourceOrdinal: 0 })],
  }
  const { states, events } = play(state, 30, STILL_REGISTRY)
  const hits = events.filter((event) => event.kind === "damage.applied" && event.tick === 12)
  assert.equal(hits.length, 1)
  assert.ok(hits[0]?.kind === "damage.applied" && hits[0].amount === 60)
  // The hit is the first patch's, in the order patches are kept: by when they were lit, then by their shooter's ordinal
  // (the post, ordinal 0, before the fallen mortar, 98). The kill is that shooter's.
  const died = events.find((event) => event.kind === "entity.died" && event.tick === 24)
  assert.ok(died?.kind === "entity.died" && died.killer === "A:post#1")
  assert.deepEqual((states[0] as MatchState).burning?.map((each) => each.source), ["A:post#1", "A:mortar#99"])
})

test("routes go round burning ground when that is quicker, and through it when it is not", () => {
  const steps = (burning: readonly BurningGround[], rocks: readonly Coord[] = []): Coord[] => {
    const state = field({ A: [[5, 10, TROOPER]] }, { targets: { A: { x: 40, y: 10, width: 1, height: 1 } }, rocks })
    const { events } = play({ ...state, ...(burning.length === 0 ? {} : { burning }) }, 200)
    return events.flatMap((event) => (event.kind === "entity.moved" ? [event.to] : []))
  }
  const fire = patch({ x: 20, y: 10 }, { untilTick: 400 })
  const onFire = (tile: Coord): boolean => onPatch(fire, tile)
  // Open ground: straight along row 10 without fire, nine burning tiles; round the patch with it, two rows up or down
  // where the patch is a single tile, which it takes or steps round as the shorter way says.
  assert.equal(steps([]).filter(onFire).length, 9, "the straight way does not cross the fire")
  assert.ok(steps([]).every((tile) => tile.y === 10))
  const round = steps([fire])
  assert.ok(round.length > 0 && round.filter(onFire).length <= 1, `the walker walked through the fire: ${JSON.stringify(round.filter(onFire))}`)
  assert.ok(round.some((tile) => tile.y !== 10), "the walker never left its row")
  assert.deepEqual(round[round.length - 1], { x: 40, y: 10 })
  // A corridor of rock one row tall: no way round, so it walks through.
  const walls = Array.from({ length: 50 }, (_, x) => [{ x, y: 9 }, { x, y: 11 }]).flat()
  const through = steps([fire], walls)
  assert.ok(through.some(onFire))
  assert.deepEqual(through[through.length - 1], { x: 40, y: 10 })
  assert.equal(BURNING_WEIGHT, 4)
})

test("a walker crossing fire steps as quickly as on open ground: a route weighs the fire, a step's credit does not", () => {
  const walls = Array.from({ length: 50 }, (_, x) => [{ x, y: 9 }, { x, y: 11 }]).flat()
  const ticks = (burning: readonly BurningGround[]): number[] => {
    const state = field({ A: [[5, 10, TROOPER]] }, { targets: { A: { x: 40, y: 10, width: 1, height: 1 } }, rocks: walls })
    return play({ ...state, ...(burning.length === 0 ? {} : { burning }) }, 200).events.flatMap((event) => (event.kind === "entity.moved" ? [event.tick] : []))
  }
  assert.deepEqual(ticks([patch({ x: 20, y: 10 }, { untilTick: 400 })]), ticks([]))
})

test("Recall puts the fire out: the next round opens on ground with nothing burning", () => {
  const state: MatchState = { ...field({ A: [[5, 10, TROOPER]], B: [[30, 10, TROOPER]] }), burning: [patch({ x: 20, y: 10 }, { untilTick: 400 })] }
  const { state: recalled } = recall(state, FIXTURE_REGISTRY)
  assert.ok(!("burning" in recalled))
})

test("a state without fire hashes as it did before fire existed; one with fire hashes it", () => {
  const state = field({ A: [[5, 10, TROOPER]], B: [[30, 10, TROOPER]] })
  assert.ok(!("burning" in state))
  const { states } = play(state, 40)
  assert.ok(states.every((each) => !("burning" in each)), "a battle with no fire put a burning field in its state")
  assert.notEqual(hashState({ ...state, burning: [patch({ x: 20, y: 10 })] }), hashState(state))
})

test("battles with a bomber and with burning ground resolve to the same hashes on every run and on both runtimes", async () => {
  // Pinned when the bomber and the mortar came (step 16K): the suite runs on Node and on Bun, so the one pin holds
  // both to these bytes. The mortar's re-pinned when its shell came to hurt only the enemy and its fire to burn
  // harder and shorter (step 16L), its walker moved up to meet the shorter fire: the block now falls by tick 229.
  const pins: Readonly<Record<string, readonly [string, string, number]>> = {
    "bomber-crowd.map.json": ["c3781f3364d5a500fefaff3673ac35e09d7de060976cdbdda96e76dd56b31bd9", "62222566f981d7427eaa6b99edb1b71b6f5912e519be7a3b8bd546bffbf3aa5a", 39],
    "mortar-burning-ground.map.json": ["5f93fc76f39beac04707c21398a23bc69f23e50015533a541028331549fd41fb", "c3446d6f8e3b34eb5a50e72a11204fb3bff688cefb367c5603bc845656c1619d", 229],
  }
  for (const [name, [stateHash, eventsHash, ticks]] of Object.entries(pins)) {
    const first = await resolveScenario(name)
    const again = await resolveScenario(name)
    assert.equal(first.run.stateHash, again.run.stateHash)
    assert.deepEqual([first.run.stateHash, first.run.eventsHash, first.run.finalState.tick], [stateHash, eventsHash, ticks], name)
  }
})

test("in the mortar's scenario the ground burns both the block and, standing in it, the block at its target; a walker behind goes round the patch", async () => {
  const { run } = await resolveScenario("mortar-burning-ground.map.json")
  const lit = run.events.filter((event) => event.kind === "ground.lit")
  assert.ok(lit.length >= 2)
  const caught = run.events.flatMap((event) => (event.kind === "ground.burned" ? event.caught : []))
  assert.ok(caught.length > 0)
  assert.ok(run.events.some((event) => event.kind === "entity.died" && event.killer === "A:mortar#1"), "the fire killed nobody")
  // The lone trooper behind the block: never on the first patch while it burnt.
  const first = lit[0]
  assert.ok(first?.kind === "ground.lit")
  const walker = run.initialState.entities.reduce((a, b) => (a.anchor.x > b.anchor.x ? a : b))
  const patchOf: BurningGround = { centre: first.centre, radius: first.radius, damage: first.damage, everyTicks: first.everyTicks, startedTick: first.tick, untilTick: first.untilTick, player: first.player, source: first.source, sourceOrdinal: first.sourceOrdinal }
  const walked = run.events.flatMap((event) => (event.kind === "entity.moved" && event.entity === walker.id ? [{ tick: event.tick, to: event.to }] : []))
  // It reached the patch while it burnt, stepped round it off its row, and was never on it.
  assert.ok(walked.some(({ tick, to }) => tick <= first.untilTick && to.x <= first.centre.x + 1), "the walker reached the patch only once it was out")
  assert.ok(walked.some(({ tick, to }) => tick <= first.untilTick && to.y !== first.centre.y), "the walker kept to its row")
  assert.ok(!walked.some(({ tick, to }) => tick > first.tick && tick <= first.untilTick && onPatch(patchOf, to)), "the walker walked into the fire")
  assert.ok(walked.some(({ to }) => to.x < first.centre.x - first.radius), "the walker never got past the patch")
})
