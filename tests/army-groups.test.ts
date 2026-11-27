// Army groups (`src/engine/pulse/army-groups.ts`; movement.md, its words): a side's units that can fight together, each
// within 5 tiles of another in it, chained; the Nexus a group of its own; a building that shoots joins one. Read by the
// march (who walks at half speed), by an army group that arrives at its rally point (its slots) and by the regroup.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { Coord } from "../src/engine/geometry/types.ts"
import type { PlayerId } from "../src/engine/state/types.ts"
import type { Body } from "../src/engine/pulse/army-groups.ts"
import { ARMY_GROUP_REACH, armyGroupRole, armyGroupsOf, gapBetween, nearestEnemyGroup } from "../src/engine/pulse/army-groups.ts"
import { ENGAGEMENT_REACH } from "../src/battle/reading/engagements.ts"
import { footprintDistance } from "../src/engine/geometry/coords.ts"

const TROOPER = "unit.citizen.trooper"
const MARKSMAN = "unit.citizen.marksman"

let next = 0
function body(player: PlayerId, contentId: string, x: number, y: number): Body {
  next += 1
  return { ordinal: next, player, anchor: { x, y }, definition: FIXTURE_REGISTRY.get(contentId) }
}

const ordinalsOf = (bodies: readonly Body[]): number[] => bodies.map((each) => each.ordinal)

test("an army group's reach is the engagement's: the round's report and the troops' aiming share one rule", () => {
  assert.equal(ARMY_GROUP_REACH, ENGAGEMENT_REACH)
  assert.equal(ARMY_GROUP_REACH, 5)
})

test("units chain within 5 tiles, a row counting two columns: 5 columns apart is one group, 6 is two, and so is 3 rows", () => {
  const a = body("A", TROOPER, 10, 5)
  const b = body("A", TROOPER, 15, 5)
  const c = body("A", TROOPER, 21, 5)
  const d = body("A", TROOPER, 15, 8)
  const groups = armyGroupsOf([a, b, c, d])
  assert.deepEqual(
    groups.map((group) => ordinalsOf(group.members)),
    [[a.ordinal, b.ordinal], [c.ordinal], [d.ordinal]],
  )
  // Chained: two ends 10 columns apart are one group through the one between.
  const e = body("A", TROOPER, 20, 5)
  assert.equal(armyGroupsOf([a, b, e]).length, 1)
})

test("who is in one: units that fight, flyers too, and buildings that shoot; never a worker or a building that only trains; the Nexus alone", () => {
  assert.equal(armyGroupRole(FIXTURE_REGISTRY.get(TROOPER)), "member")
  assert.equal(armyGroupRole(FIXTURE_REGISTRY.get("unit.bench.skyraider")), "member")
  assert.equal(armyGroupRole(FIXTURE_REGISTRY.get("unit.bench.bomber")), "member")
  assert.equal(armyGroupRole(FIXTURE_REGISTRY.get("structure.bench.beamturret")), "member")
  assert.equal(armyGroupRole(FIXTURE_REGISTRY.get("unit.citizen.worker")), null)
  assert.equal(armyGroupRole(FIXTURE_REGISTRY.get("structure.bench.barracks")), null)
  assert.equal(armyGroupRole(FIXTURE_REGISTRY.get("structure.bench.nexus")), "nexus")
  // A Barracks between two squads joins nothing; a turret between them chains them; a Nexus beside them chains nobody.
  const west = body("A", TROOPER, 10, 5)
  const east = body("A", TROOPER, 20, 5)
  const barracks = body("A", "structure.bench.barracks", 14, 5)
  assert.equal(armyGroupsOf([west, east, barracks]).length, 2)
  const turret = body("A", "structure.bench.beamturret", 15, 5)
  assert.deepEqual(armyGroupsOf([west, east, turret]).map((group) => group.members.length), [3])
  const nexus = body("A", "structure.bench.nexus", 12, 4)
  const withNexus = armyGroupsOf([west, nexus])
  assert.deepEqual(withNexus.map((group) => [group.nexus, group.members.length]), [[true, 1], [false, 1]])
  // Two sides never chain, however near.
  assert.equal(armyGroupsOf([west, body("B", TROOPER, 11, 5)]).length, 2)
})

test("its centre is its Commander when she is in it, else the member nearest its middle", () => {
  const squad = [body("A", TROOPER, 10, 5), body("A", TROOPER, 12, 5), body("A", TROOPER, 14, 5)]
  assert.equal(armyGroupsOf(squad)[0]?.centre.ordinal, squad[1]?.ordinal)
  const vasse = body("A", "unit.citizen.vasse", 16, 5)
  assert.equal(armyGroupsOf([...squad, vasse])[0]?.centre.ordinal, vasse.ordinal)
})

test("the nearest enemy army group is the one with the smallest gap, body to body; a lone building that shoots is one", () => {
  const squad = armyGroupsOf([body("A", TROOPER, 20, 10), body("A", MARKSMAN, 18, 10)])
  const nexus = body("B", "structure.bench.nexus", 40, 10)
  const turret = body("B", "structure.bench.beamturret", 20, 4)
  const groups = [...squad, ...armyGroupsOf([nexus, turret])]
  const own = groups.find((group) => group.player === "A") as (typeof groups)[number]
  const nearest = nearestEnemyGroup(own, groups)
  assert.deepEqual(ordinalsOf(nearest?.members ?? []), [turret.ordinal])
  // The gap is counted two ways: the battlefield's distance between the two nearest bodies.
  const expected = Math.min(...own.members.map((member) => footprintDistance(member.anchor, member.definition.footprint, turret.anchor, turret.definition.footprint)))
  assert.equal(gapBetween(own, nearest as (typeof groups)[number]), expected)
})

test("army groups are the same whatever order the bodies come in, and a mirrored battlefield groups mirrored", () => {
  const width = 40
  const placed: Array<[PlayerId, string, Coord]> = [
    ["A", TROOPER, { x: 3, y: 2 }],
    ["A", TROOPER, { x: 7, y: 3 }],
    ["A", MARKSMAN, { x: 12, y: 3 }],
    ["A", TROOPER, { x: 20, y: 8 }],
    ["A", "structure.bench.beamturret", { x: 24, y: 8 }],
  ]
  const make = (mirror: boolean): Body[] =>
    placed.map(([player, content, at], index) => ({ ordinal: index + 1, player, anchor: mirror ? { x: width - 1 - at.x, y: at.y } : at, definition: FIXTURE_REGISTRY.get(content) }))
  const sets = (bodies: readonly Body[]): string[] => armyGroupsOf(bodies).map((group) => ordinalsOf(group.members).join(",")).sort()
  assert.deepEqual(sets(make(false)), sets(make(true)))
  assert.deepEqual(sets(make(false)), sets([...make(false)].reverse()))
})
