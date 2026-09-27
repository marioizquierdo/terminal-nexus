// The plain-JavaScript SHA-256 every fingerprint now goes through (`src/state/sha256.ts`), checked
// against the runtime's own `node:crypto` — which this test may use, being a test and not the game.
//
// Why the switch was allowed (measured 2026-09-27, this container, Node 22.22.2):
//   `for map in scenarios/*.map.json; do ./bin/grid.ts "$map" --verify --runs 20; done`
//   node:crypto 19.8 s, plain JavaScript 20.7 s (about 4% slower); `npm test` 44.7 s -> 46.3 s.
// Hashing alone is about 4.5x slower (15 ms per MB), but it is a small share of resolving a battle.

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import { sha256Hex } from "../src/state/sha256.ts"
import { canonicalJson, hashOf } from "../src/state/canonical.ts"
import { loadScenario } from "../src/scenario/load.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { loadScenarioFile } from "./helpers.ts"

const native = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex")

test("the published SHA-256 vectors", () => {
  assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
  assert.equal(
    sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
  )
})

test("every padding boundary and multi-byte text agree with node:crypto", () => {
  // 55, 56 and 64 bytes are where the length field stops fitting in the last block.
  for (let length = 0; length <= 130; length += 1) {
    const text = "x".repeat(length)
    assert.equal(sha256Hex(text), native(text), `length ${length}`)
  }
  for (const text of ["é", "😀", "Ω≈ç√", "é😀".repeat(97), "a".repeat(100_003)]) {
    assert.equal(sha256Hex(text), native(text))
  }
})

test("a real scenario's canonical state hashes the same either way", async () => {
  const scenario = await loadScenarioFile("grand-battle.map.json")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  assert.equal(hashOf(loaded.state), native(canonicalJson(loaded.state)))
})
