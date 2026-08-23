// The three worlds, asserted rather than trusted — engine.md 1, milestone 3.2.
//
// "`src/pulse` must not import `src/view`. Assert it in a test rather than trusting it." The same
// goes for the report: a report that can read kernel internals can narrate a story the events do
// not contain, and because the log is only ever compared with itself, every other determinism
// check would still pass.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { REPO_ROOT } from "./helpers.ts"

const SRC = join(REPO_ROOT, "src")

function sourceFiles(directory: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry)
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full))
    else if (entry.endsWith(".ts")) found.push(full)
  }
  return found
}

/** Every specifier a file imports, `import type` included — a type import is still a dependency. */
function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8")
  const specifiers: string[] = []
  const pattern = /(?:from|import)\s+"([^"]+)"/g
  let match = pattern.exec(source)
  while (match !== null) {
    if (match[1] !== undefined) specifiers.push(match[1])
    match = pattern.exec(source)
  }
  return specifiers
}

function transitiveDependencies(
  entry: string,
  options: Readonly<{ asFile?: boolean }> = {},
): Set<string> {
  const seen = new Set<string>()
  const queue = options.asFile === true ? [entry] : sourceFiles(entry)
  while (queue.length > 0) {
    const file = queue.pop()
    if (file === undefined || seen.has(file)) continue
    seen.add(file)
    for (const specifier of importsOf(file)) {
      if (!specifier.startsWith(".")) continue
      const target = resolve(dirname(file), specifier)
      if (!seen.has(target)) queue.push(target)
    }
  }
  return seen
}

function assertNoDependencyOn(from: string, forbidden: readonly string[]): void {
  const reached = transitiveDependencies(join(SRC, from))
  for (const file of reached) {
    const path = relative(SRC, file)
    for (const target of forbidden) {
      // A directory (`view`) or one exact file (`content/art.ts`) — the second is what lets a single
      // presentation-only table live inside an otherwise kernel-visible folder.
      const reaches = target.endsWith(".ts") ? path === target : path.startsWith(`${target}/`)
      assert.ok(!reaches, `src/${from} reaches src/${path}, which it must never import`)
    }
  }
}

test("src/pulse never reaches the view, the report, or the shell", () => {
  assertNoDependencyOn("pulse", ["view", "report", "cli"])
})

test("the simulation never reaches a glyph", () => {
  // engine.md 9.6, RULE: "The simulation knows semantic ids such as `unit.worker` and
  // `structure.nexus`. **It never knows a glyph.**" src/content/art.ts sits *inside* a folder the
  // kernel reads all the time, so the rule holds only as long as nothing on the kernel's side of
  // that folder imports it — which is exactly the kind of thing that lasts until someone wants a
  // glyph "just for one log line". Checked from every door the kernel actually comes through,
  // rather than only from src/pulse.
  const art = resolve(SRC, "content/art.ts")
  for (const entry of [
    "content/index.ts",
    "scenario/index.ts",
    "pulse/index.ts",
    "state/types.ts",
    "events/types.ts",
    "report/index.ts",
  ]) {
    const reached = transitiveDependencies(resolve(SRC, entry), { asFile: true })
    assert.ok(
      !reached.has(art),
      `src/${entry} reaches src/content/art.ts — the simulation must never know a glyph`,
    )
  }

  // And the view, which is the one place that *should* reach it, still does — otherwise this test
  // would keep passing after someone deleted the import and broke every unit's body.
  const view = transitiveDependencies(join(SRC, "view"))
  assert.ok(view.has(art), "src/view no longer reaches the art table; nothing would be drawn")
})

test("src/report never reaches the kernel or the view", () => {
  // It may read content definitions and shared state types; it may not read how a tick is resolved.
  assertNoDependencyOn("report", ["pulse", "view", "cli"])
})

test("src/view never reaches the kernel", () => {
  assertNoDependencyOn("view", ["pulse", "cli"])
})

test("the deterministic modules name no clock, no Math.random, and no terminal", () => {
  const kernel = ["grid", "rng", "content", "events", "state", "scenario", "pulse"]
  const forbidden = [
    /\bMath\s*\.\s*random\b/,
    /\bDate\s*\.\s*now\b/,
    /\bnew\s+Date\b/,
    /\bperformance\s*\.\s*now\b/,
    /\bprocess\s*\.\s*(stdout|stderr|stdin|hrtime)\b/,
  ]
  for (const directory of kernel) {
    for (const file of sourceFiles(join(SRC, directory))) {
      const source = readFileSync(file, "utf8")
      for (const pattern of forbidden) {
        assert.ok(
          !pattern.test(source),
          `src/${relative(SRC, file)} mentions ${String(pattern)}, which the kernel may not use`,
        )
      }
    }
  }
})

test("no source file imports a package the repository has not pinned", () => {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ])
  for (const file of sourceFiles(SRC)) {
    for (const specifier of importsOf(file)) {
      if (specifier.startsWith(".") || specifier.startsWith("node:")) continue
      const packageName = specifier.startsWith("@")
        ? specifier.split("/").slice(0, 2).join("/")
        : specifier.split("/")[0]
      assert.ok(
        packageName !== undefined && declared.has(packageName),
        `src/${relative(SRC, file)} imports "${specifier}", which package.json does not pin`,
      )
    }
  }
})

test("every dependency is pinned to an exact version", () => {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  for (const [name, range] of Object.entries({
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
  })) {
    assert.match(range, /^\d+\.\d+\.\d+$/, `${name} is pinned as "${range}", not an exact version`)
  }
})
