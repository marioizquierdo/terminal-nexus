// The style role vocabulary and the render tiers that resolve it (`docs/system-design/presentation.md`).
//
// A role is never a colour. `fgRole: "player.a"` is what a cell carries; which colour that becomes
// is the colour depth's business, and that is what makes monochrome a setting rather than a
// rewrite. Every tier shows the same Pulse with the same information: **monochrome is the floor,
// not the degraded mode** (the design fixes this), and the higher tiers buy fidelity, not
// facts. Colour never carries ownership, target, danger, or health alone — sides are told apart by
// letter case, factions by glyph family, terrain by shape, salvage by its own character.
//
// `resolveCell`, at the bottom, is where a cell's roles become what a renderer draws — for the ANSI
// writer, the browser page's canvas and OpenTUI alike, so the three cannot disagree about a cell.

import type { ColorDepth, Theme } from "../terminal/display.ts"
import { DEFAULT_THEME, THEMES } from "../terminal/display.ts"
import type { Cell } from "./frame.ts"

// The colour depth, theme and glyph-pack vocabulary lives below the view (`src/terminal/display.ts`);
// the view re-exports it so a consumer of the roles still finds it here.
export type { ColorDepth, Theme } from "../terminal/display.ts"
export { COLOR_DEPTHS, DEFAULT_THEME, THEMES, parseColorDepth, parseTheme } from "../terminal/display.ts"

export const STYLE_ROLES = [
  "chrome.frame",
  "chrome.title",
  "chrome.label",
  "chrome.value",
  "chrome.muted",
  // The bracketed hotkey on a menu row — `docs/system-design/input.md`: "the bracketed key is the carrier that
  // survives monochrome; a style role (chrome.hotkey) colours it where colour exists, and colour
  // never carries it alone." (A role name the design fixed before the renderer existed.)
  "chrome.hotkey",
  // The map's edge, drawn quietly (Mario: "the border color should probably be less
  // accentuated"; he kept it over the frame's own colour). A grey between the
  // frame's and the ground's, so the edge still reads as a wall while the menu and the bars stay the
  // loudest lines on screen.
  "chrome.edge",
  "terrain.plain",
  "terrain.rock",
  "terrain.deposit",
  "player.a",
  "player.b",
  "item.salvage",
  "notice.gate",
  // Effect roles. Kinetic and blast are the two weapon languages: Citizens fire rounds, Ravels set
  // things off, and a craft rule in `effects.md` says those must not share a look.
  "fx.trail",
  "fx.kinetic",
  "fx.blast",
  "fx.debris",
  "fx.critical",
  "fx.flash",
  // The rainbow (Mario: "colour interpolation (a rainbow, lighting on the characters)").
  // Six hues the theme owns like any other role, so a rainbow is a walk through roles rather than a
  // list of colours in a view module. Used by the shading and particle recipes' rainbow palettes
  // (`src/view/effects/shading.ts`, `particles.ts`) — a placed building's light and sparks today.
  "fx.hue.red",
  "fx.hue.yellow",
  "fx.hue.green",
  "fx.hue.cyan",
  "fx.hue.blue",
  "fx.hue.magenta",
] as const

export type StyleRole = (typeof STYLE_ROLES)[number]

/** A colour as red, green and blue, 0 to 255 — only ever what a role resolves to, never what a cell carries. */
export type Rgb = readonly [number, number, number]

/** The rainbow, in order round the wheel — what a "rainbow" light walks through. */
export const RAINBOW_ROLES: readonly StyleRole[] = [
  "fx.hue.red",
  "fx.hue.yellow",
  "fx.hue.green",
  "fx.hue.cyan",
  "fx.hue.blue",
  "fx.hue.magenta",
]

/** The frame's own background, for a renderer that paints one explicitly (OpenTUI, the canvas) rather
 * than leaving the terminal's ambient background to show through (direct ANSI). */
export const BACKGROUND_RGB: Readonly<Record<Theme, Rgb>> = {
  dark: [10, 10, 12],
  light: [242, 240, 234],
}

/**
 * One table per theme: each role's colour as RGB, the single source every tier is made from. Truecolor
 * draws it exactly and 256 colours takes the nearest entry of the xterm palette (`nearestIndexed`,
 * below), so a palette change is made once and nothing else is tuned or playtested. This is where the
 * factions' own palettes get to show up — Citizen rust and gunmetal against Ravel neon and acid, from
 * the lore document. The `dark` table is the reference: the one the lore and every screenshot so far were
 * designed against, and the one to extend first when a role needs a stronger identity.
 *
 * **There is no sixteen-colour table, on purpose** (dropped 2026-10-15; the lessons file has the
 * reasons). The sixteen ANSI colours are whatever the player's terminal theme says they are, so nothing
 * here can know what a code looks like or blend toward it, and matching the sixteen against a guessed
 * palette is no fix: measured, it sent `chrome.muted` to bright black and gave `player.a` and `player.b`
 * the same grey. The game draws with backgrounds, blends and see-through mixes that need real RGB, so
 * below 256 colours it is monochrome, which sends no colour code and leaves the terminal's own colours
 * alone. For the same reason the 256 search starts at index 16: indices 0 to 15 are the terminal's.
 *
 * Playtest findings folded into the values:
 *
 *   - `chrome.muted`, `chrome.label` and `chrome.frame` are bright enough to read after the `dim`
 *     attribute softens them: every `chrome.muted` cell in compose.ts is also drawn dim, so the role's
 *     own colour compounds with a second darkening ("can't barely see the help text"). The frame and the
 *     map's edge carry the same `dim` on their soft segments and took the muted role's colour for it
 *     ("during day time I was not able to tell where the UI is").
 *   - Light theme `player.a`/`player.b` were retuned by lightness only — hue and saturation unchanged,
 *     rust stays rust, green stays green. Measured WCAG contrast against each other was 1.08:1 (the dark
 *     theme's 2.08:1 is a smaller gap, left alone): both sides cleared the 3:1 floor against the
 *     background individually but sat at almost identical brightness next to *each other*, a real problem
 *     for red-green colour blindness given the palette's hue choice. A light background structurally
 *     limits the fix to mostly one direction: lightening a dark foreground role toward a bright
 *     background immediately costs that role its own contrast against the background, while darkening
 *     one has no such penalty and buys contrast against *both* the background and the other role at
 *     once — which is why `player.b` (Ravel green) moved much further than `player.a`. New pair:
 *     3.55:1 and 11.47:1 against the light background, 3.23:1 against each other.
 */
const PALETTE: Readonly<Record<Theme, Record<StyleRole, Rgb>>> = {
  dark: {
    // The border carries `dim` on its own soft (scrolling) segments, so it takes `chrome.muted`'s
    // colour: a value already proven legible dimmed, rather than a new number invented for this role.
    "chrome.frame": [150, 158, 168],
    "chrome.title": [236, 240, 245],
    "chrome.label": [148, 156, 166],
    "chrome.value": [206, 213, 221],
    "chrome.muted": [150, 158, 168],
    // A cyan distinct from every other role's hue — not the rust/green the two players already own,
    // not terrain.deposit's gold — so a bracketed hotkey reads as "interactive chrome," never as a
    // gameplay colour.
    "chrome.hotkey": [86, 204, 214],
    // Roughly two thirds of the way from the ground to `chrome.frame`: reads as a block or a line, but
    // not as dimmed text (why the frame itself is brighter).
    "chrome.edge": [100, 106, 116],
    "terrain.plain": [72, 78, 86],
    "terrain.rock": [128, 132, 138],
    "terrain.deposit": [198, 160, 40],
    // Citizen rust orange against Ravel bioluminescent cyan-green: the two Energy palettes the lore
    // gives the factions, which later content work will pair.
    "player.a": [201, 118, 68],
    "player.b": [104, 226, 132],
    "item.salvage": [124, 158, 118],
    "notice.gate": [232, 86, 76],
    "fx.trail": [110, 116, 124],
    "fx.kinetic": [198, 202, 208],
    "fx.blast": [242, 132, 44],
    "fx.debris": [148, 142, 132],
    "fx.critical": [244, 178, 44],
    "fx.flash": [255, 255, 255],
    "fx.hue.red": [240, 84, 84],
    "fx.hue.yellow": [240, 212, 72],
    "fx.hue.green": [96, 222, 112],
    "fx.hue.cyan": [72, 210, 232],
    "fx.hue.blue": [104, 140, 255],
    "fx.hue.magenta": [222, 112, 232],
  },
  // A second, independent table rather than a formula on the dark one (invert-and-clamp reliably
  // ruins exactly the saturated faction colours that matter most) - every entry chosen by hand
  // against BACKGROUND_RGB.light, keeping each role's hue identity but moving its lightness to the
  // other end. Same structure as `dark`, so a future third theme is a table, not a redesign.
  light: {
    // Same as dark's chrome.frame, above: this theme's own `chrome.muted` (already proven legible dimmed).
    "chrome.frame": [110, 104, 96],
    "chrome.title": [28, 26, 24],
    "chrome.label": [90, 86, 80],
    "chrome.value": [48, 44, 40],
    "chrome.muted": [110, 104, 96],
    // Same hue as dark's, moved dark enough to stay legible on a light background instead of bright.
    "chrome.hotkey": [8, 110, 120],
    // The same step toward the pale ground from this theme's `chrome.frame`.
    "chrome.edge": [164, 158, 148],
    "terrain.plain": [196, 192, 184],
    "terrain.rock": [70, 66, 60],
    "terrain.deposit": [168, 124, 24],
    // Lightness-only retune (hue and saturation unchanged) so the two sides clear a real mutual-contrast
    // floor rather than only each individually clearing it against the background - see the PALETTE doc
    // comment above for the measurement and why the two roles moved by such different amounts.
    "player.a": [201, 96, 41],
    "player.b": [15, 56, 32],
    "item.salvage": [80, 120, 72],
    "notice.gate": [176, 32, 24],
    "fx.trail": [150, 144, 136],
    "fx.kinetic": [64, 60, 56],
    "fx.blast": [184, 84, 16],
    "fx.debris": [120, 110, 96],
    "fx.critical": [168, 110, 8],
    "fx.flash": [8, 8, 8],
    // Dark enough to read on the pale ground, each still clearly its own hue.
    "fx.hue.red": [192, 32, 32],
    "fx.hue.yellow": [156, 118, 0],
    "fx.hue.green": [20, 132, 52],
    "fx.hue.cyan": [0, 122, 142],
    "fx.hue.blue": [36, 72, 204],
    "fx.hue.magenta": [156, 40, 168],
  },
}

const XTERM_CUBE_STEPS: readonly number[] = [0, 95, 135, 175, 215, 255]

/**
 * What xterm shows for a 256-colour index above the 16 system colours (whose look is each terminal's
 * own): a 6x6x6 colour cube (indices 16-231), then a 24-step greyscale ramp (232-255). Exported for the
 * capture scripts, which read the ANSI writer's indices back into pixels with it
 * (`scripts/lib/terminal-capture.mjs`).
 */
export function xterm256Rgb(index: number): Rgb {
  if (index < 232) {
    const offset = index - 16
    const r = XTERM_CUBE_STEPS[Math.floor(offset / 36)] ?? 0
    const g = XTERM_CUBE_STEPS[Math.floor((offset % 36) / 6)] ?? 0
    const b = XTERM_CUBE_STEPS[offset % 6] ?? 0
    return [r, g, b]
  }
  const grey = 8 + (index - 232) * 10
  return [grey, grey, grey]
}

/**
 * The 256-colour index whose xterm rendering is nearest an RGB value, by squared distance — the
 * "process the colour, then a final pass turns it into the tier" step. Searches only the cube
 * and greyscale range (16-255): the sixteen system colours are the player's terminal theme's, not
 * ours, so no colour is ever chosen from them. Cheap enough to call once per role per theme at module
 * load (26 x 2 x 240 candidates) rather than needing its own cache beyond `DERIVED_256` below.
 */
function nearestIndexed(rgb: Rgb): number {
  let best = 16
  let bestDistance = Infinity
  for (let index = 16; index <= 255; index += 1) {
    const candidate = xterm256Rgb(index)
    const dr = rgb[0] - candidate[0]
    const dg = rgb[1] - candidate[1]
    const db = rgb[2] - candidate[2]
    const distance = dr * dr + dg * dg + db * db
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  }
  return best
}

/**
 * The 256-colour tier, derived once from each role's own colour rather than authored. Computed at
 * module load and read as a plain lookup at render time, which is why it is precomputed rather than
 * called from `sgrFor` directly on every cell of every frame.
 */
const DERIVED_256: Readonly<Record<Theme, Record<StyleRole, number>>> = (() => {
  const result = {} as Record<Theme, Record<StyleRole, number>>
  for (const theme of THEMES) {
    const byRole = {} as Record<StyleRole, number>
    for (const role of STYLE_ROLES) {
      byRole[role] = nearestIndexed(PALETTE[theme][role])
    }
    result[theme] = byRole
  }
  return result
})()

/**
 * A foreground role pulled part of the way toward another role — the style-role operation for
 * light on a placed building's characters. `amount` is `0` (the cell's own role) to `1`
 * (entirely `role`). Like `fade`, the cell still carries only roles and a number, never a colour: the
 * theme decides what either role looks like, and the tier decides how much of a blend it can show.
 *
 * - `truecolor`: the two roles' RGB, interpolated exactly;
 * - `color256`: the same blend, then the nearest palette entry;
 * - `monochrome`: nothing at all, like every colour. The placement's frames carry it there instead
 *   (a scaffold is drawn plain and the finished building bold).
 *
 * Applied before `fade`, so a lit cell can still be faded; nothing does both today.
 */
export type RoleTint = Readonly<{ role: StyleRole; amount: number }>

/**
 * A see-through cursor laid over a cell (the Explore Map and hand-off cursor): `role`'s colour at
 * `alpha` (0 to 1) over whatever is drawn there. The cell's background becomes `alpha` of the role's
 * colour and `1 - alpha` of what was there — itself 80% the cell's own background and 20% its glyph's
 * colour, the glyph being taken to cover about a fifth of the cell — and the glyph, which stays, is
 * drawn `alpha` of the way toward the colour the real cursor draws glyphs in (the theme's background,
 * since the cursor is inverse video). A role and a number, never a colour, like `RoleTint`: an exact mix
 * at truecolor, the nearest colour at 256, and in monochrome the plain inverse cursor (from an alpha
 * of one half up; below it, nothing). Where it shows, the cell's own `dim` is not
 * applied (`resolveCell`). `seeThroughColours`, below, is the one place it becomes colour. Set only by
 * the Explore Map hand-off's travelling cursor so far.
 */
export type SeeThrough = Readonly<{ role: StyleRole; alpha: number }>

/** `amount` (clamped to 0-1) of the way from one colour to another, each channel rounded. */
function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  const t = Math.max(0, Math.min(1, amount))
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
  ]
}

/** `nearestIndexed` walks 240 candidates; a tinted, faded or mixed cell asks again every frame, and a
 *  placement's light passes through the same few dozen blends, so the answers are kept. Bounded: an
 *  animation is a handful of roles times a few dozen steps, and the cache starts over past 4096. */
const NEAREST_CACHE = new Map<number, number>()

function nearestIndexedCached(rgb: Rgb): number {
  const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]
  const cached = NEAREST_CACHE.get(key)
  if (cached !== undefined) return cached
  const found = nearestIndexed(rgb)
  if (NEAREST_CACHE.size > 4096) NEAREST_CACHE.clear()
  NEAREST_CACHE.set(key, found)
  return found
}

/**
 * The truecolor RGB of a role after its tint and fade — the one place both blends meet, and the only
 * place a fade scalar touches a colour (the recommended shape): the tinted colour taken `fade` of the
 * way toward the theme's background. `mixRgb` clamps the amount, so a caller that hands in more than 1
 * still lands on the background rather than past it.
 */
function blendedRgb(colour: Rgb, theme: Theme, fade: number, tint: RoleTint | undefined): Rgb {
  const target = tint === undefined || tint.amount <= 0 ? undefined : PALETTE[theme][tint.role]
  const tinted = target === undefined ? colour : mixRgb(colour, target, tint?.amount ?? 0)
  return fade > 0 ? mixRgb(tinted, BACKGROUND_RGB[theme], fade) : tinted
}

/**
 * SGR parameters for a role at a tier. Monochrome returns nothing at all — not a grey, *nothing* —
 * so that a monochrome frame provably contains no colour code. `theme` defaults to `DEFAULT_THEME`
 * so every existing caller that has not been taught about themes yet keeps today's look exactly.
 *
 * `fade` (default `0`, meaning none) is the transparency scalar — see `CellStyle.fade`'s doc
 * comment in `frame.ts` for the full contract. It resolves at `color256` (a fresh nearest-index
 * search against the faded colour, rather than the precomputed `DERIVED_256` table) and `truecolor` (a
 * direct blend); `monochrome` ignores it entirely, having nothing between a role's own look and off:
 * it stays exactly as `bold`/`dim`/`inverse` already describe it.
 */
export function sgrFor(
  role: StyleRole | undefined,
  colors: ColorDepth,
  theme: Theme = DEFAULT_THEME,
  fade = 0,
  tint?: RoleTint,
): readonly number[] {
  if (role === undefined || colors === "monochrome") return []
  const colour = PALETTE[theme][role]
  if (colour === undefined) return []
  const tinted = tint !== undefined && tint.amount > 0
  switch (colors) {
    case "color256":
      return fade > 0 || tinted
        ? [38, 5, nearestIndexedCached(blendedRgb(colour, theme, fade, tint))]
        : [38, 5, DERIVED_256[theme][role]]
    case "truecolor": {
      const [r, g, b] = blendedRgb(colour, theme, fade, tint)
      return [38, 2, r, g, b]
    }
    default:
      return []
  }
}

/** Background variants of the same colour, for the rare cell that needs one. `fade` is a `fgRole`
 *  scalar only (`CellStyle.fade`'s own doc comment) — this never resolves one. */
export function sgrBackgroundFor(
  role: StyleRole | undefined,
  colors: ColorDepth,
  theme: Theme = DEFAULT_THEME,
): readonly number[] {
  const foreground = sgrFor(role, colors, theme)
  if (foreground.length === 0) return []
  return [48, ...foreground.slice(1)]
}

/** What an RGB backend draws for a cell with no role, and for every cell in monochrome. */
const NEUTRAL_RGB: Rgb = [214, 218, 224]

/**
 * The same roles as RGB, for the renderers that take colours rather than SGR parameters (the canvas
 * and OpenTUI, through `resolveCell`). `monochrome` is a fixed neutral grey regardless of role, so
 * fade and tint have nothing to add there.
 */
export function rgbFor(
  role: StyleRole | undefined,
  colors: ColorDepth,
  theme: Theme = DEFAULT_THEME,
  fade = 0,
  tint?: RoleTint,
): Rgb {
  if (colors === "monochrome" || role === undefined) return NEUTRAL_RGB
  const colour = PALETTE[theme][role]
  if (colour === undefined) return NEUTRAL_RGB
  return blendedRgb(colour, theme, fade, tint)
}

/**
 * How much of a cell its glyph is taken to cover when a see-through style mixes what lies beneath it — the
 * owner's "assuming that the icon is about 20% of the surface".
 */
export const GLYPH_COVER = 0.2

/**
 * From this alpha up a see-through style shows in monochrome, as the plain cursor; below it, it shows
 * nothing there.
 */
export const SEE_THROUGH_STEP = 0.5

/**
 * The owner's mix, as plain arithmetic on three colours and the cursor's own glyph
 * colour. "If the background is black, the icon on the background is yellow, and the cursor is white,
 * then the cursor at 80% ... would be 80% white, and the other 20% split between black (80%) and
 * yellow (20%)":
 *
 * - the cell's fill becomes `alpha` of `cursor` and `1 - alpha` of what was there — itself
 *   `1 - GLYPH_COVER` of `background` and `GLYPH_COVER` of `glyph`;
 * - the glyph, which stays, is drawn `alpha` of the way from `glyph` toward `cursorGlyph` (the colour
 *   the real cursor draws its glyph in), so it stays readable on the lighter cell.
 *
 * Each channel is rounded once, at the end. Exported so a test can hold it to the owner's own numbers.
 */
export function mixSeeThrough(
  background: Rgb,
  glyph: Rgb,
  cursor: Rgb,
  cursorGlyph: Rgb,
  alpha: number,
): Readonly<{ foreground: Rgb; background: Rgb }> {
  const a = Math.max(0, Math.min(1, alpha))
  const fill = (channel: 0 | 1 | 2): number =>
    Math.round(
      (1 - a) * ((1 - GLYPH_COVER) * background[channel] + GLYPH_COVER * glyph[channel]) +
        a * cursor[channel],
    )
  const ink = (channel: 0 | 1 | 2): number => Math.round((1 - a) * glyph[channel] + a * cursorGlyph[channel])
  return { background: [fill(0), fill(1), fill(2)], foreground: [ink(0), ink(1), ink(2)] }
}

/** A cell's colours once its see-through style is resolved, in both forms `ResolvedCell` has. */
export type SeeThroughColours = Readonly<{
  /** The glyph's colour. */
  foreground: Rgb
  /** The cell's fill. */
  background: Rgb
  /**
   * SGR colour parameters for the ANSI writer. They replace the cell's own foreground, background
   * and inverse codes (the cell's inverse is already resolved into these).
   */
  sgr: readonly number[]
}>

/**
 * The see-through cursor (`SeeThrough`) resolved at a tier, or `null` where it
 * changes nothing — no see-through style, an alpha of 0, or a low alpha in monochrome, which has no blend. The one
 * place a see-through style becomes colour; `resolveCell` calls it for every renderer.
 *
 * The cell's own colours are worked out first, as the renderers already draw them: its glyph colour
 * `G` is its `fgRole` after tint and fade, its background `B` is its `bgRole` or the theme's
 * background, an `inverse` cell swaps the two (so the see-through style mixes what is actually seen), and a
 * blank cell has no glyph, so `G` is `B` and the cell becomes simply `B` mixed toward the cursor. Then
 * `mixSeeThrough`, with the see-through style's role as the cursor colour `C` and the theme's background as the
 * cursor's glyph colour — the real cursor is inverse video, so its glyph is drawn in the ground.
 *
 * - `truecolor`: that exact mix;
 * - `color256`: the nearest palette entry to each of the two mixed colours (the RGB returned is that
 *   entry's own, so an RGB backend shows what a 256-colour terminal shows);
 * - `monochrome`: no continuum, so a step — from `SEE_THROUGH_STEP` up, the plain cursor as inverse
 *   video alone, below it nothing. Never a colour code.
 *
 * Wherever it shows, the cell's own `dim` goes with it (`resolveCell`).
 */
export function seeThroughColours(
  cell: Cell,
  colors: ColorDepth,
  theme: Theme = DEFAULT_THEME,
): SeeThroughColours | null {
  const seeThrough = cell.style.seeThrough
  if (seeThrough === undefined || !(seeThrough.alpha > 0)) return null
  const cursor = PALETTE[theme][seeThrough.role]
  if (cursor === undefined) return null
  const ground = BACKGROUND_RGB[theme]
  const alpha = Math.min(1, seeThrough.alpha)
  if (colors === "monochrome") {
    return alpha < SEE_THROUGH_STEP ? null : { foreground: ground, background: NEUTRAL_RGB, sgr: [7] }
  }
  const style = cell.style
  const own = style.fgRole === undefined ? undefined : PALETTE[theme][style.fgRole]
  const ink = own === undefined ? NEUTRAL_RGB : blendedRgb(own, theme, style.fade ?? 0, style.tint)
  const fill = (style.bgRole === undefined ? undefined : PALETTE[theme][style.bgRole]) ?? ground
  const [beneath, glyph] = style.inverse === true ? [ink, fill] : [fill, ink]
  const blank = cell.glyph === " " || cell.glyph === ""
  const mixed = mixSeeThrough(beneath, blank ? beneath : glyph, cursor, ground, alpha)
  if (colors === "truecolor") {
    return { ...mixed, sgr: [38, 2, ...mixed.foreground, 48, 2, ...mixed.background] }
  }
  const foreground = nearestIndexedCached(mixed.foreground)
  const background = nearestIndexedCached(mixed.background)
  return {
    foreground: xterm256Rgb(foreground),
    background: xterm256Rgb(background),
    sgr: [38, 5, foreground, 48, 5, background],
  }
}

/**
 * A cell's style resolved at a tier, in both forms the renderers take. `resolveCell` is the one place
 * a cell's own colours, its inverse video, its dim and its see-through style meet, so the ANSI writer,
 * the browser page's canvas and OpenTUI only draw what it says and cannot disagree about a cell.
 */
export type ResolvedCell = Readonly<{
  /**
   * The ANSI writer's SGR parameters, whole: the colours (the foreground's, then the background's — or
   * the see-through style's mix in their place), then bold 1, faint 2, underline 4 and reverse video 7
   * as the cell has them. Empty for a plain cell, so a blank never costs an escape. Here, unlike in the
   * RGB form, reverse video is left to the terminal.
   */
  sgr: readonly number[]
  /** The glyph's colour for an RGB renderer, with inverse video and the see-through style applied. */
  foreground: Rgb
  /** The cell's fill for an RGB renderer, likewise, or `null` where the theme's own background shows. */
  background: Rgb | null
  bold: boolean
  /**
   * Faint: the cell's `dim`, except where a see-through style shows. The mix already says exactly how
   * bright the glyph is, and faint on top would fade it back toward the now lighter fill — the very loss
   * the real cursor avoids by clearing `dim` on bare ground (`src/view/build.ts`).
   */
  dim: boolean
  underline: boolean
}>

/**
 * What a renderer draws for `cell` at `colors` on `theme`. Its colours are its `fgRole` after tint
 * and fade and its `bgRole` (none in monochrome, which has no colour to paint); inverse video swaps
 * the two in the RGB form, the way a terminal does, with the theme's background standing in for a cell
 * that has no fill of its own (the map's solid edge is exactly that). A see-through style that shows
 * at this tier (`seeThroughColours`) replaces all of that, and the cell's dim with it; bold and
 * underline always stay the cell's own.
 */
export function resolveCell(cell: Cell, colors: ColorDepth, theme: Theme = DEFAULT_THEME): ResolvedCell {
  const style = cell.style
  const bold = style.bold === true
  const underline = style.underline === true
  const seen = seeThroughColours(cell, colors, theme)
  if (seen !== null) {
    const sgr = [...seen.sgr]
    if (bold) sgr.push(1)
    if (underline) sgr.push(4)
    return { sgr, foreground: seen.foreground, background: seen.background, bold, dim: false, underline }
  }
  const dim = style.dim === true
  const inverse = style.inverse === true
  const fade = style.fade ?? 0
  const sgr = [...sgrFor(style.fgRole, colors, theme, fade, style.tint), ...sgrBackgroundFor(style.bgRole, colors, theme)]
  if (bold) sgr.push(1)
  if (dim) sgr.push(2)
  if (underline) sgr.push(4)
  if (inverse) sgr.push(7)
  const ink = rgbFor(style.fgRole, colors, theme, fade, style.tint)
  const fill = style.bgRole === undefined || colors === "monochrome" ? null : rgbFor(style.bgRole, colors, theme)
  return {
    sgr,
    foreground: inverse ? (fill ?? BACKGROUND_RGB[theme]) : ink,
    background: inverse ? ink : fill,
    bold,
    dim,
    underline,
  }
}
