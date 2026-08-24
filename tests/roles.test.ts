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

test("the 256-colour tier is derived from rgb, not a fourth hand-authored value (Q25 option A)", () => {
  // Pinned against node scripts/measure-palette-derivation.mjs's own output, 2026-08-24: these are
  // the *derived* indices, and for chrome.frame and player.b (dark) they differ from what used to be
  // hand-authored (240 and 84) - proof the switch actually took effect, not just that some number
  // came back.
  assert.deepEqual(sgrFor("chrome.frame", "color256", "dark"), [38, 5, 59])
  assert.deepEqual(sgrFor("player.b", "color256", "dark"), [38, 5, 78])
  // player.a's dark 256 index happened to already match its hand-authored value (173) before this
  // change - included so the pin set covers a "no visible change" role too, not only ones that moved.
  assert.deepEqual(sgrFor("player.a", "color256", "dark"), [38, 5, 173])

  // Structural claim, not just pinned numbers: every role's 256 index is genuinely nearest to its own
  // rgb, not merely *some* fixed value - reconstruct each candidate's rgb the same way roles.ts does
  // (a 6x6x6 cube then a grey ramp) and confirm nothing closer exists in that same space.
  const cube = [0, 95, 135, 175, 215, 255]
  const xterm256Rgb = (index: number): readonly [number, number, number] => {
    if (index < 232) {
      const offset = index - 16
      return [
        cube[Math.floor(offset / 36)] ?? 0,
        cube[Math.floor((offset % 36) / 6)] ?? 0,
        cube[offset % 6] ?? 0,
      ]
    }
    const grey = 8 + (index - 232) * 10
    return [grey, grey, grey]
  }
  const squaredDistance = (a: readonly [number, number, number], b: readonly [number, number, number]): number =>
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

  for (const theme of THEMES) {
    for (const role of ["chrome.frame", "chrome.muted", "player.a", "player.b", "fx.blast"] as const) {
      const rgb = rgbFor(role, "truecolor", theme)
      const [, , chosenIndex] = sgrFor(role, "color256", theme)
      assert.ok(chosenIndex !== undefined)
      const chosenDistance = squaredDistance(rgb, xterm256Rgb(chosenIndex))
      // Spot-check every other index in the same 16-255 space - none may be strictly closer.
      for (let index = 16; index <= 255; index += 1) {
        if (index === chosenIndex) continue
        const distance = squaredDistance(rgb, xterm256Rgb(index))
        assert.ok(
          distance >= chosenDistance,
          `${role}/${theme}: 256-index ${index} (distance ${distance}) is closer to ${JSON.stringify(rgb)} than the chosen ${chosenIndex} (distance ${chosenDistance})`,
        )
      }
    }
  }
})

test("the 16-colour tier stays hand-authored: chrome.muted keeps its fix, not nearest-match's regression", () => {
  // scripts/measure-palette-derivation.mjs's own finding: nearest-match derivation would send
  // chrome.muted back to ANSI 90 ("bright black"), the exact value an owner playtest already had
  // removed because it compounds with the `dim` attribute every chrome.muted cell also carries. The
  // 16-colour tier deliberately does NOT derive (see roles.ts's PALETTE comment), so this must still
  // read 37, in both themes, even after the 256-colour tier started deriving from the same rgb.
  for (const theme of THEMES) {
    const [ansi] = sgrFor("chrome.muted", "color16", theme)
    assert.notEqual(ansi, 90, `chrome.muted/${theme} regressed to ANSI 90 - the 16-colour tier must stay hand-authored`)
  }
})

test("player.a and player.b clear a real mutual-contrast floor in the light theme now (Q21)", () => {
  // The same WCAG relative-luminance contrast ratio Q21's own measurement used
  // (specs/open-questions.md), computed independently here rather than imported, so this test would
  // actually fail if the retune regressed.
  const srgbToLinear = (u: number): number => (u / 255 <= 0.04045 ? u / 255 / 12.92 : ((u / 255 + 0.055) / 1.055) ** 2.4)
  const relLuminance = (rgb: readonly [number, number, number]): number =>
    0.2126 * srgbToLinear(rgb[0]) + 0.7152 * srgbToLinear(rgb[1]) + 0.0722 * srgbToLinear(rgb[2])
  const contrast = (a: readonly [number, number, number], b: readonly [number, number, number]): number => {
    const [hi, lo] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x)
    return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
  }

  const lightA = rgbFor("player.a", "truecolor", "light")
  const lightB = rgbFor("player.b", "truecolor", "light")
  const lightBg = [242, 240, 234] as const // BACKGROUND_RGB.light
  assert.ok(contrast(lightA, lightB) >= 3.0, `player.a vs player.b, light theme: ${contrast(lightA, lightB)}, was 1.08 before the retune`)
  assert.ok(contrast(lightA, lightBg) >= 3.0, "player.a lost its own floor against the light background")
  assert.ok(contrast(lightB, lightBg) >= 3.0, "player.b lost its own floor against the light background")

  // Scoped to light only, per the recommendation - dark theme's pair is untouched.
  assert.deepEqual(rgbFor("player.a", "truecolor", "dark"), [201, 118, 68])
  assert.deepEqual(rgbFor("player.b", "truecolor", "dark"), [104, 226, 132])
})
