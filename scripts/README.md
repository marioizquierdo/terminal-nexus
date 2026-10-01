# scripts/

Tools for checking the repository and for seeing a change. Anything they write lands in `.playtest/`
(git ignores it; `--out` picks another folder). `DEVELOPMENT.md` section 3 says when to use which.

**Checks**
- `check-repository.sh` - validates the repository, prints the current milestone and step; `./scripts/check-repository.sh`.
- `check-markdown-links.mjs` - fails on a broken local Markdown link; the validator runs it.
- `run-tests.sh` - the test suite on one runtime; `./scripts/run-tests.sh` (Node) or `./scripts/run-tests.sh bun`.

**Seeing a change**
- `playtest.mjs` - press keys on the Build Phase without a terminal; text, PNGs and a GIF in `.playtest/`; `--keys "Down Space"`.
- `capture-build-phase-screenshots.mjs` - every Build Phase screenshot and GIF, in-process or through tmux; `--only <name>`, `--force`.
- `capture-menu-screenshot.mjs` - the title menu, Settings, About and Campaign screens on a real terminal (tmux); no flags needed.
- `capture-screenshots.mjs` - screenshots of the engine tool `grid` on a real terminal (tmux); `--only <name>`.
- `capture-engagement.mjs` - a run of sub-tick frames around one engagement, on request only; `--scenario <name>`.
- `build-web.mjs` - the browser playtest page, one HTML file; `bun scripts/build-web.mjs [--demos <file>]`.
- `demos/` - the key scripts and settings a pull request's playable page opens on, kept until its question is answered.

**Measuring a terminal** (run them in the terminal you play in)
- `probe-modified-keys.mjs` - what each terminal sends for Shift+Arrow and friends; `node scripts/probe-modified-keys.mjs`.
- `probe-key-release.mjs` - whether the terminal reports key releases (kitty protocol); `node scripts/probe-key-release.mjs`.
- `lib/key-echo.mjs` - prints the bytes of every key pressed; `node scripts/lib/key-echo.mjs`, `q` quits.

**Libraries** (imported, never run)
- `lib/terminal-capture.mjs` - tmux pane to HTML to PNG through headless Chromium, and `chromiumPath()` (below).
- `lib/frame-capture.mjs` - PNGs and GIFs of a frame composed in-process.
- `lib/web-bundle.mjs` - bundles the game's code for the browser page, and fails if a Node-only module is reached.

Chromium for the screenshots: set `CHROMIUM_PATH`, or the newest `chromium-*/chrome-linux/chrome` under
`$PLAYWRIGHT_BROWSERS_PATH` (default `/opt/pw-browsers`) is used.
