// The About screen's words: who designed and developed the game, where its code lives, and how to
// contribute.
//
// Data only: what the screen says, in reading order, in sections. How it looks — styles, where it sits,
// wrapping a paragraph at words to the screen's width — is the composer's (`src/view/menu.ts`), so the
// words can change here without anyone touching a frame.

/**
 * One block of words a title-menu screen shows under its rows: a heading, if any, then its text, one
 * entry per line or paragraph — the composer wraps each at words to fit, and leaves a blank row between
 * sections. `quiet` draws it dimmed: something to quote in a report, not something to read.
 */
export type TextSection = Readonly<{
  heading?: string
  text: readonly string[]
  quiet?: boolean
}>

/** The repository, written out whole: a terminal that recognises links (iTerm2's Cmd+click) opens it. */
export const REPOSITORY_URL = "https://github.com/marioizquierdo/terminal-nexus/"

/** The owner's own sentence, with his typo ("designed to b") mended. */
export const CONTRIBUTIONS_TEXT =
  "Terminal Nexus is an Open Source game designed to be modular, extensible and agent friendly. " +
  "Feel free to submit issues, PRs, fork, or develop your own mods."

/** What the About screen says, whatever build it is. */
export const ABOUT_SECTIONS: readonly TextSection[] = [
  {
    heading: "Terminal Nexus",
    text: [
      "Designed and developed by: Mario Izquierdo",
      REPOSITORY_URL,
      // The community page goes here, as one more line, once there is one (the owner wants
      // the main community page linked from About; where updates are posted is still being decided). Until then the player sees nothing in its place:
      // `Community: <link>`,
    ],
  },
  { heading: "Contributions", text: [CONTRIBUTIONS_TEXT] },
]

/**
 * The About screen's sections for one build: `ABOUT_SECTIONS`, then which build this is — the commit
 * stamp the Build Phase's export and the browser page's header carry — so a playtester can say which
 * build they played. A build that does not know its commit (not run from a checkout) leaves the line
 * out, as a settings export does, rather than printing "unknown".
 */
export function aboutSections(buildId?: string): readonly TextSection[] {
  if (buildId === undefined) return ABOUT_SECTIONS
  return [...ABOUT_SECTIONS, { text: [`Build: ${buildId}`], quiet: true }]
}
