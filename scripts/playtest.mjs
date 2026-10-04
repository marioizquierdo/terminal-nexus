#!/usr/bin/env node
// A scripted playtest: press keys on a screen of the game without a terminal, and get back what the
// screen showed after every key — as text, as PNGs, and as an animated GIF.
//
//   node scripts/playtest.mjs --keys "Esc Down Down Space*4"          # Esc skips PERIMETER's intro
//   node scripts/playtest.mjs --keys "Esc n 1 n Tab S-Left*3 Enter" --png final
//   node scripts/playtest.mjs --file my-flow.keys --gif --name hatchery-run
//   node scripts/playtest.mjs --keys "Esc 1 click:24,13 click:24,13" --print all
//   node scripts/playtest.mjs --keys "Esc n 1 1 Enter" --activity Interactions   # what it logged
//   node scripts/playtest.mjs --at "campaign?level=vasse-test-1&round=3" --png final   # round 3, no keys
//
// The keys go through the real keyboard and mouse adapters as the exact bytes a terminal sends, one
// key at a time (`src/playtest/keys.ts` has the names). The frames come from the same composer the
// live screen presents, in-process, so there is no capture race: every picture is of the state the
// script actually reached. Only a campaign level's Build Phase is wired up so far — `--at` names which level
// and round, as the game's own `--at` does (`src/cli/route.ts`), and refuses a title menu route;
// `src/playtest/build.ts` is the shape another screen would copy.
//
// Output goes to `.playtest/` (ignored by git) unless `--out` says otherwise. A picture for a pull
// request is committed on the branch under `docs/pr-pictures/` (`--out docs/pr-pictures`), and the
// folder is removed by the branch's last commit; a picture for the permanent record goes to
// `docs/history/screenshots/` with a dated name.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { importSettings } from "../src/build/settings-export.ts"
import { DEFAULT_SETTINGS } from "../src/settings/types.ts"
import { playtestOpening, runBuildPlaytest } from "../src/playtest/build.ts"
import { RouteError } from "../src/cli/route.ts"
import { ACTIVITY_FILTERS, formatActivityExport } from "../src/log/activity.ts"
import { frameToText } from "../src/view/frame.ts"
import { parseCapability, parseTheme } from "../src/view/roles.ts"
import { parseGlyphPack } from "../src/view/theme.ts"
import { renderFramePng, renderFramesGif } from "./lib/frame-capture.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")

const USAGE = `usage: node scripts/playtest.mjs (--keys "<script>" | --file <path> | --at <route>) [options]

  --keys "<script>"    keys to press, e.g. "Esc Down Down Space*4" (names: src/playtest/keys.ts);
                       PERIMETER opens on its intro dialog, which Esc skips and Enter reads on
  --file <path>        the same, from a file; # starts a comment
  --at <route>         the campaign level and round to open, as the game's --at takes it:
                       "campaign?level=vasse-test-1&round=3" (round counts Battle Rounds from
                       1, as the screen does). Round 1 of vasse-test-1 unless given;
                       a later round is reached as a player who builds nothing reaches it.
                       With --at, the keys may be left out: the screen as it opens
  --size 80x24         terminal size (default 80x24; 104x30 is the largest view, 128x24 wide tiles)
  --capability <mode>  truecolor (default), color256, color16, monochrome
  --theme <theme>      dark (default) or light
  --glyphs <pack>      ascii (default) or unicode
  --settings "<text>"  start from an exported settings text (Settings > Export settings): paste the
                       whole export, or pairs like "nextRound=auto trainEvery=6"; the three
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
  --activity [filter]  after the run, print what it recorded in the Activity Logs as the game's
                       Activity logs window exports it, through one of its filters, Everything
                       when none is named: ${ACTIVITY_FILTERS.map((filter) => filter.name).join(", ")}.
                       Also saved as <name>-activity.txt
`

// `--activity` may stand alone, meaning every event: give it the Everything filter's name, so the parser
// (which wants a value for it) reads the rest of the line as it was written.
const argv = process.argv.slice(2)
const activityFlag = argv.indexOf("--activity")
if (activityFlag >= 0 && (argv[activityFlag + 1] === undefined || argv[activityFlag + 1].startsWith("--"))) {
  argv.splice(activityFlag + 1, 0, "Everything")
}

const { values } = parseArgs({
  args: argv,
  options: {
    keys: { type: "string" },
    file: { type: "string" },
    at: { type: "string" },
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
    activity: { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
})

// The Activity Logs filter to print through, found before the run so a mistyped name costs nothing.
const activityFilter =
  values.activity === undefined
    ? null
    : ACTIVITY_FILTERS.find((filter) => filter.name.toLowerCase() === values.activity.toLowerCase())
if (activityFilter === undefined) {
  throw new Error(`--activity: no filter named "${values.activity}"; the filters are ${ACTIVITY_FILTERS.map((filter) => filter.name).join(", ")}`)
}

if (values.help || (values.keys === undefined && values.file === undefined && values.at === undefined)) {
  process.stdout.write(USAGE)
  process.exit(values.help ? 0 : 2)
}

// Where the run opens, refused before anything runs: a route that is not a place, with every problem at once,
// or one on the title menu, which this playtest does not play.
let at
if (values.at !== undefined) {
  try {
    at = playtestOpening(values.at)
  } catch (error) {
    const said = error instanceof RouteError ? `--at ${error.message}` : error instanceof Error ? error.message : String(error)
    process.stderr.write(`${said}\n`)
    process.exit(2)
  }
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
const script = values.file === undefined ? (values.keys ?? "") : readFileSync(values.file, "utf8")

const steps = parseKeyScript(script)
const run = runBuildPlaytest({
  steps,
  columns: Number(size[1]),
  rows: Number(size[2]),
  settings: { ...startSettings, capability, theme, glyphPack },
  experiments: imported.experiments,
  ...(at === undefined ? {} : { at }),
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
// is, or the Pulse's own line: read off the frame itself, so it is what a player sees.
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

// What the run recorded, exported as a playtester's Activity logs window would export it:
// the agent's check that a flow logs what a pull request will ask someone to export.
if (activityFilter !== null) {
  const exported = formatActivityExport({
    entries: run.activity.entries(),
    filter: activityFilter,
    startedAt: run.activity.startedAt,
    dropped: run.activity.dropped,
    build: "scripted playtest",
  })
  const activityPath = join(outDir, `${values.name}-activity.txt`)
  writeFileSync(activityPath, exported, "utf8")
  process.stdout.write(`\n${exported}\nactivity logs: ${relative(repoRoot, activityPath)}\n`)
}

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
