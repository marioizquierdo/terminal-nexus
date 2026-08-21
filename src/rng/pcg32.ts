// The one named PRNG for the seeded gameplay stream — engine.md 4.4.
//
// Algorithm: PCG32, the `pcg_setseq_64_xsh_rr_32` variant (64-bit LCG state, 32-bit XSH-RR output).
// Transcribed from the reference implementation in `imneme/pcg-c`, `include/pcg_variants.h`,
// retrieved 2026-08-21:
//
//   pcg_setseq_64_step_r:   state = state * 6364136223846793005 + inc
//   pcg_output_xsh_rr_64_32: rotr32(((state >> 18) ^ state) >> 27, state >> 59)
//   pcg_setseq_64_srandom_r: state = 0; inc = (initseq << 1) | 1; step(); state += initstate; step()
//   boundedrand:            threshold = -bound % bound; redraw while r < threshold; return r % bound
//
// tests/rng.test.ts checks this against the published expected output of that repository's own
// check program (`test-high/expected/check-pcg32.out`, seeded 42/54).
//
// Chosen because its state is two 64-bit words — trivially serialisable into hashed state and
// trivially restorable — and because it ships published vectors, which a hand-rolled mixer does
// not. BigInt keeps the 64-bit arithmetic exact and identical on every runtime; the kernel draws
// only for arbitration tie-breaks, so the cost never appears in a measurement.

const MASK_64 = (1n << 64n) - 1n
const MASK_32 = 0xffffffffn
const MULTIPLIER = 6364136223846793005n

export const PRNG_NAME = "pcg32-xsh-rr"

export type RngState = Readonly<{
  name: string
  /** 64-bit LCG state, as a 16-digit hex string so that serialization stays exact. */
  state: string
  /** 64-bit stream increment; always odd. */
  inc: string
}>

function rotr32(value: number, rotation: number): number {
  const r = rotation & 31
  return ((value >>> r) | (value << ((32 - r) & 31))) >>> 0
}

function toHex(value: bigint): string {
  return value.toString(16).padStart(16, "0")
}

export class Pcg32 {
  private state: bigint
  private inc: bigint

  private constructor(state: bigint, inc: bigint) {
    this.state = state
    this.inc = inc
  }

  /** `pcg32_srandom_r(&rng, initstate, initseq)`. */
  static seeded(initstate: bigint, initseq: bigint): Pcg32 {
    const rng = new Pcg32(0n, ((initseq << 1n) | 1n) & MASK_64)
    rng.step()
    rng.state = (rng.state + (initstate & MASK_64)) & MASK_64
    rng.step()
    return rng
  }

  static restore(serialized: RngState): Pcg32 {
    if (serialized.name !== PRNG_NAME) {
      throw new Error(`unknown PRNG ${serialized.name}; this kernel implements ${PRNG_NAME}`)
    }
    return new Pcg32(BigInt(`0x${serialized.state}`) & MASK_64, BigInt(`0x${serialized.inc}`) & MASK_64)
  }

  private step(): void {
    this.state = (this.state * MULTIPLIER + this.inc) & MASK_64
  }

  /** One draw: a uint32. */
  nextUint32(): number {
    const old = this.state
    this.step()
    const xorshifted = Number((((old >> 18n) ^ old) >> 27n) & MASK_32)
    const rotation = Number(old >> 59n)
    return rotr32(xorshifted >>> 0, rotation)
  }

  /** Uniform in `[0, bound)`, debiased exactly as the reference does. */
  nextBelow(bound: number): number {
    if (!Number.isInteger(bound) || bound <= 0) {
      throw new Error(`bound must be a positive integer, received ${bound}`)
    }
    if (bound === 1) return 0
    const threshold = (0x100000000 - bound) % bound
    for (;;) {
      const draw = this.nextUint32()
      if (draw >= threshold) return draw % bound
    }
  }

  /** One element of a non-empty list. The list order is the caller's determinism problem. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("cannot pick from an empty list")
    const chosen = items[this.nextBelow(items.length)]
    if (chosen === undefined) throw new Error("pick produced no element")
    return chosen
  }

  snapshot(): RngState {
    return { name: PRNG_NAME, state: toHex(this.state), inc: toHex(this.inc) }
  }
}

/**
 * Streams are separated by the `initseq` parameter, which is what PCG provides them for.
 * Gameplay and cosmetic randomness are different streams of different seeds and never touch
 * (engine.md 1, law 3).
 */
export const STREAM_GAMEPLAY = 0n
export const STREAM_COSMETIC = 1n

export function gameplayRng(seed: number): Pcg32 {
  return Pcg32.seeded(BigInt(seed), STREAM_GAMEPLAY)
}

export function cosmeticRng(seed: number): Pcg32 {
  return Pcg32.seeded(BigInt(seed), STREAM_COSMETIC)
}
