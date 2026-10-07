// Construction territory — the build range (the owner, round 4: buildings "can only be built within the
// build-range of the other buildings") as round 5 reshaped it: the Grid Nexus roots it and standing buildings
// link where their ranges meet; a building planned in this Build Phase gives no range until it stands, next
// round ("Expansing territory is only done at next round"); one tile of a new building inside the range is
// enough ("should allow to build if at least 1 building tile is within range"); and a building that makes units
// keeps room round it ("so they leave space for units spawning"). The rules are the reducer's
// (`src/build/territory.ts`, `src/build/state.ts`); how they are drawn is tests/build-areas.test.ts's.

import { test } from "node:test"
import assert from "node:assert/strict"
import { defaultValue, shownSetting } from "../src/build/all-settings.ts"
import { formatSettingsExport } from "../src/build/settings-export.ts"
import type { BuildContext } from "../src/build/state.ts"
import { anchorForCursor, armingSpot, buildRange, legalityAt } from "../src/build/state.ts"
import { crowding, territoryOf } from "../src/build/territory.ts"
import type { PlannedPlacement } from "../src/build/types.ts"
import { starterContext } from "../src/cli/starter.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { footprintDistance } from "../src/grid/coords.ts"
import type { Coord, TerrainId } from "../src/grid/types.ts"
import { BACKSPACE, ENTER, buildSide, keys } from "./build-helpers.ts"
import type { Side } from "./build-helpers.ts"

const NEXUS = "structure.citizen.nexus"
const BARRACKS = "structure.citizen.barracks"
const TURRET = "structure.bench.beamturret"
const HATCHERY = "structure.bench.hatchery"
const DEN = "structure.ravel.den"

const turretAt = (ordinal: number, anchor: Coord): PlannedPlacement => ({ ordinal, contentId: TURRET, anchor })

/** Whether a placement of `contentId` with its centre on `tile` is legal on `context` with `planned`. */
function legal(context: BuildContext, planned: readonly PlannedPlacement[], contentId: string, tile: Coord, radius?: number, clearance?: number) {
  return legalityAt(context, planned, contentId, anchorForCursor(tile, FIXTURE_REGISTRY.get(contentId).footprint), undefined, radius, clearance)
}

/** Moves the map cursor onto `tile` and asserts it got there. */
function moveTo(side: Side, tile: Coord): void {
  const { cursor } = side.build.state
  side.build.run([{ kind: "move-cursor", dx: tile.x - cursor.x, dy: tile.y - cursor.y }])
  assert.deepEqual(side.build.state.cursor, tile)
}

/** A Turret armed by its digit, moved to `tile` and placed with Enter. */
function placeTurret(side: Side, tile: Coord): void {
  keys(side, "3")
  moveTo(side, tile)
  keys(side, ENTER)
}

/** Backspace on the map, on `tile`: the keyboard taken to the map first, where Backspace removes. */
function removeAt(side: Side, tile: Coord): void {
  side.build.dispatch({ kind: "focus", target: "grid" })
  moveTo(side, tile)
  keys(side, BACKSPACE)
}

/** An open field with a Grid Nexus at its west edge (0,4 to 2,5), rock where `rock` says, and plenty to spend. */
function field(rock: readonly Coord[] = []): BuildContext {
  const width = 20
  const height = 12
  const tiles = new Array<TerrainId>(width * height).fill("terrain.plain")
  for (const tile of rock) tiles[tile.y * width + tile.x] = "terrain.rock"
  return { ...starterContext(), grid: { width, height, tiles }, standing: [{ contentId: NEXUS, anchor: { x: 0, y: 4 } }], field: [], incoming: [], allotment: 1000 }
}

// --- The build range --------------------------------------------------------------------------------------

test("the Grid Nexus roots the build range: six tiles round it to begin with, measured as range is", () => {
  const context = starterContext()
  assert.equal(defaultValue("buildRange"), 6)
  const territory = territoryOf(context, defaultValue("buildRange"))
  assert.equal(territory.rooted, true)
  // The Nexus stands at 17,10 to 19,11. To its nearest tile, a row counting two columns: six columns west, three
  // rows north and south, and two columns and two rows off its corner.
  for (const tile of [{ x: 11, y: 10 }, { x: 18, y: 7 }, { x: 18, y: 14 }, { x: 15, y: 13 }]) assert.ok(territory.has(tile), `${tile.x},${tile.y} is inside`)
  for (const tile of [{ x: 10, y: 10 }, { x: 18, y: 6 }, { x: 18, y: 15 }, { x: 14, y: 13 }]) assert.ok(!territory.has(tile), `${tile.x},${tile.y} is outside`)
})

test("standing buildings link where their ranges meet: the Barracks beside the Nexus links at 4, and is cut off at 2", () => {
  const context = starterContext()
  // Six columns apart: at 4 their ranges overlap, so the Barracks links and lends its range.
  const four = territoryOf(context, 4)
  assert.deepEqual(four.members.map((member) => [member.contentId, member.linked]), [[NEXUS, true], [BARRACKS, true]])
  assert.ok(four.has({ x: 30, y: 10 }), "the linked Barracks gives its range")
  // At 2 they do not meet: the Barracks keeps standing, and gives nothing.
  const two = territoryOf(context, 2)
  assert.deepEqual(two.members.map((member) => [member.contentId, member.linked]), [[NEXUS, true], [BARRACKS, false]])
  assert.ok(!two.has({ x: 28, y: 10 }), "a cut-off building gave a build range")
  assert.equal(legal(context, [], TURRET, { x: 28, y: 10 }, 2).ok, false)
  // A Turret standing between them links it again: its range meets both.
  const bridged = territoryOf({ ...context, standing: [...context.standing, { contentId: TURRET, anchor: { x: 21, y: 10 } }] }, 2)
  assert.ok(bridged.members.every((member) => member.linked))
  assert.ok(bridged.has({ x: 28, y: 10 }))
})

test("with no Grid Nexus standing there is nothing to build from", () => {
  const context: BuildContext = { ...starterContext(), standing: [{ contentId: BARRACKS, anchor: { x: 25, y: 10 } }] }
  const territory = territoryOf(context, defaultValue("buildRange"))
  assert.equal(territory.rooted, false)
  assert.ok(!territory.has({ x: 26, y: 13 }))
  const refused = legal(context, [], TURRET, { x: 26, y: 14 })
  assert.deepEqual(refused, { ok: false, reason: "there is no Nexus to build from" })
})

test("one tile of a building inside the build range is enough; with none inside, the refusal names its first tile", () => {
  const context = starterContext()
  // Centred three rows south of the Nexus, a Barracks's top row is on the range's last row and its bottom row
  // hangs past it: allowed, so a large building has room at the range's edge.
  assert.ok(legal(context, [], BARRACKS, { x: 18, y: 14 }).ok)
  // A row further south, none of it is inside.
  assert.deepEqual(legal(context, [], BARRACKS, { x: 18, y: 15 }), { ok: false, reason: "outside your build range", tile: { x: 17, y: 15 } })
  // A Turret is one tile: on the range's last row it fits, a row beyond it does not.
  assert.ok(legal(context, [], TURRET, { x: 18, y: 14 }).ok)
  assert.deepEqual(legal(context, [], TURRET, { x: 18, y: 15 }), { ok: false, reason: "outside your build range", tile: { x: 18, y: 15 } })
})

test("rock and the map's edge are still refused tile by tile, whichever tile is in range", () => {
  // The Nexus's range reaches column 8 on its rows; a Barracks centred on 9,4 has 8,4 inside and 9,4 on rock.
  const rocky = field([{ x: 9, y: 4 }])
  assert.ok(territoryOf(rocky, defaultValue("buildRange")).has({ x: 8, y: 4 }) && !territoryOf(rocky, defaultValue("buildRange")).has({ x: 9, y: 4 }))
  assert.deepEqual(legal(rocky, [], BARRACKS, { x: 9, y: 4 }), { ok: false, reason: "rock in the way", tile: { x: 9, y: 4 } })
  // A Barracks hanging off the west edge, its middle column in range.
  const edge = field()
  assert.ok(territoryOf(edge, defaultValue("buildRange")).has({ x: 0, y: 1 }))
  assert.deepEqual(legal(edge, [], BARRACKS, { x: 0, y: 1 }), { ok: false, reason: "it would hang off the Grid" })
})

test("only what stands gives build range: a building planned this phase gives none until it stands", () => {
  const context = starterContext()
  // Six rows south of the Nexus is past its range, and stays past it with a Turret planned on the range's edge.
  assert.equal(legal(context, [], TURRET, { x: 19, y: 17 }).ok, false)
  const planned = [turretAt(1, { x: 19, y: 14 })]
  assert.deepEqual(legal(context, planned, TURRET, { x: 19, y: 17 }), { ok: false, reason: "outside your build range", tile: { x: 19, y: 17 } })
  // Through the reducer, the same: the second Turret is refused, and the range is the same range all phase.
  const side = buildSide()
  const opening = buildRange(side.context, side.build.state)
  placeTurret(side, { x: 19, y: 14 })
  assert.equal(side.build.state.planned.length, 1, side.build.state.status.text)
  assert.equal(buildRange(side.context, side.build.state), opening, "planning a building changed the build range")
  placeTurret(side, { x: 19, y: 17 })
  assert.equal(side.build.state.planned.length, 1)
  assert.equal(side.build.state.status.text, "Cannot build here: outside your build range at 19,17.")
  // Next round it stands, linked to the Nexus, and gives its range.
  const nextRound: BuildContext = { ...context, standing: [...context.standing, { contentId: TURRET, anchor: { x: 19, y: 14 } }] }
  assert.ok(legal(nextRound, [], TURRET, { x: 19, y: 17 }).ok)
})

test("placing outside the build range is refused in words, naming the tile, and nothing moves", () => {
  const side = buildSide()
  keys(side, "3")
  // Seven columns past the Barracks (25 to 27), one past its range.
  moveTo(side, { x: 34, y: 10 })
  // Looking reads quietly; trying is the reducer's own answer, in the danger tone, and the cursor stays.
  keys(side, ENTER)
  assert.equal(side.build.state.planned.length, 0)
  assert.equal(side.build.state.status.text, "Cannot build here: outside your build range at 34,10.")
  assert.equal(side.build.state.status.tone, "danger")
  assert.deepEqual(side.build.state.cursor, { x: 34, y: 10 })
})

test("arming proposes only a spot Enter would take, and says so when none is near", () => {
  // From the Nexus, the nearest good spot is beside it, inside the range.
  const near = buildSide({ cursor: { x: 18, y: 10 } })
  keys(near, "3")
  const context = starterContext()
  assert.ok(legal(context, [], TURRET, near.build.state.cursor).ok, "arming proposed a spot Enter refuses")
  // Far out on the open ground east of the base there is room, but none of it in the range within reach.
  const far = buildSide({ cursor: { x: 60, y: 24 } })
  keys(far, "3")
  assert.equal(far.build.state.noSpotFound, true)
  assert.equal(far.build.state.status.text, "Turret selected - no room in your build range nearby, move to find one.")
  assert.ok(far.build.state.status.text.length <= 76, "the warning does not fit the bottom line")
})

test("removing and undoing a planned building is never refused: nothing planned gives build range", () => {
  // Round 4 refused taking away a planned building another planned one needed for its range; with range from
  // standing buildings alone, no planned building ever needs another.
  const side = buildSide({ context: { ...starterContext(), allotment: 1000 } })
  placeTurret(side, { x: 19, y: 14 })
  placeTurret(side, { x: 20, y: 13 })
  placeTurret(side, { x: 16, y: 13 })
  assert.equal(side.build.state.planned.length, 3, side.build.state.status.text)
  removeAt(side, { x: 19, y: 14 })
  assert.equal(side.build.state.planned.length, 2)
  assert.equal(side.build.state.status.text, "Turret removed, 15 refunded.")
  keys(side, "u")
  assert.equal(side.build.state.planned.length, 1)
  assert.equal(side.build.state.status.text, "Turret undone, 15 refunded.")
  keys(side, "u")
  assert.equal(side.build.state.planned.length, 0)
})

test("the build range is an Experiment: 4, 6 or 8 tiles, felt at once, and written into the export", () => {
  const spec = shownSetting("buildRange")
  assert.equal(spec.tier, "experiment")
  assert.equal(spec.section, "mission")
  assert.deepEqual(spec.values, [4, 6, 8])
  assert.equal(spec.applies, "now")
  assert.doesNotMatch(spec.question, /\((F|Q)\d+\)/)
  // A Turret eight tiles from the Barracks (two columns and three rows off its corner): refused at 6, placed once
  // the range is 8, without a restart.
  const side = buildSide({ context: { ...starterContext(), allotment: 1000 } })
  keys(side, "3")
  moveTo(side, { x: 23, y: 14 })
  keys(side, ENTER)
  assert.equal(side.build.state.planned.length, 0)
  side.build.dispatch({ kind: "experiment-adjust", field: "buildRange", step: 1 })
  assert.equal(side.build.state.experiments.buildRange, 8)
  keys(side, ENTER)
  assert.equal(side.build.state.planned.length, 1, side.build.state.status.text)
  assert.match(formatSettingsExport({ settings: side.build.state.settings, experiments: side.build.state.experiments }), /^buildRange = 8\b/m)
  // And a Hatchery is one of the buildings that project one: every building the player places does.
  assert.equal(FIXTURE_REGISTRY.get(HATCHERY).constructionRadius, 6)
})

// --- The room a building that makes units keeps ---------------------------------------------------------------

test("a Barracks keeps a tile of room round it: nothing may stand beside it, and the refusal says why", () => {
  const context = starterContext()
  // The standing Barracks is 25,10 to 27,11. Beside it to the east, refused; a tile further, or at its corner
  // (three away, as range is measured: a row counts two columns), allowed.
  assert.deepEqual(legal(context, [], TURRET, { x: 28, y: 10 }), { ok: false, reason: "too close to the Barracks - its troops need room" })
  assert.ok(legal(context, [], TURRET, { x: 29, y: 10 }).ok)
  assert.ok(legal(context, [], TURRET, { x: 28, y: 12 }).ok)
  // Through the reducer: the bottom line says it, as every refusal does.
  const side = buildSide()
  keys(side, "3")
  moveTo(side, { x: 28, y: 10 })
  keys(side, ENTER)
  assert.equal(side.build.state.planned.length, 0)
  assert.equal(side.build.state.status.text, "Cannot build here: too close to the Barracks - its troops need room.")
  assert.ok(side.build.state.status.text.length <= 76, "the refusal does not fit the bottom line")
})

test("the room holds both ways, against every building on the map: the Nexus, a planned one, the raid's", () => {
  const context = starterContext()
  // A Barracks beside the Nexus (17,10 to 19,11): its own troops need the room, so it names what it is too near.
  assert.deepEqual(legal(context, [], BARRACKS, { x: 21, y: 11 }), { ok: false, reason: "too close to the Citizen Nexus - troops need room" })
  assert.ok(legal(context, [], BARRACKS, { x: 22, y: 11 }).ok, "two tiles off the Nexus")
  // Beside a planned Turret, the same.
  const planned = [turretAt(1, { x: 19, y: 13 })]
  assert.deepEqual(legal(context, planned, BARRACKS, { x: 21, y: 13 }), { ok: false, reason: "too close to the Turret - troops need room" })
  assert.ok(legal(context, [], BARRACKS, { x: 21, y: 13 }).ok)
  // A Hatchery under the standing Barracks is in the Barracks's room.
  assert.deepEqual(legal(context, [], HATCHERY, { x: 25, y: 12 }), { ok: false, reason: "too close to the Barracks - its troops need room" })
  // The raid's den, standing on the field: a Barracks may not stand beside it, a Turret may.
  const raided: BuildContext = { ...context, field: [{ contentId: DEN, anchor: { x: 13, y: 7 }, player: "B", hp: 90 }] }
  assert.deepEqual(legal(raided, [], BARRACKS, { x: 17, y: 7 }), { ok: false, reason: "too close to the Den - troops need room" })
  assert.ok(legal(raided, [], TURRET, { x: 16, y: 8 }).ok)
  // A unit is no building: Vasse, arriving in the middle of the squad's line, takes no room from a Barracks placed
  // right under her.
  assert.ok((context.incoming ?? []).some((unit) => unit.contentId === "unit.citizen.vasse" && unit.anchor.x === 22 && unit.anchor.y === 10))
  assert.ok(legal(context, [], BARRACKS, { x: 22, y: 11 }).ok)
})

test("the room names the nearest building too close, and is measured as range is", () => {
  const registry = FIXTURE_REGISTRY
  const buildings = [
    { contentId: NEXUS, anchor: { x: 0, y: 0 } },
    { contentId: TURRET, anchor: { x: 10, y: 0 } },
  ]
  // A Barracks anchored at 7,0 (7 to 9) is a tile from the Turret at 10,0 and five from the Nexus's east edge:
  // the Turret is named, and the room is the Barracks's own.
  assert.deepEqual(crowding(registry, buildings, BARRACKS, { x: 7, y: 0 }), { near: buildings[1], room: "own" })
  assert.equal(footprintDistance({ x: 7, y: 0 }, registry.get(BARRACKS).footprint, buildings[1]!.anchor, registry.get(TURRET).footprint), 1)
  // Anchored at 4,0 it is two from the Nexus, as range is measured, and a tile clear of both.
  assert.equal(crowding(registry, buildings, BARRACKS, { x: 4, y: 0 }), null)
  // Anchored at 3,0 (3 to 5), with a third Turret at 6,0, it is a tile from the Nexus and from that Turret: the
  // nearest is named, and on a tie the first listed.
  assert.deepEqual(crowding(registry, [...buildings, { contentId: TURRET, anchor: { x: 6, y: 0 } }], BARRACKS, { x: 3, y: 0 }), {
    near: buildings[0],
    room: "own",
  })
  // Nothing keeps room between two buildings that make no units.
  assert.equal(crowding(registry, buildings, TURRET, { x: 11, y: 0 }), null)
  // Two Barracks: the one placed near another stands in that one's room.
  assert.deepEqual(crowding(registry, [{ contentId: BARRACKS, anchor: { x: 0, y: 10 } }], BARRACKS, { x: 3, y: 10 }), {
    near: { contentId: BARRACKS, anchor: { x: 0, y: 10 } },
    room: "its",
  })
})

test("arming a building that makes units proposes only a spot that leaves its room, and its neighbours', free", () => {
  for (const cursor of [{ x: 26, y: 13 }, { x: 21, y: 11 }, { x: 18, y: 10 }]) {
    const side = buildSide({ cursor })
    keys(side, "1")
    const spot = side.build.state.cursor
    const anchor = anchorForCursor(spot, FIXTURE_REGISTRY.get(BARRACKS).footprint)
    assert.ok(legalityAt(side.context, [], BARRACKS, anchor).ok, `arming from ${cursor.x},${cursor.y} proposed ${spot.x},${spot.y}, which Enter refuses`)
    for (const building of side.context.standing) {
      const distance = footprintDistance(anchor, FIXTURE_REGISTRY.get(BARRACKS).footprint, building.anchor, FIXTURE_REGISTRY.get(building.contentId).footprint)
      assert.ok(distance >= 2, `${spot.x},${spot.y} is ${distance} from the ${building.contentId}`)
    }
  }
  // Looking for a spot for one tile, as Explore Map does, knows no room.
  assert.deepEqual(armingSpot(starterContext(), [], [{ x: 0, y: 0 }], { x: 28, y: 10 }), { tile: { x: 28, y: 10 }, found: true })
})

test("how much room is an Experiment: 1 or 2 tiles, felt at once, and written into the export", () => {
  const spec = shownSetting("spawnClearance")
  assert.equal(spec.tier, "experiment")
  assert.equal(spec.section, "mission")
  assert.equal(spec.label, "Spawn space")
  assert.deepEqual(spec.values, [1, 2])
  assert.equal(defaultValue("spawnClearance"), 1)
  assert.equal(spec.applies, "now")
  assert.doesNotMatch(spec.question, /\((F|Q)\d+\)/)
  // A Turret two columns beside the Barracks: placed at 1, refused at 2, without a restart.
  const context = { ...starterContext(), allotment: 1000 }
  assert.ok(legal(context, [], TURRET, { x: 29, y: 10 }, undefined, 1).ok)
  assert.equal(legal(context, [], TURRET, { x: 29, y: 10 }, undefined, 2).ok, false)
  const side = buildSide({ context })
  side.build.dispatch({ kind: "experiment-adjust", field: "spawnClearance", step: 1 })
  assert.equal(side.build.state.experiments.spawnClearance, 2)
  keys(side, "3")
  moveTo(side, { x: 29, y: 10 })
  keys(side, ENTER)
  assert.equal(side.build.state.planned.length, 0)
  assert.equal(side.build.state.status.text, "Cannot build here: too close to the Barracks - its troops need room.")
  side.build.dispatch({ kind: "experiment-adjust", field: "spawnClearance", step: -1 })
  keys(side, ENTER)
  assert.equal(side.build.state.planned.length, 1, side.build.state.status.text)
  assert.match(formatSettingsExport({ settings: side.build.state.settings, experiments: side.build.state.experiments }), /^spawnClearance = 1\b/m)
  // At 2 a Barracks still has somewhere to go at the default build range: a tile of it in range, three off
  // everything else.
  const room = buildSide({ context: { ...context, experiments: { spawnClearance: 2 } } })
  keys(room, "1")
  assert.equal(room.build.state.noSpotFound, false, room.build.state.status.text)
  const anchor = anchorForCursor(room.build.state.cursor, FIXTURE_REGISTRY.get(BARRACKS).footprint)
  assert.ok(legalityAt(room.context, [], BARRACKS, anchor, undefined, defaultValue("buildRange"), 2).ok)
})
