#!/usr/bin/env bash
# Gate: run the preview check before a link is sent. Harness-agnostic: reads the send's
# JSON on stdin ({"tool_input": {"answer": {"preview": url}, "receipts": {"laneMarker": m}}}),
# renders the page fresh, runs check.sh, and exits 2 (block) on FAIL.
# Claude Code calls it from .claude/settings.json (PreToolUse); another harness calls it the same way.
# The marker is never printed.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../../.." && pwd)
night=${PREVIEW_NIGHT:-2026-10-28}

input=$(cat)
read -r url receipt < <(python3 -Ic '
import json,sys
t=json.loads(sys.stdin.read() or "{}").get("tool_input",{})
print((t.get("answer") or {}).get("preview",""), (t.get("receipts") or {}).get("laneMarker",""))' <<<"$input")
[[ -z $url ]] && exit 0   # nothing with a preview link is being sent

# marker the lane renders with (.env, last value wins) decides the mode
env_marker=$(python3 -Ic '
import sys
v=""
try:
    for l in open(sys.argv[1]):
        if l.startswith("LANE_MARKER="): v=l.split("=",1)[1].strip()
except FileNotFoundError: pass
print(v)' "$root/.env")
mode=marker; [[ -z $env_marker ]] && mode=clean

dir=$(mktemp -d); trap 'rm -rf "$dir"' EXIT    # outside the repo: no previews in git
if ! (cd "$root" && node_modules/.bin/tsx --env-file-if-exists=.env "$here/render.ts" "/digest/$night" >"$dir/digest.html"); then
  echo "preview gate: could not render /digest/$night" >&2; exit 2
fi

# check with the receipt's marker (clean mode: it must be gone), fall back to .env
evidence=$(LANE_MARKER=${receipt:-$env_marker} "$here/check.sh" "$url" "$dir/digest.html" "$mode" 2>&1); status=$?
if [[ $status -ne 0 ]]; then
  { echo "preview gate: blocked, the link failed its check"; echo "$evidence"; } >&2
  exit 2
fi
# PASS: let the human see the evidence and confirm the send
python3 -Ic '
import json,sys
print(json.dumps({"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask",
  "permissionDecisionReason":"preview gate PASS. Evidence:\n"+sys.stdin.read()}}))' <<<"$evidence"
