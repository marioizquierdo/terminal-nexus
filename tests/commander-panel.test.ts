// The Commander on screen (step 8D): the Commander panel in the Build Phase and the Battle Round, her place kept at
// the Nexus while she is out, the Nexus Pulse that restores her saying so, and the Activity Logs' record of her life.
// The owner, 2026-10-12: "giving them character and presence in the UI, checking if the resurrection mechanic
// through Nexus Pulses works well and is clear in the UI".

import { test } from "node:test"
import assert from "node:assert/strict"
import all from "../armies/all/army.json" with { type: "json" }
import vasse from "../armies/vasse/army.json" with { type: "json" }
import { ArmyError, loadArmies } from "../src/armies/index.ts"
import type { PlayableLevel } from "../src/cli/levels.ts"
import { levelById } from "../src/cli/levels.ts"
import { MAPS } from "../src/build/maps.ts"
import { popupSpec } from "../src/build/popup.ts"
import type { BuildContext } from "../src/build/state.ts"
import { createBuildState, nexusTile } from "../src/build/state.ts"
import { starterContext } from "../src/cli/starter.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { ACTIVITY_FILTERS, filteredEntries } from "../src/log/activity.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import type { BuildPlaytest } from "../src/playtest/build.ts"
import type { MatchState } from "../src/state/types.ts"
import { battleCommander, buildPhaseCommander, commanderLine, commanderRows, pulseCommander } from "../src/view/commander-panel.ts"
import type { CommanderStatus } from "../src/view/commander-panel.ts"
import { frameToText } from "../src/view/frame.ts"

const VASSE = "unit.citizen.vasse"

/** What loading the game's armies with Vasse's portrait replaced reports. */
function portraitProblems(portrait: unknown): readonly string[] {
  const commanders = vasse.commanders.map((commander) => ({ ...commander, portrait }))
  try {
    loadArmies([all, { ...vasse, commanders }], { registry: FIXTURE_REGISTRY, maps: MAPS })
    return []
  } catch (error) {
    assert.ok(error instanceof ArmyError, String(error))
    return error.problems
  }
}

/** A row of the panel as it reads. */
function read(status: CommanderStatus, width = 26): string[] {
  return commanderRows(status, width).map((row) => {
    let line = ""
    for (const part of row) line = (part.right === true ? line.padEnd(Math.max(line.length + 1, width - part.text.length)) : line) + part.text
    return line
  })
}

/** The cadence level — she falls in round 1, sits round 2 out, and the Nexus Pulse restores her for round 3 — played
 *  to the round given, as a player who builds nothing, with the keys given after. */
function cadence(keys: string): BuildPlaytest {
  return runBuildPlaytest({ steps: parseKeyScript(keys), at: { kind: "level", level: levelById("vasse-test-2") as PlayableLevel, round: 1 } })
}

/** Two rounds of the cadence level played through, nothing built and no power picked: the Battle Round's result
 *  stands at the end of each, and Enter goes on; round 2 opens on a line saying she is out, which Esc closes. */
const TWO_ROUNDS = "s s wait~1000*24 Enter Esc s s wait~1000*24 Enter"

test("a Commander's portrait is three rows of the same width, at most five glyphs of plain ASCII, or refused by name", () => {
  assert.deepEqual(portraitProblems([" _=_ ", "(-_-)", "/|#|\\"]), [])
  assert.match(portraitProblems(["(-_-)", "/|#|\\"]).join("\n"), /portrait has 2 rows; it takes 3/)
  assert.match(portraitProblems([" _=_", "(-_-)", "/|#|\\"]).join("\n"), /row 2 is 5 glyphs wide and row 1 is 4/)
  assert.match(portraitProblems(["(--_--)", "(--_--)", "(--_--)"]).join("\n"), /row 1 is 7 glyphs wide; a row is 1 to 5/)
  assert.match(portraitProblems(["(-é-)", "(-_-)", "/|#|\\"]).join("\n"), /row 1 has a glyph outside plain ASCII/)
})

test("the level carries its campaign's Commander, and the panel reads her ready, out and restored", () => {
  const context = starterContext()
  assert.deepEqual(context.commander, { contentId: VASSE, name: "Edda Vasse", portrait: [" _=_ ", "(-_-)", "/|#|\\"] })
  const state = createBuildState(context, nexusTile(context) ?? { x: 0, y: 0 }, { width: 49, height: 18 })
  const ready = buildPhaseCommander(context, state)
  assert.ok(ready !== null)
  assert.deepEqual(read(ready), [" _=_  VASSE          80/80", "(-_-) By the Book", "/|#|\\ ready"])
  // Out: the round she is back for, and her health a dash, drawn dim.
  const round2: BuildContext = { ...context, round: { number: 2, of: 3 }, absent: [{ player: "A", contentId: VASSE, fellInRound: 1, returnsInRound: 3 }] }
  const out = buildPhaseCommander(round2, state)
  assert.ok(out !== null)
  assert.deepEqual(read(out), [" _=_  VASSE           -/80", "(-_-) By the Book", "/|#|\\ out, back round 3"])
  assert.ok(commanderRows(out, 26)[0]?.every((part) => part.dim === true || part.role === "chrome.muted"), "her name is not drawn dim while she is out")
  // Past the mission's last round, she is not coming back in it.
  const late = buildPhaseCommander({ ...round2, round: { number: 3, of: 3 }, absent: [{ player: "A", contentId: VASSE, fellInRound: 2, returnsInRound: 4 }] }, state)
  assert.equal(read(late as CommanderStatus)[2], "/|#|\\ out, out this mission")
  // Restored by the Nexus Pulse, at the health she stands on the map with.
  const vasseThere = { contentId: VASSE, anchor: { x: 20, y: 9 }, player: "A" as const, hp: 80 }
  const back = buildPhaseCommander({ ...context, round: { number: 3, of: 3 }, field: [vasseThere], restored: [{ player: "A", contentId: VASSE }] }, state)
  assert.deepEqual(read(back as CommanderStatus)[2], "/|#|\\ restored this round")
  // Her one-line form, when the raid needs the rows.
  assert.equal(commanderLine(out, 26).map((part) => part.text).join(""), "@ VASSE out, back round 3")
  assert.deepEqual(commanderLine(ready, 26).map((part) => part.text), ["@ ", "VASSE ", "ready", "80/80"])
  assert.equal(commanderLine(ready, 26).at(-1)?.right, true, "her health is not set at the row's right end")
})

test("in a Battle Round the panel follows her health, and the moment she falls says the round she is back for", () => {
  const context: BuildContext = { ...starterContext(), round: { number: 1, of: 3 } }
  const fighting = battleCommander(context, 1, { hp: 55, maxHp: 80 })
  assert.deepEqual(read(fighting as CommanderStatus)[0], " _=_  VASSE          55/80")
  assert.deepEqual(read(fighting as CommanderStatus)[2], "/|#|\\ fighting")
  // Fallen in round 1: out for the rest of it and the whole of round 2, back for round 3.
  assert.equal(read(battleCommander(context, 1, { hp: null, maxHp: 80 }) as CommanderStatus)[2], "/|#|\\ fell, back round 3")
  // Sitting the round out.
  const away: BuildContext = { ...context, round: { number: 2, of: 3 }, absent: [{ player: "A", contentId: VASSE, fellInRound: 1, returnsInRound: 3 }] }
  assert.equal(read(battleCommander(away, 2, { hp: null, maxHp: 80 }) as CommanderStatus)[2], "/|#|\\ out, back round 3")
  // Read from the frame's own state: her entity, if she stands.
  const state = { entities: [{ player: "A", contentId: VASSE, hp: 31 }] } as unknown as MatchState
  const now = pulseCommander(context, { sample: { state } as never, registry: FIXTURE_REGISTRY }, 1)
  assert.equal(now?.hp, 31)
  // No Commander on the level, no panel.
  const { commander: _none, ...bare } = context
  assert.equal(battleCommander(bare, 1, { hp: 80, maxHp: 80 }), null)
})

test("played: round 2 opens with her out and her place kept at the Nexus, round 3 with the Nexus Pulse restoring her", () => {
  const run = cadence(`${TWO_ROUNDS} Esc n`)
  // Round 2, as it opened: the panel says she is out, and a dim @ beside the Nexus counts the round to wait.
  const round2 = run.frames.find((frame) => frame.state.pulseNumber === 2)
  assert.ok(round2 !== undefined)
  const text2 = frameToText(round2.frame)
  assert.match(text2, /@ VASSE out, back round 3|out, back round 3/)
  assert.match(text2, /@1/, "her place at the Nexus is not kept")
  // Round 3: the Nexus Pulse brought her back, and its popup says so first.
  const last = run.frames.at(-1)
  assert.ok(last !== undefined)
  assert.equal(last.state.pulseNumber, 3)
  assert.equal(last.state.popup, "nexus-powers")
  const text3 = frameToText(last.frame)
  assert.match(text3, /COMMANDER/)
  assert.match(text3, /Vasse restored beside the Nexus\./)
  assert.match(text3, /restored/)
  assert.doesNotMatch(text3, /@1/, "her place is still kept once she is back")
})

test("the Nexus Pulse popup says what it did for her: restored, or out and when she is back", () => {
  const context = starterContext()
  const state = { ...createBuildState(context, nexusTile(context) ?? { x: 0, y: 0 }, { width: 49, height: 18 }), popup: "nexus-powers" as const }
  const rows = (given: BuildContext) => (popupSpec(given, state)?.rows ?? []).filter((row) => row.kind === "heading" || row.kind === "text").map((row) => ("text" in row ? row.text : ""))
  assert.ok(!rows(context).includes("COMMANDER"), "a Pulse with her standing says nothing of her")
  assert.deepEqual(rows({ ...context, round: { number: 3, of: 3 }, restored: [{ player: "A", contentId: VASSE }] }).slice(0, 2), ["COMMANDER", "Vasse restored beside the Nexus."])
  assert.deepEqual(
    rows({ ...context, round: { number: 2, of: 3 }, absent: [{ player: "A", contentId: VASSE, fellInRound: 1, returnsInRound: 3 }] }).slice(0, 2),
    ["COMMANDER", "Vasse is out; back for round 3."],
  )
})

test("the Activity Logs record her life across the mission, under the Commander filter", () => {
  const run = cadence(TWO_ROUNDS)
  const filter = ACTIVITY_FILTERS.find((each) => each.name === "Commander")
  assert.ok(filter !== undefined)
  const story = [...filteredEntries(run.activity.entries(), filter)].reverse().map((entry) => [entry.event, entry.props])
  assert.deepEqual(
    story.filter(([event]) => String(event).startsWith("commander.")),
    [
      ["commander.fell", { name: "Vasse", round: 1, back: 3 }],
      ["commander.out", { name: "Vasse", round: 2, back: 3 }],
      ["commander.restored", { name: "Vasse", round: 3 }],
    ],
  )
  assert.deepEqual(
    story.map(([event]) => event).filter((event) => String(event).startsWith("pulse.")),
    ["pulse.start", "pulse.end", "pulse.start", "pulse.end"],
  )
})
