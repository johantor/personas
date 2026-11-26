#!/usr/bin/env bash
# The plugin's parts that need no browser: personas-check against the two schemas,
# and the frontmatter of the agents, skills and commands (the least-privilege tools in CLAUDE.md,
# Map). Needs Node 20+.
# shellcheck source=tests/lib.sh
# shellcheck disable=SC1090,SC1091
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

PLUGIN="$(cd "$(dirname "${BASH_SOURCE[0]}")/../plugin" && pwd)"
WORK="$(new_tmpdir)"

# check <label> <want: ok|fail> <file> [expected message] [schema, default findings]
check() {
  local out status=0
  out="$("$PLUGIN/bin/personas-check" "${5:-findings}" "$3" 2>&1)" || status=$?
  if [ "$2" = ok ] && [ "$status" -eq 0 ]; then _pass; return; fi
  if [ "$2" = fail ] && [ "$status" -ne 0 ] && [[ "$out" == *"${4:-}"* ]]; then _pass; return; fi
  _fail "$1: expected $2 (exit $status): $out"
}

finding='{"id":"F-001","severity":"major","category":"broken","site":"single","url":"https://x/","persona":"anna","steps":["goto /"],"expected":"a","actual":"b","evidence":["anna/shots/001.png"],"seenBy":["anna","erik"],"confidence":"high"}'
write() { printf '%s\n' "$2" > "$WORK/$1.json"; printf '%s' "$WORK/$1.json"; }

# --- personas-check findings ---------------------------------------------------------------------
check "a valid finding" ok "$(write valid "[$finding]")"
check "no findings" ok "$(write empty '[]')"
check "not an array" fail "$(write object "$finding")" "expected array"
check "a bad severity" fail "$(write sev "[$(jq -c '.severity = "critical"' <<<"$finding")]")" "is not one of"
check "a missing field" fail "$(write missing "[$(jq -c 'del(.evidence)' <<<"$finding")]")" "missing evidence"
check "an unknown field" fail "$(write extra "[$(jq -c '.score = 3' <<<"$finding")]")" "unknown field score"
check "an inherited name as a field" fail "$(write proto "[$(jq -c '.constructor = 3 | .toString = 3' <<<"$finding")]")" "unknown field constructor"
check "a bad id" fail "$(write id "[$(jq -c '.id = "7"' <<<"$finding")]")" "does not match"
check "an empty seenBy" fail "$(write seen "[$(jq -c '.seenBy = []' <<<"$finding")]")" "at least 1"
check "a number for a string" fail "$(write type "[$(jq -c '.url = 3' <<<"$finding")]")" "expected string"
check "not JSON" fail "$(write bad '[{')" "not valid JSON"
check "no such file" fail "$WORK/nothing.json" "not valid JSON"

# --- personas-check personas --------------------------------------------------------------------
# The starter set in /personas:init is what a new project gets, so it must pass as written.
awk '/^```json$/ { on = 1; next } /^```$/ { if (on) exit } on' "$PLUGIN/commands/init.md" > "$WORK/starter.json"
check "the init starter set" ok "$WORK/starter.json" "" personas
persona='{"version":1,"defaults":{"maxSteps":40,"locale":"sv-SE"},"personas":[{"id":"anna","name":"Anna","goal":"Book","viewport":{"width":390,"height":844}}]}'
p() { write "$1" "$(jq -c "$2" <<<"$persona")"; }
check "a minimal personas file" ok "$(p min .)" "" personas
check "BCP 47 locales" ok "$(p loc '.defaults.locale = "es-419" | .personas[0].locale = "zh-Hant-TW"')" "" personas
check "a missing goal" fail "$(p goal 'del(.personas[0].goal)')" "missing goal" personas
check "an unknown browser" fail "$(p br '.personas[0].browser = "edge"')" "is not one of" personas
check "an unknown persona field" fail "$(p zoom '.personas[0].zoom = 2')" "unknown field zoom" personas
check "a zero viewport width" fail "$(p vw '.personas[0].viewport.width = 0')" "below 1" personas
check "maxSteps as text" fail "$(p ms '.defaults.maxSteps = "40"')" "expected integer" personas
check "an id in defaults" fail "$(p did '.defaults.id = "x"')" "unknown field id" personas
check "a run folder that climbs out" fail "$(p dot '.personas[0].id = ".."')" "does not match" personas
check "no personas" fail "$(p none '.personas = []')" "at least 1" personas
check "an unknown schema name" fail "$WORK/min.json" "usage" other

# --- frontmatter ---------------------------------------------------------------------------------
# field <file> <name>: a frontmatter value, from the block between the first two --- lines.
field() { awk -v k="$2" 'NR == 1 && $0 == "---" { on = 1; next } on && $0 == "---" { exit } on && index($0, k ": ") == 1 { print substr($0, length(k) + 3) }' "$1"; }

if [ "$(field "$PLUGIN/agents/visitor.md" tools)" = "Bash, Read, Skill" ]; then _pass; else _fail "the visitor's tools must be Bash, Read, Skill"; fi
if [ "$(field "$PLUGIN/agents/reporter.md" tools)" = "Read, Skill" ]; then _pass; else _fail "the reporter's tools must be Read, Skill"; fi
for f in "$PLUGIN"/agents/*.md "$PLUGIN"/commands/*.md "$PLUGIN"/skills/*/SKILL.md; do
  if [ -n "$(field "$f" description)" ]; then _pass; else _fail "$f has no description"; fi
done
# Every skill an agent preloads exists.
for agent in "$PLUGIN"/agents/*.md; do
  while read -r skill; do
    if [ -f "$PLUGIN/skills/$skill/SKILL.md" ]; then _pass; else _fail "$agent preloads a missing skill: $skill"; fi
  done < <(awk 'NR == 1 { next } $0 == "---" { exit } /^skills:/ { on = 1; next } on && /^  - / { print $2 } on && !/^  - / { on = 0 }' "$agent")
done

finish
