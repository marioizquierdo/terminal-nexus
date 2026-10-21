// The style role vocabulary and the colour depths that resolve it (`docs/system-design/presentation.md`).
//
// A role is never a colour. `fgRole: "player.a"` is what a cell carries; which colour that becomes is
// the colour depth's business, and that is what makes monochrome a setting rather than a rewrite. Every
// depth shows the same Pulse with the same information: **monochrome is the floor**, where every fact
// still reads (so the game is whole and testable on any terminal), and the higher depths buy fidelity,
// not facts. It is not the look the game is designed for: the read of a battle is told in backgrounds,
// contrast and blends, which the colour depths have and monochrome stands in for. Colour never carries
// ownership, target, danger, or health alone — sides are told apart by letter case, factions by glyph
// family, terrain by shape, salvage by its own character.
//
// **The game owns every colour it draws, the background included.** At 256 colours and in millions a
// cell is always two colours, its glyph's and its fill: the fill is its `bgRole` or the theme's
// background, and nothing is left to the terminal's own theme, so a Solarized terminal, a purple one and
// a plain black one all show the same game, and a fade or a see-through mix lands exactly on the
// background it blends toward. The one depth that leaves the terminal's colours alone is monochrome.
//
// `resolveCell`, at the bottom, is where a cell's roles become what a renderer draws — for the ANSI
// writer, the browser page's canvas and OpenTUI alike, so the three cannot disagree about a cell. It
// works the cell's colours out exactly (blends, dim, inverse video, see-through), then turns them into
// the depth in one last pass, so no depth has code of its own.

import type { ColorDepth, Theme } from "../terminal/display.ts"
import { DEFAULT_THEME } from "../terminal/display.ts"
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
  // Slow ground: thorny scrub a unit takes twice as long to cross. A dry olive, quieter than the deposit's gold and
  // apart from both players' hues.
  "terrain.scrub",
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
  // Burning ground (a Citizen mortar's shell sets it alight), red and yellow and mostly see-through (Mario: "red and
  // yellow, more transparent and use flashing effect instead of constant color"): a low flame's red, a tall flame's
  // yellow; the faint scorch under every tile that burns, and the red glow a tile flashes while a tall flame stands on
  // it — those two fills only, never a glyph's colour, the scorch drawn under units and flames alike.
  "fx.fire",
  "fx.fire.tall",
  "fx.fire.ground",
  "fx.fire.glow",
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

/**
 * The background: the colour every cell without a fill of its own is painted, at 256 colours and in
 * millions. The game paints it rather than leaving the terminal's to show through (monochrome alone
 * leaves it), so the palette is always read against the background it was chosen for and a fade is a
 * walk toward a colour that is really there. Chosen with the roles, not borrowed from any terminal: dark
 * is a neutral near-black that every role was set against, light a warm paper white.
 */
export const BACKGROUND_RGB: Readonly<Record<Theme, Rgb>> = {
  dark: [10, 10, 12],
  light: [242, 240, 234],
}

/** The role a cell with no `fgRole` draws its glyph in: plain text. */
const INK_ROLE: StyleRole = "chrome.value"

/**
 * One table per theme: each role's colour as RGB, the single source every depth is made from. Truecolor
 * draws it exactly and 256 colours takes the nearest entry of the xterm palette (`nearestIndexed`,
 * below), so a palette change is made once and nothing else is tuned or playtested. This is where the
 * factions' own palettes get to show up — Citizen rust and gunmetal against Ravel neon and acid, from
 * the lore document. The `dark` table is the reference: the one the lore and every screenshot so far were
 * designed against, and the one to extend first when a role needs a stronger identity.
 *
 * There is no sixteen-colour table, on purpose (`ColorDepth`, `src/terminal/display.ts`, has the reason):
 * the 256 search starts at index 16 because indices 0 to 15 are the terminal's, not the game's.
 *
 * Playtest findings folded into the values:
 *
 *   - `chrome.muted`, `chrome.label` and `chrome.frame` are bright enough to read after the `dim`
 *     attribute softens them: every `chrome.muted` cell in compose.ts is also drawn dim, so the role's
 *     own colour compounds with a second darkening ("can't barely see the help text"). The frame and the
 *     map's edge carry the same `dim` on their soft segments and took the muted role's colour for it
 *     ("during day time I was not able to tell where the UI is").
 *   - Light theme `player.a`/`player.b` are two colours that each read as their own, not one colour and a
 *     near-black. An earlier retune darkened Ravel green until the pair cleared a 3:1 mutual contrast, and
 *     "RAID" read as plain text (a grey at 256 colours, the cube having no dark green of that depth). The
 *     colour-blindness worry behind that floor does not need it: simulated with protanopia and
 *     deuteranopia the pair is as far apart in Lab (Delta E 70 and over) as the near-black one was, orange
 *     and green still parting on lightness and on the blue-yellow axis, and ownership is carried by letter
 *     case and glyph family anyway. `player.b` is nearly xterm's own forest green (0, 95, 0): 6.9:1 against
 *     the background, and the same colour at 256.
 *   - A few roles were moved a few points (under 3.5 of lightness, 6 degrees of hue) to sit near an entry
 *     of the xterm cube, so 256 colours shows what millions shows within a Delta E of 12 for every role
 *     (`tests/palette.test.ts` holds the budget): a new role is placed by eye in millions and nudged only
 *     if the test says its 256 match drifted.
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
    "terrain.scrub": [124, 132, 84],
    // Citizen rust orange against Ravel bioluminescent cyan-green: the two Energy palettes the lore
    // gives the factions, which later content work will pair.
    "player.a": [201, 118, 68],
    "player.b": [104, 226, 132],
    "item.salvage": [124, 158, 118],
    "notice.gate": [232, 86, 76],
    "fx.trail": [110, 116, 124],
    "fx.kinetic": [198, 202, 208],
    "fx.blast": [254, 136, 24],
    "fx.debris": [148, 142, 132],
    "fx.critical": [244, 178, 44],
    "fx.flash": [255, 255, 255],
    // A red low flame and a yellow tall one, apart from the blast's orange and the critical's gold. The scorch is
    // the ground's own near-black taken an eighth of the way toward a flame's red, so the patch reads as ground with
    // heat in it rather than a red carpet (at 256 colours the nearest is a grey a step up from the ground); the glow
    // a tall flame flashes on is two fifths of the way (the cube's darkest red at 256).
    "fx.fire": [226, 80, 64],
    "fx.fire.tall": [252, 208, 72],
    "fx.fire.ground": [36, 16, 13],
    "fx.fire.glow": [100, 32, 20],
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
    "terrain.scrub": [120, 126, 76],
    // Two sides that each read as their own colour on the pale background (see the PALETTE doc comment
    // above for why `player.b` is no longer near-black).
    "player.a": [211, 98, 21],
    "player.b": [0, 96, 16],
    "item.salvage": [80, 120, 72],
    "notice.gate": [176, 32, 24],
    "fx.trail": [150, 144, 136],
    "fx.kinetic": [64, 60, 56],
    "fx.blast": [184, 84, 16],
    "fx.debris": [120, 110, 96],
    "fx.critical": [168, 110, 8],
    "fx.flash": [8, 8, 8],
    // The flames darkened to read on the pale ground: a red apart from the Citizens' own orange, and a deep gold for
    // the tall one. The scorch is the paper barely warmed, lighter than the old peach so both sides' letters stay
    // clear of it; the glow a tall flame flashes on a pale rose.
    "fx.fire": [190, 50, 10],
    "fx.fire.tall": [156, 108, 0],
    "fx.fire.ground": [248, 232, 224],
    "fx.fire.glow": [250, 206, 190],
    // Dark enough to read on the pale ground, each still clearly its own hue.
    "fx.hue.red": [192, 32, 32],
    "fx.hue.yellow": [156, 118, 0],
    "fx.hue.green": [24, 136, 32],
    "fx.hue.cyan": [2, 130, 156],
    "fx.hue.blue": [16, 86, 206],
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

type Lab = readonly [number, number, number]

/** A colour in CIE L*a*b*, where distance is how different two colours look rather than how far apart their
 *  channels are — the space the 256 colours are matched in. */
function toLab(rgb: Rgb): Lab {
  const linear = (channel: number): number => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = [linear(rgb[0]), linear(rgb[1]), linear(rgb[2])]
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

/** The 240 colours a 256-colour match may choose (16-255), each already in Lab. */
const XTERM_CANDIDATES: readonly Readonly<{ index: number; lab: Lab }>[] = Array.from({ length: 240 }, (_, offset) => ({
  index: offset + 16,
  lab: toLab(xterm256Rgb(offset + 16)),
}))

/**
 * The 256-colour index that looks most like an RGB value — "process the colour, then a final pass turns it
 * into the depth". Nearest by distance in Lab, not in RGB: the colour cube is coarse (six steps a channel),
 * and an RGB match sends a dark saturated colour to a grey and a faded red to a muddy brown that a
 * perceptual match keeps red. Searches only the cube and greyscale range (16-255): the sixteen system
 * colours are the player's terminal theme's, not ours, so no colour is ever chosen from them.
 */
function nearestIndexed(rgb: Rgb): number {
  const [l, a, b] = toLab(rgb)
  let best = 16
  let bestDistance = Infinity
  for (const candidate of XTERM_CANDIDATES) {
    const dl = l - candidate.lab[0]
    const da = a - candidate.lab[1]
    const db = b - candidate.lab[2]
    const distance = dl * dl + da * da + db * db
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate.index
    }
  }
  return best
}

/** `amount` (clamped to 0-1) of the way from one colour to another, each channel rounded. */
function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  const t = Math.max(0, Math.min(1, amount))
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
  ]
}

/** `nearestIndexed` walks 240 candidates and every cell of every frame asks, so the answers are kept. The
 *  game uses a few hundred distinct colours (the roles, and the steps of the blends between them), so the
 *  cache is small; it starts over past 4096 rather than grow with an animation that never repeats. */
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

/** A colour as a depth shows it: the RGB it comes out as, and the SGR parameters that say so (what follows
 *  `38` or `48`). */
type Shown = Readonly<{ rgb: Rgb; params: readonly number[] }>

/**
 * The last step of every colour the game draws, and the only place a depth is looked at. Truecolor shows
 * any colour as it is; 256 colours shows the nearest of its entries, and `rgb` is that entry's own, so a
 * renderer that draws RGB (the canvas, OpenTUI) shows exactly what a 256-colour terminal shows, not a
 * colour the terminal cannot.
 */
function shownAt(rgb: Rgb, colors: Exclude<ColorDepth, "monochrome">): Shown {
  if (colors === "truecolor") return { rgb, params: [2, rgb[0], rgb[1], rgb[2]] }
  const index = nearestIndexedCached(rgb)
  return { rgb: xterm256Rgb(index), params: [5, index] }
}

/**
 * A foreground role pulled part of the way toward another role — the style-role operation for
 * light on a placed building's characters. `amount` is `0` (the cell's own role) to `1`
 * (entirely `role`). Like `fade`, the cell still carries only roles and a number, never a colour: the
 * theme decides what either role looks like, and the depth decides how much of a blend it can show.
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

/**
 * The exact RGB of a role after its tint and fade — the one place both blends meet, and the only
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
 * How much of its colour a dimmed glyph keeps: the browser page's old approximation of the terminal's
 * "faint", and now the game's own rule at 256 colours and in millions. A terminal's faint is whatever
 * that terminal makes of it (a blend toward its own background, a darkening, sometimes nothing), and the
 * game's muted text is chosen to read after it; so where there are colours the game dims by mixing the
 * glyph toward its own cell by `1 - DIM_ALPHA` (`resolveCell`), the same on every terminal, and only
 * monochrome, which has no colours to mix, sends the attribute and leaves it to the terminal.
 */
export const DIM_ALPHA = 0.55

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
 * The cell's own two colours, exactly: the glyph's (its `fgRole` after tint and fade, plain text when it
 * has none) and the fill (its `bgRole`, or the theme's background), swapped by inverse video. What the cell
 * would show before any depth, dim or see-through style is applied to it; `resolveCell` and
 * `seeThroughColours` both start here, so they cannot disagree about what is being drawn.
 */
function cellColours(cell: Cell, theme: Theme): Readonly<{ glyph: Rgb; fill: Rgb }> {
  const style = cell.style
  const ink = blendedRgb(PALETTE[theme][style.fgRole ?? INK_ROLE], theme, style.fade ?? 0, style.tint)
  const fill = style.bgRole === undefined ? BACKGROUND_RGB[theme] : PALETTE[theme][style.bgRole]
  return style.inverse === true ? { glyph: fill, fill: ink } : { glyph: ink, fill }
}

/**
 * The see-through cursor (`SeeThrough`) resolved at a depth, or `null` where it
 * changes nothing — no see-through style, an alpha of 0, or a low alpha in monochrome, which has no blend. The one
 * place a see-through style becomes colour; `resolveCell` calls it for every renderer.
 *
 * The cell's own colours are worked out first, as the renderers already draw them (`cellColours`: an
 * `inverse` cell has swapped them, so the see-through style mixes what is actually seen), and a blank
 * cell has no glyph, so its glyph is its fill and the cell becomes simply that mixed toward the cursor.
 * Then `mixSeeThrough`, with the see-through style's role as the cursor colour and the theme's background
 * as the cursor's glyph colour — the real cursor is inverse video, so its glyph is drawn in the background.
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
  const background = BACKGROUND_RGB[theme]
  const alpha = Math.min(1, seeThrough.alpha)
  if (colors === "monochrome") {
    return alpha < SEE_THROUGH_STEP ? null : { foreground: background, background: PALETTE[theme][INK_ROLE], sgr: [7] }
  }
  const { glyph, fill } = cellColours(cell, theme)
  const blank = cell.glyph === " " || cell.glyph === ""
  const mixed = mixSeeThrough(fill, blank ? fill : glyph, cursor, background, alpha)
  const shownInk = shownAt(mixed.foreground, colors)
  const shownFill = shownAt(mixed.background, colors)
  return {
    foreground: shownInk.rgb,
    background: shownFill.rgb,
    sgr: [38, ...shownInk.params, 48, ...shownFill.params],
  }
}

/**
 * A cell's style resolved at a depth, in both forms the renderers take. `resolveCell` is the one place
 * a cell's own colours, its inverse video, its dim and its see-through style meet, so the ANSI writer,
 * the browser page's canvas and OpenTUI only draw what it says and cannot disagree about a cell.
 */
export type ResolvedCell = Readonly<{
  /**
   * The ANSI writer's SGR parameters, whole: the colours (the glyph's, then the fill's — or the
   * see-through style's mix in their place), then bold 1 and underline 4 as the cell has them. At 256
   * colours and in millions that is all: inverse video and faint are already in the colours, so no
   * terminal's idea of either can change what is drawn. Monochrome has no colours to carry them, so it
   * sends faint 2 and reverse video 7 as the cell has them. Empty for a plain monochrome cell, so a blank
   * there never costs an escape.
   */
  sgr: readonly number[]
  /** The glyph's colour for an RGB renderer, with inverse video, dim and the see-through style applied. */
  foreground: Rgb
  /** The cell's fill for an RGB renderer, likewise, or `null` in monochrome, where the terminal's own shows. */
  background: Rgb | null
  bold: boolean
  /**
   * Faint, for the one depth that cannot mix it into a colour: monochrome, where it is the cell's `dim`.
   * Never set where colours exist, and never where a see-through style shows (the mix already says
   * exactly how bright the glyph is, and faint on top would fade it back toward the now lighter fill —
   * the very loss the real cursor avoids by clearing `dim` on bare ground tiles, `src/view/build.ts`).
   */
  dim: boolean
  underline: boolean
}>

/**
 * What a renderer draws for `cell` at `colors` on `theme`. At 256 colours and in millions its colours are
 * its glyph's (`fgRole` after tint and fade) and its fill (`bgRole`, or the theme's background), inverse video
 * swapping the two and `dim` mixing the glyph `1 - DIM_ALPHA` of the way toward the fill, all worked out
 * exactly and then shown at the depth (`shownAt`). Monochrome has no colour to paint: bold, faint,
 * underline and reverse video are sent as they are, and an RGB renderer gets plain text on the background.
 * A see-through style that shows at this depth (`seeThroughColours`) replaces all of that, and the
 * cell's dim with it; bold and underline always stay the cell's own.
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
  if (colors === "monochrome") {
    const sgr: number[] = []
    if (bold) sgr.push(1)
    if (dim) sgr.push(2)
    if (underline) sgr.push(4)
    if (inverse) sgr.push(7)
    const ink = PALETTE[theme][INK_ROLE]
    return {
      sgr,
      foreground: inverse ? BACKGROUND_RGB[theme] : ink,
      background: inverse ? ink : null,
      bold,
      dim,
      underline,
    }
  }
  const { glyph, fill } = cellColours(cell, theme)
  const shownInk = shownAt(dim ? mixRgb(glyph, fill, 1 - DIM_ALPHA) : glyph, colors)
  const shownFill = shownAt(fill, colors)
  const sgr = [38, ...shownInk.params, 48, ...shownFill.params]
  if (bold) sgr.push(1)
  if (underline) sgr.push(4)
  return { sgr, foreground: shownInk.rgb, background: shownFill.rgb, bold, dim: false, underline }
}
