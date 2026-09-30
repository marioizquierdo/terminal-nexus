// The style role vocabulary and the render tiers that resolve it — engine.md 9.1 and 9.6.
//
// A role is never a colour. `fgRole: "player.a"` is what a cell carries; which colour that becomes
// is the capability mode's business, and that is what makes monochrome a setting rather than a
// rewrite. Every tier shows the same Pulse with the same information: **monochrome is the floor,
// not the degraded mode** (milestone-1-spike-battle.md 4.2), and the higher tiers buy fidelity, not
// facts. Colour never carries ownership, target, danger, or health alone — sides are told apart by
// letter case, factions by glyph family, terrain by shape, salvage by its own character.

export const STYLE_ROLES = [
  "chrome.frame",
  "chrome.title",
  "chrome.label",
  "chrome.value",
  "chrome.muted",
  // The bracketed hotkey on a menu row — engine.md 9.7: "the bracketed key is the carrier that
  // survives monochrome; a style role (chrome.hotkey) colours it where colour exists, and colour
  // never carries it alone." Named by canon before this gate, not invented here.
  "chrome.hotkey",
  // The map's edge, drawn quietly (feedback F25: "the border color should probably be less
  // accentuated"; the owner kept it over the frame's own colour, 2026-09-29). A grey between the
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
  // things off, and craft rule 2 in ascii-effects.md says those must not share a look.
  "fx.trail",
  "fx.kinetic",
  "fx.blast",
  "fx.debris",
  "fx.critical",
  "fx.flash",
  // The rainbow (gate 5I, feedback F9: "colour interpolation (a rainbow, lighting on the characters)").
  // Six hues the theme owns like any other role, so a rainbow is a walk through roles rather than a
  // list of colours in a view module — and at 16 colours each one is a real ANSI hue, so the walk
  // still reads as a rainbow there. Used by the shading and particle recipes' rainbow palettes
  // (`src/view/effects/shading.ts`, `particles.ts`) — a placed building's light and sparks today.
  "fx.hue.red",
  "fx.hue.yellow",
  "fx.hue.green",
  "fx.hue.cyan",
  "fx.hue.blue",
  "fx.hue.magenta",
] as const

export type StyleRole = (typeof STYLE_ROLES)[number]

/** The rainbow, in order round the wheel — what a "rainbow" light walks through (gate 5I). */
export const RAINBOW_ROLES: readonly StyleRole[] = [
  "fx.hue.red",
  "fx.hue.yellow",
  "fx.hue.green",
  "fx.hue.cyan",
  "fx.hue.blue",
  "fx.hue.magenta",
]

export type CapabilityMode = "monochrome" | "color16" | "color256" | "truecolor"

export const CAPABILITY_MODES: readonly CapabilityMode[] = [
  "monochrome",
  "color16",
  "color256",
  "truecolor",
]

export function parseCapability(value: string): CapabilityMode {
  const found = CAPABILITY_MODES.find((mode) => mode === value)
  if (found === undefined) {
    throw new Error(`unknown capability "${value}"; expected one of ${CAPABILITY_MODES.join(", ")}`)
  }
  return found
}

/**
 * Which background the palette assumes — engine.md 9.1's open question, answered minimally
 * (owner playtest: on a light terminal background, the dark theme's chrome text was nearly
 * invisible). Two fixed themes rather than a background probe: querying a terminal's actual
 * background colour (OSC 11) is unreliable across emulators and is real complexity for a Gate that
 * asked to start simple. `dark` is the default — it is the palette the lore and every screenshot so
 * far were designed against — and `light` is one explicit flag away. The door stays open for a real
 * themes/modding system later without anything here needing to change shape, only to grow more
 * entries.
 */
export type Theme = "dark" | "light"

export const THEMES: readonly Theme[] = ["dark", "light"]

export const DEFAULT_THEME: Theme = "dark"

export function parseTheme(value: string): Theme {
  const found = THEMES.find((theme) => theme === value)
  if (found === undefined) {
    throw new Error(`unknown theme "${value}"; expected one of ${THEMES.join(", ")}`)
  }
  return found
}

/** The frame's own background, for a backend that paints one explicitly (OpenTUI) rather than
 * leaving the terminal's ambient background to show through (direct ANSI). */
export const BACKGROUND_RGB: Readonly<Record<Theme, readonly [number, number, number]>> = {
  dark: [10, 10, 12],
  light: [242, 240, 234],
}

type Swatch = Readonly<{
  /** An SGR foreground code from the 16-colour set — hand-authored; see the PALETTE comment below
   *  for why this tier alone stays a table rather than a computation. */
  ansi: number
  /** Exact colour, for truecolor — the single source of truth every other tier derives from
   *  (`sgrFor`'s `color256` case; `color16` stays independent, see below). */
  rgb: readonly [number, number, number]
}>

/**
 * One table per theme, two tiers hand-authored each — `ansi` and `rgb`. The 256-colour tier is no
 * longer a third hand-authored column: it is *derived* from `rgb` (`nearestIndexed`, below), Q25's
 * option A (`specs/open-questions.md`). `rgb` is where the factions' own palettes get to show up —
 * Citizen rust and gunmetal against Ravel neon and acid, from `terminal-nexus-lore.md` Section 8 —
 * while the 16-colour tier keeps the two sides as far apart as eight colours allow. This `dark` table
 * is the reference: the one the lore and every screenshot so far were designed against, and the one
 * to extend first when a role needs a stronger identity.
 *
 * **Why 256 derives and 16 does not** (measured, not guessed — `node
 * scripts/measure-palette-derivation.mjs`, dated 2026-08-24): nearest-match by squared RGB distance
 * against the real xterm-256 cube reproduces the hand-authored 256 table cleanly — most roles land on
 * the same entry or within a dozen RGB units of it. The same search against the sixteen ANSI colours
 * does not: it sends `chrome.muted` back to ANSI 90, the exact "bright black" value an owner playtest
 * already had removed (see the two-fixes comment below, still true and still why `chrome.muted` sits
 * on 37 rather than 90), and it collapses `player.a` and `player.b` onto the *same* grey — Q21's
 * contrast complaint made maximally worse, at the one tier with the least room to fix it. A
 * perceptual metric (OKLab) does not rescue it, because the cause is structural rather than a bad
 * formula: the sixteen ANSI colours have no desaturated entries, only eight hues, eight brights, and
 * greys, so nearest-match of any deliberately muted design colour lands on grey — grey genuinely
 * *is* the nearest colour. The sixteen hand-authored `ansi` values below are not approximating `rgb`
 * badly; they are answering a different question — *which of eight hues keeps these things apart* —
 * which is exactly the distinguishability job the two fixes below already tuned them for. Deriving 16
 * would reintroduce both fixed bugs and is not done.
 *
 * Two fixes folded in alongside the theme split, both owner playtest findings against this same
 * table:
 *
 *   - `chrome.muted` and `chrome.label` moved off ANSI 90 ("bright black") onto 37 ("white") at the
 *     16-colour tier. Every `chrome.muted` cell in compose.ts is *also* drawn with the `dim` SGR
 *     attribute (border, footer, panel labels — grep it), so the role's own colour was compounding
 *     with a second darkening on top of it; combined with bright-black being one of the least
 *     consistently themed of the sixteen codes across real terminals, that is what read as "can't
 *     barely see the help text" on the owner's own setup. `chrome.muted` is also brighter now at
 *     every tier, chosen to still read clearly after `dim` softens it.
 *   - `player.a` and `player.b`'s ANSI-16 codes did not match the hue the comment (and the 256/true
 *     colour entries either side of them) already committed to: 96 is bright cyan, not the rust
 *     orange Citizens are everywhere else, and 93 is bright yellow, not Ravel green. Corrected to 33
 *     (the closest base-16 approximation of an amber/rust) and 92 (bright green).
 *
 * A third fix, 2026-08-24 (Q21, `specs/open-questions.md`): `player.a`/`player.b`'s **light-theme**
 * `rgb` retuned by lightness only — hue and saturation unchanged, rust stays rust, green stays green.
 * Measured WCAG contrast against each other was 1.08:1 (dark theme's 2.08:1 is a smaller gap, left
 * alone per the recommendation): both sides clear the 3:1 floor against the background individually,
 * but sit at almost identical brightness next to *each other*, a real problem for red-green colour
 * blindness given the palette's hue choice. A light background structurally limits the fix to mostly
 * one direction: lightening a dark foreground role toward a bright background immediately costs that
 * role its own contrast against the background, while darkening one has no such penalty and buys
 * contrast against *both* the background and the other role at once — which is why `player.b` (Ravel
 * green) moved much further than `player.a` here. New pair: 3.55:1 and 11.47:1 against the light
 * background, 3.23:1 against each other. Dark theme's `player.a`/`player.b` are untouched.
 */
const PALETTE: Readonly<Record<Theme, Record<StyleRole, Swatch>>> = {
  dark: {
    // Moved off ANSI 90 onto 37 for the same reason `chrome.label`/`chrome.muted` were, above: the
    // border carries the same `dim` attribute on its own soft (scrolling) segments, so a role that
    // starts at "bright black" reads as gone entirely on real terminals - exactly the owner finding
    // this fix already answered once for the other two roles (2026-09-26 playtest: "during day time
    // I was not able to tell where the UI is"). Same rgb as `chrome.muted`'s own fix - a value
    // already proven legible dimmed, rather than a new number invented for this role.
    "chrome.frame": { ansi: 37, rgb: [150, 158, 168] },
    "chrome.title": { ansi: 97, rgb: [236, 240, 245] },
    "chrome.label": { ansi: 37, rgb: [148, 156, 166] },
    "chrome.value": { ansi: 37, rgb: [206, 213, 221] },
    "chrome.muted": { ansi: 37, rgb: [150, 158, 168] },
    // A cyan distinct from every other role's hue — not the rust/green the two players already own,
    // not terrain.deposit's gold — so a bracketed hotkey reads as "interactive chrome," never as a
    // gameplay colour.
    "chrome.hotkey": { ansi: 96, rgb: [86, 204, 214] },
    // Roughly two thirds of the way from the ground to `chrome.frame`: bright black at 16 colours,
    // which reads as a block or a line but not as dimmed text (why the frame itself left it).
    "chrome.edge": { ansi: 90, rgb: [100, 106, 116] },
    "terrain.plain": { ansi: 90, rgb: [72, 78, 86] },
    "terrain.rock": { ansi: 37, rgb: [128, 132, 138] },
    "terrain.deposit": { ansi: 33, rgb: [198, 160, 40] },
    // Citizen rust orange against Ravel bioluminescent cyan-green: the two Energy palettes the lore
    // gives the factions that Milestone 12 will pair.
    "player.a": { ansi: 33, rgb: [201, 118, 68] },
    "player.b": { ansi: 92, rgb: [104, 226, 132] },
    "item.salvage": { ansi: 32, rgb: [124, 158, 118] },
    "notice.gate": { ansi: 91, rgb: [232, 86, 76] },
    "fx.trail": { ansi: 90, rgb: [110, 116, 124] },
    "fx.kinetic": { ansi: 37, rgb: [198, 202, 208] },
    "fx.blast": { ansi: 91, rgb: [242, 132, 44] },
    "fx.debris": { ansi: 90, rgb: [148, 142, 132] },
    "fx.critical": { ansi: 93, rgb: [244, 178, 44] },
    "fx.flash": { ansi: 97, rgb: [255, 255, 255] },
    "fx.hue.red": { ansi: 91, rgb: [240, 84, 84] },
    "fx.hue.yellow": { ansi: 93, rgb: [240, 212, 72] },
    "fx.hue.green": { ansi: 92, rgb: [96, 222, 112] },
    "fx.hue.cyan": { ansi: 96, rgb: [72, 210, 232] },
    "fx.hue.blue": { ansi: 94, rgb: [104, 140, 255] },
    "fx.hue.magenta": { ansi: 95, rgb: [222, 112, 232] },
  },
  // A second, independent table rather than a formula on the dark one (invert-and-clamp reliably
  // ruins exactly the saturated faction colours that matter most) - every entry chosen by hand
  // against BACKGROUND_RGB.light, keeping each role's hue identity but moving its lightness to the
  // other end. Same structure as `dark`, so a future third theme is a table, not a redesign.
  light: {
    // Same fix as dark's chrome.frame, above - off ANSI 90, rgb matched to this theme's own
    // chrome.muted (already proven legible dimmed).
    "chrome.frame": { ansi: 30, rgb: [110, 104, 96] },
    "chrome.title": { ansi: 30, rgb: [28, 26, 24] },
    "chrome.label": { ansi: 30, rgb: [90, 86, 80] },
    "chrome.value": { ansi: 30, rgb: [48, 44, 40] },
    "chrome.muted": { ansi: 30, rgb: [110, 104, 96] },
    // Same hue as dark's, moved dark enough to stay legible on a light background instead of bright.
    "chrome.hotkey": { ansi: 36, rgb: [8, 110, 120] },
    // The same step toward the pale ground from this theme's `chrome.frame`.
    "chrome.edge": { ansi: 90, rgb: [164, 158, 148] },
    "terrain.plain": { ansi: 90, rgb: [196, 192, 184] },
    "terrain.rock": { ansi: 30, rgb: [70, 66, 60] },
    "terrain.deposit": { ansi: 33, rgb: [168, 124, 24] },
    // Q21, 2026-08-24: lightness-only retune (hue and saturation unchanged) so the two sides clear a
    // real mutual-contrast floor rather than only each individually clearing it against the
    // background - see the PALETTE doc comment above for the measurement and why the two roles moved
    // by such different amounts.
    "player.a": { ansi: 31, rgb: [201, 96, 41] },
    "player.b": { ansi: 32, rgb: [15, 56, 32] },
    "item.salvage": { ansi: 32, rgb: [80, 120, 72] },
    "notice.gate": { ansi: 31, rgb: [176, 32, 24] },
    "fx.trail": { ansi: 90, rgb: [150, 144, 136] },
    "fx.kinetic": { ansi: 30, rgb: [64, 60, 56] },
    "fx.blast": { ansi: 31, rgb: [184, 84, 16] },
    "fx.debris": { ansi: 90, rgb: [120, 110, 96] },
    "fx.critical": { ansi: 33, rgb: [168, 110, 8] },
    "fx.flash": { ansi: 30, rgb: [8, 8, 8] },
    // Dark enough to read on the pale ground, each still clearly its own hue.
    "fx.hue.red": { ansi: 31, rgb: [192, 32, 32] },
    "fx.hue.yellow": { ansi: 33, rgb: [156, 118, 0] },
    "fx.hue.green": { ansi: 32, rgb: [20, 132, 52] },
    "fx.hue.cyan": { ansi: 36, rgb: [0, 122, 142] },
    "fx.hue.blue": { ansi: 34, rgb: [36, 72, 204] },
    "fx.hue.magenta": { ansi: 35, rgb: [156, 40, 168] },
  },
}

/**
 * The xterm 256-colour palette above the 16 system colours: a 6x6x6 colour cube (indices 16-231),
 * then a 24-step greyscale ramp (232-255). The same construction `scripts/lib/terminal-capture.mjs`
 * and `scripts/measure-palette-derivation.mjs` already use to turn an index back into RGB — production
 * code duplicates rather than imports it, since `src/` does not depend on `scripts/`.
 */
const XTERM_CUBE_STEPS: readonly number[] = [0, 95, 135, 175, 215, 255]

function xterm256Rgb(index: number): readonly [number, number, number] {
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
 * The 256-colour index whose xterm rendering is nearest an RGB value, by squared distance — Q25's
 * "process the colour, then a final pass turns it into the tier," for real. Searches only the cube
 * and greyscale range (16-255): the sixteen system colours are the hand-authored `ansi` tier's own
 * job, not this one's. Cheap enough to call once per role per theme at module load (18 x 2 x 240
 * candidates) rather than needing its own cache beyond `DERIVED_256` below.
 */
function nearestIndexed(rgb: readonly [number, number, number]): number {
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
 * The 256-colour tier, derived once from each role's own `rgb` rather than hand-authored (Q25,
 * option A). Computed at module load and read as a plain lookup at render time — the same cost a
 * hand-authored field used to be, and the reason this is precomputed rather than called from
 * `sgrFor` directly on every cell of every frame.
 */
const DERIVED_256: Readonly<Record<Theme, Record<StyleRole, number>>> = (() => {
  const result = {} as Record<Theme, Record<StyleRole, number>>
  for (const theme of THEMES) {
    const byRole = {} as Record<StyleRole, number>
    for (const role of STYLE_ROLES) {
      byRole[role] = nearestIndexed(PALETTE[theme][role].rgb)
    }
    result[theme] = byRole
  }
  return result
})()

/**
 * Blends a role's own rgb toward this theme's background by `fade` — Q25's recommended shape
 * (specs/open-questions.md), the one place a fade scalar actually touches an RGB triple; `roles.ts`
 * stays "never a colour" everywhere else, a role plus a number. Clamped again here even though every
 * producer (`CellStyle.fade`'s own doc comment, frame.ts) is already supposed to hand this in as
 * `[0,1]`, so a caller that skips that contract still lands on a legal colour rather than one that
 * overshoots the background.
 */
function fadeRgb(
  rgb: readonly [number, number, number],
  theme: Theme,
  fade: number,
): readonly [number, number, number] {
  const bg = BACKGROUND_RGB[theme]
  const t = Math.max(0, Math.min(1, fade))
  return [
    Math.round(rgb[0] + (bg[0] - rgb[0]) * t),
    Math.round(rgb[1] + (bg[1] - rgb[1]) * t),
    Math.round(rgb[2] + (bg[2] - rgb[2]) * t),
  ]
}

/**
 * A foreground role pulled part of the way toward another role — gate 5I's style-role operation for
 * light on a placed building's characters (feedback F9). `amount` is `0` (the cell's own role) to `1`
 * (entirely `role`). Like `fade`, the cell still carries only roles and a number, never a colour: the
 * theme decides what either role looks like, and the tier decides how much of a blend it can show.
 *
 * - `truecolor`: the two roles' RGB, interpolated exactly;
 * - `color256`: the same blend, then the nearest palette entry;
 * - `color16`: no continuum, so a step — the cell's own hue below one half, `role`'s own hand-authored
 *   ANSI hue from one half up (a building lit toward `fx.flash` turns bright white, then settles);
 * - `monochrome`: nothing at all, like every colour. The placement's frames carry it there instead
 *   (a scaffold is drawn plain and the finished building bold).
 *
 * Applied before `fade`, so a lit cell can still be faded; nothing does both today.
 */
export type RoleTint = Readonly<{ role: StyleRole; amount: number }>

/**
 * A see-through cursor laid over a cell (the menu spike's round 2, feedback F64-F65): `role`'s colour at
 * `alpha` (0 to 1) over whatever is drawn there. The cell's background becomes `alpha` of the role's
 * colour and `1 - alpha` of what was there — itself 80% the cell's own background and 20% its glyph's
 * colour, the glyph being taken to cover about a fifth of the cell — and the glyph, which stays, is
 * drawn `alpha` of the way toward the colour the real cursor draws glyphs in (the theme's background,
 * since the cursor is inverse video). A role and a number, never a colour, like `RoleTint`: an exact mix
 * at truecolor, the nearest colour at 256, and at 16 colours and in monochrome the plain inverse
 * cursor (from an alpha of one half up; below it, nothing). Where it shows, the cell's own `dim` is not
 * applied (`keepsDim`). `overlayColours`, below, is the one place it becomes colour. Set only by the
 * Explore Map hand-off's travelling cursor so far.
 */
export type RoleOverlay = Readonly<{ role: StyleRole; alpha: number }>

function mixRgb(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  amount: number,
): readonly [number, number, number] {
  const t = Math.max(0, Math.min(1, amount))
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
  ]
}

/** `nearestIndexed` walks 240 candidates; a tinted, faded or overlaid cell asks again every frame, and a
 *  placement's light passes through the same few dozen blends, so the answers are kept. Bounded: an
 *  animation is a handful of roles times a few dozen steps, and the cache starts over past 4096. */
const NEAREST_CACHE = new Map<number, number>()

function nearestIndexedCached(rgb: readonly [number, number, number]): number {
  const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]
  const cached = NEAREST_CACHE.get(key)
  if (cached !== undefined) return cached
  const found = nearestIndexed(rgb)
  if (NEAREST_CACHE.size > 4096) NEAREST_CACHE.clear()
  NEAREST_CACHE.set(key, found)
  return found
}

/** The truecolor RGB of a role after its tint and fade — the one place both blends meet. */
function blendedRgb(swatch: Swatch, theme: Theme, fade: number, tint: RoleTint | undefined): readonly [number, number, number] {
  const target = tint === undefined || tint.amount <= 0 ? undefined : PALETTE[theme][tint.role]
  const tinted = target === undefined ? swatch.rgb : mixRgb(swatch.rgb, target.rgb, tint?.amount ?? 0)
  return fade > 0 ? fadeRgb(tinted, theme, fade) : tinted
}

/** Whether a tint shows at `color16`, where there is no blend: from one half up it is the other role. */
function tintStepsAt16(tint: RoleTint | undefined): boolean {
  return tint !== undefined && tint.amount >= 0.5
}

/**
 * SGR parameters for a role at a tier. Monochrome returns nothing at all — not a grey, *nothing* —
 * so that a monochrome frame provably contains no colour code. `theme` defaults to `DEFAULT_THEME`
 * so every existing caller that has not been taught about themes yet keeps today's look exactly.
 *
 * `fade` (default `0`, meaning none) is Q25's transparency scalar — see `CellStyle.fade`'s doc
 * comment in `frame.ts` for the full contract. It resolves only at `color256` (a fresh nearest-index
 * search against the faded rgb, rather than the precomputed `DERIVED_256` table) and `truecolor` (a
 * direct blend); `color16` and `monochrome` ignore it entirely; those two tiers have nothing between
 * a role's own eight hues and off; they stay exactly as `bold`/`dim`/`inverse` already describe them.
 */
export function sgrFor(
  role: StyleRole | undefined,
  capability: CapabilityMode,
  theme: Theme = DEFAULT_THEME,
  fade = 0,
  tint?: RoleTint,
): readonly number[] {
  if (role === undefined || capability === "monochrome") return []
  const swatch = PALETTE[theme][role]
  if (swatch === undefined) return []
  const tinted = tint !== undefined && tint.amount > 0
  switch (capability) {
    case "color16":
      return [tintStepsAt16(tint) ? PALETTE[theme][(tint as RoleTint).role].ansi : swatch.ansi]
    case "color256":
      return fade > 0 || tinted
        ? [38, 5, nearestIndexedCached(blendedRgb(swatch, theme, fade, tint))]
        : [38, 5, DERIVED_256[theme][role]]
    case "truecolor": {
      const [r, g, b] = blendedRgb(swatch, theme, fade, tint)
      return [38, 2, r, g, b]
    }
    default:
      return []
  }
}

/** Background variants of the same swatch, for the rare cell that needs one. `fade` is a `fgRole`
 *  scalar only (`CellStyle.fade`'s own doc comment) — this never resolves one. */
export function sgrBackgroundFor(
  role: StyleRole | undefined,
  capability: CapabilityMode,
  theme: Theme = DEFAULT_THEME,
): readonly number[] {
  const foreground = sgrFor(role, capability, theme)
  if (foreground.length === 0) return []
  if (capability === "color16") return [(foreground[0] ?? 37) + 10]
  return [foreground[0] === 38 ? 48 : 48, ...foreground.slice(1)]
}

/** What an RGB backend draws for a cell with no role, and for every cell in monochrome. */
const NEUTRAL_RGB: readonly [number, number, number] = [214, 218, 224]

/**
 * The same roles as RGB, for a backend that takes colours rather than SGR parameters (OpenTUI).
 * `fade` mirrors `sgrFor`'s tier gating even though OpenTUI is truecolor-capable regardless of the
 * requested `capability`: ignoring it at `color16` keeps that tier's simulated look identical to the
 * direct-ANSI backend's, the cross-backend snapshot invariant `tests/backend-opentui.test.ts` checks.
 * `monochrome` was already a fixed neutral grey regardless of role, so fade has nothing to add there.
 */
export function rgbFor(
  role: StyleRole | undefined,
  capability: CapabilityMode,
  theme: Theme = DEFAULT_THEME,
  fade = 0,
  tint?: RoleTint,
): readonly [number, number, number] {
  if (capability === "monochrome" || role === undefined) return NEUTRAL_RGB
  const swatch = PALETTE[theme][role]
  if (swatch === undefined) return NEUTRAL_RGB
  // At 16 colours a tint is a step onto the other role's own colour, exactly as `sgrFor` steps onto
  // its ANSI hue, so the simulated tier matches the direct-ANSI one.
  if (capability === "color16") return tintStepsAt16(tint) ? PALETTE[theme][(tint as RoleTint).role].rgb : swatch.rgb
  return blendedRgb(swatch, theme, fade, tint)
}

type Rgb = readonly [number, number, number]

/**
 * How much of a cell its glyph is taken to cover when an overlay mixes what lies beneath it — the
 * owner's "assuming that the icon is about 20% of the surface" (feedback F65).
 */
export const OVERLAY_GLYPH_COVER = 0.2

/**
 * From this alpha up an overlay shows at 16 colours and in monochrome, as the plain cursor; below it,
 * it shows nothing there. The same half-way step a tint takes at 16 colours (`tintStepsAt16`).
 */
export const OVERLAY_STEP = 0.5

/**
 * The owner's mix (feedback F65), as plain arithmetic on three colours and the cursor's own glyph
 * colour. "If the background is black, the icon on the background is yellow, and the cursor is white,
 * then the cursor at 80% ... would be 80% white, and the other 20% split between black (80%) and
 * yellow (20%)":
 *
 * - the cell's fill becomes `alpha` of `cursor` and `1 - alpha` of what was there — itself
 *   `1 - OVERLAY_GLYPH_COVER` of `background` and `OVERLAY_GLYPH_COVER` of `glyph`;
 * - the glyph, which stays, is drawn `alpha` of the way from `glyph` toward `cursorGlyph` (the colour
 *   the real cursor draws its glyph in), so it stays readable on the lighter cell.
 *
 * Each channel is rounded once, at the end. Exported so a test can hold it to the owner's own numbers.
 */
export function mixOverlay(
  background: Rgb,
  glyph: Rgb,
  cursor: Rgb,
  cursorGlyph: Rgb,
  alpha: number,
): Readonly<{ foreground: Rgb; background: Rgb }> {
  const a = Math.max(0, Math.min(1, alpha))
  const fill = (channel: 0 | 1 | 2): number =>
    Math.round(
      (1 - a) * ((1 - OVERLAY_GLYPH_COVER) * background[channel] + OVERLAY_GLYPH_COVER * glyph[channel]) +
        a * cursor[channel],
    )
  const ink = (channel: 0 | 1 | 2): number => Math.round((1 - a) * glyph[channel] + a * cursorGlyph[channel])
  return { background: [fill(0), fill(1), fill(2)], foreground: [ink(0), ink(1), ink(2)] }
}

/** What `overlayColours` reads: a cell, structurally (`frame.ts`'s `Cell` is one). */
export type OverlaidCell = Readonly<{
  glyph: string
  style: Readonly<{
    fgRole?: StyleRole
    bgRole?: StyleRole
    inverse?: boolean
    fade?: number
    tint?: RoleTint
    overlay?: RoleOverlay
  }>
}>

/**
 * A cell's colours once its overlay is resolved, in both forms the renderers take — so the ANSI
 * writer, the browser page's canvas and OpenTUI cannot disagree about one cell.
 */
export type OverlayColours = Readonly<{
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
 * Whether a renderer still applies a cell's `dim` — not while an overlay shows on it. The mix already
 * says how bright the glyph is (`mixOverlay`'s foreground, exactly), and faint on top would fade it
 * back toward the now lighter fill: the very loss the real cursor avoids by clearing `dim` on bare
 * ground (`src/view/build.ts`). A picture that fades the whole cell for `dim` (the evidence PNGs do)
 * would also halve the overlay's fill. Bold and underline stay the cell's own.
 */
export function keepsDim(style: Readonly<{ dim?: boolean }>, overlaid: OverlayColours | null): boolean {
  return style.dim === true && overlaid === null
}

/**
 * The see-through cursor (`RoleOverlay`, feedback F64-F65) resolved at a tier, or `null` where it
 * changes nothing — no overlay, an alpha of 0, or a low alpha at a tier with no blend. The one place an
 * overlay becomes colour; every renderer calls it.
 *
 * The cell's own colours are worked out first, as the renderers already draw them: its glyph colour
 * `G` is its `fgRole` after tint and fade, its background `B` is its `bgRole` or the theme's
 * background, an `inverse` cell swaps the two (so the overlay mixes what is actually seen), and a
 * blank cell has no glyph, so `G` is `B` and the cell becomes simply `B` mixed toward the cursor. Then
 * `mixOverlay`, with the overlay's role as the cursor colour `C` and the theme's background as the
 * cursor's glyph colour — the real cursor is inverse video, so its glyph is drawn in the ground.
 *
 * - `truecolor`: that exact mix;
 * - `color256`: the nearest palette entry to each of the two mixed colours (the RGB returned is that
 *   entry's own, so an RGB backend shows what a 256-colour terminal shows);
 * - `color16`: no continuum, so a step — from `OVERLAY_STEP` up, the plain cursor (inverse video in
 *   the overlay's role: its hand-authored ANSI hue as the fill, the ground as the glyph), below it
 *   nothing;
 * - `monochrome`: the same step, as inverse video alone. Never a colour code.
 *
 * Wherever it shows, the cell's own `dim` goes with it (`keepsDim`).
 */
export function overlayColours(
  cell: OverlaidCell,
  capability: CapabilityMode,
  theme: Theme = DEFAULT_THEME,
): OverlayColours | null {
  const overlay = cell.style.overlay
  if (overlay === undefined || !(overlay.alpha > 0)) return null
  const cursor = PALETTE[theme][overlay.role]
  if (cursor === undefined) return null
  const ground = BACKGROUND_RGB[theme]
  const alpha = Math.min(1, overlay.alpha)
  if (capability === "monochrome") {
    return alpha < OVERLAY_STEP ? null : { foreground: ground, background: NEUTRAL_RGB, sgr: [7] }
  }
  if (capability === "color16") {
    return alpha < OVERLAY_STEP ? null : { foreground: ground, background: cursor.rgb, sgr: [cursor.ansi, 7] }
  }
  const style = cell.style
  const own = style.fgRole === undefined ? undefined : PALETTE[theme][style.fgRole]
  const ink = own === undefined ? NEUTRAL_RGB : blendedRgb(own, theme, style.fade ?? 0, style.tint)
  const fill = (style.bgRole === undefined ? undefined : PALETTE[theme][style.bgRole]?.rgb) ?? ground
  const [beneath, glyph] = style.inverse === true ? [ink, fill] : [fill, ink]
  const blank = cell.glyph === " " || cell.glyph === ""
  const mixed = mixOverlay(beneath, blank ? beneath : glyph, cursor.rgb, ground, alpha)
  if (capability === "truecolor") {
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
