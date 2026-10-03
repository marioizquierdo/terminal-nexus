// A Commander's deck (src/content/armies.ts; commander-armies.md, the Commander Army): defined once, read
// whole by any mode that picks her, and overridden by a Campaign mission, which develops the deck level by
// level. The owner, 2026-10-03: "players should be able to pick Vasse on the other game modes. Here in the
// campaign we are developing (unlocking) the deck, so a campaign level should be able to override the actual
// deck."

import { test } from "node:test"
import assert from "node:assert/strict"
import { constructMenu, nexusDraftOf, STARTER_ALLOTMENT, STARTER_CATALOG, STARTER_NEXUS_DRAFT, starterGrid } from "../src/build/catalog.ts"
import { missionPlay } from "../src/cli/pulse-run.ts"
import { missionContext, starterContext } from "../src/cli/starter.ts"
import type { CommanderArmy } from "../src/content/armies.ts"
import { armyById, COMMANDER_ARMIES, deckOf, deckProblems, VASSE_ARMY } from "../src/content/armies.ts"
import { createRegistry, FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { MissionDefinition } from "../src/mission/index.ts"
import { MissionError, missionDeck, PERIMETER, validateMission } from "../src/mission/index.ts"
import { buildSide, panelLines, compose } from "./build-helpers.ts"

/** The problems validation reports for `mission` on the starter map, or none. */
function problemsOf(mission: MissionDefinition, registry = FIXTURE_REGISTRY): readonly string[] {
  try {
    validateMission(mission, starterGrid(), registry)
    return []
  } catch (error) {
    assert.ok(error instanceof MissionError, String(error))
    return error.problems
  }
}

/** PERIMETER with another deck, or another override of Vasse's. */
const withPlayer = (player: NonNullable<MissionDefinition["player"]>): MissionDefinition => ({ ...PERIMETER, player })

test("Vasse's deck: her Commander, her credits, her buildings and her Nexus powers, defined once and valid", () => {
  assert.deepEqual(
    COMMANDER_ARMIES.map((army) => army.id),
    ["army.citizen.vasse"],
  )
  assert.equal(armyById("army.citizen.vasse"), VASSE_ARMY)
  assert.equal(armyById("army.citizen.nobody"), undefined)
  for (const army of COMMANDER_ARMIES) assert.deepEqual(deckProblems(army, FIXTURE_REGISTRY), [], army.id)
  assert.equal(FIXTURE_REGISTRY.get(VASSE_ARMY.commander).commander, true)
  assert.equal(VASSE_ARMY.faction, "citizen")
})

test("a mode that picks her reads the deck whole: its buildings by digit in the deck's order, and its powers", () => {
  assert.deepEqual(
    constructMenu(VASSE_ARMY).map((item) => `${item.hotkey} ${item.label} ${item.cost}`),
    ["1 Barracks 40", "2 Hatchery 30", "3 Turret 15"],
  )
  assert.deepEqual(
    nexusDraftOf(VASSE_ARMY).map((power) => `${power.hotkey} ${power.name} +${power.bonusAllotment}`),
    ["1 Reserve Fund +30", "2 War Chest +2000"],
  )
  // The Build Phase's starter content is her deck: nothing about it is chosen anywhere else.
  assert.deepEqual(STARTER_CATALOG, constructMenu(VASSE_ARMY))
  assert.deepEqual(STARTER_NEXUS_DRAFT, nexusDraftOf(VASSE_ARMY))
  assert.equal(STARTER_ALLOTMENT, VASSE_ARMY.allotment)
})

test("PERIMETER names Vasse's deck and what mission 1 unlocks of it: today, all of it", () => {
  assert.equal(PERIMETER.player?.army, VASSE_ARMY.id)
  const deck = missionDeck(PERIMETER)
  assert.ok(deck !== null)
  assert.deepEqual(deck.blueprints, VASSE_ARMY.blueprints)
  assert.deepEqual(deck.nexusPowers, VASSE_ARMY.nexusPowers)
  assert.equal(deck.allotment, VASSE_ARMY.allotment)
  // And the Build Phase the game opens is built from it.
  const context = starterContext()
  assert.deepEqual(context.catalog, constructMenu(deck))
  assert.deepEqual(context.nexusDraft, nexusDraftOf(deck))
  assert.equal(context.allotment, deck.allotment)
})

test("a mission overrides the deck: an id unlocks the deck's own entry, a whole entry is the level's own", () => {
  // Unlocking part of it, in the level's order.
  const unlocked = deckOf(VASSE_ARMY, { blueprints: ["structure.bench.beamturret", "structure.citizen.barracks"], nexusPowers: ["power.citizen.reserve-fund"] })
  assert.deepEqual(unlocked.blueprints, [
    { structure: "structure.bench.beamturret", cost: 15 },
    { structure: "structure.citizen.barracks", cost: 40 },
  ])
  assert.deepEqual(unlocked.nexusPowers.map((power) => power.id), ["power.citizen.reserve-fund"])
  assert.equal(unlocked.allotment, 100, "a part the override leaves out is the deck's")
  // Overriding outright: another cost, a power the deck does not hold, other credits.
  const own = { id: "power.mission.supply-drop", name: "Supply Drop", description: "Adds 10 resource to spend.", bonusAllotment: 10 }
  const overridden = deckOf(VASSE_ARMY, { allotment: 60, blueprints: [{ structure: "structure.bench.beamturret", cost: 10 }], nexusPowers: [own] })
  assert.deepEqual(overridden.blueprints, [{ structure: "structure.bench.beamturret", cost: 10 }])
  assert.deepEqual(overridden.nexusPowers, [own])
  assert.equal(overridden.allotment, 60)
  // Her Commander is the deck's, whatever a level unlocks.
  assert.equal(overridden.commander, VASSE_ARMY.commander)
  // No override is the whole deck.
  assert.deepEqual(deckOf(VASSE_ARMY), VASSE_ARMY)
})

test("a level's override is what its Build Phase offers: the menu, the credits and the Nexus draft", () => {
  const turretsOnly = withPlayer({
    army: VASSE_ARMY.id,
    override: { allotment: 45, blueprints: ["structure.bench.beamturret"], nexusPowers: ["power.citizen.reserve-fund"] },
  })
  const context = missionContext(missionPlay(turretsOnly))
  assert.deepEqual(context.catalog.map((item) => `${item.hotkey} ${item.label} ${item.cost}`), ["1 Turret 15"])
  assert.equal(context.allotment, 45)
  assert.deepEqual(context.nexusDraft.map((power) => power.name), ["Reserve Fund"])

  // And the panel says so: one building, under digit 1, and the credits.
  const side = buildSide({ context })
  const panel = panelLines(side, compose(side)).join("\n")
  assert.match(panel, /\[1\] Turret +15/)
  assert.doesNotMatch(panel, /Barracks|Hatchery/)
  assert.match(panel, /\b45\b/)
})

test("validation refuses a deck or an override that names what does not exist, by name, all at once", () => {
  assert.deepEqual(problemsOf(PERIMETER), [])
  assert.deepEqual(problemsOf(withPlayer({ army: "army.citizen.nobody" })), ['player plays the unknown deck "army.citizen.nobody"'])
  assert.throws(() => missionDeck(withPlayer({ army: "army.citizen.nobody" })), /unknown deck "army.citizen.nobody"/)

  const problems = problemsOf(
    withPlayer({
      army: VASSE_ARMY.id,
      override: {
        allotment: -5,
        blueprints: ["structure.ravel.den", { structure: "unit.citizen.trooper", cost: 10 }, "structure.bench.beamturret", "structure.bench.beamturret"],
        nexusPowers: ["power.citizen.nothing"],
      },
    }),
  )
  assert.deepEqual(problems, [
    'the override of deck "army.citizen.vasse" starts with -5 credits; credits are a whole number',
    'the override of deck "army.citizen.vasse" unlocks "structure.ravel.den", which the deck does not hold',
    'the override of deck "army.citizen.vasse" names "unit.citizen.trooper", which is not a building',
    'the override of deck "army.citizen.vasse" unlocks the Nexus power "power.citizen.nothing", which the deck does not hold',
    'the override of deck "army.citizen.vasse" lists the building "structure.bench.beamturret" twice',
  ])
})

test("a broken deck is refused by name: a Commander who is not one, a unit to build, a cost below nothing", () => {
  const broken: CommanderArmy = {
    ...VASSE_ARMY,
    id: "army.test.broken",
    commander: "unit.citizen.trooper",
    blueprints: [{ structure: "unit.citizen.marksman", cost: -1 }],
    nexusPowers: [VASSE_ARMY.nexusPowers[0]!, VASSE_ARMY.nexusPowers[0]!],
  }
  assert.deepEqual(deckProblems(broken, FIXTURE_REGISTRY), [
    'deck "army.test.broken" names "unit.citizen.trooper" as its Commander, which is not one',
    'deck "army.test.broken" names "unit.citizen.marksman", which is not a building',
    'deck "army.test.broken" gives "unit.citizen.marksman" the cost -1; a cost is a whole number',
    'deck "army.test.broken" lists the Nexus power "power.citizen.reserve-fund" twice',
  ])
})

test("the Commander a mission brings for the player is her deck's", () => {
  // A second Commander, only for this test: the player's deck is Vasse's, so bringing anyone else is refused.
  const other = { ...FIXTURE_REGISTRY.get(VASSE_ARMY.commander), id: "unit.test.other-commander" }
  const registry = createRegistry([...FIXTURE_REGISTRY.ids().map((id) => FIXTURE_REGISTRY.get(id)), other])
  const mission: MissionDefinition = {
    ...PERIMETER,
    triggers: PERIMETER.triggers.map((trigger) =>
      trigger.id !== "squads"
        ? trigger
        : {
            ...trigger,
            do: trigger.do.map((action) =>
              "spawn" in action
                ? { spawn: { ...action.spawn, units: action.spawn.units.map((entry) => (entry.unit === VASSE_ARMY.commander ? { ...entry, unit: other.id } : entry)) } }
                : action,
            ),
          },
    ),
  }
  assert.deepEqual(problemsOf(mission, registry), [
    'trigger "squads", action 1 (spawn) spawns the Commander "unit.test.other-commander" for the player, whose deck\'s Commander is "unit.citizen.vasse"',
  ])
})
