// Capture still frames from a scenario as plain text, for gate evidence.
//
//   node scripts/capture-frames.mjs citizen-mirror-skirmish 0 112 160 240
//
// Frames are written to evidence/frames/<scenario>-t<tick>.txt at one column per tile, which is the
// 80 x 24 acceptance composition. Monochrome only, and deliberately: the text form of a frame holds
// its glyphs, and those are identical in every capability mode — that is what "no cell depends on
// colour to exist" means. This is an evidence tool, not part of the game.

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const [scenarioName, ...tickArgs] = process.argv.slice(2)

if (scenarioName === undefined) {
  console.error("usage: node scripts/capture-frames.mjs <scenario-id> [tick ...]")
  process.exit(2)
}

const { buildTimeline } = await import(join(repoRoot, "src/cli/timeline.ts"))
const { loadMapFile, loadScenario } = await import(join(repoRoot, "src/scenario/index.ts"))
const { createView, frameToText } = await import(join(repoRoot, "src/view/index.ts"))

const scenario = await loadMapFile(join(repoRoot, "scenarios", scenarioName))
const loaded = loadScenario(scenario)
const timeline = buildTimeline(
  scenario,
  loaded.state,
  loaded.registry,
  scenario.pulseTicks,
  scenario.seed,
)
const view = createView(timeline)

const ticks = tickArgs.length > 0 ? tickArgs.map(Number) : [0, Math.floor(view.lastTick / 2), view.lastTick]
const outputDirectory = join(repoRoot, "evidence", "frames")
mkdirSync(outputDirectory, { recursive: true })

for (const tick of ticks) {
  const frame = view.snapshotAt(tick * view.tickDurationMs, "monochrome", 1)
  const file = join(outputDirectory, `${scenario.id}-t${String(tick).padStart(4, "0")}.txt`)
  writeFileSync(file, `${frameToText(frame)}\n`, "utf8")
  console.log(`${file}  ${frame.width}x${frame.height}`)
}
