#!/usr/bin/env bash
# Vendors pstack from cursor/plugins at a ref into upstream/pstack and records the commit.
set -euo pipefail

REF="${1:-main}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git -C "$WORK" init -q
git -C "$WORK" remote add origin https://github.com/cursor/plugins.git
git -C "$WORK" sparse-checkout set pstack
git -C "$WORK" fetch -q --depth 1 --filter=blob:none origin "$REF"
git -C "$WORK" checkout -q FETCH_HEAD
SHA="$(git -C "$WORK" rev-parse HEAD)"

DEST="$ROOT/upstream/pstack"
rm -rf "$DEST"
mkdir -p "$DEST"
for path in skills agents automations docs README.md LICENSE plugin.json; do
  cp -R "$WORK/pstack/$path" "$DEST/$path"
done
find "$DEST" -name .DS_Store -delete

printf '{\n  "repository": "https://github.com/cursor/plugins",\n  "path": "pstack",\n  "commit": "%s"\n}\n' "$SHA" > "$ROOT/upstream/source.json"
echo "Vendored cursor/plugins@$SHA into upstream/pstack. Now run: node scripts/generate.mjs"
