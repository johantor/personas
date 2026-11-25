#!/usr/bin/env bash
# The hooks in plugin/hooks/: url-guard.sh (persona-browser goto against the session's allowlist)
# and visitor-guard.sh (the visitor agent's Bash). Each case pipes a payload into the
# hook and asserts allow (exit 0) or block (exit 2).
# shellcheck source=tests/lib.sh
# shellcheck disable=SC1090,SC1091
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# url-guard reads <TMPDIR>/persona-browser-<uid>/<session>.hosts, as the daemon writes it.
TMPDIR="$(new_tmpdir)"
export TMPDIR
mkdir -p "$TMPDIR/persona-browser-$(id -u)"
printf 'staging.example.se\nlocalhost\n[::1]\n' > "$TMPDIR/persona-browser-$(id -u)/s1.hosts"

bash_call() { # bash_call <command> [agent_type]
  jq -nc --arg c "$1" --arg a "${2:-}" '{tool_name: "Bash", tool_input: {command: $c}} + (if $a == "" then {} else {agent_type: $a} end)'
}
goto() { bash_call "persona-browser goto --session s1 --url $1"; }

# --- url-guard -----------------------------------------------------------------------------------
assert_allow "an allowed host" url-guard.sh "$(goto https://staging.example.se/besok)"
assert_allow "a subdomain of an allowed host" url-guard.sh "$(goto https://cdn.staging.example.se/)"
assert_allow "an allowed host with a port" url-guard.sh "$(goto http://localhost:3000/)"
assert_allow "an allowed IPv6 host" url-guard.sh "$(goto 'http://[::1]:3000/next')"
assert_block "another IPv6 host" url-guard.sh "$(goto 'http://[::2]/')" "[::2] is not on the allowlist"
assert_allow "a relative URL" url-guard.sh "$(goto /besok)"
assert_allow "a quoted relative URL" url-guard.sh "$(goto "'/sök?q=a b'")"
assert_allow "another command" url-guard.sh "$(bash_call 'curl https://evil.example/')"
assert_allow "persona-browser look" url-guard.sh "$(bash_call 'persona-browser look --session s1')"
assert_allow "a session with no hosts file" url-guard.sh \
  "$(bash_call 'persona-browser goto --session s9 --url https://evil.example/')"
assert_block "another host" url-guard.sh "$(goto https://evil.example/)" "evil.example is not on the allowlist"
assert_block "another host, --url=" url-guard.sh \
  "$(bash_call 'persona-browser goto --session s1 --url=https://evil.example/')" "evil.example"
assert_block "another host in double quotes" url-guard.sh "$(goto '"https://evil.example/"')" "evil.example"
assert_block "a host that only ends like an allowed one" url-guard.sh "$(goto https://notstaging.example.se/)" ""
assert_block "a protocol-relative URL" url-guard.sh "$(goto //evil.example/x)" "evil.example"
assert_block "backslashes read as slashes" url-guard.sh "$(goto '/\evil.example/x')" "evil.example"
assert_block "a scheme without slashes" url-guard.sh "$(goto http:evil.example)" "evil.example"
assert_block "userinfo is not the host" url-guard.sh "$(goto https://staging.example.se@evil.example/)" "evil.example"
assert_block "upper case" url-guard.sh "$(goto HTTPS://EVIL.EXAMPLE/)" "evil.example"
assert_block "two calls in one command" url-guard.sh \
  "$(bash_call 'persona-browser goto --session s1 --url / && persona-browser goto --session s1 --url https://evil.example/')" \
  "one persona-browser command"
assert_block "no --url" url-guard.sh "$(bash_call 'persona-browser goto --session s1')" "cannot read"

# --- visitor-guard -------------------------------------------------------------------------------
V=personas:visitor
assert_allow "a visitor runs persona-browser" visitor-guard.sh "$(bash_call 'persona-browser look --session s1' "$V")"
assert_allow "by its plugin path" visitor-guard.sh \
  "$(bash_call '/home/u/.claude/plugins/personas/bin/persona-browser look --session s1' "$V")"
assert_allow "typed text in quotes" visitor-guard.sh \
  "$(bash_call "persona-browser type --session s1 --ref e3 --text 'opening hours' --submit" "$V")"
assert_allow "another agent runs anything" visitor-guard.sh "$(bash_call 'ls; rm -rf x' general-purpose)"
assert_allow "the main session runs anything" visitor-guard.sh "$(bash_call 'ls | wc -l')"
assert_block "a visitor runs another command" visitor-guard.sh "$(bash_call 'curl https://x/' "$V")" "only persona-browser"
assert_block "a visitor chains a command" visitor-guard.sh "$(bash_call 'persona-browser look --session s1; ls' "$V")" "one persona-browser command"
# shellcheck disable=SC2016 # the $( ) is the payload, not ours to expand
assert_block "a visitor substitutes a command" visitor-guard.sh \
  "$(bash_call 'persona-browser type --session s1 --ref e1 --text "$(cat ~/.ssh/id_rsa)"' "$V")" ""
assert_block "a visitor writes a second line" visitor-guard.sh "$(bash_call $'persona-browser look --session s1\nls' "$V")" ""
assert_block "a visitor starts a session" visitor-guard.sh \
  "$(bash_call 'persona-browser start --session s2 --persona p.json --persona-id a --run r --url https://evil.example/' "$V")" \
  "the runner starts and stops the session"
for sub in "'start'" 'st""art' '"start"' __daemon stop "'look'"; do
  assert_block "a visitor runs subcommand $sub" visitor-guard.sh \
    "$(bash_call "persona-browser $sub --session s1 --url https://evil.example/" "$V")" ""
done
assert_block "a fake persona-browser path" visitor-guard.sh "$(bash_call './persona-browser look' "$V")" "only persona-browser"

finish
