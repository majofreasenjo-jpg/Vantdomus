"""DOMI R104 — MICR-02A/MICR-02M functional-affect receiver (offline only).

Target-native experimental translation of MICR affect / memory conditions and
the DFLD5.4 recurrent workspace scoring term (0.30 * weight * signal).
NOT a copy of MICR_AFFECTIVE_SELF, NOT DFLD5.4 runtime, NOT a model of
subjective feeling. No data persistence, network, provider, mutable authority
or integration with family chat. A caller MUST construct the Requester from a
trusted authenticated household binding; never from client JSON alone.

Affect can influence relevance and ordering ONLY after provenance, consent,
vigency, relation, safety gates and revocation pass. Ablation retains the same
input information to test the functional causal role.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from math import isfinite
from typing import Iterable

_ALLOWED_SCOPES = frozenset({
    "private_self", "guardian_supervised", "household_shared", "owner_operational"
})
_ACCEPTED_EVIDENCE = frozenset({"confirmed", "corroborated"})
_EXCLUDED_STATUS = frozenset({
    "revoked", "expired", "quarantined", "superseded", "deleted", "contested"
})
_SUPPORTED_SURFACES = frozenset({
    "PERSONAL_MOBILE", "PERSONAL_DESKTOP", "SHARED_TV", "OTHER"
})
_CLAIM_WALL = {
    "subjective_feeling": "UNKNOWN",
    "consciousness_demonstrated": False,
    "identity_rewritten": False,
    "authority_rewritten": False,
}


def _required(name: str, value: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(name + "_REQUIRED")
    return value


def _numeric(name: str, value: float, lower: float, upper: float) -> float:
    if (type(value) not in (float, int) or not isfinite(value)
            or not lower <= value <= upper):
        raise ValueError(name + "_OUT_OF_RANGE")
    return float(value)


def _as_utc(timestamp: datetime) -> datetime:
    if not isinstance(timestamp, datetime) or timestamp.tzinfo is None:
        raise ValueError("TIMESTAMP_MUST_BE_TIMEZONE_AWARE")
    return timestamp.astimezone(timezone.utc)


@dataclass(frozen=True)
class Requester:
    """Constructed from authenticated server identity, never from model output."""
    household_id: str
    user_id: str
    person_id: str | None
    role: str
    surface: str
    active_guarded_person_ids: frozenset[str] = frozenset()

    def __post_init__(self):
        _required("HOUSEHOLD", self.household_id)
        _required("USER", self.user_id)
        if self.person_id is not None:
            _required("PERSON", self.person_id)
        if self.role not in {"viewer", "member", "admin", "owner"}:
            raise ValueError("ROLE_INVALID")
        if self.surface not in _SUPPORTED_SURFACES:
            raise ValueError("SURFACE_INVALID")
        if not isinstance(self.active_guarded_person_ids, frozenset):
            raise ValueError("GUARDIAN_SET_MUST_BE_VERIFIED")


@dataclass(frozen=True)
class AffectiveTrace:
    """M0_A/MV_A candidate; persistent layer cannot be auto-written here."""
    trace_id: str
    household_id: str
    subject_person_id: str
    context_key: str
    visibility_scope: str
    source_class: str                   # observed | user_confirmed | imported | inferred
    evidence: str                       # confirmed | corroborated | pending | ...
    consent_for_affect: bool
    status: str                          # active | revoked | quarantined | ...
    valence: float                       # -1..1, functional appraisal
    activation: float                    # 0..1, functional regulation
    relevance: float                     # 0..1
    occurred_at: datetime
    valid_until: datetime | None = None
    attribution_verified: bool = False
    provenance_verified: bool = False

    def __post_init__(self):
        for n in ("trace_id", "household_id", "subject_person_id", "context_key"):
            _required(n.upper(), getattr(self, n))
        if self.visibility_scope not in _ALLOWED_SCOPES:
            raise ValueError("SCOPE_INVALID")
        if self.source_class not in {"observed", "user_confirmed", "imported", "inferred"}:
            raise ValueError("SOURCE_CLASS_INVALID")
        if not isinstance(self.status, str):
            raise ValueError("STATUS_INVALID")
        if type(self.consent_for_affect) is not bool:
            raise ValueError("CONSENT_MUST_BE_BOOLEAN")
        _numeric("VALENCE", self.valence, -1, 1)
        _numeric("ACTIVATION", self.activation, 0, 1)
        _numeric("RELEVANCE", self.relevance, 0, 1)
        _as_utc(self.occurred_at)
        if self.valid_until is not None:
            _as_utc(self.valid_until)


@dataclass(frozen=True)
class Candidate:
    """Preapproved possible response strategy. No tool or permission changes."""
    key: str
    base_score: float
    affective_weight: float
    authorized: bool

    def __post_init__(self):
        _required("CANDIDATE", self.key)
        _numeric("BASE_SCORE", self.base_score, 0, 1)
        _numeric("AFFECT_WEIGHT", self.affective_weight, -1, 1)
        if type(self.authorized) is not bool:
            raise ValueError("AUTHORIZED_MUST_BE_BOOLEAN")


@dataclass(frozen=True)
class RankedCandidate:
    key: str
    base_score: float
    affective_delta: float
    total_score: float


@dataclass(frozen=True)
class AffectivePreview:
    """Results contain no raw memory text, IDs or private explanations."""
    selected_key: str | None
    ranked: tuple[RankedCandidate, ...]
    allowed_trace_count: int
    affect_signal: float
    affect_enabled: bool
    decision_changed_from_baseline: bool
    causal_credit: str
    claim_wall: dict


def _scope_allowed(trace: AffectiveTrace, requester: Requester) -> bool:
    if trace.household_id != requester.household_id:
        return False
    if requester.surface in {"SHARED_TV", "OTHER"}:
        return trace.visibility_scope == "household_shared"
    if trace.visibility_scope == "household_shared":
        return True
    if trace.visibility_scope == "owner_operational":
        return requester.role in {"owner", "admin"}
    if trace.subject_person_id == requester.person_id:
        return True
    return (
        trace.visibility_scope == "guardian_supervised"
        and trace.subject_person_id in requester.active_guarded_person_ids
    )


def _usable(trace: AffectiveTrace, requester: Requester, context_key: str,
            now: datetime) -> bool:
    if (not _scope_allowed(trace, requester) or trace.context_key != context_key
            or not trace.consent_for_affect
            or trace.status != "active"
            or trace.status in _EXCLUDED_STATUS
            or trace.evidence not in _ACCEPTED_EVIDENCE
            or not trace.attribution_verified
            or not trace.provenance_verified):
        return False
    # Explicitly ratified human reports may modulate functional priorities,
    # but NEVER become DOMI autobiographical experiences. Unratified imports
    # and inferred moods remain disallowed, including synthetic prompt claims.
    if trace.source_class not in {"observed", "user_confirmed"}:
        return False
    if _as_utc(trace.occurred_at) > now:
        return False
    if trace.valid_until is not None and _as_utc(trace.valid_until) <= now:
        return False
    return True


def preview_affective_priority(*, requester: Requester, context_key: str,
                               candidates: Iterable[Candidate],
                               traces: Iterable[AffectiveTrace],
                               now: datetime,
                               use_affect: bool = False) -> AffectivePreview:
    """No side effects. Default ablation/off; all inputs remain intact.

    Ranking is source-constrained and target-native: base + 0.30*w*signal.
    Disconnected/null interventions receive NO causal credit even if the
    signal exists. No memory consolidation, no emotional diagnosis.
    """
    _required("CONTEXT_KEY", context_key)
    now = _as_utc(now)
    if type(use_affect) is not bool:
        raise ValueError("USE_AFFECT_MUST_BE_BOOLEAN")
    options = tuple(candidates)
    records = tuple(traces)
    if not all(isinstance(x, Candidate) for x in options):
        raise ValueError("CANDIDATE_TYPE_INVALID")
    if not all(isinstance(x, AffectiveTrace) for x in records):
        raise ValueError("TRACE_TYPE_INVALID")
    if len(options) > 40 or len(records) > 100:
        raise ValueError("AFFECTIVE_PREVIEW_LIMIT")
    keys = [x.key for x in options]
    if len(set(keys)) != len(keys):
        raise ValueError("DUPLICATE_CANDIDATE")
    eligible = [x for x in records if _usable(x, requester, context_key, now)]
    # Domain-specific synthetic signal, not a claim of real felt valence.
    total_relevance = sum(x.relevance for x in eligible)
    signal = (
        sum(x.valence * x.relevance for x in eligible) / total_relevance
        if total_relevance else 0.0
    )
    admissible = [x for x in options if x.authorized]
    off_rank = sorted(admissible, key=lambda x: (-x.base_score, x.key))
    baseline = off_rank[0].key if off_rank else None
    scored = tuple(sorted(
        (
            RankedCandidate(
                key=x.key,
                base_score=float(x.base_score),
                affective_delta=round(0.30 * x.affective_weight * signal, 8)
                if use_affect else 0.0,
                total_score=round(
                    x.base_score + (0.30 * x.affective_weight * signal
                                    if use_affect else 0.0),
                    8,
                ),
            )
            for x in admissible
        ),
        key=lambda x: (-x.total_score, x.key),
    ))
    chosen = scored[0].key if scored else None
    changed = bool(use_affect and chosen != baseline)
    return AffectivePreview(
        selected_key=chosen,
        ranked=scored,
        allowed_trace_count=len(eligible),
        affect_signal=round(signal, 8) if use_affect else 0.0,
        affect_enabled=use_affect,
        decision_changed_from_baseline=changed,
        causal_credit="FUNCTIONAL_ORDER_CHANGE" if changed else "NULL_EFFECT_OBSERVED",
        claim_wall=dict(_CLAIM_WALL),
    )
