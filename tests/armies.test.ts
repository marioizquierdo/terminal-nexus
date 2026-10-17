// Armies and campaigns (src/armies; the data in armies/ and campaigns/): what a side may build and draft, written as
// data a modder can write, each army naming the armies it builds on — the shared one, a faction, a Commander's — and
// each campaign naming the armies it plays with. The owner, 2026-10-04: "a tree where the campaign progression is at
// the top, depending on levels, that depend on buildings and units (that may be on the same bundle or another
// dependent bundle like the common)". A level offers what its campaign has unlocked by then; the loader refuses a
// broken file by name, every problem at once.

import { test } from "node:test"
import assert from "node:assert/strict"
import all from "../armies/all/army.json" with { type: "json" }
import citizen from "../armies/citizen/army.json" with { type: "json" }
import vasse from "../armies/vasse/army.json" with { type: "json" }
import vasseCampaign from "../campaigns/vasse/campaign.json" with { type: "json" }
import { constructMenu, nexusDraftOf, STARTER_ALLOTMENT, STARTER_CATALOG, STARTER_NEXUS_DRAFT } from "../src/build/catalog.ts"
import { MAPS } from "../src/build/maps.ts"
import type { Armies, GameFiles, LoadWorld, Offer, PowerCard } from "../src/armies/index.ts"
import { ARMIES, ARMY_FILES, ArmyError, CAMPAIGN_FILES, dealHand, loadArmies, PERIMETER, PERIMETER_LEVEL } from "../src/armies/index.ts"
import { levelContext, starterContext } from "../src/cli/starter.ts"
import type { ContentDef } from "../src/content/index.ts"
import { createRegistry, FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { MissionDefinition, TriggerDefinition } from "../src/mission/index.ts"
import { hashOf } from "../src/state/canonical.ts"
import { buildSide, compose, panelLines } from "./build-helpers.ts"

const WORLD: LoadWorld = { registry: FIXTURE_REGISTRY, maps: MAPS }

/** What loading `files` reports, or nothing when they load. */
function problemsOf(files: GameFiles, world: LoadWorld = WORLD): readonly string[] {
  try {
    loadArmies(files, world)
    return []
  } catch (error) {
    assert.ok(error instanceof ArmyError, String(error))
    return error.problems
  }
}

/** The game's own files and `more`, loaded. */
const withGame = (more: Readonly<{ armies?: readonly object[]; campaigns?: readonly object[] }> = {}): Armies =>
  loadArmies({ armies: [...ARMY_FILES, ...(more.armies ?? [])], campaigns: [...CAMPAIGN_FILES, ...(more.campaigns ?? [])] }, WORLD)

/** What loading the game's own armies, with `armies` and `campaigns` beside them, reports. */
const problemsWithGame = (more: Readonly<{ armies?: readonly object[]; campaigns?: readonly object[] }>, world: LoadWorld = WORLD): readonly string[] =>
  problemsOf({ armies: [...ARMY_FILES, ...(more.armies ?? [])], campaigns: more.campaigns ?? [] }, world)

/** A level on the starter map playing PERIMETER's mission under its own id. */
const level = (id: string, extra: object = {}): object => ({ id, map: "starter", credits: 100, mission: { ...PERIMETER, id: `mission.${id}` }, ...extra })

/** A campaign Vasse leads, with the Ravel raid, of `levels`. */
const testCampaign = (levels: readonly object[], extra: object = {}): object => ({
  id: "test",
  title: "A test campaign",
  commander: "vasse",
  requires: ["vasse", "ravel"],
  levels,
  ...extra,
})

/** What a power does, in a word: its credits (War Chest's), or its effect's kind. */
const effectOf = (card: PowerCard): string => ("credits" in card.effect ? `+${card.effect.credits}` : (Object.keys(card.effect)[0] ?? "?"))

/** An offer as a player reads it: each building and its cost, each power and what it does, the credits. */
const offered = (offer: Offer) => ({
  buildings: offer.buildings.map((card) => `${card.id} ${card.cost}`),
  powers: offer.powers.map((card) => `${card.name} ${effectOf(card)}`),
  credits: offer.credits,
})

/** `registry` with more content, for a test that needs content the game does not have. */
const registryWith = (...more: readonly ContentDef[]) => createRegistry([...FIXTURE_REGISTRY.ids().map((id) => FIXTURE_REGISTRY.get(id)), ...more])

// --- What the game ships ---------------------------------------------------------------------------------

test("the game ships the shared army, two factions and three Commanders on top of them, and a campaign for the two Citizens", () => {
  assert.deepEqual(
    ARMIES.armies.map((army) => [army.id, army.requires]),
    [
      ["all", []],
      ["citizen", ["all"]],
      ["ravel", ["all"]],
      ["vasse", ["citizen"]],
      ["averno", ["citizen", "ravel"]],
      ["dob", ["ravel"]],
    ],
  )
  assert.deepEqual(
    ARMIES.commanders.map(({ barks: _barks, portraitFalls: _falls, ...commander }) => commander),
    [
      { id: "vasse", army: "vasse", name: "Edda Vasse", unit: "unit.citizen.vasse", lean: ["structures", "commander"], portrait: [" _@_ ", "(-_-)", "/|@|\\"] },
      { id: "averno", army: "averno", name: "Marshal Averno", unit: "unit.citizen.averno", lean: ["units", "nexus"], portrait: [" _&_ ", "(o_-)", "/[&]\\"] },
      { id: "dob", army: "dob", name: "Dob Hunter", unit: "unit.ravel.dob", lean: ["economy", "commander"], portrait: [" ,$, ", "(^_~)", "/{$}\\"] },
    ],
  )
  assert.deepEqual(ARMIES.commanders[0]?.portraitFalls, [[" _@_ ", "(>_<)", "/|@|\\"], [" _@_ ", "(x_x)", "/|@|\\"]])
  // Their lines in battle come with them (tests/voice.test.ts has what is said when).
  for (const commander of ARMIES.commanders) assert.ok(Object.keys(commander.barks).length > 0, `${commander.name} has nothing to say`)
  assert.equal(ARMIES.campaigns.length, 2)
  assert.deepEqual(
    ARMIES.campaigns[1]?.levels.map((entry) => [entry.number, entry.id, entry.campaign, entry.map, entry.mission.name, entry.mission.pulses]),
    [[1, "averno-test-1", "averno", "starter-open", "The curve, pressed", 5]],
  )
  const [campaign] = ARMIES.campaigns
  assert.ok(campaign !== undefined)
  assert.deepEqual([campaign.id, campaign.army, campaign.commander.unit], ["vasse", "vasse", "unit.citizen.vasse"])
  assert.deepEqual(
    campaign.levels.map((entry) => [entry.number, entry.id, entry.campaign, entry.map, entry.mission.name]),
    [
      [1, "vasse-test-1", "vasse", "starter", "Perimeter"],
      [2, "vasse-test-2", "vasse", "starter", "The Commander falls"],
      [3, "vasse-test-3", "vasse", "starter-open", "The curve"],
    ],
  )
  assert.deepEqual(ARMIES.levels, [...campaign.levels, ...(ARMIES.campaigns[1]?.levels ?? [])])
  // What the levels stand on: the shared army's bench buildings and War Chest, and the Citizen faction's buildings
  // and powers, which every Citizen Commander may use.
  const [shared, citizens, , hers] = ARMIES.armies
  assert.deepEqual(shared?.buildings?.map((card) => `${card.id} ${card.structure} ${card.cost}`), ["hatchery structure.bench.hatchery 30", "turret structure.bench.beamturret 15"])
  assert.deepEqual(citizens?.buildings?.map((card) => `${card.id} ${card.structure} ${card.cost}`), [
    "barracks structure.citizen.barracks 40",
    "depot structure.citizen.depot 30",
    "garrison structure.citizen.garrison 100",
  ])
  assert.deepEqual(shared?.powers?.map((card) => [card.name, card.description, effectOf(card)]), [["War Chest", "Adds 2000 resources to spend.", "+2000"]])
  assert.deepEqual(citizens?.powers?.map((card) => [card.name, card.description, effectOf(card)]), [
    ["Reserve Callup", "Two troopers join at your Nexus.", "spawnUnits"],
    ["Drill Schedule", "Barracks send a second wave.", "modifyContent"],
    ["Drill Schedule II", "Barracks send a third wave.", "modifyContent"],
  ])
  // Each says what the Nexus Pulse deals it by: how rare it is and what it is for.
  assert.deepEqual(
    [...(citizens?.powers ?? []), ...(shared?.powers ?? []), ...(hers?.powers ?? [])].map((card) => `${card.id} ${card.rarity} ${card.role}`),
    [
      "reserve-callup common troops",
      "drill-schedule common production",
      "drill-schedule-ii uncommon production",
      "war-chest common economy",
      "standing-order uncommon commander",
      "aid-station-permit uncommon support",
    ],
  )
  // Hers: her skill wider, and the building that only its permit adds.
  assert.deepEqual(hers?.powers?.map((card) => [card.name, card.description, effectOf(card)]), [
    ["Standing Order", "By the Book reaches twice as far.", "modifyAbility"],
    ["Aid Station Permit", "Adds building: Aid Station.", "addBuilding"],
  ])
  assert.deepEqual(hers?.buildings?.map((card) => `${card.id} ${card.structure} ${card.cost}`), ["aid-station structure.citizen.aidstation 25"])
})

test("a Commander army defines its Commander as data: her unit's numbers, her card and her glyph live in her file", () => {
  // Her unit is in her army's content, beside her card and her glyph, and is what the game fights with.
  const entry = vasse.content.find((item) => typeof item === "object" && item.id === "unit.citizen.vasse")
  assert.ok(entry !== undefined && typeof entry === "object")
  const definition = FIXTURE_REGISTRY.get("unit.citizen.vasse")
  assert.equal(definition.maxHp, entry.maxHp)
  assert.equal(definition.commander, true)
  assert.deepEqual(definition.abilities, [{ kind: "aura", name: "By the Book", radius: 4, damageTakenPercent: 75 }])
  assert.deepEqual(entry.glyph, ["@"])
  assert.equal(entry.card.title, "Vasse")
  // A faction defines what it adds to the engine's bench roster, and names the rest by id.
  assert.ok(citizen.content.includes("unit.citizen.trooper"))
  assert.ok(citizen.content.some((item) => typeof item === "object" && item.id === "structure.citizen.garrison"))
  // What each army can field: its own cards and what it requires, never another faction's or Commander's.
  assert.deepEqual(
    ARMIES.arsenals["vasse"]?.buildings.map((card) => card.id),
    ["hatchery", "turret", "barracks", "depot", "garrison", "aid-station"],
  )
  assert.deepEqual(
    ARMIES.arsenals["averno"]?.powers.map((card) => card.id),
    ["war-chest", "reserve-callup", "drill-schedule", "drill-schedule-ii", "scrap-rush", "hot-shift", "short-fuses", "forward-drill", "unfiled-ordnance", "raider-contract", "runner-crew"],
  )
  assert.deepEqual(ARMIES.arsenals["dob"]?.buildings.map((card) => card.id), ["hatchery", "turret", "den", "sling-pit", "stash", "chop-shop"])
  assert.deepEqual(
    ARMIES.arsenals["dob"]?.powers.map((card) => card.id),
    ["war-chest", "scrap-rush", "hot-shift", "short-fuses", "rigged-charges", "lucky-scrap", "hot-dice", "hired-guns"],
  )
})

test("a level offers what its campaign has unlocked by then: PERIMETER unlocks all of it, the cadence level nothing new", () => {
  const [perimeter, cadence] = ARMIES.levels
  assert.ok(perimeter !== undefined && cadence !== undefined)
  const everything = {
    buildings: ["barracks 40", "hatchery 30", "turret 15", "depot 30"],
    powers: [
      "Reserve Callup spawnUnits",
      "Drill Schedule modifyContent",
      "Drill Schedule II modifyContent",
      "Standing Order modifyAbility",
      "Aid Station Permit addBuilding",
      "War Chest +2000",
    ],
    credits: 100,
  }
  assert.deepEqual(offered(perimeter.offer), everything)
  assert.deepEqual(perimeter.unlocked, { buildings: perimeter.offer.buildings, powers: perimeter.offer.powers })
  assert.deepEqual(offered(cadence.offer), everything)
  assert.deepEqual(cadence.unlocked, { buildings: [], powers: [] })
})

test("a level extends another: Averno's is Vasse's third with his own rounds, and her Commander's spawn brings him", () => {
  const hers = ARMIES.levels.find((entry) => entry.id === "vasse-test-3")
  const his = ARMIES.levels.find((entry) => entry.id === "averno-test-1")
  assert.ok(hers !== undefined && his !== undefined)
  // The same map, seed, regions and credits as hers, which it does not repeat.
  assert.equal(his.map, hers.map)
  assert.equal(his.offer.credits, hers.offer.credits)
  assert.deepEqual([his.mission.seed, his.mission.regions], [hers.mission.seed, hers.mission.regions])
  // Five rounds of her six: her sixth round's triggers are dropped, and the hold moved to his last round.
  assert.equal(his.mission.pulses, 5)
  const ids = (mission: MissionDefinition) => mission.triggers.map((trigger) => trigger.id)
  assert.deepEqual(ids(his.mission), ids(hers.mission).filter((id) => !["raid-6", "raid-6-reserve", "reinforcements-6"].includes(id)))
  assert.deepEqual(his.mission.triggers.find((trigger) => trigger.id === "hold")?.when, { event: "pulse.end", pulse: 5 })
  // One mission for every Commander: "@commander" brings whoever leads the campaign that plays it.
  const squads = (mission: MissionDefinition) => mission.triggers.find((trigger) => trigger.id === "squads")?.do[0]
  assert.deepEqual(squads(hers.mission), { spawn: { side: "A", units: [{ unit: "unit.citizen.vasse", count: 1 }, { unit: "unit.citizen.trooper", count: 3 }, { unit: "unit.citizen.marksman", count: 2 }], at: "muster", group: "squads" } })
  assert.deepEqual(squads(his.mission), { spawn: { side: "A", units: [{ unit: "unit.citizen.averno", count: 1 }, { unit: "unit.citizen.trooper", count: 3 }, { unit: "unit.citizen.marksman", count: 2 }], at: "muster", group: "squads" } })
  const written = vasseCampaign.levels.find((entry) => entry.id === "vasse-test-3")
  assert.ok(JSON.stringify(written).includes('"@commander"'), "her level brings her as @commander")
})

test("a level that extends one no campaign has, or extends itself in a circle, is refused by name", () => {
  assert.deepEqual(
    problemsWithGame({
      campaigns: [
        testCampaign([
          { id: "orphan", extends: "nowhere" },
          { id: "ping", extends: "pong" },
          { id: "pong", extends: "ping" },
          { id: "bare" },
        ]),
      ],
    }),
    [
      'campaign "test": levels[bare].map is needed: the level extends no other',
      'campaign "test": levels[bare].credits is needed: the level extends no other',
      'campaign "test": levels[bare].mission is needed: the level extends no other',
      'campaign "test": level "orphan" extends "nowhere", which is not a level any campaign has',
      'campaign "test": level "ping" extends "pong", which extends it back: a circle',
      'campaign "test": level "pong" extends "ping", which extends it back: a circle',
      'campaign "test": levels[bare].mission should be an object, not nothing',
    ],
  )
})

test("unlocks add up level by level, in the order unlocked, so no hotkey moves; each level sets its own credits", () => {
  const loaded = withGame({
    campaigns: [
      testCampaign([
        level("test-1", { credits: 45, unlocks: { buildings: ["turret"], powers: ["reserve-callup"] } }),
        level("test-2", { credits: 60, unlocks: { buildings: ["barracks"] } }),
        level("test-3", { unlocks: { buildings: ["hatchery"], powers: ["war-chest"] } }),
      ]),
    ],
  })
  const levels = loaded.levels.filter((entry) => entry.campaign === "test")
  assert.deepEqual(
    levels.map((entry) => offered(entry.offer)),
    [
      { buildings: ["turret 15"], powers: ["Reserve Callup spawnUnits"], credits: 45 },
      { buildings: ["turret 15", "barracks 40"], powers: ["Reserve Callup spawnUnits"], credits: 60 },
      { buildings: ["turret 15", "barracks 40", "hatchery 30"], powers: ["Reserve Callup spawnUnits", "War Chest +2000"], credits: 100 },
    ],
  )
  // What is new in each: what the screen between levels shows.
  assert.deepEqual(
    levels.map((entry) => [...entry.unlocked.buildings.map((card) => card.id), ...entry.unlocked.powers.map((card) => card.id)]),
    [["turret", "reserve-callup"], ["barracks"], ["hatchery", "war-chest"]],
  )
  // The last level's menu keeps the first level's digit for the Turret.
  assert.deepEqual(
    constructMenu(levels[2]!.offer).map((item) => `${item.hotkey} ${item.label} ${item.cost}`),
    ["1 Turret 15", "2 Barracks 40", "3 Hatchery 30"],
  )
})

test("a level's offer is what its Build Phase offers: the menu, the credits and the Nexus Pulse's hand", () => {
  const loaded = withGame({ campaigns: [testCampaign([level("test-1", { credits: 45, unlocks: { buildings: ["turret"], powers: ["war-chest"] } })])] })
  const turretsOnly = loaded.levels.find((entry) => entry.id === "test-1")
  assert.ok(turretsOnly !== undefined)
  const context = levelContext(turretsOnly)
  assert.deepEqual(context.catalog.map((item) => `${item.hotkey} ${item.label} ${item.cost}`), ["1 Turret 15"])
  assert.equal(context.allotment, 45)
  assert.deepEqual(context.nexusDraft.map((power) => `${power.hotkey} ${power.name} +${power.bonusAllotment}`), ["1 War Chest +2000"])

  // And the panel says so: one building, under digit 1, and the credits.
  const side = buildSide({ context })
  const panel = panelLines(side, compose(side)).join("\n")
  assert.match(panel, /\[1\] Turret +15/)
  assert.doesNotMatch(panel, /Barracks|Hatchery/)
  assert.match(panel, /\b45\b/)
})

test("the screen opens on PERIMETER's offer: the starter menu, credits and Nexus Pulse are its first level's", () => {
  assert.deepEqual(
    STARTER_CATALOG.map((item) => `${item.hotkey} ${item.label} ${item.cost}`),
    ["1 Barracks 40", "2 Hatchery 30", "3 Turret 15", "4 Supply Depot 30"],
  )
  assert.deepEqual(
    STARTER_NEXUS_DRAFT.map((power) => `${power.hotkey} ${power.name} +${power.bonusAllotment}`),
    ["1 Reserve Callup +0", "2 Drill Schedule +0", "3 Drill Schedule II +0", "4 Standing Order +0", "5 Aid Station Permit +0", "6 War Chest +2000"],
  )
  assert.equal(STARTER_ALLOTMENT, 100)
  assert.deepEqual(STARTER_CATALOG, constructMenu(PERIMETER_LEVEL.offer))
  assert.deepEqual(STARTER_NEXUS_DRAFT, nexusDraftOf(PERIMETER_LEVEL.offer))
  // And the round the game opens is built from it.
  const context = starterContext()
  assert.deepEqual(context.catalog, STARTER_CATALOG)
  // Its Nexus Pulse is a hand dealt from that pool for round 1 by the level's own schedule, for the Barracks
  // standing on the starter map, War Chest beside it.
  assert.deepEqual(context.powerPool, PERIMETER_LEVEL.offer.powers)
  assert.deepEqual(context.powerSchedule, PERIMETER_LEVEL.offer.schedule)
  const hand = dealHand({ pool: PERIMETER_LEVEL.offer.powers, kept: [], seed: PERIMETER.seed, round: 1, standing: new Set(["barracks"]), ...(PERIMETER_LEVEL.offer.schedule === undefined ? {} : { schedule: PERIMETER_LEVEL.offer.schedule }) })
  assert.deepEqual(context.nexusDraft, nexusDraftOf({ powers: hand }))
  assert.equal(context.allotment, STARTER_ALLOTMENT)
  assert.deepEqual(levelContext(PERIMETER_LEVEL).catalog, context.catalog)
})

test("PERIMETER and the cadence level are pinned as data: a change to either mission is a change on purpose", () => {
  // Pinned from the TypeScript literals they were, notes aside, and moved on purpose since: PERIMETER's raid
  // triggers and its second round's group were renamed when "wave" left the game (the owner, 2026-10-04); then
  // both lost the raid's inert `order`, PERIMETER gained the line its troops head for (the owner: "the campaign
  // levels should have a target well defined"), and the cadence level's ambush two runners, so Vasse still falls
  // in round 1 now that By the Book guards her; then PERIMETER lost `trains`, since what a building spawns is the
  // building's own, on its card (the owner, 2026-10-05); then its flanking group's intent says "flank", the genre's
  // word (the owner, 2026-10-07: "use standard rpg/strategy-game language"). Moving the campaigns into their own
  // files, and writing her as "@commander" there, changed neither: the loader hands out the missions it did.
  const withoutNotes = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(withoutNotes)
    if (value === null || typeof value !== "object") return value
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "notes").map(([key, inner]) => [key, withoutNotes(inner)]))
  }
  const [perimeter, cadence] = ARMIES.levels
  assert.equal(perimeter?.mission, PERIMETER)
  assert.equal(hashOf(withoutNotes(PERIMETER)), "5ebd2f43cc262b333a14caabe934a1783cf45e3df95ab016f2b55302ad254a48")
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
  const problems = problemsWithGame({
    campaigns: [
      testCampaign([
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
    ],
  })
  assert.deepEqual(problems, [
    'campaign "test": level "nowhere", mission "mission.post": trigger "post", action 1 (target) names the unknown region "moon"',
    'campaign "test": level "unnamed", mission "mission.post": trigger "post", action 1 (target) sends troops to the region "line", which has no name for the screen to say',
    'campaign "test": levels[misspelt].mission.triggers[post].do[0].target needs "region"',
    'campaign "test": levels[misspelt].mission.triggers[post].do[0].target has "place", which is not one of its fields ("side", "region")',
    'campaign "test": levels[ordered].mission.triggers[raid-1].do[0].spawn has "order", which is not one of its fields ("side", "units", "at", "group", "intent")',
  ])
})

test("what the loader hands out cannot be changed by whoever reads it", () => {
  assert.ok(Object.isFrozen(PERIMETER) && Object.isFrozen(PERIMETER.triggers) && Object.isFrozen(PERIMETER.triggers[0]))
  assert.throws(() => (PERIMETER.triggers as TriggerDefinition[]).push(PERIMETER.triggers[0] as TriggerDefinition), TypeError)
  assert.ok(Object.isFrozen(PERIMETER_LEVEL.offer.buildings))
  // The files it was given are left as they were: loading them again gives the same armies.
  assert.ok(!Object.isFrozen(vasse))
  assert.deepEqual(withGame().levels, ARMIES.levels)
})

// --- What the loader refuses ------------------------------------------------------------------------------

test("the loader refuses, by name and all at once: requires unknown or in a circle, cards naming what they cannot, unlocks no required army has, ids twice, a malformed mission", () => {
  const { regions: _regions, ...withoutRegions } = PERIMETER
  const problems = problemsWithGame({
    armies: [
      { id: "a", title: "A", requires: ["b"] },
      { id: "b", title: "B", requires: ["a"] },
      { id: "lost", title: "Lost", requires: ["nowhere"] },
      {
        id: "cards",
        title: "Cards",
        requires: ["citizen"],
        buildings: [
          { id: "factory", structure: "structure.citizen.factory", cost: 50 },
          { id: "drill", structure: "unit.citizen.trooper", cost: 10 },
          { id: "barracks", structure: "structure.citizen.barracks", cost: 35 },
        ],
      },
      { id: "vasse", title: "Vasse again", requires: [] },
    ],
    campaigns: [
      vasseCampaign,
      testCampaign([
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
      { ...testCampaign([level("lost-1")]), id: "astray", requires: ["vasse", "ravel", "nowhere"] },
    ],
  })
  assert.deepEqual(problems, [
    'two armies are called "vasse"; the second is left out',
    'army "lost" requires "nowhere", which is not an army',
    'armies "a" and "b" require each other in a circle: a -> b -> a',
    'campaign "astray" requires "nowhere", which is not an army',
    'the building "barracks" is in both "citizen" and "cards"',
    'the level "vasse-test-1" is in both "vasse" and "test"',
    'army "cards": the building "factory" names "structure.citizen.factory", which is not content the game has',
    'army "cards": the building "drill" names "unit.citizen.trooper", which is not a building',
    'campaign "test": level "test-2" unlocks the building "factory", which "cards" has and "test" does not require',
    'campaign "test": level "test-2" unlocks the Nexus power "jackpot", which no army has',
    'campaign "test": levels[test-3].mission.pulses should be a number, not "three"',
    'campaign "test": levels[test-3].mission needs "regions"',
    'campaign "test": levels[test-3].mission.triggers[dance].do[0] should be an action: an object with one of "spawn", "target", "commitPlan", "win", "lose", "say", not "dance"',
    'campaign "test": levels[test-3].mission.triggers[dawn].when.event should be one of "pulse.end", "nexus.destroyed", "build.start", not "dawn"',
    'campaign "test": levels[test-3].mission.triggers[dawn].do[0] should be an action: an object with one of "spawn", "target", "commitPlan", "win", "lose", "say", not "win" and "lose"',
  ])
  // An army that requires itself is a circle of one.
  assert.deepEqual(problemsOf({ armies: [{ id: "me", title: "Me", requires: ["me"] }] }), ['army "me" requires itself'])
  // And a circle of three is named all the way round, from the same place whichever army comes first.
  const three = [
    { id: "y", title: "Y", requires: ["z"] },
    { id: "z", title: "Z", requires: ["x"] },
    { id: "x", title: "X", requires: ["y"] },
  ]
  assert.deepEqual(problemsOf({ armies: three }), ['armies "x", "y" and "z" require each other in a circle: x -> y -> z -> x'])
})

test("what a building spawns is its own, on its card: the loader refuses by name a unit it cannot be, a number that is not a whole one above zero, two cards spawning one building two ways, and a mission still listing what trains", () => {
  // The game's own: the Barracks's four troopers, the Garrison's four pikemen and the Hatchery's three swarmers, one
  // wave a round each.
  const cards = Object.fromEntries(([...all.buildings, ...citizen.buildings] as readonly { id: string; spawns?: object }[]).map((card) => [card.id, card.spawns]))
  assert.deepEqual(cards, {
    barracks: { unit: "unit.citizen.trooper", perWave: 4, waves: 1, secondsBetween: 10 },
    hatchery: { unit: "unit.bench.spawnling", perWave: 3, waves: 1, secondsBetween: 10 },
    turret: undefined,
    depot: undefined,
    garrison: { unit: "unit.citizen.pikeman", perWave: 4, waves: 1, secondsBetween: 10 },
  })
  const spawns = (unit: string, extra: object = {}): object => ({ unit, perWave: 2, waves: 1, secondsBetween: 10, ...extra })
  const problems = problemsWithGame({
    armies: [
      {
        id: "yards",
        title: "Yards",
        requires: ["citizen"],
        buildings: [
          { id: "numbers", structure: "structure.bench.hatchery", cost: 10, spawns: spawns("unit.bench.spawnling", { perWave: 0, waves: 1.5, secondsBetween: -10 }) },
          { id: "short", structure: "structure.bench.hatchery", cost: 10, spawns: { unit: "unit.bench.spawnling", perWave: 2, waves: 1 } },
          { id: "ghost", structure: "structure.bench.beamturret", cost: 10, spawns: spawns("unit.citizen.ghost") },
          { id: "nested", structure: "structure.bench.beamturret", cost: 10, spawns: spawns("structure.citizen.barracks") },
          { id: "officer", structure: "structure.bench.beamturret", cost: 10, spawns: spawns("unit.citizen.vasse") },
          { id: "big-barracks", structure: "structure.citizen.barracks", cost: 60, spawns: spawns("unit.citizen.trooper", { perWave: 6 }) },
        ],
      },
    ],
    campaigns: [
      testCampaign(
        [
          level("test-1", { unlocks: { buildings: ["barracks", "big-barracks"] } }),
          level("test-2", { mission: { ...PERIMETER, id: "mission.test-2", trains: [{ structure: "structure.citizen.barracks", unit: "unit.citizen.trooper" }] } }),
        ],
        { requires: ["vasse", "ravel", "yards"] },
      ),
    ],
  })
  const fields = '"id", "name", "pulses", "pulseTicks", "seed", "regions", "triggers", "roundText", "endText", "notes"'
  assert.deepEqual(problems, [
    'army "yards": buildings[numbers].spawns.perWave should be a whole number above zero, not 0',
    'army "yards": buildings[numbers].spawns.waves should be a whole number above zero, not 1.5',
    'army "yards": buildings[numbers].spawns.secondsBetween should be a whole number above zero, not -10',
    'army "yards": buildings[short].spawns needs "secondsBetween"',
    'army "yards": the building "ghost" spawns "unit.citizen.ghost", which is not content the game has',
    'army "yards": the building "nested" spawns "structure.citizen.barracks", which is a building, not a unit',
    'army "yards": the building "officer" spawns "unit.citizen.vasse", which "vasse" brings and "yards" does not require',
    'campaign "test": level "test-1" offers "structure.citizen.barracks" as the buildings "barracks" and "big-barracks", which spawn differently; a building spawns one way',
    `campaign "test": levels[test-2].mission has "trains", which is not one of its fields (${fields})`,
  ])
})

test("a file's shape is checked field by field, by path: the wrong kind of value, a misspelt field, a missing one", () => {
  const problems = problemsOf({
    armies: [
      ...ARMY_FILES,
      {
        id: "shapes",
        title: 5,
        requires: ["vasse"],
        unlock: [],
        buildings: [{ id: "cheap", structure: "structure.citizen.barracks", cost: -5 }],
        powers: [{ id: "lots", name: "Lots", description: "Adds lots.", effect: { credits: "lots" }, rarity: "common", role: "economy" }, "not a power"],
        commanders: [],
      },
      { title: "No id", requires: [] },
      "not an army",
    ],
    campaigns: [{ id: "c", title: "C", commander: "vasse", requires: ["vasse"], levels: [{ id: "l", map: "starter", credits: 1.5, mission: PERIMETER }] }, { id: "nothing" }],
  })
  assert.deepEqual(problems, [
    'army "shapes": title should be text, not 5',
    'army "shapes": the file has "unlock", which is not one of its fields ("id", "title", "requires", "notes", "content", "buildings", "powers", "commander")',
    'army "shapes": the file has "commanders", which is not one of its fields ("id", "title", "requires", "notes", "content", "buildings", "powers", "commander")',
    'army "shapes": buildings[cheap].cost should be a whole number, not -5',
    'army "shapes": powers[lots].effect.credits should be a whole number, not "lots"',
    'army "shapes": powers[1] should be an object, not "not a power"',
    'army 8: the file needs "id"',
    'army 9: the file should be an object, not "not an army"',
    'campaign "c": levels[l].credits should be a whole number, not 1.5',
    'campaign "nothing": the file needs "title"',
    'campaign "nothing": the file needs "commander"',
    'campaign "nothing": the file needs "requires"',
    'campaign "nothing": the file needs "levels"',
  ])
})

test("a unit an army defines as data is checked by path: its numbers, its glyph against its size, a Commander's pronouns, its abilities", () => {
  const unit = (extra: object = {}): object => ({
    id: "unit.test.squire",
    layer: "units",
    size: [1, 1],
    maxHp: 30,
    card: { title: "Squire", subtitle: "A test", description: "Only a test." },
    glyph: ["q"],
    ...extra,
  })
  const problems = problemsWithGame({
    armies: [
      {
        id: "data",
        title: "Data",
        requires: ["citizen"],
        content: [
          unit({ id: "unit.test.heavy", maxHp: 0, speed: 3 }),
          unit({ id: "unit.test.wide", size: [2, 1] }),
          unit({ id: "unit.test.leader", commander: true }),
          unit({ id: "unit.test.sitter", roundsOut: 1 }),
          unit({ id: "unit.test.odd", abilities: [{ kind: "telepathy" }, { kind: "aura", name: "Both", radius: 4, damageTakenPercent: 80, damageDealtPercent: 120 }] }),
          unit({ id: "unit.test.reach", attack: { kind: "melee", range: 3, damage: 1, cooldownTicks: 10 }, abilities: [{ kind: "bounty", name: "Odd", radius: 5, credits: 1 }] }),
          unit({ id: "structure.test.cart", layer: "obstacles", movementRate: { numerator: 1, denominator: 1 } }),
          unit(),
        ],
      },
    ],
  })
  assert.deepEqual(problems, [
    'army "data": content[unit.test.heavy].maxHp should be a whole number above zero, not 0',
    'army "data": content[unit.test.heavy] has "speed", which is not one of its fields ("id", "layer", "size", "maxHp", "card", "glyph", "short", "movementRate", "speedTier", "attack", "collidesWith", "behavior", "salvage", "detonation", "nexus", "commander", "roundsOut", "engageRange", "targetLayers", "targetPreference", "spawn", "splitOnDeath", "constructionRadius", "clearance", "supplyProvided", "supplyCost", "abilities", "notes")',
    'army "data": the content "unit.test.wide" is 2 wide and its glyph\'s row 1 is 1',
    'army "data": the content "unit.test.leader" is a Commander, and its card needs pronouns',
    'army "data": the content "unit.test.sitter" sits rounds out, and only a Commander does',
    'army "data": the content "unit.test.odd"\'s ability 1 is of the kind "telepathy", which is not an ability the game has ("aura", "bounty", "loadedDice")',
    'army "data": the content "unit.test.odd"\'s ability 2 should give one of "damageTakenPercent" (a guard) and "damageDealtPercent" (a boost)',
    'army "data": the content "unit.test.reach"\'s attack range is 3: a reach is 1, which is touching, or even, a whole number of rows',
    'army "data": the content "unit.test.reach"\'s ability 1\'s radius is 5: a reach is 1, which is touching, or even, a whole number of rows',
    'army "data": the content "unit.test.reach"\'s melee range is 3: melee reaches what touches it, 1',
    'army "data": the content "structure.test.cart" is a structure, and a structure does not move',
  ])
  // One that has its shape is content the game fights with, as an engine-defined one is.
  const loaded = withGame({ armies: [{ id: "data", title: "Data", requires: ["citizen"], content: [unit()] }] })
  assert.equal(loaded.registry.get("unit.test.squire").maxHp, 30)
  assert.deepEqual(loaded.registry.get("unit.test.squire").collidesWith, ["obstacles", "units"])
})

test("a level's mission is checked against its map, its content against what its campaign sees, and an army's cards and Commander against what it sees", () => {
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
    powers: [
      { id: "blank", name: " ", description: "", effect: { credits: 1 }, rarity: "common", role: "economy" },
      // What a power does names what its army sees: a unit that is a unit, a building card, a building that
      // spawns when it adds waves, a reach that changes.
      { id: "ghost-call", name: "Ghost Call", description: "Nobody comes.", effect: { spawnUnits: { unit: "unit.test.nobody", count: 2 } }, rarity: "common", role: "economy" },
      { id: "nest-call", name: "Nest Call", description: "A nest walks in.", effect: { spawnUnits: { unit: "structure.test.nest", count: 1 } }, rarity: "common", role: "economy" },
      { id: "same-reach", name: "Same Reach", description: "As far as ever.", effect: { modifyAbility: { unit: "unit.test.hero", kind: "aura", add: { radius: 0 } } }, rarity: "common", role: "economy" },
      { id: "odd-reach", name: "Odd Reach", description: "A column further.", effect: { modifyAbility: { unit: "unit.test.hero", kind: "aura", add: { radius: 1 } } }, rarity: "common", role: "economy" },
      { id: "no-dice", name: "No Dice", description: "Nothing to change.", effect: { modifyAbility: { unit: "unit.test.hero", kind: "loadedDice", add: { chanceIn: 1 } } }, rarity: "common", role: "economy" },
      { id: "nest-drill", name: "Nest Drill", description: "More of nothing.", effect: { modifyContent: { building: "nest", addWaves: 1 } }, rarity: "common", role: "economy" },
      { id: "lost-permit", name: "Lost Permit", description: "Adds nothing.", effect: { addBuilding: { building: "missing" } }, rarity: "common", role: "economy" },
    ],
    commander: { id: "hero", name: "Hero", unit: "unit.test.hero", lean: ["units"] },
  }
  const pretender = { id: "pretender", title: "Pretender", requires: ["citizen"], commander: { id: "trooper", name: "Not one", unit: "unit.citizen.trooper", lean: ["units"] } }
  const soloCampaign = {
    id: "solo",
    title: "Solo",
    commander: "hero",
    requires: ["solo"],
    levels: [
      {
        id: "solo-1",
        map: "nowhere",
        credits: 10,
        unlocks: { buildings: ["nest", "nest", "war-chest"] },
        mission: mission("mission.solo-1", {
          regions: [{ id: "here", x: 20, y: 9, width: 2, height: 2 }],
          triggers: [
            {
              id: "start",
              when: { pulse: 1, tick: 0 },
              do: [{ spawn: { side: "A", units: [{ unit: "@commander", count: 1 }, { unit: "unit.citizen.vasse", count: 1 }], at: "here" } }],
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
  }
  const empty = { id: "empty", title: "Empty", commander: "nobody", requires: [], levels: [] }
  assert.deepEqual(problemsWithGame({ armies: [solo, pretender], campaigns: [soloCampaign, empty] }, { registry: registryWith(hero, nest, grub), maps: MAPS }), [
    'the content "unit.citizen.trooper" is in both "citizen" and "solo"',
    'army "solo": "structure.test.nest" puts on the Grid "unit.test.grub", which no army brings',
    'army "solo": content names "unit.test.ghost", which is not content the game has',
    'army "solo": the Nexus power "blank" needs a name and a description',
    'army "solo": the Nexus power "ghost-call" calls up "unit.test.nobody", which is not content the game has',
    'army "solo": the Nexus power "nest-call" calls up "structure.test.nest", which is a building, not a unit',
    'army "solo": the Nexus power "same-reach" adds 0 to "radius": a whole number, never 0',
    'army "solo": the Nexus power "odd-reach" makes the ability "aura" of "unit.test.hero" reach 5: a reach is 1 or even',
    'army "solo": the Nexus power "no-dice" changes the ability "loadedDice" of "unit.test.hero", which has none',
    'army "solo": the Nexus power "nest-drill" adds waves to the building "nest", which spawns nothing',
    'army "solo": the Nexus power "lost-permit" names the building "missing", which no army has',
    'army "pretender": the Commander "trooper" is "unit.citizen.trooper", which is not a Commander',
    'campaign "solo": level "solo-1" is played on the map "nowhere", which is not one the game has ("starter", "starter-open")',
    'campaign "solo": level "solo-1" unlocks the building "nest" twice',
    'campaign "solo": level "solo-1" unlocks the building "war-chest", which no army has (it is a Nexus power)',
    'campaign "solo": level "solo-1", mission "mission.solo-1" uses "unit.citizen.vasse", which "vasse" brings and "solo" does not require',
    'campaign "solo": level "solo-1", mission "mission.solo-1" uses "unit.ravel.runner", which "ravel" brings and "solo" does not require',
    'campaign "solo": level "solo-1", mission "mission.solo-1": trigger "start", action 1 (spawn) brings the Commander "unit.citizen.vasse" for the player, whose campaign\'s Commander is "unit.test.hero": bring "@commander"',
    'campaign "solo": level "solo-2" unlocks the building "nest", which level "solo-1" already unlocked',
    'campaign "solo": level "solo-2", mission "mission.solo-2": region "far" reaches off the 96x40 map',
    'campaign "solo": level "solo-2" is played on the map "starter", which has standing on it "structure.citizen.nexus", which "citizen" brings and "solo" does not require',
    'campaign "solo": level "solo-2" is played on the map "starter", which has standing on it "structure.citizen.barracks", which "citizen" brings and "solo" does not require',
    'campaign "empty": it is led by "nobody", which is not a Commander any army has',
    'campaign "empty": it has no levels',
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
  const officers = { id: "officers", title: "Officers", requires: ["citizen"], content: [other.id] }
  const campaign = testCampaign([{ ...level("test-1"), mission: { ...PERIMETER, id: "mission.test-1", triggers } }], { requires: ["vasse", "ravel", "officers"] })
  assert.deepEqual(problemsWithGame({ armies: [officers], campaigns: [campaign] }, { registry: registryWith(other), maps: MAPS }), [
    'campaign "test": level "test-1", mission "mission.test-1": trigger "squads", action 1 (spawn) brings the Commander "unit.test.other-commander" for the player, whose campaign\'s Commander is "unit.citizen.vasse": bring "@commander"',
  ])
})

// --- A Commander's lines in battle ---------------------------------------------------------------------------

/** Vasse's army with her lines replaced by `barks`. */
const vasseSaying = (barks: unknown): object => ({ ...vasse, commander: { ...vasse.commander, barks } })

/** The game's armies with Vasse's replaced by `hers`, and her campaign. */
const withHer = (hers: object): GameFiles => ({ armies: ARMY_FILES.map((file) => (file === vasse ? hers : file)), campaigns: [vasseCampaign] })

test("her lines in battle are refused by name: a moment she cannot speak at, one with no lines, a line that says nothing or does not fit", () => {
  assert.deepEqual(
    problemsOf(
      withHer(
        vasseSaying({
          "round-start": ["Positions."],
          victory: ["We won."],
          "first-contact": [],
          "raid-arrives": ["", " Noted."],
          "unit-lost": ["This line is far too long for two rows of the panel at eighty columns."],
          "nexus-hit": ["They touched the pyramid — again."],
        }),
      ),
    ),
    [
      'army "vasse": the Commander "vasse" has lines for "victory", which is not a moment a Commander speaks at ("appears", "restored", "round-start", "first-contact", "raid-arrives", "unit-lost", "building-lost", "badly-hurt", "nexus-hit", "falls", "round-won")',
      'army "vasse": the Commander "vasse" has no lines for "first-contact": leave the moment out for her to stay quiet there',
      'army "vasse": the Commander "vasse"\'s line 1 for "raid-arrives" is empty',
      'army "vasse": the Commander "vasse"\'s line 2 for "raid-arrives" starts or ends with a space',
      'army "vasse": the Commander "vasse"\'s line 1 for "unit-lost" is too long for the panel: quoted, it takes 3 rows of 26 columns at 80 x 24, and a line has 2',
      'army "vasse": the Commander "vasse"\'s line 1 for "nexus-hit" has "—", which is not a plain keyboard character',
    ],
  )
  // A line that fits the panel's two rows can still be too wide to show beside her on one row of the map.
  const wide = "Hold. Hold. Hold. Hold. Hold. Hold. Hold. Hold."
  assert.deepEqual(problemsOf(withHer(vasseSaying({ "round-start": [wide] }))), [
    `army "vasse": the Commander "vasse"'s line 1 for "round-start" is too long to show beside her: quoted, it is 51 columns with a blank either side, and the map is 49 wide at 80 x 24`,
  ])
  // Their shape is the file's: an object of lists of text. A Commander of the wrong shape is left out of everything
  // after, as any part is, so her campaign finds no Commander either.
  const ledByNobody = 'campaign "vasse": it is led by "vasse", which is not a Commander any army has'
  assert.deepEqual(problemsOf(withHer(vasseSaying(["Positions."]))), ['army "vasse": commander.barks should be an object, not a list', ledByNobody])
  assert.deepEqual(problemsOf(withHer(vasseSaying({ "round-start": ["Positions.", 5] }))), ['army "vasse": commander.barks.round-start[1] should be text, not 5', ledByNobody])
  // Lines are optional, moment by moment and altogether: a Commander with none says nothing.
  assert.deepEqual(problemsOf(withHer(vasseSaying({ falls: ["Back soon."] }))), [])
  const { barks: _barks, ...quiet } = vasse.commander
  const silent = loadArmies(withHer({ ...vasse, commander: quiet }), WORLD)
  assert.deepEqual(silent.commanders[0]?.barks, {})
})

test("how the Nexus Pulse deals a power is data the loader checks by name: a chance, what it requires, what it upgrades, a level's schedule", () => {
  const credits = { credits: 1 }
  const tags = { rarity: "common", role: "economy" }
  const deck = {
    id: "deck",
    title: "Deck",
    requires: ["vasse"],
    powers: [
      { id: "flat-chance", name: "Flat", description: "Nothing.", effect: credits, ...tags, chance: [{ from: 1, times: 1 }, { from: 3, to: 2, times: 2 }] },
      { id: "needy", name: "Needy", description: "Nothing.", effect: credits, ...tags, requires: { powers: ["needy", "nowhere"], buildings: ["castle"], round: 2 } },
      { id: "self-upgrade", name: "Self", description: "Nothing.", effect: credits, ...tags, upgrades: "self-upgrade" },
      { id: "chest-upgrade", name: "Chest", description: "Nothing.", effect: credits, ...tags, upgrades: "war-chest" },
      { id: "lost-upgrade", name: "Lost", description: "Nothing.", effect: credits, ...tags, upgrades: "missing" },
      { id: "always-upgrade", name: "Always", description: "Nothing.", effect: credits, ...tags, always: true, upgrades: "needy" },
    ],
  }
  const campaign = {
    id: "deck",
    title: "Deck",
    commander: "vasse",
    requires: ["deck", "ravel"],
    levels: [
      {
        id: "deck-1",
        map: "starter",
        credits: 10,
        unlocks: { powers: ["needy", "war-chest"] },
        schedule: [
          { round: 2, deal: ["common"] },
          { round: 1, deal: ["rare", { power: "drill-schedule" }, { power: "war-chest" }] },
        ],
        mission: PERIMETER_LEVEL.mission,
      },
      { id: "deck-2", map: "starter", credits: 10, schedule: [], mission: PERIMETER_LEVEL.mission },
    ],
  }
  assert.deepEqual(problemsWithGame({ armies: [deck], campaigns: [campaign] }), [
    'army "deck": the Nexus power "flat-chance" has a chance 1 times as likely, which changes nothing',
    'army "deck": the Nexus power "flat-chance" has a chance from round 3 to round 2, which ends before it starts',
    'army "deck": the Nexus power "needy" requires itself, so it is never dealt',
    'army "deck": the Nexus power "needy" requires the Nexus power "nowhere", which no army has',
    'army "deck": the Nexus power "needy" requires the building "castle", which no army has',
    'army "deck": the Nexus power "self-upgrade" upgrades itself',
    'army "deck": the Nexus power "chest-upgrade" upgrades "war-chest", which is offered beside every hand and never kept',
    'army "deck": the Nexus power "lost-upgrade" upgrades the Nexus power "missing", which no army has',
    'army "deck": the Nexus power "always-upgrade" is offered beside every hand, so it cannot be an upgrade',
    'campaign "deck": level "deck-1" has a schedule whose first entry is for round 2: it starts at round 1',
    'campaign "deck": level "deck-1" has a schedule entry for round 1 after one for round 2: entries go in order',
    'campaign "deck": level "deck-1" deals a rare from round 1: the power curve deals a rare from round 4',
    'campaign "deck": level "deck-1" makes sure of the Nexus power "drill-schedule" in round 1, which the level does not offer',
    'campaign "deck": level "deck-1" makes sure of "war-chest" in round 1, which is offered beside every hand anyway',
    'campaign "deck": level "deck-2" has a schedule with no entries: leave it out for the default',
  ])
})

test("a Nexus power's rarity and role, and each card of a schedule, are words from short lists, refused by path", () => {
  const deck = {
    id: "deck",
    title: "Deck",
    requires: ["vasse"],
    powers: [
      { id: "no-tags", name: "No Tags", description: "Nothing.", effect: { credits: 1 } },
      { id: "odd", name: "Odd", description: "Nothing.", effect: { credits: 1 }, rarity: "epic", role: "magic" },
    ],
  }
  const campaign = {
    id: "deck",
    title: "Deck",
    commander: "vasse",
    requires: ["deck", "ravel"],
    levels: [{ id: "deck-1", map: "starter", credits: 10, schedule: [{ round: 1, deal: ["epic", 3] }], mission: PERIMETER_LEVEL.mission }],
  }
  const rarities = '"common", "uncommon", "rare", "legendary"'
  assert.deepEqual(problemsWithGame({ armies: [deck], campaigns: [campaign] }), [
    'army "deck": powers[no-tags] needs "rarity"',
    'army "deck": powers[no-tags] needs "role"',
    `army "deck": powers[odd].rarity should be one of ${rarities}, not "epic"`,
    'army "deck": powers[odd].role should be one of "troops", "production", "offense", "defense", "support", "economy", "commander", "information", "movement", not "magic"',
    `campaign "deck": levels[deck-1].schedule[0].deal[0] should be one of ${rarities}, not "epic"`,
    `campaign "deck": levels[deck-1].schedule[0].deal[1] should be a rarity (${rarities}), { "power": its id } or { "from": a Nexus }, not 3`,
  ])
})
