// Every popup's border is alive (owner, 2026-09-30): it **breathes** ("just relaxing turning
// a bit lighter and darker to create dynamism"; "This subtle version works well for all popups
// because it is very unobtrusive"), and a popup may first **open with a double flash** (the Battle Round screen did,
// until the rally point replaced it: "an initial double flash pulse, with more contrast range, that works as a
// highlight, then it stays on the default pulse animation"; no popup opens with one today, and the flash's timing now
// paces the rally point's call). An opening, from a table, then the breath: presentation alone, a pure
// function of the time since the popup opened, drawn at rest in every still frame, still under reduced
// motion and in monochrome, and the frame timer runs for it only while a popup is open.

import { testBase } from "./starter-fixture.ts"
import { test } from "node:test"
import assert from "node:assert/strict"
import { popupSpec, placePopup } from "../src/build/popup.ts"
import type { BuildState } from "../src/build/state.ts"
import type { Popup } from "../src/build/types.ts"
import type { PopupBorder, PopupBreath } from "../src/view/build.ts"
import {
  BREATH_DEPTH,
  POPUP_FLASH,
  POPUP_OPENINGS,
  breathLevel,
  breathStyle,
  flashLengthMs,
  flashLevel,
  popupBorderStyle,
} from "../src/view/build-popup.ts"
import type { PopupFlash } from "../src/view/build-popup.ts"
import {
  BREATH_FRAME_MS,
  BuildAnimation,
  FRAME_MS,
  livePresentation,
  nextFrameDelay,
  popupBorderEffect,
} from "../src/view/build-live.ts"
import type { Cell, ReadonlyCellFrame } from "../src/view/frame.ts"
import { cellAt } from "../src/view/frame.ts"
import type { ColorDepth, Theme } from "../src/view/roles.ts"
import { resolveCell } from "../src/view/roles.ts"
import { TUNING } from "../src/build/tuning.ts"
import { ESC, buildSide, changedCells, compose, keys } from "./build-helpers.ts"
import type { Side } from "./build-helpers.ts"

const LENGTH = 2000
const OPENING = flashLengthMs(POPUP_FLASH)

/** A Build Phase with the game menu open, as `q` leaves it: a popup that breathes. */
function gameMenu(experiments: Readonly<{ popupPulseMs?: number }> = {}): Side {
  const side = buildSide({ context: { ...testBase(), experiments } })
  keys(side, "q")
  assert.equal(side.build.state.popup, "game-menu")
  return side
}

/** Every popup there is, and the state that shows it — a message needs its words. */
const EVERY_POPUP: readonly Popup[] = ["nexus-powers", "game-menu", "settings", "export", "message", "controls", "activity-logs"]
const showing = (state: BuildState, popup: Popup): BuildState => ({
  ...state,
  popup,
  popupHighlight: 0,
  message: popup === "message" ? { title: "A MESSAGE", text: "Something to read once." } : null,
})

/** The cells of the open popup's border, less its title — what moves. */
function borderCells(side: Side, frame: ReadonlyCellFrame, state: BuildState = side.build.state): Readonly<{ x: number; y: number; cell: Cell }>[] {
  const spec = popupSpec(side.context, state)
  assert.ok(spec !== null)
  const { box } = placePopup(side.layout, spec)
  const cells: { x: number; y: number; cell: Cell }[] = []
  for (let y = box.top; y <= box.bottom; y += 1) {
    for (let x = box.left; x <= box.right; x += 1) {
      const edge = y === box.top || y === box.bottom || x === box.left || x === box.right
      const cell = cellAt(frame, x, y)
      if (edge && cell.style.fgRole === "chrome.frame") cells.push({ x, y, cell })
    }
  }
  assert.ok(cells.length > 20, "no border found")
  return cells
}

const breath = (elapsedMs: number, lengthMs = LENGTH): PopupBreath => ({ elapsedMs, lengthMs })
/** A border that only breathes, as every popup's does. */
const breathing = (elapsedMs: number, breathMs = LENGTH): PopupBorder => ({ elapsedMs, opening: null, breathMs })
/** A border that opens with the flash, then breathes. */
const opening = (elapsedMs: number, flash: PopupFlash = POPUP_FLASH): PopupBorder => ({ elapsedMs, opening: flash, breathMs: LENGTH })

/** A resolved colour's brightness, the three channels summed. */
const brightness = (cell: Cell, colors: ColorDepth, theme: Theme): number => {
  const fill = resolveCell(cell, colors, theme).background
  assert.ok(fill !== null, "an inverse border cell has a fill")
  return fill[0] + fill[1] + fill[2]
}

/** How strongly the border stands against the ground at this instant: brighter on a dark theme, darker on
 *  a light one. */
const strength = (side: Side, border: PopupBorder | undefined, colors: ColorDepth, theme: Theme): number => {
  const frame = compose(side, border === undefined ? {} : { popupBorder: border }, colors)
  const value = brightness((borderCells(side, frame)[3] as { cell: Cell }).cell, colors, theme)
  return theme === "dark" ? value : -value
}

// --- The view: a pure function of the time -------------------------------------------------------------

test("a still frame draws every popup's border at rest: inverse, in the frame's role, nothing more", () => {
  const side = buildSide()
  for (const popup of EVERY_POPUP) {
    const state = showing(side.build.state, popup)
    for (const { cell } of borderCells(side, compose(side, { state }, "truecolor"), state)) {
      // A scroll bar's two ends are bold; nothing else is added.
      const { bold: _bold, ...style } = cell.style
      assert.deepEqual(style, { fgRole: "chrome.frame", inverse: true }, popup)
    }
  }
})

test("the same border clock draws the same cells, however the frame was reached", () => {
  const side = gameMenu()
  for (const elapsed of [0, 40, OPENING / 2, OPENING + 333, 5000]) {
    assert.deepEqual(compose(side, { popupBorder: opening(elapsed) }, "truecolor"), compose(side, { popupBorder: opening(elapsed) }, "truecolor"))
  }
  // The live loop: one that drew every frame and one that jumped straight there agree.
  const everyFrame = new BuildAnimation()
  const jumped = new BuildAnimation()
  everyFrame.frame(side.build.state, 0)
  jumped.frame(side.build.state, 0)
  for (let now = 0; now <= 1500; now += FRAME_MS) everyFrame.frame(side.build.state, now)
  assert.deepEqual(everyFrame.frame(side.build.state, 1500).popupBorder, jumped.frame(side.build.state, 1500).popupBorder)
})

test("over one breath the border turns lighter, back to rest, darker, and back to rest — and nothing else changes", () => {
  const side = gameMenu()
  const rest = compose(side, {}, "truecolor")
  const border = new Set(borderCells(side, rest).map(({ x, y }) => `${x},${y}`))
  const at = (elapsedMs: number) => compose(side, { popupBorder: breathing(elapsedMs) }, "truecolor")
  // The quarter points: lightest, at rest half way, darkest, at rest at the end.
  assert.deepEqual(breathStyle(breath(LENGTH / 4)), { tint: { role: "chrome.title", amount: BREATH_DEPTH.lighter } })
  assert.deepEqual(breathStyle(breath(LENGTH / 2)), {})
  assert.deepEqual(breathStyle(breath((3 * LENGTH) / 4)), { fade: BREATH_DEPTH.darker })
  assert.deepEqual(popupBorderStyle(breathing(LENGTH / 4)), breathStyle(breath(LENGTH / 4)), "a border that only breathes is its breath")
  assert.deepEqual(at(0), rest, "the breath does not start at rest")
  assert.deepEqual(at(LENGTH / 2), rest, "half way is not at rest")
  assert.deepEqual(at(LENGTH), rest, "the breath does not return to rest")
  assert.deepEqual(at(LENGTH + LENGTH / 4), at(LENGTH / 4), "the next breath is not the same as the first")
  for (const elapsed of [LENGTH / 8, LENGTH / 4, (5 * LENGTH) / 8, (3 * LENGTH) / 4]) {
    const changed = changedCells(at(elapsed), rest)
    assert.ok(changed.length > 0, `${elapsed} ms: nothing breathes`)
    for (const { x, y, cell, was } of changed) {
      assert.ok(border.has(`${x},${y}`), `${elapsed} ms: ${x},${y} is not the border — the title, the shadow or the inside moved`)
      assert.equal(cell.glyph, was.glyph, "a breath changed a glyph")
    }
    assert.equal(changed.length, border.size, `${elapsed} ms: not every border cell breathes`)
  }
  // Smooth: never more than a small step between two frames the live loop draws.
  for (let elapsed = 0; elapsed < LENGTH; elapsed += BREATH_FRAME_MS) {
    assert.ok(Math.abs(breathLevel(breath(elapsed + BREATH_FRAME_MS)) - breathLevel(breath(elapsed))) < 0.2, `${elapsed} ms: a jolt`)
  }
})

test("lighter and darker are against the ground on both themes, at 256 colours and millions", () => {
  const side = gameMenu()
  for (const colors of ["truecolor", "color256"] as const) {
    for (const theme of ["dark", "light"] as const) {
      const rest = strength(side, undefined, colors, theme)
      const stronger = strength(side, breathing(LENGTH / 4), colors, theme)
      const softer = strength(side, breathing((3 * LENGTH) / 4), colors, theme)
      assert.ok(stronger > rest, `${colors} ${theme}: the stronger half is not stronger (${stronger} vs ${rest})`)
      assert.ok(softer < rest, `${colors} ${theme}: the softer half is not softer (${softer} vs ${rest})`)
    }
  }
})

test("in monochrome a breath cannot show, so the border does not flicker at all", () => {
  const side = gameMenu()
  for (const theme of ["dark", "light"] as const) {
    const rest = resolveCell((borderCells(side, compose(side, {}, "monochrome"))[3] as { cell: Cell }).cell, "monochrome", theme)
    for (let elapsed = 0; elapsed <= LENGTH; elapsed += 25) {
      const frame = compose(side, { popupBorder: breathing(elapsed) }, "monochrome")
      for (const { cell } of borderCells(side, frame)) {
        assert.deepEqual(resolveCell(cell, "monochrome", theme), rest, `monochrome ${theme} at ${elapsed} ms`)
      }
    }
  }
})

// --- A popup's opening: a double flash -----------------------------------------------------------------

test("the opening is two flashes, each far stronger than the breath ever gets, with rest between them", () => {
  // Two peaks: count the rises through half height, frame by frame.
  let peaks = 0
  let above = false
  let highest = 0
  for (let elapsed = 0; elapsed < OPENING; elapsed += 1) {
    const level = flashLevel(POPUP_FLASH, elapsed)
    if (level >= 0.5 && !above) peaks += 1
    above = level >= 0.5
    highest = Math.max(highest, level)
  }
  assert.equal(peaks, 2, "not a double flash")
  assert.ok(highest > 0.99, "a flash never reaches its height")
  // Between the two, a moment at rest.
  assert.equal(flashLevel(POPUP_FLASH, POPUP_FLASH.flashMs + POPUP_FLASH.gapMs / 2), 0, "no rest between the flashes")
  assert.ok(POPUP_FLASH.peak >= 1.5 * BREATH_DEPTH.lighter, "the flash's height is not well past the breath's")
  // On screen, against the ground: each flash's height is stronger than the breath's lightest by a clear
  // margin, on both themes, at 256 colours and millions.
  const side = gameMenu()
  const heights = [0, 1].map((flash) => {
    const start = flash * (POPUP_FLASH.flashMs + POPUP_FLASH.gapMs)
    let best = start
    for (let elapsed = start; elapsed < start + POPUP_FLASH.flashMs; elapsed += 1) {
      if (flashLevel(POPUP_FLASH, elapsed) > flashLevel(POPUP_FLASH, best)) best = elapsed
    }
    return best
  })
  for (const colors of ["truecolor", "color256"] as const) {
    for (const theme of ["dark", "light"] as const) {
      const rest = strength(side, undefined, colors, theme)
      const breathHeight = strength(side, breathing(LENGTH / 4), colors, theme) - rest
      for (const at of heights) {
        const flashHeight = strength(side, opening(at), colors, theme) - rest
        assert.ok(flashHeight > 1.5 * breathHeight, `${colors} ${theme} at ${at} ms: the flash (${flashHeight}) is not clearly past the breath (${breathHeight})`)
      }
    }
  }
})

test("the flash hands over to the breath without a jump: both at rest where they meet, the breath from its start", () => {
  assert.deepEqual(popupBorderStyle(opening(0)), {}, "the flash does not start at rest")
  assert.deepEqual(popupBorderStyle(opening(OPENING)), {}, "the breath does not start at rest")
  // The last frames of the flash and the first of the breath are all within a small step of rest.
  for (const elapsed of [OPENING - FRAME_MS, OPENING - 1, OPENING + 1, OPENING + FRAME_MS]) {
    const style = popupBorderStyle(opening(elapsed))
    const amount = style.tint?.amount ?? style.fade ?? 0
    assert.ok(amount < 0.1, `${elapsed} ms: ${amount} from rest at the handover`)
  }
  // After it, the breath exactly as every other popup breathes, begun at rest when the flash ended.
  for (const after of [1, LENGTH / 4, LENGTH / 2 + 7, (3 * LENGTH) / 4, 3 * LENGTH + 11]) {
    assert.deepEqual(popupBorderStyle(opening(OPENING + after)), breathStyle(breath(after)), `${after} ms into the breath`)
  }
  // And smooth across the whole of it at the live loop's own frame rate — the flash's strike is the one
  // fast change, a few frames long.
  let jumps = 0
  for (let elapsed = 0; elapsed < OPENING + LENGTH; elapsed += FRAME_MS) {
    const a = popupBorderStyle(opening(elapsed)).tint?.amount ?? 0
    const b = popupBorderStyle(opening(elapsed + FRAME_MS)).tint?.amount ?? 0
    if (Math.abs(b - a) > 0.25) jumps += 1
  }
  assert.ok(jumps <= 4, `${jumps} big steps: the flash flickers`)
})

test("which popup opens with what is a table: none opens with a flash since the Battle Round screen went", () => {
  assert.deepEqual(POPUP_OPENINGS, {})
  const side = buildSide()
  for (const popup of EVERY_POPUP) {
    const effect = popupBorderEffect(showing(side.build.state, popup), false)
    assert.ok(effect !== null, `${popup}: still`)
    assert.equal(effect.breathMs, LENGTH, `${popup}: does not breathe`)
    assert.equal(effect.opening, null, `${popup}: the wrong opening`)
  }
  assert.equal(popupBorderEffect(side.build.state, false), null, "a border without a popup")
})

// --- The live loop: when it moves, and the frame timer -------------------------------------------------

test("every popup breathes in the live loop, from the frame that first shows it, at a modest frame rate", () => {
  const side = buildSide()
  for (const popup of EVERY_POPUP) {
    const state = showing(side.build.state, popup)
    const animation = new BuildAnimation()
    animation.frame(side.build.state, -10_000)
    const openingMs = 0
    const first = animation.frame(state, 0)
    assert.deepEqual(first.popupBorder?.elapsedMs, 0, `${popup}: the first frame showing it does not start its border`)
    const at = openingMs + LENGTH / 4
    const later = animation.frame(state, at)
    assert.deepEqual(later.popupBorder, { elapsedMs: at, opening: null, breathMs: LENGTH })
    assert.equal(later.frameMs, BREATH_FRAME_MS, `${popup}: the breath redraws every frame`)
    assert.equal(later.busyUntil, at + BREATH_FRAME_MS, `${popup}: the frame timer stopped while it breathes`)
    // What it hands the view is what the view draws, and it moves the border.
    const drawn = compose(side, { state, ...livePresentation(later) }, "truecolor")
    const rest = compose(side, { state }, "truecolor")
    assert.equal(changedCells(drawn, rest).length, borderCells(side, rest, state).length, `${popup}: its border is not breathing`)
  }
})

test("the frame timer stops the frame the last popup closes; a popup opened again, or another over it, starts again", () => {
  const side = gameMenu()
  const animation = new BuildAnimation()
  animation.frame(side.build.state, 0)
  assert.notEqual(animation.frame(side.build.state, 1000).busyUntil, null)
  keys(side, ESC)
  assert.equal(side.build.state.popup, null)
  const closed = animation.frame(side.build.state, 1010)
  assert.equal(closed.popupBorder, undefined, "the closed popup still moves")
  assert.equal(closed.frameMs, undefined)
  const settled = animation.frame(side.build.state, 3000)
  assert.equal(settled.busyUntil, null, "the frame timer kept running after the popup closed")
  assert.equal(nextFrameDelay(settled.busyUntil, 3000, settled.frameMs), null)
  // Opened again: the breath again, from rest.
  keys(side, "q")
  assert.equal(side.build.state.popup, "game-menu")
  assert.deepEqual(animation.frame(side.build.state, 5000).popupBorder, breathing(0))
  assert.deepEqual(animation.frame(side.build.state, 5100).popupBorder, breathing(100))
  // Another popup in its place — the Nexus powers, then Settings — is its own border, from rest.
  const menu = showing(side.build.state, "nexus-powers")
  assert.deepEqual(animation.frame(menu, 6000).popupBorder, breathing(0))
  assert.deepEqual(animation.frame(menu, 6400).popupBorder, breathing(400))
  const settings = showing(side.build.state, "settings")
  assert.deepEqual(animation.frame(settings, 7000).popupBorder, breathing(0))
})

test("reduced motion and monochrome keep every border still and the timer quiet", () => {
  const side = gameMenu()
  for (const options of [{ reducedMotion: true }, { colors: "monochrome" as const }]) {
    for (const popup of EVERY_POPUP) {
      const state = showing(side.build.state, popup)
      const animation = new BuildAnimation()
      animation.frame(side.build.state, -10_000, options)
      for (const now of [0, 100, 300, 1000, 2250]) {
        const live = animation.frame(state, now, options)
        assert.equal(live.popupBorder, undefined, `${JSON.stringify(options)} ${popup}: the border moves at ${now} ms`)
        // The pressed flash of Start Battle Round's row may still be running at 0; after it, nothing.
        if (now >= 300) assert.equal(live.busyUntil, null, `${JSON.stringify(options)} ${popup}: the frame timer runs at ${now} ms`)
      }
    }
  }
})

test("the breath's Experiment at 0 stops the breath; a shorter breath is a shorter breath", () => {
  const off = gameMenu({ popupPulseMs: 0 })
  const animation = new BuildAnimation()
  assert.equal(animation.frame(off.build.state, 0).popupBorder, undefined)
  const after = animation.frame(off.build.state, OPENING + 10)
  assert.equal(after.popupBorder, undefined)
  assert.equal(after.busyUntil, null)
  assert.equal(popupBorderEffect(showing(off.build.state, "settings"), false), null, "another popup moves with the breath off")
  const quick = gameMenu({ popupPulseMs: 1200 })
  const live = new BuildAnimation()
  live.frame(quick.build.state, 0, { colors: "color256" })
  assert.deepEqual(live.frame(quick.build.state, OPENING + 300, { colors: "color256" }).popupBorder, {
    elapsedMs: OPENING + 300,
    opening: null,
    breathMs: 1200,
  })
})

test("the frame timer's delay honours a slower frame, and still lands on an animation's end", () => {
  assert.equal(nextFrameDelay(1050, 1000, BREATH_FRAME_MS), BREATH_FRAME_MS)
  assert.equal(nextFrameDelay(1005, 1000, BREATH_FRAME_MS), 5)
  assert.equal(nextFrameDelay(1050, 1000), FRAME_MS, "without a frame length, every frame")
  assert.equal(nextFrameDelay(null, 1000, BREATH_FRAME_MS), null)
})
