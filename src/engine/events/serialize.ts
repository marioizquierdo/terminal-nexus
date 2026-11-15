import { canonicalJson, sha256 } from "../state/canonical.ts"
import type { DomainEvent } from "./types.ts"

/** One canonical JSON object per line — the machine surface `--events` writes. */
export function serializeEvents(events: readonly DomainEvent[]): string {
  return events.map((event) => canonicalJson(event)).join("\n")
}

export function hashEvents(events: readonly DomainEvent[]): string {
  return sha256(serializeEvents(events))
}

export function parseEvents(text: string): DomainEvent[] {
  const events: DomainEvent[] = []
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (trimmed === "") continue
    events.push(JSON.parse(trimmed) as DomainEvent)
  }
  return events
}
