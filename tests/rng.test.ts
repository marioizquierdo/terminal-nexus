import { test } from "node:test"
import assert from "node:assert/strict"
import { PRNG_NAME, Pcg32, cosmeticRng, gameplayRng } from "../src/rng/pcg32.ts"

/**
 * Published test vectors, not remembered ones: the first six outputs printed by the
 * `imneme/pcg-c` repository's own check program for `pcg32_random_r` seeded 42/54, taken from
 * `test-high/expected/check-pcg32.out` (retrieved 2026-08-21). The seed constants are that
 * program's `XX_SRANDOM_SEEDCONSTS`.
 */
const PUBLISHED_VECTORS = [
  0xa15c02b7, 0x7b47f409, 0xba1d3330, 0x83d2f293, 0xbfa4784b, 0xcbed606e,
]

test("PCG32 matches the published test vectors", () => {
  const rng = Pcg32.seeded(42n, 54n)
  const produced = PUBLISHED_VECTORS.map(() => rng.nextUint32())
  assert.deepEqual(produced, PUBLISHED_VECTORS)
})

test("PRNG state serializes and restores exactly", () => {
  const rng = gameplayRng(0x5eed0001)
  for (let index = 0; index < 17; index += 1) rng.nextUint32()
  const snapshot = rng.snapshot()
  assert.equal(snapshot.name, PRNG_NAME)

  const restored = Pcg32.restore(snapshot)
  const expected = [rng.nextUint32(), rng.nextUint32(), rng.nextUint32()]
  const actual = [restored.nextUint32(), restored.nextUint32(), restored.nextUint32()]
  assert.deepEqual(actual, expected)
  assert.deepEqual(restored.snapshot(), rng.snapshot())
})

test("bounded draws stay in range and cover it", () => {
  const rng = gameplayRng(7)
  const seen = new Set<number>()
  for (let index = 0; index < 4000; index += 1) {
    const draw = rng.nextBelow(5)
    assert.ok(draw >= 0 && draw < 5, `draw ${draw} outside [0,5)`)
    seen.add(draw)
  }
  assert.equal(seen.size, 5)
  assert.equal(rng.nextBelow(1), 0)
})

test("the gameplay and cosmetic streams are different streams", () => {
  const gameplay = gameplayRng(1234)
  const cosmetic = cosmeticRng(1234)
  const left = [gameplay.nextUint32(), gameplay.nextUint32(), gameplay.nextUint32()]
  const right = [cosmetic.nextUint32(), cosmetic.nextUint32(), cosmetic.nextUint32()]
  assert.notDeepEqual(left, right)
})

test("an unknown PRNG name is refused rather than guessed at", () => {
  assert.throws(() => Pcg32.restore({ name: "mulberry32", state: "0", inc: "1" }), /unknown PRNG/)
})
