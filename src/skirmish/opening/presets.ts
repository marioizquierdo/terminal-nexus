// battlefield size presets (battlefield.md). The matrix is GUIDANCE; the default preset is RULE.

export type MapShape = "squared" | "wide" | "extra-wide"
export type MapSize = "small" | "medium" | "large" | "extra-large"
export type MapPreset = `${MapSize}-${MapShape}`

const SHORT_SIDE: Readonly<Record<MapSize, number>> = {
  small: 12,
  medium: 16,
  large: 20,
  "extra-large": 24,
}

const WIDTH_RATIO: Readonly<Record<MapShape, number>> = {
  squared: 1,
  wide: 2,
  "extra-wide": 3,
}

/** `medium-extra-wide` (48 x 16) is the default preset — RULE, and the 80-column layout depends on it. */
export const DEFAULT_PRESET: MapPreset = "medium-extra-wide"

export function presetDimensions(preset: MapPreset): { width: number; height: number } {
  const separator = preset.indexOf("-")
  const candidates: MapSize[] = ["extra-large", "small", "medium", "large"]
  for (const size of candidates) {
    if (preset.startsWith(`${size}-`)) {
      const shape = preset.slice(size.length + 1) as MapShape
      const height = SHORT_SIDE[size]
      const ratio = WIDTH_RATIO[shape]
      if (height === undefined || ratio === undefined) break
      return { width: height * ratio, height }
    }
  }
  throw new Error(`unknown map preset "${preset}" (separator at ${separator})`)
}
