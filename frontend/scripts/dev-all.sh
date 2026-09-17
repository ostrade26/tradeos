#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

BACKEND_URL="http://127.0.0.1:8000"
FRONTEND_URL="http://127.0.0.1:5173"
BACKEND_PID=""

cleanup() {
  if [[ -n "$BACKEND_PID" ]]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}

backend_up() {
  curl -sf "${BACKEND_URL}/api/v1/health" >/dev/null 2>&1
}

frontend_up() {
  curl -sf "${FRONTEND_URL}/" >/dev/null 2>&1
}

port_8000_busy() {
  lsof -nP -iTCP:8000 -sTCP:LISTEN >/dev/null 2>&1
}

if backend_up; then
  echo "✓ Backend already running at ${BACKEND_URL}"
elif port_8000_busy; then
  echo "✗ Port 8000 is in use but /api/v1/health did not respond."
  echo "  Kill the stuck process, then retry:"
  echo "    lsof -nP -iTCP:8000 -sTCP:LISTEN"
  echo "    kill -9 <PID>"
  exit 1
else
  echo "Starting Python API on :8000…"
  npm run dev:backend &
  BACKEND_PID=$!
  trap cleanup EXIT INT TERM

  echo -n "Waiting for backend"
  for _ in $(seq 1 50); do
    if backend_up; then
      echo " ready"
      break
    fi
    echo -n "."
    sleep 0.2
  done

  if ! backend_up; then
    echo ""
    echo "✗ Backend failed to start. Run: npm run dev:backend"
    exit 1
  fi
fi

if frontend_up; then
  echo "✓ Frontend already running at ${FRONTEND_URL}"
  echo ""
  echo "Open ${FRONTEND_URL}"
  echo "Swagger:  ${BACKEND_URL}/docs"
  exit 0
fi

echo "Starting React frontend on :5173…"
echo ""
echo "  App:     ${FRONTEND_URL}"
echo "  API:     ${BACKEND_URL}/api/v1"
echo "  Swagger: ${BACKEND_URL}/docs"
echo ""

npm run dev
