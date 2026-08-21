// Grid size presets — engine.md 3.1. The matrix is GUIDANCE; the default preset is RULE.

export type GridShape = "squared" | "wide" | "extra-wide"
export type GridSize = "small" | "medium" | "large" | "extra-large"
export type GridPreset = `${GridSize}-${GridShape}`

const SHORT_SIDE: Readonly<Record<GridSize, number>> = {
  small: 12,
  medium: 16,
  large: 20,
  "extra-large": 24,
}

const WIDTH_RATIO: Readonly<Record<GridShape, number>> = {
  squared: 1,
  wide: 2,
  "extra-wide": 3,
}

/** `medium-extra-wide` (48 x 16) is the default preset — RULE, and the 80-column layout depends on it. */
export const DEFAULT_PRESET: GridPreset = "medium-extra-wide"

export function presetDimensions(preset: GridPreset): { width: number; height: number } {
  const separator = preset.indexOf("-")
  const candidates: GridSize[] = ["extra-large", "small", "medium", "large"]
  for (const size of candidates) {
    if (preset.startsWith(`${size}-`)) {
      const shape = preset.slice(size.length + 1) as GridShape
      const height = SHORT_SIDE[size]
      const ratio = WIDTH_RATIO[shape]
      if (height === undefined || ratio === undefined) break
      return { width: height * ratio, height }
    }
  }
  throw new Error(`unknown grid preset "${preset}" (separator at ${separator})`)
}
