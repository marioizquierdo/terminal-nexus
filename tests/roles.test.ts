// Style roles, render tiers, and themes — docs/system-design/presentation.md, and the owner's dark/light finding.

import { test } from "node:test"
import assert from "node:assert/strict"
import { nearest256, xterm256 } from "./color-helpers.ts"
import {
  BACKGROUND_RGB,
  COLOR_DEPTHS,
  DEFAULT_THEME,
  parseColorDepth,
  parseTheme,
  rgbFor,
  sgrBackgroundFor,
  sgrFor,
  STYLE_ROLES,
  THEMES,
} from "../src/view/roles.ts"
import { detectColorDepth } from "../src/cli/grid-main.ts"

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
  for (const colors of ["color256", "truecolor"] as const) {
    const dark = sgrFor("chrome.value", colors, "dark")
    const light = sgrFor("chrome.value", colors, "light")
    assert.notDeepEqual(dark, light, `${colors} drew chrome.value the same in both themes`)
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

test("chrome.frame survives compose.ts's extra dim attribute in either theme (2026-09-26 playtest)", () => {
  // The border's own soft (scrolling) segments carry `dim: true` the same way chrome.muted's cells
  // do, and an owner playtest found the border unreadable in bright ambient light - "during day time
  // I was not able to tell where the UI is" - which is exactly the compounding the chrome.muted test
  // above already guards against. Same bound, same reasoning, applied to the role that was missed.
  const halved = (rgb: readonly [number, number, number]): number =>
    (rgb[0] + rgb[1] + rgb[2]) / 3 / 2
  const darkBg = 11
  const lightBg = 239
  const darkFrame = halved(rgbFor("chrome.frame", "truecolor", "dark"))
  const lightFrame = halved(rgbFor("chrome.frame", "truecolor", "light"))
  assert.ok(darkFrame - darkBg > 40, `dark chrome.frame, dimmed, is only ${darkFrame} against ~${darkBg}`)
  assert.ok(lightBg - lightFrame > 40, `light chrome.frame, dimmed, is only ${lightFrame} from ~${lightBg}`)
})

test("detectColorDepth prefers what COLORTERM and TERM actually advertise", () => {
  assert.equal(detectColorDepth({ COLORTERM: "truecolor" }), "truecolor")
  assert.equal(detectColorDepth({ COLORTERM: "24bit" }), "truecolor")
  assert.equal(detectColorDepth({ TERM: "xterm-256color" }), "color256")
  // Anything that says no more than that is monochrome, the floor: there is no sixteen-colour depth in between.
  assert.equal(detectColorDepth({}), "monochrome")
  assert.equal(detectColorDepth({ TERM: "xterm" }), "monochrome")
  assert.equal(detectColorDepth({ TERM: "linux" }), "monochrome")
  // COLORTERM wins when both are present.
  assert.equal(detectColorDepth({ COLORTERM: "truecolor", TERM: "xterm" }), "truecolor")
})

test("parseColorDepth still rejects an unknown tier", () => {
  assert.equal(parseColorDepth("truecolor"), "truecolor")
  assert.throws(() => parseColorDepth("hd"), /unknown colour depth/)
})

test("there is no sixteen-colour depth: it is not a colour depth", () => {
  assert.deepEqual([...COLOR_DEPTHS], ["monochrome", "color256", "truecolor"])
  assert.throws(() => parseColorDepth("color16"), /unknown colour depth/)
})

test("no colour a tier draws is one of the terminal's own sixteen: the 256 search starts at index 16", () => {
  // The sixteen system colours are whatever the player's terminal theme says. A palette entry that landed
  // on one would look different on every theme, and the game could not blend toward it; the guarantee is
  // structural, so it is held for every role in both themes, tinted and faded as well as plain.
  for (const theme of THEMES) {
    for (const role of STYLE_ROLES) {
      const [mode, kind, index] = sgrFor(role, "color256", theme)
      assert.deepEqual([mode, kind], [38, 5], `${role}/${theme}`)
      assert.ok((index ?? 0) >= 16, `${role}/${theme} drew system colour ${index}`)
      for (const fade of [0.25, 0.5, 1]) {
        const faded = sgrFor(role, "color256", theme, fade)[2] ?? 0
        assert.ok(faded >= 16, `${role}/${theme} faded ${fade} drew system colour ${faded}`)
      }
    }
  }
})

test("the 256-colour tier is derived from rgb, not a second hand-authored palette", () => {
  // Pinned numbers, for a role that moved when the table was derived (chrome.frame, player.b) and one that
  // happened to land where it always had (player.a): proof the derivation took effect, not just that
  // some number came back.
  assert.deepEqual(sgrFor("chrome.frame", "color256", "dark"), [38, 5, 247])
  assert.deepEqual(sgrFor("player.b", "color256", "dark"), [38, 5, 78])
  assert.deepEqual(sgrFor("player.a", "color256", "dark"), [38, 5, 173])

  // Structural claim, not just pinned numbers: every role's 256 index looks more like its own rgb than any
  // other index does, judged by an independent Lab distance (`color-helpers.ts`), at full strength and part
  // of the way faded.
  for (const theme of THEMES) {
    for (const role of STYLE_ROLES) {
      for (const fade of [0, 0.3, 0.7]) {
        const exact = rgbFor(role, "truecolor", theme, fade)
        const [, , index] = sgrFor(role, "color256", theme, fade)
        assert.equal(index, nearest256(exact), `${role}/${theme} faded ${fade}: ${JSON.stringify(exact)}`)
        // The RGB renderers show the entry the terminal shows, not the exact colour it could not.
        assert.deepEqual(rgbFor(role, "color256", theme, fade), xterm256(index ?? 0), `${role}/${theme} faded ${fade}`)
      }
    }
  }
})

test("the dark theme's two sides are the lore's palette, Citizen rust and Ravel green", () => {
  // The reference table, set against the first screenshots; the light pair is held to a bar of its own
  // (`tests/palette.test.ts`) rather than pinned.
  assert.deepEqual(rgbFor("player.a", "truecolor", "dark"), [201, 118, 68])
  assert.deepEqual(rgbFor("player.b", "truecolor", "dark"), [104, 226, 132])
})

test("sgrFor's fade resolves only at color256 and truecolor - the transparency scalar", () => {
  const role = "fx.flash"
  const theme = "dark"
  // monochrome: nothing at all whether fade is 0, partway, or fully faded - no representable effect
  // there (CellStyle.fade's own doc comment, frame.ts).
  assert.deepEqual(sgrFor(role, "monochrome", theme, 1), [])

  // color256 and truecolor: a full fade actually changes the resolved colour.
  assert.notDeepEqual(sgrFor(role, "color256", theme, 0), sgrFor(role, "color256", theme, 1))
  assert.notDeepEqual(sgrFor(role, "truecolor", theme, 0), sgrFor(role, "truecolor", theme, 1))

  // fade 0 (the default, and what every pre-existing 3-argument call site still passes implicitly)
  // is unchanged from before fade existed.
  assert.deepEqual(sgrFor(role, "color256", theme), sgrFor(role, "color256", theme, 0))
  assert.deepEqual(sgrFor(role, "truecolor", theme), sgrFor(role, "truecolor", theme, 0))
})

test("sgrFor's fade of 1 lands truecolor exactly on the theme's own background", () => {
  for (const theme of THEMES) {
    const [, , r, g, b] = sgrFor("fx.flash", "truecolor", theme, 1)
    assert.deepEqual(
      [r, g, b],
      [...BACKGROUND_RGB[theme]],
      `${theme}: fade 1 did not land on the background exactly`,
    )
  }
})

test("rgbFor's fade mirrors sgrFor's tier gating: truecolor blends, monochrome is untouched", () => {
  const role = "fx.flash"
  const theme = "dark"
  assert.deepEqual(rgbFor(role, "monochrome", theme, 1), rgbFor(role, "monochrome", theme, 0))
  assert.notDeepEqual(rgbFor(role, "truecolor", theme, 1), rgbFor(role, "truecolor", theme, 0))
  assert.deepEqual(rgbFor(role, "truecolor", theme, 1), [...BACKGROUND_RGB[theme]])
})
