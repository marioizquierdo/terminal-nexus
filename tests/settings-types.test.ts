// The pure "next value" for each settings row — no file, no menu, no terminal.

import { test } from "node:test"
import assert from "node:assert/strict"
import { CAPABILITY_MODES, THEMES } from "../src/view/roles.ts"
import { GLYPH_PACKS } from "../src/view/theme.ts"
import { nextCapability, nextGlyphPack, nextTheme, toggleReducedMotion } from "../src/settings/types.ts"

test("nextCapability cycles through every tier and wraps back to the first", () => {
  const seen = new Set<string>()
  let current = CAPABILITY_MODES[0] as (typeof CAPABILITY_MODES)[number]
  for (let step = 0; step < CAPABILITY_MODES.length; step += 1) {
    seen.add(current)
    current = nextCapability(current)
  }
  assert.equal(seen.size, CAPABILITY_MODES.length, "did not visit every capability tier")
  assert.equal(current, CAPABILITY_MODES[0], "did not wrap back to the first tier")
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
