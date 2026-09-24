"""Ship queue — built-but-not-pushed drafts for platform admin."""

from __future__ import annotations

from typing import Any

from .feature_offers_repository import list_offers_platform
from .releases_repository import list_releases


def list_ship_queue(conn) -> dict[str, Any]:
    """Aggregate draft feature offers and draft releases for the Ship queue."""
    draft_offers = list_offers_platform(conn, status="draft")
    releases_payload = list_releases(conn)
    draft_releases = [
        r for r in releases_payload.get("releases") or [] if str(r.get("status") or "") == "draft"
    ]

    items: list[dict[str, Any]] = []
    for offer in draft_offers:
        items.append(
            {
                "kind": "feature_offer",
                "id": int(offer["id"]),
                "title": offer.get("title") or "",
                "subtitle": offer.get("feature_key") or "",
                "feature_key": offer.get("feature_key") or "",
                "ready_to_ship": bool(offer.get("ready_to_ship")),
                "target_ship_date": offer.get("target_ship_date") or "",
                "ship_notes": offer.get("ship_notes") or "",
                "created_at": offer.get("created_at") or "",
                "updated_at": offer.get("updated_at") or "",
                "href": "/platform-admin/add-ons?tab=catalog",
                "offer": offer,
            }
        )
    for release in draft_releases:
        feature_keys = [
            str(i.get("feature_key") or "").strip()
            for i in (release.get("items") or [])
            if str(i.get("feature_key") or "").strip()
        ]
        items.append(
            {
                "kind": "release",
                "id": int(release["id"]),
                "title": release.get("title") or release.get("version") or "",
                "subtitle": release.get("version") or "",
                "feature_key": ", ".join(feature_keys),
                "ready_to_ship": bool(release.get("ready_to_ship")),
                "target_ship_date": release.get("target_ship_date") or "",
                "ship_notes": release.get("ship_notes") or "",
                "created_at": release.get("created_at") or "",
                "updated_at": release.get("updated_at") or "",
                "href": f"/platform-admin/releases?releaseId={int(release['id'])}",
                "release": release,
            }
        )

    def sort_key(row: dict[str, Any]) -> tuple:
        ready = 0 if row.get("ready_to_ship") else 1
        target = str(row.get("target_ship_date") or "") or "9999-12-31"
        updated = str(row.get("updated_at") or "")
        return (ready, target, updated)

    items.sort(key=sort_key)
    return {
        "items": items,
        "draft_offers": len(draft_offers),
        "draft_releases": len(draft_releases),
    }
