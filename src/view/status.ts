// Resolves a status line's tone onto the style attributes the renderer already has — the only place
// `src/status.ts`'s view-agnostic vocabulary meets a `StyleRole`. Reuses two existing roles
// (`chrome.value`, `notice.gate`) rather than adding new palette entries for two tones nobody has a
// concrete look for yet (`ascii-effects.md`'s own preference: extract a framework after two real uses,
// not before one).

import type { StatusTone } from "../status.ts"
import type { StyleRole } from "./roles.ts"

export type StatusStyle = Readonly<{ role: StyleRole; bold?: boolean }>

export function statusStyle(tone: StatusTone = "neutral"): StatusStyle {
  switch (tone) {
    case "success":
      return { role: "chrome.value", bold: true }
    case "warning":
      return { role: "notice.gate" }
    case "danger":
      return { role: "notice.gate", bold: true }
    case "neutral":
    default:
      return { role: "chrome.value" }
  }
}
