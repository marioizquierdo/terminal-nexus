// Style roles, render tiers, and themes — engine.md 9.1 and 9.6, and the owner's dark/light finding.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  DEFAULT_THEME,
  parseCapability,
  parseTheme,
  rgbFor,
  sgrBackgroundFor,
  sgrFor,
  THEMES,
} from "../src/view/roles.ts"
import { detectCapability } from "../src/cli/index.ts"

test("parseTheme accepts dark and light, and rejects everything else", () => {
  assert.equal(parseTheme("dark"), "dark")
  assert.equal(parseTheme("light"), "light")
  assert.throws(() => parseTheme("sepia"), /unknown theme/)
  assert.equal(DEFAULT_THEME, "dark")
  assert.deepEqual([...THEMES].sort(), ["dark", "light"])
})

test("monochrome carries no colour code, whichever theme is asked for", () => {
  for (const theme of THEMES) {
    assert.deepEqual(sgrFor("chrome.value", "monochrome", theme), [])
    assert.deepEqual(sgrBackgroundFor("chrome.value", "monochrome", theme), [])
  }
})

test("dark and light disagree about chrome.value, at every colour tier", () => {
  for (const capability of ["color16", "color256", "truecolor"] as const) {
    const dark = sgrFor("chrome.value", capability, "dark")
    const light = sgrFor("chrome.value", capability, "light")
    assert.notDeepEqual(dark, light, `${capability} drew chrome.value the same in both themes`)
  }
})

test("light theme text is dark and dark theme text is light, in truecolor RGB", () => {
  // A rough but real legibility check: on light's pale background, primary text should be dark;
  // on dark's near-black background, primary text should be light. Mean channel value is a cheap
  // enough proxy for "which end of the scale this colour sits at".
  const mean = (rgb: readonly [number, number, number]): number => (rgb[0] + rgb[1] + rgb[2]) / 3
  const darkText = mean(rgbFor("chrome.value", "truecolor", "dark"))
  const lightText = mean(rgbFor("chrome.value", "truecolor", "light"))
  assert.ok(darkText > 150, `dark theme's primary text averaged ${darkText}, too dark to read`)
  assert.ok(lightText < 100, `light theme's primary text averaged ${lightText}, too light to read`)
})

test("chrome.muted survives compose.ts's extra dim attribute in either theme", () => {
  // compose.ts draws every chrome.muted cell with `dim: true` on top of the role's own colour
  // (the border, the footer controls line, the panel labels) - the owner's actual finding was this
  // combination reading as invisible. The role's own colour has to start bright enough that a
  // renderer's ~50% dim reduction still lands somewhere legible against that theme's background.
  const halved = (rgb: readonly [number, number, number]): number =>
    (rgb[0] + rgb[1] + rgb[2]) / 3 / 2
  const darkBg = 11 // BACKGROUND_RGB.dark's mean, roughly
  const lightBg = 239 // BACKGROUND_RGB.light's mean, roughly
  const darkMuted = halved(rgbFor("chrome.muted", "truecolor", "dark"))
  const lightMuted = halved(rgbFor("chrome.muted", "truecolor", "light"))
  assert.ok(darkMuted - darkBg > 40, `dark chrome.muted, dimmed, is only ${darkMuted} against ~${darkBg}`)
  assert.ok(lightBg - lightMuted > 40, `light chrome.muted, dimmed, is only ${lightMuted} from ~${lightBg}`)
})

test("player.a and player.b use ANSI-16 codes that actually match their hue elsewhere in the table", () => {
  // 96 (bright cyan) and 93 (bright yellow) were the codes in place before this fix, for roles the
  // 256/truecolor entries and the surrounding comment both call rust orange and bioluminescent
  // green - a mismatch this test pins down so it cannot silently come back.
  const [ansiA] = sgrFor("player.a", "color16", "dark")
  const [ansiB] = sgrFor("player.b", "color16", "dark")
  assert.notEqual(ansiA, 96, "player.a is still using bright cyan for an orange role")
  assert.notEqual(ansiB, 93, "player.b is still using bright yellow for a green role")
})

test("detectCapability prefers what COLORTERM and TERM actually advertise", () => {
  assert.equal(detectCapability({ COLORTERM: "truecolor" }), "truecolor")
  assert.equal(detectCapability({ COLORTERM: "24bit" }), "truecolor")
  assert.equal(detectCapability({ TERM: "xterm-256color" }), "color256")
  assert.equal(detectCapability({}), "color16")
  assert.equal(detectCapability({ TERM: "xterm" }), "color16")
  // COLORTERM wins when both are present.
  assert.equal(detectCapability({ COLORTERM: "truecolor", TERM: "xterm" }), "truecolor")
})

test("parseCapability still rejects an unknown tier", () => {
  assert.equal(parseCapability("truecolor"), "truecolor")
  assert.throws(() => parseCapability("hd"), /unknown capability/)
})
