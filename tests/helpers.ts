// Shared test scaffolding. Not a test file itself: the runners only pick up `*.test.ts`.

import { dirname, join, resolve as resolvePath } from "node:path"
import { fileURLToPath } from "node:url"
import { playSandboxRound } from "../src/skirmish/sandbox-round.ts"
import type { SandboxRound } from "../src/skirmish/sandbox-round.ts"
import { loadSandbox, sandboxCatalog } from "../src/skirmish/sandboxes.ts"

export { loadSandbox }
import type { BattleOpening } from "../src/skirmish/opening/index.ts"
import type { ReportInput } from "../src/report/index.ts"

export const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Bun's `node:test` shim does not implement `t.skip()`, so a test that only applies to one runtime
 * is registered conditionally rather than skipped. Both branches assert something true.
 */
export const RUNTIME_IS_BUN = (globalThis as { Bun?: unknown }).Bun !== undefined
export const SANDBOX_DIR = join(REPO_ROOT, "sandboxes")

/** Every checked-in map's file name (`melee-kill.save.json`), from every folder under `sandboxes/`, sorted. */
export function sandboxFiles(): string[] {
  return sandboxCatalog(SANDBOX_DIR).map((entry) => `${entry.id}.save.json`)
}

/** A sandbox played (`playSandboxRound`, the one path every door plays one by), with the opening it was read as. */
export type Resolved = SandboxRound & Readonly<{ opening: BattleOpening }>

export async function playSandbox(name: string, overrides: Readonly<{ seed?: number; ticks?: number }> = {}): Promise<Resolved> {
  const opening = await loadSandbox(name)
  return { opening, ...playSandboxRound(opening, overrides) }
}

/** What a played sandbox's report is written from. */
export const reportInputOf = (resolved: Resolved): ReportInput => resolved.report

/** Every sandbox in the repository, resolved once — the regression suite's raw material. */
export async function playAllSandboxes(): Promise<Resolved[]> {
  const resolved: Resolved[] = []
  for (const name of sandboxFiles()) resolved.push(await playSandbox(name))
  return resolved
}

/** The numeric SGR parameters of every `ESC [ ... m` in an ANSI string, in order — what a terminal is told
 *  about colour and weight. */
export function sgrCodes(ansi: string): number[] {
  return [...ansi.matchAll(/\u001b\[([0-9;]*)m/g)].flatMap((match) => (match[1] ?? "").split(";").filter(Boolean).map(Number))
}

/** The SGR parameters that are not part of a colour: bold, faint, underline, reverse video, the default-colour
 *  resets. A 256-colour or truecolor setter's own numbers (`38;5;n`, `48;2;r;g;b`) are skipped over whole, since
 *  a `2` in `38;2;...` is the colour's kind and not the attribute faint. */
export function sgrAttributes(ansi: string): number[] {
  const attributes: number[] = []
  for (const match of ansi.matchAll(/\u001b\[([0-9;]*)m/g)) {
    const params = (match[1] ?? "").split(";").filter(Boolean).map(Number)
    for (let at = 0; at < params.length; at += 1) {
      const code = params[at] ?? 0
      if (code === 38 || code === 48) at += params[at + 1] === 2 ? 4 : 2
      else attributes.push(code)
    }
  }
  return attributes
}

/** Whether an SGR parameter sets a colour (foreground or background, standard or bright) — as opposed to
 *  bold, dim or reversed video, which monochrome keeps. */
export const isColourCode = (code: number): boolean => (code >= 30 && code <= 49) || (code >= 90 && code <= 107)
