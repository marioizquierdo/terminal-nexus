// The see-through cursor, as the owner asked for it after his menu playtest of 2026-09-30.
//
// A cell's `seeThrough` is a role and an alpha, never a colour: the cursor drawn in that role at that
// opacity over whatever the cell shows. The owner defined the mix himself — "if the background is
// black, the icon on the background is yellow, and the cursor is white, then the cursor at 80% ... would
// be 80% white, and the other 20% split between black (80%) and yellow (20%)" — and these tests hold
// every tier and every renderer to it: the ANSI writer (the terminal, and the evidence pictures), the
// browser page's canvas, and OpenTUI.

import { test } from "node:test"
import assert from "node:assert/strict"
import { DIM_ALPHA, paintOps } from "../src/view/backends/canvas.ts"
import type { CellSink } from "../src/view/backends/opentui.ts"
import { drawFrameInto } from "../src/view/backends/opentui.ts"
import type { Cell, CellStyle, ReadonlyCellFrame } from "../src/view/frame.ts"
import { BANDS, composeBands, frameToAnsi, frameToText } from "../src/view/frame.ts"
import type { CapabilityMode, SeeThrough, StyleRole, Theme } from "../src/view/roles.ts"
import {
  BACKGROUND_RGB,
  CAPABILITY_MODES,
  SEE_THROUGH_STEP,
  mixSeeThrough,
  resolveCell,
  seeThroughColours,
  rgbFor,
  sgrFor,
} from "../src/view/roles.ts"
import { isColourCode, sgrCodes } from "./helpers.ts"

type Rgb = readonly [number, number, number]

const GROUND = BACKGROUND_RGB.dark
const truecolour = (role: StyleRole, theme: Theme = "dark"): Rgb => rgbFor(role, "truecolor", theme)
const at = (role: StyleRole, alpha: number): SeeThrough => ({ role, alpha })
const cell = (glyph: string, style: CellStyle): Cell => ({ glyph, style })
const frameOf = (...cells: Cell[]): ReadonlyCellFrame => ({ width: cells.length, height: 1, cells })

/** The one SGR parameter list the ANSI writer sends for a lone cell (empty when it sends none). */
function ansiParams(target: Cell, capability: CapabilityMode, theme: Theme = "dark"): number[] {
  const first = /\u001b\[([0-9;]*)m/u.exec(frameToAnsi(frameOf(target), capability, theme))
  return first === null ? [] : (first[1] ?? "").split(";").filter(Boolean).map(Number)
}

/** The same cell with its see-through style taken away. */
function withoutSeeThrough(target: Cell): Cell {
  const { seeThrough: _seeThrough, ...style } = target.style
  return cell(target.glyph, style)
}

/** The xterm 256-colour palette above the system colours, rebuilt here so the test does not trust
 *  the code it checks. */
function xterm256(index: number): Rgb {
  const steps = [0, 95, 135, 175, 215, 255]
  if (index >= 232) {
    const grey = 8 + (index - 232) * 10
    return [grey, grey, grey]
  }
  const offset = index - 16
  return [steps[Math.floor(offset / 36)] ?? 0, steps[Math.floor((offset % 36) / 6)] ?? 0, steps[offset % 6] ?? 0]
}

function nearest256(rgb: Rgb): number {
  let best = 16
  let bestDistance = Infinity
  for (let index = 16; index <= 255; index += 1) {
    const [r, g, b] = xterm256(index)
    const distance = (rgb[0] - r) ** 2 + (rgb[1] - g) ** 2 + (rgb[2] - b) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  }
  return best
}

/** Reads an ANSI parameter list back into the colours a terminal would show, inverse resolved. */
function ansiColours(params: readonly number[]): { foreground: Rgb | null; background: Rgb | null; inverse: boolean } {
  let foreground: Rgb | null = null
  let background: Rgb | null = null
  let inverse = false
  for (let index = 0; index < params.length; index += 1) {
    const code = params[index]
    if (code === 7) inverse = true
    if (code !== 38 && code !== 48) continue
    const mode = params[index + 1]
    const colour: Rgb =
      mode === 5
        ? xterm256(params[index + 2] ?? 0)
        : [params[index + 2] ?? 0, params[index + 3] ?? 0, params[index + 4] ?? 0]
    if (code === 38) foreground = colour
    else background = colour
    index += mode === 5 ? 2 : 4
  }
  return { foreground, background, inverse }
}

const css = (rgb: Rgb): string => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`

// --- The owner's own numbers ----------------------------------------------------------------------

test("the owner's worked example: a white cursor at 80% over a yellow glyph on black", () => {
  const black: Rgb = [0, 0, 0]
  const yellow: Rgb = [255, 255, 0]
  const white: Rgb = [255, 255, 255]
  // The real cursor is inverse video, so its glyph is drawn in the ground: black here.
  const mixed = mixSeeThrough(black, yellow, white, black, 0.8)
  // 80% white (204), plus 20% of [80% black + 20% yellow (51, 51, 0)] = 10.2 more red and green.
  assert.deepEqual(mixed.background, [214, 214, 204])
  // The glyph stays, drawn 80% of the way toward the cursor's own glyph colour.
  assert.deepEqual(mixed.foreground, [51, 51, 0])
})

test("the same example through the dark theme's own roles, at truecolor", () => {
  // Ground (10,10,12), fx.hue.yellow (240,212,72), fx.flash (255,255,255).
  const target = cell("$", { fgRole: "fx.hue.yellow", seeThrough: at("fx.flash", 0.8) })
  const resolved = seeThroughColours(target, "truecolor", "dark")
  assert.ok(resolved !== null)
  assert.deepEqual(resolved.background, [215, 214, 209])
  assert.deepEqual(resolved.foreground, [56, 50, 24])
  assert.deepEqual(resolved.sgr, [38, 2, 56, 50, 24, 48, 2, 215, 214, 209])
  assert.deepEqual(ansiParams(target, "truecolor"), [38, 2, 56, 50, 24, 48, 2, 215, 214, 209])
})

test("the glyph's colour is its role after tint and fade, as the renderers already draw it", () => {
  const tinted: CellStyle = { fgRole: "player.a", tint: { role: "fx.flash", amount: 0.5 } }
  const faded: CellStyle = { fgRole: "player.a", fade: 0.4 }
  for (const style of [tinted, faded]) {
    const glyph = rgbFor(style.fgRole, "truecolor", "dark", style.fade ?? 0, style.tint)
    assert.notDeepEqual(glyph, truecolour("player.a"))
    const resolved = seeThroughColours(cell("A", { ...style, seeThrough: at("chrome.title", 0.8) }), "truecolor", "dark")
    const expected = mixSeeThrough(GROUND, glyph, truecolour("chrome.title"), GROUND, 0.8)
    assert.deepEqual(resolved?.foreground, expected.foreground)
    assert.deepEqual(resolved?.background, expected.background)
  }
})

test("a cell with a background role mixes that background rather than the theme's", () => {
  const target = cell("x", { fgRole: "chrome.title", bgRole: "player.b", seeThrough: at("chrome.title", 0.6) })
  const expected = mixSeeThrough(truecolour("player.b"), truecolour("chrome.title"), truecolour("chrome.title"), GROUND, 0.6)
  assert.deepEqual(seeThroughColours(target, "truecolor")?.background, expected.background)
  assert.deepEqual(seeThroughColours(target, "truecolor")?.foreground, expected.foreground)
})

// --- Blank, inverse, and the ends of the alpha range ----------------------------------------------

test("a blank cell has no glyph to mix: its ground goes straight toward the cursor", () => {
  const cursor = truecolour("chrome.title") // (236, 240, 245)
  const bare = seeThroughColours(cell(" ", { seeThrough: at("chrome.title", 0.8) }), "truecolor", "dark")
  assert.ok(bare !== null)
  // 20% of the ground (10,10,12) and 80% of the cursor.
  assert.deepEqual(bare.background, [191, 194, 198])
  assert.deepEqual(bare.background, mixSeeThrough(GROUND, GROUND, cursor, GROUND, 0.8).background)
  // A role on a blank cell colours nothing, so it cannot tint the mix either.
  const roled = seeThroughColours(cell(" ", { fgRole: "player.a", dim: true, seeThrough: at("chrome.title", 0.8) }), "truecolor")
  assert.deepEqual(roled?.background, bare.background)
})

test("an inverse cell is resolved first, then the cursor goes over what it shows", () => {
  const edge = truecolour("chrome.edge")
  const cursor = truecolour("chrome.title")
  // A glyph on an inverse cell: its role is the fill, the ground its ink.
  const lettered = cell("#", { fgRole: "chrome.edge", inverse: true, seeThrough: at("chrome.title", 0.8) })
  const expected = mixSeeThrough(edge, GROUND, cursor, GROUND, 0.8)
  assert.deepEqual(seeThroughColours(lettered, "truecolor")?.background, expected.background)
  assert.deepEqual(seeThroughColours(lettered, "truecolor")?.foreground, expected.foreground)
  // The map's solid edge: a blank inverse cell, simply its fill mixed toward the cursor.
  const solid = cell(" ", { fgRole: "chrome.edge", inverse: true, seeThrough: at("chrome.title", 0.8) })
  assert.deepEqual(seeThroughColours(solid, "truecolor")?.background, mixSeeThrough(edge, edge, cursor, GROUND, 0.8).background)
  // The writer sends the resolved colours and no reversed video on top of them.
  assert.ok(!ansiParams(lettered, "truecolor").includes(7))
  assert.ok(!ansiParams(lettered, "color256").includes(7))
})

test("alpha 0 (or less, or not a number) changes nothing, at every tier and in every renderer", () => {
  const plain = cell("$", { fgRole: "fx.hue.yellow", bold: true })
  for (const alpha of [0, -0.3, Number.NaN]) {
    const mixed = cell("$", { ...plain.style, seeThrough: at("chrome.title", alpha) })
    for (const capability of CAPABILITY_MODES) {
      assert.equal(seeThroughColours(mixed, capability), null)
      assert.equal(frameToAnsi(frameOf(mixed), capability), frameToAnsi(frameOf(plain), capability))
      assert.deepEqual(paintOps(frameOf(mixed), capability), paintOps(frameOf(plain), capability))
    }
  }
})

test("alpha 1 is the plain cursor look: the fill is the cursor's colour, the glyph the ground", () => {
  // The real map cursor on bare ground is inverse video in chrome.title (src/view/build.ts).
  const cursorLook = cell("$", { fgRole: "chrome.title", inverse: true })
  const full = cell("$", { fgRole: "fx.hue.yellow", seeThrough: at("chrome.title", 1) })
  const resolved = seeThroughColours(full, "truecolor")
  assert.deepEqual(resolved?.background, truecolour("chrome.title"))
  assert.deepEqual(resolved?.foreground, GROUND)
  // The canvas paints both the same at every tier but 256 (where the real cursor keeps its exact role
  // colour and the see-through style, like any mix, lands on a palette entry).
  for (const capability of ["truecolor", "color16", "monochrome"] as const) {
    const [look] = paintOps(frameOf(cursorLook), capability)
    const [over] = paintOps(frameOf(full), capability)
    assert.equal(over?.foreground, look?.foreground, capability)
    assert.equal(over?.background, look?.background, capability)
  }
  // At 256 colours the fill is the very palette entry the cursor's own role uses.
  const params = ansiParams(full, "color256")
  assert.equal(params[params.indexOf(48) + 2], sgrFor("chrome.title", "color256")[2])
  // Alpha above 1 is 1.
  assert.deepEqual(seeThroughColours(cell("$", { fgRole: "fx.hue.yellow", seeThrough: at("chrome.title", 3) }), "truecolor"), resolved)
})

// --- The tiers ------------------------------------------------------------------------------------

test("256 colours: the nearest palette entry to each exact mix", () => {
  for (const alpha of [0.2, 0.45, 0.8]) {
    for (const target of [
      cell("$", { fgRole: "fx.hue.yellow", seeThrough: at("chrome.title", alpha) }),
      cell(" ", { seeThrough: at("chrome.title", alpha) }),
      cell("A", { fgRole: "player.a", inverse: true, seeThrough: at("fx.hue.cyan", alpha) }),
    ]) {
      const exact = seeThroughColours(target, "truecolor")
      const indexed = seeThroughColours(target, "color256")
      assert.ok(exact !== null && indexed !== null)
      const foreground = nearest256(exact.foreground)
      const background = nearest256(exact.background)
      assert.deepEqual(indexed.sgr, [38, 5, foreground, 48, 5, background])
      // The RGB an RGB backend draws is that palette entry's own.
      assert.deepEqual(indexed.foreground, xterm256(foreground))
      assert.deepEqual(indexed.background, xterm256(background))
      assert.deepEqual(ansiParams(target, "color256"), [38, 5, foreground, 48, 5, background])
    }
  }
})

test("16 colours: from one half up the plain cursor in the seeThrough's hue, below it nothing", () => {
  const plain = cell("$", { fgRole: "fx.hue.yellow", bgRole: "player.b" })
  const hue = sgrFor("chrome.title", "color16")[0]
  for (const alpha of [SEE_THROUGH_STEP, 0.8, 1]) {
    const target = cell("$", { ...plain.style, seeThrough: at("chrome.title", alpha) })
    // The cell's own foreground and background codes give way to the cursor's.
    assert.deepEqual(ansiParams(target, "color16"), [hue, 7], `alpha ${alpha}`)
    assert.deepEqual(seeThroughColours(target, "color16")?.background, rgbFor("chrome.title", "color16"))
    assert.deepEqual(seeThroughColours(target, "color16")?.foreground, GROUND)
  }
  for (const alpha of [0.2, 0.45]) {
    const target = cell("$", { ...plain.style, seeThrough: at("chrome.title", alpha) })
    assert.equal(seeThroughColours(target, "color16"), null)
    assert.equal(frameToAnsi(frameOf(target), "color16"), frameToAnsi(frameOf(plain), "color16"), `alpha ${alpha}`)
  }
})

test("monochrome: from one half up reversed video, below it nothing, and never a colour code", () => {
  const cells = [0.2, 0.45, 0.5, 0.8, 1].flatMap((alpha) => [
    cell("$", { fgRole: "fx.hue.yellow", seeThrough: at("chrome.title", alpha) }),
    cell(" ", { seeThrough: at("chrome.title", alpha) }),
    cell("#", { fgRole: "chrome.edge", bgRole: "player.a", inverse: true, seeThrough: at("fx.hue.red", alpha) }),
  ])
  for (const theme of ["dark", "light"] as const) {
    const ansi = frameToAnsi(frameOf(...cells), "monochrome", theme)
    assert.ok(!sgrCodes(ansi).some(isColourCode), `${theme}: monochrome emitted a colour code`)
  }
  assert.deepEqual(ansiParams(cell("$", { fgRole: "fx.hue.yellow", bold: true, seeThrough: at("chrome.title", 0.8) }), "monochrome"), [7, 1])
  assert.deepEqual(ansiParams(cell("$", { fgRole: "fx.hue.yellow", seeThrough: at("chrome.title", 0.45) }), "monochrome"), [])
  assert.equal(seeThroughColours(cell("$", { seeThrough: at("chrome.title", 0.2) }), "monochrome"), null)
})

test("the light theme's cursor draws its glyph in the light ground", () => {
  const resolved = seeThroughColours(cell("$", { fgRole: "fx.hue.yellow", seeThrough: at("chrome.title", 1) }), "truecolor", "light")
  assert.deepEqual(resolved?.foreground, BACKGROUND_RGB.light)
  assert.deepEqual(resolved?.background, truecolour("chrome.title", "light"))
})

test("an seeThrough that shows replaces the cell's colours, inverse and dim; bold and underline stay", () => {
  const style: CellStyle = { fgRole: "terrain.plain", bold: true, dim: true, underline: true, inverse: true }
  const target = cell(".", { ...style, seeThrough: at("chrome.title", 0.8) })
  const faint = cell(".", { ...style, seeThrough: at("chrome.title", 0.2) })
  for (const capability of CAPABILITY_MODES) {
    const resolved = seeThroughColours(target, capability)
    assert.ok(resolved !== null)
    // The see-through style's colours (reversed video included, at the two tiers that use it), then the cell's
    // bold and underline — no dim, and no second reversed video for the cell's own inverse.
    assert.deepEqual(ansiParams(target, capability), [...resolved.sgr, 1, 4], capability)
    const [op] = paintOps(frameOf(target), capability)
    assert.equal(op?.alpha, 1, capability)
    assert.equal(op?.bold, true, capability)
    assert.equal(op?.underline, true, capability)
    // Where it shows nothing, the dim is the cell's again.
    if (seeThroughColours(faint, capability) === null) {
      assert.ok(ansiParams(faint, capability).includes(2), capability)
      assert.equal(paintOps(frameOf(faint), capability)[0]?.alpha, DIM_ALPHA, capability)
    }
  }
})

// --- Composition and text -------------------------------------------------------------------------

test("composeBands lays a glyphless seeThrough write onto the cell beneath, keeping its glyph and style", () => {
  const ground: Cell = cell(".", { fgRole: "terrain.plain", dim: true })
  const frame = composeBands(3, 1, [
    { band: BANDS.terrain, x: 0, y: 0, cell: ground },
    { band: BANDS.terrain, x: 1, y: 0, cell: ground },
    { band: BANDS.terrain, x: 2, y: 0, cell: ground },
    // Written out of band order on purpose: the compositor sorts.
    { band: BANDS.highlights, x: 0, y: 0, style: { seeThrough: at("chrome.title", 0.8) } },
    { band: BANDS.highlights, x: 1, y: 0, style: { seeThrough: at("chrome.title", 0.45) } },
    { band: BANDS.chrome, x: 1, y: 0, cell: cell("|", { fgRole: "chrome.frame" }) },
    { band: BANDS.effects, x: 2, y: 0, style: { tint: { role: "fx.flash", amount: 0.3 } } },
    { band: BANDS.highlights, x: 2, y: 0, style: { seeThrough: at("chrome.title", 0.2) } },
  ])
  assert.deepEqual(frame.cells[0], cell(".", { fgRole: "terrain.plain", dim: true, seeThrough: at("chrome.title", 0.8) }))
  // A whole cell drawn above it (chrome, a popup) replaces the see-through style with everything else.
  assert.deepEqual(frame.cells[1], cell("|", { fgRole: "chrome.frame" }))
  // It merges with other glyphless writes, like a tint.
  assert.deepEqual(frame.cells[2], cell(".", {
    fgRole: "terrain.plain",
    dim: true,
    tint: { role: "fx.flash", amount: 0.3 },
    seeThrough: at("chrome.title", 0.2),
  }))
  // Text frames show glyphs only: the see-through style is not in them.
  assert.equal(frameToText(frame), ".|.")
})

// --- Three renderers, one cell --------------------------------------------------------------------

type Drawn = { foreground: Rgb; background: Rgb; reverse: boolean; dim: boolean }

async function drawnByOpenTui(frame: ReadonlyCellFrame, capability: CapabilityMode, theme: Theme = "dark"): Promise<Drawn[]> {
  const core = await import("@opentui/core")
  const drawn: Drawn[] = []
  type Colour = { toInts(): number[] }
  const ints = (colour: unknown): Rgb => {
    const [r, g, b] = (colour as Colour).toInts()
    return [r ?? 0, g ?? 0, b ?? 0]
  }
  const sink: CellSink = {
    setCell(_x, _y, _char, fg, bg, attributes) {
      drawn.push({
        foreground: ints(fg),
        background: ints(bg),
        reverse: (attributes & core.TextAttributes.INVERSE) !== 0,
        dim: (attributes & core.TextAttributes.DIM) !== 0,
      })
    },
  }
  drawFrameInto(core, sink, frame, capability, theme)
  return drawn
}

test("the ANSI writer, the canvas and OpenTUI resolve one mixed cell to the same colours", async () => {
  const cells = [
    cell("$", { fgRole: "fx.hue.yellow", seeThrough: at("chrome.title", 0.8) }),
    cell(" ", { seeThrough: at("chrome.title", 0.45) }),
    cell("A", { fgRole: "player.a", inverse: true, seeThrough: at("fx.hue.cyan", 0.2) }),
    cell("#", { fgRole: "chrome.edge", bgRole: "player.b", seeThrough: at("chrome.title", 0.6) }),
    cell(".", { fgRole: "terrain.plain", dim: true, seeThrough: at("chrome.title", 0.8) }),
    cell(".", { fgRole: "terrain.plain", dim: true, seeThrough: at("chrome.title", 0.3) }),
  ]
  for (const theme of ["dark", "light"] as const) {
    for (const capability of CAPABILITY_MODES) {
      const frame = frameOf(...cells)
      const ops = paintOps(frame, capability, theme)
      const opentui = await drawnByOpenTui(frame, capability, theme)
      cells.forEach((target, index) => {
        const label = `${theme} ${capability} cell ${index}`
        const resolved = seeThroughColours(target, capability, theme)
        const op = ops[index]
        const tui = opentui[index]
        assert.ok(op !== undefined && tui !== undefined)
        if (resolved === null) {
          // Nothing to agree about: every renderer drew the cell as it would without the see-through style.
          const plain = frameOf(withoutSeeThrough(target))
          assert.deepEqual(op, { ...paintOps(plain, capability, theme)[0], x: index }, label)
          assert.equal(frameToAnsi(frameOf(target), capability, theme), frameToAnsi(plain, capability, theme), label)
          assert.equal(tui.dim, target.style.dim === true, label)
          return
        }
        assert.equal(op.foreground, css(resolved.foreground), label)
        assert.equal(op.background, css(resolved.background), label)
        assert.equal(op.alpha, 1, label)
        assert.deepEqual(tui.foreground, resolved.foreground, label)
        assert.deepEqual(tui.background, resolved.background, label)
        assert.equal(tui.reverse, false, label)
        assert.equal(tui.dim, false, label)
        assert.ok(!ansiParams(target, capability, theme).slice(resolved.sgr.length).includes(2), label)
        // The terminal: read its parameters back into what it would show.
        const shown = ansiColours(ansiParams(target, capability, theme))
        if (capability === "truecolor" || capability === "color256") {
          assert.deepEqual(shown.foreground, resolved.foreground, label)
          assert.deepEqual(shown.background, resolved.background, label)
          assert.equal(shown.inverse, false, label)
        } else {
          // At 16 colours and in monochrome the terminal swaps for itself: reversed video, the glyph in
          // its own ground — which the RGB renderers draw as that ground.
          assert.equal(shown.inverse, true, label)
          assert.deepEqual(resolved.foreground, BACKGROUND_RGB[theme], label)
        }
      })
    }
  }
})

test("the three renderers draw a cell's own colours alike: the refused row's grey words under the bar", async () => {
  // `refusedWords` in src/view/build.ts: a refused key greys the highlighted row's words by giving the
  // inverse bar a background role — chrome.muted (chrome.edge at 16 colours; in monochrome, dim).
  // OpenTUI once drew these exactly as the plain bar, dropping the background role.
  const cells = [
    cell("B", { fgRole: "chrome.title", bgRole: "chrome.muted", inverse: true }),
    cell("B", { fgRole: "chrome.title", bgRole: "chrome.edge", inverse: true }),
    cell("B", { fgRole: "chrome.title", inverse: true, dim: true }),
    cell("B", { fgRole: "chrome.title", inverse: true }),
    cell(" ", { fgRole: "chrome.edge", inverse: true }),
    cell("x", { fgRole: "player.a", bgRole: "player.b", bold: true, underline: true }),
    cell(".", { fgRole: "terrain.plain", dim: true }),
    cell("A", { fgRole: "player.a", tint: { role: "fx.flash", amount: 0.5 }, fade: 0.3 }),
  ]
  for (const theme of ["dark", "light"] as const) {
    const ground = BACKGROUND_RGB[theme]
    for (const capability of CAPABILITY_MODES) {
      const frame = frameOf(...cells)
      const ops = paintOps(frame, capability, theme)
      const opentui = await drawnByOpenTui(frame, capability, theme)
      cells.forEach((target, index) => {
        const label = `${theme} ${capability} cell ${index}`
        const resolved = resolveCell(target, capability, theme)
        const op = ops[index]
        const tui = opentui[index]
        assert.ok(op !== undefined && tui !== undefined)
        assert.equal(op.foreground, css(resolved.foreground), label)
        assert.equal(op.background, resolved.background === null ? null : css(resolved.background), label)
        assert.equal(op.alpha, resolved.dim ? DIM_ALPHA : 1, label)
        assert.deepEqual(tui.foreground, resolved.foreground, label)
        assert.deepEqual(tui.background, resolved.background ?? ground, label)
        assert.equal(tui.reverse, false, label)
        assert.equal(tui.dim, resolved.dim, label)
        if (capability !== "truecolor") return
        // At truecolor the terminal shows exact colours: read its parameters back, swapping for its
        // reversed video, and the ANSI writer must show what the two RGB renderers draw.
        const sent = ansiColours(ansiParams(target, capability, theme))
        const glyph = sent.foreground ?? ground
        const fill = sent.background ?? ground
        assert.deepEqual(sent.inverse ? fill : glyph, resolved.foreground, label)
        assert.deepEqual(sent.inverse ? glyph : fill, resolved.background ?? ground, label)
      })
      if (capability === "truecolor" || capability === "color256") {
        // The refused words are the grey on the title-coloured bar, not the plain bar's ground-coloured words.
        assert.deepEqual(opentui[0]?.foreground, rgbFor("chrome.muted", capability, theme), `${theme} ${capability}`)
        assert.deepEqual(opentui[0]?.background, rgbFor("chrome.title", capability, theme), `${theme} ${capability}`)
      }
    }
  }
})
