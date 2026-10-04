// Content bundles (src/bundles; the data in bundles/): what a Commander may build and draft, her campaign and its
// levels, written as data a modder can write, each bundle naming the bundles it builds on. The owner, 2026-10-04:
// "a tree where the campaign progression is at the top, depending on levels, that depend on buildings and units
// (that may be on the same bundle or another dependent bundle like the common)". A level offers what its campaign
// has unlocked by then; the loader refuses a broken bundle by name, every problem at once.

import { test } from "node:test"
import assert from "node:assert/strict"
import common from "../bundles/common/bundle.json" with { type: "json" }
import vasse from "../bundles/vasse/bundle.json" with { type: "json" }
import { constructMenu, nexusDraftOf, STARTER_ALLOTMENT, STARTER_CATALOG, STARTER_NEXUS_DRAFT } from "../src/build/catalog.ts"
import { MAPS } from "../src/build/maps.ts"
import type { Bundles, LoadWorld, Offer } from "../src/bundles/index.ts"
import { BUNDLES, BundleError, loadBundles, PERIMETER, PERIMETER_LEVEL } from "../src/bundles/index.ts"
import { levelContext, starterContext } from "../src/cli/starter.ts"
import type { ContentDef } from "../src/content/index.ts"
import { createRegistry, FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { MissionDefinition, TriggerDefinition } from "../src/mission/index.ts"
import { hashOf } from "../src/state/canonical.ts"
import { buildSide, compose, panelLines } from "./build-helpers.ts"

const WORLD: LoadWorld = { registry: FIXTURE_REGISTRY, maps: MAPS }

/** What loading `manifests` reports, or nothing when they load. */
function problemsOf(manifests: readonly unknown[], world: LoadWorld = WORLD): readonly string[] {
  try {
    loadBundles(manifests, world)
    return []
  } catch (error) {
    assert.ok(error instanceof BundleError, String(error))
    return error.problems
  }
}

/** A level on the starter map playing PERIMETER's mission under its own id. */
const level = (id: string, extra: object = {}): object => ({ id, map: "starter", credits: 100, mission: { ...PERIMETER, id: `mission.${id}` }, ...extra })

/** A bundle on top of Vasse's, with one campaign of `levels` that she leads. */
const campaignBundle = (levels: readonly object[], extra: object = {}): object => ({
  id: "test",
  title: "A test campaign",
  requires: ["vasse"],
  campaigns: [{ id: "test", title: "Test", commander: "vasse", levels }],
  ...extra,
})

/** The game's bundles and `more`, loaded. */
const withGame = (...more: readonly object[]): Bundles => loadBundles([common, vasse, ...more], WORLD)

/** An offer as a player reads it: each building and its cost, each power and its credits, the credits. */
const offered = (offer: Offer) => ({
  buildings: offer.buildings.map((card) => `${card.id} ${card.cost}`),
  powers: offer.powers.map((card) => `${card.name} +${card.effect.credits}`),
  credits: offer.credits,
})

/** `registry` with more content, for a test that needs content the game does not have. */
const registryWith = (...more: readonly ContentDef[]) => createRegistry([...FIXTURE_REGISTRY.ids().map((id) => FIXTURE_REGISTRY.get(id)), ...more])

// --- What the game ships ---------------------------------------------------------------------------------

test("the game ships two bundles: common, and Vasse's on top of it, her campaign's levels in order", () => {
  assert.deepEqual(
    BUNDLES.bundles.map((bundle) => [bundle.id, bundle.requires]),
    [
      ["common", []],
      ["vasse", ["common"]],
    ],
  )
  assert.deepEqual(BUNDLES.commanders, [{ id: "vasse", bundle: "vasse", name: "Edda Vasse", unit: "unit.citizen.vasse" }])
  assert.equal(BUNDLES.campaigns.length, 1)
  const [campaign] = BUNDLES.campaigns
  assert.ok(campaign !== undefined)
  assert.deepEqual([campaign.id, campaign.bundle, campaign.commander.unit], ["vasse", "vasse", "unit.citizen.vasse"])
  assert.deepEqual(
    campaign.levels.map((entry) => [entry.number, entry.id, entry.campaign, entry.map, entry.mission.name]),
    [
      [1, "vasse-test-1", "vasse", "starter", "Perimeter"],
      [2, "vasse-test-2", "vasse", "starter", "The Commander falls"],
    ],
  )
  assert.deepEqual(BUNDLES.levels, campaign.levels)
  // What the levels stand on is common's: the buildings and powers any Commander may use.
  const [shared] = BUNDLES.bundles
  assert.deepEqual(shared?.buildings?.map((card) => `${card.id} ${card.structure} ${card.cost}`), [
    "barracks structure.citizen.barracks 40",
    "hatchery structure.bench.hatchery 30",
    "turret structure.bench.beamturret 15",
  ])
  assert.deepEqual(shared?.powers?.map((card) => [card.name, card.description, card.effect.credits]), [
    ["Reserve Fund", "Adds 30 resource to spend.", 30],
    ["War Chest", "Adds 2000 resource to spend.", 2000],
  ])
})

test("a level offers what its campaign has unlocked by then: PERIMETER unlocks all of it, the cadence level nothing new", () => {
  const [perimeter, cadence] = BUNDLES.levels
  assert.ok(perimeter !== undefined && cadence !== undefined)
  const everything = {
    buildings: ["barracks 40", "hatchery 30", "turret 15"],
    powers: ["Reserve Fund +30", "War Chest +2000"],
    credits: 100,
  }
  assert.deepEqual(offered(perimeter.offer), everything)
  assert.deepEqual(perimeter.unlocked, { buildings: perimeter.offer.buildings, powers: perimeter.offer.powers })
  assert.deepEqual(offered(cadence.offer), everything)
  assert.deepEqual(cadence.unlocked, { buildings: [], powers: [] })
})

test("unlocks add up level by level, in the order unlocked, so no hotkey moves; each level sets its own credits", () => {
  const loaded = withGame(
    campaignBundle([
      level("test-1", { credits: 45, unlocks: { buildings: ["turret"], powers: ["reserve-fund"] } }),
      level("test-2", { credits: 60, unlocks: { buildings: ["barracks"] } }),
      level("test-3", { unlocks: { buildings: ["hatchery"], powers: ["war-chest"] } }),
    ]),
  )
  const levels = loaded.levels.filter((entry) => entry.campaign === "test")
  assert.deepEqual(
    levels.map((entry) => offered(entry.offer)),
    [
      { buildings: ["turret 15"], powers: ["Reserve Fund +30"], credits: 45 },
      { buildings: ["turret 15", "barracks 40"], powers: ["Reserve Fund +30"], credits: 60 },
      { buildings: ["turret 15", "barracks 40", "hatchery 30"], powers: ["Reserve Fund +30", "War Chest +2000"], credits: 100 },
    ],
  )
  // What is new in each: what the screen between levels shows.
  assert.deepEqual(
    levels.map((entry) => [...entry.unlocked.buildings.map((card) => card.id), ...entry.unlocked.powers.map((card) => card.id)]),
    [["turret", "reserve-fund"], ["barracks"], ["hatchery", "war-chest"]],
  )
  // The last level's menu keeps the first level's digit for the Turret.
  assert.deepEqual(
    constructMenu(levels[2]!.offer).map((item) => `${item.hotkey} ${item.label} ${item.cost}`),
    ["1 Turret 15", "2 Barracks 40", "3 Hatchery 30"],
  )
})

test("a level's offer is what its Build Phase offers: the menu, the credits and the Nexus draft", () => {
  const loaded = withGame(campaignBundle([level("test-1", { credits: 45, unlocks: { buildings: ["turret"], powers: ["reserve-fund"] } })]))
  const turretsOnly = loaded.levels.find((entry) => entry.id === "test-1")
  assert.ok(turretsOnly !== undefined)
  const context = levelContext(turretsOnly)
  assert.deepEqual(context.catalog.map((item) => `${item.hotkey} ${item.label} ${item.cost}`), ["1 Turret 15"])
  assert.equal(context.allotment, 45)
  assert.deepEqual(context.nexusDraft.map((power) => `${power.hotkey} ${power.name} +${power.bonusAllotment}`), ["1 Reserve Fund +30"])

  // And the panel says so: one building, under digit 1, and the credits.
  const side = buildSide({ context })
  const panel = panelLines(side, compose(side)).join("\n")
  assert.match(panel, /\[1\] Turret +15/)
  assert.doesNotMatch(panel, /Barracks|Hatchery/)
  assert.match(panel, /\b45\b/)
})

test("the screen opens on PERIMETER's offer: the starter menu, credits and Nexus draft are its first level's", () => {
  assert.deepEqual(
    STARTER_CATALOG.map((item) => `${item.hotkey} ${item.label} ${item.cost}`),
    ["1 Barracks 40", "2 Hatchery 30", "3 Turret 15"],
  )
  assert.deepEqual(
    STARTER_NEXUS_DRAFT.map((power) => `${power.hotkey} ${power.name} +${power.bonusAllotment}`),
    ["1 Reserve Fund +30", "2 War Chest +2000"],
  )
  assert.equal(STARTER_ALLOTMENT, 100)
  assert.deepEqual(STARTER_CATALOG, constructMenu(PERIMETER_LEVEL.offer))
  assert.deepEqual(STARTER_NEXUS_DRAFT, nexusDraftOf(PERIMETER_LEVEL.offer))
  // And the round the game opens is built from it.
  const context = starterContext()
  assert.deepEqual(context.catalog, STARTER_CATALOG)
  assert.deepEqual(context.nexusDraft, STARTER_NEXUS_DRAFT)
  assert.equal(context.allotment, STARTER_ALLOTMENT)
  assert.deepEqual(levelContext(PERIMETER_LEVEL).catalog, context.catalog)
})

test("PERIMETER and the cadence level moved into Vasse's bundle with their data unchanged", () => {
  // Pinned from the TypeScript literals they were, notes aside: a change to either mission is a change on purpose.
  const withoutNotes = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(withoutNotes)
    if (value === null || typeof value !== "object") return value
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "notes").map(([key, inner]) => [key, withoutNotes(inner)]))
  }
  const [perimeter, cadence] = BUNDLES.levels
  assert.equal(perimeter?.mission, PERIMETER)
  assert.equal(hashOf(withoutNotes(PERIMETER)), "73df22deb1c668c2fff92120d06f275c0bda958ffaa8fea6c653e1cc8f0fddd9")
  assert.equal(hashOf(withoutNotes(cadence?.mission)), "6fb4235e40c4925df5a1d3d2014f35ca80b434be70095ffd2bfbd6e0b5dba467")
  // Its notes say why, where the comments did.
  assert.match(PERIMETER.notes ?? "", /PULS/)
  assert.ok(PERIMETER.regions.every((region) => region.id === "nexus" || (region.notes ?? "") !== ""))
})

test("what the loader hands out cannot be changed by whoever reads it", () => {
  assert.ok(Object.isFrozen(PERIMETER) && Object.isFrozen(PERIMETER.triggers) && Object.isFrozen(PERIMETER.triggers[0]))
  assert.throws(() => (PERIMETER.triggers as TriggerDefinition[]).push(PERIMETER.triggers[0] as TriggerDefinition), TypeError)
  assert.ok(Object.isFrozen(PERIMETER_LEVEL.offer.buildings))
  // The manifests it was given are left as they were: loading them again gives the same bundles.
  assert.ok(!Object.isFrozen(vasse))
  assert.deepEqual(withGame().levels, BUNDLES.levels)
})

// --- What the loader refuses ------------------------------------------------------------------------------

test("the loader refuses, by name and all at once: requires unknown or in a circle, cards naming what they cannot, unlocks no required bundle has, ids twice, a malformed mission", () => {
  const { regions: _regions, ...withoutRegions } = PERIMETER
  const problems = problemsOf([
    common,
    vasse,
    { id: "a", title: "A", requires: ["b"] },
    { id: "b", title: "B", requires: ["a"] },
    { id: "lost", title: "Lost", requires: ["nowhere"] },
    {
      id: "cards",
      title: "Cards",
      requires: ["common"],
      buildings: [
        { id: "factory", structure: "structure.citizen.factory", cost: 50 },
        { id: "drill", structure: "unit.citizen.trooper", cost: 10 },
        { id: "barracks", structure: "structure.citizen.barracks", cost: 35 },
      ],
    },
    { id: "vasse", title: "Vasse again", requires: [] },
    campaignBundle([
      level("vasse-test-1"),
      level("test-2", { unlocks: { buildings: ["factory", "turret"], powers: ["jackpot"] } }),
      level("test-3", {
        mission: {
          ...withoutRegions,
          id: "mission.test-3",
          pulses: "three",
          triggers: [
            ...PERIMETER.triggers,
            { id: "dance", when: { pulse: 1, tick: 0 }, do: [{ dance: true }] },
            { id: "dawn", when: { event: "dawn" }, do: [{ win: true, lose: true }] },
          ],
        },
      }),
    ]),
  ])
  assert.deepEqual(problems, [
    'two bundles are called "vasse"; the second is left out',
    'bundle "test": campaigns[test].levels[test-3].mission.pulses should be a number, not "three"',
    'bundle "test": campaigns[test].levels[test-3].mission needs "regions"',
    'bundle "test": campaigns[test].levels[test-3].mission.triggers[dance].do[0] should be an action: an object with one of "spawn", "order", "commitPlan", "win", "lose", "say", not "dance"',
    'bundle "test": campaigns[test].levels[test-3].mission.triggers[dawn].when.event should be one of "pulse.end", "nexus.destroyed", "build.start", not "dawn"',
    'bundle "test": campaigns[test].levels[test-3].mission.triggers[dawn].do[0] should be an action: an object with one of "spawn", "order", "commitPlan", "win", "lose", "say", not "win" and "lose"',
    'bundle "lost" requires "nowhere", which is not a bundle',
    'bundles "a" and "b" require each other in a circle: a -> b -> a',
    'the building "barracks" is in both "common" and "cards"',
    'the level "vasse-test-1" is in both "vasse" and "test"',
    'bundle "cards": the building "factory" names "structure.citizen.factory", which is not content the game has',
    'bundle "cards": the building "drill" names "unit.citizen.trooper", which is not a building',
    'bundle "test": level "test-2" unlocks the building "factory", which "cards" has and "test" does not require',
    'bundle "test": level "test-2" unlocks the Nexus power "jackpot", which no bundle has',
  ])
  // A bundle that requires itself is a circle of one.
  assert.deepEqual(problemsOf([{ id: "me", title: "Me", requires: ["me"] }]), ['bundle "me" requires itself'])
  // And a circle of three is named all the way round, from the same place whichever bundle comes first.
  const three = [
    { id: "y", title: "Y", requires: ["z"] },
    { id: "z", title: "Z", requires: ["x"] },
    { id: "x", title: "X", requires: ["y"] },
  ]
  assert.deepEqual(problemsOf(three), ['bundles "x", "y" and "z" require each other in a circle: x -> y -> z -> x'])
})

test("a manifest's shape is checked field by field, by path: the wrong kind of value, a misspelt field, a missing one", () => {
  const problems = problemsOf([
    common,
    vasse,
    {
      id: "shapes",
      title: 5,
      requires: ["vasse"],
      unlock: [],
      buildings: [{ id: "cheap", structure: "structure.citizen.barracks", cost: -5 }],
      powers: [{ id: "lots", name: "Lots", description: "Adds lots.", effect: { credits: "lots" } }, "not a power"],
      campaigns: [{ id: "c", title: "C", commander: "vasse", levels: [{ id: "l", map: "starter", credits: 1.5, mission: PERIMETER }] }],
    },
    { title: "No id", requires: [] },
    "not a bundle",
  ])
  assert.deepEqual(problems, [
    'bundle "shapes": title should be text, not 5',
    'bundle "shapes": the bundle has "unlock", which is not one of its fields ("id", "title", "requires", "notes", "content", "buildings", "powers", "commanders", "campaigns")',
    'bundle "shapes": buildings[cheap].cost should be a whole number, not -5',
    'bundle "shapes": powers[lots].effect.credits should be a whole number, not "lots"',
    'bundle "shapes": powers[1] should be an object, not "not a power"',
    'bundle "shapes": campaigns[c].levels[l].credits should be a whole number, not 1.5',
    'bundle 4: the bundle needs "id"',
    'bundle 5: a bundle should be an object, not "not a bundle"',
  ])
})

test("a level's mission is checked against its map, its content against what its bundle sees, and so are its cards and its Commander", () => {
  const hero: ContentDef = { ...FIXTURE_REGISTRY.get("unit.citizen.vasse"), id: "unit.test.hero", short: "hero" }
  const nest: ContentDef = {
    ...FIXTURE_REGISTRY.get("structure.bench.hatchery"),
    id: "structure.test.nest",
    short: "nest",
    spawn: { contentId: "unit.test.grub", intervalTicks: 50, maxAlive: 3 },
  }
  const grub: ContentDef = { ...FIXTURE_REGISTRY.get("unit.bench.spawnling"), id: "unit.test.grub", short: "grub" }
  const mission = (id: string, extra: Partial<MissionDefinition>): MissionDefinition => ({
    id,
    name: "Solo",
    pulses: 1,
    pulseTicks: 100,
    seed: 1,
    regions: [],
    triggers: [{ id: "end", when: { event: "pulse.end", pulse: 1 }, do: [{ win: true }] }],
    ...extra,
  })
  const solo = {
    id: "solo",
    title: "Solo",
    requires: [],
    content: ["unit.test.hero", "structure.test.nest", "unit.test.ghost", "unit.citizen.trooper"],
    buildings: [{ id: "nest", structure: "structure.test.nest", cost: 5 }],
    powers: [{ id: "blank", name: " ", description: "", effect: { credits: 1 } }],
    commanders: [
      { id: "hero", name: "Hero", unit: "unit.test.hero" },
      { id: "trooper", name: "Not one", unit: "unit.citizen.trooper" },
    ],
    campaigns: [
      {
        id: "solo",
        title: "Solo",
        commander: "hero",
        levels: [
          {
            id: "solo-1",
            map: "nowhere",
            credits: 10,
            unlocks: { buildings: ["nest", "nest", "reserve-fund"] },
            mission: mission("mission.solo-1", {
              regions: [{ id: "here", x: 20, y: 9, width: 2, height: 2 }],
              triggers: [
                {
                  id: "start",
                  when: { pulse: 1, tick: 0 },
                  do: [{ spawn: { side: "A", units: [{ unit: "unit.test.hero", count: 1 }, { unit: "unit.citizen.vasse", count: 1 }], at: "here" } }],
                },
                { id: "raid", when: { pulse: 1, tick: 0 }, do: [{ spawn: { side: "B", units: [{ unit: "unit.ravel.runner", count: 2 }], at: "here" } }] },
                { id: "end", when: { event: "pulse.end", pulse: 1 }, do: [{ win: true }] },
              ],
            }),
          },
          {
            id: "solo-2",
            map: "starter",
            credits: 10,
            unlocks: { buildings: ["nest"] },
            mission: mission("mission.solo-2", { regions: [{ id: "far", x: 90, y: 38, width: 10, height: 5 }] }),
          },
        ],
      },
      { id: "empty", title: "Empty", commander: "nobody", levels: [] },
    ],
  }
  assert.deepEqual(problemsOf([common, vasse, solo], { registry: registryWith(hero, nest, grub), maps: MAPS }), [
    'the content "unit.citizen.trooper" is in both "common" and "solo"',
    'bundle "solo": "structure.test.nest" puts on the Grid "unit.test.grub", which no bundle brings',
    'bundle "solo": content names "unit.test.ghost", which is not content the game has',
    'bundle "solo": the Nexus power "blank" needs a name and a description',
    'bundle "solo": the Commander "trooper" is "unit.citizen.trooper", which "common" brings and "solo" does not require',
    'bundle "solo": level "solo-1" is played on the map "nowhere", which is not one the game has ("starter")',
    'bundle "solo": level "solo-1" unlocks the building "nest" twice',
    'bundle "solo": level "solo-1" unlocks the building "reserve-fund", which no bundle has (it is a Nexus power)',
    'bundle "solo": level "solo-1", mission "mission.solo-1" uses "unit.citizen.vasse", which "vasse" brings and "solo" does not require',
    'bundle "solo": level "solo-1", mission "mission.solo-1" uses "unit.ravel.runner", which "common" brings and "solo" does not require',
    'bundle "solo": level "solo-1", mission "mission.solo-1": trigger "start", action 1 (spawn) brings the Commander "unit.citizen.vasse" for the player, whose campaign\'s Commander is "unit.test.hero"',
    'bundle "solo": level "solo-2" unlocks the building "nest", which level "solo-1" already unlocked',
    'bundle "solo": level "solo-2", mission "mission.solo-2": region "far" reaches off the 96x40 map',
    'bundle "solo": level "solo-2" is played on the map "starter", which has standing on it "structure.citizen.nexus", which "common" brings and "solo" does not require',
    'bundle "solo": level "solo-2" is played on the map "starter", which has standing on it "structure.citizen.barracks", which "common" brings and "solo" does not require',
    'bundle "solo": the campaign "empty" is led by "nobody", which is not a Commander any bundle has',
    'bundle "solo": the campaign "empty" has no levels',
  ])
})

test("the Commander a level brings for the player is her campaign's", () => {
  // A second Commander, only for this test: the campaign is Vasse's, so bringing anyone else is refused.
  const other: ContentDef = { ...FIXTURE_REGISTRY.get("unit.citizen.vasse"), id: "unit.test.other-commander" }
  // Without the intro, whose lines name Vasse and would be refused for that alone.
  const triggers = PERIMETER.triggers
    .filter((trigger) => trigger.id !== "intro")
    .map((trigger) =>
      trigger.id !== "squads"
        ? trigger
        : {
            ...trigger,
            do: trigger.do.map((action) =>
              "spawn" in action
                ? { spawn: { ...action.spawn, units: action.spawn.units.map((entry) => (entry.unit === "unit.citizen.vasse" ? { ...entry, unit: other.id } : entry)) } }
                : action,
            ),
          },
    )
  const bundle = campaignBundle([{ ...level("test-1"), mission: { ...PERIMETER, id: "mission.test-1", triggers } }], { content: [other.id] })
  assert.deepEqual(problemsOf([common, vasse, bundle], { registry: registryWith(other), maps: MAPS }), [
    'bundle "test": level "test-1", mission "mission.test-1": trigger "squads", action 1 (spawn) brings the Commander "unit.test.other-commander" for the player, whose campaign\'s Commander is "unit.citizen.vasse"',
  ])
})
