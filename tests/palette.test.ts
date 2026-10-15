// The palette's own quality bar (`PALETTE`, src/view/roles.ts): not what each role is, but what has to stay
// true of every one of them, so a colour added later is held to what the ones before it were. The numbers
// are written in `color-helpers.ts` again, independently of the code they check.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STYLE_ROLES, BACKGROUND_RGB, THEMES, rgbFor, resolveCell, DIM_ALPHA } from "../src/view/roles.ts"
import type { StyleRole } from "../src/view/roles.ts"
import { chroma, contrast, deltaE, hue, hueGap, nearest256, seenWith, xterm256 } from "./color-helpers.ts"

/** The ground marks the map is meant to keep quiet: a dot of featureless floor, the map's edge, a bullet's
 *  trail. Every other role is something to read. */
const QUIET: readonly StyleRole[] = ["terrain.plain", "chrome.edge", "fx.trail"]

test("every role to be read clears 3:1 against its own ground, in both themes", () => {
  for (const theme of THEMES) {
    for (const role of STYLE_ROLES) {
      if (QUIET.includes(role)) continue
      const ratio = contrast(rgbFor(role, "truecolor", theme), BACKGROUND_RGB[theme])
      assert.ok(ratio >= 3, `${role}/${theme}: ${ratio.toFixed(2)}:1`)
    }
  }
})

test("the muted, label and frame colours are still readable after a dim, in both themes", () => {
  // Every `chrome.muted` cell is drawn dim, and the frame's soft segments too: what is read is the mix.
  for (const theme of THEMES) {
    for (const role of ["chrome.muted", "chrome.label", "chrome.frame"] as const) {
      const cell = { glyph: "x", style: { fgRole: role, dim: true } }
      const ratio = contrast(resolveCell(cell, "truecolor", theme).foreground, BACKGROUND_RGB[theme])
      assert.ok(ratio >= 2, `${role}/${theme} dimmed by ${1 - DIM_ALPHA}: ${ratio.toFixed(2)}:1`)
    }
  }
})

test("256 colours shows every role within a Delta E of 12 of what millions shows", () => {
  for (const theme of THEMES) {
    for (const role of STYLE_ROLES) {
      const exact = rgbFor(role, "truecolor", theme)
      const shown = rgbFor(role, "color256", theme)
      assert.deepEqual(shown, xterm256(nearest256(exact)))
      assert.ok(deltaE(exact, shown) <= 12, `${role}/${theme}: ${JSON.stringify(exact)} is ${JSON.stringify(shown)} at 256 (Delta E ${deltaE(exact, shown).toFixed(1)})`)
    }
  }
})

test("a colour with a hue keeps it at 256 colours: it never lands on a grey or another colour", () => {
  for (const theme of THEMES) {
    for (const role of STYLE_ROLES) {
      const exact = rgbFor(role, "truecolor", theme)
      if (chroma(exact) < 25) continue
      const shown = rgbFor(role, "color256", theme)
      assert.ok(chroma(shown) >= chroma(exact) * 0.5, `${role}/${theme}: lost its colour at 256 (chroma ${chroma(exact).toFixed(0)} to ${chroma(shown).toFixed(0)})`)
      assert.ok(hueGap(hue(exact), hue(shown)) <= 20, `${role}/${theme}: hue ${hue(exact).toFixed(0)} to ${hue(shown).toFixed(0)} at 256`)
    }
  }
})

test("the two sides are two colours that each read as their own, and stay apart for a colour-blind player", () => {
  for (const theme of THEMES) {
    const [a, b] = [rgbFor("player.a", "truecolor", theme), rgbFor("player.b", "truecolor", theme)]
    // Each is a colour, not a grey: a faction that reads as black text on the light ground was the fault.
    assert.ok(chroma(a) >= 35 && chroma(b) >= 35, `${theme}: a side is nearly grey (chroma ${chroma(a).toFixed(0)} and ${chroma(b).toFixed(0)})`)
    assert.ok(deltaE(a, b) >= 40, `${theme}: the two sides are close (Delta E ${deltaE(a, b).toFixed(0)})`)
    assert.ok(deltaE(rgbFor("player.a", "color256", theme), rgbFor("player.b", "color256", theme)) >= 40, `${theme}: close at 256`)
    for (const kind of ["protanopia", "deuteranopia"] as const) {
      const apart = deltaE(seenWith(a, kind), seenWith(b, kind))
      assert.ok(apart >= 40, `${theme}: the sides are Delta E ${apart.toFixed(0)} apart with ${kind}`)
    }
  }
})
