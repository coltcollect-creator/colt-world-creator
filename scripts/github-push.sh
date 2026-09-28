#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

git config user.name "coltcollect-creator" || true
git config user.email "coltcollect@gmail.com" || true

TOKEN="${GITHUB_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -f "$ROOT_DIR/.github_token" ]; then
  TOKEN="$(cat "$ROOT_DIR/.github_token" | tr -d '\r\n[:space:]')"
fi

if [ -z "$TOKEN" ]; then
  echo "Error: GitHub token not found. Please set GITHUB_TOKEN or create .github_token" >&2
  exit 1
fi

REMOTE_URL="https://coltcollect-creator:${TOKEN}@github.com/coltcollect-creator/colt-world-creator.git"

if git remote | grep -q origin; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

git add -A
git commit -m "Auto-update COLT Market World: $(date -u +'%Y-%m-%d %H:%M:%S UTC')" || true

git push origin main
echo "Successfully pushed to GitHub repository!"
