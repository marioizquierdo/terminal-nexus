// A raw-mode key echo, small enough to trust: it puts stdin in raw mode, prints every byte it
// receives as visible escaped text, one line per chunk, and quits on `q`. Nothing else.
//
// It exists because the only honest way to answer "does this terminal deliver Shift+Arrow" is to
// press Shift+Arrow into a real pseudo-terminal and look at what came out the other side. A terminfo
// entry says what a terminal *claims* it sends; this says what actually arrived.
//
//   node scripts/lib/key-echo.mjs
//
// Driven by scripts/probe-modified-keys.mjs, which runs it inside tmux and sends the keys by name.

process.stdin.setRawMode?.(true)
process.stdin.resume()
process.stdin.setEncoding("binary")

/** `ESC [ 1 ; 2 A` rather than a literal escape byte, so the output survives being read back. */
function escaped(chunk) {
  let out = ""
  for (const character of chunk) {
    const code = character.charCodeAt(0)
    if (code === 27) out += "ESC "
    else if (code < 0x20 || code > 0x7e) out += `\\x${code.toString(16).padStart(2, "0")} `
    else out += `${character} `
  }
  return out.trimEnd()
}

process.stdout.write("key-echo ready\r\n")

process.stdin.on("data", (chunk) => {
  if (chunk === "q") {
    process.stdout.write("key-echo done\r\n")
    process.stdin.setRawMode?.(false)
    process.exit(0)
  }
  process.stdout.write(`GOT ${escaped(chunk)}\r\n`)
})
