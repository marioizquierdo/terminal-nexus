#!/usr/bin/env bash

# Run the test suite on a chosen runtime.
#
#   ./scripts/run-tests.sh          # Node (the default)
#   ./scripts/run-tests.sh bun      # Bun
#
# Bun is driven one file at a time on purpose: `bun test` loads every file into one process, and
# its `node:test` shim rejects a `test()` registered while another file's tests are still running.
# Node's own runner isolates each file, so it takes the whole glob at once.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

runtime="${1:-node}"

case "$runtime" in
  node)
    exec node --test tests/*.test.ts
    ;;
  bun)
    failures=0
    for test_file in tests/*.test.ts; do
      echo "--- bun test ${test_file}"
      bun test "$test_file" || failures=$((failures + 1))
    done
    if (( failures > 0 )); then
      echo "bun: ${failures} test file(s) failed" >&2
      exit 1
    fi
    echo "bun: all test files passed"
    ;;
  *)
    echo "usage: ./scripts/run-tests.sh [node|bun]" >&2
    exit 2
    ;;
esac
