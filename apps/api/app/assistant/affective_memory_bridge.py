"""DOMI R105 / MICR: governed, opt-in link between confirmed memory and
functional affect. Never used by live chat or a remote provider by default.

An authenticated user's person binding and membership are checked on each
write and read. No derived affect from free text; link metadata is explicitly
ratified and may be revoked. Changing, expiring or deleting the source memory
invalidates the overlay without copying source content into this table.

This only supports a personal subject binding; guardian / shared surfaces /
owner delegations are intentionally excluded pending a separate consent model.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from .affective_runtime import (
    AffectiveTrace, Candidate, Requester, preview_affective_priority,
    _numeric,
)

_CONTEXT_RE = re.compile(r"^[a-z][a-z0-9_]{0,79}$")
_ALLOWED_SCOPES = frozenset({"private_self", "household_shared"})


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(now: datetime) -> str:
    if not isinstance(now, datetime) or now.tzinfo is None:
        raise ValueError("TIMEZONE_REQUIRED")
    return now.astimezone(timezone.utc).isoformat()


def _trusted_requester(db, *, household_id: str, user_id: str,
                       surface: str) -> Requester:
    # No household membership or no unique user-to-person link => fail closed.
    # Membership role comes from DB, not request JSON or caller-supplied role.
    rows = db.execute(
        """SELECT p.id AS person_id, m.role
           FROM persons p
           JOIN household_memberships m ON
             m.household_id=p.household_id AND m.user_id=p.user_id
           WHERE p.household_id=? AND p.user_id=? LIMIT 2""",
        (household_id, user_id),
    ).fetchall()
    if len(rows) != 1:
        raise PermissionError("PERSON_BINDING_REQUIRED")
    return Requester(
        household_id=household_id, user_id=user_id,
        person_id=rows[0]["person_id"], role=rows[0]["role"],
        surface=surface,
    )


def _source(db, household_id: str, person_id: str, memory_id: str, *, now: str):
    return db.execute(
        """SELECT id, person_id, visibility_scope, source, sensitivity,
                  inference_status, verified_at, created_by_user_id,
                  updated_at, created_at, expires_at, deleted_at
           FROM memory_items
           WHERE household_id=? AND person_id=? AND id=?
             AND deleted_at IS NULL
             AND (expires_at IS NULL OR expires_at>?)""",
        (household_id, person_id, memory_id, now),
    ).fetchone()


def _eligible(row) -> bool:
    return bool(
        row is not None
        and row["visibility_scope"] in _ALLOWED_SCOPES
        and row["sensitivity"] in ("normal", "low")
        and row["source"] == "family"
        # Existing plain facts with NULL inference_status are not enough.
        # Only explicit confirmation with a timestamp can support affect.
        and row["inference_status"] == "confirmed"
        and row["verified_at"]
        and row["updated_at"]
    )


def ratify_affective_link(
    db, *, household_id: str, user_id: str, memory_id: str,
    context_key: str, valence: float, activation: float, relevance: float,
    consent_for_affect: bool, now: datetime | None = None,
) -> str:
    """Explicitly ratify an existing confirmed personal memory's affective USE.

    No network, provider or automatic inference. Caller must hold an authenticated
    user id resolved by server. This method does not call db.commit(); caller
    controls the transaction. The source memory's visibility is never widened.
    """
    if consent_for_affect is not True:
        raise PermissionError("EXPLICIT_AFFECT_CONSENT_REQUIRED")
    if not isinstance(context_key, str) or not _CONTEXT_RE.fullmatch(context_key):
        raise ValueError("CONTEXT_KEY_INVALID")
    v = _numeric("VALENCE", valence, -1, 1)
    a = _numeric("ACTIVATION", activation, 0, 1)
    r = _numeric("RELEVANCE", relevance, 0, 1)
    timestamp = _iso(now or _now())
    requester = _trusted_requester(
        db, household_id=household_id, user_id=user_id,
        surface="PERSONAL_DESKTOP"
    )
    row = _source(db, household_id, requester.person_id, memory_id, now=timestamp)
    if not _eligible(row) or row["visibility_scope"] != "private_self":
        # Opt-in personal only in R105; household or guardian requires a
        # separate shared-consent adjudication.
        raise PermissionError("CONFIRMED_PRIVATE_MEMORY_REQUIRED")
    mid = str(uuid.uuid4())
    db.execute(
        """INSERT INTO domi_affective_memory_links
           (id, household_id, person_id, memory_id, memory_updated_at,
            context_key, visibility_scope, valence, activation, relevance,
            ratified_by_user_id, ratified_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (mid, household_id, requester.person_id, memory_id,
         row["updated_at"], context_key, row["visibility_scope"],
         v, a, r, user_id, timestamp),
    )
    return mid


def revoke_affective_link(
    db, *, household_id: str, user_id: str, link_id: str,
    now: datetime | None = None,
) -> bool:
    timestamp = _iso(now or _now())
    requester = _trusted_requester(
        db, household_id=household_id, user_id=user_id,
        surface="PERSONAL_DESKTOP"
    )
    changed = db.execute(
        """UPDATE domi_affective_memory_links
           SET revoked_at=?
           WHERE id=? AND household_id=? AND person_id=?
             AND ratified_by_user_id=? AND revoked_at IS NULL""",
        (timestamp, link_id, household_id, requester.person_id, user_id),
    )
    return changed.rowcount == 1


def _visible_traces(db, *, requester: Requester, context_key: str,
                    now: datetime) -> tuple[AffectiveTrace, ...]:
    # R105 deliberately does not provide guardian reading or shared TV affect.
    if requester.surface not in {"PERSONAL_DESKTOP", "PERSONAL_MOBILE"}:
        return ()
    if not _CONTEXT_RE.fullmatch(context_key):
        raise ValueError("CONTEXT_KEY_INVALID")
    t = _iso(now)
    rows = db.execute(
        """SELECT a.id, a.memory_id, a.household_id, a.person_id,
                  a.context_key, a.visibility_scope, a.valence, a.activation,
                  a.relevance, a.ratified_by_user_id, a.ratified_at,
                  a.expires_at, a.memory_updated_at,
                  m.updated_at AS current_memory_updated_at,
                  m.created_at AS source_created_at,
                  m.deleted_at AS source_deleted_at,
                  m.expires_at AS source_expires_at,
                  m.visibility_scope AS source_scope,
                  m.source AS source_class, m.inference_status,
                  m.verified_at, m.sensitivity
           FROM domi_affective_memory_links a
           JOIN memory_items m ON m.id=a.memory_id
             AND m.household_id=a.household_id
             AND m.person_id=a.person_id
           WHERE a.household_id=? AND a.person_id=? AND a.context_key=?
             AND a.ratified_by_user_id=? AND a.revoked_at IS NULL
             AND (a.expires_at IS NULL OR a.expires_at>?)
           ORDER BY a.ratified_at DESC LIMIT 100""",
        (requester.household_id, requester.person_id,
         context_key, requester.user_id, t),
    ).fetchall()
    result = []
    for row in rows:
        if (row["source_deleted_at"] is not None
                or row["source_expires_at"] is not None and row["source_expires_at"] <= t
                or row["source_scope"] != row["visibility_scope"]
                or row["source_scope"] != "private_self"
                or row["source_class"] != "family"
                or row["inference_status"] != "confirmed"
                or not row["verified_at"]
                or row["sensitivity"] not in ("normal", "low")
                or row["memory_updated_at"] != row["current_memory_updated_at"]):
            continue
        result.append(AffectiveTrace(
            trace_id=row["id"], household_id=row["household_id"],
            subject_person_id=row["person_id"], context_key=row["context_key"],
            visibility_scope="private_self", source_class="user_confirmed",
            evidence="confirmed", consent_for_affect=True, status="active",
            valence=row["valence"], activation=row["activation"],
            relevance=row["relevance"], occurred_at=datetime.fromisoformat(
                row["ratified_at"].replace("Z", "+00:00")
            ), valid_until=None,
            attribution_verified=True, provenance_verified=True,
        ))
    return tuple(result)


def preview_from_confirmed_memory(
    db, *, household_id: str, user_id: str, surface: str,
    context_key: str, candidates: tuple[Candidate, ...],
    now: datetime | None = None, use_affect: bool = False,
):
    """Test-only gated readback. No HTTP route or gateway calls this in R105."""
    requester = _trusted_requester(
        db, household_id=household_id, user_id=user_id, surface=surface
    )
    at = now or _now()
    traces = _visible_traces(
        db, requester=requester, context_key=context_key, now=at
    )
    return preview_affective_priority(
        requester=requester, context_key=context_key,
        candidates=candidates, traces=traces, now=at,
        use_affect=use_affect,
    )


# R106: optional, authenticated and never exposed to live family profiles.
# These functions share the R105 eligibility and ownership checks.

def confirm_personal_memory_source(
    db, *, household_id: str, user_id: str, memory_id: str,
    explicitly_confirmed: bool, now: datetime | None = None,
) -> bool:
    """Separate attestation of source accuracy, NOT affect consent.

    Only the owning adult can invoke this through the R106 route gate.
    Preexisting unconfirmed family memory is not automatically confirmed.
    A confirmed source can be ratified independently with new affect consent.
    """
    if explicitly_confirmed is not True:
        raise PermissionError("EXPLICIT_MEMORY_CONFIRMATION_REQUIRED")
    timestamp = _iso(now or _now())
    requester = _trusted_requester(
        db, household_id=household_id, user_id=user_id,
        surface="PERSONAL_DESKTOP",
    )
    row = _source(
        db, household_id, requester.person_id, memory_id, now=timestamp,
    )
    if not row or row["visibility_scope"] != "private_self" or (
        row["source"] != "family" or row["sensitivity"] not in ("normal", "low")
    ):
        return False
    if row["inference_status"] == "confirmed" and row["verified_at"]:
        return True
    if row["inference_status"] is not None:
        # No silent promotion of pending/contested/dismissed inferences.
        return False
    changed = db.execute(
        """UPDATE memory_items
           SET inference_status='confirmed', verified_at=?, updated_at=?
           WHERE household_id=? AND id=? AND person_id=?
             AND visibility_scope='private_self'
             AND source='family'
             AND sensitivity IN ('normal','low')
             AND inference_status IS NULL AND deleted_at IS NULL
             AND (expires_at IS NULL OR expires_at>?)""",
        (timestamp, timestamp, household_id, memory_id,
         requester.person_id, timestamp),
    )
    return changed.rowcount == 1


def list_personal_affective_links(
    db, *, household_id: str, user_id: str,
    now: datetime | None = None,
) -> list[dict]:
    """Own consent ledger only; no memory content, no guardian/owner override."""
    timestamp = _iso(now or _now())
    requester = _trusted_requester(
        db, household_id=household_id, user_id=user_id,
        surface="PERSONAL_DESKTOP",
    )
    rows = db.execute(
        """SELECT a.id, a.memory_id, a.context_key, a.ratified_at,
                  a.revoked_at, a.memory_updated_at, a.visibility_scope,
                  a.expires_at, a.valence, a.activation, a.relevance,
                  m.updated_at AS source_updated_at,
                  m.deleted_at AS source_deleted_at,
                  m.expires_at AS source_expires_at,
                  m.visibility_scope AS source_scope,
                  m.source AS source_class,
                  m.inference_status, m.verified_at, m.sensitivity
           FROM domi_affective_memory_links a
           LEFT JOIN memory_items m ON m.id=a.memory_id
             AND m.household_id=a.household_id
             AND m.person_id=a.person_id
           WHERE a.household_id=? AND a.person_id=?
             AND a.ratified_by_user_id=?
           ORDER BY a.ratified_at DESC LIMIT 100""",
        (household_id, requester.person_id, user_id),
    ).fetchall()
    out = []
    for item in rows:
        current = bool(
            item["source_deleted_at"] is None
            and item["source_updated_at"] == item["memory_updated_at"]
            and item["source_scope"] == item["visibility_scope"]
            and item["source_scope"] == "private_self"
            and item["source_class"] == "family"
            and item["inference_status"] == "confirmed"
            and item["verified_at"]
            and item["sensitivity"] in ("normal", "low")
            and (not item["source_expires_at"] or item["source_expires_at"] > timestamp)
            and (not item["expires_at"] or item["expires_at"] > timestamp)
        )
        status = (
            "revoked" if item["revoked_at"] else
            "active" if current else "invalidated"
        )
        out.append({
            "id": item["id"],
            "memory_id": item["memory_id"],
            "context_key": item["context_key"],
            "ratified_at": item["ratified_at"],
            "status": status,
            "valence": item["valence"],
            "activation": item["activation"],
            "relevance": item["relevance"],
        })
    return out
