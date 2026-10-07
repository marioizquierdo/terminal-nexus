#!/usr/bin/env bun
// Builds the browser playtest page: one self-contained HTML file with the game's own menu, Build
// Phase and Battle Round playback in it, painted onto a canvas (docs/system-design/runtime.md — a development tool; the
// terminal stays the real game). The commit it was built from is printed at the top of the page.
//
//   bun scripts/build-web.mjs                    # dist/terminal-nexus-playtest.html
//   bun scripts/build-web.mjs --out some/file.html
//   bun scripts/build-web.mjs --demos demos.json # with buttons that start this pull request's demos
//
// A demos file is a list of `{ "label", "try", "at"?, "keys"?, "settings"? }`: a button's name, what to
// try once it starts (shown under the screen), where it opens as a route (`campaign?level=vasse-test-1&round=2`
// opens round 2 without a key script walking there; the same as `--at` in a terminal), and the key script and
// settings text a campaign level starts from — the same as `--keys` and `--settings`. It is how a pull
// request's playable page opens the game exactly where its question is. `src/web/demos.ts` checks every demo
// with the page's own readers, so a bad route or key script fails the build. A pull request's file lives in
// `scripts/demos/` while its page is current, as an example for the next; delete it once the question is
// answered.
//
// The file opens straight from disk, or is published as a private claude.ai page for a phone. A copy on disk
// also opens at a place from its address — `#at=campaign?level=vasse-test-1&round=3`, with `&settings=` and
// `&keys=` as a demo has them (`src/web/address.ts`); a claude.ai link cannot carry an address with `=` in
// it, which is what a demo's `at` is for.

import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { bundleForBrowser, repoRoot } from "./lib/web-bundle.mjs"
import { checkDemos } from "../src/web/demos.ts"

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
// A route or a key script the page cannot follow would open somewhere else and say nothing: refused here,
// with the page's own readers.
const demos = demosPath === null ? [] : checkDemos(JSON.parse(readFileSync(demosPath, "utf8")), demosPath)

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
