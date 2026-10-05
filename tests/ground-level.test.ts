// The Ground test (`ground-test`, the last level of Vasse's campaign, `armies/vasse/army.json`): the place to feel
// the Ground Experiment (the Commander round 6). A terminal cell is about twice as tall as it is wide, and the rules
// count a row like a column, so the level puts two raids the same distance from the Nexus on screen — one 12 rows
// above its top edge, one 24 columns past its right edge — and asks which arrives first. Under the rules as they
// are the northern raid does; with rows counting double the two arrive together. Round 2 brings slingers the same
// two ways, so a ranged reach is seen in battle. The playable page opens it under each Ground choice
// (`scripts/demos/ground.json`).

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import all from "../armies/all/army.json" with { type: "json" }
import vasse from "../armies/vasse/army.json" with { type: "json" }
import { ARMIES, PERIMETER_LEVEL, campaignLevel, loadArmies } from "../src/armies/index.ts"
import { centreOn } from "../src/build/camera.ts"
import { buildLayout } from "../src/build/layout.ts"
import { MAPS, OPEN_GROUND_SIZE } from "../src/build/maps.ts"
import { importSettings } from "../src/build/settings-export.ts"
import type { BuildContext, BuildState } from "../src/build/state.ts"
import { applyBuildCommand, createBuildState, nexusTile, withoutScene } from "../src/build/state.ts"
import type { RaidGroup } from "../src/build/types.ts"
import { GROUNDS } from "../src/build/ground.ts"
import type { Ground } from "../src/build/ground.ts"
import { defaultsOn } from "../src/build/all-settings.ts"
import type { PlayableLevel } from "../src/cli/levels.ts"
import { DEFAULT_LEVEL, levelById, openRound } from "../src/cli/levels.ts"
import { formatRoute, parseRoute } from "../src/cli/route.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { tilesOf } from "../src/grid/coords.ts"
import type { Coord } from "../src/grid/types.ts"
import { TERRAIN } from "../src/grid/types.ts"
import { validateMission } from "../src/mission/index.ts"
import { DEFAULT_SETTINGS } from "../src/settings/types.ts"
import { checkDemos } from "../src/web/demos.ts"
import { REPO_ROOT } from "./helpers.ts"

const ROUTE = "campaign?level=ground-test"
const NEXUS = "structure.citizen.nexus"

/** The level, as the screens open it. */
function groundTest(): PlayableLevel {
  const level = levelById("ground-test")
  assert.ok(level !== undefined, "the game has no Ground test")
  return level
}

/** A round's Build Phase as it opens at 80 x 24, the first Nexus power picked as a route's walk picks it, under a
 *  Ground choice (as now unless one is named). */
function opened(context: BuildContext, ground: Ground = "as-now"): BuildState {
  const viewport = buildLayout({ columns: 80, rows: 24 }, context.grid).viewport
  const experiments = { ...defaultsOn("experiment"), ground }
  const state = createBuildState(withoutScene(context), nexusTile(context) ?? { x: 0, y: 0 }, viewport, experiments)
  return applyBuildCommand(context, state, { kind: "pick-nexus", index: 0 })
}

/** The Grid Nexus's tiles on the round's map. */
function nexusTiles(context: BuildContext): Coord[] {
  const nexus = context.standing.find((structure) => structure.contentId === NEXUS)
  assert.ok(nexus !== undefined, "no Nexus stands on open ground")
  return tilesOf(nexus.anchor, context.registry.get(NEXUS).footprint)
}

type Box = Readonly<{ left: number; right: number; top: number; bottom: number }>

const boxOf = (tiles: readonly Coord[]): Box => ({
  left: Math.min(...tiles.map((tile) => tile.x)),
  right: Math.max(...tiles.map((tile) => tile.x)),
  top: Math.min(...tiles.map((tile) => tile.y)),
  bottom: Math.max(...tiles.map((tile) => tile.y)),
})

/** The raid's groups the round brings, as the Build Phase foresees them: the northern one first. */
function raidOf(level: PlayableLevel, context: BuildContext): Readonly<{ north: RaidGroup; east: RaidGroup }> {
  const raid = level.play.foresee(context, opened(context)).filter((group) => group.player === "B")
  assert.equal(raid.length, 2, `round ${context.round?.number} should bring two groups, not ${raid.length}`)
  const nexus = boxOf(nexusTiles(context))
  const north = raid.find((group) => boxOf(group.tiles).bottom < nexus.top)
  const east = raid.find((group) => boxOf(group.tiles).left > nexus.right)
  assert.ok(north !== undefined && east !== undefined, "the raid does not come from the north and the east")
  return { north, east }
}

test("the route opens the Ground test, a level of Vasse's campaign whose army validates", () => {
  const level = groundTest()
  assert.equal(level.title, "Ground test")
  assert.equal(level.campaign, "vasse")
  assert.equal(level.rounds, 2)
  for (const round of [1, 2]) {
    const route = round === 1 ? ROUTE : `${ROUTE}&round=${round}`
    const destination = parseRoute(route)
    assert.ok(destination.kind === "level" && destination.level === level && destination.round === round, `${route} opens another place`)
    assert.equal(formatRoute(destination), route)
    assert.equal(openRound(level, round).round?.number, round)
  }

  // Its army loads, its mission checks against its own map, and that map is open ground.
  assert.doesNotThrow(() => loadArmies([all, vasse], { registry: FIXTURE_REGISTRY, maps: MAPS }))
  const entry = campaignLevel("ground-test")
  assert.equal(ARMIES.levels.at(-1), entry, "the Ground test is not the campaign's last level")
  assert.equal(entry.map, "open-ground")
  const map = MAPS[entry.map]
  assert.ok(map !== undefined)
  assert.doesNotThrow(() => validateMission(entry.mission, map.grid(), FIXTURE_REGISTRY))
  assert.deepEqual([map.grid().width, map.grid().height], [OPEN_GROUND_SIZE.width, OPEN_GROUND_SIZE.height])
  assert.deepEqual(map.startCursor, nexusTile({ registry: FIXTURE_REGISTRY, standing: map.standing }), "the map's cursor does not open on its Nexus")

  // It offers what PERIMETER unlocked, nothing new, with credits for about two Turrets and a Barracks.
  assert.deepEqual(entry.unlocked, { buildings: [], powers: [] })
  assert.deepEqual(entry.offer.buildings, PERIMETER_LEVEL.offer.buildings)
  assert.deepEqual(entry.offer.powers, PERIMETER_LEVEL.offer.powers)
  const cost = (id: string): number => entry.offer.buildings.find((card) => card.id === id)?.cost ?? Number.NaN
  assert.equal(entry.offer.credits, 2 * cost("turret") + cost("barracks"))
  // A Grid Nexus and a Barracks stand on it, so troopers come out in their wave.
  assert.deepEqual(map.standing.map((structure) => structure.contentId), [NEXUS, "structure.citizen.barracks"])

  // And PERIMETER is still the level the game opens when told nothing, on its own map.
  assert.equal(DEFAULT_LEVEL.id, "vasse-test-1")
  assert.equal(PERIMETER_LEVEL.map, "starter")
})

test("round 1: two raids the same distance from the Nexus on screen, 12 rows north and 24 columns east, the same kind and count, on the same tick, both going for the Nexus", () => {
  const level = groundTest()
  const context = openRound(level, 1)
  const nexus = boxOf(nexusTiles(context))
  const { north, east } = raidOf(level, context)

  // Due north: over the Nexus's columns, its front row 12 rows above the Nexus's top edge.
  const above = boxOf(north.tiles)
  assert.ok(above.left >= nexus.left && above.right <= nexus.right, `the northern raid stands at columns ${above.left} to ${above.right}, not over the Nexus`)
  assert.equal(nexus.top - above.bottom, 12, "the northern raid's front is not 12 rows above the Nexus")
  // Due east: level with the Nexus's rows, its front 24 columns past the Nexus's right edge.
  const beside = boxOf(east.tiles)
  assert.ok(beside.top >= nexus.top && beside.bottom <= nexus.bottom, `the eastern raid stands at rows ${beside.top} to ${beside.bottom}, not level with the Nexus`)
  assert.equal(beside.left - nexus.right, 24, "the eastern raid's front is not 24 columns past the Nexus")
  // A row is about two columns tall: the same distance on screen.
  assert.equal(2 * (nexus.top - above.bottom), beside.left - nexus.right)

  // The same kind and count, arriving together, as the round starts.
  assert.deepEqual(north.units, east.units)
  assert.deepEqual(north.units, [{ contentId: "unit.ravel.raider", count: 2 }])
  assert.deepEqual([north.tick, east.tick], [0, 0])
  // Both go for the Nexus first: the kernel's own first choice, with nothing built.
  for (const group of [north, east]) assert.equal(group.target?.contentId, NEXUS, `${group.group} goes for ${group.target?.contentId}`)
})

test("nothing stands in either raid's way, and at 80 x 24 the battle's camera shows both raids and the Nexus at once", () => {
  const level = groundTest()
  const context = openRound(level, 1)
  const nexus = boxOf(nexusTiles(context))
  const { north, east } = raidOf(level, context)
  const { grid } = context
  const plain = (x: number, y: number): boolean => !TERRAIN[grid.tiles[y * grid.width + x] ?? "terrain.plain"].impassable
  for (let y = boxOf(north.tiles).bottom + 1; y < nexus.top; y += 1) {
    for (let x = nexus.left; x <= nexus.right; x += 1) assert.ok(plain(x, y), `rock at ${x},${y}, on the way down from the north`)
  }
  for (let x = nexus.right + 1; x < boxOf(east.tiles).left; x += 1) {
    for (let y = nexus.top; y <= nexus.bottom; y += 1) assert.ok(plain(x, y), `rock at ${x},${y}, on the way in from the east`)
  }
  // Each raid's path to the Nexus is the straight one, a tile a step.
  assert.equal(north.path.length, 11)
  assert.equal(east.path.length, 23)

  // A battle centres its camera on the Nexus. Open ground is as tall as the view at the floor, so that camera
  // has nowhere to go up or down, and everything the race needs is on screen from the battle's first frame.
  const viewport = buildLayout({ columns: 80, rows: 24 }, grid).viewport
  const centre = nexusTile(context)
  assert.ok(centre !== null)
  const camera = centreOn(centre, viewport, grid)
  for (const tile of [...north.tiles, ...east.tiles, ...nexusTiles(context)]) {
    const inView = tile.x >= camera.x && tile.x < camera.x + viewport.width && tile.y >= camera.y && tile.y < camera.y + viewport.height
    assert.ok(inView, `${tile.x},${tile.y} is off the battle's screen at 80 x 24`)
  }
})

/** On screen, how far a tile is from the Nexus, in columns: a row is about two columns tall, whatever the rules. */
function screenDistance(tile: Coord, nexus: Box): number {
  const dx = Math.max(nexus.left - tile.x, 0, tile.x - nexus.right)
  const dy = Math.max(nexus.top - tile.y, 0, tile.y - nexus.bottom)
  return dx + 2 * dy
}

/**
 * Round 1's battle under a Ground choice, with nothing built: the tick each raid's front first comes within 12 columns
 * of the Nexus on screen — halfway in from the 24 it starts at, and before the player's troops meet either raid, so
 * it is the walk alone that is timed, not who the troops reach first.
 */
function halfwayIn(ground: Ground) {
  const level = groundTest()
  const context = openRound(level, 1)
  const resolved = level.play.startPulse(context, opened(context, ground))
  assert.ok(resolved !== null)
  const { states } = resolved.timeline
  const nexus = boxOf(nexusTiles(context))
  const raiders = (states[0]?.entities ?? []).filter((entity) => entity.player === "B")
  const north = new Set(raiders.filter((entity) => entity.anchor.y < nexus.top).map((entity) => entity.ordinal))
  const east = new Set(raiders.filter((entity) => entity.anchor.x > nexus.right).map((entity) => entity.ordinal))
  assert.deepEqual([north.size, east.size], [2, 2])
  const start = (group: ReadonlySet<number>): number =>
    Math.min(...(states[0]?.entities ?? []).filter((entity) => group.has(entity.ordinal)).map((entity) => screenDistance(entity.anchor, nexus)))
  assert.deepEqual([start(north), start(east)], [24, 24], "the two raids do not start the same distance away on screen")
  const reached = (group: ReadonlySet<number>): number =>
    states.find((state) => state.entities.some((entity) => group.has(entity.ordinal) && screenDistance(entity.anchor, nexus) <= 12))?.tick ??
    Number.POSITIVE_INFINITY
  const [fromNorth, fromEast] = [reached(north), reached(east)]
  assert.ok(fromNorth < Number.POSITIVE_INFINITY && fromEast < Number.POSITIVE_INFINITY, "a raid never came halfway in")
  return { resolved, states, fromNorth, fromEast }
}

test("under the rules as they are, the northern raid comes twice as fast as the eastern one", () => {
  const { resolved, states, fromNorth, fromEast } = halfwayIn("as-now")
  // A row counts as a column, so 6 rows down is half the walk of 12 columns across.
  assert.ok(2 * fromNorth <= fromEast + 12, `the north came halfway in at tick ${fromNorth}, the east at ${fromEast}`)
  // A plan that builds nothing still holds round 1 with the Nexus whole, so the race is watched, not lost, and a
  // route reaches round 2.
  assert.equal(resolved.mission?.verdict.kind, "continue")
  const standing = states.at(-1)?.entities.find((entity) => entity.contentId === NEXUS)
  assert.equal(standing?.hp, FIXTURE_REGISTRY.get(NEXUS).maxHp)
})

test("with a row counting two columns the two raids come as fast as each other; sideways doubled, both as fast as the north did", () => {
  const now = halfwayIn("as-now")
  const rows = halfwayIn("rows-x2")
  const sideways = halfwayIn("sideways-x2")
  // The same distance on screen is the same walk, within a second, under either count. Not exactly: a rate's
  // remainder is dropped each step, as it always was, so a raider's step across and its step down round apart.
  for (const [name, run] of [["rows x2", rows], ["sideways x2", sideways]] as const) {
    assert.ok(Math.abs(run.fromNorth - run.fromEast) <= 12, `${name}: the north came halfway in at tick ${run.fromNorth}, the east at ${run.fromEast}`)
  }
  // Rows counting double walk the north as slowly as the east always walked; sideways doubled walks the east as
  // fast as the north always walked.
  assert.ok(Math.abs(rows.fromNorth - now.fromEast) <= 12, `rows x2 brought the north at tick ${rows.fromNorth}; as now the east came at ${now.fromEast}`)
  assert.ok(Math.abs(sideways.fromEast - now.fromNorth) <= 12, `sideways x2 brought the east at tick ${sideways.fromEast}; as now the north came at ${now.fromNorth}`)
})

test("round 2 brings ranged units from both directions, the same distance away, with melee beside them", () => {
  const level = groundTest()
  const context = openRound(level, 2)
  const nexus = boxOf(nexusTiles(context))
  const { north, east } = raidOf(level, context)
  const kinds = (group: RaidGroup): readonly string[] => group.units.map((entry) => FIXTURE_REGISTRY.get(entry.contentId).attack?.kind ?? "none")
  for (const group of [north, east]) {
    assert.ok(kinds(group).includes("ranged"), `${group.group} brings nothing ranged`)
    assert.ok(kinds(group).includes("melee"), `${group.group} brings no melee`)
    assert.equal(group.tick, 0)
  }
  assert.deepEqual(north.units, east.units)
  assert.equal(nexus.top - boxOf(north.tiles).bottom, 12)
  assert.equal(boxOf(east.tiles).left - nexus.right, 24)
  // The round has its own words for the Battle Round screen, as round 1 does.
  assert.match(context.roundText?.[2] ?? "", /[Ss]lingers/u)
  assert.match(context.roundText?.[1] ?? "", /how fast each one comes/u)
})

test("the playable page's demos open the Ground test under each Ground choice, and PERIMETER under rows x2", () => {
  const file = "scripts/demos/ground.json"
  const demos = checkDemos(JSON.parse(readFileSync(resolve(REPO_ROOT, file), "utf8")), file)
  // Where each opens and the ground it sets: every pair of its settings text read, none ignored — the page would
  // otherwise open it under another choice and only say so under the screen.
  const opening = demos.map((demo) => {
    const imported = importSettings(demo.settings, DEFAULT_SETTINGS)
    assert.deepEqual(imported.ignored, [], `${demo.label}'s settings text has what the game cannot read`)
    return [demo.label, demo.at ?? "", imported.experiments.ground] as const
  })
  assert.deepEqual(opening, [
    ["As now", ROUTE, "as-now"],
    ["Rows x2", ROUTE, "rows-x2"],
    ["Sideways x2", ROUTE, "sideways-x2"],
    ["Square tiles", ROUTE, "square-tiles"],
    ["PERIMETER, rows x2", formatRoute({ kind: "level", level: DEFAULT_LEVEL, round: 1 }), "rows-x2"],
  ])
  // One button for every choice the Experiment has.
  assert.deepEqual(opening.slice(0, GROUNDS.length).map(([, , ground]) => ground), [...GROUNDS])
  // Each says what to press and what to watch.
  for (const demo of demos) assert.match(demo.try, /press 3[^]*watch/iu, `${demo.label} does not say what to press and what to watch`)
})
