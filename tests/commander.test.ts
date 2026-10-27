// The Commander (pulse.md): a persistent `@` on the units layer who, when she falls, is absent for the
// rest of that round's Pulse and for as many whole rounds after it as her definition says (`roundsOut`: none for
// Vasse), and is then restored beside her side's Grid Nexus. The kernel's half is that it knows nothing of her, so
// her death decides nothing; the match's half is the absence and the restoration (`src/match/commander.ts`),
// proven on a named scenario (`tests/commander-fixture.ts`) that hashes the same on every run and both runtimes,
// played with Vasse as she is and with a test-only Vasse who sits one round out, or two. What a player reads of
// it is tests/commander-screen.test.ts.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_STANDING, starterGrid } from "../src/build/catalog.ts"
import { FIXTURE_REGISTRY, createRegistry } from "../src/content/index.ts"
import type { ContentRegistry } from "../src/content/index.ts"
import { artFor } from "../src/content/art.ts"
import { footprintSteps } from "../src/grid/coords.ts"
import {
  fallen,
  openingState,
  regroup,
  resolveMissionPulse,
  restoreCommanders,
  roundsOutOf,
} from "../src/match/index.ts"
import type { Absence, MissionPulse, Restoration } from "../src/match/index.ts"
import { PERIMETER } from "../src/armies/index.ts"
import { MissionError, validateMission } from "../src/mission/index.ts"
import type { MissionDefinition } from "../src/mission/index.ts"
import { hashState } from "../src/state/serialize.ts"
import type { MatchState } from "../src/state/types.ts"
import { entityGlyph } from "../src/view/theme.ts"
import { COMMANDER_FALLS, VASSE, sittingOut } from "./commander-fixture.ts"

const grid = starterGrid()
const registry = FIXTURE_REGISTRY
const NEXUS = "structure.citizen.nexus"

type Round = Readonly<{ pulse: MissionPulse; restored: readonly Restoration[]; absent: readonly Absence[] }>

/** A mission played round by round as the screen plays it: the regroup between rounds, the Commanders who fell
 *  counted, and whoever is due set down beside the Nexus before the next round opens. `absent` is who is
 *  out when the round's Pulse has ended. */
function playWithCommanders(
  mission: MissionDefinition,
  plans: readonly (readonly { contentId: string; anchor: { x: number; y: number } }[])[] = [],
  registry: ContentRegistry = FIXTURE_REGISTRY,
): Round[] {
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
    carried = regroup(pulse.final, registry).state
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
  // The Commanders are Vasse, Averno and Dob, each with a glyph that is not a letter: hers `@`, his `&`, Dob's `$`.
  assert.deepEqual(registry.ids().filter((id) => registry.get(id).commander === true).sort(), ["unit.citizen.averno", VASSE, "unit.ravel.dob"])
  assert.deepEqual(artFor("unit.citizen.averno"), ["&"])
  assert.deepEqual(artFor("unit.ravel.dob"), ["$"])

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
  // Between the rounds she stays on the Grid and regroups with her army, the same unit (no walk home any more).
  assert.ok(regroup(round1.pulse.final, registry).paths.some((path) => path.ordinal === first.ordinal))
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

// --- The named scenario: she falls, and the Nexus restores her as the next round opens ----------------

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
  // Vasse sits no round out: due back as the very next round opens.
  assert.equal(registry.get(VASSE).roundsOut, 0)
  assert.deepEqual(fallen(pulse.events, registry, 1), [{ player: "A", contentId: VASSE, fellInRound: 1, returnsInRound: 2 }])
  // A Commander who sits rounds out is due back that many rounds later.
  assert.deepEqual(fallen(pulse.events, sittingOut(1), 1), [{ player: "A", contentId: VASSE, fellInRound: 1, returnsInRound: 3 }])
  assert.deepEqual(fallen(pulse.events, sittingOut(2), 1), [{ player: "A", contentId: VASSE, fellInRound: 1, returnsInRound: 4 }])
})

/** Round `round` opened with her restored: a new body at full health, on a tile touching the Nexus. */
function assertRestored(rounds: readonly Round[], round: number): void {
  const opened = rounds[round - 1]
  const first = vasseIn(rounds[0]?.pulse.states[0] as MatchState)[0]
  assert.ok(opened !== undefined && first !== undefined)
  assert.equal(opened.restored.length, 1)
  const [back] = vasseIn(opened.pulse.states[0] as MatchState)
  assert.ok(back !== undefined, `round ${round} opened without her`)
  assert.notEqual(back.ordinal, first.ordinal, "a restored Commander is a new body, not the fallen one")
  assert.equal(back.player, "A")
  assert.equal(back.hp, registry.get(VASSE).maxHp)
  const nexus = (opened.pulse.states[0] as MatchState).entities.find((entity) => entity.contentId === NEXUS)
  assert.ok(nexus !== undefined)
  assert.equal(footprintSteps(back.anchor, registry.get(VASSE).footprint, nexus.anchor, registry.get(NEXUS).footprint), 1, "she was not set down touching the Nexus")
}

test("the Nexus restores her as round 2 opens: no round is played without her", () => {
  const rounds = playWithCommanders(COMMANDER_FALLS)
  const [round1, round2, round3] = rounds
  assert.ok(round1 !== undefined && round2 !== undefined && round3 !== undefined)
  assert.deepEqual(round1.absent, [{ player: "A", contentId: VASSE, fellInRound: 1, returnsInRound: 2 }])
  assertRestored(rounds, 2)
  assert.ok(round2.absent.every((absence) => absence.fellInRound === 2), "she was still out after round 2 opened")
  // And the mission went on to be held: nothing about her decides it.
  assert.deepEqual(round3.pulse.verdict, { kind: "won", trigger: "hold" })
})

test("a Commander who sits one round out: round 2 is played without her from its Build Phase to its end, and the Nexus restores her for round 3", () => {
  const rounds = playWithCommanders(COMMANDER_FALLS, [], sittingOut(1))
  const [, round2, round3] = rounds
  assert.ok(round2 !== undefined && round3 !== undefined)

  // Round 2: out, in every state of it, and nothing restored at its start.
  assert.deepEqual(round2.restored, [])
  assert.ok(round2.pulse.states.every((state) => vasseIn(state).length === 0), "she was on the Grid in round 2")
  assert.deepEqual(round2.absent, [{ player: "A", contentId: VASSE, fellInRound: 1, returnsInRound: 3 }])

  // Round 3: back as it opens.
  assertRestored(rounds, 3)
  assert.deepEqual(round3.absent, [])
  assert.deepEqual(round3.pulse.verdict, { kind: "won", trigger: "hold" })
})

test("a Commander who sits two rounds out is out for the rest of the three-round mission", () => {
  const rounds = playWithCommanders(COMMANDER_FALLS, [], sittingOut(2))
  const [, round2, round3] = rounds
  assert.ok(round2 !== undefined && round3 !== undefined)
  for (const round of [round2, round3]) {
    assert.deepEqual(round.restored, [])
    assert.ok(round.pulse.states.every((state) => vasseIn(state).length === 0), "she was on the Grid while she sat out")
    assert.deepEqual(round.absent, [{ player: "A", contentId: VASSE, fellInRound: 1, returnsInRound: 4 }])
  }
  // Had the mission a fourth round, it would open with her: due in round 4, the Nexus sets her down as it opens. (From
  // round 2's end, where her Nexus still stands; with her out two rounds this empty base does not hold round 3.)
  const fourth = restoreCommanders(regroup(round2.pulse.final, registry).state, round2.absent, 4, registry)
  assert.equal(fourth.restored.length, 1)
  assert.deepEqual(fourth.absent, [])
})

test("the named scenario is the same every run, and on both runtimes, whatever she sits out", () => {
  const fingerprint = (rounds: readonly Round[]) => rounds.map((round) => [hashState(round.pulse.final), round.pulse.events.length, JSON.stringify(round.absent)])
  for (const [out, pinned] of [
    [0, PINNED_ROUNDS],
    [1, PINNED_SITTING_OUT],
  ] as const) {
    const play = () => playWithCommanders(COMMANDER_FALLS, [], out === 0 ? registry : sittingOut(out))
    const first = fingerprint(play())
    for (let run = 0; run < 5; run += 1) assert.deepEqual(fingerprint(play()), first)
    // Pinned: Node and Bun run this same line, so a runtime that resolves a round differently fails here.
    assert.deepEqual(
      first.map(([hash]) => hash),
      pinned,
      `sitting ${out} out`,
    )
  }
})

// The three rounds as the rules play them: By the Book guarding her and the troopers beside her, the ambush's two
// runners making sure she falls in round 1, a row counting two columns in every distance and step, and every step
// taking whole beats, one across and two up or down. Round 1 is the same whatever she sits out; from round 2 on,
// Vasse, back beside the Nexus, fights in it. Rounds 2 and 3 pinned again when the survivors came to stay on the Grid and
// regroup between rounds rather than walk home (2026-10-26).
const PINNED_ROUNDS = [
  "a1fcb4819094baac765e5ec929a87e942b4d7a955214fadcc723894d67ad8b86",
  "86be80c8fa8f41c517fa9aebe4b2492ba433402a57063bbb1993438d3e71d958",
  "0802c24e2939033c13db08ec27a01f252dc4be1976b543f375e60455ea3e5b9b",
]

// The same three rounds with a test-only Vasse who sits one round out: the rule as it stood before Vasse came back at
// once. Both sets pinned again when every tie came to go by what a unit faces, then a draw (no side wins by where it
// stands), and when units came to walk by routes; and rounds 2 and 3 when the survivors came to regroup between rounds (2026-10-26).
const PINNED_SITTING_OUT = [
  "a1fcb4819094baac765e5ec929a87e942b4d7a955214fadcc723894d67ad8b86",
  "6e0cf9eb3284a26bc53d4d6cea2baaff0bfdbb6aec951158fb3e714e5f2ad003",
  "d7a405d9afb6220854ccb7253bebaa827ca7171d84a7ae36ebe36a6360bc576f",
]

// --- The rule's edges --------------------------------------------------------------------------------

test("how many rounds a Commander sits out is a whole number from 0, and only a Commander has one", () => {
  const vasse = registry.get(VASSE)
  const trooper = registry.get("unit.citizen.trooper")
  assert.doesNotThrow(() => createRegistry([{ ...vasse, roundsOut: 2 }]))
  // Saying nothing is sitting none out.
  const { roundsOut: _none, ...unsaid } = vasse
  assert.equal(roundsOutOf(createRegistry([unsaid]), VASSE), 0)
  assert.equal(roundsOutOf(sittingOut(2), VASSE), 2)
  assert.throws(() => createRegistry([{ ...vasse, roundsOut: -1 }]), /whole number from 0/)
  assert.throws(() => createRegistry([{ ...vasse, roundsOut: 1.5 }]), /whole number from 0/)
  assert.throws(() => createRegistry([{ ...trooper, roundsOut: 1 }]), /only a Commander sits rounds out/)
})

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

test("Vasse's health is her own, settled at 80, and a carried Commander never has more than her content allows", () => {
  // The Experiment "Vasse's health" was felt and settled at 80: her health is her army's data now.
  assert.equal(registry.get(VASSE).maxHp, 80)
  // A content whose most is lowered between rounds (a mod, a later power): a Vasse carried at 70 opens at the new 20.
  const tuned = createRegistry(registry.ids().map((id) => (id === VASSE ? { ...registry.get(id), maxHp: 20 } : registry.get(id))))
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
