// Cosmetic randomness for effects.
//
// This is a **hash, not a stream**, and the difference is the whole point. An effect must satisfy
// `f(t)` never depending on `f(t-1)` (ascii-effects.md rule 1), so it cannot draw from a generator
// whose answers depend on how many times it has been asked: two frames rendered in a different
// order, or one frame skipped, would produce different scatter. Hashing the instance's own identity
// plus a salt gives every effect stable randomness that is identical at any time, in any order, on
// any machine.
//
// It also makes rule 3 — cosmetic randomness only, never the gameplay stream — structural rather
// than disciplined: there is no stream here to accidentally share.

const PRIME_A = 0x27d4eb2d
const PRIME_B = 0x165667b1

function mix(value: number): number {
  let x = value | 0
  x = Math.imul(x ^ (x >>> 15), PRIME_A)
  x = Math.imul(x ^ (x >>> 13), PRIME_B)
  return (x ^ (x >>> 16)) >>> 0
}

/** A stable uint32 for one instance, one salt. */
export function cosmeticHash(
  seed: number,
  recipe: string,
  startMs: number,
  x: number,
  y: number,
  salt: number,
): number {
  let hash = mix(seed ^ 0x9e3779b9)
  for (let index = 0; index < recipe.length; index += 1) {
    hash = mix(hash ^ recipe.charCodeAt(index))
  }
  hash = mix(hash ^ Math.round(startMs))
  hash = mix(hash ^ ((x << 8) | (y & 0xff)))
  return mix(hash ^ salt)
}

/** `[0, 1)`. */
export function cosmeticUnit(hash: number): number {
  return (hash >>> 8) / 0x1000000
}

/** An integer in `[0, bound)`. */
export function cosmeticBelow(hash: number, bound: number): number {
  return bound <= 1 ? 0 : hash % bound
}

/** One element of a non-empty list, chosen stably. */
export function cosmeticPick<T>(hash: number, items: readonly T[]): T {
  const chosen = items[cosmeticBelow(hash, items.length)]
  if (chosen === undefined) throw new Error("cannot pick from an empty list")
  return chosen
}
