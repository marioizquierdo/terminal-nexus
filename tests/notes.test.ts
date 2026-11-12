// Notes from a playtest (src/cli/notes.ts): `!` on every screen saves one typed line with the moment itself — the round
// as its Build Phase opened, every named command pressed since with its time, the screen as text, the settings and the
// last Activity Logs events — and `--note` opens it again at exactly that moment, in the game and the scripted playtest.

import { test } from "node:test"
import assert from "node:assert/strict"
import type { Noter } from "../src/cli/notes.ts"
import { NOTE_FORMAT, noteOpening, readNote } from "../src/cli/notes.ts"
import { noteFileName, terminalNoter } from "../src/cli/note-files.ts"
import { gameOpening } from "../src/playtest/build.ts"
import { runGamePlaytest } from "../src/playtest/game.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { controlsPage } from "../src/build/help.ts"
import { frameToText } from "../src/view/frame.ts"
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { playtestOpening } from "../src/playtest/build.ts"
import { SHIPPED_PROFILES } from "../src/skirmish/shipped-players.ts"

/** A note writer that keeps what it is handed. */
function keeper(): Noter & { notes: string[] } {
  const notes: string[] = []
  return { notes, destination: "Kept by the test.", write: (text) => (notes.push(text), { ok: true, text: "Note kept." }) }
}

test("the note key is ! on every screen, named on the Controls page and the title menu's controls line", () => {
  const anywhere = controlsPage().find((section) => section.heading === "ANYWHERE")
  assert.ok(anywhere?.lines.some((line) => line.keys === "!" && /note/u.test(line.text)))
  const run = runGamePlaytest({ start: { kind: "title", place: "menu" }, steps: [] })
  assert.match(frameToText(run.frames[0]!.frame), /! note/u)
})

test("a note made in a Battle Round opens again at exactly that moment: the same screen, the same plan, the same battle", { timeout: 120_000 }, () => {
  const noter = keeper()
  const opening = playtestOpening({}, "--keys", { load: "saves/crossing-round-4.save.json" })
  const made = runGamePlaytest({ start: opening.at, noter, steps: parseKeyScript("Esc n 1 1 Enter s s wait~1000*5 ! t o o Space f a s t Enter") })
  assert.equal(noter.notes.length, 1)
  const { note, problems } = readNote(noter.notes[0]!, SHIPPED_PROFILES)
  assert.deepEqual(problems, [])
  assert.ok(note !== null)
  assert.equal(note.format, NOTE_FORMAT)
  assert.equal(note.line, "too fast")
  assert.equal(note.at, "skirmish?load=saves/crossing-round-4.save.json")
  assert.equal(note.save?.state?.round, 4, "the save is the round as its Build Phase opened")
  assert.deepEqual(note.pressed.map((entry) => entry.command.kind), ["cancel", "open-nexus-powers", "pick-nexus", "arm", "place", "open-battle-round", "start-pulse"])
  assert.ok(note.activity.some((line) => /pulse\.start/u.test(line)))
  // The screen is the one `!` found: the Battle Round, no note popup over it.
  const pressedAt = made.frames.findIndex((frame) => frame.label === "!")
  assert.match(note.screen, /BATTLE ROUND 4/u)
  assert.doesNotMatch(note.screen, /NOTE/u)
  // Opened again: the very same screen and state.
  const opened = noteOpening(note, { profiles: SHIPPED_PROFILES })
  assert.equal(opened.kind, "level")
  const folder = mkdtempSync(join(tmpdir(), "tn-note-"))
  try {
    const file = join(folder, "a.note.json")
    writeFileSync(file, noter.notes[0]!, "utf8")
    const reopened = gameOpening({}, "--keys", { note: file, profiles: SHIPPED_PROFILES })
    const again = runGamePlaytest({ start: reopened.start, noter, steps: reopened.steps })
    assert.equal(frameToText(again.frames[0]!.frame), note.screen)
    assert.deepEqual(again.frames[0]!.state?.planned, made.frames[pressedAt - 1]!.state?.planned)
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})

test("a note on the title menu keeps its screen's route and text, and opens on that screen", () => {
  const noter = keeper()
  const run = runGamePlaytest({ start: { kind: "title", place: "menu" }, noter, steps: parseKeyScript("1 1 ! w h y Enter") })
  assert.equal(noter.notes.length, 1)
  const { note } = readNote(noter.notes[0]!)
  assert.ok(note !== null)
  assert.equal(note.line, "why")
  assert.equal(note.at, "skirmish?setup=new")
  assert.match(note.screen, /\[s\] Start/u)
  assert.doesNotMatch(note.screen, /> why/u, "the screen is the one ! found, before the note was typed")
  assert.equal(run.frames[run.frames.length - 1]?.title, "new-game")
  const opened = noteOpening(note)
  assert.deepEqual(opened, { kind: "title", at: { kind: "title", place: "new-game" } })
})

test("a note that is not one is refused whole, every problem named", () => {
  assert.deepEqual(readNote("{").problems.length, 1)
  const { note, problems } = readNote(JSON.stringify({ format: "nope", pressed: "x" }))
  assert.equal(note, null)
  assert.equal(problems.length, 5)
})

test("a terminal writes each note as its own file, named by when it was made", () => {
  const folder = mkdtempSync(join(tmpdir(), "tn-notes-"))
  try {
    const when = new Date(2026, 10, 12, 15, 30, 12)
    assert.equal(noteFileName(when), "note-20261112-153012.note.json")
    const noter = terminalNoter(folder, () => when)
    assert.equal(noter.write("{}").ok, true)
    assert.equal(noter.write("{}").ok, true)
    assert.deepEqual(readdirSync(folder).sort(), ["note-20261112-153012-2.note.json", "note-20261112-153012.note.json"])
    assert.equal(readFileSync(join(folder, "note-20261112-153012.note.json"), "utf8"), "{}")
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})
