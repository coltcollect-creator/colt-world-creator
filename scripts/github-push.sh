#!/usr/bin/env bash
set -e
git add -A
git commit -m "Auto-update COLT Market World: $(date -u +'%Y-%m-%d %H:%M:%S UTC')" || true
git push origin main
echo "Successfully pushed to GitHub repository!"
