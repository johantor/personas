#!/usr/bin/env bash
# Drives plugin/bin/persona-browser against the local site in fixtures/site.cjs, as a person would
# from a shell (#3, "Done when"): two sessions in parallel keep separate cookies; off-allowlist
# navigation, analytics hosts and writes are refused; every action lands in steps.jsonl.
# Needs Node 20+ and Playwright with chromium (AGENTS.md, "Validating changes").
# shellcheck source=tests/lib.sh
# shellcheck disable=SC1090,SC1091
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PB="$REPO_ROOT/plugin/bin/persona-browser"
node -e "require('playwright')" 2>/dev/null \
  || (cd "$REPO_ROOT" && node -e "require('playwright')" 2>/dev/null) \
  || die "Playwright is not installed: npm install --no-save playwright && npx playwright install chromium"

WORK="$(new_tmpdir)"
SITE_LOG="$WORK/site.log"
: > "$SITE_LOG"
coproc SITE { exec node "$REPO_ROOT/tests/fixtures/site.cjs" "$SITE_LOG"; }
# shellcheck disable=SC2153 # set by coproc; bash unsets it once the coprocess exits
site_pid="$SITE_PID"
read -r PORT <&"${SITE[0]}" || die "the fixture site did not start"
BASE="http://localhost:$PORT"
SESSIONS=()
# shellcheck disable=SC2329 # called by the EXIT trap
cleanup() {
  local s
  for s in "${SESSIONS[@]}"; do "$PB" stop --session "$s" >/dev/null 2>&1; done
  kill "$site_pid" 2>/dev/null
  rm -rf "$FIXTURE_ROOT"
}
trap cleanup EXIT

mkdir -p "$WORK/.personas"
cat > "$WORK/.personas/personas.json" <<'JSON'
{
  "version": 1,
  "defaults": { "locale": "sv-SE" },
  "personas": [
    { "id": "anna", "browser": "chromium" },
    { "id": "erik", "browser": "chromium", "viewport": { "width": 800, "height": 600 } },
    { "id": "maja", "browser": "chromium", "allowWrites": true },
    { "id": "lax", "browser": "chromium", "allowWrites": "false" },
    { "id": "..", "browser": "chromium" }
  ]
}
JSON
printf '# Brief\n\n## Blocked hosts\n\n- tracker.test\n' > "$WORK/.personas/brief.md"

# pb <args...>: runs the CLI and sets _status and _out (stdout and stderr together).
pb() {
  _status=0
  _out="$("$PB" "$@" 2>&1)" || _status=$?
}

assert_has() {
  local label="$1" needle="$2"
  if [ "$_status" -eq 0 ] && [[ "$_out" == *"$needle"* ]]; then _pass
  else _fail "$label: expected exit 0 and '$needle' (exit $_status): $_out"; fi
}

assert_refused() {
  local label="$1" needle="$2"
  if [[ "$_out" == *"refused"*"$needle"* ]]; then _pass
  else _fail "$label: expected a refusal naming '$needle' (exit $_status): $_out"; fi
}

# ref_of <role "name">: the ref of that element in the last look's output.
ref_of() { grep -o "$1 \\[ref=[a-z0-9]*\\]" <<<"$_out" | grep -o 'ref=[a-z0-9]*' | cut -d= -f2; }

start() {
  SESSIONS+=("$1")
  pb start --session "$1" --persona "$WORK/.personas/personas.json" --persona-id "$2" \
    --run "$WORK/run" --url "$BASE/"
}

# Two sessions started and driven in parallel.
SESSIONS+=(t-anna t-erik)
"$PB" start --session t-anna --persona "$WORK/.personas/personas.json" --persona-id anna \
  --run "$WORK/run" --url "$BASE/" > "$WORK/anna.out" 2>&1 &
anna=$!
"$PB" start --session t-erik --persona "$WORK/.personas/personas.json" --persona-id erik \
  --run "$WORK/run" --url "$BASE/" > "$WORK/erik.out" 2>&1 &
erik=$!
_status=0; wait "$anna" || _status=$?; _out="$(cat "$WORK/anna.out")"
assert_has "start anna" "started session with persona anna"
_status=0; wait "$erik" || _status=$?; _out="$(cat "$WORK/erik.out")"
assert_has "start erik" "started session with persona erik"

"$PB" goto --session t-anna --url /set?v=anna >/dev/null 2>&1 &
anna=$!
"$PB" goto --session t-erik --url /set?v=erik >/dev/null 2>&1 &
erik=$!
wait "$anna" "$erik" # not a bare wait: that would also wait for the fixture site
pb goto --session t-anna --url /
pb look --session t-anna
assert_has "anna sees her cookie" "cookie: who=anna"
pb goto --session t-erik --url /
pb look --session t-erik
assert_has "erik sees his cookie only" "cookie: who=erik"
if [[ "$_out" == *anna* ]]; then _fail "erik's session leaked anna's cookie: $_out"; else _pass; fi
assert_has "look returns a screenshot" "screenshot: $WORK/run/erik/shots/"
if [ -s "$WORK/run/erik/shots/001.png" ]; then _pass; else _fail "look wrote no screenshot"; fi

pb start --session t-anna --persona "$WORK/.personas/personas.json" --persona-id anna --run "$WORK/run" --url "$BASE/"
if [ "$_status" -ne 0 ] && [[ "$_out" == *"already running"* ]]; then _pass; else _fail "a second start of a session must fail: $_out"; fi

# The allowlist: the start host is allowed, 127.0.0.1 is not.
pb goto --session t-anna --url "http://127.0.0.1:$PORT/"
if [ "$_status" -ne 0 ]; then _pass; else _fail "goto off the allowlist must exit non-zero"; fi
assert_refused "goto off the allowlist" "host not on the allowlist"
pb goto --session t-anna --url /away
pb look --session t-anna
ref="$(ref_of 'link "Elsewhere"')"
pb act --session t-anna --ref "$ref" --do click
assert_refused "a click off the allowlist" "host not on the allowlist"
pb goto --session t-anna --url "$BASE/redirect"
assert_refused "a redirect off the allowlist" "redirected off the allowlist"
if [[ "$_out" == *"now at about:blank"* ]]; then _pass; else _fail "a redirect off the allowlist must leave the page: $_out"; fi
pb act --session t-anna --ref e999 --do click
if [[ "$_out" == *"unknown ref e999"* ]]; then _pass; else _fail "a stale ref must say so: $_out"; fi

# Writes: a POST form is refused without allowWrites and sent with it.
pb goto --session t-anna --url /form
pb look --session t-anna
ref="$(ref_of 'textbox "Name"')"
pb type --session t-anna --ref "$ref" --text hello --submit
assert_refused "a POST form without allowWrites" "allowWrites is not set"
pb look --session t-anna
ref="$(ref_of 'button "Ping"')"
pb act --session t-anna --ref "$ref" --do click
sleep 1 # the fetch runs after the click returns
pb look --session t-anna
pb goto --session t-anna --url /search
pb look --session t-anna
ref="$(ref_of 'textbox "Query"')"
pb type --session t-anna --ref "$ref" --text opening --submit
assert_refused "a GET form without allowWrites" "allowWrites is not set"
if grep -q '^GET /found' "$SITE_LOG"; then _fail "a GET form submit must not reach the site"; else _pass; fi
pb goto --session t-anna --url /search
pb look --session t-anna
ref="$(ref_of 'link "New tab"')"
pb act --session t-anna --ref "$ref" --do click
pb look --session t-anna # the new tab is the page from the next command on
assert_has "a link to a new tab on the allowlist" "url: $BASE/"$'\n'

start t-maja maja
assert_has "start maja" "writes: allowed"
pb goto --session t-maja --url /form
pb look --session t-maja
ref="$(ref_of 'textbox "Name"')"
pb type --session t-maja --ref "$ref" --text hello --submit
assert_has "a POST with allowWrites" "now at $BASE/submit"
if [ "$(grep -c '^POST /submit' "$SITE_LOG")" -eq 1 ]; then _pass; else _fail "exactly one POST must reach the site: $(cat "$SITE_LOG")"; fi

pb key --session t-erik --key Tab
assert_has "key" "pressed Tab"
pb act --session t-erik --do scroll --value down
assert_has "scroll the page" "scrolled down"

# Block list: the default analytics host and the brief's extra host.
pb stop --session t-anna
assert_has "stop" "blocked: "
if [[ "$_out" == *www.google-analytics.com* && "$_out" == *tracker.test* ]]; then _pass; else _fail "stop must name the blocked default and brief hosts: $_out"; fi
pb look --session t-anna
if [[ "$_out" == *'no session "t-anna"'* ]]; then _pass; else _fail "a stopped session must be gone: $_out"; fi

# steps.jsonl: one line per action, each with url, action, target and result.
steps="$WORK/run/anna/steps.jsonl"
if jq -e -s 'all(has("url") and has("action") and has("target") and has("result"))' "$steps" >/dev/null; then _pass; else _fail "every steps.jsonl line needs url, action, target, result"; fi
if jq -e -s 'any(.action == "refused" and (.target | startswith("POST")))' "$steps" >/dev/null; then _pass; else _fail "steps.jsonl must log the refused fetch POST"; fi
if jq -e -s 'any(.action == "refused" and (.target | startswith("submit")))' "$steps" >/dev/null; then _pass; else _fail "steps.jsonl must log the refused form submit"; fi
if jq -e -s 'any(.action == "act" and .target == "e999" and (.result | startswith("error")))' "$steps" >/dev/null; then _pass; else _fail "steps.jsonl must log the failed action"; fi

# Input errors fail before a daemon starts.
pb start --session t-x --persona "$WORK/.personas/personas.json" --persona-id nobody --run "$WORK/run" --url "$BASE/"
if [[ "$_status" -ne 0 && "$_out" == *'no persona "nobody"'* ]]; then _pass; else _fail "an unknown persona must fail: $_out"; fi
for id in lax ..; do
  pb start --session t-bad --persona "$WORK/.personas/personas.json" --persona-id "$id" --run "$WORK/run" --url "$BASE/"
  if [[ "$_status" -ne 0 ]]; then _pass; else _fail "persona $id must not start: $_out"; SESSIONS+=(t-bad); "$PB" stop --session t-bad >/dev/null 2>&1; fi
done

# Two starts of the same session id at once: exactly one wins, and stop reaches it.
SESSIONS+=(t-dup)
dups=()
for n in 1 2; do
  "$PB" start --session t-dup --persona "$WORK/.personas/personas.json" --persona-id anna \
    --run "$WORK/dup$n" --url "$BASE/" > "$WORK/dup$n.out" 2>&1 &
  dups+=("$!")
done
wins=0
for pid in "${dups[@]}"; do wait "$pid" && wins=$((wins + 1)); done
if [ "$wins" -eq 1 ]; then _pass; else _fail "exactly one of two same-id starts must win, got $wins: $(cat "$WORK"/dup*.out)"; fi
pb stop --session t-dup
assert_has "stop reaches the winning same-id start" "stopped"
sleep 1
if pgrep -f "__daemon .*t-dup.sock" >/dev/null; then _fail "a same-id daemon was left running"; else _pass; fi

pb look --session '../x'
if [[ "$_status" -ne 0 && "$_out" == *"--session must be"* ]]; then _pass; else _fail "an unsafe session id must fail: $_out"; fi

finish
