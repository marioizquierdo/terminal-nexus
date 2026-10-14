// The Commander highlighted by her moments (step 8D): she appears at the Nexus with a ring and a line of her own, a
// vignette opens beside where she falls, a dim glyph keeps her place while she is out, Explore Map on her shows her
// portrait and lights a ring round her, the Nexus Pulse that restores her says so, and the Activity Logs record her
// life. The owner, 2026-10-14: "the commander is just another unit ... So I suggest highlighting the commander in
// different ways."

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
import { cellForTile } from "../src/build/layout.ts"
import { starterContext } from "../src/cli/starter.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { ACTIVITY_FILTERS, filteredEntries } from "../src/log/activity.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import type { BuildPlaytest } from "../src/playtest/build.ts"
import { BuildAnimation } from "../src/view/build-live.ts"
import {
  APPEAR,
  appearanceLine,
  appearanceRing,
  appearing,
  commanderArt,
  commanderHidden,
  vignetteFace,
  vignetteGlyphs,
  vignetteLengthMs,
  vignettePlace,
} from "../src/view/commander-moments.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"
import { lineLength } from "../src/view/pulse-voice.ts"
import { buildSide, compose, keys, panelLines } from "./build-helpers.ts"

const VASSE = "unit.citizen.vasse"

/** What loading the game's armies with Vasse's entry changed reports. */
function problemsWith(change: object): readonly string[] {
  const commanders = vasse.commanders.map((commander) => ({ ...commander, ...change }))
  try {
    loadArmies([all, { ...vasse, commanders }], { registry: FIXTURE_REGISTRY, maps: MAPS })
    return []
  } catch (error) {
    assert.ok(error instanceof ArmyError, String(error))
    return error.problems
  }
}

/** The cadence level, from its first round, as a player who builds nothing, with the keys given. */
function cadence(keys: string): BuildPlaytest {
  return runBuildPlaytest({ steps: parseKeyScript(keys), at: { kind: "level", level: levelById("vasse-test-2") as PlayableLevel, round: 1 } })
}

/** Two rounds of the cadence level played through, nothing built and no power picked: the Battle Round's result
 *  stands at the end of each, and Enter goes on; round 2 opens on the Nexus Pulse restoring her, which Esc closes. */
const TWO_ROUNDS = "s s wait~1000*24 Enter Esc s s wait~1000*24 Enter"

/** Her tile as PERIMETER's first round opens: she arrives beside the Nexus with the squads. */
function herTile(context: BuildContext) {
  const her = (context.incoming ?? []).find((entity) => entity.contentId === VASSE)
  assert.ok(her !== undefined, "she does not arrive in PERIMETER's first round")
  return her.anchor
}

test("a Commander's portrait is three rows of plain ASCII, and the frames of her fall are shaped like it, or refused by name", () => {
  assert.deepEqual(problemsWith({}), [])
  assert.match(problemsWith({ portrait: ["(-_-)", "/|@|\\"] }).join("\n"), /portrait has 2 rows; it takes 3/)
  assert.match(problemsWith({ portrait: [" _@_", "(-_-)", "/|@|\\"] }).join("\n"), /row 2 is 5 glyphs wide and row 1 is 4/)
  assert.match(problemsWith({ portrait: ["(--_--)", "(--_--)", "(--_--)"] }).join("\n"), /row 1 is 7 glyphs wide; a row is 1 to 5/)
  assert.match(problemsWith({ portraitFalls: [["(x_x)", "(x_x)"]] }).join("\n"), /fall frame 1 is not shaped like her portrait/)
  // Her art builds on her glyph: her `@` is in her portrait.
  const art = commanderArt(VASSE)
  assert.ok(art !== null)
  assert.ok(art.portrait.some((row) => row.includes("@")), "her portrait does not build on her @")
})

test("as a level begins she appears beside the Nexus a moment after the round opens: a ring closes on her, then her line", () => {
  const context = starterContext()
  const now = appearing(context)
  assert.deepEqual(now, { contentId: VASSE, at: herTile(context), moment: "appears" })
  // PERIMETER's first round opens on her own words in the dialog, which say it for her.
  assert.equal(appearanceLine(context), null)
  const quiet = { ...context, scene: [] }
  assert.ok((commanderArt(VASSE)?.lines.appears ?? []).includes(appearanceLine(quiet) as string), "her line is not one of her own")
  // Not on the map for the first moment, then there.
  assert.equal(commanderHidden(context, 0, false), true)
  assert.equal(commanderHidden(context, APPEAR.delayMs, false), false)
  assert.equal(commanderHidden(context, 0, true), false, "under reduced motion she is there from the start")
  assert.equal(commanderHidden(context, undefined, false), false, "a still frame shows her")
  const side = buildSide({ context: quiet })
  const at = cellForTile(side.layout, side.build.state.camera, herTile(context))
  assert.notEqual(cellAt(compose(side, { roundElapsed: { elapsedMs: 100 } }), at.x, at.y).glyph, "@")
  assert.equal(cellAt(compose(side), at.x, at.y).glyph, "@")
  // The ring closes: wide, then tight round her; she flashes in, inverse, as she lands.
  const wide = appearanceRing(herTile(context), 0, false)
  const tight = appearanceRing(herTile(context), APPEAR.ringMs, false)
  assert.ok(wide.length > 0 && tight.length > 0)
  assert.ok(Math.max(...wide.map((cell) => Math.abs(cell.tile.y - herTile(context).y))) > 1)
  assert.ok(tight.every((cell) => Math.abs(cell.tile.y - herTile(context).y) <= 1))
  const landed = compose(side, { roundElapsed: { elapsedMs: APPEAR.delayMs + APPEAR.ringMs + 10 } })
  assert.equal(cellAt(landed, at.x, at.y).style.inverse, true)
  // Her line, typed in beside her.
  const typed = APPEAR.delayMs + APPEAR.ringMs + APPEAR.flashMs + APPEAR.lineAfterMs + lineLength(appearanceLine(quiet) as string).typeMs + 100
  const speaking = frameToText(compose(side, { roundElapsed: { elapsedMs: typed } }))
  assert.ok(speaking.includes(`"${appearanceLine(quiet) as string}"`), speaking)
})

test("the round the Nexus Pulse restores her, she appears with a line of her own for it", () => {
  const context: BuildContext = {
    ...starterContext(),
    round: { number: 2, of: 3 },
    incoming: [],
    scene: [],
    field: [{ contentId: VASSE, anchor: { x: 20, y: 9 }, player: "A", hp: 80 }],
    restored: [{ player: "A", contentId: VASSE }],
  }
  assert.equal(appearing(context)?.moment, "restored")
  assert.ok((commanderArt(VASSE)?.lines.restored ?? []).includes(appearanceLine(context) as string))
  // A round she was standing in already: no appearance.
  assert.equal(appearing({ ...context, restored: [] }), null)
})

test("the live loop hands the round's clock to the view only while her appearance runs", () => {
  const animation = new BuildAnimation()
  const state = buildSide().build.state
  const first = animation.frame(state, 1000, { appearsForMs: 3000 })
  assert.deepEqual(first.roundElapsed, { elapsedMs: 0 })
  assert.ok(first.busyUntil !== null && first.busyUntil >= 4000)
  assert.deepEqual(animation.frame(state, 2500, { appearsForMs: 3000 }).roundElapsed, { elapsedMs: 1500 })
  assert.equal(animation.frame(state, 4500, { appearsForMs: 3000 }).roundElapsed, undefined)
  assert.equal(new BuildAnimation().frame(state, 1000, {}).roundElapsed, undefined)
})

test("when she falls a vignette opens beside her: her portrait, her face falling, then the window evaporating", () => {
  const art = commanderArt(VASSE)
  assert.ok(art !== null && art.falls.length > 0)
  assert.deepEqual(vignetteFace(art, 0, false), { rows: art.portrait, evaporated: 0 })
  assert.deepEqual(vignetteFace(art, 10_000, false).rows, art.falls.at(-1))
  assert.equal(vignetteFace(art, vignetteLengthMs(art.falls.length) - 1, false).evaporated > 0.9, true)
  // Under reduced motion: her last face, still, never evaporating.
  assert.deepEqual(vignetteFace(art, 0, true), { rows: art.falls.at(-1), evaporated: 0 })
  // A window of 9 by 5, her name in its top border.
  const glyphs = vignetteGlyphs(art, art.portrait, "ascii")
  assert.deepEqual(glyphs, ["+-VASSE-+", "|  _@_  |", "| (-_-) |", "| /|@|\\ |", "+-------+"])
  // Placed beside her, never over her, where it covers least.
  const range = { firstX: 0, lastX: 48, firstY: 0, lastY: 17 }
  const place = vignettePlace({ x: 20, y: 9 }, { width: 9, height: 5 }, range, () => false)
  assert.deepEqual(place, { x: 22, y: 4 })
  const crowded = vignettePlace({ x: 20, y: 9 }, { width: 9, height: 5 }, range, (tile) => tile.y < 9 && tile.x > 20)
  assert.deepEqual(crowded, { x: 10, y: 4 })
})

test("played: her vignette opens over the battle as she falls and is gone after, her dim glyph left beside the Nexus", () => {
  const run = cadence("s s wait~1000*5 wait~400*10 wait~1000*4")
  const texts = run.frames.map((frame) => frameToText(frame.frame))
  const open = texts.findIndex((textOf) => textOf.includes("+-VASSE-+"))
  assert.ok(open > 0, "no vignette opened as she fell")
  assert.ok(texts.slice(open).some((textOf) => textOf.includes("(x_x)")), "her face never fell")
  assert.ok(!(texts.at(-1) as string).includes("VASSE-+"), "the vignette stayed open")
  // Her own glyph, dim, beside the Nexus, from the moment she fell.
  const last = run.frames.at(-1)?.frame
  assert.ok(last !== undefined)
  assert.ok(last.cells.some((cell) => cell.glyph === "@" && cell.style.dim === true), "no dim @ keeps her place")
})

test("Explore Map on her shows her portrait on her card, every number kept at 80 x 24, and a ring of light round her", () => {
  const context = starterContext()
  const side = buildSide({ context, cursor: herTile(context) })
  keys(side, "e")
  const frame = compose(side, {}, "truecolor")
  const lines = panelLines(side, frame)
  assert.match(lines[2] ?? "", /^ _@_ +Vasse/)
  assert.match(lines[3] ?? "", /^\(-_-\)/)
  for (const label of ["HEALTH", "ATTACK", "RANGE"]) assert.ok(lines.some((line) => line.startsWith(label)), `${label} is cut from her card`)
  const beside = cellForTile(side.layout, side.build.state.camera, { x: herTile(context).x + 1, y: herTile(context).y })
  assert.equal(cellAt(frame, beside.x, beside.y).style.seeThrough?.role, "fx.flash", "no ring of light round her")
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
      ["commander.fell", { name: "Vasse", round: 1, back: 2 }],
      ["commander.restored", { name: "Vasse", round: 2 }],
    ],
  )
  assert.deepEqual(
    story.map(([event]) => event).filter((event) => String(event).startsWith("pulse.")),
    ["pulse.start", "pulse.end", "pulse.start", "pulse.end"],
  )
})
