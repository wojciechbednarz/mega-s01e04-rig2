#!/usr/bin/env bash
# Preview host routine on GitHub Pages (skill: preview, ADR 0003).
#   pages.sh put  <owner>/<repo> <file>   one commit with only the page, force-pushed; Pages on
#   pages.sh down <owner>/<repo>          Pages off: the link answers 404
set -euo pipefail
cmd=${1:?put|down}; repo=${2:?owner/repo}
case $cmd in
put)
  file=${3:?file}; dir=$(mktemp -d); trap 'rm -rf "$dir"' EXIT
  cp "$file" "$dir/digest.html"; : > "$dir/.nojekyll"
  git -C "$dir" init -q -b main
  git -C "$dir" add -A
  git -C "$dir" -c user.name=preview -c user.email=preview@localhost commit -q -m "preview"
  git -C "$dir" push -q -f "https://github.com/$repo.git" main
  gh api "repos/$repo/pages" >/dev/null 2>&1 \
    || gh api -X POST "repos/$repo/pages" -f 'source[branch]=main' -f 'source[path]=/' >/dev/null
  owner=${repo%%/*}; echo "https://${owner,,}.github.io/${repo#*/}/digest.html" ;;
down)
  gh api -X DELETE "repos/$repo/pages" && echo "pages off: $repo" ;;
*) echo "usage: pages.sh put|down <owner>/<repo> [file]" >&2; exit 2 ;;
esac
