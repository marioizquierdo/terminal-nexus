#!/usr/bin/env node
// A scripted playtest: press keys on a screen of the game without a terminal, and get back what the
// screen showed after every key — as text, as PNGs, and as an animated GIF.
//
//   node scripts/playtest.mjs --keys "Esc Down Down Space*4"          # Esc skips PERIMETER's intro
//   node scripts/playtest.mjs --keys "Esc n 1 n Tab S-Left*3 Enter" --png final
//   node scripts/playtest.mjs --file my-flow.keys --gif --name hatchery-run
//   node scripts/playtest.mjs --keys "Esc 1 click:24,13 click:24,13" --print all
//   node scripts/playtest.mjs --keys "Esc n 1 1 Enter" --activity Interactions   # what it logged
//   node scripts/playtest.mjs --at "story?mission=vasse-test-1&round=3" --png final   # round 3, no keys
//   node scripts/playtest.mjs --at "skirmish?seed=1" --keys "Esc n 1 1 Enter"         # a Skirmish
//   node scripts/playtest.mjs --load tmp/mine.save.json --p2 script:rush               # a save, at its Build Phase
//
// The keys go through the real keyboard and mouse adapters as the exact bytes a terminal sends, one
// key at a time (`src/playtest/keys.ts` has the names). The frames come from the same composer the
// live screen presents, in-process, so there is no capture race: every picture is of the state the
// script actually reached. Only the Build Phase is wired up so far — a story mission's at a round, or a Skirmish's:
// `--at` names which, as the game's own `--at` does (`src/cli/route.ts`), `--load` opens a save file, and a title
// menu route is refused; `src/playtest/build.ts` is the shape another screen would copy. Save game (Esc, v) writes
// a file as the game does: a name with a folder (tmp/mine) where it says, a bare name into the game's saves folder.
//
// Output goes to `.playtest/` (ignored by git) unless `--out` says otherwise. A picture for a pull
// request is committed on the branch under `docs/pr-pictures/` (`--out docs/pr-pictures`), and the
// folder is removed by the branch's last commit; a picture for the permanent record goes to
// `docs/history/screenshots/` with a dated name.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { importSettings } from "../src/build/settings-export.ts"
import { DEFAULT_SETTINGS } from "../src/settings/types.ts"
import { gameOpening } from "../src/playtest/build.ts"
import { runGamePlaytest } from "../src/playtest/game.ts"
import { readProfiles } from "../src/skirmish/profile-files.ts"
import { listSaves } from "../src/cli/skirmish-files.ts"
import { terminalNoter } from "../src/cli/note-files.ts"
import { ACTIVITY_FILTERS, formatActivityExport } from "../src/log/activity.ts"
import { frameToText } from "../src/view/frame.ts"
import { parseColorDepth, parseTheme } from "../src/view/roles.ts"
import { parseGlyphPack } from "../src/view/theme.ts"
import { renderFramePng, renderFramesGif } from "./lib/frame-capture.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")

const USAGE = `usage: node scripts/playtest.mjs (--keys "<script>" | --file <path> | --at <route> | --load <file>) [options]

  --keys "<script>"    keys to press, e.g. "Esc n 1 1 Enter" (names: src/playtest/keys.ts). Told
                       nowhere, it opens saves/crossing-new.save.json: a new Skirmish on the
                       Crossing, Vasse against Dob Hunter, seed 7, on its opening lines (Esc skips)
  --file <path>        the same, from a file; # starts a comment
  --at <route>         where to open, as the game's --at takes it: a title menu screen ("menu",
                       "skirmish?setup=new", "skirmish?setup=load"), a story mission at a round,
                       "story?mission=vasse-test-1&round=3" (round counts Battle Rounds from
                       1, as the screen does; a later round is reached as a player who builds
                       nothing reaches it), or a Skirmish, "skirmish?seed=1" (Vasse against
                       Dob Hunter's balanced script on the Crossing). The script follows the
                       game from screen to screen: New game's Start opens its battle, a
                       result's [m] goes back to the setup screen. With --at, --load or
                       --note, the keys may be left out
  --load <file>        a Skirmish save file, opened at its Build Phase with its plan so far
                       (what Save game writes): the same as --at "skirmish?load=<file>"
  --note <file>        a playtest note (the ! key writes one), opened at its moment: its round as
                       it opened, the commands pressed since replayed at their times; --keys go on
                       from there. The settings it was played with unless --settings says others
  --notes <dir>        where ! writes a note (default .playtest/notes/, never the player's own)
  --saves <dir>        the saves Load game lists and Save game writes a bare name into (default
                       .playtest/saves/, never the player's own), then saves/
  --player <name>      the name a Player slot shows on the setup screen (default player)
  --p1 <who>, --p2 <who>  who plays each slot of a Skirmish, as the skirmish command takes
                       them: build: (the screen; build:plan.json lays a plan on round 1's
                       Build Phase) or script:<name>. The screen plays p1
  --size 80x24         terminal size (default 80x24; 104x30 is the largest view, and a larger one centres it)
  --colors <depth>     truecolor (default), color256, monochrome
  --theme <theme>      dark (default) or light; the game paints its own background
  --glyphs <pack>      ascii (default) or unicode
  --settings "<text>"  start from an exported settings text (Settings > Export settings): paste the
                       whole export, or pairs like "nextRound=auto jumpStep=12"; the three
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
    load: { type: "string" },
    p1: { type: "string" },
    p2: { type: "string" },
    size: { type: "string", default: "80x24" },
    colors: { type: "string" },
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
    player: { type: "string", default: "player" },
    note: { type: "string" },
    notes: { type: "string" },
    saves: { type: "string" },
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

if (values.help || (values.keys === undefined && values.file === undefined && values.at === undefined && values.load === undefined && values.note === undefined)) {
  process.stdout.write(USAGE)
  process.exit(values.help ? 0 : 2)
}

// Where the run opens and what it starts from, read as the game reads them and refused before anything runs: a
// route that is not a place, with every problem at once, a key the script names that does not exist, or a place
// on the title menu, which this playtest does not play.
const script = values.file === undefined ? values.keys : readFileSync(values.file, "utf8")
let opening
const profiles = readProfiles()
try {
  const slots = { ...(values.p1 === undefined ? {} : { p1: values.p1 }), ...(values.p2 === undefined ? {} : { p2: values.p2 }) }
  opening = gameOpening({ at: values.at, settings: values.settings, keys: script }, values.file, {
    ...(values.load === undefined ? {} : { load: values.load }),
    ...(values.note === undefined ? {} : { note: values.note }),
    slots,
    profiles,
  })
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(2)
}

const size = /^(\d+)x(\d+)$/u.exec(values.size)
if (size === null) throw new Error(`--size wants COLSxROWS, like 80x24, not "${values.size}"`)
// An exported settings text first, then the flags over it; truecolor, dark and ascii otherwise.
const imported = importSettings(opening.settings, { ...DEFAULT_SETTINGS, colors: "truecolor" })
if (imported.ignored.length > 0) process.stderr.write(`--settings ignored ${imported.ignored.join(", ")}\n`)
const startSettings = imported.settings
const colors = parseColorDepth(values.colors ?? startSettings.colors)
const theme = parseTheme(values.theme ?? startSettings.theme)
const glyphPack = parseGlyphPack(values.glyphs ?? startSettings.glyphPack)

// The saves Load game lists and Save game writes into: the script's own (.playtest/saves, git-ignored) unless --saves
// names another, so a script never reads or writes the player's own saves and its row numbers never depend on them.
const savesDir = resolve(values.saves ?? ".playtest/saves")
const run = runGamePlaytest({
  steps: opening.steps,
  columns: Number(size[1]),
  rows: Number(size[2]),
  settings: { ...startSettings, colors, theme, glyphPack },
  experiments: imported.experiments,
  start: opening.start,
  profiles,
  playerName: values.player,
  saves: () => listSaves(profiles, savesDir),
  savesFolder: savesDir,
  // A note (!) goes into the script's own notes folder (.playtest/notes) unless --notes names another.
  noter: terminalNoter(resolve(values.notes ?? ".playtest/notes")),
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
  if (frame.footerRow === null) return frame.summary ?? ""
  const line = frameToText(frame.frame).split("\n")[frame.footerRow] ?? ""
  return line.replace(/^\s*\|\s?/u, "").replace(/\s*\|\s*$/u, "").trim() || "(bottom line empty)"
}

const transcript = run.frames.map((frame) => `${heading(frame)}\n${frameToText(frame.frame)}\n`).join("\n")
const textPath = join(outDir, `${values.name}.txt`)
writeFileSync(textPath, transcript, "utf8")

for (const frame of run.frames) {
  const summary =
    frame.state === null
      ? `step ${String(frame.index).padStart(2)}  ${frame.label.padEnd(12)} title  ${statusOf(frame)}`
      : `step ${String(frame.index).padStart(2)}  ${frame.label.padEnd(12)} focus ${frame.state.focus.padEnd(4)}  ${`cursor ${`${frame.state.cursor.x},${frame.state.cursor.y}`.padEnd(5)}${frame.moveKind === null ? "" : ` ${frame.moveKind}`}`.padEnd(20)}${statusOf(frame)}`
  if (values.print === "all") process.stdout.write(`${heading(frame)}\n${frameToText(frame.frame)}\n\n`)
  else process.stdout.write(`${summary}\n`)
}
if (values.print === "final") process.stdout.write(`\n${frameToText(run.frames[last].frame)}\n`)
if (run.ended !== null) {
  process.stdout.write(
    `\nthe script left the game at step ${run.ended.atStep}; ${run.ended.skipped} later step(s) not run\n`,
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
        colors: frame.settings.colors,
        theme: frame.settings.theme,
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
    colors: run.frames[last].settings.colors,
    theme: run.frames[last].settings.theme,
    targetPath: join(outDir, `${values.name}.gif`),
    scratchDir: scratch,
    scale: Number(values.scale ?? 2),
  })
  report(result)
  if (result.written) process.stdout.write(`  ${(result.bytes / 1024).toFixed(0)} KB, ${run.frames.length} frames\n`)
}

rmSync(scratch, { recursive: true, force: true })
