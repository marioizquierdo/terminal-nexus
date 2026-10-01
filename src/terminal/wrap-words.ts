// Plain-text wrapping for a terminal: lines of at most a given number of glyphs, broken between words.

/** Splits text into lines of at most `limit` glyphs, breaking between words — never inside one, unless
 *  a single word is longer than the whole line. */
export function wrapWords(value: string, limit: number): readonly string[] {
  const lines: string[] = []
  let current = ""
  for (const word of value.split(" ").filter((part) => part !== "")) {
    const grown = current === "" ? word : `${current} ${word}`
    if (grown.length <= limit || current === "") current = grown
    else {
      lines.push(current)
      current = word
    }
  }
  if (current !== "") lines.push(current)
  return lines
}
