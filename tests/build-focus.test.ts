// Focus and modes (docs/system-design/ui-patterns.md, "The screen and the keyboard"): the menu on the left of the map,
// one place with the keyboard — the menu's highlight bar or the map cursor — the map's three modes
// (placing, Explore Map, plain navigation), clicks that activate what they land on, where arming puts
// the cursor, and finishing going back to where it began. Driven through raw bytes into the real
// adapters where an adapter is what is being claimed, and through commands where the reducer is.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_CATALOG, STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { tilesOf } from "../src/grid/coords.ts"
import type { GridTerrain, TerrainId } from "../src/grid/types.ts"
import { hint } from "../src/build/help.ts"
import { EXPLORE_ROW, NEXUS_ROW, cellForTile, menuEntryRow } from "../src/build/layout.ts"
import type { BuildContext } from "../src/build/state.ts"
import { EXPLORE_ENTRY, NEXUS_ENTRY, anchorForCursor, armingSpot, entryOfConstruct, legalityAt, menuEntries, nexusTile } from "../src/build/state.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { TUNING } from "../src/build/tuning.ts"
import { starterContext } from "../src/cli/starter.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { cellAt } from "../src/view/frame.ts"
import {
  BACKSPACE,
  DOWN,
  ENTER,
  ESC,
  LEFT,
  MAXIMUM,
  MINIMUM,
  OPEN_GROUND,
  RIGHT,
  SPACE,
  TAB,
  WIDE,
  bottomLineText,
  buildSide,
  clickCell,
  clickPanelRow,
  clickTile,
  compose,
  keys,
  panelLine,
  panelRow,
  screenText,
} from "./build-helpers.ts"
import type { Side } from "./build-helpers.ts"

/** A building's footprint: what arming asks `armingSpot` about. */
const footprintOf = (contentId: string) => FIXTURE_REGISTRY.get(contentId).footprint

const barracksRow = (side: Side): number => menuEntryRow(side.layout, STARTER_CATALOG, { kind: "construct", index: 0 }) as number

/** Whether a panel row is drawn as the inverse bar — "the keyboard is here". */
function barOn(side: Side, row: number): boolean {
  return cellAt(compose(side), side.layout.panelColumn + side.layout.panelLimit - 1, row).style.inverse === true
}

/** Whether the map cursor is drawn where the state has it. */
function cursorDrawn(side: Side): boolean {
  const cursor = cellForTile(side.layout, side.build.state.camera, side.build.state.cursor)
  return cellAt(compose(side), cursor.x, cursor.y).style.inverse === true
}

// --- The screen ----------------------------------------------------------------------------------

test("the side panel is on the left of the Grid at every size in the supported range, and the divider is the Grid's west side", () => {
  for (const terminal of [MINIMUM, MAXIMUM, WIDE, { columns: 92, rows: 28 }]) {
    const { layout } = buildSide({ terminal })
    assert.ok(layout.panelColumn < layout.dividerColumn, `panel left of the divider at ${terminal.columns}`)
    // The map's edge, drawn quietly in the map's own style, is the line beside the menu (owner, 2026-09-29).
    assert.equal(layout.gridBox.left, layout.dividerColumn, "the Grid's west side is the divider")
    assert.equal(layout.origin.column, layout.gridBox.left + 1)
    assert.equal(layout.gridBox.right, layout.offset.column + layout.composition.width - 1)
    assert.equal(layout.panelRow, layout.origin.row)
    // The Grid page's floor arithmetic, 1 + 30 + 48 + 1 = 80, with the shared west side's column
    // given to the Grid: 1 + 29 + 49 + 1 at 80 columns.
    assert.equal(layout.composition.width, 31 + layout.viewport.width * layout.tileWidth)
  }
})

test("the top bar and the bottom bar run the whole width — the divider stops at both rules", () => {
  for (const terminal of [MINIMUM, MAXIMUM, WIDE]) {
    const side = buildSide({ terminal })
    const { layout } = side
    const frame = compose(side)
    const headerRow = layout.offset.row + 1
    // The bars' own text may pass through the divider's column — that is the point — but no line may.
    const line = (x: number, y: number): boolean =>
      ["|", "+", "│", "┼", "├", "┤"].includes(cellAt(frame, x, y).glyph) || cellAt(frame, x, y).style.inverse === true
    assert.ok(!line(layout.dividerColumn, headerRow), "the divider crosses the top bar")
    // The bottom bar is one row, directly above the frame's bottom border.
    assert.ok(!line(layout.dividerColumn, layout.footerRow), "the divider crosses the bottom bar")
    assert.equal(layout.footerRow, layout.offset.row + layout.composition.height - 2)
  }
})

test("a Grid shorter than the panel still closes directly under its last row", () => {
  const small: GridTerrain = { width: 20, height: 10, tiles: new Array<TerrainId>(200).fill("terrain.plain") }
  const side = buildSide({ context: { ...starterContext(), grid: small, standing: [] } })
  const { layout } = side
  const frame = compose(side)
  assert.equal(layout.gridBox.bottom, layout.origin.row + 10)
  assert.ok(layout.paneBottom > layout.gridBox.bottom)
  for (let x = layout.gridBox.left + 1; x < layout.gridBox.right; x += 1) {
    assert.equal(cellAt(frame, x, layout.gridBox.bottom).style.fgRole, "chrome.edge", "the whole map is visible: the map's edge")
  }
  assert.match(screenText(side).split("\n")[menuEntryRow(layout, STARTER_CATALOG, { kind: "construct", index: 2 })!] as string, /\[3\] Turret/)
  // The bottom bar is as narrow as this small Grid's composition: its line keeps whole words and
  // leaves off the ones that do not fit.
  assert.ok(layout.footerLimit < hint(side.context, side.build.state).text.length, "the bar is not narrower than the hint here")
  assert.match(screenText(side).split("\n")[layout.footerRow] as string, /\| Explore Map: look around and read what is on each tile\. \[enter\] +\|/)
})

// --- Focus: three plain modes ---------------------------------------------------------------------

test("the Build Phase opens on the menu, on its first entry, Explore Map, with no cursor on the Grid", () => {
  const side = buildSide()
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.menuHighlight, EXPLORE_ENTRY)
  assert.ok(barOn(side, panelRow(side, EXPLORE_ROW)))
  // The bottom line opens on what the highlighted row is for.
  assert.equal(bottomLineText(side), "Explore Map: look around and read what is on each tile. [enter] opens it.")
  assert.ok(!cursorDrawn(side), "a cursor is drawn with the menu focused")
})

test("e and Enter on Explore Map's row arrive in Explore Map: the keyboard on the map, the cursor drawn, the menu given way to its card", () => {
  for (const sequence of [["e"], [ENTER]]) {
    const side = buildSide()
    keys(side, ...sequence)
    assert.equal(side.build.state.focus, "grid")
    assert.equal(side.build.state.armed, null)
    assert.equal(side.build.state.exploreMap, true, `${JSON.stringify(sequence)} did not open Explore Map`)
    assert.equal(side.build.state.returnTo, "menu")
    assert.equal(hint(side.context, side.build.state).text, "Explore Map: arrows move, the panel shows what is here. [esc] goes back.")
    assert.doesNotMatch(screenText(side), /\[1\] Barracks/, "the menu is still drawn beside Explore Map")
    assert.ok(cursorDrawn(side), "the exploring cursor is not drawn")
  }
})

test("Tab arrives in plain navigation: the bare cursor, the menu still drawn beside it; Enter there is Explore Map, begun on the map", () => {
  const side = buildSide()
  keys(side, TAB)
  assert.equal(side.build.state.focus, "grid")
  assert.equal(side.build.state.armed, null)
  assert.equal(side.build.state.exploreMap, false, "Tab opened Explore Map")
  assert.equal(bottomLineText(side), "Arrows move the cursor, [enter] explores here, a number arms a building.")
  assert.match(screenText(side), /\[1\] Barracks/)
  assert.ok(cursorDrawn(side), "the cursor is not drawn")
  keys(side, ENTER)
  assert.equal(side.build.state.exploreMap, true)
  assert.equal(side.build.state.returnTo, "grid")
})

test("placing: the bottom line says how to place, and Tab back to the menu disarms", () => {
  const side = buildSide()
  keys(side, "1")
  assert.equal(side.build.state.focus, "grid")
  // A command that says nothing lets whatever arming said lapse; the bottom line then says how to place.
  side.build.run([{ kind: "focus", target: "grid" }])
  assert.equal(bottomLineText(side), "Place the Barracks: arrows move, [enter] places, [1] or [esc] cancels.")
  keys(side, TAB)
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.armed, null, "a structure stayed armed with the keyboard on the menu")
})

test("a digit arms its row from either focus, where the cursor is when it fits there, and remembers which focus", () => {
  for (const start of ["menu", "grid"] as const) {
    const side = buildSide()
    side.build.dispatch({ kind: "focus", target: start })
    const cursor = side.build.state.cursor
    keys(side, "3")
    assert.equal(side.build.state.armed, 2)
    assert.equal(side.build.state.focus, "grid")
    assert.equal(side.build.state.returnTo, start)
    assert.deepEqual(side.build.state.cursor, cursor, "the Turret fits where the cursor is, and the cursor moved")
    assert.equal(side.build.state.menuHighlight, entryOfConstruct(2))
  }
})

test("Backspace on the menu flickers the row and removes nothing under the hidden map cursor", () => {
  // It removes what is under the map cursor, which the menu hides: a flicker says the
  // key arrived, like Left does.
  const side = buildSide()
  keys(side, "1", ENTER) // a Barracks, armed from the menu and placed at the cursor; back on the menu
  assert.equal(side.build.state.planned.length, 1)
  assert.equal(side.build.state.focus, "menu")
  keys(side, BACKSPACE)
  assert.equal(side.build.state.planned.length, 1, "Backspace on the menu removed a building")
  assert.equal(side.build.state.ack?.kind, "refused")
  assert.equal(side.build.state.focus, "menu")
  // The key sends `remove`, and the reducer refuses it on the menu: a driver's is refused the same way.
  const seq = side.build.state.ack?.seq ?? 0
  side.build.dispatch({ kind: "remove" })
  assert.equal(side.build.state.planned.length, 1)
  assert.deepEqual(side.build.state.ack, { seq: seq + 1, kind: "refused", entry: side.build.state.menuHighlight })
})

// --- Clicks (a click activates what it lands on) ------------------------------------

test("a click on a building's row arms it at once, whatever had focus, and its ghost is at the cursor", () => {
  // From the map a click opened: the menu is still drawn, and the ghost goes where the player was
  // looking — the cursor stays put, since the building fits there.
  const side = buildSide()
  clickTile(side, { x: 30, y: 14 })
  assert.equal(side.build.state.focus, "grid")
  assert.equal(side.build.state.exploreMap, false, "a click on the map from the menu hid the menu")
  assert.match(screenText(side), /\[1\] Barracks/)
  assert.equal(bottomLineText(side), "Arrows move the cursor, [enter] explores here, a number arms a building.")
  clickPanelRow(side, barracksRow(side))
  assert.equal(side.build.state.armed, 0, "the click only highlighted the row")
  assert.equal(side.build.state.focus, "grid")
  assert.deepEqual(side.build.state.cursor, { x: 30, y: 14 }, "arming by click moved the cursor off the map spot")
  assert.match(hint(side.context, side.build.state).text, /^Place the Barracks:/)
  assert.equal(side.build.state.returnTo, "menu", "a click on a row is the menu's, whatever had focus")

  // With the menu in hand, a click is Enter's twin: the same spot, the same way back.
  const fromMenu = buildSide()
  const byEnter = buildSide()
  clickPanelRow(fromMenu, barracksRow(fromMenu))
  keys(byEnter, DOWN, DOWN, ENTER)
  assert.equal(fromMenu.build.state.armed, 0)
  assert.deepEqual(fromMenu.build.state.cursor, byEnter.build.state.cursor)
  assert.equal(fromMenu.build.state.returnTo, "menu")

  // Enter in the plain navigation a click opened is Explore Map, as it is after Tab.
  const map = buildSide()
  clickTile(map, { x: 30, y: 14 })
  keys(map, ENTER)
  assert.equal(map.build.state.exploreMap, true)
})

test("a second click on the same tile places, and the menu comes back with nothing looking chosen", () => {
  const side = buildSide()
  clickTile(side, { x: 30, y: 14 })
  clickPanelRow(side, barracksRow(side))
  clickTile(side, { x: 30, y: 15 }) // moves the ghost
  assert.equal(side.build.state.planned.length, 0)
  clickTile(side, { x: 30, y: 15 }) // the same tile: places
  assert.equal(side.build.state.planned.length, 1)
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.armed, null)
  assert.equal(side.build.state.highlightHidden, true)
  for (const [entry, target] of menuEntries(side.context).entries()) {
    const row = menuEntryRow(side.layout, STARTER_CATALOG, target) as number
    assert.ok(!barOn(side, row), `row ${entry} looks chosen after a mouse placement`)
  }
  assert.doesNotMatch(panelLine(side, compose(side), barracksRow(side)), />$/, "the Barracks row is still drawn active")

  // The first menu key only shows where the keyboard is — Down does not move, Enter does not act.
  const highlight = side.build.state.menuHighlight
  keys(side, DOWN)
  assert.equal(side.build.state.highlightHidden, false)
  assert.equal(side.build.state.menuHighlight, highlight)
  assert.ok(barOn(side, barracksRow(side)))
  keys(side, DOWN)
  assert.equal(side.build.state.menuHighlight, highlight + 1, "the second key did nothing")

  const enter = buildSide()
  clickPanelRow(enter, barracksRow(enter))
  clickTile(enter, enter.build.state.cursor) // the arming spot's tile: the confirming click
  assert.equal(enter.build.state.planned.length, 1)
  keys(enter, ENTER)
  assert.equal(enter.build.state.armed, null, "Enter acted on a row the player could not see")
  assert.equal(enter.build.state.highlightHidden, false)
  keys(enter, ENTER)
  assert.equal(enter.build.state.armed, 0)
})

test("a click on Nexus opens its popup and a click on Explore Map explores, from either focus", () => {
  // From the map in plain navigation, where the menu is still drawn beside it. (While a building is
  // being placed the panel is its card, and a click on it goes back.)
  const side = buildSide()
  keys(side, TAB)
  clickPanelRow(side, panelRow(side, NEXUS_ROW))
  assert.equal(side.build.state.popup, "nexus-powers")
  assert.equal(side.build.state.armed, null)
  assert.equal(side.build.state.focus, "menu")
  assert.ok(!barOn(side, panelRow(side, NEXUS_ROW)), "the popup's row is drawn with the keyboard's bar")
  keys(side, "1") // pick: the popup closes, back on the menu with nothing looking chosen
  assert.equal(side.build.state.popup, null)
  assert.ok(!barOn(side, panelRow(side, NEXUS_ROW)))
  assert.doesNotMatch(panelLine(side, compose(side), panelRow(side, NEXUS_ROW)), />$/, "the Nexus row is still drawn active")

  // From the menu.
  clickPanelRow(side, panelRow(side, EXPLORE_ROW))
  assert.equal(side.build.state.exploreMap, true)
  assert.equal(side.build.state.armed, null)
})

// --- Placing --------------------------------------------------------------------------------------

test("after a placement armed from the menu the keyboard is back on the menu, disarmed, and the bottom line says what is left", () => {
  const side = buildSide()
  keys(side, DOWN, DOWN, DOWN, SPACE, SPACE) // highlight the Hatchery, arm, place
  assert.equal(side.build.state.planned.length, 1)
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.armed, null)
  assert.equal(side.build.state.menuHighlight, entryOfConstruct(1))
  assert.equal(side.build.state.status.text, "Hatchery placed (resources: 70) - [u] undo")
})

test("the owner's flow — highlight, then space, space, space, space — lays two buildings with no arrow key", () => {
  const side = buildSide()
  keys(side, DOWN, DOWN, DOWN) // Nexus -> Explore -> Barracks -> Hatchery
  keys(side, SPACE, SPACE, SPACE, SPACE) // arm, place, arm again, place
  // The first where the cursor is; the second, with the cursor on the first, one free tile east of it.
  assert.deepEqual(
    side.build.state.planned.map((placement) => placement.anchor),
    [OPEN_GROUND, { x: OPEN_GROUND.x + 3, y: OPEN_GROUND.y }],
  )
  assert.equal(side.build.state.focus, "menu")
})

test("a run of the same building lays each one a free tile from the last, never touching", () => {
  const context: BuildContext = { ...starterContext(), allotment: 1000 }
  const side = buildSide({ context })
  keys(side, DOWN, DOWN)
  for (let run = 0; run < 6; run += 1) keys(side, SPACE, SPACE)
  assert.deepEqual(
    side.build.state.planned.map((placement) => placement.anchor),
    // A row to the right (owner, 2026-09-29: "in most cases this should move the cursor only a few
    // tiles to the right"): a tile down costs more than a tile across.
    [
      { x: 17, y: 13 },
      { x: 21, y: 13 },
      { x: 25, y: 13 },
      { x: 29, y: 13 },
      { x: 33, y: 13 },
      { x: 37, y: 13 },
    ],
  )
  const all = [
    ...context.standing.map((s) => tilesOf(s.anchor, footprintOf(s.contentId))),
    ...side.build.state.planned.map((p) => tilesOf(p.anchor, footprintOf(p.contentId))),
  ]
  for (let a = 0; a < all.length; a += 1) {
    for (let b = a + 1; b < all.length; b += 1) {
      for (const t of all[a]!) {
        for (const u of all[b]!) {
          assert.ok(Math.max(Math.abs(t.x - u.x), Math.abs(t.y - u.y)) >= 2, `structures ${a} and ${b} touch`)
        }
      }
    }
  }
})

// --- Where arming puts the cursor ------------------------------------------------------

test("arming puts the preview where the cursor is whenever the building fits there", () => {
  const context = starterContext()
  for (const item of STARTER_CATALOG) {
    assert.deepEqual(armingSpot(context, [], footprintOf(item.contentId), { x: 40, y: 20 }), { tile: { x: 40, y: 20 }, found: true })
  }
  // By every way of arming: a digit, Enter on the row, a click on it.
  for (const arm of [
    (side: Side) => keys(side, "1"),
    (side: Side) => keys(side, DOWN, DOWN, ENTER),
    (side: Side) => clickPanelRow(side, barracksRow(side)),
  ]) {
    const side = buildSide()
    arm(side)
    assert.equal(side.build.state.armed, 0)
    assert.deepEqual(side.build.state.cursor, OPEN_GROUND)
  }
})

test("where it does not fit, the nearest spot within reach that leaves a free tile, then one that touches", () => {
  const context = starterContext()
  const side = buildSide()
  // The owner's flow: place a Barracks, press its key again — the cursor is on the new one.
  keys(side, TAB, "1", ENTER, "1")
  assert.deepEqual(side.build.state.planned[0]?.anchor, { x: 17, y: 13 })
  const spot = side.build.state.cursor
  assert.notDeepEqual(spot, OPEN_GROUND)
  const footprint = footprintOf("structure.citizen.barracks")
  const anchor = anchorForCursor(spot, footprint)
  assert.ok(legalityAt(context, side.build.state.planned, "structure.citizen.barracks", anchor).ok)
  // A free tile between it and every other structure.
  const others = [...context.standing, ...side.build.state.planned].flatMap((s) => tilesOf(s.anchor, footprintOf(s.contentId)))
  for (const t of tilesOf(anchor, footprint)) {
    for (const u of others) assert.ok(Math.max(Math.abs(t.x - u.x), Math.abs(t.y - u.y)) >= 2, "it touches a structure")
  }
  // Nearest: a free column to the right of the first — sideways is cheaper than down.
  assert.deepEqual(spot, { x: 22, y: 13 })

  // Touching is the fallback when nothing gapped is in reach: a corridor one Turret wide.
  const width = 8
  const height = 3
  const tiles: TerrainId[] = new Array<TerrainId>(width * height).fill("terrain.rock")
  for (let x = 0; x < width; x += 1) tiles[1 * width + x] = "terrain.plain"
  const corridor: BuildContext = { ...starterContext(), grid: { width, height, tiles }, standing: [] }
  const planned = [{ ordinal: 1, contentId: "structure.bench.beamturret", anchor: { x: 3, y: 1 } }]
  assert.deepEqual(armingSpot(corridor, planned, footprintOf("structure.bench.beamturret"), { x: 3, y: 1 }), { tile: { x: 5, y: 1 }, found: true })
  const full = [0, 1, 2, 4, 5, 6, 7].map((x, index) => ({ ordinal: index + 2, contentId: "structure.bench.beamturret", anchor: { x, y: 1 } }))
  const crowded = [...planned, ...full.filter((p) => p.anchor.x !== 4)]
  assert.deepEqual(armingSpot(corridor, crowded, footprintOf("structure.bench.beamturret"), { x: 3, y: 1 }), { tile: { x: 4, y: 1 }, found: true })
})

test("sideways is cheaper than up or down, and ties go the same way every time: more horizontal, then east, then south", () => {
  // An open field with one Turret planned where the cursor is: four spots two tiles away tie on
  // distance; east wins.
  const width = 11
  const height = 11
  const open: BuildContext = {
    ...starterContext(),
    grid: { width, height, tiles: new Array<TerrainId>(width * height).fill("terrain.plain") },
    standing: [],
  }
  const turret = footprintOf("structure.bench.beamturret")
  const planned = [{ ordinal: 1, contentId: "structure.bench.beamturret", anchor: { x: 5, y: 5 } }]
  assert.deepEqual(armingSpot(open, planned, turret, { x: 5, y: 5 }).tile, { x: 7, y: 5 })
  // With east blocked by rock, west; with both blocked, south before north.
  const rocky = (blocked: readonly { x: number; y: number }[]): BuildContext => {
    const tiles = new Array<TerrainId>(width * height).fill("terrain.plain")
    for (const tile of blocked) tiles[tile.y * width + tile.x] = "terrain.rock"
    return { ...open, grid: { width, height, tiles } }
  }
  const eastRock = rocky([{ x: 7, y: 5 }, { x: 7, y: 4 }, { x: 7, y: 6 }, { x: 8, y: 5 }, { x: 8, y: 4 }, { x: 8, y: 6 }])
  assert.deepEqual(armingSpot(eastRock, planned, turret, { x: 5, y: 5 }).tile, { x: 3, y: 5 })
  // Rock two and three tiles east and west: four tiles east and two tiles south both cost 4 (a tile
  // down costs two across), and the tie goes to the more horizontal move. In the open field two east
  // (cost 2) always beats two south (cost 4).
  const walls = rocky([
    ...[4, 5, 6].flatMap((y) => [{ x: 7, y }, { x: 3, y }]),
    { x: 8, y: 5 },
    { x: 2, y: 5 },
  ])
  assert.deepEqual(armingSpot(walls, planned, turret, { x: 5, y: 5 }).tile, { x: 9, y: 5 })
  assert.deepEqual(armingSpot(open, planned, turret, { x: 5, y: 5 }).tile, { x: 7, y: 5 })
  // The answer is a function of the plan and the cursor alone: the same call, the same answer.
  assert.deepEqual(armingSpot(open, planned, turret, { x: 5, y: 5 }), armingSpot(open, planned, turret, { x: 5, y: 5 }))
})

test("never chosen from the last building placed: the spot is nearest the cursor, wherever the last one went", () => {
  const side = buildSide({ context: { ...starterContext(), allotment: 1000 } })
  keys(side, TAB, "3", ENTER) // a Turret at the cursor, which stays on it
  side.build.run([{ kind: "move-cursor", dx: 30, dy: 12 }]) // far away, on open ground
  keys(side, "3")
  assert.deepEqual(side.build.state.cursor, { x: OPEN_GROUND.x + 30, y: OPEN_GROUND.y + 12 }, "arming went back to the last building placed")
})

test("with nothing in reach, arming steps one tile right and down, drawn as the building, not x, until moved or tried", () => {
  // Solid rock with the cursor in a one-tile hole: nothing but a Turret fits anywhere, and a Barracks
  // fits nowhere.
  const reach = TUNING.armSearchTiles
  const width = 40
  const height = 30
  const tiles: TerrainId[] = new Array<TerrainId>(width * height).fill("terrain.rock")
  tiles[10 * width + 10] = "terrain.plain"
  const solid: BuildContext = { ...starterContext(), grid: { width, height, tiles }, standing: [] }
  assert.deepEqual(armingSpot(solid, [], footprintOf("structure.citizen.barracks"), { x: 10, y: 10 }), { tile: { x: 11, y: 11 }, found: false })
  // Room for a Barracks one tile beyond reach does not count; from four tiles nearer it does.
  const far = [...tiles]
  for (let y = 9; y < 12; y += 1) for (let x = 10 + reach; x < 10 + reach + 5; x += 1) far[y * width + x] = "terrain.plain"
  const beyond: BuildContext = { ...solid, grid: { width, height, tiles: far } }
  assert.equal(armingSpot(beyond, [], footprintOf("structure.citizen.barracks"), { x: 10, y: 10 }).found, false)
  assert.equal(armingSpot(beyond, [], footprintOf("structure.citizen.barracks"), { x: 14, y: 10 }).found, true)

  const side = buildSide({ context: solid, cursor: { x: 10, y: 10 } })
  keys(side, TAB, "1")
  assert.equal(side.build.state.armed, 0)
  assert.deepEqual(side.build.state.cursor, { x: 11, y: 11 })
  assert.equal(side.build.state.noSpotFound, true)
  const noRoom = new RegExp(`no room within ${reach} tiles`)
  assert.match(side.build.state.status.text, noRoom)
  const ghostTile = cellForTile(side.layout, side.build.state.camera, side.build.state.cursor)
  const drawn = (): string => cellAt(compose(side), ghostTile.x, ghostTile.y).glyph
  assert.notEqual(drawn(), "x", "the ghost was drawn as the refusal's x")
  assert.match(bottomLineText(side), noRoom)
  // Moving: the normal refusal drawing.
  keys(side, RIGHT, LEFT)
  assert.equal(side.build.state.noSpotFound, false)
  assert.equal(drawn(), "x")
  // Trying to place clears it too, with the refusal said loudly.
  const tried = buildSide({ context: solid, cursor: { x: 10, y: 10 } })
  keys(tried, TAB, "1")
  assert.equal(tried.build.state.noSpotFound, true)
  keys(tried, ENTER)
  assert.equal(tried.build.state.noSpotFound, false)
  assert.equal(tried.build.state.planned.length, 0)
  assert.equal(tried.build.state.status.tone, "danger")
  // And Esc disarms: nothing left to draw as a ghost.
  keys(tried, ESC)
  assert.equal(tried.build.state.noSpotFound, false)
})

test("the cursor opens on the Grid Nexus, and the first building armed finds the nearest good spot around it", () => {
  const context = starterContext()
  assert.deepEqual(nexusTile(context), STARTER_START_CURSOR)
  const run = runBuildPlaytest({ steps: parseKeyScript("1") })
  assert.deepEqual(run.frames[0]?.state.cursor, STARTER_START_CURSOR)
  const armed = run.frames[1]?.state
  assert.ok(armed !== undefined)
  assert.equal(armed.armed, 0)
  assert.notDeepEqual(armed.cursor, STARTER_START_CURSOR, "the Barracks was left on top of the Nexus")
  const footprint = footprintOf("structure.citizen.barracks")
  assert.ok(legalityAt(context, [], "structure.citizen.barracks", anchorForCursor(armed.cursor, footprint)).ok)
  assert.deepEqual(armed.cursor, { x: 22, y: 10 }, "one free column east of the Nexus")
  // A map with no Nexus has no default of its own.
  assert.equal(nexusTile({ ...context, standing: [] }), null)
})

// --- Where the keyboard goes back to ------------------------------------------------------

test("a building armed on the map goes back to the map after a placement: plain navigation, the menu beside it", () => {
  const side = buildSide()
  keys(side, TAB, "1", ENTER)
  assert.equal(side.build.state.planned.length, 1)
  assert.equal(side.build.state.focus, "grid")
  assert.equal(side.build.state.armed, null)
  assert.equal(side.build.state.exploreMap, false)
  assert.deepEqual(side.build.state.cursor, OPEN_GROUND, "the cursor left the building just placed")
  // The placement's answer, then — at the next key that says nothing — the map's hint.
  assert.equal(bottomLineText(side), "Barracks placed (resources: 60) - [u] undo")
  assert.match(screenText(side), /\[1\] Barracks/)
  keys(side, RIGHT)
  assert.equal(bottomLineText(side), "Arrows move the cursor, [enter] explores here, a number arms a building.")
  // From Explore Map too: a digit there is the map's.
  const exploring = buildSide()
  keys(exploring, TAB, "e", "3", ENTER)
  assert.equal(exploring.build.state.focus, "grid")
  assert.equal(exploring.build.state.exploreMap, false)
})

test("a mouse placement goes back to the menu, focused but unselected", () => {
  const side = buildSide()
  clickTile(side, { x: 30, y: 14 }) // plain navigation, by the mouse
  clickPanelRow(side, barracksRow(side))
  clickTile(side, side.build.state.cursor)
  assert.equal(side.build.state.planned.length, 1)
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.highlightHidden, true)
  // A building armed on the map and placed by a click goes back to the map.
  const map = buildSide()
  keys(map, TAB, "1")
  clickTile(map, map.build.state.cursor)
  assert.equal(map.build.state.planned.length, 1)
  assert.equal(map.build.state.focus, "grid")
})

// --- Same plan, every adapter ---------------------------------------------------------------------

test("the focus flow by keyboard bytes and the same commands from a driver are the same state and frame", () => {
  const byKeyboard = buildSide()
  keys(byKeyboard, DOWN, SPACE, DOWN, SPACE) // highlight Nexus, open it, pick the second, which closes it
  keys(byKeyboard, DOWN, SPACE, SPACE) // highlight Barracks, arm, place
  keys(byKeyboard, DOWN, DOWN, SPACE, SPACE) // highlight Turret, arm, place
  keys(byKeyboard, "p", "y")

  const script: readonly BuildCommand[] = [
    { kind: "highlight", delta: 1 },
    { kind: "activate" },
    // In the popup Space sends what its highlighted row names: the second power's pick.
    { kind: "highlight", delta: 1 },
    { kind: "pick-nexus", index: 1 },
    { kind: "highlight", delta: 1 },
    { kind: "activate" },
    { kind: "place" },
    { kind: "highlight", delta: 1 },
    { kind: "highlight", delta: 1 },
    { kind: "activate" },
    { kind: "place" },
    { kind: "open-battle-round" },
    { kind: "start-pulse" },
  ]
  const byDriver = buildSide()
  byDriver.build.run(script)

  assert.equal(byKeyboard.build.state.committed, true, "the flow did not reach committed")
  assert.equal(byKeyboard.build.state.planned.length, 2)
  assert.deepEqual(byDriver.build.state, byKeyboard.build.state)
  assert.equal(screenText(byDriver), screenText(byKeyboard))

  // And a mouse player clicking the same rows and the same tiles plans the same thing.
  const byMouse = buildSide()
  keys(byMouse, "n", "2")
  for (const placement of byKeyboard.build.state.planned) {
    const index = STARTER_CATALOG.findIndex((item) => item.contentId === placement.contentId)
    const row = menuEntryRow(byMouse.layout, STARTER_CATALOG, { kind: "construct", index }) as number
    clickPanelRow(byMouse, row)
    if (byMouse.build.state.armed === null) clickPanelRow(byMouse, row)
    const offset = anchorForCursor({ x: 0, y: 0 }, footprintOf(placement.contentId))
    const centre = { x: placement.anchor.x - offset.x, y: placement.anchor.y - offset.y }
    // A click on the tile the cursor already sits on is the confirming click.
    if (byMouse.build.state.cursor.x !== centre.x || byMouse.build.state.cursor.y !== centre.y) clickTile(byMouse, centre)
    clickTile(byMouse, centre)
  }
  keys(byMouse, "p", "y")
  assert.deepEqual(byMouse.build.state.planned, byKeyboard.build.state.planned)
  assert.equal(byMouse.build.state.nexusPick, byKeyboard.build.state.nexusPick)
  assert.equal(byMouse.build.state.committed, true)
})

test("clicks as a terminal sends them and the driver's click commands are the same state and frame", () => {
  const byMouse = buildSide()
  clickTile(byMouse, { x: 30, y: 14 }) // the map, the menu still drawn
  clickPanelRow(byMouse, barracksRow(byMouse)) // armed at once
  clickTile(byMouse, { x: 30, y: 15 })
  clickTile(byMouse, { x: 30, y: 15 }) // placed; the menu is back
  clickPanelRow(byMouse, panelRow(byMouse, EXPLORE_ROW)) // Explore Map
  clickTile(byMouse, { x: 18, y: 11 }) // the card shows the Grid Nexus
  clickCell(byMouse, byMouse.layout.panelColumn + 2, panelRow(byMouse, 2)) // the panel: closes it
  clickPanelRow(byMouse, panelRow(byMouse, NEXUS_ROW)) // the Nexus popup

  const byDriver = buildSide()
  byDriver.build.run([
    { kind: "click-tile", x: 30, y: 14 },
    { kind: "click-menu", entry: entryOfConstruct(0) },
    { kind: "click-tile", x: 30, y: 15 },
    { kind: "click-tile", x: 30, y: 15 },
    { kind: "click-menu", entry: EXPLORE_ENTRY },
    { kind: "click-tile", x: 18, y: 11 },
    { kind: "click-menu", entry: EXPLORE_ENTRY },
    { kind: "click-menu", entry: NEXUS_ENTRY },
  ])
  assert.equal(byMouse.build.state.planned.length, 1)
  assert.equal(byMouse.build.state.popup, "nexus-powers")
  assert.deepEqual(byDriver.build.state, byMouse.build.state)
  assert.equal(screenText(byDriver), screenText(byMouse))
})
