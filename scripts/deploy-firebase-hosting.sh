#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WORKSPACE_ROOT"

echo "Building production bundles..."
npm run build

TOKEN="${FIREBASE_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -f "$WORKSPACE_ROOT/.firebase_token" ]; then
  TOKEN="$(cat "$WORKSPACE_ROOT/.firebase_token" | tr -d '\r\n[:space:]')"
fi

if [ -n "$TOKEN" ]; then
  echo "Deploying to Firebase Hosting with token..."
  firebase deploy --only hosting --project gen-lang-client-0990466400 --token "$TOKEN"
else
  echo "Deploying to Firebase Hosting with default auth..."
  firebase deploy --only hosting --project gen-lang-client-0990466400
fi

echo "Successfully deployed to Firebase Hosting!"
