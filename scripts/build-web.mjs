#!/usr/bin/env bun
// Builds the browser playtest page: one self-contained HTML file with the game's own menu, Build
// Phase and Pulse playback in it, painted onto a canvas (docs/system-design/runtime.md — a development tool; the
// terminal stays the real game). The commit it was built from is printed at the top of the page.
//
//   bun scripts/build-web.mjs                    # dist/terminal-nexus-playtest.html
//   bun scripts/build-web.mjs --out some/file.html
//
// The file opens straight from disk, or is published as a private claude.ai page for a phone.

import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { bundleForBrowser, repoRoot } from "./lib/web-bundle.mjs"

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

const { code, files } = await bundleForBrowser("src/web/host.ts", {
  define: { __TN_BUILD__: JSON.stringify(build) },
})
const page = readFileSync(join(repoRoot, "src", "web", "page.html"), "utf8")
// A function replacement, so `$&` and friends inside the minified script stay literal.
const html = page.replace("<!--BUNDLE-->", () => `<script>${code.replace(/<\/script/giu, "<\\/script")}</script>`)
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, html)
console.log(
  `wrote ${relative(process.cwd(), target)}: ${(html.length / 1024).toFixed(0)} KB, ` +
    `${files.length} source files, commit ${build.commit}`,
)
