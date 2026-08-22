# Claude Code on the web setup

Claude Code on the web works in an isolated remote environment, creates a task branch, and can return work as a pull request. It does not run inside GitHub Codespaces; Codespaces is the parallel browser-based editor and test environment for humans.

## One-time setup after publication

1. Open [Claude Code on the web](https://claude.ai/code).
2. Connect GitHub and install the Claude GitHub App when prompted.
3. Grant the app access to `marioizquierdo/terminal-nexus`.
4. Create or select an environment with **Trusted** network access.
5. No secrets are required. Claude Web does not need an Anthropic API key for this repository's own workflow.
6. Leave the environment setup script empty. The toolchain is pinned already (Node 22.18+ or Bun
   1.3+, no build step — see `README.md`'s Local Development section), so there is nothing to
   install ahead of a session; `npm install` inside the session is enough, and only type checking
   and the OpenTUI backend need it.

Keep the environment setup, `DEVELOPMENT.md`, the dev container, and CI updated together whenever a
canonical development command changes (`AGENTS.md` Section 5).

## Starting a session

There is no fixed kickoff prompt to paste anymore — that was a Gate 1A bootstrap for a repository
with no code yet, and the repository now has code, tests, and a working tool. `CLAUDE.md` imports
`AGENTS.md`, which gives a fresh session its own orientation instructions (run
`./scripts/check-repository.sh`, read the specs in order, find the current gate and what it
authorizes) automatically. Just say what you want done; the agent orients itself.

If you want a session to do exactly what an unattended session should do by default — pick up
outstanding owner feedback and nothing else — a short prompt like this is enough:

```text
Read CLAUDE.md and follow AGENTS.md. Orient yourself, tell me what's outstanding, and work on it.
```

## Environment notes

Measured on 2026-08-20: the task container provides **Bun 1.3.11** and **Node 22.22.2**; Deno is not
installed. Milestone 1 dropped its Deno probe partly for this reason — see
`specs/milestone-1-spike-battle.md` Section 3.2. The pinned toolchain versions a session actually
runs against are recorded fresh in each gate's evidence report, not here — re-check rather than
assume this measurement still holds.

## Optional GitHub `@claude` automation

Claude Code on the web does not require a repository GitHub Action. If issue and pull-request comments should invoke `@claude`, install Anthropic's Claude GitHub App and add the official Claude Code Action separately. That workflow requires an `ANTHROPIC_API_KEY` repository secret or an explicitly configured Bedrock/Vertex identity. Never commit credentials.
