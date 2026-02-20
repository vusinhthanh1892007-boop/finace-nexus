#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups"

LATEST="$(ls -1t "$BACKUP_DIR"/finace2-backup-*.tar.gz 2>/dev/null | head -n 1 || true)"
if [[ -z "$LATEST" ]]; then
  echo "No backup found in $BACKUP_DIR"
  exit 1
fi

echo "Restoring from: $LATEST"
cd "$ROOT_DIR"
tar -xzf "$LATEST"
echo "Rollback restore completed."
