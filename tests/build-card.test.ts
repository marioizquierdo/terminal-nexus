// Cards and the card reveal (docs/system-design/ui-patterns.md, "Cards" and "Motion and transitions"). While something
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
import { setting } from "../src/build/all-settings.ts"
import { defaultExperiments } from "../src/build/experiments.ts"
import { hint } from "../src/build/help.ts"
import { currentCard, wavesStat } from "../src/build/card.ts"
import { STARTER_CATALOG, STARTER_STANDING } from "../src/build/catalog.ts"
import { starterContext } from "../src/cli/starter.ts"
import { CARD_FIRST_ROW, CARD_HEADER_ROW, CARD_SEPARATOR_ROW, EXPLORE_ROW, NEXUS_ROW, menuEntryRow, menuFloor, startRow } from "../src/build/layout.ts"
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
  MAXIMUM,
  MINIMUM,
  OPEN_GROUND,
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
  const lengthMs = TUNING.cardRevealMs
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

test("a building's card: its glyphs, its title and subtitle, its description, its numbers with the cost first — and nothing of the menu", () => {
  for (const terminal of [MINIMUM, ROOMY]) {
    const side = buildSide({ terminal })
    keys(side, DOWN, DOWN, ENTER) // the Barracks, from the menu
    const lines = panelLines(side, compose(side))
    const card = lines.slice(CARD_FIRST_ROW).join("\n")
    assert.match(lines[CARD_FIRST_ROW] as string, /^\[b\] +Barracks/)
    // The subtitle sits where "to build" was (owner: "use that subtitle space for the subtitle").
    assert.match(lines[CARD_FIRST_ROW + 1] as string, /^\|_\| +Trains troopers +$/)
    assert.match(card, /Trains a wave of troopers,/)
    assert.match(card, /^COST +40$/m)
    assert.match(card, /^HEALTH +120$/m)
    assert.match(card, /^SIZE +3x2$/m)
    // Cost first, as the owner listed them ("cost, health, size, attack").
    assert.ok(card.indexOf("COST") < card.indexOf("HEALTH"))
    // The card is the whole panel: no menu row, no Start Battle Round, no help text.
    assert.doesNotMatch(card, /\[\d\]|\[n\]|Start Battle Round|\[e\]/)
    assert.equal(panelLine(side, compose(side), startRow(side.layout)).trim(), "")
    assert.doesNotMatch(card, /undo|remove|bksp/)
  }
})

test("a building's card says the wave it spawns — how many of what, and when — from its army's own numbers", () => {
  const side = buildSide()
  keys(side, DOWN, DOWN, ENTER) // the Barracks, from the menu
  assert.match(panelLines(side, compose(side)).join("\n"), /^WAVE +4 troopers at 5s$/m)
  // The Hatchery's brood, the same way.
  const hatchery = buildSide()
  keys(hatchery, "2")
  assert.match(panelLines(hatchery, compose(hatchery)).join("\n"), /^WAVE +3 swarmers at 5s$/m)
  // Nothing else makes units: the Turret's card has no such line.
  const turret = buildSide()
  keys(turret, "3")
  assert.doesNotMatch(panelLines(turret, compose(turret)).join("\n"), /WAVE/)

  // A building with several waves (a Nexus power's to give, one day) says when each comes.
  const barracks = STARTER_CATALOG.find((item) => item.contentId === "structure.citizen.barracks")
  assert.ok(barracks?.spawns !== undefined)
  const three = { ...side.context, catalog: [{ ...barracks, spawns: { ...barracks.spawns, waves: 3 } }] }
  assert.deepEqual(wavesStat(three, barracks.contentId, side.build.state), { label: "WAVES", value: "4 at 5s, 15s, 25s" })
  assert.ok("WAVES 4 at 5s, 15s, 25s".length <= side.layout.panelLimit, "three waves do not fit the narrowest card")
})

// --- A range ----------------------------------------------------------------------------------------

test("a turret's card shows its attack: how hard it hits, then its range as one number, the range across", () => {
  const side = buildSide()
  keys(side, "3")
  assert.equal(side.build.state.armed, 2)
  const card = panelLines(side, compose(side)).join("\n")
  assert.match(card, /\[3\] Turret +>/)
  const attack = side.context.registry.get("structure.bench.beamturret").attack
  assert.ok(attack !== undefined && attack.range > 1)
  assert.match(card, new RegExp(`^ATTACK +${attack.damage}\\nRANGE +${attack.range}$`, "m"))
  // A row counts two columns, so a range of 6 also reaches 3 rows up and down; the map draws that, the card does
  // not say it.
  assert.doesNotMatch(card, /across|up\/down|touching/, "the card still says a range's shape")
  assert.doesNotMatch(card, /Barracks/)
})

test("a unit that fights hand to hand says melee for its range; one that shoots says its range as one number", () => {
  for (const [contentId, melee] of [
    ["unit.citizen.trooper", true],
    ["unit.ravel.raider", true],
    ["unit.citizen.marksman", false],
    ["unit.citizen.vasse", false],
  ] as const) {
    const side = buildSide()
    exploreIncoming(side, contentId)
    const attack = side.context.registry.get(contentId).attack
    assert.ok(attack !== undefined)
    assert.equal(attack.kind === "melee", melee, `${contentId}: a ${attack.kind} attack`)
    const card = panelLines(side, compose(side)).join("\n")
    const range = melee ? "melee" : String(attack.range)
    assert.match(card, new RegExp(`^ATTACK +${attack.damage}\\nRANGE +${range}$`, "m"), contentId)
  }
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
  planned.build.run([{ kind: "move-cursor", dx: 8, dy: 0 }, { kind: "place" }, { kind: "focus", target: "grid" }, { kind: "open-explore" }])
  const text = screenText(planned)
  assert.match(text, /Barracks/)
  assert.match(text, /COST {2,}40/)
  assert.match(text, /Trains troopers/)
  planned.build.run([{ kind: "move-cursor", dx: 0, dy: 4 }])
  assert.match(screenText(planned), /Open ground/)
})

test("a building's build range is one number: now for one standing, for next round for one being placed or planned, none for one cut off", () => {
  // Only what stands gives build range; a building planned this round gives its own once it stands. The number is
  // the "Build range" Experiment's value, said as any range is, whatever the value is.
  const range = (side: Side) => currentCard(side.context, side.build.state)?.stats.find((stat) => stat.label === "BUILD RANGE")
  const side = buildSide()
  const radius = setting(side.build.state, "buildRange")
  keys(side, "3")
  assert.deepEqual(range(side), { label: "BUILD RANGE", value: `${radius} (next round)` }, "the card of a building being placed")
  assert.match(panelLines(side, compose(side)).join("\n"), new RegExp(`^BUILD RANGE +${radius} \\(next round\\)$`, "m"), "the words do not fit the panel")
  keys(side, ENTER, "e")
  moveTo(side, OPEN_GROUND)
  assert.equal(currentCard(side.context, side.build.state)?.title, "Turret")
  assert.deepEqual(range(side), { label: "BUILD RANGE", value: `${radius} (next round)` }, "the card of a planned building")
  moveTo(side, { x: 26, y: 10 })
  assert.deepEqual(range(side), { label: "BUILD RANGE", value: String(radius) }, "the card of the standing Barracks")
  assert.match(panelLines(side, compose(side)).join("\n"), new RegExp(`^BUILD RANGE +${radius}$`, "m"), "the standing Barracks's build range is not on its row")
  // A Barracks standing beyond the reach of every building linked to the Nexus is cut off, and gives none, at
  // every build range offered.
  const far = { x: 34, y: 18 }
  const apart = buildSide({
    context: starterContext(undefined, { standing: [...STARTER_STANDING, { contentId: "structure.citizen.barracks", anchor: far }] }),
  })
  keys(apart, "e")
  moveTo(apart, far)
  const cutOff = (): void =>
    assert.deepEqual(range(apart), { label: "BUILD RANGE", value: "cut off" }, `at a build range of ${setting(apart.build.state, "buildRange")}`)
  cutOff()
  for (const step of [1, -1, -1] as const) {
    apart.build.dispatch({ kind: "experiment-adjust", field: "buildRange", step })
    cutOff()
  }
})

/** Move the map cursor onto `tile`, wherever it is now. */
function moveTo(side: Side, tile: Readonly<{ x: number; y: number }>): void {
  const { cursor } = side.build.state
  side.build.run([{ kind: "move-cursor", dx: tile.x - cursor.x, dy: tile.y - cursor.y }])
  assert.deepEqual(side.build.state.cursor, tile, "the cursor did not reach the tile")
}

/** Explore Map over the first unit of `contentId` the round brings — PERIMETER's squads, Vasse, the raid — found
 *  where the round sets it down rather than at a pinned tile. */
function exploreIncoming(side: Side, contentId: string): void {
  const unit = (side.context.incoming ?? []).find((entity) => entity.contentId === contentId)
  assert.ok(unit !== undefined, `the round brings no ${contentId}`)
  keys(side, "e")
  moveTo(side, unit.anchor)
  assert.deepEqual(currentCard(side.context, side.build.state)?.icon, { kind: "entity", contentId, player: unit.player }, `the cursor is not on the ${contentId}`)
}

/** Every card the Build Phase can show: each building being placed, and Explore Map over open ground,
 *  rock, a deposit, the Grid Nexus, a standing building and a planned one, and the units the round brings —
 *  Vasse's the tallest card of all, her skill above her numbers. */
const EVERY_CARD: readonly (readonly [string, (side: Side) => void])[] = [
  ...STARTER_CATALOG.map((item) => [`placing the ${item.label}`, (side: Side) => keys(side, item.hotkey)] as const),
  ...(
    [
      ["open ground", { x: 21, y: 13 }],
      ["rock", { x: 8, y: 10 }],
      ["a deposit", { x: 14, y: 12 }],
      ["the Grid Nexus", { x: 18, y: 10 }],
      ["the standing Barracks", { x: 26, y: 10 }],
    ] as const
  ).map(([name, tile]) => [`exploring ${name}`, (side: Side) => {
    keys(side, "e")
    moveTo(side, tile)
  }] as const),
  ["exploring a planned Turret", (side: Side) => {
    keys(side, "3", ENTER, "e")
    moveTo(side, OPEN_GROUND)
  }],
  ...["unit.citizen.vasse", "unit.citizen.trooper", "unit.citizen.marksman", "unit.ravel.raider", "unit.ravel.runner"].map(
    (contentId) => [`exploring the incoming ${contentId}`, (side: Side) => exploreIncoming(side, contentId)] as const,
  ),
]

test("every card is a title, a subtitle, a description and its numbers — and says nothing about planned, standing or to build", () => {
  // The owner: "no need to show the 'planned' or 'to build' state. That is obvious from the rest of
  // the UI ... So the cards have title, subtitle, description, stats."
  const kinds = new Set<string>()
  for (const [name, open] of EVERY_CARD) {
    const side = buildSide()
    open(side)
    const card = currentCard(side.context, side.build.state)
    assert.ok(card !== null, `${name}: no card`)
    kinds.add(card.icon.kind === "terrain" ? card.icon.terrainId : card.icon.contentId)
    assert.ok(card.title !== "" && card.subtitle !== "" && card.description !== "", `${name}: a part of the card is missing`)
    assert.ok(card.stats.length > 0, `${name}: no numbers`)
    const text = panelLines(side, compose(side)).slice(CARD_FIRST_ROW).join("\n")
    assert.doesNotMatch(text, /\b(planned|standing|to build)\b/i, `${name}: the card still says where the building stands`)
  }
  // Every kind of thing Explore Map can land on in the Build Phase has a card of its own.
  for (const kind of ["terrain.plain", "terrain.rock", "terrain.deposit", "structure.citizen.nexus", ...STARTER_CATALOG.map((item) => item.contentId)]) {
    assert.ok(kinds.has(kind), `no card was drawn for ${kind}`)
  }
})

test("every card fits the panel whole — its subtitle on one line beside the icon, its description never cut, every number above the floor — at 80x24 and 104x32, in ASCII and Unicode", () => {
  for (const terminal of [MINIMUM, MAXIMUM]) {
    for (const pack of ["ascii", "unicode"] as const) {
      for (const [name, open] of EVERY_CARD) {
        const where = `${name}, ${terminal.columns}x${terminal.rows}, ${pack}`
        const side = buildSide({ terminal })
        open(side)
        const card = currentCard(side.context, side.build.state)
        assert.ok(card !== null, `${where}: no card`)
        const lines = panelLines(side, compose(side, { glyphPack: pack }))
        const top = side.layout.panelRow
        assert.equal(lines[CARD_FIRST_ROW + 1]?.trim().endsWith(card.subtitle), true, `${where}: the subtitle is not on one line under the title`)
        // The description, read back off the panel, is all there, word for word.
        const body = lines.slice(CARD_FIRST_ROW + 2).map((line) => line.trim()).filter((line) => line !== "")
        assert.ok(body.join(" ").startsWith(card.description), `${where}: the description is cut`)
        // Every number, its label and its value on one row.
        for (const stat of card.stats) {
          assert.ok(
            body.some((line) => line.startsWith(stat.label) && line.endsWith(stat.value)),
            `${where}: ${stat.label} is missing`,
          )
        }
        // Nothing runs past the last row the card may use, into the Start Battle Round row or the bottom bar.
        for (let row = menuFloor(side.layout) + 1; row <= side.layout.panelLastRow; row += 1) {
          assert.equal(lines[row - top]?.trim(), "", `${where}: the card runs into row ${row}`)
        }
      }
    }
  }
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
    assert.equal(hint(fromMap.context, fromMap.build.state).text, "Arrows move the cursor, [enter] explores here, a number selects a building.")
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
    // The header, the card's first line, where Start Battle Round and the Nexus rows would be on the menu.
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
    assert.match(panelLine(side, frame, startRow(side.layout)), /^\[s\] Start Battle Round/)
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
  const framesMs = TUNING.cardRevealMs * CARD_BEATS.card
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
  let pressed = 0
  // Every instant of the reveal — the fade, the slide, the card's beat — with the pressed flash lit
  // for the first of them.
  for (let elapsed = 0; elapsed < TUNING.cardRevealMs; elapsed += 5) {
    const live = animation.frame(side.build.state, 1000 + elapsed)
    assert.ok(live.cardReveal !== undefined, `${elapsed} ms: the reveal is over`)
    if (live.ack?.kind === "pressed") pressed += 1
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
  assert.ok(pressed > 0, "the pressed flash never lit during the reveal: the test proves nothing")
  assert.ok(rows.has(home) && rows.has(panelRow(side, CARD_HEADER_ROW)), "the row did not travel from its place to the header")
})

// --- The card reveal: the live loop --------------------------------------------------------------------

test("the live loop plays the reveal from the frame the panel becomes a card, keeps the timer running, and stops at its end; closing is instant, and opening again plays it again", () => {
  const length = TUNING.cardRevealMs
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
  const length = TUNING.cardRevealMs
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

test("no reveal under reduced motion, or with a length of 0", () => {
  const reduced = buildSide()
  const animation = new BuildAnimation()
  animation.frame(reduced.build.state, 0, { reducedMotion: true })
  keys(reduced, "1")
  assert.equal(animation.frame(reduced.build.state, 1000, { reducedMotion: true }).cardReveal, undefined)

  const off = buildSide()
  const quiet = new BuildAnimation({ ...TUNING, cardRevealMs: 0 })
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
