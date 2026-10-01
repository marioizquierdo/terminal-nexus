// One canonical serialization, used for every hash the project compares (pulse.md).
//
// Keys are emitted in sorted order at every depth, so two structurally equal values always produce
// the same bytes regardless of the order their properties happened to be assigned in. Every number
// the kernel stores is an integer, so `JSON.stringify`'s number formatting is exact and identical
// on any conforming runtime — which is what makes the Bun/Node hash comparison meaningful rather
// than lucky.

import { sha256Hex } from "./sha256.ts"

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

/** The hex SHA-256 of `text` — plain JavaScript, not `node:crypto`, so a browser build computes the
 *  identical fingerprint (`./sha256.ts`). */
export function sha256(text: string): string {
  return sha256Hex(text)
}

export function hashOf(value: unknown): string {
  return sha256(canonicalJson(value))
}

/** `sha256:4f2a...` — the short form the run summary prints. */
export function shortHash(hash: string, digits = 8): string {
  return `sha256:${hash.slice(0, digits)}`
}
