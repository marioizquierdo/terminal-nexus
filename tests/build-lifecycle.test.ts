// `runSpike`'s lifecycle — engine.md 10.1's RULE, applied to the Build Phase screen. The same fake
// stdin/stdout pattern `tests/menu-session.test.ts` and `tests/lifecycle.test.ts` already use, and
// the same non-negotiables: one idempotent disposer reached from `q`, an interrupt byte, Esc with
// nothing armed, SIGINT and SIGTERM alike; raw mode, the alternate screen and mouse reporting all
// left off on every one of those paths.
//
// What is new here, and what the menu never had to answer: this screen's frame *changes size* with
// the terminal, so resizing is not only a gate question but a redraw question.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { runSpike } from "../src/cli/spike.ts"
import { MOUSE_REPORTING_OFF, MOUSE_REPORTING_ON } from "../src/menu/mouse.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"
import type { Settings } from "../src/settings/index.ts"

const ESC = String.fromCharCode(27)
const TEST_SETTINGS: Settings = { ...DEFAULT_SETTINGS, capability: "monochrome" }

class FakeStdout extends EventEmitter {
  isTTY = true
  columns = 80
  rows = 24
  written = ""
  /** Only the most recent write. The cumulative `written` can never prove something is *absent*
   *  from the current frame, which is exactly what the resize checks below need. */
  lastWrite = ""
  write(text: string): boolean {
    this.written += text
    this.lastWrite = text
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

async function spikeSession(
  end: (stdin: FakeStdin, stdout: FakeStdout) => void,
): Promise<{ stdout: FakeStdout; stdin: FakeStdin; exits: number[] }> {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const exits: number[] = []

  const session = runSpike({
    settings: TEST_SETTINGS,
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: (code) => {
      exits.push(code)
    },
  })

  await new Promise((resolve) => setTimeout(resolve, 30))
  end(stdin, stdout)
  await new Promise((resolve) => setTimeout(resolve, 30))
  void session
  return { stdout, stdin, exits }
}

test("launching enters the alternate screen, raw mode, and turns mouse reporting on", async () => {
  const { stdout, stdin } = await spikeSession(() => {})
  assert.ok(stdout.written.includes(`${ESC}[?1049h`), "never entered the alternate screen")
  assert.ok(stdout.written.includes(`${ESC}[?25l`), "never hid the cursor")
  assert.equal(stdin.raw, true, "never entered raw mode")
  assert.ok(stdout.written.includes(MOUSE_REPORTING_ON), "never turned mouse reporting on")
  assert.ok(stdout.written.includes("RESOURCE"), "never drew a first frame")
})

test("q, an interrupt byte, and Esc with nothing armed all reach the one disposer", async () => {
  for (const [name, bytes] of [
    ["q", Buffer.from("q")],
    ["an interrupt byte", Buffer.from([3])],
    ["esc", Buffer.from(ESC)],
  ] as const) {
    const { stdout, stdin, exits } = await spikeSession((input) => {
      input.emit("data", bytes)
    })
    assert.deepEqual(exits, [0], `${name} did not end the session`)
    assert.equal(stdin.raw, false, `${name} left the terminal in raw mode`)
    assert.ok(stdout.written.includes(`${ESC}[?1049l`), `${name} did not leave the alternate screen`)
    assert.ok(stdout.written.includes(MOUSE_REPORTING_OFF), `${name} left mouse reporting on`)
  }
})

test("Esc with something armed disarms instead of leaving", async () => {
  // engine.md 9.7: Esc "never quits the game by itself". Arming first is what makes it a disarm.
  const { stdout, exits } = await spikeSession((input) => {
    input.emit("data", Buffer.from("1"))
    input.emit("data", Buffer.from(ESC))
  })
  assert.deepEqual(exits, [], "Esc quit while a structure was armed")
  assert.ok(stdout.lastWrite.includes("Disarmed"), "Esc did not disarm")
})

test("a right click with nothing armed disarms rather than leaving the screen", async () => {
  const { exits } = await spikeSession((input) => {
    input.emit("data", Buffer.from(`${ESC}[<2;10;10M`))
  })
  assert.deepEqual(exits, [], "a right click ended the session")
})

test("SIGINT and SIGTERM reach the same disposer", async () => {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    const { stdout, stdin, exits } = await spikeSession(() => {
      process.emit(signal)
    })
    assert.deepEqual(exits, [0], `${signal} did not end the session`)
    assert.equal(stdin.raw, false, `${signal} left the terminal in raw mode`)
    assert.ok(stdout.written.includes(MOUSE_REPORTING_OFF), `${signal} left mouse reporting on`)
  }
})

test("below the floor the screen gates, and resizing back above it restores the Grid", async () => {
  const { stdout } = await spikeSession((input, output) => {
    output.columns = 79
    output.emit("resize")
    assert.ok(output.lastWrite.includes("TERMINAL TOO SMALL"), "79 columns did not gate")
    assert.ok(
      !output.lastWrite.includes("RESOURCE"),
      "the gated frame still drew the Build Phase behind it",
    )
    // Keys do nothing while gated — there is no screen to act on.
    input.emit("data", Buffer.from("1"))
    assert.ok(output.lastWrite.includes("TERMINAL TOO SMALL"), "a key redrew past the gate")
    output.columns = 80
    output.emit("resize")
  })
  assert.ok(stdout.lastWrite.includes("RESOURCE"), "resizing back did not restore the screen")
  assert.ok(stdout.lastWrite.includes("view x 0-47"), "the viewport did not come back")
})

test("a bigger terminal shows a bigger viewport, and the frame is cleared when its size changes", async () => {
  const { stdout } = await spikeSession((_input, output) => {
    assert.ok(output.lastWrite.includes("view x 0-47"), "did not start at the minimum viewport")
    output.columns = 104
    output.rows = 32
    output.emit("resize")
  })
  assert.ok(stdout.lastWrite.includes("view x 0-71"), "growing the terminal did not grow the viewport")
  assert.ok(
    stdout.written.includes(`${ESC}[2J`),
    "a frame that changed size was drawn over the old one without clearing it",
  )
})
