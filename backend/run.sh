#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -x .venv/bin/uvicorn ]]; then
  echo "Backend venv missing. From backend/: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

exec .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
