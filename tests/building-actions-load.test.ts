// The army loader holds a building's actions to the rules (`src/armies/load.ts`, `src/armies/actions.ts`): every
// problem said at once, by the building and the action, the way the rest of an army file is checked. What a building
// may declare: an upgrade with its price and what it changes, modes in sets whose first is the building as written,
// and the orders the game has — each changing that one building, in a Nexus power's own words.

import { test } from "node:test"
import assert from "node:assert/strict"
import { ARMIES, ARMY_FILES, ArmyError, applyEffect, loadArmies } from "../src/armies/index.ts"
import type { Loadout } from "../src/armies/index.ts"
import { STARTER_CATALOG, constructItem } from "../src/build/catalog.ts"
import type { ConstructItem } from "../src/build/types.ts"
import type { LoadWorld } from "../src/armies/index.ts"
import { MAPS } from "../src/build/maps.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"

const WORLD: LoadWorld = { registry: FIXTURE_REGISTRY, maps: MAPS }
const BARRACKS = "structure.citizen.barracks"
const TURRET = "structure.bench.beamturret"

/** What loading the game's armies with `army` beside them reports. */
function problemsWith(army: object): readonly string[] {
  try {
    loadArmies({ armies: [...ARMY_FILES, army] }, WORLD)
    return []
  } catch (error) {
    assert.ok(error instanceof ArmyError, String(error))
    return error.problems
  }
}

/** An army of one building card on the bench Hatchery (which spawns), with `actions`. */
const hatcheryWith = (actions: readonly object[], extra: object = {}): object => ({
  id: "test",
  title: "A test army",
  requires: ["all"],
  buildings: [
    {
      id: "test-hatchery",
      structure: "structure.bench.hatchery",
      cost: 30,
      spawns: { unit: "unit.bench.spawnling", perWave: 3, waves: 1, secondsBetween: 10 },
      actions,
      ...extra,
    },
  ],
})

test("the game's own buildings' actions load: Hold production on every building that makes units, the Barracks's production line, the Turret's upgrade and aims", () => {
  const cards = Object.values(ARMIES.arsenals).flatMap((arsenal) => arsenal.buildings)
  for (const card of cards) {
    const orders = (card.actions ?? []).filter((action) => action.kind === "order").map((action) => action.order)
    assert.deepEqual(orders, card.spawns === undefined ? [] : ["hold"], `${card.id} does not have Hold production as its one order`)
  }
  const barracks = cards.find((card) => card.id === "barracks")
  assert.deepEqual(barracks?.actions?.map((action) => [action.id, action.kind, action.cost ?? 0]), [
    ["hold", "order", 0],
    ["production-line", "upgrade", 15],
  ])
  const turret = cards.find((card) => card.id === "turret")
  assert.deepEqual(turret?.actions?.map((action) => [action.id, action.kind, action.set ?? null]), [
    ["heavy-rounds", "upgrade", null],
    ["nearest-first", "mode", "aim"],
    ["units-first", "mode", "aim"],
  ])
})

test("a building's actions are checked as the rest of an army is, every problem said at once, by building and action", () => {
  const problems = problemsWith(
    hatcheryWith([
      { id: "Bad Id", kind: "upgrade", label: "Thicker walls", cost: 10, effects: [{ addPerWave: { building: "test-hatchery", perWave: 1 } }] },
      { id: "twice", kind: "upgrade", label: "One", cost: 5, effects: [{ addPerWave: { building: "test-hatchery", perWave: 1 } }] },
      { id: "twice", kind: "upgrade", label: "Two", cost: 5, effects: [{ addPerWave: { building: "test-hatchery", perWave: 1 } }] },
      { id: "long", kind: "upgrade", label: "A label far too long for its row", cost: 5, effects: [{ addWaves: { building: "test-hatchery", waves: 1 } }] },
      { id: "free", kind: "upgrade", label: "Free", effects: [{ addWaves: { building: "test-hatchery", waves: 1 } }] },
      { id: "empty", kind: "upgrade", label: "Empty", cost: 5 },
      { id: "elsewhere", kind: "upgrade", label: "Elsewhere", cost: 5, effects: [{ addPerWave: { building: "barracks", perWave: 1 } }] },
      { id: "power-only", kind: "upgrade", label: "Power only", cost: 5, effects: [{ spawnUnits: { unit: "unit.bench.spawnling", count: 2 } }] },
      { id: "needs", kind: "upgrade", label: "Needs", cost: 5, effects: [{ addWaves: { building: "test-hatchery", waves: 1 } }], requires: { actions: ["nothing", "a-mode"], buildings: ["no-such"] } },
      { id: "a-mode", kind: "mode", label: "A mode", effects: [{ addWaves: { building: "test-hatchery", waves: 1 } }] },
      { id: "order", kind: "order", label: "Order", order: "charge" },
      { id: "stray", kind: "order", label: "Stray", order: "hold", cost: 3, set: "x" },
    ]),
  )
  const expect = [
    `army "test": the building "test-hatchery" has the action "Bad Id": an action's id is lower case, digits and dashes`,
    `army "test": the building "test-hatchery" has the action "twice" twice`,
    `army "test": the building "test-hatchery" has the action "long" labelled "A label far too long for its row", 32 glyphs: a card's row has room for 18`,
    `army "test": the building "test-hatchery" has the upgrade action "free" with no cost: an upgrade is bought with credits`,
    `army "test": the building "test-hatchery" has the upgrade action "empty", which changes nothing`,
    `army "test": the building "test-hatchery" has the action "elsewhere" changing "barracks": a building's action changes that building alone, "test-hatchery"`,
    `army "test": the building "test-hatchery" has the action "power-only" changing it by "spawnUnits", which a building's action cannot: "addWaves", "addPerWave", "modifyAbility", "modifyAttack", "setTargetPreference" can`,
    `army "test": the building "test-hatchery" has the action "needs" requiring "nothing", which is not one of its actions`,
    `army "test": the building "test-hatchery" has the action "needs" requiring "a-mode", a mode: an action requires the building's upgrades`,
    `army "test": the building "test-hatchery" has the action "needs" requiring the building "no-such", which no army has`,
    `army "test": the building "test-hatchery" has the order action "order", which gives "charge": the game's orders are "hold"`,
    `army "test": the building "test-hatchery" has the order action "stray" with a set, which only a mode has`,
    `army "test": the building "test-hatchery" has the order action "stray" with a cost, which only an upgrade or a mode has`,
    `army "test": the building "test-hatchery" has one mode in the set "mode", "a-mode": a set of modes has two or more`,
    `army "test": the building "test-hatchery" has "a-mode" first in the set of modes "mode", which changes or costs something: the first is the building as it is written`,
  ]
  for (const problem of expect) assert.ok(problems.includes(problem), `not said: ${problem}\nsaid:\n${problems.join("\n")}`)
})

test("a set of modes: the first is the building as written, every other changes it; an order needs a building it can be given to; and there are keys for four", () => {
  const modes = problemsWith(
    hatcheryWith([
      { id: "calm", kind: "mode", set: "temper", label: "Calm" },
      { id: "angry", kind: "mode", set: "temper", label: "Angry" },
    ]),
  )
  assert.ok(modes.includes(`army "test": the building "test-hatchery" has the mode "angry", which changes nothing`), modes.join("\n"))
  const turret = problemsWith({
    id: "test",
    title: "A test army",
    requires: ["all"],
    buildings: [{ id: "test-turret", structure: "structure.bench.beamturret", cost: 15, actions: [{ id: "hold", kind: "order", label: "Hold production", order: "hold" }] }],
  })
  assert.ok(turret.includes(`army "test": the building "test-turret" has the order action "hold", "hold", and makes no units for it to hold`), turret.join("\n"))
  const five = Array.from({ length: 5 }, (_, index) => ({ id: `up-${index}`, kind: "upgrade", label: `Up ${index}`, cost: 1, effects: [{ addWaves: { building: "test-hatchery", waves: 1 } }] }))
  assert.ok(problemsWith(hatcheryWith(five)).includes(`army "test": the building "test-hatchery" has 5 upgrades and modes: a building has keys for 4`))
})

test("what an action changes is held to its effect's own rules: a reach is 1 or even, an attack still deals something", () => {
  const problems = problemsWith({
    id: "test",
    title: "A test army",
    requires: ["all"],
    buildings: [
      {
        id: "test-turret",
        structure: "structure.bench.beamturret",
        cost: 15,
        actions: [
          { id: "odd", kind: "upgrade", label: "Odd reach", cost: 5, effects: [{ modifyAttack: { content: "structure.bench.beamturret", add: { range: 1 } } }] },
          { id: "blunt", kind: "upgrade", label: "Blunt", cost: 5, effects: [{ modifyAttack: { content: "structure.bench.beamturret", add: { damage: -6 } } }] },
          { id: "speed", kind: "upgrade", label: "Speed", cost: 5, effects: [{ modifyAttack: { content: "structure.bench.beamturret", add: { speed: 1 } } }] },
        ],
      },
    ],
  })
  for (const problem of [
    `army "test": the building "test-turret" has the action "odd", which makes the attack of "structure.bench.beamturret" reach 7: a reach is 1 or even`,
    `army "test": the building "test-turret" has the action "blunt", which leaves the attack of "structure.bench.beamturret" dealing 0`,
    `army "test": the building "test-turret" has the action "speed", which adds to "speed", which is not one of an attack's "damage", "range", "cooldownTicks"`,
  ]) {
    assert.ok(problems.includes(problem), `not said: ${problem}\nsaid:\n${problems.join("\n")}`)
  }
})

test("one card says what a building can do: two cards giving one structure actions are refused", () => {
  const problems = problemsWith({
    id: "test",
    title: "A test army",
    requires: ["all"],
    buildings: [
      {
        id: "test-turret",
        structure: "structure.bench.beamturret",
        cost: 15,
        actions: [{ id: "heavier", kind: "upgrade", label: "Heavier", cost: 5, effects: [{ modifyAttack: { content: "structure.bench.beamturret", add: { damage: 1 } } }] }],
      },
    ],
  })
  assert.ok(problems.includes(`the buildings "turret" and "test-turret" both give "structure.bench.beamturret" actions; one card says what a building can do`), problems.join("\n"))
})

test("the new effects also work as Nexus powers: every building of a kind, where a building's action changes one", () => {
  // A power naming the Barracks's production line's effect loads, and keeping it gives every Barracks's menu row five.
  const armies = loadArmies(
    {
      armies: [
        ...ARMY_FILES,
        {
          id: "test",
          title: "A test army",
          requires: ["citizen"],
          powers: [
            { id: "drill", name: "Drill", description: "Every Barracks trains one more.", effect: { addPerWave: { building: "barracks", perWave: 1 } }, rarity: "common", role: "production" },
            { id: "aim", name: "Aim", description: "Every Turret fires at units first.", effect: { setTargetPreference: { content: "structure.bench.beamturret", prefer: ["units"] } }, rarity: "common", role: "defense" },
          ],
        },
      ],
    },
    WORLD,
  )
  const powers = armies.arsenals["test"]?.powers ?? []
  const drill = powers.find((card) => card.id === "drill")
  const aim = powers.find((card) => card.id === "aim")
  assert.ok(drill !== undefined && aim !== undefined)
  const cards = armies.arsenals["citizen"]?.buildings ?? []
  const loadout: Loadout<ConstructItem> = {
    registry: armies.registry,
    catalog: STARTER_CATALOG,
    callups: [],
    cards,
    row: (card, index) => constructItem(card, index, cards),
  }
  const drilled = applyEffect(loadout, drill.effect)
  assert.equal(drilled.catalog.find((item) => item.contentId === BARRACKS)?.spawns?.perWave, 5)
  // A power and a building's own upgrade add up: every Turret prefers units, and one with heavy rounds hits for 9 too.
  const aimed = applyEffect(loadout, aim.effect)
  assert.deepEqual(aimed.registry.get(TURRET).targetPreference, ["units"])
  const heavy = aimed.registry.get(`${TURRET}+heavy-rounds`)
  assert.deepEqual([heavy.attack?.damage, heavy.targetPreference], [9, ["units"]])
})
