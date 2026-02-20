#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups"
mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$BACKUP_DIR/finace2-backup-$STAMP.tar.gz"

cd "$ROOT_DIR"

tar \
  --exclude='./frontend/node_modules' \
  --exclude='./frontend/.next' \
  --exclude='./backend/.venv' \
  --exclude='./.venv' \
  --exclude='./backups' \
  -czf "$ARCHIVE" .

echo "Created rollback backup: $ARCHIVE"
