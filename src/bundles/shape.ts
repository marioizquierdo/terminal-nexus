// The shape a bundle's JSON must have, checked before anything reads it: a modder writes JSON without
// TypeScript, so the loader is what tells them, by path and all at once, that a field is missing, is
// misspelt, or holds the wrong kind of value.
//
// A handful of combinators — text, numbers, fixed values, lists, objects and keyed variants — each a check
// that says every problem it finds and returns whether the value has the shape. An object's shape is typed
// against the TypeScript type it stands for (`record`), so a field added to that type does not compile until
// its shape says what the JSON holds for it.
//
// Pure: no clock, no randomness, nothing read from disk.

/** How a check reports a problem: one plain sentence, naming where. */
export type Say = (problem: string) => void

/** A JSON value's expected shape. */
export type Shape<T> = Readonly<{
  /** What a value of this shape is, as a problem names it: "a number", "a list". */
  name: string
  /** Whether `value` has this shape. Every way it does not is said, each naming `at`. */
  check(value: unknown, at: string, say: Say): value is T
}>

/** The type a shape stands for. */
export type ShapeOf<S> = S extends Shape<infer T> ? T : never

/** A value as a problem shows it: text quoted, a list or an object by what it is. */
export function shown(value: unknown): string {
  if (value === undefined) return "nothing"
  if (Array.isArray(value)) return "a list"
  if (value !== null && typeof value === "object") return "an object"
  const text = JSON.stringify(value)
  return text.length > 40 ? `${text.slice(0, 37)}...` : text
}

/** Where a field of an object is: `at.key`, or `key` at the top of a manifest. */
export function fieldAt(at: string, key: string): string {
  return at === "" ? key : `${at}.${key}`
}

/** Where an item of a list is: by its id when it has one (`levels[vasse-test-1]`), else by its index. */
export function itemAt(at: string, item: unknown, index: number): string {
  const id = isObject(item) && typeof item["id"] === "string" && item["id"] !== "" ? item["id"] : String(index)
  return `${at}[${id}]`
}

export function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function simple<T>(name: string, test: (value: unknown) => boolean): Shape<T> {
  return {
    name,
    check(value: unknown, at: string, say: Say): value is T {
      if (test(value)) return true
      say(`${at} should be ${name}, not ${shown(value)}`)
      return false
    },
  }
}

/** Any text. Whether it may be empty is for the checks that read it. */
export const text: Shape<string> = simple("text", (value) => typeof value === "string")

/** Any finite number. Whether it must be whole or positive is for the checks that read it. */
export const number: Shape<number> = simple("a number", (value) => typeof value === "number" && Number.isFinite(value))

/** A whole number, zero or more: a cost, an amount of credits. */
export const wholeNumber: Shape<number> = simple(
  "a whole number",
  (value) => typeof value === "number" && Number.isInteger(value) && value >= 0,
)

/** Anything at all: a part checked on its own, later, by its own shape. */
export const anything: Shape<unknown> = { name: "anything", check: (_value: unknown, _at: string, _say: Say): _value is unknown => true }

/** One of a few fixed values: a side (`"A"` or `"B"`), `true`. */
export function literal<const V extends string | number | boolean>(...values: readonly V[]): Shape<V> {
  const name = values.length === 1 ? JSON.stringify(values[0]) : `one of ${values.map((value) => JSON.stringify(value)).join(", ")}`
  return simple(name, (value) => values.includes(value as V))
}

/** A list, every item of which has `item`'s shape. */
export function list<T>(item: Shape<T>): Shape<readonly T[]> {
  return {
    name: "a list",
    check(value: unknown, at: string, say: Say): value is readonly T[] {
      if (!Array.isArray(value)) {
        say(`${at} should be a list, not ${shown(value)}`)
        return false
      }
      let fits = true
      value.forEach((entry: unknown, index) => {
        if (!item.check(entry, itemAt(at, entry, index), say)) fits = false
      })
      return fits
    },
  }
}

/** An object whose every value has `entry`'s shape, under any key: a mission's text for each round. */
export function dictionary<T>(entry: Shape<T>): Shape<Readonly<Record<string, T>>> {
  return {
    name: "an object",
    check(value: unknown, at: string, say: Say): value is Readonly<Record<string, T>> {
      if (!isObject(value)) {
        say(`${at} should be an object, not ${shown(value)}`)
        return false
      }
      let fits = true
      for (const [key, inner] of Object.entries(value)) if (!entry.check(inner, fieldAt(at, key), say)) fits = false
      return fits
    },
  }
}

// A key is optional when an object without it still has the type: `{}` is a `Pick<T, K>` for exactly those.
type RequiredKeys<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T]
type OptionalKeys<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? K : never }[keyof T]

/**
 * An object with exactly these fields: every required one present, any optional one either absent or of its
 * shape, and nothing else — a misspelt field is a problem, not a field silently ignored. Typed against `T`, so
 * the two lists must name every field `T` has.
 */
export function record<T extends object>(
  required: { readonly [K in RequiredKeys<T>]: Shape<T[K]> },
  optional: { readonly [K in OptionalKeys<T>]: Shape<Exclude<T[K], undefined>> },
): Shape<T> {
  const needed = required as Readonly<Record<string, Shape<unknown>>>
  const allowed = optional as Readonly<Record<string, Shape<unknown>>>
  return {
    name: "an object",
    check(value: unknown, at: string, say: Say): value is T {
      if (!isObject(value)) {
        say(`${at === "" ? "a bundle" : at} should be an object, not ${shown(value)}`)
        return false
      }
      let fits = true
      for (const [key, shape] of Object.entries(needed)) {
        if (!Object.hasOwn(value, key)) {
          say(`${at === "" ? "the bundle" : at} needs "${key}"`)
          fits = false
        } else if (!shape.check(value[key], fieldAt(at, key), say)) fits = false
      }
      for (const [key, shape] of Object.entries(allowed)) {
        if (Object.hasOwn(value, key) && !shape.check(value[key], fieldAt(at, key), say)) fits = false
      }
      for (const key of Object.keys(value)) {
        if (Object.hasOwn(needed, key) || Object.hasOwn(allowed, key)) continue
        const known = [...Object.keys(needed), ...Object.keys(allowed)].map((name) => `"${name}"`).join(", ")
        say(`${at === "" ? "the bundle" : at} has "${key}", which is not one of its fields (${known})`)
        fits = false
      }
      return fits
    },
  }
}

/**
 * An object with exactly one key, which names what it is — `{ "spawn": {...} }`, `{ "win": true }` — and whose
 * value has that key's shape: a trigger's action, what a line of dialog looks at.
 */
export function keyed<V extends Readonly<Record<string, Shape<unknown>>>>(
  what: string,
  variants: V,
): Shape<{ [K in keyof V]: Readonly<Record<K, ShapeOf<V[K]>>> }[keyof V]> {
  const known = Object.keys(variants)
    .map((key) => `"${key}"`)
    .join(", ")
  return {
    name: what,
    check(value: unknown, at: string, say: Say): value is { [K in keyof V]: Readonly<Record<K, ShapeOf<V[K]>>> }[keyof V] {
      if (!isObject(value)) {
        say(`${at} should be ${what}, not ${shown(value)}`)
        return false
      }
      const keys = Object.keys(value)
      const [key] = keys
      if (keys.length !== 1 || key === undefined || !Object.hasOwn(variants, key)) {
        say(`${at} should be ${what}: an object with one of ${known}, not ${keys.length === 0 ? "an empty object" : keys.map((name) => `"${name}"`).join(" and ")}`)
        return false
      }
      return (variants[key] as Shape<unknown>).check(value[key], fieldAt(at, key), say)
    },
  }
}
