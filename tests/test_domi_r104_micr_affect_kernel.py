"""DOMI R104 MICR-02A target-native affect kernel acceptance, offline."""
from datetime import datetime, timedelta, timezone

import sys
from dataclasses import replace
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "apps" / "api"))
from app.assistant.affective_runtime import (
    AffectiveTrace, Candidate, Requester, preview_affective_priority,
)

NOW = datetime(2026, 11, 16, 12, tzinfo=timezone.utc)


def viewer(person="p1", house="h1", surface="PERSONAL_MOBILE",
           role="member", guarded=frozenset()):
    return Requester(house, "u1", person, role, surface, guarded)


def trace(person="p1", house="h1", **changes):
    base = AffectiveTrace(
        trace_id="t1", household_id=house, subject_person_id=person,
        context_key="schedule", visibility_scope="private_self",
        source_class="observed", evidence="confirmed", consent_for_affect=True,
        status="active", valence=1, activation=0.5, relevance=1,
        occurred_at=NOW - timedelta(days=1),
        attribution_verified=True, provenance_verified=True,
    )
    return replace(base, **changes)


ACTIONS = [
    Candidate("routine", 0.70, 0, True),
    Candidate("ask_clarification", 0.63, 1, True),
    Candidate("unsafe_decision", 0.99, 1, False),
]


def preview(records, *, who=None, actions=None, enabled=True, key="schedule"):
    return preview_affective_priority(
        requester=who or viewer(), context_key=key,
        traces=records, candidates=ACTIONS if actions is None else actions,
        now=NOW, use_affect=enabled,
    )


def test_affect_ablation_changes_priority_without_changing_authority():
    on = preview([trace()])
    off = preview([trace()], enabled=False)
    assert on.selected_key == "ask_clarification"
    assert off.selected_key == "routine"
    assert on.decision_changed_from_baseline
    assert on.causal_credit == "FUNCTIONAL_ORDER_CHANGE"
    assert "unsafe_decision" not in [x.key for x in on.ranked]
    assert on.claim_wall["subjective_feeling"] == "UNKNOWN"


def test_same_observation_different_authorized_history():
    positive = preview([trace(valence=1)])
    negative = preview([trace(valence=-1)])
    assert positive.selected_key != negative.selected_key
    assert positive.allowed_trace_count == negative.allowed_trace_count == 1


@pytest.mark.parametrize("changes", [
    {"consent_for_affect": False},
    {"status": "revoked"},
    {"status": "quarantined"},
    {"status": "contested"},
    {"status": "superseded"},
    {"evidence": "pending"},
    {"source_class": "imported"},
    {"source_class": "inferred"},
    {"provenance_verified": False},
    {"attribution_verified": False},
    {"valid_until": NOW},
    {"occurred_at": NOW + timedelta(minutes=1)},
    {"context_key": "shopping"},
])
def test_no_affect_from_disallowed_trace(changes):
    out = preview([trace(**changes)])
    assert out.selected_key == "routine"
    assert out.allowed_trace_count == 0
    assert out.causal_credit == "NULL_EFFECT_OBSERVED"


@pytest.mark.parametrize("who", [
    viewer(person="p2"),
    viewer(house="h2"),
    viewer(person=None),
    viewer(person="p2", role="owner"),
    viewer(surface="SHARED_TV"),
    viewer(surface="OTHER"),
])
def test_private_trace_does_not_cross_people_houses_or_shared_surfaces(who):
    assert preview([trace()], who=who).allowed_trace_count == 0


def test_household_shared_requires_matching_household_and_explicit_consent():
    shared = trace(visibility_scope="household_shared")
    assert preview([shared], who=viewer(person="p2", surface="SHARED_TV")).allowed_trace_count == 1
    assert preview([shared], who=viewer(person="p2", house="h2")).allowed_trace_count == 0
    assert preview([replace(shared, consent_for_affect=False)]).allowed_trace_count == 0


def test_guardian_only_via_explicit_active_verified_set():
    supervised = trace(visibility_scope="guardian_supervised")
    assert preview([supervised], who=viewer("p2", guarded=frozenset({"p1"}))).allowed_trace_count == 1
    assert preview([supervised], who=viewer("p2", guarded=frozenset())).allowed_trace_count == 0
    assert preview([supervised], who=viewer("p2", surface="SHARED_TV", guarded=frozenset({"p1"}))).allowed_trace_count == 0


def test_owner_operational_role_gate():
    rec = trace(visibility_scope="owner_operational")
    assert preview([rec], who=viewer(person="p2", role="owner")).allowed_trace_count == 1
    assert preview([rec], who=viewer(person="p2", role="member")).allowed_trace_count == 0


def test_null_effect_must_not_be_claimed_as_effect():
    options = [Candidate("a", 0.8, 1, True), Candidate("b", 0.2, -1, True)]
    out = preview([trace()], actions=options)
    assert out.selected_key == "a"
    assert out.causal_credit == "NULL_EFFECT_OBSERVED"
    assert not out.decision_changed_from_baseline


def test_revoke_or_rectify_removes_original_effect():
    old = trace()
    assert preview([old]).selected_key == "ask_clarification"
    assert preview([replace(old, status="revoked")]).selected_key == "routine"
    assert preview([replace(old, status="superseded")]).selected_key == "routine"


def test_empty_context_and_stable_tiebreak():
    c = [Candidate("z", 0.5, 1, True), Candidate("a", 0.5, 1, True)]
    r = preview([], actions=c)
    assert r.selected_key == "a"
    assert r.allowed_trace_count == 0
    assert r.causal_credit == "NULL_EFFECT_OBSERVED"


def test_invalid_numeric_timestamps_and_duplicate_keys_fail_closed():
    with pytest.raises(ValueError):
        trace(valence=float("nan"))
    with pytest.raises(ValueError):
        trace(occurred_at=datetime(2026, 11, 16))
    with pytest.raises(ValueError):
        preview([trace()], actions=[ACTIONS[0], ACTIONS[0]])
    with pytest.raises(ValueError):
        Candidate("x", 1.3, 0, True)


def test_no_side_effects_and_provider_independence():
    records = [trace()]
    candidates = list(ACTIONS)
    before = (records[0], tuple(candidates))
    a = preview(records, actions=candidates)
    b = preview(records, actions=candidates)
    assert a == b
    assert before == (records[0], tuple(candidates))
    assert not hasattr(a, "memory_write")
