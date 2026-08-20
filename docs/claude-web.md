# Claude Code on the web setup

Claude Code on the web works in an isolated remote environment, creates a task branch, and can return work as a pull request. It does not run inside GitHub Codespaces; Codespaces is the parallel browser-based editor and test environment for humans.

## One-time setup after publication

1. Open [Claude Code on the web](https://claude.ai/code).
2. Connect GitHub and install the Claude GitHub App when prompted.
3. Grant the app access to `marioizquierdo/terminal-nexus`.
4. Create or select an environment with **Trusted** network access.
5. Add no secrets for Milestone 1A. Claude Web itself does not require an Anthropic API key for this repository workflow.
6. Leave the environment setup script empty for the first session. Runtime selection belongs to the current gate; do not install an unreviewed floating Bun version.

After Gate 1A pins the toolchain, update the environment setup, `DEVELOPMENT.md`, dev container, and CI together. Keep setup under five minutes and never put credentials in a script or repository.

## First session prompt

```text
Read CLAUDE.md and follow AGENTS.md. Then read:
1. specs/terminal-nexus-concept.md
2. specs/milestone-1-spike-battle.md
3. specs/project-governance.md Sections 2–4
4. specs/engine.md Sections 1, 2, 10, and 11

Restate the Milestone 1A question, smallest artifact, evidence, exclusions,
and stop conditions. Implement only the bounded renderer preflight. Do not
begin the authored battle reel. Run every available verification command and
finish with a PASS, REVISE, STOP, or BLOCKED evidence report for Mario.
```

## Optional GitHub `@claude` automation

Claude Code on the web does not require a repository GitHub Action. If issue and pull-request comments should invoke `@claude`, install Anthropic's Claude GitHub App and add the official Claude Code Action separately. That workflow requires an `ANTHROPIC_API_KEY` repository secret or an explicitly configured Bedrock/Vertex identity. Never commit credentials.
