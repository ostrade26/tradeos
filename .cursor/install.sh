#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for Tradeal (FastAPI backend + React/Vite frontend).
set -euo pipefail
cd "$(dirname "$0")/.."

# Python 3.12 venv support is required to create the backend virtualenv. The
# snapshot usually already has it; install only when the module is missing.
if ! python3 -c "import ensurepip" >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq python3.12-venv
fi

echo "==> Backend: virtualenv + dependencies"
cd backend
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -r requirements.txt
cd ..

echo "==> Frontend: npm ci"
cd frontend
npm ci
cd ..

echo "==> Install complete"
