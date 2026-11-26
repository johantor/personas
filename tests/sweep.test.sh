#!/usr/bin/env bash
# personas-sweep against an old and a new version of fixtures/migration-site.cjs: each planted
# change shows in the row's differs, an unchanged page shows none, and both URL sources work.
# Needs Node 20+ and Playwright with chromium (AGENTS.md, "Validating changes").
# shellcheck source=tests/lib.sh
# shellcheck disable=SC1090,SC1091
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SWEEP="$REPO_ROOT/plugin/bin/personas-sweep"
WORK="$(new_tmpdir)"

# start_site <old|new>: starts that version in the background; sets site_pid and site_port.
start_site() {
  local tries=0
  node "$REPO_ROOT/tests/fixtures/migration-site.cjs" "$1" > "$WORK/$1.port" &
  site_pid=$!
  until [ -s "$WORK/$1.port" ]; do
    tries=$((tries + 1)); [ "$tries" -le 100 ] || die "the $1 site did not start"; sleep 0.1
  done
  read -r site_port < "$WORK/$1.port"
}
start_site old; old_pid=$site_pid; OLD_PORT=$site_port
start_site new; new_pid=$site_pid; NEW_PORT=$site_port
# shellcheck disable=SC2329 # called by the EXIT trap
cleanup() { kill "$old_pid" "$new_pid" 2>/dev/null; rm -rf "$FIXTURE_ROOT"; }
trap cleanup EXIT
OLD_URL="http://localhost:$OLD_PORT"
NEW_URL="http://localhost:$NEW_PORT"

# The sitemap default: <old>/sitemap.xml.
status=0
out="$("$SWEEP" --old "$OLD_URL" --new "$NEW_URL" --out "$WORK/a" 2>&1)" || status=$?
if [ "$status" -eq 0 ] && [[ "$out" == *"4 URLs swept, 3 differ"* ]]; then _pass; else _fail "the sitemap sweep (exit $status): $out"; fi
J="$WORK/a/sweep.json"

# row <path> <jq filter>: true when the row for <path> passes the filter.
row() { jq -e --arg p "$1" ".rows[] | select(.path == \$p) | $2" "$J" >/dev/null; }
assert_row() { if row "$2" "$3"; then _pass; else _fail "$1: $(jq -c --arg p "$2" '.rows[] | select(.path == $p) | .differs' "$J")"; fi; }

assert_row "an unchanged page differs in nothing" /same '.differs == []'
if [ "$(jq '.rows | length' "$WORK/a/sweep-changes.json")" = 3 ] && jq -e '.rows | all(.differs != [])' "$WORK/a/sweep-changes.json" >/dev/null; then _pass; else _fail "sweep-changes.json must hold the 3 rows that differ"; fi
assert_row "a changed title" /visit '.differs | index("title") and index("h1") and index("canonical")'
assert_row "a page that is gone" /gone '.differs | index("status")'
assert_row "the new 404 status" /gone '.new.status == 404 and .old.status == 200'
assert_row "a new redirect" /moved '.differs | index("redirect")'
assert_row "the redirect chain" /moved '.new.redirects | length == 1'
assert_row "a changed page has a pixel diff" /visit '.pixelDiff > 0'
assert_row "an unchanged page has none" /same '.pixelDiff == 0'
if jq -e '[.rows[] | .old.screenshot, .new.screenshot] | all(startswith("sweep/"))' "$J" >/dev/null \
  && [ -s "$WORK/a/$(jq -r '.rows[0].new.screenshot' "$J")" ]; then _pass; else _fail "screenshots must be saved under sweep/, relative to the run"; fi

# A URL file: paths and full URLs, comments skipped; the home page gains a console error.
printf '# pages\n/\n%s/same\n' "$OLD_URL" > "$WORK/urls.txt"
status=0
out="$("$SWEEP" --old "$OLD_URL" --new "$NEW_URL" --urls "$WORK/urls.txt" --out "$WORK/b" 2>&1)" || status=$?
if [ "$status" -eq 0 ] && [[ "$out" == *"2 URLs swept, 1 differ"* ]]; then _pass; else _fail "the URL-file sweep (exit $status): $out"; fi
J="$WORK/b/sweep.json"
assert_row "a new console error" / '.differs | index("consoleErrors")'

# Input errors.
status=0
out="$("$SWEEP" --old "$OLD_URL" --out "$WORK/c" 2>&1)" || status=$?
if [ "$status" -ne 0 ] && [[ "$out" == *usage* ]]; then _pass; else _fail "a missing --new must fail with the usage: $out"; fi
status=0
out="$("$SWEEP" --old "$OLD_URL" --new "$NEW_URL" --sitemap "$OLD_URL/nothing.xml" --out "$WORK/d" 2>&1)" || status=$?
if [ "$status" -ne 0 ] && [[ "$out" == *"HTTP 404"* ]]; then _pass; else _fail "a missing sitemap must fail: $out"; fi

finish
