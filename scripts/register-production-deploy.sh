#!/usr/bin/env bash
# Register a production deploy as a draft platform release (auto changelog from git) and notify platform admins.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${TRADEAL_API_URL:-${TRADEAL_PRODUCTION_API_URL:-}}"
TOKEN="${TRADEAL_API_TOKEN:-${TRADEOS_API_TOKEN:-}}"
COMMIT_SHA="${RAILWAY_GIT_COMMIT_SHA:-${GITHUB_SHA:-$(git -C "${ROOT}" rev-parse HEAD 2>/dev/null || true)}}"
ENVIRONMENT="${TRADEAL_DEPLOY_ENV:-production}"

if [[ -z "${API_URL}" ]]; then
  echo "Set TRADEAL_API_URL (e.g. https://your-api.up.railway.app)" >&2
  exit 1
fi
if [[ -z "${TOKEN}" ]]; then
  echo "Set TRADEAL_API_TOKEN for the deploy hook" >&2
  exit 1
fi
if [[ -z "${COMMIT_SHA}" ]]; then
  echo "Could not resolve commit SHA (set RAILWAY_GIT_COMMIT_SHA / GITHUB_SHA or run from a git checkout)" >&2
  exit 1
fi

API_URL="${API_URL%/}"
export COMMIT_SHA ENVIRONMENT TRADEAL_API_URL="${API_URL}" TRADEAL_API_TOKEN="${TOKEN}"
export TRADEAL_DEPLOY_CHANGELOG_JSON="${TRADEAL_DEPLOY_CHANGELOG_JSON:-}"
export TRADEAL_DEPLOY_CHANGELOG_FILE="${TRADEAL_DEPLOY_CHANGELOG_FILE:-}"
export TRADEAL_DEPLOY_INCLUDE_CHORES="${TRADEAL_DEPLOY_INCLUDE_CHORES:-}"

payload="$(python3 "${ROOT}/scripts/build_deploy_release_payload.py")"

http_code="$(curl -sS -o /tmp/tradeal-deploy-register.json -w "%{http_code}" \
  -X POST "${API_URL}/api/v1/platform/releases/from-deploy" \
  -H "Content-Type: application/json" \
  -H "x-tradeal-token: ${TOKEN}" \
  -d "${payload}")"

if [[ "${http_code}" != "200" ]]; then
  echo "Deploy register failed (${http_code}):" >&2
  cat /tmp/tradeal-deploy-register.json >&2
  exit 1
fi

cat /tmp/tradeal-deploy-register.json
echo ""
