#!/usr/bin/env bash
set -euo pipefail

BACKEND="http://127.0.0.1:8000"
FRONTEND="http://127.0.0.1:5173"
API="${BACKEND}/api/v1"
FAIL=0

pass() { echo "✓ $1"; }
fail() { echo "✗ $1"; FAIL=1; }

check_code() {
  local label="$1"
  local url="$2"
  local expect="$3"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
  if [[ "$code" == "$expect" ]]; then
    pass "$label ($code)"
  else
    fail "$label — expected HTTP $expect, got $code ($url)"
  fi
}

echo "TradeOS local guardrail check"
echo "============================"

if curl -sf "${API}/health" | grep -q '"ok"'; then
  pass "Backend health ${API}/health"
else
  fail "Backend health — start with: npm run dev:backend"
fi

check_code "Frontend UI" "${FRONTEND}/" "200"
check_code "Vite → API proxy" "${FRONTEND}/api/v1/health" "200"
check_code "Swagger UI" "${BACKEND}/docs" "200"

echo ""
echo "API route smoke test (404 = route missing)"
echo "------------------------------------------"

# Read-only / validation routes — must not 404
for path in \
  "/state" \
  "/orders/missing-id/can-delete" \
  "/brokers/missing-id/can-delete" \
  "/producers/missing-id/can-delete" \
  "/retailers/missing-id/can-delete"
do
  code=$(curl -s -o /dev/null -w "%{http_code}" "${API}${path}" || echo "000")
  if [[ "$code" == "404" && "$path" == "/state" ]]; then
    fail "GET ${path} returned 404"
  elif [[ "$path" == "/state" && "$code" == "200" ]]; then
    pass "GET ${path}"
  elif [[ "$path" != "/state" && "$code" != "404" ]]; then
    pass "GET ${path} ($code)"
  elif [[ "$path" != "/state" ]]; then
    fail "GET ${path} returned 404 — route not registered"
  fi
done

# Mutation routes — POST without body should be 422 (validation), not 404
for path in \
  "/orders" \
  "/lifts" \
  "/brokers" \
  "/producers" \
  "/retailers" \
  "/items" \
  "/spots" \
  "/companies/confirm-link" \
  "/companies/link-high-confidence" \
  "/admin/seed" \
  "/admin/reset"
do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API}${path}" -H "Content-Type: application/json" -d '{}' || echo "000")
  if [[ "$code" == "404" ]]; then
    fail "POST ${path} returned 404 — route not registered"
  else
    pass "POST ${path} ($code)"
  fi
done

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "All guardrails passed."
  echo "Open ${FRONTEND} — UI calls ${API} via Vite proxy."
  exit 0
fi

echo "Some checks failed. Ensure both servers are running: npm run dev:all"
exit 1
