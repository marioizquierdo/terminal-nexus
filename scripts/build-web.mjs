#!/usr/bin/env bun
// Builds the browser playtest page: one self-contained HTML file with the game's own menu, Build
// Phase and Pulse playback in it, painted onto a canvas (docs/system-design/runtime.md — a development tool; the
// terminal stays the real game). The commit it was built from is printed at the top of the page.
//
//   bun scripts/build-web.mjs                    # dist/terminal-nexus-playtest.html
//   bun scripts/build-web.mjs --out some/file.html
//   bun scripts/build-web.mjs --demos demos.json # with buttons that start this pull request's demos
//
// A demos file is a list of `{ "label", "try", "keys"?, "settings"? }`: a button's name, what to try
// once it starts (shown under the screen), and the key script and settings text the Build Phase starts
// from — the same as `--keys` and `--settings` in a terminal. It is how a pull request's playable page
// opens the game exactly where its question is. A pull request's file lives in `scripts/demos/` while
// its page is current, as an example for the next; delete it once the question is answered.
//
// The file opens straight from disk, or is published as a private claude.ai page for a phone.

import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { bundleForBrowser, repoRoot } from "./lib/web-bundle.mjs"
import { parseKeyScript } from "../src/playtest/keys.ts"

const argument = (name) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : process.argv[index + 1] ?? null
}
const git = (...args) => {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim()
  } catch {
    return "unknown"
  }
}

const dirty = git("status", "--porcelain", "--untracked-files=no") !== ""
const build = {
  commit: `${git("rev-parse", "--short", "HEAD")}${dirty ? "+changes" : ""}`,
  branch: git("rev-parse", "--abbrev-ref", "HEAD"),
  builtAt: new Date().toISOString().slice(0, 16).replace("T", " "),
}
const target = argument("--out") ?? join(repoRoot, "dist", "terminal-nexus-playtest.html")

const demosPath = argument("--demos")
const demos = demosPath === null ? [] : JSON.parse(readFileSync(demosPath, "utf8"))
if (!Array.isArray(demos)) throw new Error(`${demosPath}: expected a list of demos`)
for (const [index, demo] of demos.entries()) {
  const fields = Object.keys(demo ?? {})
  const unknown = fields.filter((field) => !["label", "try", "keys", "settings"].includes(field))
  if (typeof demo?.label !== "string" || typeof demo?.try !== "string" || unknown.length > 0) {
    throw new Error(`${demosPath}: demo ${index + 1} needs a "label" and a "try", and may have "keys" and "settings"${unknown.length > 0 ? `; unknown: ${unknown.join(", ")}` : ""}`)
  }
  for (const field of ["keys", "settings"]) {
    if (demo[field] !== undefined && typeof demo[field] !== "string") throw new Error(`${demosPath}: demo ${index + 1}'s "${field}" must be text`)
  }
  // A key script the page cannot read would start the Build Phase at its beginning and say nothing:
  // refuse it here, with the page's own reader.
  if (demo.keys !== undefined) {
    try {
      parseKeyScript(demo.keys)
    } catch (error) {
      throw new Error(`${demosPath}: demo ${index + 1}'s keys: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

const { code, files } = await bundleForBrowser("src/web/host.ts", {
  define: { __TN_BUILD__: JSON.stringify(build), __TN_DEMOS__: JSON.stringify(demos) },
})
const page = readFileSync(join(repoRoot, "src", "web", "page.html"), "utf8")
// A function replacement, so `$&` and friends inside the minified script stay literal.
const html = page.replace("<!--BUNDLE-->", () => `<script>${code.replace(/<\/script/giu, "<\\/script")}</script>`)
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, html)
console.log(
  `wrote ${relative(process.cwd(), target)}: ${(html.length / 1024).toFixed(0)} KB, ` +
    `${files.length} source files, commit ${build.commit}${demos.length > 0 ? `, ${demos.length} demos` : ""}`,
)
