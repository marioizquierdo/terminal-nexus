#!/usr/bin/env bash

# Repository validation for Terminal Nexus.
#
# This script checks invariants rather than literals, so ordinary documentation work never breaks it:
# the current milestone and its step are *derived* from the documents, not hardcoded here.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

failures=0

fail() {
  echo "FAIL: $*" >&2
  failures=$((failures + 1))
}

# Markdown files, excluding VCS and dependency directories, and the throwaway checkouts a background
# agent works in (`.claude/worktrees/`, ignored by git): a copy of the repository is not the repository.
markdown_files() {
  find . -type f -name '*.md' \
    -not -path './.git/*' \
    -not -path './node_modules/*' \
    -not -path './.claude/worktrees/*' \
    -print | sort
}

# ---------------------------------------------------------------------------
# 1. Required files
# ---------------------------------------------------------------------------

required_files=(
  "README.md"
  "DEVELOPMENT.md"
  "AGENTS.md"
  "CLAUDE.md"
  "CONTRIBUTING.md"
  "LICENSE"
  "LICENSE-CREATIVE"
  "NOTICE"
  "docs/README.md"
  "docs/milestones/README.md"
  "docs/milestones/open-questions.md"
  "docs/history/answered-questions.md"
  ".devcontainer/devcontainer.json"
  ".github/workflows/ci.yml"
)

for required_file in "${required_files[@]}"; do
  [[ -f "$required_file" ]] || fail "missing required file: $required_file"
done

# ---------------------------------------------------------------------------
# 2. Milestone status: exactly one CURRENT, agreeing with docs/milestones/README.md
# ---------------------------------------------------------------------------
#
# A milestone directly in docs/milestones/ is CURRENT (exactly one) or still ahead of us (PLANNED,
# or paused as REVISE / BLOCKED / STOPPED). A finished one lives in docs/history/milestones/ and
# says COMPLETE, so "what are we doing now" is always one file.

current_milestones=()
while IFS= read -r doc; do
  status="$(sed -n 's/^\*\*Status:\*\* \(.*\)$/\1/p' "$doc" | head -1)"
  case "$status" in
    CURRENT) current_milestones+=("$doc") ;;
    PLANNED | REVISE | BLOCKED | STOPPED) ;;
    *) fail "$doc declares status '$status'; expected one of CURRENT, PLANNED, REVISE, BLOCKED, STOPPED" ;;
  esac
done < <(find docs/milestones -maxdepth 1 -type f -name 'milestone-*.md' -print | sort)

while IFS= read -r doc; do
  status="$(sed -n 's/^\*\*Status:\*\* \(.*\)$/\1/p' "$doc" | head -1)"
  [[ "$status" == "COMPLETE" ]] || fail "$doc is in docs/history/milestones/ but declares status '$status'; expected COMPLETE"
done < <(find docs/history/milestones -maxdepth 1 -type f -name 'milestone-*.md' -print 2>/dev/null | sort)

current_step=""
current_basename=""
if (( ${#current_milestones[@]} != 1 )); then
  fail "expected exactly one milestone marked CURRENT; found ${#current_milestones[@]}: ${current_milestones[*]:-none}"
else
  current_milestone="${current_milestones[0]}"
  current_basename="$(basename "$current_milestone")"

  if ! grep -Eq "^\*\*Current step:\*\* " "$current_milestone"; then
    fail "$current_milestone is CURRENT but does not declare a current step"
  fi

  current_step="$(sed -n 's/^\*\*Current step:\*\* \(.*\)$/\1/p' "$current_milestone" | head -1)"

  if ! grep -Eq "^\|[^|]*${current_basename}[^|]*\| CURRENT \|" docs/milestones/README.md; then
    fail "docs/milestones/README.md does not mark $current_basename as CURRENT"
  fi

  readme_current_rows="$(grep -cE '^\|[^|]*\| CURRENT \|' docs/milestones/README.md || true)"
  if [[ "$readme_current_rows" != "1" ]]; then
    fail "docs/milestones/README.md has ${readme_current_rows} CURRENT rows; exactly one is allowed"
  fi
fi

# ---------------------------------------------------------------------------
# 3. Question references resolve
# ---------------------------------------------------------------------------
#
# A question is either open (a heading in open-questions.md) or answered (a table row in
# history/answered-questions.md). Any Q<n> cited anywhere under docs/ must be one of the two.

defined_questions="$(sed -n 's/^### \(Q[0-9]\+\) .*$/\1/p' docs/milestones/open-questions.md | sort -u)"
answered_questions=""
if [[ -f docs/history/answered-questions.md ]]; then
  answered_questions="$(sed -n 's/^| *\(Q[0-9]\+\) *|.*$/\1/p' docs/history/answered-questions.md | sort -u)"
fi

referenced_questions="$(grep -rhoE '\bQ[0-9]+\b' docs --include='*.md' 2>/dev/null | sort -u || true)"

while IFS= read -r question; do
  [[ -z "$question" ]] && continue
  if ! grep -Fxq "$question" <<< "$defined_questions" && ! grep -Fxq "$question" <<< "$answered_questions"; then
    fail "$question is referenced but defined in neither docs/milestones/open-questions.md nor docs/history/answered-questions.md"
  fi
done <<< "$referenced_questions"

# Every OPEN question must carry a recommendation; a question without one is unfinished.
while IFS= read -r question; do
  [[ -z "$question" ]] && continue
  block="$(awk -v q="### $question " '
    index($0, q) == 1 { capture = 1; next }
    /^### / { capture = 0 }
    capture { print }
  ' docs/milestones/open-questions.md)"
  if grep -q '^\*\*Status:\*\* OPEN' <<< "$block" && ! grep -q '\*\*Recommendation' <<< "$block"; then
    fail "$question is OPEN but offers no recommendation"
  fi
done <<< "$defined_questions"

# ---------------------------------------------------------------------------
# 4. Authority markers
# ---------------------------------------------------------------------------
#
# Only RULE, GUIDANCE and IDEA exist. Retired markers linger in prose after a simplification, so
# catch them. docs/history/ is a record and is left as it was written.

retired_markers="$(grep -RIn --include='*.md' --exclude-dir='history' -E '\*\*(LAW|UNPROVEN)\*\*|— (LAW|UNPROVEN)\b|Authority: (LAW|UNPROVEN)' \
  docs 2>/dev/null | grep -v 'stale-ok' || true)"
if [[ -n "$retired_markers" ]]; then
  fail "retired authority markers (only RULE, GUIDANCE and IDEA exist):"
  printf '%s\n' "$retired_markers" >&2
fi

# ---------------------------------------------------------------------------
# 5. Agent entry point
# ---------------------------------------------------------------------------

grep -Fq '@AGENTS.md' CLAUDE.md || fail "CLAUDE.md must import AGENTS.md"

# ---------------------------------------------------------------------------
# 6. Retired terminology and old paths
# ---------------------------------------------------------------------------
#
# A line may quote retired terminology deliberately. Mark such a line with the comment
# <!-- stale-ok --> and it is exempt. Everything under docs/history/ (including the verbatim
# original specification) is a record of the past and is skipped
# wholesale, as is this script, which has to spell the words out. Completed milestones
# (docs/history/milestones/) are records too and keep the words they were written with.

retired_terms=(
  '\bveils?\b'
  '\bplanning phase\b'
  '\bbattlefields?\b'
  'terminal-nexus-spec\.md'
  'terminal-nexus-spike1\.md'
  '\bcanon\b'
  'canon version'
  '\bgates? [0-9]'
  'gate-[0-9]'
  'active gate'
  'gate report'
  '(^|[^/A-Za-z0-9_.-])specs/'
  '(^|[^/A-Za-z0-9_.-])evidence/'
  # Documents that were renamed or dissolved: a citation of one is a dead pointer.
  '(^|[^-])engine\.md'
  'ascii-effects\.md'
  'terminal-nexus-lore\.md'
  'terminal-nexus-concept\.md'
  'backlog-pulse-completion'
  'project-governance\.md'
  'milestones/completed/'
)

# Scan for one pattern; extra arguments go to grep (e.g. -i). Prints the surviving hits.
scan_term() {
  local term="$1"
  shift
  grep -RInE "$@" "$term" --include='*.md' --include='*.sh' --include='*.ts' --include='*.mjs' \
    --exclude-dir='.git' --exclude-dir='node_modules' --exclude-dir='worktrees' --exclude-dir='history' \
    --exclude-dir='.playtest' --exclude-dir='dist' . 2>/dev/null \
    | grep -v 'stale-ok' \
    | grep -v '^\./scripts/check-repository\.sh:' || true
}

for term in "${retired_terms[@]}"; do
  hits="$(scan_term "$term" -i)"
  if [[ -n "$hits" ]]; then
    fail "retired terminology matching '$term': $(wc -l <<< "$hits") line(s)"
    printf '%s\n' "$hits" >&2
  fi
done

# GATED is matched case-sensitively: the lower-case word is ordinary English.
hits="$(scan_term '\bGATED\b')"
if [[ -n "$hits" ]]; then
  fail "retired terminology matching 'GATED': $(wc -l <<< "$hits") line(s)"
  printf '%s\n' "$hits" >&2
fi

# ---------------------------------------------------------------------------
# 7. Structural checks
# ---------------------------------------------------------------------------

node -e "JSON.parse(require('node:fs').readFileSync('.devcontainer/devcontainer.json', 'utf8'))" \
  || fail ".devcontainer/devcontainer.json is not valid JSON"

node scripts/check-markdown-links.mjs || fail "broken local Markdown links"

# A RULE names the tests that hold it: every test file a current document cites must exist, or the rule's
# holder is a dead pointer (five once named files that had been renamed for months).
while IFS= read -r cited; do
  [[ -f "$cited" ]] || fail "a document cites $cited, which does not exist"
done < <(grep -RhoE 'tests/[A-Za-z0-9._/-]+\.test\.ts' --include='*.md' --exclude-dir='history' \
  docs AGENTS.md DEVELOPMENT.md README.md CLAUDE.md 2>/dev/null | sort -u)

while IFS= read -r markdown_file; do
  fence_count="$(grep -c '^```' "$markdown_file" || true)"
  if (( fence_count % 2 != 0 )); then
    fail "unbalanced fenced code block: $markdown_file"
  fi
done < <(markdown_files)

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git diff --check || fail "whitespace errors in the working tree"
  git diff --cached --check || fail "whitespace errors in the index"
fi

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------

if (( failures > 0 )); then
  echo >&2
  echo "Repository checks failed with ${failures} problem(s)." >&2
  exit 1
fi

echo "Repository checks passed."
echo
echo "  Current milestone : ${current_basename:-unknown}"
echo "  Current step      : ${current_step:-unknown}"
echo
echo "Read AGENTS.md, then docs/README.md."
