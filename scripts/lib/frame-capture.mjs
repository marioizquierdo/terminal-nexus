// Pictures of a cell frame composed in-process — no terminal, no tmux, no capture race.
//
// `terminal-capture.mjs` photographs a real terminal: it has to wait for the app to draw, and can
// land a beat early. A frame composed by the engine's own composer (`composeBuildFrame`, and later
// any other screen's) is complete by construction, so a picture of it is always of the state the
// script reached. The pixels still come from the same place: the frame goes through `frameToAnsi`
// (the ANSI backend's own encoder), the same `ansiToHtml`, and the same headless Chromium.
//
// A GIF of a sequence is assembled here too, from those same PNGs:
//
//   pngjs   decodes Chromium's PNGs to pixels (MIT, no dependencies)
//   gifenc  quantises to one shared 255-colour palette and encodes the GIF (MIT, no dependencies)
//
// Every frame after the first marks the pixels that did not change as transparent, so a GIF of a few
// key presses costs little more than its first frame. Chromium's own ffmpeg build here cannot help:
// it decodes only MJPEG and encodes only VP8 WebM, and a WebM does not play inline in a pull request.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import gifenc from "gifenc"
import pngjs from "pngjs"

// Both packages are CommonJS, so their exports come through the default import.
const { GIFEncoder, applyPalette, quantize } = gifenc
import { frameToAnsi } from "../../src/view/frame.ts"
import {
  FORCE_RENDER,
  ansiToHtml,
  isUnchanged,
  renderPngIfChanged,
  sourceHash,
  stampGif,
} from "./terminal-capture.mjs"

/** A cell frame as the HTML `renderPng` expects — through the real ANSI encoder, so colour, dim and
 *  inverse come out exactly as the terminal backend would send them. */
export function frameHtml(frame, capability = "truecolor", theme = "dark") {
  const ansi = frameToAnsi(frame, capability, theme).replace(/\r\n/gu, "\n")
  return ansiToHtml(ansi, frame.width, frame.height)
}

/** One frame to a PNG. Returns `{ path, written }`; an unchanged image is left alone. */
export function renderFramePng({ frame, capability = "truecolor", theme = "dark", caption, targetPath, scratchDir, scale = 2 }) {
  return renderPngIfChanged({
    html: frameHtml(frame, capability, theme),
    caption,
    cols: frame.width,
    rows: frame.height,
    scratchDir,
    targetPath,
    background: theme,
    scale,
  })
}

/**
 * Several frames to one looping GIF. `shots` is `[{ frame, caption, delayMs }]`. The frames are
 * rendered at `scale`: 2 reads sharply on a phone, 1 is about a third of the size.
 */
export function renderFramesGif({ shots, capability = "truecolor", theme = "dark", targetPath, scratchDir, scale = 2 }) {
  const pages = shots.map((shot) => frameHtml(shot.frame, capability, theme))
  const hash = sourceHash(
    scale,
    theme,
    ...shots.flatMap((shot, index) => [pages[index], shot.caption, shot.delayMs]),
  )
  if (!FORCE_RENDER && isUnchanged(targetPath, hash)) return { path: targetPath, written: false, bytes: 0 }

  mkdirSync(scratchDir, { recursive: true })
  const images = shots.map((shot, index) => {
    const pngPath = join(scratchDir, `gif-${index}.png`)
    renderPngIfChanged({
      html: pages[index],
      caption: shot.caption,
      cols: shot.frame.width,
      rows: shot.frame.height,
      scratchDir,
      targetPath: pngPath,
      background: theme,
      scale,
    })
    return pngjs.PNG.sync.read(readFileSync(pngPath))
  })

  const { width, height } = images[0]
  for (const image of images) {
    if (image.width !== width || image.height !== height) throw new Error("GIF frames differ in size")
  }

  // One palette for every frame, from a sample of all of them, so a colour cannot shift between
  // frames. Index 255 is kept back for "unchanged since the previous frame".
  const sample = new Uint8Array(images.reduce((total, image) => total + image.data.length, 0))
  let offset = 0
  for (const image of images) {
    sample.set(image.data, offset)
    offset += image.data.length
  }
  const palette = quantize(sample, 255, { format: "rgb565" })
  const TRANSPARENT = palette.length
  const fullPalette = [...palette, [0, 0, 0]]

  const gif = GIFEncoder()
  let previous = null
  images.forEach((image, index) => {
    const indexed = applyPalette(image.data, palette, "rgb565")
    const drawn = indexed.slice()
    if (previous !== null) {
      for (let pixel = 0; pixel < indexed.length; pixel += 1) {
        if (indexed[pixel] === previous[pixel]) drawn[pixel] = TRANSPARENT
      }
    }
    gif.writeFrame(drawn, width, height, {
      ...(index === 0 ? { palette: fullPalette, repeat: 0 } : {}),
      delay: shots[index].delayMs,
      transparent: previous !== null,
      transparentIndex: TRANSPARENT,
      dispose: 1,
    })
    previous = indexed
  })
  gif.finish()
  const bytes = stampGif(Buffer.from(gif.bytes()), hash)
  writeFileSync(targetPath, bytes)
  return { path: targetPath, written: true, bytes: bytes.length }
}
