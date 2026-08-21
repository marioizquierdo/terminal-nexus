// Terminal lifecycle — engine.md 10.1 and milestone-1-spike-battle.md 3.8.
//
// "A renderer that leaves the terminal in raw mode is a reason to reject it." These tests drive the
// backend against fake streams, because the lifecycle cases matter more than the frame rate does.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { AnsiBackend } from "../src/view/backends/ansi.ts"
import { selectBackend } from "../src/view/backends/index.ts"
import { DEFAULT_PRESENTATION, compositionSize, composeBands } from "../src/view/index.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { buildTimeline } from "../src/cli/timeline.ts"
import { watchPulse } from "../src/cli/watch.ts"
import { loadScenario } from "../src/scenario/index.ts"
import { RUNTIME_IS_BUN, loadScenarioFile } from "./helpers.ts"

const ESC = String.fromCharCode(27)

class FakeStdout extends EventEmitter {
  isTTY = true
  columns = 80
  rows = 24
  written = ""
  write(text: string): boolean {
    this.written += text
    return true
  }
}

class FakeStdin extends EventEmitter {
  isTTY = true
  raw = false
  resumed = false
  paused = false
  setRawMode(value: boolean): this {
    this.raw = value
    return this
  }
  resume(): this {
    this.resumed = true
    this.paused = false
    return this
  }
  pause(): this {
    this.paused = true
    return this
  }
}

function fakes(): { stdout: FakeStdout; stdin: FakeStdin } {
  return { stdout: new FakeStdout(), stdin: new FakeStdin() }
}

function blankFrame() {
  return composeBands(4, 2, [])
}

test("the backend enters and leaves the alternate screen and raw mode", async () => {
  const { stdout, stdin } = fakes()
  const backend = new AnsiBackend({
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    capability: "color16",
  })

  await backend.start()
  assert.ok(stdout.written.includes(`${ESC}[?1049h`), "never entered the alternate screen")
  assert.ok(stdout.written.includes(`${ESC}[?25l`), "never hid the cursor")
  assert.equal(stdin.raw, true, "never entered raw mode")

  backend.present(blankFrame())
  await backend.stop()

  assert.ok(stdout.written.includes(`${ESC}[?1049l`), "never left the alternate screen")
  assert.ok(stdout.written.includes(`${ESC}[?25h`), "never showed the cursor again")
  assert.equal(stdin.raw, false, "left the terminal in raw mode")
  assert.equal(stdin.paused, true, "left stdin flowing")
})

test("the disposer is idempotent, whichever path reaches it", async () => {
  const { stdout, stdin } = fakes()
  const backend = new AnsiBackend({
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    capability: "color16",
  })
  await backend.start()
  await backend.stop()
  const afterFirst = stdout.written

  // q, SIGINT, SIGTERM, a setup failure and a caught render failure all end here; calling it twice
  // must be harmless rather than write a second restore sequence.
  await backend.stop()
  await backend.stop()
  assert.equal(stdout.written, afterFirst, "a second stop wrote more escapes")
  assert.equal(stdin.raw, false)
})

test("a non-TTY session writes no escape sequences at all", async () => {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  stdout.isTTY = false
  stdin.isTTY = false
  const backend = new AnsiBackend({
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    capability: "color16",
  })
  await backend.start()
  await backend.stop()
  assert.equal(stdout.written, "", "a non-TTY start or stop wrote to the stream")
  assert.equal(stdin.raw, false)
})

function backendOptions() {
  const { stdout, stdin } = fakes()
  return {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    capability: "monochrome" as const,
    ...compositionSize(1),
  }
}

test("an explicit backend choice resolves, and an unknown one is refused", async () => {
  const options = backendOptions()
  assert.equal((await selectBackend("ansi", options)).name, "direct-ansi")
  await assert.rejects(async () => selectBackend("nonsense", options), /unknown backend/)
})

// On Bun the native core does load, and `auto` builds a live renderer against the real terminal —
// not something to construct against fake streams inside a test run. So the fallback assertion is
// registered only where the fallback is what happens.
if (!RUNTIME_IS_BUN) {
  test("auto falls back to direct ANSI where OpenTUI's native core cannot load", async () => {
    const auto = await selectBackend("auto", backendOptions())
    assert.equal(auto.name, "direct-ansi")
    await auto.stop()
  })
}

async function watchSession(
  end: (stdin: FakeStdin) => void,
): Promise<{ stdout: FakeStdout; stdin: FakeStdin; exits: number[] }> {
  const scenario = await loadScenarioFile("melee-kill.ts")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  const timeline = buildTimeline(
    scenario,
    loaded.state,
    loaded.registry,
    scenario.pulseTicks,
    scenario.seed,
  )
  const { stdout, stdin } = fakes()
  const exits: number[] = []

  const session = watchPulse({
    timeline,
    capability: "monochrome",
    tileWidth: 1,
    speed: 1,
    backend: "ansi",
    presentation: DEFAULT_PRESENTATION,
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: (code) => {
      exits.push(code)
    },
  })

  // Let the loop start, end it the way this case is about, then let the disposer settle.
  await new Promise((resolve) => setTimeout(resolve, 60))
  end(stdin)
  await new Promise((resolve) => setTimeout(resolve, 60))
  void session
  return { stdout, stdin, exits }
}

test("quitting with q runs the disposer and restores the terminal", async () => {
  const { stdout, stdin, exits } = await watchSession((input) => {
    input.emit("data", Buffer.from("q"))
  })
  assert.deepEqual(exits, [0])
  assert.equal(stdin.raw, false, "q left the terminal in raw mode")
  assert.ok(stdout.written.includes(`${ESC}[?1049l`), "q did not leave the alternate screen")
  assert.ok(stdout.written.includes(`${ESC}[?25h`), "q did not restore the cursor")
  assert.match(stdout.written, /melee-kill  ticks \d+  state sha256:/)
})

test("an interrupt byte in raw mode ends the session the same way", async () => {
  const { stdout, stdin, exits } = await watchSession((input) => {
    input.emit("data", Buffer.from([3]))
  })
  assert.deepEqual(exits, [0])
  assert.equal(stdin.raw, false)
  assert.ok(stdout.written.includes(`${ESC}[?1049l`))
})

test("SIGINT and SIGTERM reach the same disposer", async () => {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    const { stdout, stdin, exits } = await watchSession(() => {
      process.emit(signal)
    })
    assert.deepEqual(exits, [0], `${signal} did not end the session`)
    assert.equal(stdin.raw, false, `${signal} left the terminal in raw mode`)
    assert.ok(stdout.written.includes(`${ESC}[?1049l`), `${signal} did not restore the screen`)
  }
})

test("watch holds on the final frame after the Pulse ends, and only quits on q", async () => {
  // The owner's finding: watch used to end the session on its own a couple of seconds after the
  // Pulse finished, which could vanish a fight out from under someone still looking at it. Speed is
  // cranked so the Pulse (180 ticks, 15s of presentation time) finishes in well under a second of
  // real test time, rather than waiting it out at 1x.
  const scenario = await loadScenarioFile("melee-kill.ts")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  const timeline = buildTimeline(
    scenario,
    loaded.state,
    loaded.registry,
    scenario.pulseTicks,
    scenario.seed,
  )
  const { stdout, stdin } = fakes()
  const exits: number[] = []

  const session = watchPulse({
    timeline,
    capability: "monochrome",
    tileWidth: 1,
    speed: 200,
    backend: "ansi",
    presentation: DEFAULT_PRESENTATION,
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: (code) => {
      exits.push(code)
    },
  })

  // Long enough for presentation time to run well past the Pulse's own end (15s at 1x, so under
  // 100ms at 200x) and past the old two-second grace window besides.
  await new Promise((resolve) => setTimeout(resolve, 400))
  assert.deepEqual(exits, [], "watch exited on its own once the Pulse ended")
  assert.ok(stdout.written.includes("pulse over -"), "the footer never reported the outcome")

  stdin.emit("data", Buffer.from("q"))
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.deepEqual(exits, [0], "q did not end a session held past the Pulse's end")
  assert.equal(stdin.raw, false, "q left the terminal in raw mode")
  void session
})

test("a render failure is caught, and still restores the terminal", async () => {
  const scenario = await loadScenarioFile("melee-kill.ts")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  const timeline = buildTimeline(
    scenario,
    loaded.state,
    loaded.registry,
    scenario.pulseTicks,
    scenario.seed,
  )
  const { stdout, stdin } = fakes()
  // A stdout that throws on the first frame stands in for any failure inside present().
  let frames = 0
  stdout.write = (text: string): boolean => {
    stdout.written += text
    frames += 1
    if (frames === 2) throw new Error("render exploded")
    return true
  }

  const status = await watchPulse({
    timeline,
    capability: "monochrome",
    tileWidth: 1,
    speed: 1,
    backend: "ansi",
    presentation: DEFAULT_PRESENTATION,
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: () => {},
  })

  assert.equal(status, 1, "a caught render failure should report a failure")
  assert.equal(stdin.raw, false, "a render failure left the terminal in raw mode")
  assert.ok(stdout.written.includes(`${ESC}[?1049l`), "a render failure left the alternate screen")
})
