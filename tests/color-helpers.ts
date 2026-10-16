// What the colour tests check the game's colours against. The first half is written out again here rather
// than imported: a test that reads the answer from the code it checks would pass whatever that code did.
// The second half only asks the game what a role looks like, through the one resolver every renderer uses.

import { DEFAULT_THEME, resolveCell } from "../src/view/roles.ts"
import type { ColorDepth, RoleTint, StyleRole, Theme } from "../src/view/roles.ts"

export type Rgb = readonly [number, number, number]

/** What xterm shows for a 256-colour index above the 16 system colours: a 6x6x6 cube, then 24 greys. */
export function xterm256(index: number): Rgb {
  const steps = [0, 95, 135, 175, 215, 255]
  if (index >= 232) {
    const grey = 8 + (index - 232) * 10
    return [grey, grey, grey]
  }
  const offset = index - 16
  return [steps[Math.floor(offset / 36)] ?? 0, steps[Math.floor((offset % 36) / 6)] ?? 0, steps[offset % 6] ?? 0]
}

/** CIE L*a*b* (D65), the space in which distance is how different two colours look. */
export function lab(rgb: Rgb): readonly [number, number, number] {
  const linear = (channel: number): number => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const r = linear(rgb[0])
  const g = linear(rgb[1])
  const b = linear(rgb[2])
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

/** How different two colours look, in Lab (a Delta E of about 2 is the least a person can tell apart). */
export function deltaE(a: Rgb, b: Rgb): number {
  const p = lab(a)
  const q = lab(b)
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

/** The 256-colour index (16-255; the first sixteen are the terminal theme's) that looks most like `rgb`. */
export function nearest256(rgb: Rgb): number {
  let best = 16
  let bestDistance = Infinity
  for (let index = 16; index <= 255; index += 1) {
    const distance = deltaE(rgb, xterm256(index))
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  }
  return best
}

/** WCAG relative luminance and the contrast ratio between two colours. */
export function luminance(rgb: Rgb): number {
  const linear = (channel: number): number => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2])
}

export function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

/** Lab chroma (how saturated) and hue angle in degrees. */
export function chroma(rgb: Rgb): number {
  const [, a, b] = lab(rgb)
  return Math.hypot(a, b)
}

export function hue(rgb: Rgb): number {
  const [, a, b] = lab(rgb)
  return (Math.atan2(b, a) * 180) / Math.PI
}

/** The smaller angle between two hues, in degrees. */
export function hueGap(a: number, b: number): number {
  const gap = Math.abs(a - b) % 360
  return gap > 180 ? 360 - gap : gap
}

/** A colour as someone with red-blindness or green-blindness sees it (Vienot, Brettel and Mollon, 1999, in
 *  linear light) — enough to ask whether two colours stay apart for them. */
export function seenWith(rgb: Rgb, kind: "protanopia" | "deuteranopia"): Rgb {
  const matrix =
    kind === "protanopia"
      ? [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]]
      : [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]]
  const linear = (channel: number): number => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const encode = (value: number): number => {
    const clamped = Math.max(0, Math.min(1, value))
    return Math.round(255 * (clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055))
  }
  const [r, g, b] = [linear(rgb[0]), linear(rgb[1]), linear(rgb[2])]
  const [x, y, z] = matrix.map((row) => encode((row[0] ?? 0) * r + (row[1] ?? 0) * g + (row[2] ?? 0) * b))
  return [x ?? 0, y ?? 0, z ?? 0]
}

// --- Asking the game --------------------------------------------------------------------------------

/** The cell a glyph in `role` makes, with the blends a test asks about. */
function inRole(role: StyleRole | undefined, fade: number, tint: RoleTint | undefined) {
  return {
    glyph: "x",
    style: { ...(role === undefined ? {} : { fgRole: role }), ...(fade > 0 ? { fade } : {}), ...(tint === undefined ? {} : { tint }) },
  }
}

/** The colour a glyph in `role` is drawn in at a depth, after its tint and fade: the entry a 256-colour
 *  terminal shows, not the exact colour it could only approximate; plain text in monochrome, which has no
 *  role colours. */
export function rgbFor(role: StyleRole | undefined, colors: ColorDepth, theme: Theme = DEFAULT_THEME, fade = 0, tint?: RoleTint): Rgb {
  return resolveCell(inRole(role, fade, tint), colors, theme).foreground
}

/** The foreground SGR parameters a glyph in `role` is sent with (`38;5;n` or `38;2;r;g;b`); none in monochrome. */
export function sgrFor(role: StyleRole | undefined, colors: ColorDepth, theme: Theme = DEFAULT_THEME, fade = 0, tint?: RoleTint): readonly number[] {
  const { sgr } = resolveCell(inRole(role, fade, tint), colors, theme)
  return colors === "monochrome" ? [] : sgr.slice(0, sgr[1] === 2 ? 5 : 3)
}
