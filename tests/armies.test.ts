// Armies (src/armies; the data in armies/): what a side may build and draft, written as data a modder can write, each
// army naming the armies it builds on — the shared one, a faction, a Commander's. The loader refuses a broken file by
// name, every problem at once. Story's files (a Commander's levels and missions) were loaded here too until Story
// stopped (the owner, 2026-11-26).

import { test } from "node:test"
import assert from "node:assert/strict"
import all from "../armies/all/army.json" with { type: "json" }
import citizen from "../armies/citizen/army.json" with { type: "json" }
import vasse from "../armies/vasse/army.json" with { type: "json" }
import type { Armies, GameFiles, LoadWorld, PowerCard } from "../src/armies/index.ts"
import { ARMIES, ARMY_FILES, ArmyError, loadArmies } from "../src/armies/index.ts"
import type { ContentDef } from "../src/content/index.ts"
import { createRegistry, FIXTURE_REGISTRY } from "../src/content/index.ts"

const WORLD: LoadWorld = { registry: FIXTURE_REGISTRY }

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
const withGame = (more: Readonly<{ armies?: readonly object[] }> = {}): Armies => loadArmies({ armies: [...ARMY_FILES, ...(more.armies ?? [])] }, WORLD)

/** What loading the game's own armies, with `armies` beside them, reports. */
const problemsWithGame = (more: Readonly<{ armies?: readonly object[] }>, world: LoadWorld = WORLD): readonly string[] =>
  problemsOf({ armies: [...ARMY_FILES, ...(more.armies ?? [])] }, world)

/** What a power does, in a word: its credits (War Chest's), or its effect's kind. */
const effectOf = (card: PowerCard): string => ("credits" in card.effect ? `+${card.effect.credits}` : (Object.keys(card.effect)[0] ?? "?"))

/** `registry` with more content, for a test that needs content the game does not have. */
const registryWith = (...more: readonly ContentDef[]) => createRegistry([...FIXTURE_REGISTRY.ids().map((id) => FIXTURE_REGISTRY.get(id)), ...more])

// --- What the game ships ---------------------------------------------------------------------------------

test("the game ships the shared army, two factions and three Commanders on top of them", () => {
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
    ARMIES.commanders.map(({ barks: _barks, portraitFalls: _falls, start: _start, schedule: _schedule, faction: _faction, ...commander }) => commander),
    [
      { id: "vasse", army: "vasse", name: "Edda Vasse", unit: "unit.citizen.vasse", lean: ["structures", "commander"], portrait: [" _@_ ", "(-_-)", "/|@|\\"] },
      { id: "averno", army: "averno", name: "Marshal Averno", unit: "unit.citizen.averno", lean: ["units", "nexus"], portrait: [" _&_ ", "(o_-)", "/[&]\\"] },
      { id: "dob", army: "dob", name: "Dob Hunter", unit: "unit.ravel.dob", lean: ["economy", "commander"], portrait: [" ,$, ", "(^_~)", "/{$}\\"] },
    ],
  )
  assert.deepEqual(ARMIES.commanders[0]?.portraitFalls, [[" _@_ ", "(>_<)", "/|@|\\"], [" _@_ ", "(x_x)", "/|@|\\"]])
  // Each walks out with a starting package where a mode scripts none (a battle), and Averno's army bends the Nexus Pulse
  // in every mode: a card from the Ravel Nexus in rounds 2 and 4.
  assert.deepEqual(
    ARMIES.commanders.map((commander) => commander.start.map(({ unit, count }) => `${count} ${unit}`).join(", ")),
    ["3 unit.citizen.trooper, 2 unit.citizen.marksman", "3 unit.citizen.trooper, 2 unit.citizen.marksman", "5 unit.ravel.runner, 2 unit.ravel.slinger"],
  )
  assert.deepEqual(
    ARMIES.commanders[1]?.schedule?.flatMap((entry) => entry.deal.filter((slot) => typeof slot !== "string" && "from" in slot).map(() => entry.round)),
    [2, 4],
  )
  assert.equal(ARMIES.commanders[0]?.schedule, undefined)
  // Their lines in battle come with them (tests/voice.test.ts has what is said when).
  for (const commander of ARMIES.commanders) assert.ok(Object.keys(commander.barks).length > 0, `${commander.name} has nothing to say`)
  // What the Commanders stand on: the shared army's bench buildings and War Chest, and the Citizen faction's buildings
  // and powers, which every Citizen Commander may use.
  const [shared, citizens, , hers] = ARMIES.armies
  assert.deepEqual(shared?.buildings?.map((card) => `${card.id} ${card.structure} ${card.cost}`), ["hatchery structure.bench.hatchery 30", "turret structure.bench.beamturret 15"])
  assert.deepEqual(citizens?.buildings?.map((card) => `${card.id} ${card.structure} ${card.cost}`), [
    "barracks structure.citizen.barracks 40",
    "depot structure.citizen.depot 30",
    "garrison structure.citizen.garrison 100",
    "battery structure.citizen.battery 50",
  ])
  assert.deepEqual(shared?.powers?.map((card) => [card.name, card.description, effectOf(card)]), [["War Chest", "Adds 2000 credits to spend.", "+2000"]])
  assert.deepEqual(citizens?.powers?.map((card) => [card.name, card.description, effectOf(card)]), [
    ["Standard Heavy Rounds", "Every Turret hits harder.", "modifyAttack"],
    ["Long Barrels", "Marksmen reach two tiles further.", "modifyAttack"],
    ["Standard Production Line", "Every Barracks sends one more trooper a wave.", "addPerWave"],
    ["Reserve Callup", "Two troopers join at your Nexus.", "spawnUnits"],
    ["Drill Schedule", "Barracks send a second wave.", "addWaves"],
    ["Drill Schedule II", "Barracks send a third wave.", "addWaves"],
  ])
  // Each says what the Nexus Pulse deals it by: how rare it is and what it is for.
  assert.deepEqual(
    [...(citizens?.powers ?? []), ...(shared?.powers ?? []), ...(hers?.powers ?? [])].map((card) => `${card.id} ${card.rarity} ${card.role}`),
    [
      "heavy-rounds-standard common defense",
      "long-barrels uncommon offense",
      "production-line-standard uncommon production",
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
  // What each army can field: its own cards and what it requires, never another faction's or Commander's (the
  // Battery and the Fuse Shed reach every Commander of their faction since the mortar and the bomber came, step 16K).
  assert.deepEqual(
    ARMIES.arsenals["vasse"]?.buildings.map((card) => card.id),
    ["hatchery", "turret", "barracks", "depot", "garrison", "battery", "aid-station"],
  )
  assert.deepEqual(
    ARMIES.arsenals["averno"]?.powers.map((card) => card.id),
    ["war-chest", "heavy-rounds-standard", "long-barrels", "production-line-standard", "reserve-callup", "drill-schedule", "drill-schedule-ii", "sharpened-scrap", "crowded-dens", "scrap-rush", "hot-shift", "short-fuses", "forward-drill", "unfiled-ordnance", "raider-contract", "runner-crew"],
  )
  // Averno sees the Ravel faction only for the cards that leak to him: its buildings are not his, and its powers are
  // foreign to him, marked from the Ravel Nexus, so only a slot that asks for that Nexus deals them.
  assert.ok(!(ARMIES.arsenals["averno"]?.buildings ?? []).some((card) => card.id === "den"))
  assert.deepEqual(
    (ARMIES.arsenals["averno"]?.powers ?? []).filter((card) => card.from !== undefined).map((card) => `${card.id} ${card.from}`),
    ["sharpened-scrap ravel", "crowded-dens ravel", "scrap-rush ravel", "hot-shift ravel", "short-fuses ravel", "raider-contract ravel", "runner-crew ravel"],
  )
  assert.ok((ARMIES.arsenals["dob"]?.powers ?? []).every((card) => card.from === undefined), "Dob's own faction's cards are foreign to him")
  assert.deepEqual(ARMIES.arsenals["dob"]?.buildings.map((card) => card.id), ["hatchery", "turret", "den", "sling-pit", "stash", "chop-shop", "fuse-shed"])
  assert.deepEqual(
    ARMIES.arsenals["dob"]?.powers.map((card) => card.id),
    ["war-chest", "sharpened-scrap", "crowded-dens", "scrap-rush", "hot-shift", "short-fuses", "rigged-charges", "lucky-scrap", "hot-dice", "hired-guns"],
  )
})

test("what the loader hands out cannot be changed by whoever reads it", () => {
  const hers = ARMIES.arsenals["vasse"]
  assert.ok(hers !== undefined && Object.isFrozen(hers.buildings) && Object.isFrozen(hers.buildings[0]) && Object.isFrozen(ARMIES.commanders[0]))
  assert.throws(() => (hers.buildings as unknown[]).push(hers.buildings[0]), TypeError)
  // The files it was given are left as they were: loading them again gives the same armies.
  assert.ok(!Object.isFrozen(vasse))
  assert.deepEqual(withGame().arsenals, ARMIES.arsenals)
})

// --- What the loader refuses ------------------------------------------------------------------------------

test("the loader refuses, by name and all at once: requires unknown or in a circle, cards naming what they cannot, ids twice", () => {
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
  })
  assert.deepEqual(problems, [
    'two armies are called "vasse"; the second is left out',
    'army "lost" requires "nowhere", which is not an army',
    'armies "a" and "b" require each other in a circle: a -> b -> a',
    'the building "barracks" is in both "citizen" and "cards"',
    'army "cards": the building "factory" names "structure.citizen.factory", which is not content the game has',
    'army "cards": the building "drill" names "unit.citizen.trooper", which is not a building',
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

test("what a building spawns is its own, on its card: the loader refuses by name a unit it cannot be, or a number that is not a whole one above zero", () => {
  // The game's own: the Barracks's four troopers, the Garrison's four pikemen, the Battery's two mortars and the
  // Hatchery's three swarmers, one wave a round each (the Battery since the mortar came, step 16K).
  const cards = Object.fromEntries(([...all.buildings, ...citizen.buildings] as readonly { id: string; spawns?: object }[]).map((card) => [card.id, card.spawns]))
  assert.deepEqual(cards, {
    barracks: { unit: "unit.citizen.trooper", perWave: 4, waves: 1, secondsBetween: 10 },
    hatchery: { unit: "unit.bench.spawnling", perWave: 3, waves: 1, secondsBetween: 10 },
    turret: undefined,
    depot: undefined,
    garrison: { unit: "unit.citizen.pikeman", perWave: 4, waves: 1, secondsBetween: 10 },
    battery: { unit: "unit.citizen.mortar", perWave: 2, waves: 1, secondsBetween: 10 },
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
        ],
      },
    ],
  })
  assert.deepEqual(problems, [
    'army "yards": buildings[numbers].spawns.perWave should be a whole number above zero, not 0',
    'army "yards": buildings[numbers].spawns.waves should be a whole number above zero, not 1.5',
    'army "yards": buildings[numbers].spawns.secondsBetween should be a whole number above zero, not -10',
    'army "yards": buildings[short].spawns needs "secondsBetween"',
    'army "yards": the building "ghost" spawns "unit.citizen.ghost", which is not content the game has',
    'army "yards": the building "nested" spawns "structure.citizen.barracks", which is a building, not a unit',
    'army "yards": the building "officer" spawns "unit.citizen.vasse", which "vasse" brings and "yards" does not require',
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
    'army "data": content[unit.test.heavy] has "speed", which is not one of its fields ("id", "layer", "size", "maxHp", "card", "glyph", "short", "movementRate", "speedTier", "attack", "collidesWith", "behavior", "salvage", "detonation", "nexus", "commander", "roundsOut", "vision", "targetLayers", "targetPreference", "aim", "line", "class", "spawn", "splitOnDeath", "constructionRadius", "supplyProvided", "mends", "supplyCost", "abilities", "notes")',
    'army "data": the content "unit.test.wide" is 2 wide and its glyph\'s row 1 is 1',
    'army "data": the content "unit.test.leader" is a Commander, and its card needs pronouns',
    'army "data": the content "unit.test.sitter" sits rounds out, and only a Commander does',
    'army "data": the content "unit.test.odd"\'s ability 1 is of the kind "telepathy", which is not an ability the game has ("aura", "bounty", "loadedDice", "shove")',
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

test("an army's cards and Commander are checked against what it sees", () => {
  const hero: ContentDef = { ...FIXTURE_REGISTRY.get("unit.citizen.vasse"), id: "unit.test.hero", short: "hero" }
  const nest: ContentDef = {
    ...FIXTURE_REGISTRY.get("structure.bench.hatchery"),
    id: "structure.test.nest",
    short: "nest",
    spawn: { contentId: "unit.test.grub", intervalTicks: 50, maxAlive: 3 },
  }
  const grub: ContentDef = { ...FIXTURE_REGISTRY.get("unit.bench.spawnling"), id: "unit.test.grub", short: "grub" }
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
      { id: "same-reach", name: "Same Reach", description: "As far as ever.", effect: { modifyAbility: { content: "unit.test.hero", kind: "aura", add: { radius: 0 } } }, rarity: "common", role: "economy" },
      { id: "odd-reach", name: "Odd Reach", description: "A column further.", effect: { modifyAbility: { content: "unit.test.hero", kind: "aura", add: { radius: 1 } } }, rarity: "common", role: "economy" },
      { id: "no-dice", name: "No Dice", description: "Nothing to change.", effect: { modifyAbility: { content: "unit.test.hero", kind: "loadedDice", add: { chanceIn: 1 } } }, rarity: "common", role: "economy" },
      { id: "nest-drill", name: "Nest Drill", description: "More of nothing.", effect: { addWaves: { building: "nest", waves: 1 } }, rarity: "common", role: "economy" },
      { id: "lost-permit", name: "Lost Permit", description: "Adds nothing.", effect: { addBuilding: { building: "missing" } }, rarity: "common", role: "economy" },
    ],
    commander: { id: "hero", name: "Hero", unit: "unit.test.hero", faction: "solo", lean: ["units"] },
  }
  const pretender = { id: "pretender", title: "Pretender", requires: ["citizen"], commander: { id: "trooper", name: "Not one", unit: "unit.citizen.trooper", faction: "citizen", lean: ["units"] } }
  assert.deepEqual(problemsWithGame({ armies: [solo, pretender] }, { registry: registryWith(hero, nest, grub) }), [
    'the content "unit.citizen.trooper" is in both "citizen" and "solo"',
    'army "solo": "structure.test.nest" puts on the battlefield "unit.test.grub", which no army brings',
    'army "solo": content names "unit.test.ghost", which is not content the game has',
    'army "solo": the Nexus power "blank" needs a name and a description',
    'army "solo": the Nexus power "ghost-call" calls up "unit.test.nobody", which is not content the game has',
    'army "solo": the Nexus power "nest-call" calls up "structure.test.nest", which is a building, not a unit',
    'army "solo": the Nexus power "same-reach" adds 0 to "radius": a whole number, never 0',
    'army "solo": the Nexus power "odd-reach" makes the ability "aura" of "unit.test.hero" reach 5: a reach is 1 or even',
    'army "solo": the Nexus power "no-dice" changes the ability "loadedDice" of "unit.test.hero", which has none',
    'army "solo": the Nexus power "nest-drill" adds waves to the building "nest", which spawns nothing',
    'army "solo": the Nexus power "lost-permit" names the building "missing", which no army has',
    'army "solo": the Commander "hero" names the faction "solo", which brings no Nexus',
    'army "pretender": the Commander "trooper" is "unit.citizen.trooper", which is not a Commander',
  ])
})

// --- A Commander's lines in battle ---------------------------------------------------------------------------

/** Vasse's army with her lines replaced by `barks`. */
const vasseSaying = (barks: unknown): object => ({ ...vasse, commander: { ...vasse.commander, barks } })

/** The game's armies with Vasse's replaced by `hers`. */
const withHer = (hers: object): GameFiles => ({ armies: ARMY_FILES.map((file) => (file === vasse ? hers : file)) })

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
  // after, as any part is.
  assert.deepEqual(problemsOf(withHer(vasseSaying(["Positions."]))), ['army "vasse": commander.barks should be an object, not a list'])
  assert.deepEqual(problemsOf(withHer(vasseSaying({ "round-start": ["Positions.", 5] }))), ['army "vasse": commander.barks.round-start[1] should be text, not 5'])
  // Lines are optional, moment by moment and altogether: a Commander with none says nothing.
  assert.deepEqual(problemsOf(withHer(vasseSaying({ falls: ["Back soon."] }))), [])
  const { barks: _barks, ...quiet } = vasse.commander
  const silent = loadArmies(withHer({ ...vasse, commander: quiet }), WORLD)
  assert.deepEqual(silent.commanders[0]?.barks, {})
})

test("how the Nexus Pulse deals a power is data the loader checks by name: a chance, what it requires, what it upgrades, a Commander's schedule", () => {
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
  assert.deepEqual(problemsWithGame({ armies: [deck] }), [
    'army "deck": the Nexus power "flat-chance" has a chance 1 times as likely, which changes nothing',
    'army "deck": the Nexus power "flat-chance" has a chance from round 3 to round 2, which ends before it starts',
    'army "deck": the Nexus power "needy" requires itself, so it is never dealt',
    'army "deck": the Nexus power "needy" requires the Nexus power "nowhere", which no army has',
    'army "deck": the Nexus power "needy" requires the building "castle", which no army has',
    'army "deck": the Nexus power "self-upgrade" upgrades itself',
    'army "deck": the Nexus power "chest-upgrade" upgrades "war-chest", which is offered beside every hand and never kept',
    'army "deck": the Nexus power "lost-upgrade" upgrades the Nexus power "missing", which no army has',
    'army "deck": the Nexus power "always-upgrade" is offered beside every hand, so it cannot be an upgrade',
  ])
  // Her army's schedule for the Nexus Pulse is checked against what her army offers and the power curve.
  const scheduled = (schedule: unknown): GameFiles => withHer({ ...vasse, commander: { ...vasse.commander, schedule } })
  assert.deepEqual(
    problemsOf(
      scheduled([
        { round: 2, deal: ["common"] },
        { round: 1, deal: ["rare", { power: "rigged-charges" }, { power: "war-chest" }] },
      ]),
    ),
    [
      'army "vasse": the Commander "vasse" has a schedule whose first entry is for round 2: it starts at round 1',
      'army "vasse": the Commander "vasse" has a schedule entry for round 1 after one for round 2: entries go in order',
      'army "vasse": the Commander "vasse" deals a rare from round 1: the power curve deals a rare from round 4',
      'army "vasse": the Commander "vasse" makes sure of the Nexus power "rigged-charges" in round 1, which her army does not offer',
      'army "vasse": the Commander "vasse" makes sure of "war-chest" in round 1, which is offered beside every hand anyway',
    ],
  )
  assert.deepEqual(problemsOf(scheduled([])), ['army "vasse": the Commander "vasse" has a schedule with no entries: leave it out for the default'])
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
  const rarities = '"common", "uncommon", "rare", "legendary"'
  assert.deepEqual(problemsWithGame({ armies: [deck] }), [
    'army "deck": powers[no-tags] needs "rarity"',
    'army "deck": powers[no-tags] needs "role"',
    `army "deck": powers[odd].rarity should be one of ${rarities}, not "epic"`,
    'army "deck": powers[odd].role should be one of "troops", "production", "offense", "defense", "support", "economy", "commander", "information", "movement", not "magic"',
  ])
  assert.deepEqual(problemsOf(withHer({ ...vasse, commander: { ...vasse.commander, schedule: [{ round: 1, deal: ["epic", 3] }] } })), [
    `army "vasse": commander.schedule[0].deal[0] should be one of ${rarities}, not "epic"`,
    `army "vasse": commander.schedule[0].deal[1] should be a rarity (${rarities}), { "power": its id } or { "from": a Nexus }, not 3`,
  ])
})
