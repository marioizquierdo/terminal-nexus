export * from "./types.ts"
export * from "./random.ts"
export * from "./recipes.ts"
export * from "./derive.ts"
export * from "./composite.ts"

import type { EffectContext, EffectInstance, PositionedCell } from "./types.ts"
import { isActive } from "./types.ts"
import { EFFECT_RECIPES } from "./recipes.ts"

export type ActiveEffect = Readonly<{ instance: EffectInstance; cells: readonly PositionedCell[] }>

/**
 * Every effect painting at one instant.
 *
 * Instances arrive sorted by start time, so the active window is a scan rather than a filter over
 * the whole run — a 720-tick Pulse produces a few thousand instances and thirty frames a second is
 * not the place to walk all of them. Sustained effects are kept apart because their duration is
 * measured in tens of seconds and they would otherwise force the scan window open that far.
 */
export class EffectTimeline {
  private readonly transient: readonly EffectInstance[]
  private readonly sustained: readonly EffectInstance[]
  private readonly longestMs: number

  constructor(instances: readonly EffectInstance[]) {
    const sustainedMs = 2000
    this.transient = instances.filter((instance) => instance.durationMs < sustainedMs)
    this.sustained = instances.filter((instance) => instance.durationMs >= sustainedMs)
    this.longestMs = this.transient.reduce(
      (longest, instance) => Math.max(longest, instance.durationMs),
      0,
    )
  }

  activeAt(timeMs: number): EffectInstance[] {
    const active: EffectInstance[] = []
    const earliest = timeMs - this.longestMs
    let low = 0
    let high = this.transient.length
    while (low < high) {
      const middle = (low + high) >> 1
      const instance = this.transient[middle]
      if (instance !== undefined && instance.startMs < earliest) low = middle + 1
      else high = middle
    }
    for (let index = low; index < this.transient.length; index += 1) {
      const instance = this.transient[index]
      if (instance === undefined) continue
      if (instance.startMs > timeMs) break
      if (isActive(instance, timeMs)) active.push(instance)
    }
    for (const instance of this.sustained) {
      if (isActive(instance, timeMs)) active.push(instance)
    }
    return active
  }

  /** The cells every active effect paints at `context.timeMs`, in instance order. */
  cellsAt(context: EffectContext): ActiveEffect[] {
    const painted: ActiveEffect[] = []
    for (const instance of this.activeAt(context.timeMs)) {
      const recipe = EFFECT_RECIPES[instance.recipe]
      if (recipe === undefined) continue
      painted.push({ instance, cells: recipe(instance, context) })
    }
    return painted
  }

  get size(): number {
    return this.transient.length + this.sustained.length
  }
}
