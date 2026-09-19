#!/usr/bin/env python3
"""Build JSON body for POST /api/v1/platform/releases/from-deploy from git history."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from typing import Any

MAX_ITEMS = 40
SKIP_PREFIXES = ("chore(", "chore:", "docs(", "docs:", "ci(", "ci:", "test(", "test:")
MERGE_RE = re.compile(r"^merge(\s|$)", re.I)
# Explicit marketplace feature tags — plain `feat:` stays an inform/system update.
FEATURE_TAG_RE = re.compile(
    r"\[(?:feature|marketplace|enhancement)(?::([a-z0-9][a-z0-9-]{0,78}))?\]",
    re.I,
)


def infer_category(subject: str) -> str:
    text = (subject or "").strip()
    lower = text.lower()
    if not text:
        return "ui_and_fixes"
    if lower.startswith("fix") or lower.startswith("bugfix") or lower.startswith("ui:") or lower.startswith("style"):
        return "ui_and_fixes"
    if FEATURE_TAG_RE.search(text):
        return "feature_enhancement"
    if lower.startswith("chore") or lower.startswith("docs") or lower.startswith("ci") or lower.startswith("test"):
        return "ui_and_fixes"
    # Conventional `feat:` without [feature] is treated as a shipped improvement (Releases),
    # not a paid/gated marketplace feature.
    if lower.startswith("feat"):
        return "improvement"
    return "ui_and_fixes"


def extract_feature_key(subject: str) -> str:
    m = FEATURE_TAG_RE.search(subject or "")
    if m and m.group(1):
        return m.group(1).lower()
    return ""


def should_skip_subject(subject: str, *, include_chores: bool) -> bool:
    s = (subject or "").strip()
    if not s or MERGE_RE.match(s):
        return True
    if include_chores:
        return False
    lower = s.lower()
    return lower.startswith(SKIP_PREFIXES)


def fetch_since_commit(api_url: str, token: str) -> str:
    url = f"{api_url.rstrip('/')}/api/v1/platform/releases/deploy-anchor"
    req = urllib.request.Request(url, headers={"x-tradeal-token": token})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"deploy-anchor failed ({exc.code}): {exc.read().decode()}") from exc
    return str(data.get("since_commit_sha") or "").strip()


def git_commits(since_sha: str, head_sha: str) -> list[tuple[str, str, str]]:
    head_sha = head_sha.strip()
    if not head_sha:
        raise SystemExit("commit_sha is required")

    def run_log(*args: str) -> list[tuple[str, str, str]]:
        out = subprocess.check_output(
            [
                "git",
                "log",
                *args,
                "--no-merges",
                "--reverse",
                f"-n{MAX_ITEMS}",
                "--pretty=format:%H%n%s%n%b%n---END---",
            ],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        commits: list[tuple[str, str, str]] = []
        for chunk in out.split("---END---"):
            lines = [ln for ln in chunk.strip().splitlines() if ln.strip()]
            if len(lines) < 2:
                continue
            sha, subject = lines[0].strip(), lines[1].strip()
            body = "\n".join(lines[2:]).strip()
            commits.append((sha, subject, body))
        return commits

    if since_sha and since_sha != head_sha:
        if subprocess.run(
            ["git", "merge-base", "--is-ancestor", since_sha, head_sha],
            capture_output=True,
        ).returncode == 0:
            commits = run_log(f"{since_sha}..{head_sha}")
            if commits:
                return commits
    return run_log(f"-n{MAX_ITEMS}", head_sha)


def build_items(commits: list[tuple[str, str, str]], *, include_chores: bool) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for sha, subject, body in commits:
        if should_skip_subject(subject, include_chores=include_chores):
            continue
        key = subject.lower()
        if key in seen:
            continue
        seen.add(key)
        title = subject[:200]
        detail = (body or subject).strip()[:2000]
        category = infer_category(subject)
        item: dict[str, Any] = {
            "category": category,
            "title": title,
            "detail": detail or title,
        }
        feature_key = extract_feature_key(subject)
        if feature_key:
            item["feature_key"] = feature_key
        items.append(item)
        if len(items) >= MAX_ITEMS:
            break
    return items


def main() -> None:
    commit_sha = (os.environ.get("COMMIT_SHA") or os.environ.get("GITHUB_SHA") or "").strip()
    if not commit_sha:
        try:
            commit_sha = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
        except subprocess.CalledProcessError:
            raise SystemExit("Set COMMIT_SHA or run from a git checkout") from None

    env_name = (os.environ.get("TRADEAL_DEPLOY_ENV") or os.environ.get("ENVIRONMENT") or "production").strip()
    include_chores = os.environ.get("TRADEAL_DEPLOY_INCLUDE_CHORES", "").strip().lower() in ("1", "true", "yes")

    items: list[dict[str, Any]] = []
    if os.environ.get("TRADEAL_DEPLOY_CHANGELOG_JSON"):
        items = json.loads(os.environ["TRADEAL_DEPLOY_CHANGELOG_JSON"])
    elif os.environ.get("TRADEAL_DEPLOY_CHANGELOG_FILE"):
        with open(os.environ["TRADEAL_DEPLOY_CHANGELOG_FILE"], encoding="utf-8") as fh:
            items = json.load(fh)

    if not items:
        since = ""
        api_url = (os.environ.get("TRADEAL_API_URL") or os.environ.get("TRADEAL_PRODUCTION_API_URL") or "").strip()
        token = (os.environ.get("TRADEAL_API_TOKEN") or os.environ.get("TRADEOS_API_TOKEN") or "").strip()
        if api_url and token:
            since = fetch_since_commit(api_url, token)
        commits = git_commits(since, commit_sha)
        items = build_items(commits, include_chores=include_chores)
        if not items:
            subject = commits[-1][1] if commits else f"Production deploy {commit_sha[:7]}"
            items = [
                {
                    "category": infer_category(subject),
                    "title": subject[:200],
                    "detail": subject,
                }
            ]

    payload = {
        "commit_sha": commit_sha,
        "environment": env_name,
        "title": "",
        "summary": "",
        "items": items,
        # Notify Tradeal admins when gated [feature] items land as draft Features offers.
        "notify_platform_admins": True,
    }
    json.dump(payload, sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
