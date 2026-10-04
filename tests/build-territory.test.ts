// Construction territory — the build range (the owner, round 4: buildings "can only be built within the
// build-range of the other buildings"): the Grid Nexus roots it, buildings link where their ranges meet, a
// new building must stand wholly inside it, a planned one extends it at once, and a removal may not strand
// what the plan built on it. The rule is the reducer's (`src/build/territory.ts`, `src/build/state.ts`); how
// it is drawn is tests/build-areas.test.ts's.

import { test } from "node:test"
import assert from "node:assert/strict"
import { defaultValue, shownSetting } from "../src/build/all-settings.ts"
import { formatSettingsExport } from "../src/build/settings-export.ts"
import type { BuildContext } from "../src/build/state.ts"
import { anchorForCursor, legalityAt } from "../src/build/state.ts"
import { placeableOrdinals, strandedByRemoving, territoryOf } from "../src/build/territory.ts"
import type { PlannedPlacement } from "../src/build/types.ts"
import { starterContext } from "../src/cli/starter.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { Coord, TerrainId } from "../src/grid/types.ts"
import { BACKSPACE, ENTER, buildSide, keys } from "./build-helpers.ts"
import type { Side } from "./build-helpers.ts"

const NEXUS = "structure.citizen.nexus"
const BARRACKS = "structure.citizen.barracks"
const TURRET = "structure.bench.beamturret"
const HATCHERY = "structure.bench.hatchery"

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

// --- The rule ---------------------------------------------------------------------------------------

test("the Grid Nexus roots the build range: three tiles round it to begin with, measured as range is", () => {
  const context = starterContext()
  assert.equal(defaultValue("buildRange"), 3)
  const territory = territoryOf(context, [], defaultValue("buildRange"))
  assert.equal(territory.rooted, true)
  // The Nexus stands at 17,10 to 19,11: Manhattan to its nearest tile, west, north and south.
  for (const tile of [{ x: 14, y: 10 }, { x: 18, y: 7 }, { x: 18, y: 14 }, { x: 16, y: 13 }]) assert.ok(territory.has(tile), `${tile.x},${tile.y} is inside`)
  for (const tile of [{ x: 13, y: 10 }, { x: 18, y: 6 }, { x: 18, y: 15 }, { x: 15, y: 13 }]) assert.ok(!territory.has(tile), `${tile.x},${tile.y} is outside`)
})

test("buildings link where their ranges meet: the Barracks beside the Nexus links at 3, and is cut off at 2", () => {
  const context = starterContext()
  // Six tiles apart: at 3 their ranges share a column, so the Barracks links and lends its range.
  const three = territoryOf(context, [], 3)
  assert.deepEqual(three.members.map((member) => [member.contentId, member.linked]), [[NEXUS, true], [BARRACKS, true]])
  assert.ok(three.has({ x: 30, y: 10 }), "the linked Barracks gives its range")
  // At 2 they do not meet: the Barracks keeps standing, and gives nothing.
  const two = territoryOf(context, [], 2)
  assert.deepEqual(two.members.map((member) => [member.contentId, member.linked]), [[NEXUS, true], [BARRACKS, false]])
  assert.ok(!two.has({ x: 28, y: 10 }), "a cut-off building gave a build range")
  assert.match(legal(context, [], TURRET, { x: 28, y: 10 }, 2).ok ? "" : "refused", /refused/)
  // A Turret between them links it again: its range meets both.
  const bridged = territoryOf(context, [turretAt(1, { x: 21, y: 10 })], 2)
  assert.ok(bridged.members.every((member) => member.linked))
  assert.ok(bridged.has({ x: 28, y: 10 }))
})

test("with no Grid Nexus standing there is nothing to build from", () => {
  const context: BuildContext = { ...starterContext(), standing: [{ contentId: BARRACKS, anchor: { x: 25, y: 10 } }] }
  const territory = territoryOf(context, [], 3)
  assert.equal(territory.rooted, false)
  assert.ok(!territory.has({ x: 26, y: 13 }))
  const refused = legal(context, [], TURRET, { x: 26, y: 13 })
  assert.deepEqual(refused, { ok: false, reason: "there is no Nexus to build from" })
})

test("a building stands wholly inside the build range, and the refusal names the first tile outside it", () => {
  const context = starterContext()
  // Centred three rows south of the Nexus, a Barracks's top row is inside and its bottom row is not.
  const refused = legal(context, [], BARRACKS, { x: 18, y: 14 })
  assert.deepEqual(refused, { ok: false, reason: "outside your build range", tile: { x: 17, y: 15 } })
  // A row up, it fits.
  assert.ok(legal(context, [], BARRACKS, { x: 18, y: 13 }).ok)
  // A Turret is one tile: on the range's last row it fits.
  assert.ok(legal(context, [], TURRET, { x: 18, y: 14 }).ok)
})

test("a planned building extends the build range at once, so a plan chains outward", () => {
  const context = starterContext()
  // Six rows south of the Nexus is past its range...
  assert.equal(legal(context, [], TURRET, { x: 19, y: 17 }).ok, false)
  // ...and inside the range of a Turret planned on the range's edge.
  const planned = [turretAt(1, { x: 19, y: 14 })]
  assert.ok(legal(context, planned, TURRET, { x: 19, y: 17 }).ok)
  // Through the reducer, the same.
  const side = buildSide()
  placeTurret(side, { x: 19, y: 14 })
  placeTurret(side, { x: 19, y: 17 })
  assert.equal(side.build.state.planned.length, 2, side.build.state.status.text)
})

test("placing outside the build range is refused in words, naming the tile, and nothing moves", () => {
  const side = buildSide()
  keys(side, "3")
  moveTo(side, { x: 31, y: 10 })
  // Looking reads quietly; trying is the reducer's own answer, in the danger tone, and the cursor stays.
  keys(side, ENTER)
  assert.equal(side.build.state.planned.length, 0)
  assert.equal(side.build.state.status.text, "Cannot build here: outside your build range at 31,10.")
  assert.equal(side.build.state.status.tone, "danger")
  assert.deepEqual(side.build.state.cursor, { x: 31, y: 10 })
})

test("arming proposes only a spot inside the build range, and says so when none is near", () => {
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

// --- Removing and undoing --------------------------------------------------------------------------------

test("removing a planned building another one needs is refused, naming the one that needs it", () => {
  const side = buildSide({ context: { ...starterContext(), allotment: 1000 } })
  placeTurret(side, { x: 19, y: 14 })
  placeTurret(side, { x: 19, y: 17 }) // only the first one's range reaches it
  assert.equal(side.build.state.planned.length, 2)
  // Backspace on the first: refused, so a building put down only to reach further cannot be taken away.
  removeAt(side, { x: 19, y: 14 })
  assert.equal(side.build.state.planned.length, 2)
  assert.equal(side.build.state.status.text, "Cannot remove the Turret: the Turret at 19,17 needs its build range.")
  assert.equal(side.build.state.status.tone, "warning")
  // The one that needs it first, then the other: both go.
  removeAt(side, { x: 19, y: 17 })
  removeAt(side, { x: 19, y: 14 })
  assert.equal(side.build.state.planned.length, 0)
})

test("undo is refused the same way, and a building cut off from the Nexus by a removal may still stand", () => {
  // An open field with a Nexus at its west edge (0,4 to 2,5): two Turrets each reach the third, so removing the
  // first is allowed — the third stands in the second's range — and then undoing the second is not.
  const width = 20
  const height = 12
  const open: BuildContext = {
    ...starterContext(),
    grid: { width, height, tiles: new Array<TerrainId>(width * height).fill("terrain.plain") },
    standing: [{ contentId: NEXUS, anchor: { x: 0, y: 4 } }],
    allotment: 1000,
  }
  const side = buildSide({ context: open, cursor: { x: 4, y: 5 } })
  placeTurret(side, { x: 4, y: 5 })
  placeTurret(side, { x: 5, y: 7 }) // past the Nexus's range: in the first Turret's
  placeTurret(side, { x: 2, y: 7 }) // in the Nexus's range, and its range reaches 5,7 too
  assert.equal(side.build.state.planned.length, 3, side.build.state.status.text)
  removeAt(side, { x: 4, y: 5 })
  assert.equal(side.build.state.planned.length, 2, "the first could go: the third Turret holds the second up")
  keys(side, "u")
  assert.equal(side.build.state.planned.length, 2)
  assert.equal(side.build.state.status.text, "Cannot undo the Turret: the Turret at 5,7 needs its build range.")

  // What the closure says, directly: the plan stays one that could be placed, a building at a time.
  const plan = side.build.state.planned
  assert.deepEqual([...placeableOrdinals(open, plan, 3)].sort(), plan.map((placement) => placement.ordinal).sort())
  assert.deepEqual(strandedByRemoving(open, plan, plan[1]!.ordinal, 3).map((placement) => placement.anchor), [{ x: 5, y: 7 }])

  // A standing building is no reason to refuse: on the starter map at 2, a Turret bridging the Nexus and the
  // Barracks is removed freely, and the Barracks is cut off again.
  const standing = buildSide({ context: { ...starterContext(), experiments: { buildRange: 2 } } })
  placeTurret(standing, { x: 21, y: 10 })
  assert.equal(standing.build.state.planned.length, 1)
  keys(standing, "u")
  assert.equal(standing.build.state.planned.length, 0)
})

// --- The Experiment ------------------------------------------------------------------------------------

test("the build range is an Experiment: 2, 3 or 4 tiles, felt at once, and written into the export", () => {
  const spec = shownSetting("buildRange")
  assert.equal(spec.tier, "experiment")
  assert.equal(spec.section, "mission")
  assert.deepEqual(spec.values, [2, 3, 4])
  assert.equal(spec.applies, "now")
  assert.doesNotMatch(spec.question, /\((F|Q)\d+\)/)
  // A Turret four tiles from the Barracks: refused at 3, placed once the range is 4, without a restart.
  const side = buildSide({ context: { ...starterContext(), allotment: 1000 } })
  keys(side, "3")
  moveTo(side, { x: 23, y: 13 })
  keys(side, ENTER)
  assert.equal(side.build.state.planned.length, 0)
  side.build.dispatch({ kind: "experiment-adjust", field: "buildRange", step: 1 })
  assert.equal(side.build.state.experiments.buildRange, 4)
  keys(side, ENTER)
  assert.equal(side.build.state.planned.length, 1, side.build.state.status.text)
  assert.match(formatSettingsExport({ settings: side.build.state.settings, experiments: side.build.state.experiments }), /^buildRange = 4\b/m)
  // And a Hatchery is one of the buildings that project one: every building the player places does.
  assert.equal(FIXTURE_REGISTRY.get(HATCHERY).constructionRadius, 3)
})
