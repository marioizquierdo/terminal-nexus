// The settings file itself — no menu, no stdin, no terminal involved. A corrupt or missing file must
// never stop the game from starting (milestone-03-game-menu.md, Gate 3B).

import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createSettingsStore, parseSettings } from "../src/settings/store.ts"
import { DEFAULT_SETTINGS } from "../src/settings/types.ts"
import type { Settings } from "../src/settings/types.ts"

function tempSettingsPath(): { path: string; cleanup: () => void } {
  const directory = mkdtempSync(join(tmpdir(), "terminal-nexus-settings-"))
  return { path: join(directory, "settings.json"), cleanup: () => rmSync(directory, { recursive: true, force: true }) }
}

test("a file that was never written loads as null, not a crash or a fixed default", async () => {
  const { path, cleanup } = tempSettingsPath()
  try {
    const store = createSettingsStore(path)
    assert.equal(await store.load(), null)
  } finally {
    cleanup()
  }
})

test("saving then loading round-trips every field exactly — the actual 'survives a relaunch' claim", async () => {
  const { path, cleanup } = tempSettingsPath()
  try {
    const store = createSettingsStore(path)
    const saved: Settings = { capability: "truecolor", theme: "light", glyphPack: "unicode", reducedMotion: true }
    await store.save(saved)

    // A brand new store instance over the same path — nothing in memory is reused — is the honest
    // way to test "survives a relaunch": a relaunch is exactly a fresh load with nothing carried over.
    const reloaded = await createSettingsStore(path).load()
    assert.deepEqual(reloaded, saved)
  } finally {
    cleanup()
  }
})

test("save creates the containing folder when it does not exist yet", async () => {
  const directory = mkdtempSync(join(tmpdir(), "terminal-nexus-settings-"))
  try {
    const nested = join(directory, "does", "not", "exist", "settings.json")
    const store = createSettingsStore(nested)
    await store.save(DEFAULT_SETTINGS)
    const raw = await readFile(nested, "utf8")
    assert.deepEqual(JSON.parse(raw), DEFAULT_SETTINGS)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("a file that is not valid JSON at all loads as null, the same as a missing file", async () => {
  const { path, cleanup } = tempSettingsPath()
  try {
    writeFileSync(path, "{ this is not json")
    const store = createSettingsStore(path)
    assert.equal(await store.load(), null)
  } finally {
    cleanup()
  }
})

test("a JSON array or a bare string is not a settings object, so it loads as null too", async () => {
  const { path, cleanup } = tempSettingsPath()
  try {
    writeFileSync(path, JSON.stringify(["capability", "monochrome"]))
    assert.equal(await createSettingsStore(path).load(), null)
    writeFileSync(path, JSON.stringify("monochrome"))
    assert.equal(await createSettingsStore(path).load(), null)
  } finally {
    cleanup()
  }
})

test("a real but partially wrong file keeps every field it got right", async () => {
  // A saved preference should not be thrown away wholesale over one bad field — see parseSettings's
  // own doc comment for why.
  const parsed = parseSettings({
    capability: "not-a-real-tier",
    theme: "light",
    glyphPack: 42,
    reducedMotion: true,
  })
  assert.deepEqual(parsed, {
    capability: DEFAULT_SETTINGS.capability, // repaired
    theme: "light", // kept
    glyphPack: DEFAULT_SETTINGS.glyphPack, // repaired
    reducedMotion: true, // kept
  })
})

test("a file missing every field entirely still loads as the full set of defaults", () => {
  assert.deepEqual(parseSettings({}), DEFAULT_SETTINGS)
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS)
  assert.deepEqual(parseSettings("nonsense"), DEFAULT_SETTINGS)
})

test("an extra field a newer or older version of the game wrote is ignored, not fatal", () => {
  const parsed = parseSettings({ ...DEFAULT_SETTINGS, someFutureField: "whatever" })
  assert.deepEqual(parsed, DEFAULT_SETTINGS)
})
