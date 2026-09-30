#!/usr/bin/env node
// A scripted playtest: press keys on a screen of the game without a terminal, and get back what the
// screen showed after every key — as text, as PNGs, and as an animated GIF.
//
//   node scripts/playtest.mjs --keys "Down Down Space*4"
//   node scripts/playtest.mjs --keys "n 1 n Tab S-Left*3 Enter" --png final
//   node scripts/playtest.mjs --file my-flow.keys --gif --name hatchery-run
//   node scripts/playtest.mjs --keys "1 click:24,13 click:24,13" --print all
//
// The keys go through the real keyboard and mouse adapters as the exact bytes a terminal sends, one
// key at a time (`src/playtest/keys.ts` has the names). The frames come from the same composer the
// live screen presents, in-process, so there is no capture race: every picture is of the state the
// script actually reached. Only the Build Phase screen (`terminal-nexus --spike`) is wired up so far;
// `src/playtest/build.ts` is the shape another screen would copy.
//
// Output goes to `.playtest/` (ignored by git) unless `--out` says otherwise. Point `--out` at
// `evidence/screenshots` only for an image that is going into a pull request.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { importSettings } from "../src/build/settings-export.ts"
import { DEFAULT_SETTINGS } from "../src/settings/types.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { frameToText } from "../src/view/frame.ts"
import { parseCapability, parseTheme } from "../src/view/roles.ts"
import { parseGlyphPack } from "../src/view/theme.ts"
import { renderFramePng, renderFramesGif } from "./lib/frame-capture.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")

const USAGE = `usage: node scripts/playtest.mjs (--keys "<script>" | --file <path>) [options]

  --keys "<script>"    keys to press, e.g. "Down Down Space*4" (names: src/playtest/keys.ts)
  --file <path>        the same, from a file; # starts a comment
  --size 80x24         terminal size (default 80x24; 104x32 is the largest view, 128x24 wide tiles)
  --capability <mode>  truecolor (default), color256, color16, monochrome
  --theme <theme>      dark (default) or light
  --glyphs <pack>      ascii (default) or unicode
  --settings "<text>"  start from an exported settings text (Settings > Export settings): paste the
                       whole export, or pairs like "incoming=hidden nextRound=auto"; the three
                       flags above still win for their own setting
  --out <dir>          where files go (default .playtest/, ignored by git)
  --name <name>        file name prefix (default playtest)
  --print <which>      frames printed to stdout: final (default), all, none
  --png <which>        PNGs to render: final, all, or step numbers like 0,3,6 (0 is the opening screen)
  --gif                an animated GIF of every step
  --delay <ms>         how long each GIF frame shows (default 900)
  --hold <ms>          how long the GIF's last frame shows (default 2500)
  --scale <n>          pixel scale, default 2 (sharp on a phone; 1 makes files about a third the size)
  --caption <text>     text in front of each image's step caption
  --force              render images even if an identical one is already there
`

const { values } = parseArgs({
  options: {
    keys: { type: "string" },
    file: { type: "string" },
    size: { type: "string", default: "80x24" },
    capability: { type: "string" },
    theme: { type: "string" },
    glyphs: { type: "string" },
    settings: { type: "string" },
    out: { type: "string", default: ".playtest" },
    name: { type: "string", default: "playtest" },
    print: { type: "string", default: "final" },
    png: { type: "string" },
    gif: { type: "boolean", default: false },
    delay: { type: "string", default: "900" },
    hold: { type: "string", default: "2500" },
    scale: { type: "string" },
    caption: { type: "string" },
    force: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
})

if (values.help || (values.keys === undefined && values.file === undefined)) {
  process.stdout.write(USAGE)
  process.exit(values.help ? 0 : 2)
}

const size = /^(\d+)x(\d+)$/u.exec(values.size)
if (size === null) throw new Error(`--size wants COLSxROWS, like 80x24, not "${values.size}"`)
// An exported settings text first, then the flags over it; truecolor, dark and ascii otherwise.
const imported = importSettings(values.settings, { ...DEFAULT_SETTINGS, capability: "truecolor" })
if (imported.ignored.length > 0) process.stderr.write(`--settings ignored ${imported.ignored.join(", ")}\n`)
const startSettings = imported.settings
const capability = parseCapability(values.capability ?? startSettings.capability)
const theme = parseTheme(values.theme ?? startSettings.theme)
const glyphPack = parseGlyphPack(values.glyphs ?? startSettings.glyphPack)
const script = values.file === undefined ? values.keys : readFileSync(values.file, "utf8")

const steps = parseKeyScript(script)
const run = runBuildPlaytest({
  steps,
  columns: Number(size[1]),
  rows: Number(size[2]),
  settings: { ...startSettings, capability, theme, glyphPack },
  experiments: imported.experiments,
})
const last = run.frames.length - 1

// --- Text: always all of it on disk, and what was asked for on stdout ------------------------------

const outDir = resolve(repoRoot, values.out)
mkdirSync(outDir, { recursive: true })
const scratch = join(repoRoot, ".playtest", ".scratch")

const heading = (frame) =>
  frame.index === 0
    ? `--- step 0: the screen as it opens`
    : `--- step ${frame.index}: ${frame.label}  ${JSON.stringify(frame.bytes)}`
// What the bottom line reads after the step — the last key's answer, or the hint for where the keyboard
// is (feedback F59), or the Pulse's own line: read off the frame itself, so it is what a player sees.
const statusOf = (frame) => {
  const line = frameToText(frame.frame).split("\n")[run.layout.footerRow] ?? ""
  return line.replace(/^\s*\|\s?/u, "").replace(/\s*\|\s*$/u, "").trim() || "(bottom line empty)"
}

const transcript = run.frames.map((frame) => `${heading(frame)}\n${frameToText(frame.frame)}\n`).join("\n")
const textPath = join(outDir, `${values.name}.txt`)
writeFileSync(textPath, transcript, "utf8")

for (const frame of run.frames) {
  const { cursor } = frame.state
  const where = `cursor ${`${cursor.x},${cursor.y}`.padEnd(5)}${frame.moveKind === null ? "" : ` ${frame.moveKind}`}`.padEnd(20)
  const summary = `step ${String(frame.index).padStart(2)}  ${frame.label.padEnd(12)} focus ${frame.state.focus.padEnd(4)}  ${where}${statusOf(frame)}`
  if (values.print === "all") process.stdout.write(`${heading(frame)}\n${frameToText(frame.frame)}\n\n`)
  else process.stdout.write(`${summary}\n`)
}
if (values.print === "final") process.stdout.write(`\n${frameToText(run.frames[last].frame)}\n`)
if (run.ended !== null) {
  process.stdout.write(
    `\nthe script left the screen (${run.ended.by}) at step ${run.ended.atStep}; ${run.ended.skipped} later step(s) not run\n`,
  )
}
process.stdout.write(`\ntext of every step: ${relative(repoRoot, textPath)}\n`)

// --- Pictures ------------------------------------------------------------------------------------

const caption = (frame) => {
  const step = frame.index === 0 ? "as it opens" : `step ${frame.index} of ${last}: ${frame.label}`
  return values.caption === undefined ? step : `${values.caption} - ${step}`
}

const report = (result) =>
  process.stdout.write(`${result.written ? "wrote" : "unchanged"} ${relative(repoRoot, result.path)}\n`)

if (values.png !== undefined) {
  const wanted =
    values.png === "final"
      ? [last]
      : values.png === "all"
        ? run.frames.map((frame) => frame.index)
        : values.png.split(",").map(Number)
  for (const index of wanted) {
    const frame = run.frames[index]
    if (frame === undefined) throw new Error(`--png asked for step ${index}; the script has 0-${last}`)
    const name = values.png === "final" ? `${values.name}.png` : `${values.name}-step${String(index).padStart(2, "0")}.png`
    report(
      renderFramePng({
        frame: frame.frame,
        capability: frame.state.settings.capability,
        theme: frame.state.settings.theme,
        caption: caption(frame),
        targetPath: join(outDir, name),
        scratchDir: scratch,
        scale: Number(values.scale ?? 2),
      }),
    )
  }
}

if (values.gif) {
  const result = renderFramesGif({
    shots: run.frames.map((frame, index) => ({
      frame: frame.frame,
      caption: caption(frame),
      delayMs: index === last ? Number(values.hold) : Number(values.delay),
    })),
    capability: run.frames[last].state.settings.capability,
    theme: run.frames[last].state.settings.theme,
    targetPath: join(outDir, `${values.name}.gif`),
    scratchDir: scratch,
    scale: Number(values.scale ?? 2),
  })
  report(result)
  if (result.written) process.stdout.write(`  ${(result.bytes / 1024).toFixed(0)} KB, ${run.frames.length} frames\n`)
}

rmSync(scratch, { recursive: true, force: true })
