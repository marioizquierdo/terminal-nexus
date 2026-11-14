// The shared shape checks (src/content/shape.ts): a whole number, and a JSON object.

import { test } from "node:test"
import assert from "node:assert/strict"
import { isObject, isWhole } from "../src/content/shape.ts"

test("isWhole accepts whole numbers of any sign and refuses everything else", () => {
  for (const value of [0, -3, 7]) assert.equal(isWhole(value), true)
  for (const value of [1.5, "2", Number.NaN, null]) assert.equal(isWhole(value), false)
})

test("isObject accepts an object and refuses a list and null", () => {
  assert.equal(isObject({}), true)
  assert.equal(isObject([]), false)
  assert.equal(isObject(null), false)
})
