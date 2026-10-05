// Armies (src/armies; the data in armies/): what a Commander may build and draft, her campaign and its
// levels, written as data a modder can write, each army naming the armies it builds on. The owner, 2026-10-04:
// "a tree where the campaign progression is at the top, depending on levels, that depend on buildings and units
// (that may be on the same bundle or another dependent bundle like the common)". A level offers what its campaign
// has unlocked by then; the loader refuses a broken army by name, every problem at once.

import { test } from "node:test"
import assert from "node:assert/strict"
import all from "../armies/all/army.json" with { type: "json" }
import vasse from "../armies/vasse/army.json" with { type: "json" }
import { constructMenu, nexusDraftOf, STARTER_ALLOTMENT, STARTER_CATALOG, STARTER_NEXUS_DRAFT } from "../src/build/catalog.ts"
import { MAPS } from "../src/build/maps.ts"
import type { Armies, LoadWorld, Offer } from "../src/armies/index.ts"
import { ARMIES, ArmyError, loadArmies, PERIMETER, PERIMETER_LEVEL } from "../src/armies/index.ts"
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
    loadArmies(manifests, world)
    return []
  } catch (error) {
    assert.ok(error instanceof ArmyError, String(error))
    return error.problems
  }
}

/** A level on the starter map playing PERIMETER's mission under its own id. */
const level = (id: string, extra: object = {}): object => ({ id, map: "starter", credits: 100, mission: { ...PERIMETER, id: `mission.${id}` }, ...extra })

/** An army on top of Vasse's, with one campaign of `levels` that she leads. */
const campaignBundle = (levels: readonly object[], extra: object = {}): object => ({
  id: "test",
  title: "A test campaign",
  requires: ["vasse"],
  campaigns: [{ id: "test", title: "Test", commander: "vasse", levels }],
  ...extra,
})

/** The game's armies and `more`, loaded. */
const withGame = (...more: readonly object[]): Armies => loadArmies([all, vasse, ...more], WORLD)

/** An offer as a player reads it: each building and its cost, each power and its credits, the credits. */
const offered = (offer: Offer) => ({
  buildings: offer.buildings.map((card) => `${card.id} ${card.cost}`),
  powers: offer.powers.map((card) => `${card.name} +${card.effect.credits}`),
  credits: offer.credits,
})

/** `registry` with more content, for a test that needs content the game does not have. */
const registryWith = (...more: readonly ContentDef[]) => createRegistry([...FIXTURE_REGISTRY.ids().map((id) => FIXTURE_REGISTRY.get(id)), ...more])

// --- What the game ships ---------------------------------------------------------------------------------

test("the game ships two armies: all, and Vasse's on top of it, her campaign's levels in order", () => {
  assert.deepEqual(
    ARMIES.armies.map((army) => [army.id, army.requires]),
    [
      ["all", []],
      ["vasse", ["all"]],
    ],
  )
  assert.deepEqual(
    ARMIES.commanders.map(({ barks: _barks, ...commander }) => commander),
    [{ id: "vasse", army: "vasse", name: "Edda Vasse", unit: "unit.citizen.vasse" }],
  )
  // Her lines in battle come with her (tests/voice.test.ts has what is said when).
  assert.ok(Object.keys(ARMIES.commanders[0]?.barks ?? {}).length > 0, "Vasse has nothing to say")
  assert.equal(ARMIES.campaigns.length, 1)
  const [campaign] = ARMIES.campaigns
  assert.ok(campaign !== undefined)
  assert.deepEqual([campaign.id, campaign.army, campaign.commander.unit], ["vasse", "vasse", "unit.citizen.vasse"])
  assert.deepEqual(
    campaign.levels.map((entry) => [entry.number, entry.id, entry.campaign, entry.map, entry.mission.name]),
    [
      [1, "vasse-test-1", "vasse", "starter", "Perimeter"],
      [2, "vasse-test-2", "vasse", "starter", "The Commander falls"],
    ],
  )
  assert.deepEqual(ARMIES.levels, campaign.levels)
  // What the levels stand on is all's: the buildings and powers any Commander may use.
  const [shared] = ARMIES.armies
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
  const [perimeter, cadence] = ARMIES.levels
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

test("PERIMETER and the cadence level are pinned as data: a change to either mission is a change on purpose", () => {
  // Pinned from the TypeScript literals they were, notes aside, and moved on purpose since: PERIMETER's raid
  // triggers and its second round's group were renamed when "wave" left the game (the owner, 2026-10-04); then
  // both lost the raid's inert `order`, PERIMETER gained the line its troops head for (the owner: "the campaign
  // levels should have a target well defined"), and the cadence level's ambush two runners, so Vasse still falls
  // in round 1 now that By the Book guards her.
  const withoutNotes = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(withoutNotes)
    if (value === null || typeof value !== "object") return value
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "notes").map(([key, inner]) => [key, withoutNotes(inner)]))
  }
  const [perimeter, cadence] = ARMIES.levels
  assert.equal(perimeter?.mission, PERIMETER)
  assert.equal(hashOf(withoutNotes(PERIMETER)), "989779a1791942c5a48d4cb0e72584c9e6c6c04df63cfc753a1f46a781a53eba")
  assert.equal(hashOf(withoutNotes(cadence?.mission)), "e9cc454f6dcc82db9bea5454f6999d387f70ec675db9aadc9aabd31bd26dfa0b")
  // Its notes say why, where the comments did.
  assert.match(PERIMETER.notes ?? "", /PULS/)
  assert.ok(PERIMETER.regions.every((region) => region.id === "nexus" || (region.notes ?? "") !== ""))
})

test("a level's target for the player's troops is data the loader checks: a region it has, with a name, never the retired order", () => {
  // PERIMETER's: the line ahead of the base, named, set as its first round opens.
  const post = PERIMETER.triggers.find((trigger) => trigger.id === "post")
  assert.deepEqual(post?.do, [{ target: { side: "A", region: "line" } }])
  assert.equal(PERIMETER.regions.find((region) => region.id === "line")?.name, "the line")
  // The cadence level names none: its line stays at the muster as its own rule has it.
  assert.ok(!(ARMIES.levels[1]?.mission.triggers ?? []).some((trigger) => trigger.do.some((action) => "target" in action)))

  const withPost = (target: object, regions: readonly object[] = PERIMETER.regions): object => ({
    ...PERIMETER,
    id: "mission.post",
    regions,
    triggers: [...PERIMETER.triggers.filter((trigger) => trigger.id !== "post"), { id: "post", when: { pulse: 1, tick: 0 }, do: [{ target }] }],
  })
  const problems = problemsOf([
    all,
    vasse,
    campaignBundle([
      level("nowhere", { mission: withPost({ side: "A", region: "moon" }) }),
      level("unnamed", { mission: withPost({ side: "A", region: "line" }, PERIMETER.regions.map(({ name: _name, ...region }) => region)) }),
      level("misspelt", { mission: withPost({ side: "A", place: "line" }) }),
      level("ordered", {
        mission: {
          ...PERIMETER,
          id: "mission.ordered",
          triggers: PERIMETER.triggers.map((trigger) =>
            trigger.id !== "raid-1" ? trigger : { ...trigger, do: trigger.do.map((action) => ("spawn" in action ? { spawn: { ...action.spawn, order: { advance: "nexus" } } } : action)) },
          ),
        },
      }),
    ]),
  ])
  assert.deepEqual(problems, [
    'army "test": campaigns[test].levels[misspelt].mission.triggers[post].do[0].target needs "region"',
    'army "test": campaigns[test].levels[misspelt].mission.triggers[post].do[0].target has "place", which is not one of its fields ("side", "region")',
    'army "test": campaigns[test].levels[ordered].mission.triggers[raid-1].do[0].spawn has "order", which is not one of its fields ("side", "units", "at", "group", "intent")',
    'army "test": level "nowhere", mission "mission.post": trigger "post", action 1 (target) names the unknown region "moon"',
    'army "test": level "unnamed", mission "mission.post": trigger "post", action 1 (target) sends troops to the region "line", which has no name for the screen to say',
  ])
})

test("what the loader hands out cannot be changed by whoever reads it", () => {
  assert.ok(Object.isFrozen(PERIMETER) && Object.isFrozen(PERIMETER.triggers) && Object.isFrozen(PERIMETER.triggers[0]))
  assert.throws(() => (PERIMETER.triggers as TriggerDefinition[]).push(PERIMETER.triggers[0] as TriggerDefinition), TypeError)
  assert.ok(Object.isFrozen(PERIMETER_LEVEL.offer.buildings))
  // The manifests it was given are left as they were: loading them again gives the same armies.
  assert.ok(!Object.isFrozen(vasse))
  assert.deepEqual(withGame().levels, ARMIES.levels)
})

// --- What the loader refuses ------------------------------------------------------------------------------

test("the loader refuses, by name and all at once: requires unknown or in a circle, cards naming what they cannot, unlocks no required army has, ids twice, a malformed mission", () => {
  const { regions: _regions, ...withoutRegions } = PERIMETER
  const problems = problemsOf([
    all,
    vasse,
    { id: "a", title: "A", requires: ["b"] },
    { id: "b", title: "B", requires: ["a"] },
    { id: "lost", title: "Lost", requires: ["nowhere"] },
    {
      id: "cards",
      title: "Cards",
      requires: ["all"],
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
    'two armies are called "vasse"; the second is left out',
    'army "test": campaigns[test].levels[test-3].mission.pulses should be a number, not "three"',
    'army "test": campaigns[test].levels[test-3].mission needs "regions"',
    'army "test": campaigns[test].levels[test-3].mission.triggers[dance].do[0] should be an action: an object with one of "spawn", "target", "commitPlan", "win", "lose", "say", not "dance"',
    'army "test": campaigns[test].levels[test-3].mission.triggers[dawn].when.event should be one of "pulse.end", "nexus.destroyed", "build.start", not "dawn"',
    'army "test": campaigns[test].levels[test-3].mission.triggers[dawn].do[0] should be an action: an object with one of "spawn", "target", "commitPlan", "win", "lose", "say", not "win" and "lose"',
    'army "lost" requires "nowhere", which is not an army',
    'armies "a" and "b" require each other in a circle: a -> b -> a',
    'the building "barracks" is in both "all" and "cards"',
    'the level "vasse-test-1" is in both "vasse" and "test"',
    'army "cards": the building "factory" names "structure.citizen.factory", which is not content the game has',
    'army "cards": the building "drill" names "unit.citizen.trooper", which is not a building',
    'army "test": level "test-2" unlocks the building "factory", which "cards" has and "test" does not require',
    'army "test": level "test-2" unlocks the Nexus power "jackpot", which no army has',
  ])
  // An army that requires itself is a circle of one.
  assert.deepEqual(problemsOf([{ id: "me", title: "Me", requires: ["me"] }]), ['army "me" requires itself'])
  // And a circle of three is named all the way round, from the same place whichever army comes first.
  const three = [
    { id: "y", title: "Y", requires: ["z"] },
    { id: "z", title: "Z", requires: ["x"] },
    { id: "x", title: "X", requires: ["y"] },
  ]
  assert.deepEqual(problemsOf(three), ['armies "x", "y" and "z" require each other in a circle: x -> y -> z -> x'])
})

test("a manifest's shape is checked field by field, by path: the wrong kind of value, a misspelt field, a missing one", () => {
  const problems = problemsOf([
    all,
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
    "not an army",
  ])
  assert.deepEqual(problems, [
    'army "shapes": title should be text, not 5',
    'army "shapes": the army has "unlock", which is not one of its fields ("id", "title", "requires", "notes", "content", "buildings", "powers", "commanders", "campaigns")',
    'army "shapes": buildings[cheap].cost should be a whole number, not -5',
    'army "shapes": powers[lots].effect.credits should be a whole number, not "lots"',
    'army "shapes": powers[1] should be an object, not "not a power"',
    'army "shapes": campaigns[c].levels[l].credits should be a whole number, not 1.5',
    'army 4: the army needs "id"',
    'army 5: an army should be an object, not "not an army"',
  ])
})

test("a level's mission is checked against its map, its content against what its army sees, and so are its cards and its Commander", () => {
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
  assert.deepEqual(problemsOf([all, vasse, solo], { registry: registryWith(hero, nest, grub), maps: MAPS }), [
    'the content "unit.citizen.trooper" is in both "all" and "solo"',
    'army "solo": "structure.test.nest" puts on the Grid "unit.test.grub", which no army brings',
    'army "solo": content names "unit.test.ghost", which is not content the game has',
    'army "solo": the Nexus power "blank" needs a name and a description',
    'army "solo": the Commander "trooper" is "unit.citizen.trooper", which "all" brings and "solo" does not require',
    'army "solo": level "solo-1" is played on the map "nowhere", which is not one the game has ("starter")',
    'army "solo": level "solo-1" unlocks the building "nest" twice',
    'army "solo": level "solo-1" unlocks the building "reserve-fund", which no army has (it is a Nexus power)',
    'army "solo": level "solo-1", mission "mission.solo-1" uses "unit.citizen.vasse", which "vasse" brings and "solo" does not require',
    'army "solo": level "solo-1", mission "mission.solo-1" uses "unit.ravel.runner", which "all" brings and "solo" does not require',
    'army "solo": level "solo-1", mission "mission.solo-1": trigger "start", action 1 (spawn) brings the Commander "unit.citizen.vasse" for the player, whose campaign\'s Commander is "unit.test.hero"',
    'army "solo": level "solo-2" unlocks the building "nest", which level "solo-1" already unlocked',
    'army "solo": level "solo-2", mission "mission.solo-2": region "far" reaches off the 96x40 map',
    'army "solo": level "solo-2" is played on the map "starter", which has standing on it "structure.citizen.nexus", which "all" brings and "solo" does not require',
    'army "solo": level "solo-2" is played on the map "starter", which has standing on it "structure.citizen.barracks", which "all" brings and "solo" does not require',
    'army "solo": the campaign "empty" is led by "nobody", which is not a Commander any army has',
    'army "solo": the campaign "empty" has no levels',
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
  const army = campaignBundle([{ ...level("test-1"), mission: { ...PERIMETER, id: "mission.test-1", triggers } }], { content: [other.id] })
  assert.deepEqual(problemsOf([all, vasse, army], { registry: registryWith(other), maps: MAPS }), [
    'army "test": level "test-1", mission "mission.test-1": trigger "squads", action 1 (spawn) brings the Commander "unit.test.other-commander" for the player, whose campaign\'s Commander is "unit.citizen.vasse"',
  ])
})

// --- A Commander's lines in battle ---------------------------------------------------------------------------

/** Vasse's army with her lines replaced by `barks`. */
const vasseSaying = (barks: unknown): object => ({
  ...vasse,
  commanders: vasse.commanders.map((commander) => ({ ...commander, barks })),
})

test("her lines in battle are refused by name: a moment she cannot speak at, one with no lines, a line that says nothing or does not fit", () => {
  assert.deepEqual(
    problemsOf([
      all,
      vasseSaying({
        "round-start": ["Positions."],
        victory: ["We won."],
        "first-contact": [],
        "raid-arrives": ["", " Noted."],
        "unit-lost": ["This line is far too long for two rows of the panel at eighty columns."],
        "nexus-hit": ["They touched the pyramid — again."],
      }),
    ]),
    [
      'army "vasse": the Commander "vasse" has lines for "victory", which is not a moment a Commander speaks at ("round-start", "first-contact", "raid-arrives", "unit-lost", "building-lost", "badly-hurt", "nexus-hit", "falls", "round-won")',
      'army "vasse": the Commander "vasse" has no lines for "first-contact": leave the moment out for her to stay quiet there',
      'army "vasse": the Commander "vasse"\'s line 1 for "raid-arrives" is empty',
      'army "vasse": the Commander "vasse"\'s line 2 for "raid-arrives" starts or ends with a space',
      'army "vasse": the Commander "vasse"\'s line 1 for "unit-lost" is too long for the panel: quoted, it takes 3 rows of 26 columns at 80 x 24, and a line has 2',
      'army "vasse": the Commander "vasse"\'s line 1 for "nexus-hit" has "—", which is not a plain keyboard character',
    ],
  )
  // A line that fits the panel's two rows can still be too wide to show beside her on one row of the map.
  const wide = "Hold. Hold. Hold. Hold. Hold. Hold. Hold. Hold."
  assert.deepEqual(problemsOf([all, vasseSaying({ "round-start": [wide] })]), [
    `army "vasse": the Commander "vasse"'s line 1 for "round-start" is too long to show beside her: quoted, it is 51 columns with a blank either side, and the map is 49 wide at 80 x 24`,
  ])
  // Their shape is the manifest's: an object of lists of text. A Commander of the wrong shape is left out of
  // everything after, as any item is, so her campaign finds no Commander either.
  const ledByNobody = 'army "vasse": the campaign "vasse" is led by "vasse", which is not a Commander any army has'
  assert.deepEqual(problemsOf([all, vasseSaying(["Positions."])]), ['army "vasse": commanders[vasse].barks should be an object, not a list', ledByNobody])
  assert.deepEqual(problemsOf([all, vasseSaying({ "round-start": ["Positions.", 5] })]), [
    'army "vasse": commanders[vasse].barks.round-start[1] should be text, not 5',
    ledByNobody,
  ])
  // Lines are optional, moment by moment and altogether: a Commander with none says nothing.
  assert.deepEqual(problemsOf([all, vasseSaying({ falls: ["Back soon."] })]), [])
  const silent = loadArmies([all, { ...vasse, commanders: vasse.commanders.map(({ barks: _barks, ...commander }) => commander) }], WORLD)
  assert.deepEqual(silent.commanders[0]?.barks, {})
})
