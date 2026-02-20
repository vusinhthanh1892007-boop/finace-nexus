#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

rm -rf frontend/node_modules
rm -rf frontend/.next
rm -rf .venv
rm -rf backend/.venv
rm -rf artifacts
rm -f frontend/tsconfig.tsbuildinfo
find . -type d -name "__pycache__" -prune -exec rm -rf {} +
find . -type f -name "*.pyc" -delete

echo "Repository cleaned for GitHub push."
