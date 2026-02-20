#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
VENV_DIR="$BACKEND_DIR/.venv"

cd "$BACKEND_DIR"

if [[ ! -d "$VENV_DIR" ]]; then
  echo "[backend] Creating virtual environment at $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

if ! python -c "import fastapi, uvicorn, redis" >/dev/null 2>&1; then
  echo "[backend] Installing dependencies..."
  python -m pip install --upgrade pip
  python -m pip install -r requirements.txt
fi

echo "[backend] Starting FastAPI at http://127.0.0.1:8000"
exec python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
