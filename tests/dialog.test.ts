// The dialog and the intro highlight (the owner's Commander round 2: "Vasse is visible on the map. She should
// have an intro highlight when she shows up ... perhaps a new type of popup at the bottom that shows dialogs").
//
// A round's scene in the Build Phase's context; **the dialog** — the popup the player does not open, docked at the
// bottom of the map, read on by Enter, Space or a click and skipped by Esc, the camera on each line's focus and the
// Build Phase afterwards exactly as the round opened it; **the intro highlight** around that focus, in its three
// forms; the line the game says when a Commander comes back (a Skirmish she falls in, `tests/commander-fixture.ts`);
// the Activity Logs that say whether it was read; and Vasse bold at full strength while a Pulse plays.
//
// The dialog is held on the starter map's round 1 with a four-line scene of two speakers, the intro PERIMETER opened
// on before Story stopped (`INTRO`): what a scene can be, whoever writes it.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { STARTER_CATALOG, starterTerrain } from "./starter-fixture.ts"
import { centreOn } from "../src/build/camera.ts"
import { buildKeyboardCommand } from "../src/build/keyboard.ts"
import type { BuildLayout } from "../src/build/layout.ts"
import { buildLayout, cellForTile, escLabel } from "../src/build/layout.ts"
import { MOUSE_LEFT, buildMouseCommand } from "../src/build/mouse.ts"
import type { PlacedPopup } from "../src/build/popup.ts"
import { placePopup, popupHitAt, popupSpec } from "../src/build/popup.ts"
import type { BuildContext } from "../src/build/state.ts"
import { applyBuildCommand, createBuildState, nexusTile } from "../src/build/state.ts"
import type { DialogLine } from "../src/build/types.ts"
import { runBuildPhase } from "../src/cli/build-phase.ts"
import type { LevelPlay } from "../src/cli/levels.ts"
import { STARTER_LEVEL, starterContext } from "../src/cli/starter.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { ROW_DISTANCE, tilesOf } from "../src/engine/geometry/coords.ts"
import type { Coord } from "../src/engine/geometry/types.ts"
import { ACTIVITY_FILTERS, filteredEntries } from "../src/log/activity.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"
import { BuildSession } from "../src/view/build-session.ts"
import { BREATH_FRAME_MS, BuildAnimation } from "../src/view/build-live.ts"
import { drawnBold } from "../src/view/map-layers.ts"
import { EFFECT_RECIPES } from "../src/view/effects/recipes.ts"
import { FOCUS_LIGHT } from "../src/view/effects/shading.ts"
import type { EffectContext, EffectInstance } from "../src/view/effects/types.ts"
import type { ReadonlyCellFrame } from "../src/view/frame.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"
import { COLOR_DEPTHS, resolveCell } from "../src/view/roles.ts"
import type { ColorDepth } from "../src/view/roles.ts"
import {
  BACKSPACE,
  CTRL_C,
  DOWN,
  ENTER,
  ESC,
  MAXIMUM,
  MINIMUM,
  ROOMY,
  SPACE,
  TAB,
  WIDE,
  activityLog,
  bottomLineText,
  clickCell,
  clickEscLabel,
  compose,
  keys,
  panelCells,
  rightClickMap,
  screenText,
} from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"
import { VASSE, commanderFallsLevel } from "./commander-fixture.ts"

const terrain = starterTerrain()
const registry = FIXTURE_REGISTRY

/** The starter round's own map, where the intro's lines look: Vasse arriving with her troops, Dob Hunter's army by his
 *  Nexus, and her Nexus. */
const ROUND_ONE = starterContext()
const herTile = (ROUND_ONE.incoming ?? []).find((entity) => entity.contentId === VASSE)?.anchor ?? { x: 0, y: 0 }
const enemyTiles = (ROUND_ONE.incoming ?? []).filter((entity) => entity.player === "B").map((entity) => entity.anchor)
const nexusAt = ROUND_ONE.standing.find((structure) => ROUND_ONE.registry.get(structure.contentId).nexus === true)?.anchor ?? { x: 0, y: 0 }
const nexusTiles = tilesOf(nexusAt, ROUND_ONE.registry.get("structure.citizen.nexus").footprint)
const middle = (tiles: readonly Coord[]): Coord => ({
  x: Math.floor((Math.min(...tiles.map((tile) => tile.x)) + Math.max(...tiles.map((tile) => tile.x))) / 2),
  y: Math.floor((Math.min(...tiles.map((tile) => tile.y)) + Math.max(...tiles.map((tile) => tile.y))) / 2),
})

/** The intro PERIMETER opened on, as a scene of round 1: four lines, two speakers, three things to look at. */
const INTRO: readonly DialogLine[] = [
  { speaker: "Vasse", side: "A", unit: VASSE, text: "By the book. The new book.", focus: { tile: herTile, own: [herTile] } },
  { speaker: "Corvane", side: "B", unit: null, text: "Nice fence, roadmakers. We brought wire cutters.", focus: { tile: middle(enemyTiles), own: enemyTiles } },
  { speaker: "Vasse", side: "A", unit: VASSE, text: "It is not our fence I would worry about.", focus: { tile: herTile, own: [herTile] } },
  { speaker: "Corvane", side: "B", unit: null, text: "...Why is your pyramid looking at me?", focus: { tile: { x: 18, y: 10 }, own: nexusTiles } },
]

/** The starter map's round 1, opening on `INTRO`. */
const introContext = (): BuildContext => ({ ...starterContext(), scene: INTRO })

/** A Build Phase session as the game opens one — scenes played unless told otherwise — on the starter map's first
 *  round with the intro, or the context and play given. */
function sceneSide(
  options: Readonly<{ context?: BuildContext; mission?: Pick<LevelPlay, "startPulse" | "nextRound">; scenes?: boolean; terminal?: Readonly<{ columns: number; rows: number }> }> = {},
): BuildSide {
  const activity = activityLog()
  // Next round on manual: these rounds open after their result, which Enter closes (the default goes straight on).
  const given = options.context ?? introContext()
  const context: BuildContext = { ...given, activity, experiments: { ...given.experiments, nextRound: "key" } }
  const layout = buildLayout(options.terminal ?? MINIMUM, context.terrain)
  const play = options.mission ?? STARTER_LEVEL.play
  const build = new BuildSession({
    context,
    cursor: STARTER_START_CURSOR,
    viewport: layout.viewport,
    activity,
    startPulse: play.startPulse,
    nextRound: play.nextRound,
    scenes: options.scenes ?? true,
  })
  return { build, layout, context, quits: () => 0, activity }
}

/** The dialog as drawn and hit-tested, on the session's own round. */
function dialogBox(side: BuildSide): PlacedPopup {
  const spec = popupSpec(side.build.round, side.build.state)
  assert.ok(spec !== null && side.build.state.popup === "dialog", "no dialog is open")
  return placePopup(side.layout, spec)
}

/** The text across a frame row, from a column, `length` cells long. */
const rowText = (frame: ReadonlyCellFrame, row: number, from: number, length: number): string =>
  Array.from({ length }, (_, index) => cellAt(frame, from + index, row).glyph).join("")

/** A Nexus power picked and the round's Pulse started, nothing built; then played to its result. */
function playRound(side: BuildSide): void {
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  const pulse = side.build.pulse
  assert.ok(pulse !== null, "the round's Pulse did not start")
  side.build.advance(0)
  side.build.advance(pulse.prelude.lengthMs + pulse.times.homeMs + 100)
  assert.equal(pulse.phase(), "home")
}

/** The Skirmish she falls in, at its round 2 (`commanderFallsLevel`): Vasse falls, and is back as round 3 opens. */
function fixtureSide(scenes = true): BuildSide {
  const level = commanderFallsLevel()
  const side = sceneSide({ context: level.firstRound(), mission: level.play, scenes })
  // The loaded save's line, read past.
  if (scenes) keys(side, ESC)
  return side
}

// --- The dialog --------------------------------------------------------------------------------------

test("a round with a scene opens on the dialog when the session plays scenes: Vasse's line, under her name", () => {
  const side = sceneSide()
  const { state } = side.build
  assert.equal(state.popup, "dialog")
  assert.equal(state.dialog?.line, 0)
  assert.deepEqual(
    (side.build.round.scene ?? []).map((line) => [line.speaker, line.side, line.unit]),
    [
      ["Vasse", "A", VASSE],
      ["Corvane", "B", null],
      ["Vasse", "A", VASSE],
      ["Corvane", "B", null],
    ],
  )
  const text = screenText(side, "truecolor")
  assert.match(text, / @ VASSE /)
  assert.match(text, /By the book\. The new book\./)
  assert.match(text, /close \[esc\]/)
  assert.equal(bottomLineText(side), "Line 1 of 4. [enter] next line, [esc] skips the rest.")
  // A session a test builds without scenes opens on the menu, as the screen always has.
  const plain = sceneSide({ scenes: false })
  assert.equal(plain.build.state.popup, null)
  assert.equal(plain.build.round.scene, undefined)
})

test("Enter, Space and a click anywhere read on, line by line; after the last the dialog closes", () => {
  const byKeys = sceneSide()
  keys(byKeys, ENTER)
  assert.equal(byKeys.build.state.dialog?.line, 1)
  assert.match(screenText(byKeys), / CORVANE\b/)
  assert.match(screenText(byKeys), /Nice fence, roadmakers\. We brought wire/)
  keys(byKeys, SPACE)
  assert.equal(byKeys.build.state.dialog?.line, 2)
  keys(byKeys, ENTER)
  assert.equal(byKeys.build.state.dialog?.line, 3)
  assert.equal(bottomLineText(byKeys), "Line 4 of 4. [enter] or [esc] closes it.")
  keys(byKeys, ENTER)
  assert.equal(byKeys.build.state.popup, null)
  assert.equal(byKeys.build.state.dialog, null)

  // The mouse: on the dialog, on the map, on the menu, on the bottom line — each reads on, so a stray click
  // never skips the scene.
  const byMouse = sceneSide()
  const { layout } = byMouse
  const box = dialogBox(byMouse).box
  const targets: readonly (readonly [string, number, number])[] = [
    ["the dialog", box.left + 4, box.top + 1],
    ["the map", layout.origin.column + 3, layout.origin.row + 2],
    ["the menu", layout.panelColumn + 2, layout.panelRow + 3],
    ["the bottom line", layout.panelColumn + 4, layout.footerRow],
  ]
  for (const [index, [where, column, row]] of targets.entries()) {
    clickCell(byMouse, column, row)
    if (index < 3) assert.equal(byMouse.build.state.dialog?.line, index + 1, `a click on ${where} did not read on`)
  }
  assert.equal(byMouse.build.state.popup, null, "the fourth click did not close the dialog")
  assert.deepEqual(byMouse.build.state, byKeys.build.state, "the mouse and the keys did not end in the same place")
  // As commands: the adapters send `dialog-next` for both, and a driver's clicks read on too.
  const placed = dialogBox(sceneSide())
  assert.deepEqual(popupHitAt(placed, box.left + 4, box.top + 1), { kind: "command", command: { kind: "dialog-next" } })
  const fresh = sceneSide()
  const outside = buildMouseCommand({ button: MOUSE_LEFT, column: layout.origin.column + 3, row: layout.origin.row + 2, press: true }, fresh.build.state.camera, layout, STARTER_CATALOG, {
    popup: placed,
    escLabel: escLabel(fresh.build.state),
  })
  assert.deepEqual(outside, { kind: "dialog-next" })
  fresh.build.run([{ kind: "click-tile", x: 30, y: 20 }, { kind: "click-menu", entry: 2 }])
  assert.equal(fresh.build.state.dialog?.line, 2)
})

test("Esc, x, a right click and the top bar's close [esc] skip the rest, onto the round as it opened", () => {
  const plain = sceneSide({ scenes: false })
  const ways: readonly (readonly [string, (side: BuildSide) => void])[] = [
    ["Esc", (side) => keys(side, ESC)],
    ["x", (side) => keys(side, "x")],
    ["a right click", (side) => rightClickMap(side)],
    ["the top bar's label", (side) => clickEscLabel(side)],
  ]
  for (const [name, skip] of ways) {
    const side = sceneSide()
    keys(side, ENTER)
    skip(side)
    assert.equal(side.build.state.popup, null, `${name} did not close the dialog`)
    assert.deepEqual(side.build.state, plain.build.state, `${name} did not leave the round as it opened`)
  }
})

test("after the dialog the Build Phase is exactly the one a session without scenes opens, and the next key does the same", () => {
  for (const through of [[ENTER, ENTER, ENTER, ENTER], [ESC], [ENTER, ENTER, "x"]]) {
    const side = sceneSide()
    const plain = sceneSide({ scenes: false })
    keys(side, ...through)
    assert.deepEqual(side.build.state, plain.build.state, `after ${JSON.stringify(through)}`)
    for (const key of ["1", "e", DOWN]) {
      keys(side, key)
      keys(plain, key)
      assert.deepEqual(side.build.state, plain.build.state, `${JSON.stringify(key)} after ${JSON.stringify(through)}`)
    }
    assert.equal(screenText(side), screenText(plain))
  }
})

test("each line takes the camera to what it looks at: Vasse, the enemy by his Nexus, her Nexus", () => {
  const side = sceneSide()
  const round = side.build.round
  const scene = round.scene ?? []
  const vasse = (round.incoming ?? []).find((entity) => entity.contentId === VASSE)
  assert.ok(vasse !== undefined, "she is not arriving with her troops")
  // What each line looks at, on round 1's own map.
  assert.deepEqual(scene[0]?.focus, { tile: vasse.anchor, own: [vasse.anchor] })
  assert.deepEqual(scene[2]?.focus, scene[0]?.focus)
  const enemy = (round.incoming ?? []).filter((entity) => entity.player === "B").map((entity) => entity.anchor)
  assert.deepEqual(scene[1]?.focus?.own, enemy, "Corvane's line does not look at the enemy")
  const nexus = scene[3]?.focus
  assert.deepEqual(nexus?.tile, { x: 18, y: 10 })
  assert.equal(nexus?.own.length, 6)
  // The camera centres on each in turn, and the cursor (hidden) goes there: the Pulse's own look-at.
  for (const [index, line] of scene.entries()) {
    const focus = line.focus
    assert.ok(focus !== null)
    assert.equal(side.build.state.dialog?.line, index)
    assert.deepEqual(side.build.state.camera, centreOn(focus.tile, side.layout.viewport, terrain), `line ${index + 1}'s camera`)
    assert.deepEqual(side.build.state.cursor, focus.tile)
    keys(side, ENTER)
  }
  // The enemy is far from the base: the view really moved, and came back.
  assert.notDeepEqual(centreOn(scene[1]?.focus?.tile ?? { x: 0, y: 0 }, side.layout.viewport, terrain), centreOn(vasse.anchor, side.layout.viewport, terrain))
  assert.deepEqual(side.build.state.cursor, STARTER_START_CURSOR)
})

test("while it is open the dialog holds the keyboard: nothing reaches the plan, the menu is unlit and the cursor hidden", () => {
  const side = sceneSide()
  const before = side.build.state
  for (const key of ["1", "2", "n", "e", "s", "p", "u", "d", "?", TAB, DOWN, BACKSPACE]) {
    keys(side, key)
    assert.deepEqual(side.build.state, before, `${JSON.stringify(key)} reached past the dialog`)
  }
  // The keyboard adapter's word for each.
  const context = { itemCount: 3, armed: false, focus: "menu" as const, popup: "dialog" as const }
  assert.deepEqual(buildKeyboardCommand(ENTER, context), { kind: "dialog-next" })
  assert.deepEqual(buildKeyboardCommand(SPACE, context), { kind: "dialog-next" })
  assert.deepEqual(buildKeyboardCommand(ESC, context), { kind: "cancel" })
  assert.deepEqual(buildKeyboardCommand("x", context), { kind: "back" })
  assert.deepEqual(buildKeyboardCommand("q", context), { kind: "open-game-menu" })
  for (const key of ["1", "n", "e", "s", "d", "?", "u"]) assert.equal(buildKeyboardCommand(key, context), null, key)

  // The menu's bar is dark while the dialog has the keyboard, and lights on Explore Map once it closes.
  const frame = compose(side, {}, "truecolor")
  const exploreRow = side.layout.panelRow
  assert.ok(panelCells(side, frame, exploreRow).every((cell) => cell.style.inverse !== true), "the menu is lit under the dialog")
  // No cursor where the line looks (her tile), only her own glyph.
  const her = cellForTile(side.layout, side.build.state.camera, side.build.state.cursor)
  assert.equal(cellAt(frame, her.x, her.y).glyph, "@")
  assert.notEqual(cellAt(frame, her.x, her.y).style.inverse, true, "the map cursor is drawn under the dialog")
  keys(side, ESC)
  assert.ok(panelCells(side, compose(side, {}, "truecolor"), exploreRow).some((cell) => cell.style.inverse === true), "the menu did not light again")
})

test("q opens the game menu over the dialog, and going back from it comes back to the same line", () => {
  const side = sceneSide()
  keys(side, ENTER, "q")
  assert.equal(side.build.state.popup, "game-menu")
  assert.equal(side.build.state.dialog?.line, 1, "the scene was lost to the game menu")
  keys(side, ESC)
  assert.equal(side.build.state.popup, "dialog")
  assert.equal(side.build.state.dialog?.line, 1)
  // Restart, from there, is the mission from round 1: its intro again.
  keys(side, "q", "r")
  assert.equal(side.build.state.popup, "dialog")
  assert.equal(side.build.state.dialog?.line, 0)
})

test("the dialog is docked at the bottom of the map, its height kept through the scene, at every size", () => {
  for (const terminal of [MINIMUM, MAXIMUM, WIDE, ROOMY]) {
    const side = sceneSide({ terminal })
    const { layout } = side
    const heights = new Set<number>()
    for (let line = 0; line < 4; line += 1) {
      const { box } = dialogBox(side)
      const size = `${terminal.columns}x${terminal.rows}`
      // Over the map, its shadow on the map's last row, the bottom line clear below it.
      assert.equal(box.bottom, layout.paneBottom - 2, `${size}: not docked at the bottom`)
      assert.ok(box.left > layout.mapBox.left && box.right + 1 < layout.mapBox.right, `${size}: wider than the map`)
      assert.ok(box.top > layout.mapBox.top, `${size}: taller than the map`)
      heights.add(box.bottom - box.top + 1)
      keys(side, ENTER)
    }
    assert.equal(heights.size, 1, `${terminal.columns}x${terminal.rows}: the dialog changed height as it read on`)
    const [height] = heights
    assert.ok(height !== undefined && height >= 3 && height <= 5, `${height} rows`)
  }
})

test("the speaker's name is in the border, inverse in their side's colour, their glyph beside it when they stand on the map", () => {
  const side = sceneSide()
  for (const [name, role, glyph] of [
    ["VASSE", "player.a", "@"],
    ["CORVANE", "player.b", null],
  ] as const) {
    const frame = compose(side, {}, "truecolor")
    const { box } = dialogBox(side)
    const title = glyph === null ? ` ${name} ` : ` ${glyph} ${name} `
    assert.equal(rowText(frame, box.top, box.left + 2, title.length), title)
    for (let x = box.left + 2; x < box.left + 2 + title.length; x += 1) {
      const cell = cellAt(frame, x, box.top)
      assert.equal(cell.style.fgRole, role, `${name}: ${JSON.stringify(cell)}`)
      assert.equal(cell.style.inverse, true)
      assert.equal(cell.style.bold, true)
    }
    keys(side, ENTER)
  }
})

// --- The intro highlight ------------------------------------------------------------------------------

const focusInstance = (origin: Coord, params: Record<string, number> = { periodMs: 2000 }): EffectInstance => ({
  recipe: "fx.focus.light",
  band: "highlights",
  startMs: 0,
  durationMs: Number.MAX_SAFE_INTEGER,
  origin,
  family: "neutral",
  params,
})
const effectAt = (overrides: Partial<EffectContext> = {}): EffectContext => ({
  timeMs: 0,
  cosmeticSeed: 0,
  reducedMotion: false,
  colors: "truecolor",
  ...overrides,
})

test("the intro highlight's three forms: a breathing ring, a steady one under reduced motion, the focus inverted in monochrome", () => {
  const recipe = EFFECT_RECIPES["fx.focus.light"]
  assert.ok(recipe !== undefined)
  const origin = { x: 10, y: 10 }
  const key = (tile: Coord): string => `${tile.x},${tile.y}`
  const alphaAt = (timeMs: number, tile: Coord, overrides: Partial<EffectContext> = {}): number | undefined =>
    recipe(focusInstance(origin), effectAt({ timeMs, ...overrides })).find((cell) => key(cell.tile) === key(tile))?.seeThrough?.alpha

  // Full: a ring of glyphless light around the focus — a row deep above and below, and as many columns deep at
  // the sides as a row counts, so it is as deep on screen every way round — never on the focus itself.
  const full = recipe(focusInstance(origin), effectAt())
  assert.equal(full.length, (2 * ROW_DISTANCE + 1) * 3 - 1)
  assert.deepEqual(
    [Math.min(...full.map((cell) => cell.tile.x)), Math.max(...full.map((cell) => cell.tile.x))],
    [origin.x - ROW_DISTANCE, origin.x + ROW_DISTANCE],
  )
  assert.ok(full.every((cell) => cell.glyph === "" && cell.seeThrough?.role === "fx.flash" && cell.inverse !== true))
  assert.ok(!full.some((cell) => key(cell.tile) === key(origin)), "the light falls on the focus's own glyph")
  // Lit as the line appears, at rest half a breath later, lit again a breath on; the far columns at half.
  const near = { x: 11, y: 10 }
  assert.equal(alphaAt(0, near), FOCUS_LIGHT.peak)
  assert.equal(alphaAt(1000, near), FOCUS_LIGHT.rest)
  assert.equal(alphaAt(2000, near), FOCUS_LIGHT.peak)
  assert.ok((alphaAt(500, near) ?? 0) < FOCUS_LIGHT.peak && (alphaAt(500, near) ?? 0) > FOCUS_LIGHT.rest)
  assert.equal(alphaAt(0, { x: 12, y: 10 }), FOCUS_LIGHT.peak / 2)
  // Under the half at which a see-through style shows in monochrome.
  assert.ok(FOCUS_LIGHT.peak < 0.5)

  // Reduced motion: the same ring, steady, between rest and peak.
  const held = [0, 300, 1000, 1700].map((timeMs) => alphaAt(timeMs, near, { reducedMotion: true }))
  assert.equal(new Set(held).size, 1, `it moved: ${held.join(", ")}`)
  assert.ok((held[0] ?? 0) > FOCUS_LIGHT.rest && (held[0] ?? 0) < FOCUS_LIGHT.peak)
  // A breath of 0 holds it steady too.
  assert.equal(
    recipe(focusInstance(origin, { periodMs: 0 }), effectAt({ timeMs: 700 }))[0]?.seeThrough?.alpha,
    recipe(focusInstance(origin, { periodMs: 0 }), effectAt({ timeMs: 0 }))[0]?.seeThrough?.alpha,
  )

  // Monochrome, which cannot blend a light: the focus's own cells in inverse video, an
  // attribute and never a glyph, and nothing on the ground around it.
  for (const colors of ["monochrome"] as const) {
    for (const reducedMotion of [false, true]) {
      const cells = recipe(focusInstance({ x: 10, y: 10 }, { width: 3, height: 2 }), effectAt({ colors, reducedMotion, timeMs: 900 }))
      assert.deepEqual(
        cells.map((cell) => key(cell.tile)).sort(),
        tilesOf({ x: 10, y: 10 }, [0, 1].flatMap((y) => [0, 1, 2].map((x) => ({ x, y })))).map(key).sort(),
      )
      assert.ok(cells.every((cell) => cell.glyph === "" && cell.inverse === true && cell.seeThrough === undefined), colors)
    }
  }
})

test("drawn on the map: a ring around the line's focus as drawn, the focus's own glyph untouched, every glyph as it was", () => {
  const side = sceneSide()
  const her = side.build.state.cursor
  const at = (tile: Coord) => cellForTile(side.layout, side.build.state.camera, tile)
  const full = compose(side, {}, "truecolor")
  const own = at(her)
  assert.equal(cellAt(full, own.x, own.y).glyph, "@")
  assert.equal(cellAt(full, own.x, own.y).style.seeThrough, undefined, "her own cell is lit over")
  for (const dx of [-2, -1, 1, 2]) {
    const cell = at({ x: her.x + dx, y: her.y })
    assert.equal(cellAt(full, cell.x, cell.y).style.seeThrough?.role, "fx.flash", `no light ${dx} beside her`)
  }
  for (const dy of [-1, 1]) {
    const cell = at({ x: her.x, y: her.y + dy })
    assert.equal(cellAt(full, cell.x, cell.y).style.seeThrough?.role, "fx.flash", `no light ${dy} above or below her`)
  }
  // The live loop's clock breathes it: at rest half a breath after the line appeared.
  const beside = at({ x: her.x + 1, y: her.y })
  const later = compose(side, { dialogLight: { elapsedMs: 1000 } }, "truecolor")
  assert.equal(cellAt(full, beside.x, beside.y).style.seeThrough?.alpha, FOCUS_LIGHT.peak)
  assert.equal(cellAt(later, beside.x, beside.y).style.seeThrough?.alpha, FOCUS_LIGHT.rest)
  // Monochrome: her cell inverted, no light around her (an arriving trooper beside her keeps its own look).
  const mono = compose(side, {}, "monochrome")
  assert.equal(cellAt(mono, own.x, own.y).style.inverse, true)
  assert.notEqual(cellAt(mono, beside.x, beside.y).style.seeThrough?.role, "fx.flash")
  // The highlight never changes a glyph: every depth draws the same characters.
  const glyphs = new Set(COLOR_DEPTHS.map((colors: ColorDepth) => frameToText(compose(side, {}, colors))))
  assert.equal(glyphs.size, 1)
  // Gone with the dialog.
  keys(side, ESC)
  const after = compose(side, {}, "truecolor")
  for (let y = 0; y < after.height; y += 1) {
    for (let x = 0; x < after.width; x += 1) assert.notEqual(cellAt(after, x, y).style.seeThrough?.role, "fx.flash", `light left at ${x},${y}`)
  }
})

test("the live loop breathes the light from the frame that first showed each line, on slow frames, and holds it still where it cannot breathe", () => {
  const context = starterContext()
  const viewport = buildLayout(MINIMUM, context.terrain).viewport
  const opened = createBuildState(context, STARTER_START_CURSOR, viewport)
  const animation = new BuildAnimation()
  const first = animation.frame(opened, 1000, { colors: "truecolor" })
  assert.deepEqual(first.dialogLight, { elapsedMs: 0 })
  const breathing = animation.frame(opened, 1700, { colors: "truecolor" })
  assert.deepEqual(breathing.dialogLight, { elapsedMs: 700 })
  assert.equal(breathing.frameMs, BREATH_FRAME_MS, "the light did not ask for the breath's slow frames")
  // The next line starts its light afresh; the camera's slide to it runs at the full rate meanwhile.
  const next = applyBuildCommand(context, opened, { kind: "dialog-next" })
  const moved = animation.frame(next, 2000, { colors: "truecolor" })
  assert.deepEqual(moved.dialogLight, { elapsedMs: 0 })
  assert.equal(moved.frameMs, undefined)
  // Reduced motion and monochrome: still, and nothing asks for a frame.
  for (const options of [{ reducedMotion: true, colors: "truecolor" as const }, { colors: "monochrome" as const }]) {
    const still = new BuildAnimation()
    still.frame(opened, 0, options)
    const later = still.frame(opened, 5000, options)
    assert.equal(later.busyUntil, null, JSON.stringify(options))
    assert.deepEqual(later.dialogLight, { elapsedMs: 5000 })
  }
  // No dialog, no light.
  const closed = applyBuildCommand(context, opened, { kind: "cancel" })
  assert.equal(animation.frame(closed, 3000, { colors: "truecolor" }).dialogLight, undefined)
})

// --- A Commander back: the game's own line ----------------------------------------------------------

test("the round after she falls opens on her return, one line in the game's own voice", () => {
  const side = fixtureSide()
  playRound(side)
  keys(side, ENTER)
  const { state } = side.build
  assert.equal(side.build.round.round?.number, 3)
  assert.equal(state.popup, "dialog")
  const vasse = (side.build.round.field ?? []).find((entity) => entity.contentId === VASSE)
  assert.ok(vasse !== undefined, "she is not on round 3's map")
  assert.deepEqual(
    (side.build.round.scene ?? []).map((line) => [line.speaker, line.side, line.unit, line.text, line.focus?.tile]),
    [[null, null, null, "The Nexus Pulse restores Vasse beside the Nexus.", nexusTile(side.build.round)]],
  )
  // It looks at the Nexus that set her down beside it.
  const nexus = nexusTile(side.build.round)
  assert.ok(nexus !== null)
  assert.deepEqual(state.camera, centreOn(nexus, side.layout.viewport, terrain))
  // The game's own voice has no name: the border runs unbroken where a speaker's would be.
  const frame = compose(side, {}, "truecolor")
  const { box } = dialogBox(side)
  for (const x of [box.left + 2, box.left + 3]) {
    const cell = cellAt(frame, x, box.top)
    assert.deepEqual([cell.glyph, cell.style.fgRole, cell.style.inverse], [" ", "chrome.frame", true])
  }
  // The light is around the Nexus. Then the round, as it opened: the bottom line says how the last one went.
  const lit = Array.from({ length: frame.height }, (_, y) => Array.from({ length: frame.width }, (_, x) => cellAt(frame, x, y))).flat()
  assert.ok(lit.some((cell) => cell.style.seeThrough?.role === "fx.flash"), "no light around what the line looks at")
  keys(side, ENTER)
  assert.equal(side.build.state.popup, null)
  assert.match(bottomLineText(side), /^Round 2: [\w' ]+\. The Nexus Pulse deals a new hand: \[n\]\.$/)
  // Without scenes, the same round opens straight on the menu.
  const plain = fixtureSide(false)
  playRound(plain)
  keys(plain, ENTER)
  assert.equal(plain.build.state.popup, null)
  assert.deepEqual(side.build.state, plain.build.state)
})

test("the round after one with a scene opens without it; Restart is the battle from round 1, its opening lines and all", () => {
  const side = sceneSide()
  keys(side, ESC)
  playRound(side)
  keys(side, ENTER)
  assert.equal(side.build.state.pulseNumber, 2)
  assert.equal(side.build.state.popup, null)
  assert.equal(side.build.round.scene, undefined, "round 1's scene was carried into round 2")
  side.build.dispatch({ kind: "restart" })
  assert.equal(side.build.state.pulseNumber, 1)
  assert.equal(side.build.state.popup, "dialog")
  assert.equal(side.build.state.dialog?.line, 0)
})

test("a resize while the dialog is open: the camera it gives back fits the new view", () => {
  const side = sceneSide()
  const plain = sceneSide({ scenes: false })
  const viewport = buildLayout(MAXIMUM, terrain).viewport
  side.build.resize(viewport)
  plain.build.resize(viewport)
  keys(side, ENTER, ESC)
  assert.deepEqual([side.build.state.camera, side.build.state.cursor], [plain.build.state.camera, plain.build.state.cursor])
})

// --- Whether it was read ------------------------------------------------------------------------------

test("the Activity Logs say which lines were shown and where the rest was skipped, under their own filter", () => {
  const intro = { context: introContext(), play: STARTER_LEVEL.play }
  const skipped = runBuildPlaytest({ ...intro, steps: parseKeyScript("Enter Esc") })
  const dialog = (run: typeof skipped) =>
    run.activity
      .entries()
      .filter((entry) => entry.event.startsWith("dialog."))
      .map((entry) => [entry.event, entry.props])
  assert.deepEqual(dialog(skipped), [
    ["dialog.line", { round: 1, line: 1, of: 4, speaker: "Vasse" }],
    ["dialog.line", { round: 1, line: 2, of: 4, speaker: "Corvane" }],
    ["dialog.skip", { round: 1, line: 2, of: 4 }],
  ])
  const read = runBuildPlaytest({ ...intro, steps: parseKeyScript("Enter*4") })
  assert.deepEqual(
    dialog(read).map(([event]) => event),
    ["dialog.line", "dialog.line", "dialog.line", "dialog.line"],
    "reading to the end is not a skip",
  )
  const filter = ACTIVITY_FILTERS.find((each) => each.name === "Intro")
  assert.ok(filter !== undefined)
  assert.deepEqual(
    filteredEntries(skipped.activity.entries(), filter).map((entry) => entry.event).reverse(),
    ["dialog.line", "dialog.line", "dialog.skip"],
  )
})

test("the scripted playtest plays scenes as the game does: a script runs as before after one Esc", () => {
  // The starter map's round opens on its two lines; Esc skips them, and the menu's third row down is the Turret.
  const run = runBuildPlaytest({ steps: parseKeyScript("Esc Down*3 Space*4") })
  assert.equal(run.frames[0]?.state.popup, "dialog")
  assert.equal(run.frames[1]?.state.popup, null)
  const last = run.frames[run.frames.length - 1]
  assert.equal(last?.state.planned.length, 2)
  assert.match(frameToText(last?.frame ?? run.frames[0]!.frame), /Turret placed \(credits: 70\)/)
})

// --- The live game ------------------------------------------------------------------------------------

class FakeStdout extends EventEmitter {
  isTTY = true
  columns = 80
  rows = 24
  written = ""
  lastWrite = ""
  write(text: string): boolean {
    this.written += text
    this.lastWrite = text
    return true
  }
}

class FakeStdin extends EventEmitter {
  isTTY = true
  setRawMode(): this {
    return this
  }
  resume(): this {
    return this
  }
  pause(): this {
    return this
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

test("the game opens the starter map on its opening lines, and Enter reads on", async () => {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const exits: number[] = []
  const session = runBuildPhase({
    settings: { ...DEFAULT_SETTINGS, colors: "monochrome" },
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: (code) => {
      exits.push(code)
    },
    activity: activityLog(),
  })
  await sleep(40)
  assert.match(stdout.written, /A Skirmish on The starter map, seed 1:/)
  assert.match(stdout.written, /Line 1 of 2\./)
  stdin.emit("data", Buffer.from(ENTER))
  await sleep(40)
  assert.match(stdout.written, /Line 2 of 2\./)
  stdin.emit("data", Buffer.from(CTRL_C))
  assert.equal(await session, 0)
  assert.deepEqual(exits, [0])
})

// --- Her look in the Pulse ----------------------------------------------------------------------------

test("Vasse is drawn bold at full strength in her side's colour while a Pulse plays, at every colour depth", () => {
  assert.equal(drawnBold(registry.get(VASSE)), true)
  assert.equal(drawnBold(registry.get("unit.citizen.trooper")), false)
  assert.equal(drawnBold(registry.get("structure.citizen.barracks")), true)
  const side = sceneSide({ scenes: false })
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  side.build.advance(0)
  side.build.advance(400)
  const map = (layout: BuildLayout, frame: ReadonlyCellFrame) =>
    Array.from({ length: layout.viewport.height }, (_, row) =>
      Array.from({ length: layout.viewport.width }, (_, column) => ({
        cell: cellAt(frame, layout.origin.column + column, layout.origin.row + row),
      })),
    ).flat()
  for (const colors of COLOR_DEPTHS) {
    const frame = compose(side, {}, colors)
    const cells = map(side.layout, frame).map((entry) => entry.cell)
    const her = cells.filter((cell) => cell.glyph === "@")
    assert.equal(her.length, 1, `${colors}: ${her.length} of her`)
    const [cell] = her
    assert.ok(cell !== undefined)
    assert.deepEqual([cell.style.fgRole, cell.style.bold, cell.style.dim === true], ["player.a", true, false], colors)
    const resolved = resolveCell(cell, colors)
    assert.equal(resolved.bold, true, colors)
    assert.equal(resolved.dim, false, colors)
    assert.ok(resolved.sgr.includes(1), `${colors}: no bold in ${JSON.stringify(resolved.sgr)}`)
    // A trooper beside her is not.
    const trooper = cells.find((each) => each.glyph === "t")
    assert.equal(trooper?.style.bold, undefined, `${colors}: the squads are bold too`)
  }
})
