// Construction territory — the build range (the owner, round 4: buildings "can only be built within the
// build-range of the other buildings") as round 5 reshaped it: the Grid Nexus roots it and standing buildings
// link where their ranges meet; a building planned in this Build Phase gives no range until it stands, next
// round ("Expansing territory is only done at next round"); one tile of a new building inside the range is
// enough ("should allow to build if at least 1 building tile is within range"); and buildings may touch, as one
// that makes units sets them on its own roof (the pathfinding milestone). The rules are the reducer's
// (`src/build/territory.ts`, `src/build/state.ts`); how they are drawn is tests/build-areas.test.ts's.

import { test } from "node:test"
import assert from "node:assert/strict"
import { defaultValue, shownSetting } from "../src/build/all-settings.ts"
import { formatSettingsExport } from "../src/build/settings-export.ts"
import type { BuildContext } from "../src/build/state.ts"
import { anchorForCursor, armingSpot, buildRange, legalityAt } from "../src/build/state.ts"
import { territoryOf } from "../src/build/territory.ts"
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
function legal(context: BuildContext, planned: readonly PlannedPlacement[], contentId: string, tile: Coord, radius?: number) {
  return legalityAt(context, planned, contentId, anchorForCursor(tile, FIXTURE_REGISTRY.get(contentId).footprint), undefined, radius)
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

// --- Buildings may touch -------------------------------------------------------------------------------------

test("buildings may touch: one that makes units sets them on its own roof, so it keeps no room round it", () => {
  const context = starterContext()
  // The standing Barracks is 25,10 to 27,11: a Turret right beside it, a Hatchery right under it.
  assert.ok(legal(context, [], TURRET, { x: 28, y: 10 }).ok, "a Turret beside the Barracks")
  assert.ok(legal(context, [], HATCHERY, { x: 25, y: 12 }).ok, "a Hatchery under the Barracks")
  // A Barracks beside the Nexus (17,10 to 19,11), and a second beside the first: a block of them.
  assert.ok(legal(context, [], BARRACKS, { x: 21, y: 11 }).ok, "a Barracks beside the Nexus")
  const block: PlannedPlacement[] = [{ ordinal: 1, contentId: BARRACKS, anchor: anchorForCursor({ x: 21, y: 13 }, FIXTURE_REGISTRY.get(BARRACKS).footprint) }]
  assert.ok(legal(context, block, BARRACKS, { x: 24, y: 13 }).ok, "a Barracks beside a planned Barracks")
  // The raid's den is no different.
  const raided: BuildContext = { ...context, field: [{ contentId: DEN, anchor: { x: 13, y: 7 }, player: "B", hp: 90 }] }
  assert.ok(legal(raided, [], TURRET, { x: 16, y: 8 }).ok, "a Turret beside the Den")
  // A building still never stands on another.
  assert.equal(legal(context, block, BARRACKS, { x: 22, y: 13 }).ok, false)
  // And the Experiment that set how much room a Barracks kept is gone with it.
  assert.ok(!("spawnClearance" in (starterContext().experiments ?? {})), "the Spawn space Experiment is still felt")
})
