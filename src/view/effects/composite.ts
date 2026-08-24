// Compositing effect cells that land on the same tile — the part of "a real ASCII rendering
// pipeline" ascii-effects.md's own compositor section leaves as "the topmost defined cell replaces
// the lower complete cell" (frame.ts, composeBands). That rule is right for the Grid's own layers
// (a live entity's glyph must never be a blend of two things), but two *effects* overlapping the
// same tile in the same instant is common in a real fight — several simultaneous damage flashes on
// one large target, several detonations' debris fields overlapping — and "the last one drawn wins"
// throws away exactly the information a busy frame most needs to read as busy rather than broken.
//
// Owner playtest, 2026-08-23: "We need to resolve how to render multiple effects; ideally we would
// define intensity and can add some sort of addition... Perhaps we can differentiate between pure
// lighting effects (they can stack with intensity and duration) and particle effects (maybe can
// stack, depending of the symbol... even if this is a long hand-made table)."
//
// Both rules below are pure functions of the cells submitted *this frame* — no history, no counter
// that survives between frames. That is not a stylistic choice; it is ascii-effects.md rule 1 (`f(t)`
// must not depend on `f(t-1)`) applied one level up, to the compositor rather than to a single
// recipe. "Stacking reads brighter and holds longer" still happens, but only as the observable
// consequence of several independently-decaying signals happening to overlap in time — exactly the
// way two real flashlights pointed at the same wall add up without either one needing to remember
// the other was there.

import type { EffectBand, PositionedCell } from "./types.ts"

/** One effect's cell, carrying the band it belongs to — everything `mergeEffectCells` needs to know
 *  to decide whether it collides with another cell this frame. */
export type EffectCellSource = Readonly<{ band: EffectBand; cell: PositionedCell }>

/**
 * A glyphless cell's rendered weight — the ordinal "how bright" scale a lighting stack climbs by
 * simple addition, since `CellStyle` (frame.ts) has no numeric intensity field of its own and
 * ascii-effects.md 7 already rules out building one (no ECS, no new little sub-system — reuse what
 * a terminal already renders: dim, plain, bold, inverse). `fx.damage.flash` alone is weight 2
 * (plain-bold); two flashes landing on one tile the same frame already reads brighter (weight 4,
 * clamped below to inverse) without either flash's own recipe knowing the other exists.
 */
function lightWeight(cell: PositionedCell): number {
  let weight = 1
  if (cell.bold === true) weight += 1
  if (cell.inverse === true) weight += 1
  if (cell.dim === true) weight -= 0.5
  return weight
}

/**
 * Combines every glyphless (lighting) cell landing on one tile this frame into one. The strongest
 * single contributor decides which semantic role is showing — a stacked flash still reads as
 * *whichever* hit landed hardest, not an average of two unrelated cues — while the *summed* weight
 * decides how bright the compositor renders the result: one contributor stays whatever it already
 * was, two or more escalate toward bold and then inverse, "the white color... take longer to
 * resolve, then dim slowly" falling out of nothing more than two decaying signals overlapping.
 */
function resolveLighting(group: readonly EffectCellSource[]): EffectCellSource {
  const first = group[0]
  if (first === undefined) throw new Error("mergeEffectCells: empty lighting group")
  if (group.length === 1) return first
  let totalWeight = 0
  let strongest = first
  for (const entry of group) {
    totalWeight += lightWeight(entry.cell)
    if (lightWeight(entry.cell) > lightWeight(strongest.cell)) strongest = entry
  }
  return {
    band: strongest.band,
    cell: {
      ...strongest.cell,
      bold: totalWeight >= 2,
      inverse: totalWeight >= 3,
      dim: totalWeight < 1,
    },
  }
}

/**
 * Two glyphs that read as one denser mark when they land on the same tile the same frame — a
 * deliberately short, hand-authored table (ascii-effects.md 7 forbids generating this from
 * parameters), extended by hand as more collisions turn out to be worth a case of their own. Keyed
 * by the pair sorted, so authorship order never matters. Every value is one printable ASCII
 * character, checked by `tests/effects.test.ts` alongside every other glyph this system emits.
 */
const PARTICLE_MERGE_TABLE: Readonly<Record<string, string>> = {
  // Two light dust marks converging read as one denser one — the owner's own example.
  [mergeKey(".", ":")]: ";",
  [mergeKey(",", "'")]: '"',
  // Two sparks or impacts landing together read as a single, busier knot.
  [mergeKey("*", "*")]: "&",
  // Two angled shards crossing read as a hard X, the same glyph the Ravel family already uses for
  // a direct impact — a denser hit earns the glyph a lone shard never gets.
  [mergeKey("/", "\\")]: "X",
  // Two straight debris marks crossing read as the same cross meleeClash's own directional language
  // already draws for a contested blow.
  [mergeKey("-", "|")]: "+",
}

function mergeKey(a: string, b: string): string {
  return a < b ? `${a}${b}` : `${b}${a}`
}

/**
 * Folds every particle (glyph-bearing) cell landing on one tile this frame into one, left to right
 * in the order they were submitted — which is instance start-time order, so "left to right" is
 * "older effect first". A pair `PARTICLE_MERGE_TABLE` defines becomes the denser merged glyph;
 * anything else keeps today's exact behaviour, the newer cell simply drawn on top of the older one.
 */
function resolveParticles(group: readonly EffectCellSource[]): EffectCellSource {
  let acc: EffectCellSource | undefined = group[0]
  if (acc === undefined) throw new Error("mergeEffectCells: empty particle group")
  for (let index = 1; index < group.length; index += 1) {
    const next = group[index]
    if (next === undefined) continue
    const merged: string | undefined = PARTICLE_MERGE_TABLE[mergeKey(acc.cell.glyph, next.cell.glyph)]
    acc = merged === undefined ? next : { band: next.band, cell: { ...next.cell, glyph: merged } }
  }
  return acc
}

/**
 * Collapses every effect cell landing on the same tile and band this frame into one. A group of one
 * — by far the common case, most tiles most ticks — passes straight through unchanged. A glyphless
 * group (every recipe that touches a unit's own cell uses the `highlights` band for exactly this,
 * ascii-effects.md 1.1) stacks by intensity; a glyph-bearing group merges through the table above or
 * falls back to the later cell winning. The two kinds cannot mix within one group in practice —
 * `highlights` carries only glyphless cells today — so which path a group takes is decided once, by
 * its first cell, rather than re-checked per member.
 */
export function mergeEffectCells(sources: readonly EffectCellSource[]): readonly EffectCellSource[] {
  const groups = new Map<string, EffectCellSource[]>()
  const order: string[] = []
  for (const source of sources) {
    const key = `${source.band}:${source.cell.tile.x},${source.cell.tile.y}`
    const group = groups.get(key)
    if (group === undefined) {
      groups.set(key, [source])
      order.push(key)
    } else {
      group.push(source)
    }
  }
  const resolved: EffectCellSource[] = []
  for (const key of order) {
    const group = groups.get(key)
    if (group === undefined || group.length === 0) continue
    if (group.length === 1) {
      const only = group[0]
      if (only !== undefined) resolved.push(only)
      continue
    }
    resolved.push(group[0]?.cell.glyph === "" ? resolveLighting(group) : resolveParticles(group))
  }
  return resolved
}
