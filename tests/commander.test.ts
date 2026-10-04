// The Commander (pulse.md): a persistent `@` on the units layer who, when she falls, is absent for the
// rest of that round's Pulse and the whole of the next round, and is then restored beside her side's Grid
// Nexus. The kernel's half is that it knows nothing of her, so her death decides nothing; the match's half
// is the absence and the restoration (`src/match/commander.ts`), proven on a named scenario
// (`tests/commander-fixture.ts`) that hashes the same on every run and both runtimes. What a player reads of
// it is tests/commander-screen.test.ts.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_STANDING, starterGrid } from "../src/build/catalog.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { artFor } from "../src/content/art.ts"
import { footprintDistance } from "../src/grid/coords.ts"
import {
  commanderRegistry,
  fallen,
  openingState,
  recall,
  resolveMissionPulse,
  restoreCommanders,
} from "../src/match/index.ts"
import type { Absence, MissionPulse, Restoration } from "../src/match/index.ts"
import { PERIMETER } from "../src/armies/index.ts"
import { MissionError, validateMission } from "../src/mission/index.ts"
import type { MissionDefinition } from "../src/mission/index.ts"
import { hashState } from "../src/state/serialize.ts"
import type { MatchState } from "../src/state/types.ts"
import { entityGlyph } from "../src/view/theme.ts"
import { COMMANDER_FALLS, VASSE } from "./commander-fixture.ts"

const grid = starterGrid()
const registry = FIXTURE_REGISTRY
const NEXUS = "structure.citizen.nexus"

type Round = Readonly<{ pulse: MissionPulse; restored: readonly Restoration[]; absent: readonly Absence[] }>

/** A mission played round by round as the screen plays it: Recall between rounds, the Commanders who fell
 *  counted, and whoever is due set down beside the Nexus before the next round opens. `absent` is who is
 *  out when the round's Pulse has ended. */
function playWithCommanders(mission: MissionDefinition, plans: readonly (readonly { contentId: string; anchor: { x: number; y: number } }[])[] = []): Round[] {
  const rounds: Round[] = []
  let carried: MatchState | null = null
  let absent: Absence[] = []
  for (let number = 1; number <= mission.pulses; number += 1) {
    let restored: readonly Restoration[] = []
    if (carried !== null) {
      const back = restoreCommanders(carried, absent, number, registry)
      carried = back.state
      absent = back.absent
      restored = back.restored
    }
    const structures = [...(number === 1 ? STARTER_STANDING : []), ...(plans[number - 1] ?? [])]
    const pulse = resolveMissionPulse({ mission, grid, registry, pulse: number, carried, structures })
    absent = [...absent, ...fallen(pulse.events, registry, number)]
    rounds.push({ pulse, restored, absent })
    if (pulse.verdict.kind !== "continue") break
    carried = recall(pulse.final, registry).state
  }
  return rounds
}

const vasseIn = (state: MatchState) => state.entities.filter((entity) => entity.contentId === VASSE)

// --- Vasse -------------------------------------------------------------------------------------------

test("Vasse is a Commander: a persistent @ on the units layer, and PERIMETER brings her with the squads", () => {
  const vasse = registry.get(VASSE)
  assert.equal(vasse.commander, true)
  assert.equal(vasse.layer, "units")
  assert.deepEqual(artFor(VASSE), ["@"])
  // The one glyph that is not a letter: the same for either side, so neither case can hide her.
  assert.equal(entityGlyph(VASSE, "A", { x: 0, y: 0 }), "@")
  assert.equal(entityGlyph(VASSE, "B", { x: 0, y: 0 }), "@")
  // No other content is a Commander.
  assert.deepEqual(registry.ids().filter((id) => registry.get(id).commander === true), [VASSE])

  const squads = PERIMETER.triggers.find((trigger) => trigger.id === "squads")
  const spawned = squads?.do.flatMap((action) => ("spawn" in action ? action.spawn.units : []))
  assert.deepEqual(spawned?.filter((entry) => entry.unit === VASSE), [{ unit: VASSE, count: 1 }])

  // Persistent: round 2 opens with the same Vasse, her id, her ordinal and her health, home at the Nexus.
  const [round1, round2] = playWithCommanders(PERIMETER)
  assert.ok(round1 !== undefined && round2 !== undefined)
  const [first] = vasseIn(round1.pulse.states[0] as MatchState)
  assert.ok(first !== undefined, "PERIMETER's round 1 opened without her")
  const survived = vasseIn(round1.pulse.final)[0]
  assert.ok(survived !== undefined, "she fell in PERIMETER's round 1 with nothing built")
  const [again] = vasseIn(round2.pulse.states[0] as MatchState)
  assert.ok(again !== undefined)
  assert.deepEqual([again.id, again.ordinal, again.hp], [first.id, first.ordinal, survived.hp])
  const move = recall(round1.pulse.final, registry).moves.find((entry) => entry.ordinal === first.ordinal)
  assert.equal(move?.home, "nexus", "she has no building that makes her: the Grid Nexus is her home")
})

test("a mission brings its Commander once: two of her, or a second arrival, is refused by name", () => {
  const twice: MissionDefinition = {
    ...COMMANDER_FALLS,
    triggers: [
      ...COMMANDER_FALLS.triggers,
      { id: "again", when: { pulse: 2, tick: 0 }, do: [{ spawn: { side: "A", units: [{ unit: VASSE, count: 1 }], at: "muster" } }] },
      { id: "pair", when: { pulse: 3, tick: 0 }, do: [{ spawn: { side: "B", units: [{ unit: VASSE, count: 2 }], at: "ambush" } }] },
    ],
  }
  assert.throws(
    () => validateMission(twice, grid, registry),
    (error: unknown) =>
      error instanceof MissionError &&
      error.problems.some((problem) => /"again".*the Commander "unit\.citizen\.vasse" a second time/.test(problem)) &&
      error.problems.some((problem) => /"pair".*2 of the Commander "unit\.citizen\.vasse"; a side has one/.test(problem)),
  )
  assert.doesNotThrow(() => validateMission(COMMANDER_FALLS, grid, registry))
})

// --- The named scenario: she falls, sits a round out, and comes back --------------------------------

test("she falls in round 1 and is gone for the rest of it; her death ends nothing", () => {
  const [round1] = playWithCommanders(COMMANDER_FALLS)
  assert.ok(round1 !== undefined)
  const { pulse } = round1
  assert.equal(vasseIn(pulse.states[0] as MatchState).length, 1, "round 1 opened without her")
  const died = pulse.events.find((event) => event.kind === "entity.died" && event.contentId === VASSE)
  assert.ok(died !== undefined, "she did not fall")
  assert.ok(pulse.states.slice(died.tick).every((state) => vasseIn(state).length === 0), "she came back during the Pulse she fell in")
  // The fight went on without her, to the raid's end; the Grid Nexus, not she, is what a side loses by.
  assert.ok((pulse.final.outcome?.tick ?? 0) > died.tick)
  assert.deepEqual([pulse.final.outcome?.winner, pulse.final.outcome?.reason], ["A", "annihilation"])
  assert.deepEqual(fallen(pulse.events, registry, 1), [{ player: "A", contentId: VASSE, fellInRound: 1, returnsInRound: 3 }])
})

test("round 2 is played without her from its Build Phase to its end, and the Nexus restores her for round 3", () => {
  const rounds = playWithCommanders(COMMANDER_FALLS)
  const [round1, round2, round3] = rounds
  assert.ok(round1 !== undefined && round2 !== undefined && round3 !== undefined)

  // Round 2: out, in every state of it, and nothing restored at its start.
  assert.deepEqual(round2.restored, [])
  assert.ok(round2.pulse.states.every((state) => vasseIn(state).length === 0), "she was on the Grid in round 2")
  assert.deepEqual(round2.absent, [{ player: "A", contentId: VASSE, fellInRound: 1, returnsInRound: 3 }])

  // Round 3: back as it opens, a new body at full health, on the tile beside the Nexus.
  assert.equal(round3.restored.length, 1)
  const [back] = vasseIn(round3.pulse.states[0] as MatchState)
  assert.ok(back !== undefined, "round 3 opened without her")
  const first = vasseIn(round1.pulse.states[0] as MatchState)[0]
  assert.ok(first !== undefined)
  assert.notEqual(back.ordinal, first.ordinal, "a restored Commander is a new body, not the fallen one")
  assert.equal(back.player, "A")
  assert.equal(back.hp, registry.get(VASSE).maxHp)
  const nexus = (round3.pulse.states[0] as MatchState).entities.find((entity) => entity.contentId === NEXUS)
  assert.ok(nexus !== undefined)
  assert.equal(footprintDistance(back.anchor, registry.get(VASSE).footprint, nexus.anchor, registry.get(NEXUS).footprint), 1)
  assert.deepEqual(round3.absent, [])
  // And the mission went on to be held: nothing about her decides it.
  assert.deepEqual(round3.pulse.verdict, { kind: "won", trigger: "hold" })
})

test("the named scenario is the same every run, and on both runtimes", () => {
  const fingerprint = (rounds: readonly Round[]) => rounds.map((round) => [hashState(round.pulse.final), round.pulse.events.length, JSON.stringify(round.absent)])
  const first = fingerprint(playWithCommanders(COMMANDER_FALLS))
  for (let run = 0; run < 5; run += 1) assert.deepEqual(fingerprint(playWithCommanders(COMMANDER_FALLS)), first)
  // Pinned: Node and Bun run this same line, so a runtime that resolves a round differently fails here.
  assert.deepEqual(first.map(([hash]) => hash), PINNED_ROUNDS)
})

const PINNED_ROUNDS = [
  "b56ca4dc7474cd79494b6afba0695b7b16733c010da2f85d1fc9ff0e13dd4ac5",
  "2d5ea7c9b5fcfbf54d947418cfc09e041d216fb1bfe537350c736faf55b4d61f",
  "f1f31ffd600d2920bf2aabc32aa9f550a710104b2cf64d8704cc7d468886b443",
]

// --- The rule's edges --------------------------------------------------------------------------------

test("a Commander due back with no Grid Nexus standing stays absent until there is one", () => {
  const due: Absence = { player: "A", contentId: VASSE, fellInRound: 1, returnsInRound: 3 }
  const withNexus = openingState({ grid, registry, structures: STARTER_STANDING, setup: { seed: 1, pulseTicks: 10, forces: [] } })
  const noNexus: MatchState = { ...withNexus, entities: withNexus.entities.filter((entity) => entity.contentId !== NEXUS) }

  const early = restoreCommanders(withNexus, [due], 2, registry)
  assert.deepEqual([early.restored, early.absent], [[], [due]], "she came back a round early")
  assert.equal(early.state, withNexus)

  const nowhere = restoreCommanders(noNexus, [due], 3, registry)
  assert.deepEqual([nowhere.restored, nowhere.absent], [[], [due]])
  assert.equal(vasseIn(nowhere.state).length, 0)

  const later = restoreCommanders(withNexus, [due], 4, registry)
  assert.equal(later.restored.length, 1)
  assert.deepEqual(later.absent, [])
  const [restored] = vasseIn(later.state)
  assert.ok(restored !== undefined)
  assert.equal(restored.ordinal, withNexus.nextOrdinal)
  assert.equal(later.state.nextOrdinal, withNexus.nextOrdinal + 1)
})

test("Vasse's health is the Experiment's while it is tuned, and a carried Commander never has more than it allows", () => {
  const tuned = commanderRegistry(registry, 20)
  assert.equal(tuned.get(VASSE).maxHp, 20)
  for (const id of registry.ids().filter((candidate) => candidate !== VASSE)) assert.equal(tuned.get(id), registry.get(id))
  assert.throws(() => commanderRegistry(registry, 0), /positive integer/)

  // Turned down between rounds: a Vasse carried at 70 opens the next round at the new 20.
  const opening = openingState({
    grid,
    registry,
    structures: STARTER_STANDING,
    setup: { seed: 1, pulseTicks: 10, forces: [{ player: "A", muster: { x: 22, y: 10 }, units: [VASSE] }] },
  })
  const carried: MatchState = { ...opening, entities: opening.entities.map((entity) => (entity.contentId === VASSE ? { ...entity, hp: 70 } : entity)) }
  const next = openingState({ grid, registry: tuned, structures: [], setup: { seed: 1, pulseTicks: 10, forces: [] }, carried })
  assert.equal(vasseIn(next)[0]?.hp, 20)
  // Nothing else is touched: every other carried entity keeps its health.
  for (const entity of next.entities.filter((candidate) => candidate.contentId !== VASSE)) {
    assert.equal(entity.hp, carried.entities.find((before) => before.ordinal === entity.ordinal)?.hp)
  }
})
