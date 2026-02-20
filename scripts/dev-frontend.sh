#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

cd "$FRONTEND_DIR"

if [[ ! -d "node_modules" ]]; then
  echo "[frontend] Installing dependencies..."
  npm install
fi

if [[ -f ".next/dev/lock" ]]; then
  echo "[frontend] Removing stale .next/dev/lock"
  rm -f .next/dev/lock
fi

echo "[frontend] Starting Next.js dev server"
exec npm run dev
