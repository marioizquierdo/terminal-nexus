// Terminal lifecycle (docs/system-design/runtime.md, "Terminal lifecycle").
//
// "A renderer that leaves the terminal in raw mode is a reason to reject it." These tests drive the
// backend against fake streams, because the lifecycle cases matter more than the frame rate does.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { AnsiBackend } from "../src/view/backends/ansi.ts"
import { selectBackend } from "../src/view/backends/index.ts"
import { createTerminalSession } from "../src/cli/lifecycle.ts"
import { composeBands } from "../src/view/index.ts"
import { MENU_SIZE } from "../src/view/menu.ts"
import { RUNTIME_IS_BUN } from "./helpers.ts"

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

// The shared disposer itself (src/cli/lifecycle.ts) — so every screen of `terminal-nexus` builds on one implementation, not two.

test("createTerminalSession runs every dispose step exactly once, in order, no matter how many times dispose() is called", async () => {
  const order: string[] = []
  const session = createTerminalSession()
  session.onDispose(() => {
    order.push("a")
  })
  session.onDispose(async () => {
    order.push("b")
  })
  session.onDispose(() => {
    order.push("c")
  })

  await Promise.all([session.dispose(), session.dispose()])
  await session.dispose()

  assert.deepEqual(order, ["a", "b", "c"])
})

test("createTerminalSession's onSignal hooks SIGINT and SIGTERM, and dispose unhooks them", async () => {
  const session = createTerminalSession()
  const before = { int: process.listenerCount("SIGINT"), term: process.listenerCount("SIGTERM") }

  let left = 0
  session.onSignal(() => {
    left += 1
  })
  assert.equal(process.listenerCount("SIGINT"), before.int + 1, "onSignal did not hook SIGINT")
  assert.equal(process.listenerCount("SIGTERM"), before.term + 1, "onSignal did not hook SIGTERM")

  process.emit("SIGINT")
  assert.equal(left, 1)
  process.emit("SIGTERM")
  assert.equal(left, 2)

  await session.dispose()
  assert.equal(process.listenerCount("SIGINT"), before.int, "dispose left a SIGINT listener behind")
  assert.equal(process.listenerCount("SIGTERM"), before.term, "dispose left a SIGTERM listener behind")

  // Idempotent like every other path through this class: a signal after dispose calls nothing.
  process.emit("SIGINT")
  assert.equal(left, 2)
})

function blankFrame() {
  return composeBands(4, 2, [])
}

test("the backend enters and leaves the alternate screen and raw mode", async () => {
  const { stdout, stdin } = fakes()
  const backend = new AnsiBackend({
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    colors: "color256",
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
    colors: "color256",
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
    colors: "color256",
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
    colors: "monochrome" as const,
    ...MENU_SIZE,
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
