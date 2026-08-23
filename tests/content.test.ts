// Content definitions and the art that draws them — the two halves that have to agree about what
// size a unit is.

import { test } from "node:test"
import assert from "node:assert/strict"
import { CONTENT_ART, DEATH_ART, artExtent, artFor, deathFramesFor } from "../src/content/art.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { footprintCentre, footprintExtent } from "../src/grid/index.ts"
import { entityGlyph } from "../src/view/index.ts"

test("every drawn piece of content is exactly as big as its footprint", () => {
  // The whole reason the art moved into src/content: a unit's shape and its drawing are two
  // declarations of the same fact, in two files, and nothing used to check they matched. A 3x2
  // structure's six glyphs were a flat array in another directory whose *length* nothing asserted.
  for (const contentId of Object.keys(CONTENT_ART)) {
    assert.ok(
      FIXTURE_REGISTRY.has(contentId),
      `the art table draws "${contentId}", which no content definition declares`,
    )
    const art = CONTENT_ART[contentId]
    assert.ok(art !== undefined)
    const drawn = artExtent(art)
    const shape = footprintExtent(FIXTURE_REGISTRY.get(contentId).footprint)
    assert.deepEqual(
      drawn,
      shape,
      `${contentId} is drawn ${drawn.width}x${drawn.height} but its footprint is ` +
        `${shape.width}x${shape.height}`,
    )
    for (const [index, row] of art.entries()) {
      assert.equal(
        row.length,
        drawn.width,
        `${contentId} row ${index + 1} is ${row.length} characters, not ${drawn.width}`,
      )
    }
  }
})

test("every death frame is exactly as big as its content's footprint, in every frame", () => {
  // The same agreement CONTENT_ART's own test enforces, one level deeper: DEATH_ART is optional, but
  // an entry that exists has to agree with the footprint in every frame, not just the first.
  for (const contentId of Object.keys(DEATH_ART)) {
    assert.ok(
      FIXTURE_REGISTRY.has(contentId),
      `DEATH_ART draws "${contentId}", which no content definition declares`,
    )
    const frames = deathFramesFor(contentId)
    assert.ok(frames !== undefined && frames.length > 0, `${contentId}'s DEATH_ART entry is empty`)
    if (frames === undefined) continue
    const shape = footprintExtent(FIXTURE_REGISTRY.get(contentId).footprint)
    frames.forEach((frame, frameIndex) => {
      const drawn = artExtent(frame)
      assert.deepEqual(
        drawn,
        shape,
        `${contentId} death frame ${frameIndex + 1} is ${drawn.width}x${drawn.height} but its ` +
          `footprint is ${shape.width}x${shape.height}`,
      )
      for (const [rowIndex, row] of frame.entries()) {
        assert.equal(
          row.length,
          drawn.width,
          `${contentId} death frame ${frameIndex + 1}, row ${rowIndex + 1} is ${row.length} ` +
            `characters, not ${drawn.width}`,
        )
      }
    })
  }
})

test("a death frame glyph is a space (meaning: fall through) or one printable ASCII cell", () => {
  for (const [contentId, frames] of Object.entries(DEATH_ART)) {
    for (const [frameIndex, frame] of frames.entries()) {
      for (const row of frame) {
        for (const glyph of row) {
          const code = glyph.codePointAt(0) ?? 0
          assert.ok(
            glyph === " " || (code >= 0x21 && code <= 0x7e),
            `${contentId} death frame ${frameIndex + 1} draws ${JSON.stringify(glyph)}, which is ` +
              "neither a space nor a printable ASCII glyph",
          )
        }
      }
    }
  }
})

test("every piece of content is drawn, and every glyph is one printable ASCII cell", () => {
  for (const contentId of FIXTURE_REGISTRY.ids()) {
    const art = artFor(contentId)
    assert.ok(art !== undefined, `${contentId} has no art; add it to src/content/art.ts`)
    if (art === undefined) continue
    for (const row of art) {
      for (const glyph of row) {
        const code = glyph.codePointAt(0) ?? 0
        assert.ok(
          code >= 0x21 && code <= 0x7e,
          `${contentId} draws ${JSON.stringify(glyph)}, which is not a printable ASCII glyph`,
        )
      }
    }
  }
})

test("art is authored lower case, so ownership is free to flip it", () => {
  // Case carries ownership (engine.md 9.6), and it can only do that if the author has not already
  // spent it: a body drawn with a capital in it would read as player B's whoever owns it.
  for (const [contentId, art] of Object.entries(CONTENT_ART)) {
    for (const row of art) {
      assert.equal(row, row.toLowerCase(), `${contentId} is drawn with a capital in it: ${row}`)
    }
  }
  assert.equal(entityGlyph("unit.citizen.trooper", "A", { x: 0, y: 0 }), "t")
  assert.equal(entityGlyph("unit.citizen.trooper", "B", { x: 0, y: 0 }), "T")
})

test("content nobody has drawn still gets a legible glyph", () => {
  // A test may place content the art table has never heard of; it should show up as a letter, not
  // as a hole in the frame.
  assert.equal(entityGlyph("unit.citizen.nonesuch", "A", { x: 0, y: 0 }), "n")
  assert.equal(entityGlyph("unit.citizen.nonesuch", "B", { x: 0, y: 0 }), "N")
})

test("a multi-tile body draws the tile the offset asks for, not the tile it was authored at", () => {
  // Indexed by offset rather than by position in the footprint array, so the drawing does not
  // silently depend on the order rectFootprint happens to emit tiles in.
  const leviathan = "unit.ravel.leviathan"
  assert.deepEqual(footprintExtent(FIXTURE_REGISTRY.get(leviathan).footprint), {
    width: 5,
    height: 2,
  })
  const row = (y: number): string =>
    Array.from({ length: 5 }, (_unused, x) => entityGlyph(leviathan, "B", { x, y })).join("")
  assert.equal(row(0), "/^L^\\")
  assert.equal(row(1), "<*=*>")
})

test("footprintCentre puts an odd extent in the middle and leans an even one north-west", () => {
  const centreOf = (width: number, height: number): { x: number; y: number } => {
    const footprint = []
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) footprint.push({ x, y })
    return footprintCentre(footprint)
  }
  assert.deepEqual(centreOf(1, 1), { x: 0, y: 0 })
  assert.deepEqual(centreOf(3, 1), { x: 1, y: 0 }, "a 3-wide unit centres on its middle column")
  assert.deepEqual(centreOf(3, 3), { x: 1, y: 1 })
  assert.deepEqual(centreOf(5, 2), { x: 2, y: 0 }, "an even height leans north")
  assert.deepEqual(centreOf(2, 2), { x: 0, y: 0 }, "an even extent leans north-west")
})
