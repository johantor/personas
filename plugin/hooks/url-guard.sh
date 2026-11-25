#!/usr/bin/env bash
# PreToolUse on Bash: refuses `persona-browser goto` to a host off the session's allowlist. It is a
# second line behind the CLI's own check (#1, Hooks). The session's daemon writes the allowlist
# beside its socket; with no such file there is no session, and the CLI refuses the goto itself.
set -uo pipefail
shopt -s extglob # for the port pattern below

payload="$(cat)"
[[ "$payload" == *persona-browser*goto* ]] || exit 0
block() { printf 'url-guard: %s\n' "$1" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || block "jq is required to check persona-browser goto"

cmd="$(jq -r '.tool_input.command // ""' <<<"$payload" | tr '\n' ' ')"
[[ "$cmd" =~ persona-browser[[:space:]]+goto([[:space:]]|$) ]] || exit 0
# Only the first call is parsed, so a command holds one.
[[ "$cmd" == *persona-browser*persona-browser* ]] && block "run one persona-browser command at a time"

# opt <name>: the value of --<name> as `--name v`, `--name=v`, or quoted with ' or ".
opt() {
  local re="--$1(=|[[:space:]]+)(\"([^\"]*)\"|'([^']*)'|([^[:space:]\"';&|]+))"
  [[ "$cmd" =~ $re ]] || return 1
  printf '%s' "${BASH_REMATCH[3]}${BASH_REMATCH[4]}${BASH_REMATCH[5]}"
}
if ! session="$(opt session)" || ! url="$(opt url)"; then block "cannot read --session and --url in: $cmd"; fi

hosts="${TMPDIR:-/tmp}"
hosts="${hosts%/}/persona-browser-$(id -u)/$session.hosts"
[ -f "$hosts" ] || exit 0

# The host as a browser reads it: a backslash is a slash, and a special scheme needs no slashes.
u="$(tr 'A-Z\134' 'a-z/' <<<"$url")" # \134 is a backslash, read as a slash
if [[ "$u" =~ ^[a-z][a-z0-9+.-]*: ]]; then
  case "$u" in http:* | https:*) ;; *) exit 0 ;; esac # the CLI refuses other schemes
  u="${u#*:}"
elif [[ "$u" != //* ]]; then
  exit 0 # a relative URL stays on the current, allowed host
fi
u="${u#"${u%%[!/]*}"}"  # leading slashes
u="${u%%[/?#]*}"        # the path
u="${u##*@}"            # userinfo
u="${u%:*([0-9])}"      # the port
host="${u#[}"; host="${host%]}"
[ -n "$host" ] || block "no host in --url $url"

while IFS= read -r entry; do
  [ -n "$entry" ] || continue
  [[ "$host" == "$entry" || "$host" == *".$entry" ]] && exit 0
done <"$hosts"
block "$host is not on the allowlist of session $session ($(paste -sd, "$hosts"))"
