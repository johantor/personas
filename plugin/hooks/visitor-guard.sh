#!/usr/bin/env bash
# PreToolUse on Bash: the visitor agent runs one plain persona-browser command that drives its
# session, and nothing else (CLAUDE.md, Map). A subagent's tools list cannot narrow Bash this far, so the hook does. Other
# agents pass untouched.
set -uo pipefail

payload="$(cat)"
[[ "$payload" == *personas:visitor* ]] || exit 0
block() { printf 'visitor-guard: %s\n' "$1" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || block "jq is required to check the visitor's tool calls"
[ "$(jq -r '.agent_type // ""' <<<"$payload")" = personas:visitor ] || exit 0

cmd="$(jq -r '.tool_input.command // ""' <<<"$payload")"
[[ "$cmd" =~ ^[[:space:]]*([^[:space:]]*/bin/)?persona-browser[[:space:]] ]] \
  || block "the visitor runs only persona-browser"
# A literal subcommand from a fixed list, so a quoted 'start' cannot pass: the runner owns start
# and stop, because start --url sets the allowlist.
[[ "$cmd" =~ ^[[:space:]]*([^[:space:]]*/bin/)?persona-browser[[:space:]]+(look|act|type|key|goto)([[:space:]]|$) ]] \
  || block "the visitor runs look, act, type, key or goto; the runner starts and stops the session"
# No chaining, substitution, redirection or second line: typed text avoids these characters.
[[ "$cmd" == *[\;\&\|\`\$\<\>\(\)\\]* || "$cmd" == *$'\n'* ]] \
  && block "one persona-browser command, without ; & | \` \$ < > ( ) \\ or a newline"
exit 0
