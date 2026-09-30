// Key presses, repeats and releases, where the terminal reports them — the kitty keyboard protocol's
// decoder, encoder and conversation (`src/view/key-events.ts`; the owner's third round, 2026-09-30,
// F79; Q66's design). What matters most: a classic terminal's bytes come through unchanged, the
// protocol's forms become the keys the adapters already read, and the flags are only ever popped when
// they were pushed.

import { test } from "node:test"
import assert from "node:assert/strict"
import { cursorKeyOf } from "../src/menu/list-keys.ts"
import { keyBytes } from "../src/playtest/keys.ts"
import {
  KEYBOARD_POP,
  KEYBOARD_PUSH,
  KEYBOARD_QUERY,
  KeyboardProtocol,
  decodeKeyEvent,
  encodeKeyEvent,
  terminalReplyOf,
} from "../src/view/key-events.ts"
import type { KeyPhase } from "../src/view/key-events.ts"
import { keysFromChunk } from "../src/view/playback.ts"

const ESC = "\u001b"
const CSI = `${ESC}[`

test("a classic terminal's bytes come through unchanged, with no phase", () => {
  const legacy = [
    `${CSI}A`, `${CSI}B`, `${CSI}C`, `${CSI}D`, `${ESC}OA`, `${CSI}1;2C`, `${CSI}1;3D`, `${CSI}a`, `${ESC}b`, `${ESC}f`,
    `${ESC}${ESC}[A`, `${CSI}5~`, `${CSI}6~`, `${CSI}H`, `${ESC}OH`, `${CSI}1~`, `${CSI}7~`, `${CSI}F`, `${CSI}3~`, `${CSI}Z`,
    `${CSI}<0;10;5M`, `${CSI}<0;10;5m`, ESC, "\r", "\t", " ", "q", "1", "?", String.fromCharCode(3), String.fromCharCode(127),
  ]
  for (const key of legacy) assert.deepEqual(decodeKeyEvent(key), { key, phase: null }, JSON.stringify(key))
})

test("the protocol's forms become the keys the adapters read, with the phase they carry", () => {
  const cases: readonly (readonly [string, string, KeyPhase | null])[] = [
    [`${CSI}1;1:1C`, `${CSI}C`, "press"],
    [`${CSI}1;1:2C`, `${CSI}C`, "repeat"],
    [`${CSI}1;1:3C`, `${CSI}C`, "release"],
    [`${CSI}1;2:2C`, `${CSI}1;2C`, "repeat"], // Shift+Right: still the fast move
    [`${CSI}1;3:3D`, `${CSI}1;3D`, "release"],
    [`${CSI}1;129A`, `${CSI}A`, null], // a press with Num Lock on: still a plain arrow
    [`${CSI}1;129:2A`, `${CSI}A`, "repeat"], // Num Lock is a state, not a modifier
    [`${CSI}1;1:2H`, `${CSI}H`, "repeat"],
    [`${CSI}5;1:3~`, `${CSI}5~`, "release"],
    [`${CSI}27u`, ESC, null],
    [`${CSI}27;1:3u`, ESC, "release"],
    [`${CSI}99;5u`, String.fromCharCode(3), null], // Ctrl+C: the quit
    [`${CSI}98;3u`, `${ESC}b`, null], // Alt+b: Option+Left as a Mac sends it
    [`${CSI}9;2u`, `${CSI}Z`, null],
    [`${CSI}13u`, "\r", null],
    [`${CSI}127u`, String.fromCharCode(127), null],
    [`${CSI}113;1:3u`, "q", "release"],
    [`${CSI}57400u`, "1", null], // the keypad's 1 arms the first building like the row's digit
    [`${CSI}57417;1:2u`, `${CSI}D`, "repeat"],
  ]
  for (const [key, legacy, phase] of cases) assert.deepEqual(decodeKeyEvent(key), { key: legacy, phase }, JSON.stringify(key))
  // Keys with no use here, and the terminal's answers, are nothing at all.
  for (const key of [`${CSI}97;9u`, `${CSI}57441u`, `${CSI}?1u`, `${CSI}?62;22c`]) assert.equal(decodeKeyEvent(key), null, JSON.stringify(key))
})

test("every key a script can name, marked with each phase, decodes back to itself", () => {
  const names = ["Up", "Down", "Left", "Right", "S-Up", "S-Right", "M-Up", "M-Left", "Tab", "S-Tab", "Esc", "Enter", "Space", "Bksp", "Del", "PgUp", "PgDn", "Home", "End", "C-c", "a", "1", "?"]
  for (const name of names) {
    const legacy = keyBytes(name)
    for (const phase of ["press", "repeat", "release"] as const) {
      const marked = encodeKeyEvent(legacy, phase)
      assert.equal(keysFromChunk(marked).length, 1, `${name}/${phase} splits`)
      const decoded = decodeKeyEvent(marked)
      assert.ok(decoded !== null, `${name}/${phase} decodes to nothing`)
      assert.equal(decoded.phase, phase, `${name}/${phase}`)
      // Option+Arrow comes back as xterm's Alt+Arrow, the same fast move.
      const cursor = cursorKeyOf(legacy)
      if (cursor === null) assert.equal(decoded.key, legacy, `${name}/${phase}`)
      else assert.deepEqual(cursorKeyOf(decoded.key), cursor, `${name}/${phase}`)
    }
  }
})

test("a run of the protocol's events in one read splits into one key each", () => {
  const read = `${CSI}C${CSI}1;1:2C${CSI}1;1:2C${CSI}1;1:3C${CSI}27u${CSI}?1u${CSI}?62;22c`
  assert.deepEqual(keysFromChunk(read), [`${CSI}C`, `${CSI}1;1:2C`, `${CSI}1;1:2C`, `${CSI}1;1:3C`, `${CSI}27u`, `${CSI}?1u`, `${CSI}?62;22c`])
  assert.deepEqual(terminalReplyOf(`${CSI}?1u`), { kind: "keyboard-flags", flags: 1 })
  assert.deepEqual(terminalReplyOf(`${CSI}?62;22c`), { kind: "device-attributes" })
  assert.equal(terminalReplyOf(`${CSI}C`), null)
})

test("the conversation: ask, push when the terminal answers, pop on the way out — and only what was pushed", () => {
  const yes = new KeyboardProtocol()
  assert.equal(yes.want(true), KEYBOARD_QUERY)
  assert.equal(yes.want(true), "", "asked twice")
  assert.equal(yes.hear({ kind: "keyboard-flags", flags: 0 }), KEYBOARD_PUSH)
  assert.equal(yes.hear({ kind: "device-attributes" }), "")
  assert.equal(yes.active, true)
  assert.equal(yes.answered, "yes")
  // Switched off in Settings: popped at once; back on: pushed again, without asking again.
  assert.equal(yes.want(false), KEYBOARD_POP)
  assert.equal(yes.active, false)
  assert.equal(yes.want(true), KEYBOARD_PUSH)
  // The way out pops once; a second way out finds nothing to pop.
  assert.equal(yes.release(), KEYBOARD_POP)
  assert.equal(yes.release(), "")

  // Device Attributes with no flags before them: no protocol, nothing pushed, nothing to pop.
  const no = new KeyboardProtocol()
  no.want(true)
  assert.equal(no.hear({ kind: "device-attributes" }), "")
  assert.equal(no.answered, "no")
  assert.equal(no.active, false)
  assert.equal(no.want(true), "")
  assert.equal(no.release(), "")

  // Off from the start: nothing is asked, and nothing popped.
  const off = new KeyboardProtocol()
  assert.equal(off.want(false), "")
  assert.equal(off.release(), "")
  // An answer that arrives after the player switched it off pushes nothing.
  const late = new KeyboardProtocol()
  late.want(true)
  late.want(false)
  assert.equal(late.hear({ kind: "keyboard-flags", flags: 0 }), "")
  assert.equal(late.active, false)
})
