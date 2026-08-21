// Capture a run of consecutive sub-tick frames around one engagement, so the interpolation and
// effect animation between ticks can actually be looked at rather than guessed at from two whole
// ticks apart. This is expensive to look at — many PNGs, each needing a careful glance — so it is a
// deliberate, on-request tool, not part of any default evidence pass.
//
// The method the owner asked for:
//   1. run the simulation headless to get the event log, no rendering;
//   2. find the tick the engagement actually starts (first attack.launched, unless a tick is given);
//   3. step to a little before it, then step *frame by frame* (not tick by tick) through the
//      opening exchange, capturing every frame — that is what shows a diagonal or a jump that whole
//      ticks smooth over.
//
//   node scripts/capture-engagement.mjs --scenario citizens-versus-ravels
//   node scripts/capture-engagement.mjs --scenario grand-battle --lead-ticks 2 --frames 12
//   node scripts/capture-engagement.mjs --scenario ravel-cascade --around-tick 48 --frames 20
//
// Output lands in evidence/screenshots/engagement-<scenario>/frame-NN.png, oldest first, plus an
// index.md naming the presentation-ms each one landed on.

import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  ansiToHtml,
  killSession,
  pane,
  renderPng,
  sendKeys,
  startWatch,
  stepToTick,
  tickOf,
  waitFor,
} from "./lib/terminal-capture.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const SESSION = "nexus-engagement"

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return fallback
  const value = process.argv[index + 1]
  return value === undefined ? fallback : value
}

const scenario = arg("scenario", null)
if (scenario === null) {
  console.error("usage: capture-engagement.mjs --scenario <name> [--around-tick N] [--frames N] " +
    "[--lead-ticks N] [--capability c] [--glyphs g] [--tile-width n]")
  process.exit(1)
}
const framesWanted = Number(arg("frames", "10"))
const leadTicks = Number(arg("lead-ticks", "1"))
const capability = arg("capability", "truecolor")
const glyphs = arg("glyphs", "unicode")
const tileWidth = arg("tile-width", "1")
const cols = Number(arg("cols", "80"))
const rows = Number(arg("rows", "24"))

const outputDirectory = join(repoRoot, "evidence", "screenshots", `engagement-${scenario}`)
const scratch = join(repoRoot, ".capture-tmp")

/**
 * Find the tick the fight actually opens, from the headless report alone — no terminal involved.
 * "The engagement starts" means the first attack.launched; the owner's method also wants to know
 * whether several attackers open within the same short window, since that is the case effects need
 * to survive.
 */
async function findEngagementTick(scenarioFile) {
  const { loadScenario } = await import("../src/scenario/index.ts")
  const { resolvePulse } = await import("../src/pulse/index.ts")
  const { FIXTURE_REGISTRY } = await import("../src/content/index.ts")
  const module = await import(`../scenarios/${scenarioFile}.ts`)
  const definition = module.default
  const loaded = loadScenario(definition, { registry: FIXTURE_REGISTRY, seed: definition.seed })
  const run = resolvePulse({
    initialState: loaded.state,
    registry: loaded.registry,
    pulseTicks: definition.pulseTicks,
    seed: definition.seed,
  })
  const firstAttack = run.events.find((event) => event.kind === "attack.launched")
  if (firstAttack === undefined) {
    throw new Error(`${scenarioFile}: no attack.launched event in the whole Pulse`)
  }
  const inFirstBeat = run.events.filter(
    (event) => event.kind === "attack.launched" && event.tick <= firstAttack.tick + 4,
  )
  console.log(
    `${scenarioFile}: first attack at tick ${firstAttack.tick} ` +
      `(${inFirstBeat.length} attack(s) within the first four ticks of it)`,
  )
  return firstAttack.tick
}

async function main() {
  const aroundArg = arg("around-tick", null)
  const aroundTick = aroundArg === null ? await findEngagementTick(scenario) : Number(aroundArg)
  const startTick = Math.max(0, aroundTick - leadTicks)

  const extraArgs = [
    "--capability", capability,
    "--tile-width", tileWidth,
    "--glyphs", glyphs,
  ]

  rmSync(outputDirectory, { recursive: true, force: true })
  mkdirSync(outputDirectory, { recursive: true })

  killSession(repoRoot, SESSION)
  startWatch(repoRoot, SESSION, `scenarios/${scenario}.ts`, cols, rows, extraArgs)
  stepToTick(repoRoot, SESSION, startTick)

  const index = []
  for (let frame = 0; frame < framesWanted; frame += 1) {
    if (frame > 0) sendKeys(repoRoot, SESSION, ".")
    // The frame-step key mutates presentation time synchronously, but the redraw it triggers is the
    // next render tick — give it a beat before capturing, the same margin startWatch's own waits use.
    waitFor(repoRoot, SESSION, (text) => text.length > 0, "a redraw", 2000)
    const text = pane(repoRoot, SESSION)
    const tick = tickOf(text)
    const captured = pane(repoRoot, SESSION, { colour: true })
    const name = `frame-${String(frame).padStart(2, "0")}`
    const html = ansiToHtml(captured, cols, rows)
    const file = renderPng({
      html,
      caption: `${scenario} - frame ${frame}, tick ${tick ?? "?"}`,
      cols,
      rows,
      scratchDir: scratch,
      targetPath: join(outputDirectory, `${name}.png`),
    })
    index.push({ frame, tick, file })
    console.log(`${file}  (tick ${tick ?? "?"})`)
  }

  sendKeys(repoRoot, SESSION, "q")
  killSession(repoRoot, SESSION)
  rmSync(scratch, { recursive: true, force: true })

  const lines = [
    `# Engagement capture - ${scenario}`,
    "",
    `Around tick ${aroundTick}, starting ${leadTicks} tick(s) early at ${startTick}, then stepped one ` +
      "presentation frame at a time (the `.` key, not `,`) so the sequence shows what whole-tick " +
      "steps interpolate over.",
    "",
    "| frame | tick | file |",
    "| --- | --- | --- |",
    ...index.map((entry) => `| ${entry.frame} | ${entry.tick ?? "?"} | ${entry.file.split("/").pop()} |`),
    "",
  ]
  writeFileSync(join(outputDirectory, "index.md"), lines.join("\n"), "utf8")
  console.log(`\n${framesWanted} frames written to ${outputDirectory}`)
}

try {
  await main()
} finally {
  killSession(repoRoot, SESSION)
  rmSync(scratch, { recursive: true, force: true })
}
