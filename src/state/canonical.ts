// One canonical serialization, used for every hash the project compares — engine.md 4.4.
//
// Keys are emitted in sorted order at every depth, so two structurally equal values always produce
// the same bytes regardless of the order their properties happened to be assigned in. Every number
// the kernel stores is an integer, so `JSON.stringify`'s number formatting is exact and identical
// on any conforming runtime — which is what makes the Bun/Node hash comparison meaningful rather
// than lucky.

import { createHash } from "node:crypto"

export type Jsonish =
  | null
  | boolean
  | number
  | string
  | readonly Jsonish[]
  | { readonly [key: string]: Jsonish }

export function canonicalJson(value: unknown): string {
  return stringify(value)
}

function stringify(value: unknown): string {
  if (value === null) return "null"
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`refusing to serialize non-finite number ${value}`)
    if (!Number.isInteger(value)) {
      throw new Error(
        `refusing to serialize the non-integer ${value}: canonical state is integers only`,
      )
    }
    return JSON.stringify(value)
  }
  if (typeof value === "string") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stringify).join(",")}]`
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    const parts: string[] = []
    for (const key of keys) {
      const entry = record[key]
      if (entry === undefined) continue
      parts.push(`${JSON.stringify(key)}:${stringify(entry)}`)
    }
    return `{${parts.join(",")}}`
  }
  throw new Error(`refusing to serialize a ${typeof value}`)
}

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex")
}

export function hashOf(value: unknown): string {
  return sha256(canonicalJson(value))
}

/** `sha256:4f2a...` — the short form the run summary prints. */
export function shortHash(hash: string, digits = 8): string {
  return `sha256:${hash.slice(0, digits)}`
}
