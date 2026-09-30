// Cards and the card reveal (docs/ui-patterns.md, "Cards" and "Motion and transitions"). While something
// has the map's attention a card replaces the menu: Explore Map's describes what is under the cursor, a
// building's the building being placed. Its header is the row that opened it, drawn active on the
// panel's first line over a separator; its hotkey, Esc, `x` and a click on the panel go back; it carries
// no credits line. It appears with the card reveal — the other rows fade, the chosen row slides up to the
// header line, the card fades and types in — which the live loop times (`BuildAnimation`, driven here
// with a clock the test holds) and the view draws at an instant (`composeBuildFrame`); from one card
// straight to another only its last beat plays. No row or length is hardcoded: each is read from the
// layout or the Experiment's default.

import { test } from "node:test"
import assert from "node:assert/strict"
import { defaultExperiments } from "../src/build/experiments.ts"
import { hint } from "../src/build/help.ts"
import { CARD_FIRST_ROW, CARD_HEADER_ROW, CARD_SEPARATOR_ROW, EXPLORE_ROW, NEXUS_ROW, menuEntryRow, startRow } from "../src/build/layout.ts"
import { MOUSE_LEFT, buildMouseCommand, formatMouseEvent, parseMouseEvent } from "../src/build/mouse.ts"
import { cardEntry, cardShowing, entryOfConstruct, remaining } from "../src/build/state.ts"
import { TUNING } from "../src/build/tuning.ts"
import type { CardReveal, RowAck } from "../src/view/build.ts"
import { CARD_BEATS } from "../src/view/build.ts"
import { BuildAnimation, livePresentation } from "../src/view/build-live.ts"
import { cellAt } from "../src/view/frame.ts"
import { placementLook, placementSchedule } from "../src/view/placement.ts"
import { CAPABILITY_MODES } from "../src/view/roles.ts"
import { chromeGlyph, terrainGlyph } from "../src/view/theme.ts"
import {
  DOWN,
  ENTER,
  ESC,
  MINIMUM,
  ROOMY,
  SPACE,
  TAB,
  buildSide,
  clickCell,
  clickPanelRow,
  clickTile,
  compose,
  keys,
  panelCells,
  panelLine,
  panelLines,
  panelRow,
  screenText,
} from "./build-helpers.ts"
import type { Side } from "./build-helpers.ts"

/** The card reveal `progress` of the way through its default length, from the menu or another card. */
function reveal(progress: number, fromMenu = true): CardReveal {
  const lengthMs = defaultExperiments().cardRevealMs
  return { elapsedMs: progress * lengthMs, lengthMs, fromMenu }
}

/** The ways a card opens, and the header each is headed by. */
const OPENINGS: readonly (readonly [string, readonly string[], RegExp])[] = [
  ["a building by its digit", ["1"], /^\[1\] Barracks +>$/],
  ["a building from its row", [DOWN, DOWN, DOWN, ENTER], /^\[2\] Hatchery +>$/],
  ["Explore Map", ["e"], /^\[e\] Explore Map +>$/],
]

// --- The card ----------------------------------------------------------------------------------------

test("a card's header is the row that opened it, drawn active on the panel's first line, over the glyph pack's own separator", () => {
  assert.equal(CARD_HEADER_ROW, 0, "the header is not the panel's first line")
  for (const pack of ["ascii", "unicode"] as const) {
    for (const [name, open, header] of OPENINGS) {
      const side = buildSide()
      keys(side, ...open)
      const lines = panelLines(side, compose(side, { glyphPack: pack }))
      assert.match(lines[CARD_HEADER_ROW] as string, header, `${name}, ${pack}`)
      assert.equal(lines[CARD_SEPARATOR_ROW], chromeGlyph(pack, "horizontal").repeat(side.layout.panelLimit), `${name}, ${pack}`)
      assert.notEqual((lines[CARD_FIRST_ROW] as string).trim(), "", `${name}: nothing under the separator`)
    }
  }
})

test("no credits on a card — a building's or Explore Map's, in either glyph pack, with or without a plan", () => {
  for (const pack of ["ascii", "unicode"] as const) {
    const symbol = terrainGlyph("terrain.deposit", pack).glyph
    for (const open of [...OPENINGS.map(([, keys]) => keys), [TAB, "1", ENTER, "e"], [TAB, "1", ENTER, "3"]]) {
      const side = buildSide()
      keys(side, ...open)
      assert.ok(cardShowing(side.build.state), `${JSON.stringify(open)}: no card`)
      const credits = `${symbol} ${remaining(side.context, side.build.state)}`
      const lines = panelLines(side, compose(side, { glyphPack: pack }))
      assert.ok(!lines.some((line) => line.includes(credits)), `${JSON.stringify(open)}: the credits are on the card`)
    }
  }
})

test("a building's card: its glyphs, its name and where it stands, what it does, its numbers with the cost first — and nothing of the menu", () => {
  for (const terminal of [MINIMUM, ROOMY]) {
    const side = buildSide({ terminal })
    keys(side, DOWN, DOWN, ENTER) // the Barracks, from the menu
    const lines = panelLines(side, compose(side))
    const card = lines.slice(CARD_FIRST_ROW).join("\n")
    assert.match(lines[CARD_FIRST_ROW] as string, /^\[b\] +Barracks/)
    assert.match(lines[CARD_FIRST_ROW + 1] as string, /^\|_\| +to build/)
    assert.match(card, /Trains troopers each Pulse/)
    assert.match(card, /^COST +40$/m)
    assert.match(card, /^HEALTH +120$/m)
    assert.match(card, /^SIZE +3x2$/m)
    // Cost first, as the owner listed them (feedback F58: "cost, health, size, attack").
    assert.ok(card.indexOf("COST") < card.indexOf("HEALTH"))
    // The card is the whole panel: no menu row, no Start Pulse, no help text.
    assert.doesNotMatch(card, /\[\d\]|\[n\]|Start Pulse|\[e\]/)
    assert.equal(panelLine(side, compose(side), startRow(side.layout)).trim(), "")
    assert.doesNotMatch(card, /undo|remove|bksp/)
  }
})

test("a turret's card shows its attack", () => {
  const side = buildSide()
  keys(side, "3")
  assert.equal(side.build.state.armed, 2)
  const card = panelLines(side, compose(side)).join("\n")
  assert.match(card, /\[3\] Turret +>/)
  assert.match(card, /^ATTACK +\d+ at range \d+$/m)
  assert.doesNotMatch(card, /Barracks/)
})

test("Explore Map's card says what is under the cursor as it moves: open ground, the Grid Nexus and its numbers, a planned building and its cost", () => {
  const side = buildSide()
  keys(side, "e")
  assert.match(screenText(side), /Open ground/)
  side.build.run([{ kind: "move-cursor", dx: 0, dy: -2 }]) // onto the Grid Nexus
  const nexus = screenText(side)
  assert.match(nexus, /Citizen Nexus/)
  assert.match(nexus, /HEALTH {2,}400/)
  assert.match(nexus, /SIZE {2,}3x2/)

  const planned = buildSide()
  keys(planned, "1")
  planned.build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }, { kind: "focus", target: "grid" }, { kind: "open-explore" }])
  const text = screenText(planned)
  assert.match(text, /Barracks/)
  assert.match(text, /planned/)
  assert.match(text, /COST {2,}40/)
  assert.match(text, /Trains troopers each Pulse/)
  planned.build.run([{ kind: "move-cursor", dx: 0, dy: 4 }])
  assert.match(screenText(planned), /Open ground/)
})

test("Explore Map's header key, Esc, x and a click on its header go back to where it was opened from", () => {
  for (const close of [["e"], [ESC], ["x"], ["click"]]) {
    const closeIt = (side: Side): void => {
      if (close[0] === "click") clickPanelRow(side, panelRow(side, CARD_HEADER_ROW))
      else keys(side, ...close)
    }
    // Opened from the menu: back to the menu.
    const fromMenu = buildSide()
    keys(fromMenu, "e")
    closeIt(fromMenu)
    assert.equal(fromMenu.build.state.exploreMap, false, `${close[0]} did not close Explore Map`)
    assert.equal(fromMenu.build.state.focus, "menu")
    // Opened on the map, in plain navigation: back to plain navigation.
    const fromMap = buildSide()
    keys(fromMap, TAB, "e")
    assert.equal(fromMap.build.state.returnTo, "grid")
    closeIt(fromMap)
    assert.equal(fromMap.build.state.exploreMap, false)
    assert.equal(fromMap.build.state.focus, "grid", `${close[0]} from the map left the map`)
    assert.equal(hint(fromMap.context, fromMap.build.state).text, "Arrows move the cursor, [enter] explores here, a number arms a building.")
  }
  // Enter or Space with Explore Map already open does nothing more.
  const side = buildSide()
  keys(side, TAB, ENTER)
  assert.equal(side.build.state.exploreMap, true)
  keys(side, SPACE)
  assert.equal(side.build.state.exploreMap, true)
})

test("a click anywhere on the panel while a card shows goes back to where it began and chooses nothing; a click on the map moves Explore Map's card", () => {
  for (const [name, begin, back] of [
    ["armed from the menu", [DOWN, DOWN, ENTER], "menu"],
    ["armed on the map", [TAB, "1"], "grid"],
    ["Explore Map from the menu", ["e"], "menu"],
  ] as const) {
    const { layout } = buildSide()
    // The header, the card's first line, where Start Pulse and the Nexus rows would be on the menu.
    for (const row of [panelRow({ layout }, CARD_HEADER_ROW), panelRow({ layout }, CARD_FIRST_ROW), startRow(layout), panelRow({ layout }, NEXUS_ROW)]) {
      const side = buildSide()
      keys(side, ...begin)
      assert.equal(cardShowing(side.build.state), true, `${name}: no card`)
      clickCell(side, layout.panelColumn + 4, row)
      assert.equal(cardShowing(side.build.state), false, `${name}: a click on row ${row} did not close the card`)
      assert.equal(side.build.state.focus, back, `${name}: went back to the wrong place`)
      assert.equal(side.build.state.armed, null, `${name}: a click on row ${row} armed something`)
      assert.equal(side.build.state.popup, null, `${name}: a click on row ${row} opened a popup`)
      assert.equal(side.build.state.planned.length, 0)
    }
  }
  // The mouse adapter sends it as a click on the card's own row, whatever row it lands on.
  const armed = buildSide()
  keys(armed, "1")
  const click = parseMouseEvent(formatMouseEvent(MOUSE_LEFT, armed.layout.panelColumn + 3, panelRow(armed, CARD_FIRST_ROW) + 3))
  assert.ok(click !== null)
  const command = buildMouseCommand(click, armed.build.state.camera, armed.layout, armed.context.catalog, { card: cardEntry(armed.build.state) })
  assert.deepEqual(command, { kind: "click-menu", entry: entryOfConstruct(0) })
  // In Explore Map a click on the map moves the card there.
  const side = buildSide()
  keys(side, "e")
  clickTile(side, { x: 18, y: 11 }) // the Grid Nexus
  assert.equal(side.build.state.exploreMap, true)
  assert.match(screenText(side), /Citizen Nexus/)
})

test("a card speaks for itself: arming and opening Explore Map say nothing on the bottom line, and going back leaves nothing behind", () => {
  const side = buildSide()
  keys(side, "1")
  assert.equal(side.build.state.status.text, "")
  keys(side, ESC)
  assert.equal(side.build.state.status.text, "Cancelled.")
  keys(side, "e")
  assert.equal(side.build.state.status.text, "", "Explore Map still says something")
  keys(side, "e")
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.status.text, "", "Explore Map's answer outlived it")
})

test("in a still frame a pressed flash plays on the card's header: the bar, over the same words", () => {
  const side = buildSide()
  keys(side, "2")
  assert.deepEqual(side.build.state.ack, { seq: 1, kind: "pressed", entry: entryOfConstruct(1) })
  const flash: RowAck = { kind: "pressed", entry: entryOfConstruct(1) }
  const header = panelRow(side, CARD_HEADER_ROW)
  assert.equal(cellAt(compose(side, { ack: flash }), side.layout.dividerColumn - 1, header).style.inverse, true, "the flash did not play on the card's header")
  assert.equal(panelLine(side, compose(side, { ack: flash }), header), panelLine(side, compose(side), header))
})

// --- The card reveal: the drawing ----------------------------------------------------------------------

/** The Turret armed from the menu — its row the furthest from the header. */
function turret(): Side {
  const side = buildSide()
  keys(side, "3")
  return side
}

test("beat 1: the chosen row, active, stays where it is on the menu while every other row fades", () => {
  const side = turret()
  const home = menuEntryRow(side.layout, side.context.catalog, { kind: "construct", index: 2 }) as number
  const progress = CARD_BEATS.fade * 0.4
  for (const capability of CAPABILITY_MODES) {
    const frame = compose(side, { cardReveal: reveal(progress) }, capability)
    assert.match(panelLine(side, frame, home), /^\[3\] Turret +>$/)
    assert.match(panelLine(side, frame, panelRow(side, EXPLORE_ROW)), /^\[e\] Explore Map/, "the other rows are already gone")
    assert.match(panelLine(side, frame, startRow(side.layout)), /^\[s\] Start Pulse/)
    assert.doesNotMatch(panelLines(side, frame).join("\n"), /-{10}/, "the card's separator is already drawn")
    const other = cellAt(frame, side.layout.panelColumn + 1, panelRow(side, EXPLORE_ROW)).style
    const chosen = cellAt(frame, side.layout.panelColumn + 1, home).style
    assert.equal(chosen.fade, undefined, "the chosen row fades")
    if (capability === "truecolor" || capability === "color256") assert.ok((other.fade ?? 0) > 0, `${capability}: the other rows do not fade`)
  }
  // Where colour cannot blend, the fading rows are dim for the half nearer gone.
  const late = compose(side, { cardReveal: reveal(CARD_BEATS.fade * 0.8) }, "color16")
  assert.equal(cellAt(late, side.layout.panelColumn + 1, panelRow(side, EXPLORE_ROW)).style.dim, true)
})

test("beat 2: the chosen row alone slides up a whole row at a time to the header line", () => {
  const side = turret()
  const home = menuEntryRow(side.layout, side.context.catalog, { kind: "construct", index: 2 }) as number
  const header = panelRow(side, CARD_HEADER_ROW)
  const rows: number[] = []
  for (let step = 0; step < 10; step += 1) {
    const progress = CARD_BEATS.fade + (CARD_BEATS.slide * step) / 10
    const lines = panelLines(side, compose(side, { cardReveal: reveal(progress) }))
    const drawn = lines.map((line, index) => [line, index] as const).filter(([line]) => line.trim() !== "")
    assert.equal(drawn.length, 1, `at ${progress} the panel shows ${drawn.length} lines`)
    assert.match(drawn[0]?.[0] as string, /^\[3\] Turret +>$/)
    rows.push(panelRow(side, drawn[0]?.[1] as number))
  }
  assert.equal(rows[0], home, "the slide does not start from the row's place")
  for (let index = 1; index < rows.length; index += 1) assert.ok((rows[index] as number) <= (rows[index - 1] as number), "the row went back down")
  assert.ok(rows.some((row) => row < home && row > header), "no row between its place and the header")
})

test("beat 3: the header in place, the card fading in, its words typed, the icon going up", () => {
  const side = buildSide()
  keys(side, "1") // the Barracks, whose placement frames are authored
  const still = compose(side, {}, "truecolor")
  const start = CARD_BEATS.fade + CARD_BEATS.slide
  const early = compose(side, { cardReveal: reveal(start + 0.02) }, "truecolor")
  const lines = panelLines(side, early)
  assert.match(lines[CARD_HEADER_ROW] as string, /^\[1\] Barracks +>$/)
  // The separator is there, fading in.
  assert.equal(lines[CARD_SEPARATOR_ROW], "-".repeat(side.layout.panelLimit))
  assert.ok((cellAt(early, side.layout.panelColumn, panelRow(side, CARD_SEPARATOR_ROW)).style.fade ?? 0) > 0.5)
  // The name is typed from its first letter: none or a few of its letters so far.
  const name = (lines[CARD_FIRST_ROW] as string).slice(5).trim()
  assert.ok("Barracks".startsWith(name) && name.length < "Barracks".length, `the name reads "${name}"`)
  // The icon plays the Barracks' own placement frames — the very ones a building going up plays.
  const framesMs = defaultExperiments().cardRevealMs * CARD_BEATS.card
  const schedule = placementSchedule(
    { ordinal: 0, contentId: "structure.citizen.barracks", anchor: { x: 0, y: 0 } },
    side.context.registry.get("structure.citizen.barracks").footprint,
    false,
    { ...TUNING, placeFramesMs: framesMs, placeGlowMs: 0 },
  )
  const elapsed = (0.02 / CARD_BEATS.card) * framesMs
  for (let y = 0; y < 2; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      const look = placementLook(schedule, "structure.citizen.barracks", { x, y }, elapsed)
      assert.equal(cellAt(early, side.layout.panelColumn + x, panelRow(side, CARD_FIRST_ROW) + y).glyph, look.glyph ?? " ", `icon ${x},${y}`)
    }
  }
  const icon = (frame: typeof still): string => panelLines(side, frame).slice(CARD_FIRST_ROW, CARD_FIRST_ROW + 2).join("|")
  assert.notEqual(icon(early), icon(still), "the icon is already finished")
  // Halfway through the beat: more typed, the numbers fading in.
  const half = panelLines(side, compose(side, { cardReveal: reveal(start + CARD_BEATS.card / 2) }, "truecolor"))
  const typed = (text: readonly string[]): number => text.join("\n").replace(/\s+/gu, "").length
  assert.ok(typed(half) > typed(lines), "nothing more was typed halfway")
  // At its end and after it, the finished card exactly as a still frame draws it.
  assert.deepEqual(compose(side, { cardReveal: reveal(1) }, "truecolor"), still)
})

test("Explore Map's card reveals the same way, its row already on the header line", () => {
  const side = buildSide()
  keys(side, "e")
  const slide = CARD_BEATS.fade + CARD_BEATS.slide / 2
  const lines = panelLines(side, compose(side, { cardReveal: reveal(slide) }))
  assert.match(lines[CARD_HEADER_ROW] as string, /^\[e\] Explore Map +>$/)
  assert.equal(lines.filter((line) => line.trim() !== "").length, 1)
})

test("the row a reveal from the menu carries up is drawn active all the way, never with the pressed bar", () => {
  const side = buildSide()
  keys(side, "n", "1") // a Nexus power picked: the highlight stays on the Nexus row
  const animation = new BuildAnimation()
  animation.frame(side.build.state, 0)
  keys(side, DOWN, DOWN, ENTER) // the Hatchery, armed from the menu: its row is pressed, and the card reveals
  const home = menuEntryRow(side.layout, side.context.catalog, { kind: "construct", index: 1 }) as number
  const rows = new Set<number>()
  // Every instant the pressed flash is still lit — through the fade, the slide and into the card's beat.
  for (let elapsed = 0; elapsed < Math.min(TUNING.pressedFlashMs, defaultExperiments().cardRevealMs); elapsed += 5) {
    const live = animation.frame(side.build.state, 1000 + elapsed)
    assert.equal(live.ack?.kind, "pressed", `${elapsed} ms: the pressed flash is over`)
    assert.ok(live.cardReveal !== undefined, `${elapsed} ms: the reveal is over`)
    for (const capability of CAPABILITY_MODES) {
      const frame = compose(side, livePresentation(live), capability)
      const row = panelLines(side, frame).findIndex((line) => /^\[2\] Hatchery +>$/.test(line))
      assert.ok(row >= 0, `${elapsed} ms, ${capability}: the Hatchery's row is not drawn active`)
      const y = panelRow(side, row)
      rows.add(y)
      for (const cell of panelCells(side, frame, y).filter((drawn) => drawn.glyph !== " ")) {
        assert.equal(cell.style.inverse, undefined, `${elapsed} ms, ${capability}: the pressed bar is drawn`)
        assert.equal(cell.style.underline, undefined, `${elapsed} ms, ${capability}: the pressed underline is drawn`)
        assert.equal(cell.style.fgRole, "chrome.hotkey")
        assert.equal(cell.style.bold, true)
      }
    }
  }
  assert.ok(rows.has(home) && rows.has(panelRow(side, CARD_HEADER_ROW)), "the row did not travel from its place to the header")
})

// --- The card reveal: the live loop --------------------------------------------------------------------

test("the live loop plays the reveal from the frame the panel becomes a card, keeps the timer running, and stops at its end; closing is instant, and opening again plays it again", () => {
  const length = defaultExperiments().cardRevealMs
  const side = buildSide()
  const animation = new BuildAnimation()
  assert.equal(animation.frame(side.build.state, 0).cardReveal, undefined, "a reveal on the first frame")
  keys(side, "1")
  const first = animation.frame(side.build.state, 1000)
  assert.deepEqual(first.cardReveal, reveal(0))
  assert.ok((first.busyUntil ?? 0) >= 1000 + length)
  assert.deepEqual(animation.frame(side.build.state, 1000 + length / 2).cardReveal, reveal(0.5))
  assert.deepEqual(livePresentation(animation.frame(side.build.state, 1000 + length / 2)).cardReveal, reveal(0.5))
  assert.equal(animation.frame(side.build.state, 1000 + length).cardReveal, undefined)
  keys(side, ESC)
  assert.equal(animation.frame(side.build.state, 2000).cardReveal, undefined)
  keys(side, "e")
  assert.deepEqual(animation.frame(side.build.state, 3000).cardReveal, reveal(0))
})

test("from one card straight to another only the card's own beat plays, and the same card never replays", () => {
  const length = defaultExperiments().cardRevealMs
  const side = buildSide()
  const animation = new BuildAnimation()
  animation.frame(side.build.state, 0)
  keys(side, "e")
  assert.deepEqual(animation.frame(side.build.state, 1000).cardReveal, reveal(0))
  keys(side, "2") // from Explore Map's card straight to the Hatchery's
  assert.equal(side.build.state.armed, 1)
  assert.deepEqual(animation.frame(side.build.state, 2000).cardReveal, reveal(0, false))
  assert.equal(animation.frame(side.build.state, 2000 + length + 1).cardReveal, undefined)
  // Drawn: the header already in place and the separator there from the first instant, and no menu
  // between the two cards; at its end, exactly the still frame.
  const lines = panelLines(side, compose(side, { cardReveal: reveal(0.05, false) }))
  assert.match(lines[CARD_HEADER_ROW] as string, /^\[2\] Hatchery +>$/)
  assert.equal(lines[CARD_SEPARATOR_ROW], "-".repeat(side.layout.panelLimit))
  assert.doesNotMatch(lines.join("\n"), /\[e\] Explore Map|\[3\] Turret/, "the menu came back between two cards")
  assert.deepEqual(compose(side, { cardReveal: reveal(1, false) }, "truecolor"), compose(side, {}, "truecolor"))
  // The same card, frame after frame — the ghost moving, a popup over it and gone: nothing replays.
  side.build.dispatch({ kind: "move-cursor", dx: 1, dy: 0 })
  assert.equal(animation.frame(side.build.state, 3000).cardReveal, undefined)
  keys(side, "n")
  assert.equal(animation.frame(side.build.state, 3100).cardReveal, undefined)
  keys(side, ESC)
  assert.equal(side.build.state.armed, 1)
  assert.equal(animation.frame(side.build.state, 3200).cardReveal, undefined)
})

test("no reveal under reduced motion, or with the Experiment off", () => {
  const reduced = buildSide()
  const animation = new BuildAnimation()
  animation.frame(reduced.build.state, 0, { reducedMotion: true })
  keys(reduced, "1")
  assert.equal(animation.frame(reduced.build.state, 1000, { reducedMotion: true }).cardReveal, undefined)

  const off = buildSide()
  for (let step = 0; step < 10 && off.build.state.experiments.cardRevealMs > 0; step += 1) {
    off.build.dispatch({ kind: "experiment-adjust", field: "cardRevealMs", step: -1 })
  }
  assert.equal(off.build.state.experiments.cardRevealMs, 0, "the card reveal does not go off")
  const quiet = new BuildAnimation()
  quiet.frame(off.build.state, 0)
  keys(off, "1")
  assert.equal(quiet.frame(off.build.state, 1000).cardReveal, undefined)
})

test("the reveal and the hand-off start together: neither waits for the other", () => {
  const side = buildSide()
  const animation = new BuildAnimation()
  animation.frame(side.build.state, 0)
  keys(side, DOWN, DOWN, ENTER) // the Barracks, from the menu
  const frame = animation.frame(side.build.state, 1000)
  assert.deepEqual(frame.cardReveal, reveal(0))
  assert.deepEqual(frame.handoffFlight, { progress: 0 })
  // A digit on the map arms without a hand-off, and the card still reveals.
  const map = buildSide()
  const loop = new BuildAnimation()
  loop.frame(map.build.state, 0)
  keys(map, TAB, "2")
  const armed = loop.frame(map.build.state, 1000)
  assert.equal(armed.handoffFlight, undefined)
  assert.deepEqual(armed.cardReveal, reveal(0))
})
