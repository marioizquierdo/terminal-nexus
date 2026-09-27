// Bundling the game's own code for a browser — shared by `scripts/build-web.mjs` (the playtest page)
// and `tests/web.test.ts` (which proves the bundle computes what Node computes). Needs Bun: its
// bundler is the one the project already has, and it runs TypeScript as the terminal game does.
//
// Two rules make "the browser runs the terminal's code, not a copy" something the build enforces
// rather than hopes:
//
//   * **no `node:` module may be reached.** The build fails naming the file that asked for one, so a
//     Node-only import slipping into the shared code breaks this build the day it lands;
//   * **OpenTUI is replaced by a stub**, because it is native code that only a real terminal can run,
//     and the page never selects it (it hands each screen loop its canvas backend directly).

import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OPENTUI_STUB = join(repoRoot, "src", "web", "no-opentui.ts")

/**
 * Bundle `entry` (a path under the repository) into one browser script.
 * Returns `{ code, files }`: the script, and the repository-relative source files it contains.
 */
export async function bundleForBrowser(entry, { define = {}, format = "iife", minify = true } = {}) {
  if (typeof Bun === "undefined") throw new Error("bundling for the browser needs Bun: run this with `bun`")
  const reachedNode = []
  const result = await Bun.build({
    entrypoints: [join(repoRoot, entry)],
    target: "browser",
    format,
    minify,
    define,
    metafile: true,
    plugins: [
      {
        name: "terminal-nexus-web",
        setup(build) {
          build.onResolve({ filter: /^node:/ }, (args) => {
            reachedNode.push(`${relative(repoRoot, args.importer)} imports ${args.path}`)
            return { path: args.path, external: true }
          })
          build.onResolve({ filter: /\/opentui\.ts$/ }, () => ({ path: OPENTUI_STUB }))
        },
      },
    ],
  })
  if (reachedNode.length > 0) {
    throw new Error(`the browser build reached Node-only modules:\n  ${reachedNode.join("\n  ")}`)
  }
  if (!result.success) throw new Error(result.logs.map(String).join("\n"))
  const files = Object.keys(result.metafile?.inputs ?? {}).map((path) => relative(repoRoot, join(repoRoot, path)))
  return { code: await result.outputs[0].text(), files }
}
