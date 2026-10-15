// The game owns its ground (docs/system-design/presentation.md). At 256 colours and in millions every cell is two
// colours, its glyph's and its fill, and the terminal's own theme (Solarized, a purple one, a picture) is
// never consulted: no default-colour code, no "faint" or "reverse" for the terminal to interpret, and a
// screen bigger than the frame is ground to its edges. Monochrome alone leaves the terminal's colours be.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { buildLayout } from "../src/build/layout.ts"
import { starterContext } from "../src/cli/starter.ts"
import { createMenuList } from "../src/title-menu/list.ts"
import { TOP_LEVEL_ITEMS } from "../src/cli/menu.ts"
import { AnsiBackend } from "../src/view/backends/ansi.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { BuildSession } from "../src/view/build-session.ts"
import type { Cell, ReadonlyCellFrame } from "../src/view/frame.ts"
import { frameToAnsi, padFrame } from "../src/view/frame.ts"
import { composeMenuFrame } from "../src/view/menu.ts"
import { BACKGROUND_RGB, THEMES, resolveCell } from "../src/view/roles.ts"
import type { ColorDepth, Theme } from "../src/view/roles.ts"
import { keyBytes } from "../src/playtest/keys.ts"
import { sgrAttributes, sgrCodes } from "./helpers.ts"

const WITH_COLOURS: readonly Exclude<ColorDepth, "monochrome">[] = ["color256", "truecolor"]

/** The opening screens a player sees: the title menu, the map, and a popup over it. */
function screens(colors: ColorDepth): readonly ReadonlyCellFrame[] {
  const context = starterContext()
  const layout = buildLayout({ columns: 80, rows: 24 }, context.grid)
  const frames: ReadonlyCellFrame[] = [composeMenuFrame({ state: createMenuList(TOP_LEVEL_ITEMS), notice: null }, colors)]
  for (const script of [[], ["n", "1"]]) {
    const build = new BuildSession({ context, cursor: STARTER_START_CURSOR, viewport: layout.viewport })
    for (const name of script) build.handleData(keyBytes(name), layout)
    frames.push(composeBuildFrame({ context, state: build.state, layout }, colors))
  }
  return frames
}

test("at a colour depth every cell has a fill, and a cell with none of its own is the theme's ground", () => {
  for (const colors of WITH_COLOURS) {
    for (const theme of THEMES) {
      for (const frame of screens(colors)) {
        let ground = 0
        frame.cells.forEach((cell: Cell, index) => {
          const resolved = resolveCell(cell, colors, theme)
          assert.ok(resolved.background !== null, `${colors}/${theme}: cell ${index} has no fill`)
          assert.ok(resolved.sgr.includes(48), `${colors}/${theme}: cell ${index} sends no background`)
          if (cell.style.bgRole === undefined && cell.style.inverse !== true && cell.style.seeThrough === undefined) {
            ground += 1
            if (colors === "truecolor") assert.deepEqual(resolved.background, BACKGROUND_RGB[theme], `cell ${index}`)
          }
        })
        assert.ok(ground > frame.cells.length / 3, `${colors}/${theme}: the frame is mostly ground`)
      }
    }
  }
})

test("nothing is left to the terminal: no default colour, no faint, no reverse video at a colour depth", () => {
  for (const colors of WITH_COLOURS) {
    for (const theme of THEMES) {
      for (const frame of screens(colors)) {
        const codes = sgrAttributes(frameToAnsi(frame, colors, theme))
        for (const code of [2, 7, 39, 49]) {
          assert.ok(!codes.includes(code), `${colors}/${theme}: sent SGR ${code}, which means whatever this terminal makes of it`)
        }
      }
    }
  }
})

test("monochrome is the one depth that leaves the terminal's colours alone: no fill, faint and reverse stay", () => {
  for (const theme of THEMES) {
    const sent = screens("monochrome").flatMap((frame) => sgrAttributes(frameToAnsi(frame, "monochrome", theme)))
    assert.ok(!sgrCodes(screens("monochrome").map((frame) => frameToAnsi(frame, "monochrome", theme)).join("")).some((code) => code === 38 || code === 48), "monochrome sent a colour")
    assert.ok(sent.includes(2) && sent.includes(7), "monochrome lost its faint or reverse video")
  }
})

test("the light theme paints its own pale ground, on a terminal of any colour", () => {
  for (const colors of WITH_COLOURS) {
    const [menu] = screens(colors)
    assert.ok(menu !== undefined)
    const dark = frameToAnsi(menu, colors, "dark")
    const light = frameToAnsi(menu, colors, "light")
    assert.notEqual(dark, light)
    if (colors === "truecolor") {
      assert.ok(light.includes("48;2;242;240;234"), "the light ground was not painted")
      assert.ok(!light.includes("48;2;10;10;12"), "the dark ground showed through the light theme")
      assert.ok(dark.includes("48;2;10;10;12") && !dark.includes("48;2;242;240;234"))
    }
  }
})

test("dim is the glyph mixed toward its fill, so it is the same wherever it is drawn", () => {
  const plain: Cell = { glyph: "x", style: { fgRole: "chrome.muted" } }
  const dimmed: Cell = { glyph: "x", style: { fgRole: "chrome.muted", dim: true } }
  for (const theme of THEMES) {
    const own = resolveCell(plain, "truecolor", theme).foreground
    const faint = resolveCell(dimmed, "truecolor", theme).foreground
    const ground = BACKGROUND_RGB[theme]
    own.forEach((channel, at) => {
      const low = Math.min(channel, ground[at] ?? 0)
      const high = Math.max(channel, ground[at] ?? 0)
      assert.ok((faint[at] ?? 0) >= low && (faint[at] ?? 0) <= high, `${theme}: channel ${at} is not between the glyph and the ground`)
    })
    assert.notDeepEqual(faint, own, `${theme}: dim changed nothing`)
    assert.equal(resolveCell(dimmed, "truecolor", theme).dim, false)
  }
})

test("a frame smaller than the screen is grown with blank cells to the right and below, and left alone otherwise", () => {
  const [menu] = screens("truecolor")
  assert.ok(menu !== undefined)
  const grown = padFrame(menu, 100, 30)
  assert.equal(grown.width, 100)
  assert.equal(grown.height, 30)
  assert.equal(grown.cells.length, 100 * 30)
  assert.deepEqual(grown.cells[0], menu.cells[0])
  assert.deepEqual(grown.cells[(menu.height - 1) * 100 + menu.width - 1], menu.cells[menu.width * menu.height - 1])
  assert.equal(grown.cells[menu.width]?.glyph, " ")
  assert.equal(padFrame(menu, 40, 10), menu, "a frame already big enough is returned as it is")
})

class FakeStdout extends EventEmitter {
  isTTY = true
  columns = 100
  rows = 30
  written = ""
  write(text: string): boolean {
    this.written += text
    return true
  }
}

test("on a terminal bigger than the frame the game paints the whole screen, except in monochrome", () => {
  for (const [colors, painted] of [["truecolor", true], ["color256", true], ["monochrome", false]] as const) {
    const stdout = new FakeStdout()
    const backend = new AnsiBackend({ stdout, stdin: new EventEmitter() as never, colors })
    const [menu] = screens(colors)
    assert.ok(menu !== undefined)
    backend.present(menu)
    // eslint-disable-next-line no-control-regex
    const plain = stdout.written.replace(/\u001b\[[0-9;?]*[A-Za-z]/gu, "")
    const rows = plain.split("\r\n")
    assert.equal(rows.length, painted ? 30 : 24, colors)
    assert.equal(rows[0]?.length, painted ? 100 : 80, colors)
  }
})

test("the ground is chosen per theme and never a colour the terminal could have", () => {
  for (const theme of THEMES as readonly Theme[]) {
    const [r, g, b] = BACKGROUND_RGB[theme]
    assert.ok([r, g, b].every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255), theme)
  }
  // Dark is a dark ground and light a light one: every role in each table was set against it.
  const mean = (rgb: readonly number[]): number => rgb.reduce((sum, channel) => sum + channel, 0) / 3
  assert.ok(mean(BACKGROUND_RGB.dark) < 40 && mean(BACKGROUND_RGB.light) > 215)
})
