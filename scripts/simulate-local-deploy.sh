#!/usr/bin/env bash
# Simulate a production deploy draft against the local API (for Releases UX work).
# Prerequisites: backend running on :8000 with TRADEAL_API_TOKEN set (see backend/.env).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${TRADEAL_API_URL:-http://127.0.0.1:8000}"
TOKEN="${TRADEAL_API_TOKEN:-}"

if [[ -z "${TOKEN}" && -f "${ROOT}/backend/.env" ]]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck source=/dev/null
  source "${ROOT}/backend/.env"
  set +a
  TOKEN="${TRADEAL_API_TOKEN:-}"
fi

if [[ -z "${TOKEN}" ]]; then
  echo "Set TRADEAL_API_TOKEN in backend/.env (see backend/.env.example)" >&2
  exit 1
fi

COMMIT_SHA="${COMMIT_SHA:-$(git -C "${ROOT}" rev-parse HEAD 2>/dev/null || echo localdev0000001)}"
# Unique-ish sha so re-runs create a new draft when needed
if [[ "${FORCE_NEW:-}" == "1" ]]; then
  COMMIT_SHA="$(printf '%s' "${COMMIT_SHA}-$(date +%s)" | shasum -a 256 | cut -c1-40)"
fi

export TRADEAL_API_URL="${API_URL}"
export TRADEAL_API_TOKEN="${TOKEN}"
export COMMIT_SHA
export TRADEAL_DEPLOY_ENV="${TRADEAL_DEPLOY_ENV:-local}"
# Sample changelog so the draft looks like a real deploy (skip git range if empty items from chores)
export TRADEAL_DEPLOY_CHANGELOG_JSON='[
  {
    "category": "ui_and_fixes",
    "title": "Inbox seat request details and status badges",
    "detail": "Org and Tradeal admins see seat type, amount, and Approved/Rejected in the inbox side panel."
  },
  {
    "category": "improvement",
    "title": "Publish defaults to all licensed users",
    "detail": "After Publish, organisation admins and users receive release notes with the changelog."
  },
  {
    "category": "feature_enhancement",
    "title": "Sample marketplace feature",
    "detail": "Lands as a draft on Features & Access. Set free/paid, then Publish for orgs.",
    "feature_key": "sample-marketplace-feature"
  }
]'

echo "Registering local deploy draft → ${API_URL}"
echo "commit_sha=${COMMIT_SHA}"
"${ROOT}/scripts/register-production-deploy.sh"
echo ""
echo "Next:"
echo "  1. Open http://localhost:5173 — sign in as platform / change-me"
echo "  2. Platform Admin → Inbox — open 'New feature(s) from deploy' → Features & Access"
echo "  3. Set pricing on the draft offer → Publish (orgs get Features notice)"
echo "  4. Platform Admin → Releases — Publish UI/fix notes only"
echo "  5. Sign in as org admin — Features page + inbox 'New on Features'"
echo "Re-run with FORCE_NEW=1 for another draft: FORCE_NEW=1 ./scripts/simulate-local-deploy.sh"
