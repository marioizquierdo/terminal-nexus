// The rally point (the challenge runs, step 11G; made simpler after the owner played it, 2026-11-25 and 2026-11-26):
// Start Battle Round sends the cursor to the rally point at once, with no panel and no stance; the bottom line says the
// two actions, "[arrows] Set Rally Point. [enter] Start battle.", and nothing is written on the map; four arrows round
// it and three flashes call the eye there, and again a second after it was last moved, every five seconds, the keys on
// the bottom line flashing after them; Enter places it and starts the Battle Round; Esc, `x` and Backspace give the
// Build Phase back as it was. And the Battle Round sends the troops there, and they hold it.

// Measurements held here (written before the change):
//   - the call (F336, the movement keys' arrows pointing outward, lit after the banner): Start's focus arrow flies for
//     the "Focus arrow" milliseconds (250), then 3 flashes, each the banner lit for the Battle Round flash's beat
//     (220 ms), the four arrows lit for as long half a beat (110 ms) behind it, then 90 ms dark: a flash every
//     110 + 220 + 90 = 420 ms, over at 250 + 3 x 420 - 90 = 1420 ms after Start; the arrows never light before the
//     banner in a flash, and stay lit after it goes dark; each arrow stands on the side its key moves the rally
//     point to, pointing that way (`^` above, `v` below, `<` left, `>` right; `▲ ▼ ◀ ▶` in Unicode), bold;
//   - the reminder: 1000 ms after the call ends or the rally point last moved, 3 flashes of banner and arrows, then 3 of the
//     bottom line's keys (blank on the 2 off beats between them); again every 5000 ms while it stands unmoved; never
//     while it keeps moving;
//   - reduced motion: no flight, the four arrows standing, nothing flashing, no frame asked for.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import type { BuildContext } from "../src/build/state.ts"
import { bannerLines, bannerOrder, bannerSpot, currentBanner, defaultBanner, structureTilesAt } from "../src/build/banner.ts"
import type { BuildCommand } from "../src/build/types.ts"
import type { Coord } from "../src/engine/geometry/types.ts"
import { starterContext } from "../src/cli/starter.ts"
import { startPulse } from "../src/cli/starter.ts"
import { withRallyTarget } from "../src/match/index.ts"
import { playRound } from "../src/battle/index.ts"
import { battleOf } from "../src/skirmish/save.ts"
import type { SaveFile } from "../src/skirmish/save.ts"
import type { MatchState } from "../src/engine/state/types.ts"
import starterSave from "../saves/starter.save.json" with { type: "json" }
import type { RallyOrder } from "../src/match/index.ts"
import { bottomLineText, buildSide, clickPanelRow, clickTile, compose, keys, screenText } from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"
import { popupSpec } from "../src/build/popup.ts"
import { startRow } from "../src/build/layout.ts"
import { cellForTile } from "../src/build/layout.ts"
import { visibleRange } from "../src/build/camera.ts"
import { frameToText, cellAt } from "../src/view/frame.ts"
import { BannerClock } from "../src/view/build-live.ts"
import type { RallyCall, RallyCallTiming } from "../src/view/banner-marks.ts"
import { CALL_FLASHES, REMIND_AFTER_MS, REMIND_EVERY_MS, callArrows, callEndMs, flashGroupMs, keysGroupMs, rallyCallAt, rallyCallTiming } from "../src/view/banner-marks.ts"
import { RALLY_POINT_LINE, bottomLine, rallyPointLine } from "../src/build/help.ts"
import { chromeGlyph } from "../src/view/theme.ts"
import { TUNING } from "../src/build/tuning.ts"
import { defaultExperiments } from "../src/build/experiments.ts"

const ENTER = "\r"
const RIGHT = "\u001b[C"
const UP = "\u001b[A"
const ESC = "\u001b"

/** The starter map's first round, as the game opens it; `experiments` sets some. */
function bannerSide(experiments: BuildContext["experiments"] = {}, context: Partial<BuildContext> = {}): BuildSide {
  const opened: BuildContext = { ...starterContext(), ...context, experiments: { ...experiments } }
  return buildSide({ context: opened, cursor: STARTER_START_CURSOR, startPulse })
}

/** The first rock tile of the map, in reading order. */
function rock(context: BuildContext): Coord {
  const index = context.terrain.tiles.findIndex((tile) => tile === "terrain.rock")
  return { x: index % context.terrain.width, y: Math.floor(index / context.terrain.width) }
}

test("Start Battle Round makes the cursor the rally point at once: no panel, no stance, the menu kept, the bottom line saying it all", () => {
  const side = bannerSide()
  keys(side, "s")
  const { state } = side.build
  assert.equal(state.popup, "banner-place")
  assert.equal(popupSpec(side.build.round, state), null, "a panel opened")
  const banner = currentBanner(side.build.round, state)
  assert.equal(banner.isDefault, true)
  assert.equal(banner.name, "ground in front of your base")
  assert.deepEqual(state.cursor, banner.tile, "the cursor did not go to the rally point")
  const text = screenText(side)
  assert.match(text, /\[s\] Start Battle Round/, "the menu is not kept")
  for (const gone of ["Change Target", "Stance", "Aggressive", "Defensive"]) assert.ok(!text.includes(gone), gone)
  // No words on the map; the bottom line says the two actions and names no place (the owner, 2026-11-26).
  assert.equal(bottomLineText(side), "[arrows] Set Rally Point. [enter] Start battle.")
  const above = text.split("\n").slice(0, side.layout.footerRow).join("\n")
  assert.doesNotMatch(above, /rally point|\[enter\]/i, "words are drawn on the map")
})

test("Enter places it and starts the Battle Round, holding it by default", () => {
  const side = bannerSide()
  keys(side, "s", RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, UP, UP)
  const tile = side.build.state.cursor
  keys(side, ENTER)
  const { state } = side.build
  assert.equal(state.committed, true, "the round did not start")
  assert.equal(state.popup, null)
  assert.deepEqual(state.banner, { tile, stance: "defensive" })
})

test("the troops hold the rally point placed, always", () => {
  const side = bannerSide()
  keys(side, "s", RIGHT, RIGHT, RIGHT, ENTER)
  assert.equal(side.build.state.banner?.stance, "defensive")
})

test("Esc, x, Backspace and a right click go back with nothing changed: the cursor, the camera and the keyboard as they were", () => {
  for (const back of [ESC, "x", "\u007f", "right-click"]) {
    const side = bannerSide()
    const before = side.build.state
    keys(side, "s", RIGHT, RIGHT)
    assert.notDeepEqual(side.build.state.cursor, before.cursor)
    if (back === "right-click") side.build.dispatch({ kind: "back" })
    else keys(side, back)
    const after = side.build.state
    assert.equal(after.popup, null, JSON.stringify(back))
    assert.equal(after.committed, false)
    assert.equal(after.banner, null, "a rally point was placed")
    assert.deepEqual(after.planned, before.planned)
    assert.deepEqual(after.cursor, before.cursor)
    assert.deepEqual(after.camera, before.camera)
    assert.equal(after.focus, before.focus)
  }
})

test("the rally point cannot go where troops cannot: rock is refused on the bottom line, and nothing starts", () => {
  const side = bannerSide()
  const at = rock(side.build.round)
  const refusal = bannerSpot(side.build.round, side.build.state, at).refusal
  assert.ok(refusal !== null)
  keys(side, "s")
  side.build.dispatch({ kind: "click-tile", x: at.x, y: at.y })
  // Looking at it, the bottom line says why, as a warning; trying it says it again, in red.
  assert.equal(refusal, "Rock: no troops can stand there.")
  assert.equal(bottomLineText(side), "Rock: no troops can stand there.")
  assert.equal(bottomLine(side.build.round, side.build.state, null).tone, "warning")
  side.build.dispatch({ kind: "click-tile", x: at.x, y: at.y })
  assert.equal(side.build.state.popup, "banner-place", "placed on rock")
  assert.equal(side.build.state.committed, false)
  assert.equal(side.build.state.status.tone, "danger")
  assert.equal(side.build.state.status.text, "Rock: no troops can stand there.")
})

test("keys, clicks, the menu's Start row and a driver place the same rally point and start the round", () => {
  const byKeys = bannerSide()
  keys(byKeys, "s", RIGHT, RIGHT, RIGHT, ENTER)
  const tile = byKeys.build.state.banner?.tile as Coord
  assert.ok(tile !== undefined)

  const byClicks = bannerSide()
  keys(byClicks, "s")
  clickTile(byClicks, tile)
  clickTile(byClicks, tile)

  const byStartRow = bannerSide()
  keys(byStartRow, "s")
  clickTile(byStartRow, tile)
  clickPanelRow(byStartRow, startRow(byStartRow.layout))

  const bySecondS = bannerSide()
  keys(bySecondS, "s", RIGHT, RIGHT, RIGHT, "s")

  const byDriver = bannerSide()
  const script: BuildCommand[] = [{ kind: "open-battle-round" }, { kind: "click-tile", ...tile }, { kind: "banner-place" }]
  byDriver.build.run(script)

  for (const side of [byClicks, byStartRow, bySecondS, byDriver]) {
    assert.equal(side.build.state.committed, true)
    assert.deepEqual(side.build.state.banner, byKeys.build.state.banner)
  }
})

test("placing it back on the round's own default, whatever the stance, makes no order: the round plays as it always did", () => {
  const fallback = defaultBanner(starterContext())
  const side = bannerSide({}, { placedBanner: { tile: { x: fallback.tile.x - 3, y: fallback.tile.y }, stance: "aggressive" } })
  keys(side, "s")
  assert.deepEqual(side.build.state.cursor, { x: fallback.tile.x - 3, y: fallback.tile.y }, "Start did not go to where it stood last")
  side.build.run([{ kind: "click-tile", ...fallback.tile }, { kind: "banner-place" }])
  assert.equal(side.build.state.committed, true)
  assert.equal(side.build.state.banner, null)
  assert.equal(bannerOrder(side.build.round, side.build.state), null)
})

test("one march line, from the Nexus: none from the Commander, none onward", () => {
  const side = bannerSide()
  keys(side, "s", RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, UP, UP)
  const lines = bannerLines(side.build.round, side.build.state, side.build.state.cursor)
  assert.ok(lines.fromNexus.length > 1)
  assert.deepEqual(Object.keys(lines), ["fromNexus"])
})

// The second playtest (2026-11-25): the line went round the player's own buildings; the owner: "Like the line just needs
// to go skip buildings ... just obstacles". It walks round rock only, and whether a spot is reachable reads the same.
test("the march line goes round rock only: buildings planned across its way change neither the line nor the reach", () => {
  const side = bannerSide()
  keys(side, "s", RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, UP, UP)
  const { round, state } = side.build
  const tile = state.cursor
  const before = bannerLines(round, state, tile).fromNexus
  assert.ok(before.length > 4, "no line to plan across")
  // A Barracks on every few tiles of the line's middle, each where the line runs.
  const barracks = round.catalog.find((item) => item.label === "Barracks")
  assert.ok(barracks !== undefined)
  const planned = before.slice(2, -2).filter((_, index) => index % 3 === 0).map((anchor, ordinal) => ({ ordinal, contentId: barracks.contentId, anchor }))
  const walled = { ...state, planned }
  for (const each of planned) assert.ok(structureTilesAt(round, walled, each.anchor) !== null, `no building on ${each.anchor.x},${each.anchor.y}`)
  assert.deepEqual(bannerLines(round, walled, tile).fromNexus, before, "the line went round a building")
  assert.equal(bannerSpot(round, walled, tile).refusal, null)
  // Rock still turns it: no line onto rock, and none through it.
  assert.ok(bannerSpot(round, state, rock(round)).refusal !== null)
})

test("a rally point on a building is seen: the building lit, its glyphs kept, and the bottom line naming it", () => {
  const side = bannerSide()
  keys(side, "s")
  const nexus = side.build.round.standing.find((structure) => side.build.round.registry.get(structure.contentId).nexus === true)
  assert.ok(nexus !== undefined)
  side.build.dispatch({ kind: "click-tile", ...nexus.anchor })
  const tiles = structureTilesAt(side.build.round, side.build.state, nexus.anchor)
  assert.ok(tiles !== null && tiles.length > 1)
  const name = bannerSpot(side.build.round, side.build.state, nexus.anchor).name
  assert.equal(name, "your Nexus")
  const frame = compose(side, {}, "truecolor")
  assert.equal(bottomLineText(side), RALLY_POINT_LINE, "the line names the place")
  // The same frame with the rally point elsewhere: the building's glyphs are the same, and now unlit.
  const away = compose(side, { state: { ...side.build.state, popup: null } }, "truecolor")
  const range = visibleRange(side.build.state.camera, side.build.state.viewport)
  for (const tile of tiles) {
    if (tile.x < range.firstX || tile.x > range.lastX || tile.y < range.firstY || tile.y > range.lastY) continue
    const cell = cellForTile(side.layout, side.build.state.camera, tile)
    assert.equal(cellAt(frame, cell.x, cell.y).glyph, cellAt(away, cell.x, cell.y).glyph, "the rally point replaced a glyph")
    assert.equal(cellAt(frame, cell.x, cell.y).style.inverse, true, `tile ${tile.x},${tile.y} is not lit`)
  }
})

// --- The call and the reminder (F326, F330) -------------------------------------------------------------

/** The call's timing as the game plays it: the tuned flight, the Battle Round flash Experiment's beat. */
const TIMING: RallyCallTiming = rallyCallTiming(TUNING.focusArrowMs, defaultExperiments().popupFlashMs, false)

/** How many times `on` turns true over `[from, to)`, a millisecond at a time — a count of flashes. */
function flashes(from: number, to: number, on: (ms: number) => boolean): number {
  let count = 0
  let was = false
  for (let ms = from; ms < to; ms += 1) {
    const now = on(ms)
    if (now && !was) count += 1
    was = now
  }
  return count
}

/** The call never moved: the rally point standing where Start put it. */
const still = (ms: number): RallyCall => rallyCallAt(TIMING, ms, ms)

test("the call: Start's focus arrow flies to the rally point, then three flashes, the banner lit first and the arrows after it", () => {
  assert.equal(TIMING.flightMs, 250)
  assert.equal(TIMING.lagMs, 110)
  assert.equal(callEndMs(TIMING), 1420, "the call is not 250 ms of flight and three flashes of 110 + 220 + 90 ms, less the last gap")
  // The flight: progress from 0 to 1, nothing else.
  assert.deepEqual(still(0), { flight: 0, arrows: false, lit: null, keysBlank: false, keysLit: false, groupEndsMs: null })
  assert.equal(still(125).flight, 0.5)
  // Three flashes of each.
  assert.equal(flashes(0, callEndMs(TIMING), (ms) => still(ms).arrows), CALL_FLASHES)
  assert.equal(flashes(0, callEndMs(TIMING), (ms) => still(ms).lit === true), CALL_FLASHES)
  // Outward: in every flash the banner lights before the arrows, and the arrows stay after it goes dark.
  let bannerOnAt = -1
  for (let ms = TIMING.flightMs; ms < callEndMs(TIMING); ms += 1) {
    const now = still(ms)
    const before = still(ms - 1)
    if (now.lit === true && before.lit !== true) bannerOnAt = ms
    if (now.arrows && !before.arrows) assert.equal(ms - bannerOnAt, TIMING.lagMs, `${ms} ms: the arrows did not light half a beat after the banner`)
    if (now.arrows) assert.ok(bannerOnAt >= 0, `${ms} ms: the arrows lit before the banner`)
  }
  // The second count: the beats are where the flash's numbers put them.
  assert.deepEqual([still(250).lit, still(250).arrows], [true, false], "the banner alone first")
  assert.deepEqual([still(250 + 110).lit, still(250 + 110).arrows], [true, true], "then both")
  assert.deepEqual([still(250 + 220).lit, still(250 + 220).arrows], [false, true], "then the arrows alone")
  assert.deepEqual([still(250 + 330).lit, still(250 + 330).arrows], [false, false], "then dark")
  assert.deepEqual([still(250 + 420).lit, still(250 + 420).arrows], [true, false], "the second flash")
  // Then still, and nothing on the bottom line.
  for (let ms = callEndMs(TIMING); ms < callEndMs(TIMING) + REMIND_AFTER_MS; ms += 10) assert.deepEqual(still(ms), still(callEndMs(TIMING)), `${ms} ms`)
  assert.equal(still(callEndMs(TIMING)).arrows, false)
})

test("the reminder: a second unmoved, the arrows flash three times, then the bottom line's keys three times; again every five seconds", () => {
  assert.equal(REMIND_AFTER_MS, 1000)
  assert.equal(REMIND_EVERY_MS, 5000)
  const group = flashGroupMs(TIMING)
  assert.equal(group, 1170)
  const keysGroup = keysGroupMs(TIMING)
  assert.equal(keysGroup, 840, "the keys flash at the plain beat: 220 on, 90 off")
  const first = callEndMs(TIMING) + REMIND_AFTER_MS
  for (const start of [first, first + REMIND_EVERY_MS, first + 2 * REMIND_EVERY_MS]) {
    assert.equal(flashes(start - 200, start + group, (ms) => still(ms).arrows), CALL_FLASHES, `${start} ms: the arrows`)
    assert.equal(flashes(start, start + group, (ms) => still(ms).keysLit || still(ms).keysBlank), 0, `${start} ms: the keys flashed with the arrows`)
    assert.equal(flashes(start + group, start + group + keysGroup, (ms) => still(ms).keysLit), CALL_FLASHES, `${start} ms: the keys`)
    // Blank on the two off beats between the three flashes.
    assert.equal(flashes(start + group, start + group + keysGroup, (ms) => still(ms).keysBlank), CALL_FLASHES - 1, `${start} ms: the blanks`)
    assert.equal(flashes(start + group, start + group + keysGroup, (ms) => still(ms).arrows), 0, `${start} ms: the arrows with the keys`)
    // Then nothing until the next.
    for (let ms: number = start + group + keysGroup; ms < start + REMIND_EVERY_MS; ms += 25) assert.deepEqual(still(ms), still(start + group + keysGroup), `${ms} ms`)
  }
  // Moved at 1.5 s, before the first reminder: it waits a second from the move.
  const moved = (ms: number): RallyCall => rallyCallAt(TIMING, ms, ms < 1500 ? ms : ms - 1500)
  assert.equal(moved(first + 10).arrows, false, "the reminder came though it had just moved")
  assert.equal(moved(2510).lit, true, "no reminder a second after the move")
  assert.equal(moved(2510 + TIMING.lagMs).arrows, true, "no arrows in the reminder")
  // Moving every half second, never.
  const busy = (ms: number): RallyCall => rallyCallAt(TIMING, ms, ms < callEndMs(TIMING) ? ms : ms % 500)
  assert.equal(flashes(callEndMs(TIMING), 20_000, (ms) => busy(ms).arrows || busy(ms).keysLit), 0, "a reminder while it moved")
})

test("reduced motion: no flight, the four arrows standing still, nothing flashing, and no frame asked for", () => {
  const timing = rallyCallTiming(TUNING.focusArrowMs, defaultExperiments().popupFlashMs, true)
  for (const ms of [0, 100, 1000, 2500, 7000]) assert.deepEqual(rallyCallAt(timing, ms, ms), { flight: null, arrows: true, lit: null, keysBlank: false, keysLit: false, groupEndsMs: null })
  const side = bannerSide()
  keys(side, "s")
  const clock = new BannerClock()
  const at = clock.at(side.build.state, 1000, true)
  assert.equal(at.until, null)
  assert.equal(at.pulseMs, undefined)
})

test("the rally point's clock: from the frame it became the cursor, a move restarting the wait, the frame timer to each group's end", () => {
  const side = bannerSide()
  keys(side, "s")
  const clock = new BannerClock()
  assert.equal(clock.at(side.build.state, 1000, false).until, 1000 + TIMING.flightMs, "the flight is not drawn every frame")
  assert.equal(clock.at(side.build.state, 1300, false).until, 1000 + callEndMs(TIMING))
  assert.equal(clock.at(side.build.state, 1000 + callEndMs(TIMING) + 500, false).until, null)
  assert.equal(clock.at(side.build.state, 1000 + callEndMs(TIMING) + REMIND_AFTER_MS + 10, false).call?.lit, true, "no reminder")
  keys(side, RIGHT)
  const after = 1000 + callEndMs(TIMING) + REMIND_AFTER_MS + 100
  assert.equal(clock.at(side.build.state, after, false).call?.arrows, false, "a move did not restart the wait")
  assert.equal(clock.at(side.build.state, after + REMIND_AFTER_MS + 10, false).call?.lit, true)
  // Gone with the rally point: Esc, and the clock starts over next time.
  keys(side, ESC)
  assert.deepEqual(clock.at(side.build.state, after + 5000, false), { until: null })
})

test("drawn: the movement keys' four arrows round it, pointing outward, bold, under anything standing; the keys blanked on the reminder's off beats", () => {
  const side = bannerSide()
  keys(side, "s")
  const tile = side.build.state.cursor
  const on: RallyCall = { flight: null, arrows: true, lit: true, keysBlank: false, keysLit: false, groupEndsMs: null }
  const frame = compose(side, { banner: { pulseMs: 400, call: on } }, "truecolor")
  const around = callArrows([tile])
  // Each on the side its key moves the rally point to, pointing that way: left of it `<`, right `>`, above `^`, below `v`.
  assert.deepEqual(around.map((arrow) => [arrow.tile.x - tile.x, arrow.tile.y - tile.y, chromeGlyph("ascii", arrow.part)]), [[-1, 0, "<"], [1, 0, ">"], [0, -1, "^"], [0, 1, "v"]])
  for (const arrow of around) {
    const cell = cellForTile(side.layout, side.build.state.camera, arrow.tile)
    const drawn = cellAt(frame, cell.x, cell.y)
    assert.equal(drawn.glyph, chromeGlyph("ascii", arrow.part))
    assert.equal(drawn.style.fade, undefined, "the arrows are faded")
    assert.equal(drawn.style.bold, true, "the arrows are not bold")
  }
  // In Unicode, the arrow keys' own solid triangles, never the thin arrows.
  assert.deepEqual(callArrows([tile]).map((arrow) => chromeGlyph("unicode", arrow.part)), ["◀", "▶", "▲", "▼"])
  // Monochrome reads them by weight: bold there too.
  const mono = compose(side, { banner: { pulseMs: 400, call: on } }, "monochrome")
  for (const arrow of around) {
    const cell = cellForTile(side.layout, side.build.state.camera, arrow.tile)
    assert.equal(cellAt(mono, cell.x, cell.y).style.bold, true, "monochrome: the arrows are not bold")
  }
  // Off beat: no arrows.
  const off = compose(side, { banner: { pulseMs: 400, call: { ...on, arrows: false, lit: false } } }, "truecolor")
  for (const arrow of around) {
    const cell = cellForTile(side.layout, side.build.state.camera, arrow.tile)
    assert.notEqual(cellAt(off, cell.x, cell.y).glyph, chromeGlyph("ascii", arrow.part))
  }
  // A still frame (no clock) shows them, so a picture says where the rally point is.
  assert.match(frameToText(compose(side)), /<!>/)
  // The keys: blank between the brackets on the off beats, inverse on the beats.
  const footer = (call: RallyCall): string => frameToText(compose(side, { banner: { pulseMs: 400, call } })).split("\n")[side.layout.footerRow] ?? ""
  assert.match(footer({ ...on, keysBlank: true }), /\[ {6}\] Set Rally Point\. \[enter\] Start battle\./)
  assert.match(footer(on), /\[arrows\] Set Rally Point\./)
  const lit = compose(side, { banner: { pulseMs: 400, call: { ...on, keysLit: true } } }, "truecolor")
  assert.equal(cellAt(lit, side.layout.offset.column + 3, side.layout.footerRow).style.inverse, true)
  // The keys in the hotkey look, the words in the line's own.
  const plain = compose(side, {}, "truecolor")
  assert.equal(cellAt(plain, side.layout.offset.column + 3, side.layout.footerRow).style.fgRole, "chrome.hotkey")
  assert.notEqual(cellAt(plain, side.layout.offset.column + 12, side.layout.footerRow).style.fgRole, "chrome.hotkey")
})

test("the flight is drawn: Start's focus arrow crosses from the menu to the rally point", () => {
  const side = bannerSide()
  keys(side, "s")
  const flying = compose(side, { handoffFlight: { progress: 0.5 } }, "truecolor")
  const resting = compose(side, {}, "truecolor")
  assert.ok(flying.cells.some((cell, index) => cell.style.fgRole === "chrome.hotkey" && resting.cells[index]?.style.fgRole !== "chrome.hotkey"), "no focus arrow")
})

test("the rally point's bottom line is its two actions, or why not, and fits the 80-column floor", () => {
  assert.equal(RALLY_POINT_LINE, "[arrows] Set Rally Point. [enter] Start battle.")
  assert.ok(RALLY_POINT_LINE.length <= 76)
  assert.equal(rallyPointLine({ refusal: null }), RALLY_POINT_LINE)
  assert.equal(rallyPointLine({ refusal: "Unreachable: no way there from your Nexus." }), "Unreachable: no way there from your Nexus.")
  // The flag is the map's: Unicode symbols draw it as the map does.
  assert.equal(chromeGlyph("unicode", "banner"), "⚑")
})

// --- The match: the banner drives the battle ----------------------------------------------------------

/** The starter map's first Battle Round, nothing built, side A's rally point the 3 x 3 round `tile` or the default:
 *  every state of it, and the last. */
function starterPulse(tile?: Readonly<{ x: number; y: number }>) {
  const states: MatchState[] = []
  playRound(battleOf(starterSave as unknown as SaveFile), { A: { build: [], ...(tile === undefined ? {} : { rally: tile }) }, B: { build: [] } }, (state) => {
    states.push(state)
  })
  return { states, final: states[states.length - 1] as MatchState }
}

const NORTH_EAST: RallyOrder = { side: "A", area: { x: 29, y: 6, width: 3, height: 3 }, name: "ground near the wall" }

test("a rally point is the side's target for the whole round, in place of the default: nothing releases it", () => {
  const without = starterPulse()
  const held = starterPulse({ x: 30, y: 7 })
  assert.deepEqual(held.states[0]?.targets?.A, NORTH_EAST.area)
  assert.deepEqual(held.final.targets?.A, NORTH_EAST.area)
  assert.ok(held.states.every((state) => state.targets?.A !== undefined && state.targets.A.x === NORTH_EAST.area.x && state.targets.A.y === NORTH_EAST.area.y), "the rally point was let go mid-round")
  assert.notDeepEqual(without.states[0]?.targets?.A, NORTH_EAST.area)
  // Twice the same: deterministic.
  assert.deepEqual(starterPulse({ x: 30, y: 7 }).final, held.final)
})

test("no banner leaves the targets as they were set", () => {
  const targets = { A: { x: 1, y: 2, width: 3, height: 4 } }
  assert.equal(withRallyTarget(targets, undefined), targets)
  assert.deepEqual(withRallyTarget(targets, NORTH_EAST), { A: NORTH_EAST.area })
})
