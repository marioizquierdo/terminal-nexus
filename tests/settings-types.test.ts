// The pure "next value" for each settings row — no file, no menu, no terminal.

import { test } from "node:test"
import assert from "node:assert/strict"
import { COLOR_DEPTHS, THEMES } from "../src/view/roles.ts"
import { GLYPH_PACKS } from "../src/view/theme.ts"
import { DEFAULT_SETTINGS, nextColorDepth, nextGlyphPack, nextTheme, parseSettings, toggleReducedMotion } from "../src/settings/types.ts"

test("nextColorDepth cycles through every tier and wraps back to the first", () => {
  const seen = new Set<string>()
  let current = COLOR_DEPTHS[0] as (typeof COLOR_DEPTHS)[number]
  for (let step = 0; step < COLOR_DEPTHS.length; step += 1) {
    seen.add(current)
    current = nextColorDepth(current)
  }
  assert.equal(seen.size, COLOR_DEPTHS.length, "did not visit every colour depth")
  assert.equal(current, COLOR_DEPTHS[0], "did not wrap back to the first tier")
})

test("a file saved while a sixteen-colour depth existed reads as the default depth, and keeps its other settings", () => {
  const parsed = parseSettings({ colors: "color16", theme: "light", glyphPack: "unicode", reducedMotion: true })
  assert.equal(parsed.colors, DEFAULT_SETTINGS.colors)
  assert.equal(DEFAULT_SETTINGS.colors, "monochrome", "the baseline is the floor, which draws right on any terminal")
  assert.deepEqual({ ...parsed, colors: "x" }, { colors: "x", theme: "light", glyphPack: "unicode", reducedMotion: true })
})

test("a file saved before the setting was named colors keeps the player's choice", () => {
  const old = parseSettings({ capability: "truecolor", theme: "light", glyphPack: "unicode", reducedMotion: true })
  assert.equal(old.colors, "truecolor")
  assert.equal(parseSettings({ colors: "color256", capability: "truecolor" }).colors, "color256", "the new name wins")
})

test("nextTheme toggles between dark and light", () => {
  assert.equal(THEMES.length, 2, "this test assumes exactly two themes")
  assert.notEqual(nextTheme("dark"), "dark")
  assert.equal(nextTheme(nextTheme("dark")), "dark")
})

test("nextGlyphPack toggles between ascii and unicode", () => {
  assert.equal(GLYPH_PACKS.length, 2, "this test assumes exactly two glyph packs")
  assert.notEqual(nextGlyphPack("ascii"), "ascii")
  assert.equal(nextGlyphPack(nextGlyphPack("ascii")), "ascii")
})

test("toggleReducedMotion flips the boolean", () => {
  assert.equal(toggleReducedMotion(false), true)
  assert.equal(toggleReducedMotion(true), false)
})
