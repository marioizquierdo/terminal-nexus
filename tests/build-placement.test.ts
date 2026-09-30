// Gate 5I: placement juice (feedback F9). A building plays its own frames as it goes up, is lit as it
// finishes, and throws off a few sparks — all of it presentation, a pure function of the plan and the
// time since the placement, every number an Experiment. The claims here are made against an
// injected time, a number: nothing waits.

import { test } from "node:test"
import assert from "node:assert/strict"
import { CONTENT_ART, PLACEMENT_ART, artExtent } from "../src/content/art.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { footprintExtent, tilesOf } from "../src/grid/coords.ts"
import type { Coord } from "../src/grid/types.ts"
import { initialDebugFlags } from "../src/build/debug.ts"
import type { DebugFlags } from "../src/build/debug.ts"
import { cellForTile } from "../src/build/layout.ts"
import { visibleRange } from "../src/build/camera.ts"
import type { BuildState } from "../src/build/state.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import type { BuildPlaytest } from "../src/playtest/build.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import type { BuildCompositionInput } from "../src/view/build.ts"
import { BuildAnimation } from "../src/view/build-live.ts"
import { cellAt, frameToAnsi, frameToText } from "../src/view/frame.ts"
import type { ReadonlyCellFrame } from "../src/view/frame.ts"
import { paintOps } from "../src/view/backends/canvas.ts"
import { placementCell, placementRequest, placementRun, placementSchedule, placementTiming, removalSchedule } from "../src/view/placement.ts"
import type { PlacementClock, RemovalClock } from "../src/view/placement.ts"
import { CAPABILITY_MODES, RAINBOW_ROLES, rgbFor, sgrFor } from "../src/view/roles.ts"
import { entityGlyph } from "../src/view/theme.ts"

const FLAGS: DebugFlags = initialDebugFlags({})
const BARRACKS = "structure.citizen.barracks"
/** Arm the Barracks from the menu (the cursor opens on the Grid Nexus, so arming finds the nearest good
 *  spot beside it) and place it with Space. */
const PLACE_BARRACKS = "n 1 Down Space Space"

function placed(keys = PLACE_BARRACKS): { run: BuildPlaytest; state: BuildState } {
  const run = runBuildPlaytest({ steps: parseKeyScript(keys) })
  const last = run.frames[run.frames.length - 1]
  assert.ok(last !== undefined)
  return { run, state: last.state }
}

function lastPlacement(state: BuildState): BuildState["planned"][number] {
  const placement = state.planned[state.planned.length - 1]
  assert.ok(placement !== undefined, "nothing was placed")
  return placement
}

function compose(
  run: BuildPlaytest,
  state: BuildState,
  extra: Partial<BuildCompositionInput> = {},
  capability: (typeof CAPABILITY_MODES)[number] = "truecolor",
): ReadonlyCellFrame {
  return composeBuildFrame({ context: run.context, state, layout: run.layout, ...extra }, capability)
}

function withFlags(state: BuildState, flags: Partial<DebugFlags>): BuildState {
  return { ...state, debug: { ...state.debug, ...flags } }
}

/** The screen cells a placement's footprint is drawn on. */
function footprintCells(run: BuildPlaytest, state: BuildState, contentId: string, anchor: Coord): Coord[] {
  return tilesOf(anchor, FIXTURE_REGISTRY.get(contentId).footprint).map((tile) => cellForTile(run.layout, state.camera, tile))
}

// --- Content ---------------------------------------------------------------------------------------

test("every placement frame is exactly as big as its structure's footprint, and the three menu structures have their own", () => {
  for (const [contentId, frames] of Object.entries(PLACEMENT_ART)) {
    assert.ok(FIXTURE_REGISTRY.has(contentId), `PLACEMENT_ART draws "${contentId}", which no content declares`)
    assert.ok(frames.length > 0, `${contentId}'s placement frames are empty`)
    const shape = footprintExtent(FIXTURE_REGISTRY.get(contentId).footprint)
    frames.forEach((frame, index) => {
      assert.deepEqual(artExtent(frame), shape, `${contentId} frame ${index + 1} is not its footprint's size`)
      for (const row of frame) assert.equal(row.length, shape.width, `${contentId} frame ${index + 1} has a ragged row`)
    })
  }
  for (const contentId of [BARRACKS, "structure.bench.hatchery", "structure.bench.beamturret"]) {
    assert.ok(PLACEMENT_ART[contentId] !== undefined, `${contentId} has no authored placement frames`)
  }
})

test("a structure nobody drew frames for still goes up: footings, then its own rows from the ground", () => {
  for (const contentId of ["structure.citizen.nexus", "structure.ravel.den"]) {
    assert.equal(PLACEMENT_ART[contentId], undefined)
    const footprint = FIXTURE_REGISTRY.get(contentId).footprint
    const run = placementRun(contentId, footprint)
    const { width, height } = footprintExtent(footprint)
    assert.equal(run.length, height)
    assert.deepEqual(run[0], [" ".repeat(width), ".".repeat(width)])
    // The last frame before it finishes has its bottom row finished and footings above.
    const art = CONTENT_ART[contentId]
    assert.ok(art !== undefined)
    assert.deepEqual(run[1], [".".repeat(width), art[1]])
  }
})

// --- Frames, light, and the finished building --------------------------------------------------------

test("a placed Barracks plays footings, walls, roof beam, then stands finished, lit, and settles", () => {
  const { run, state } = placed()
  const placement = lastPlacement(state)
  assert.equal(placement.contentId, BARRACKS)
  const cells = footprintCells(run, state, BARRACKS, placement.anchor)
  const rowsAt = (elapsedMs: number): string[] => {
    const frame = compose(run, state, { placing: [{ ordinal: placement.ordinal, elapsedMs }] })
    const top = cells.slice(0, 3).map((c) => cellAt(frame, c.x, c.y).glyph).join("")
    const bottom = cells.slice(3).map((c) => cellAt(frame, c.x, c.y).glyph).join("")
    return [top, bottom]
  }
  const authored = PLACEMENT_ART[BARRACKS]
  assert.ok(authored !== undefined)
  const step = FLAGS.placeFramesMs / authored.length
  authored.forEach((frame, index) => {
    const [top, bottom] = rowsAt(index * step + 1)
    // A space in a frame is the ground showing through, so compare only what the frame stands up.
    ;[...(frame[0] ?? "")].forEach((glyph, x) => glyph !== " " && assert.equal(top?.[x], glyph))
    ;[...(frame[1] ?? "")].forEach((glyph, x) => glyph !== " " && assert.equal(bottom?.[x], glyph))
  })
  assert.deepEqual(rowsAt(FLAGS.placeFramesMs), ["[b]", "|_|"])

  // The scaffold is drawn plain; the finished building bold and, at the moment it finishes, lit
  // toward the theme's strongest ink; by the end of the glow the light is gone.
  const midFrames = compose(run, state, { placing: [{ ordinal: placement.ordinal, elapsedMs: step * 2 + 1 }] })
  const corner = cells[0]
  assert.ok(corner !== undefined)
  assert.notEqual(cellAt(midFrames, corner.x, corner.y).style.bold, true)
  const impact = compose(run, state, { placing: [{ ordinal: placement.ordinal, elapsedMs: FLAGS.placeFramesMs }] })
  const lit = cellAt(impact, corner.x, corner.y).style
  assert.equal(lit.bold, true)
  assert.deepEqual(lit.tint, { role: "fx.flash", amount: 1 })
  const settling = compose(run, state, { placing: [{ ordinal: placement.ordinal, elapsedMs: FLAGS.placeFramesMs + FLAGS.placeGlowMs / 2 }] })
  const half = cellAt(settling, corner.x, corner.y).style.tint
  assert.ok(half !== undefined && half.amount > 0 && half.amount < 1, "the light does not settle")
  // Once it is over it is exactly the still frame every test and playtest has always drawn.
  const over = compose(run, state, { placing: [{ ordinal: placement.ordinal, elapsedMs: placementTiming(FLAGS, false).totalMs }] })
  assert.equal(frameToAnsi(over, "truecolor"), frameToAnsi(compose(run, state), "truecolor"))
})

test("the rainbow walks the theme's own hues across the building and fades back to its colour", () => {
  const rainbow = { ...FLAGS, placeLight: "rainbow" as const }
  const footprint = FIXTURE_REGISTRY.get(BARRACKS).footprint
  const seen = new Set<string>()
  for (let t = rainbow.placeFramesMs; t < rainbow.placeFramesMs + rainbow.placeGlowMs; t += 20) {
    for (const offset of footprint) {
      const cell = placementCell(BARRACKS, footprint, offset, t, rainbow, false)
      assert.equal(cell.glyph, entityGlyph(BARRACKS, "A", offset))
      assert.ok(cell.tint !== undefined)
      assert.ok((RAINBOW_ROLES as readonly string[]).includes(cell.tint.role))
      seen.add(cell.tint.role)
    }
  }
  assert.equal(seen.size, RAINBOW_ROLES.length, "the rainbow skipped hues")
  const early = placementCell(BARRACKS, footprint, { x: 0, y: 0 }, rainbow.placeFramesMs + 10, rainbow, false).tint
  const late = placementCell(BARRACKS, footprint, { x: 0, y: 0 }, rainbow.placeFramesMs + rainbow.placeGlowMs - 10, rainbow, false).tint
  assert.ok(early !== undefined && late !== undefined && early.amount > late.amount)
})

test("lighting off, build animation off: the building is finished at once and unlit", () => {
  const footprint = FIXTURE_REGISTRY.get(BARRACKS).footprint
  const flags = { ...FLAGS, placeFramesMs: 0, placeLight: "off" as const }
  for (const t of [0, 50, 200]) {
    assert.deepEqual(placementCell(BARRACKS, footprint, { x: 1, y: 0 }, t, flags, false), { glyph: "b", bold: true })
  }
})

test("reduced motion: the finished building at once, no light, and the sparks a still mark at the corners", () => {
  const { run, state } = placed()
  const placement = lastPlacement(state)
  const at = (elapsedMs: number): ReadonlyCellFrame =>
    compose(run, state, { placing: [{ ordinal: placement.ordinal, elapsedMs }], reducedMotion: true })
  const timing = placementTiming(FLAGS, true)
  assert.equal(timing.framesMs, 0)
  const cells = footprintCells(run, state, BARRACKS, placement.anchor)
  for (const t of [0, 100, 300]) {
    const frame = at(t)
    assert.deepEqual(
      cells.map((c) => cellAt(frame, c.x, c.y).glyph).join(""),
      "[b]|_|",
      `reduced motion drew a frame at ${t} ms`,
    )
    for (const c of cells) assert.equal(cellAt(frame, c.x, c.y).style.tint, undefined)
  }
  // Nothing moves: the marks are the same at every instant of the glow.
  assert.equal(frameToText(at(0)), frameToText(at(timing.glowMs - 1)))
  assert.notEqual(frameToText(at(0)), frameToText(compose(run, state)), "no mark at all under reduced motion")
})

// --- Sparks --------------------------------------------------------------------------------------

test("sparks fly in the effects band and never land on a building: the corruption law holds", () => {
  const flags = { ...FLAGS, placeParticles: "many" as const }
  const { run, state: plain } = placed()
  const state = withFlags(plain, flags)
  const placement = lastPlacement(state)
  const structures = [...run.context.standing, ...state.planned].flatMap((s) => footprintCells(run, state, s.contentId, s.anchor))
  let sparks = 0
  const timing = placementTiming(flags, false)
  for (let t = 0; t < timing.totalMs; t += 10) {
    const frame = compose(run, state, { placing: [{ ordinal: placement.ordinal, elapsedMs: t }] })
    const still = compose(run, state)
    for (const c of structures) {
      const role = cellAt(frame, c.x, c.y).style.fgRole
      assert.ok(role === undefined || role === "player.a" || role.startsWith("terrain."), `a spark replaced a building at ${t} ms`)
    }
    for (let i = 0; i < frame.cells.length; i += 1) {
      const role = frame.cells[i]?.style.fgRole
      if (role === "fx.critical" || role === "fx.debris") {
        sparks += 1
        assert.notDeepEqual(frame.cells[i], still.cells[i])
      }
    }
  }
  assert.ok(sparks > 0, "no spark was ever drawn")
})

test("a placement's sparks are a hash of which placement it is, never of when it happened", () => {
  const { run, state } = placed()
  const placement = lastPlacement(state)
  const at = (elapsedMs: number, ordinal = placement.ordinal): string =>
    frameToText(compose(run, { ...state, planned: state.planned.map((p) => (p === placement ? { ...p, ordinal } : p)) }, { placing: [{ ordinal, elapsedMs }] }))
  const t = FLAGS.placeFramesMs + 120
  // Placed at two different moments of the live clock, drawn at the same time since placement.
  const early = new BuildAnimation()
  early.frame({ ...state, planned: state.planned.filter((p) => p !== placement) }, 0)
  const late = new BuildAnimation()
  late.frame({ ...state, planned: state.planned.filter((p) => p !== placement) }, 50_000)
  early.frame(state, 1_000)
  late.frame(state, 91_000)
  const fromEarly = early.frame(state, 1_000 + t).placing
  const fromLate = late.frame(state, 91_000 + t).placing
  assert.deepEqual(fromEarly, fromLate)
  assert.equal(at(t), at(t))
  // A different placement — another ordinal — scatters differently.
  assert.notEqual(at(t), at(t, placement.ordinal + 7))
})

// --- On the presentation toolkit ---------------------------------------------------------------------

test("a placement is one play on its track: its frames, then light and sparks as follow-ups at their end", () => {
  const footprint = FIXTURE_REGISTRY.get(BARRACKS).footprint
  const placement = { ordinal: 3, contentId: BARRACKS, anchor: { x: 10, y: 4 } }
  const request = placementRequest(placement, footprint, FLAGS, false)
  assert.equal(request.policy, "replace")
  assert.equal(request.animation.durationMs, FLAGS.placeFramesMs)
  assert.deepEqual(request.animation.frames.map((frame) => frame.rows), PLACEMENT_ART[BARRACKS])
  const schedule = placementSchedule(placement, footprint, FLAGS, false)
  const timing = placementTiming(FLAGS, false)
  assert.deepEqual(
    schedule.effects.map((effect) => [effect.recipe, effect.band, effect.startMs, effect.durationMs]),
    [
      ["fx.light.flash", "highlights", timing.framesMs, timing.glowMs],
      ["fx.sparks.burst", "effects", timing.framesMs, timing.glowMs],
    ],
  )
  assert.equal(schedule.settlesAtMs, timing.totalMs)
  // Reduced motion: no frames, no light — the sparks' still marks from the moment it is placed.
  const reduced = placementSchedule(placement, footprint, FLAGS, true)
  assert.deepEqual(reduced.effects.map((effect) => [effect.recipe, effect.startMs]), [["fx.sparks.burst", 0]])
  assert.equal(reduced.settlesAtMs, placementTiming(FLAGS, true).totalMs)
  // Everything off: nothing to schedule, settled at once.
  const off = { ...FLAGS, placeFramesMs: 0, placeLight: "off" as const, placeParticles: "off" as const }
  assert.equal(placementSchedule(placement, footprint, off, false).settlesAtMs, 0)
})

test("the live loop stops when the track settles, whether or not it knows the footprint", () => {
  const { run, state: before } = placed("n 1 Down*2 Space")
  const { state: after } = placed()
  const footprintOf = (contentId: string) => run.context.registry.get(contentId).footprint
  for (const options of [{}, { footprintOf }]) {
    const animation = new BuildAnimation()
    animation.frame(before, 0, options)
    const first = animation.frame(after, 1_000, options)
    assert.equal(first.busyUntil, 1_000 + placementTiming(FLAGS, false).totalMs)
  }
})

// --- The live loop's clock -------------------------------------------------------------------------

test("the live loop times each placement from the frame that first drew it, and stops when it settles", () => {
  const { state: before } = placed("n 1 Down Space")
  const { state: after } = placed()
  const placement = lastPlacement(after)
  const animation = new BuildAnimation()
  assert.equal(animation.frame(before, 0).placing, undefined)
  const first = animation.frame(after, 1_000)
  assert.deepEqual(first.placing, [{ ordinal: placement.ordinal, elapsedMs: 0 }])
  const total = placementTiming(FLAGS, false).totalMs
  assert.equal(first.busyUntil !== null && first.busyUntil >= 1_000 + total, true)
  assert.deepEqual(animation.frame(after, 1_300).placing, [{ ordinal: placement.ordinal, elapsedMs: 300 }])
  const done = animation.frame(after, 1_000 + total)
  assert.equal(done.placing, undefined)
  assert.equal(done.busyUntil, null)
})

test("whatever is already planned when the screen first draws is not animated", () => {
  const { state } = placed()
  const live = new BuildAnimation().frame(state, 5_000)
  assert.equal(live.placing, undefined)
})

test("undo, Backspace, or another placement mid-animation is correct at once: no ghost glyphs", () => {
  const { run, state: armed } = placed("n 1 Down Space")
  const { state: one } = placed()
  const first = lastPlacement(one)
  const animation = new BuildAnimation()
  animation.frame(armed, 0)
  animation.frame(one, 100)

  // Another placement while the first is still going up: two clocks, each its own time.
  const { state: two } = placed(`${PLACE_BARRACKS} Down Space Space`)
  const second = lastPlacement(two)
  assert.notEqual(second.ordinal, first.ordinal)
  const both = animation.frame(two, 250)
  assert.deepEqual(both.placing, [
    { ordinal: first.ordinal, elapsedMs: 150 },
    { ordinal: second.ordinal, elapsedMs: 0 },
  ])

  // Undo the second mid-animation: its clock is gone and the frame is exactly the one-building plan
  // at the same instant, glyph for glyph and style for style.
  const undone: BuildState = { ...two, planned: two.planned.slice(0, -1) }
  const live = animation.frame(undone, 300)
  assert.deepEqual(live.placing, [{ ordinal: first.ordinal, elapsedMs: 200 }])
  const drawn = compose(run, undone, { placing: live.placing as PlacementClock[] })
  // Through the same camera: arming the second moved the cursor, and the view followed it.
  const expected = compose(run, { ...one, camera: undone.camera }, { placing: [{ ordinal: first.ordinal, elapsedMs: 200 }] })
  const secondCells = footprintCells(run, two, second.contentId, second.anchor)
  for (const c of secondCells) assert.deepEqual(cellAt(drawn, c.x, c.y), cellAt(expected, c.x, c.y))

  // A stale clock for a placement no longer planned draws nothing of it.
  const stale = compose(run, undone, { placing: [{ ordinal: second.ordinal, elapsedMs: 10 }] })
  assert.equal(frameToText(stale), frameToText(compose(run, undone)))

  // Removing the first too (Backspace): nothing animates, nothing is left.
  const empty: BuildState = { ...undone, planned: [] }
  assert.equal(animation.frame(empty, 320).placing, undefined)
  // Put back later, it starts over rather than resuming.
  animation.frame(one, 2_000)
  assert.deepEqual(animation.frame(one, 2_010).placing, [{ ordinal: first.ordinal, elapsedMs: 10 }])
})

// --- Removing a planned building sparks too (feedback F33) ------------------------------------------

/** How many cells a frame draws in the sparks' own colours. */
function sparkCells(frame: ReadonlyCellFrame): number {
  return frame.cells.filter((cell) => cell.style.fgRole === "fx.critical" || cell.style.fgRole === "fx.debris").length
}

test("undo and Backspace both throw the placement's sparks where the building stood, timed from the first frame without it", () => {
  const { run, state: one } = placed()
  const placement = lastPlacement(one)
  const glow = placementTiming(FLAGS, false).glowMs
  for (const [how, keys] of [
    ["undo", `${PLACE_BARRACKS} u`],
    // Tab gives the map back in plain navigation, the cursor still on the building just placed.
    ["Backspace", `${PLACE_BARRACKS} Tab Bksp`],
  ] as const) {
    const { state: gone } = placed(keys)
    assert.equal(gone.planned.length, 0, `${how} did not remove it`)
    const animation = new BuildAnimation()
    animation.frame(one, 0) // already planned when the screen first drew: not animating
    const first = animation.frame(gone, 1_000)
    assert.deepEqual(first.removing, [{ ...placement, elapsedMs: 0 }], `${how}: no sparks`)
    assert.equal(first.busyUntil, 1_000 + glow)
    assert.deepEqual(animation.frame(gone, 1_100).removing, [{ ...placement, elapsedMs: 100 }])
    const done = animation.frame(gone, 1_000 + glow)
    assert.equal(done.removing, undefined, `${how}: the sparks outlived the glow`)
    assert.equal(done.busyUntil, null)
  }
  // Drawn: sparks around the empty footprint, and nothing at all once they settle — the still frame.
  const { state: gone } = placed(`${PLACE_BARRACKS} u`)
  const removing = (elapsedMs: number): RemovalClock[] => [{ ...placement, elapsedMs }]
  let sparks = 0
  for (let t = 0; t < glow; t += 10) sparks += sparkCells(compose(run, gone, { removing: removing(t) }))
  assert.ok(sparks > 0, "no spark was ever drawn for a removal")
  assert.equal(frameToText(compose(run, gone, { removing: removing(glow) })), frameToText(compose(run, gone)))
  // The same recipe and timing as a placement's sparks — "Particles" and "Glow time" — from the moment
  // it went, with a scatter of its own.
  const footprint = FIXTURE_REGISTRY.get(BARRACKS).footprint
  const schedule = removalSchedule(placement, footprint, FLAGS, false)
  assert.deepEqual(
    schedule.effects.map((effect) => [effect.recipe, effect.band, effect.startMs, effect.durationMs]),
    [["fx.sparks.burst", "effects", 0, glow]],
  )
  assert.equal(schedule.settlesAtMs, glow)
  const placing = placementSchedule(placement, footprint, FLAGS, false).effects.find((e) => e.recipe === "fx.sparks.burst")
  assert.equal(schedule.effects[0]?.params?.count, placing?.params?.count)
  assert.notEqual(schedule.effects[0]?.params?.key, placing?.params?.key)
})

test("removal sparks follow the Experiments: off when Particles is, a still mark under reduced motion", () => {
  const { run, state: one } = placed()
  const placement = lastPlacement(one)
  const footprint = FIXTURE_REGISTRY.get(BARRACKS).footprint
  const off = { ...FLAGS, placeParticles: "off" as const }
  assert.deepEqual(removalSchedule(placement, footprint, off, false).effects, [])
  const { state: gone } = placed(`${PLACE_BARRACKS} u`)
  const animation = new BuildAnimation()
  animation.frame(withFlags(one, off), 0)
  const live = animation.frame(withFlags(gone, off), 1_000)
  assert.equal(live.removing, undefined)
  assert.equal(live.busyUntil, null)
  // Reduced motion: the burst's own still form, the same at every instant of the glow.
  const glow = placementTiming(FLAGS, true).glowMs
  const at = (elapsedMs: number): string =>
    frameToText(compose(run, gone, { removing: [{ ...placement, elapsedMs }], reducedMotion: true }))
  assert.equal(at(0), at(glow - 1))
  assert.notEqual(at(0), frameToText(compose(run, gone)), "no mark at all under reduced motion")
})

test("removal sparks are presentation only: the plan is the same with them on or off", () => {
  const many = placed(`n 1 d Down*5 Right Esc Down Space Space u`)
  const none = placed(`n 1 d Down*5 Left Esc Down Space Space u`)
  assert.equal(many.state.debug.placeParticles, "many")
  assert.equal(none.state.debug.placeParticles, "off")
  assert.deepEqual(many.state.planned, none.state.planned)
  assert.deepEqual({ ...many.state, debug: none.state.debug, status: none.state.status }, none.state)
})

// --- Presentation only ---------------------------------------------------------------------------

test("the plan is identical with every placement effect on or off", () => {
  // Build animation to 900, lighting to rainbow, particles to many, glow off — by an Experiment's own keys,
  // past the focus arrow, the cursor blink and the card reveal at the top of the list.
  const tuned = placed("n 1 d Down*3 Right*3 Down Right Down Right Down Left*3 Esc Down Space Space")
  const plain = placed()
  assert.deepEqual(tuned.state.debug.placeFramesMs, 900)
  assert.deepEqual(tuned.state.debug.placeLight, "rainbow")
  assert.deepEqual(tuned.state.debug.placeParticles, "many")
  assert.deepEqual(tuned.state.debug.placeGlowMs, 0)
  assert.deepEqual(tuned.state.planned, plain.state.planned)
  assert.equal(tuned.state.cursor.x, plain.state.cursor.x)
  assert.equal(tuned.state.cursor.y, plain.state.cursor.y)
})

test("every capability tier draws the same glyphs and styles mid-animation; only the resolution differs", () => {
  const { run, state } = placed()
  const placement = lastPlacement(state)
  for (const t of [0, 200, 460, 600]) {
    const frames = CAPABILITY_MODES.map((capability) =>
      compose(run, withFlags(state, { placeLight: "rainbow" }), { placing: [{ ordinal: placement.ordinal, elapsedMs: t }] }, capability),
    )
    for (const frame of frames.slice(1)) assert.deepEqual(frame, frames[0])
  }
})

test("keyboard and mouse placements animate identically", () => {
  const keyboard = placed("n 1 1 Enter")
  const cursor = keyboard.state.cursor
  const mouse = placed(`n 1 1 click:${cursor.x},${cursor.y} click:${cursor.x},${cursor.y}`)
  assert.deepEqual(mouse.state.planned, keyboard.state.planned)
  const ordinal = lastPlacement(keyboard.state).ordinal
  for (const t of [0, 250, 500]) {
    const placing = [{ ordinal, elapsedMs: t }]
    // Where the keyboard is afterwards (and so the cursor) is how each got there, not what was built.
    const a = compose(keyboard.run, { ...keyboard.state, focus: "menu" }, { placing })
    const b = compose(mouse.run, { ...mouse.state, focus: "menu" }, { placing })
    // The building and three tiles around it, wherever each view has them: the clicks may have
    // moved the camera, and the status line says how each got there.
    const anchor = lastPlacement(keyboard.state).anchor
    for (let dy = -3; dy <= 5; dy += 1) {
      for (let dx = -3; dx <= 6; dx += 1) {
        const tile = { x: anchor.x + dx, y: anchor.y + dy }
        const inView = (s: BuildState): boolean => {
          const r = visibleRange(s.camera, s.viewport)
          return tile.x >= r.firstX && tile.x <= r.lastX && tile.y >= r.firstY && tile.y <= r.lastY
        }
        if (!inView(keyboard.state) || !inView(mouse.state)) continue
        const ca = cellForTile(keyboard.run.layout, keyboard.state.camera, tile)
        const cb = cellForTile(mouse.run.layout, mouse.state.camera, tile)
        assert.deepEqual(cellAt(b, cb.x, cb.y), cellAt(a, ca.x, ca.y), `tile ${tile.x},${tile.y} at ${t} ms`)
      }
    }
  }
})

// --- The light, resolved per tier ----------------------------------------------------------------

test("a tint is a real blend at 256 colours and truecolor, a step at 16, and nothing in monochrome", () => {
  const half = { role: "fx.flash" as const, amount: 0.5 }
  const own = rgbFor("player.a", "truecolor", "dark")
  const flash = rgbFor("fx.flash", "truecolor", "dark")
  const blended = rgbFor("player.a", "truecolor", "dark", 0, half)
  for (let i = 0; i < 3; i += 1) assert.equal(blended[i], Math.round(((own[i] ?? 0) + (flash[i] ?? 0)) / 2))
  assert.deepEqual(sgrFor("player.a", "truecolor", "dark", 0, half), [38, 2, ...blended])
  assert.notDeepEqual(sgrFor("player.a", "color256", "dark", 0, half), sgrFor("player.a", "color256", "dark"))
  assert.deepEqual(sgrFor("player.a", "color16", "dark", 0, { role: "fx.flash", amount: 0.49 }), sgrFor("player.a", "color16", "dark"))
  assert.deepEqual(sgrFor("player.a", "color16", "dark", 0, half), sgrFor("fx.flash", "color16", "dark"))
  assert.deepEqual(sgrFor("player.a", "monochrome", "dark", 0, half), [])
  // OpenTUI and the canvas simulate 16 colours the same way the terminal does.
  assert.deepEqual(rgbFor("player.a", "color16", "dark", 0, half), rgbFor("fx.flash", "color16", "dark"))
  // A zero tint is no tint at all.
  assert.deepEqual(sgrFor("player.a", "truecolor", "dark", 0, { role: "fx.flash", amount: 0 }), sgrFor("player.a", "truecolor", "dark"))
  // The light theme's strongest ink is dark, so "light" there pulls toward it rather than toward white.
  const lightOwn = rgbFor("player.a", "truecolor", "light")
  const lightLit = rgbFor("player.a", "truecolor", "light", 0, { role: "fx.flash", amount: 1 })
  assert.ok(lightLit[0] < lightOwn[0])
})

test("the browser page's canvas paints the light the terminal shows", () => {
  const { run, state } = placed()
  const placement = lastPlacement(state)
  const frame = compose(run, state, { placing: [{ ordinal: placement.ordinal, elapsedMs: FLAGS.placeFramesMs }] })
  const corner = footprintCells(run, state, BARRACKS, placement.anchor)[0]
  assert.ok(corner !== undefined)
  const op = paintOps(frame, "truecolor", "dark").find((o) => o.x === corner.x && o.y === corner.y)
  assert.ok(op !== undefined)
  const [r, g, b] = rgbFor("player.a", "truecolor", "dark", 0, { role: "fx.flash", amount: 1 })
  assert.equal(op.foreground, `rgb(${r},${g},${b})`)
})

// --- Frame budget ----------------------------------------------------------------------------------

test("with every effect at its heaviest, the Build Phase still draws well inside a frame", () => {
  // Three buildings going up at once, many sparks, the rainbow, at the largest view, through the
  // truecolor encoder — the live loop's whole per-frame cost. The live loop asks for a frame every
  // 16 ms; the budget asserted is that p95 stays under it, and the measurement is what the gate
  // report records.
  const run = runBuildPlaytest({ steps: parseKeyScript(`${PLACE_BARRACKS} Down Space Space Down Space Space`), columns: 104, rows: 32 })
  const state = withFlags(run.frames[run.frames.length - 1]!.state, { placeParticles: "many", placeLight: "rainbow" })
  assert.equal(state.planned.length, 3)
  const samples: number[] = []
  for (let frame = 0; frame < 200; frame += 1) {
    const t = (frame * 5) % 850
    const placing = state.planned.map((p, index) => ({ ordinal: p.ordinal, elapsedMs: (t + index * 120) % 850 }))
    const start = performance.now()
    frameToAnsi(composeBuildFrame({ context: run.context, state, layout: run.layout, placing }, "truecolor"), "truecolor")
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  const p95 = samples[Math.floor(samples.length * 0.95)] ?? 0
  assert.ok(p95 < 16, `p95 ${p95.toFixed(2)} ms is over the live loop's 16 ms frame`)
  console.log(`# build frame with placement juice: p50 ${samples[100]?.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms`)
})
