#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WORKSPACE_ROOT"

TOKEN="${GITHUB_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -f "$WORKSPACE_ROOT/.github_token" ]; then
  TOKEN="$(cat "$WORKSPACE_ROOT/.github_token" | tr -d '\r\n[:space:]')"
fi

if [ -z "$TOKEN" ]; then
  echo "Error: GitHub token not found. Please set GITHUB_TOKEN or create .github_token" >&2
  exit 1
fi

REMOTE_URL="https://coltcollect-creator:${TOKEN}@github.com/coltcollect-creator/colt-world-creator.git"

if [ ! -d ".git" ]; then
  git init -b main
  git config user.name "coltcollect-creator"
  git config user.email "coltcollect@gmail.com"
  git remote add origin "$REMOTE_URL"
  git fetch origin main
  git reset origin/main
else
  git config user.name "coltcollect-creator" || true
  git config user.email "coltcollect@gmail.com" || true
  git remote set-url origin "$REMOTE_URL"
  git fetch origin main || true
fi

git add -A
git commit -m "Auto-update COLT Market World: $(date -u +'%Y-%m-%d %H:%M:%S UTC')" || true

git push origin main
echo "Successfully pushed to GitHub repository!"
