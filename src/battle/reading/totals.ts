// What a side's round adds up to, from its reading: the sums a script, the score and a line of words all ask for, said
// once here. Whole numbers, as every reading.

import type { SideReading } from "./index.ts"

/** Everything a side lost in the round, units and buildings, counted by content id. */
export function lostOf(side: SideReading): Readonly<Record<string, number>> {
  const lost: Record<string, number> = { ...side.army.lost.counts }
  for (const [key, count] of Object.entries(side.buildings.lost)) {
    const contentId = key.split(" by ")[0] as string
    lost[contentId] = (lost[contentId] ?? 0) + count
  }
  return lost
}

/** How many things a side lost in the round, units and buildings. */
export const lostCount = (side: SideReading): number => side.army.lost.count + Object.values(side.buildings.lost).reduce((sum, count) => sum + count, 0)

/** All the damage a side dealt in the round, to units, buildings and the Nexus. */
export const dealtOf = (side: SideReading): number => side.damage.dealt.units + side.damage.dealt.buildings + side.damage.dealt.nexus
