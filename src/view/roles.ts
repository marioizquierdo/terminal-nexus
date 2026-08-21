// The style role vocabulary — engine.md 9.1.
//
// milestone-1-spike-battle.md 3.2 asks whoever opens the gate to commit this list before a second
// session starts, "even if it is eight strings". These are the twelve, and they are the whole
// vocabulary Gate 1A uses.
//
// A role is never a colour. `fgRole: "player.a"` is what a cell carries; which colour that becomes
// is the capability mode's business, and that is what makes monochrome a setting rather than a
// rewrite. Colour never carries ownership, target, danger, or health alone (engine.md 9.6): every
// role below is also distinguishable by glyph — sides are told apart by letter case, terrain by
// shape, salvage by its own character.

export const STYLE_ROLES = [
  "chrome.frame",
  "chrome.title",
  "chrome.label",
  "chrome.value",
  "chrome.muted",
  "terrain.plain",
  "terrain.rock",
  "terrain.deposit",
  "player.a",
  "player.b",
  "item.salvage",
  "notice.gate",
] as const

export type StyleRole = (typeof STYLE_ROLES)[number]

export type CapabilityMode = "monochrome" | "color16"

export const CAPABILITY_MODES: readonly CapabilityMode[] = ["monochrome", "color16"]

export function parseCapability(value: string): CapabilityMode {
  const found = CAPABILITY_MODES.find((mode) => mode === value)
  if (found === undefined) {
    throw new Error(`unknown capability "${value}"; expected one of ${CAPABILITY_MODES.join(", ")}`)
  }
  return found
}

/**
 * Roles resolve to SGR parameters, once, here. Gate 1A ships the two modes it can honestly claim:
 * monochrome, which is the acceptance floor, and 16-colour. The 256-colour and truecolor tiers of
 * engine.md 9.6 are Gate 1B's render-tier work, and this project does not label an untested mode
 * supported.
 */
const COLOR16: Readonly<Record<StyleRole, readonly number[]>> = {
  "chrome.frame": [90],
  "chrome.title": [97],
  "chrome.label": [90],
  "chrome.value": [37],
  "chrome.muted": [90],
  "terrain.plain": [90],
  "terrain.rock": [37],
  "terrain.deposit": [33],
  "player.a": [96],
  "player.b": [93],
  "item.salvage": [32],
  "notice.gate": [91],
}

export function sgrFor(role: StyleRole | undefined, capability: CapabilityMode): readonly number[] {
  if (role === undefined) return []
  if (capability === "monochrome") return []
  return COLOR16[role] ?? []
}

/**
 * The same roles as RGB, for a backend that takes colours rather than SGR parameters. The values
 * are the conventional xterm renderings of the 16-colour codes above, so both backends resolve one
 * role to one visual intent — that is the whole point of a role.
 */
const RGB16: Readonly<Record<number, readonly [number, number, number]>> = {
  32: [0, 205, 0],
  33: [205, 205, 0],
  37: [229, 229, 229],
  90: [127, 127, 127],
  91: [255, 0, 0],
  93: [255, 255, 0],
  96: [0, 255, 255],
  97: [255, 255, 255],
}

export function rgbFor(
  role: StyleRole | undefined,
  capability: CapabilityMode,
): readonly [number, number, number] {
  if (capability === "monochrome" || role === undefined) return [229, 229, 229]
  const code = COLOR16[role]?.[0]
  return (code === undefined ? undefined : RGB16[code]) ?? [229, 229, 229]
}
