"""
OPS-2 M10 — MUSIC-0: biblioteca musical familiar por enlaces.

Fase 0 del canon: guardar y abrir ENLACES de servicios musicales, etiquetados por
momento. Reglas duras:
  - SIN OAuth, SIN tokens, SIN passwords; nada de esto pasa por el modelo.
  - Allowlist de dominios musicales conocidos: un enlace fuera de ella se RECHAZA
    (anti-phishing; nadie puede colar un link arbitrario "disfrazado de música").
  - Solo esquema https. Abrir siempre es acción explícita del usuario en la UI.

MUSIC-1 (OAuth por integrante + control de reproducción) y MUSIC-2 (listas
familiares + restricciones de menores) vienen después, con infra del Owner.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

ALLOWED_MOODS = {"general", "calma", "energia", "estudio", "dormir", "fiesta"}

# Allowlist dominio→servicio. Se comparan hosts exactos o subdominios.
_SERVICE_DOMAINS: dict[str, str] = {
    "open.spotify.com": "spotify",
    "spotify.link": "spotify",
    "youtube.com": "youtube",
    "www.youtube.com": "youtube",
    "music.youtube.com": "youtube",
    "youtu.be": "youtube",
    "music.amazon.com": "amazon",
    "music.amazon.es": "amazon",
    "music.amazon.com.mx": "amazon",
    "deezer.com": "deezer",
    "www.deezer.com": "deezer",
    "link.deezer.com": "deezer",
    "soundcloud.com": "soundcloud",
    "on.soundcloud.com": "soundcloud",
    "music.apple.com": "apple",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def service_for_url(url: str) -> str | None:
    """Devuelve el servicio si el enlace es https y de un dominio permitido; si no, None."""
    try:
        p = urlparse((url or "").strip())
    except Exception:
        return None
    if p.scheme != "https" or not p.hostname:
        return None
    host = p.hostname.lower()
    if host in _SERVICE_DOMAINS:
        return _SERVICE_DOMAINS[host]
    # Subdominios de los dominios base conocidos (ej. m.youtube.com).
    for domain, service in _SERVICE_DOMAINS.items():
        if host.endswith("." + domain):
            return service
    return None


def add_link(
    db, *,
    household_id: str,
    person_id: str | None,
    added_by_user_id: str | None,
    title: str,
    url: str,
    mood: str = "general",
) -> dict:
    """Registra un enlace musical validado. Devuelve {id, service}."""
    title = (title or "").strip()
    if not title:
        raise ValueError("Ponle un nombre (canción, lista o momento)")
    service = service_for_url(url)
    if service is None:
        raise ValueError(
            "Solo se aceptan enlaces https de servicios de música conocidos "
            "(Spotify, YouTube, Amazon Music, Deezer, SoundCloud, Apple Music)")
    if mood not in ALLOWED_MOODS:
        mood = "general"
    mid = str(uuid.uuid4())
    db.execute(
        "INSERT INTO family_music_links "
        "(id, household_id, person_id, added_by_user_id, title, url, service, mood, created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?)",
        (mid, household_id, person_id, added_by_user_id, title[:200], url.strip()[:600],
         service, mood, _now()),
    )
    db.commit()
    return {"id": mid, "service": service}


def list_links(db, household_id: str, mood: str | None = None) -> list[dict]:
    if mood and mood in ALLOWED_MOODS:
        rows = db.execute(
            "SELECT m.*, p.display_name FROM family_music_links m "
            "LEFT JOIN persons p ON p.id = m.person_id "
            "WHERE m.household_id=? AND m.mood=? AND m.deleted_at IS NULL "
            "ORDER BY m.created_at DESC LIMIT 300",
            (household_id, mood),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT m.*, p.display_name FROM family_music_links m "
            "LEFT JOIN persons p ON p.id = m.person_id "
            "WHERE m.household_id=? AND m.deleted_at IS NULL "
            "ORDER BY m.created_at DESC LIMIT 300",
            (household_id,),
        ).fetchall()
    return [{
        "id": r["id"],
        "title": r["title"],
        "url": r["url"],
        "service": r["service"],
        "mood": r["mood"],
        "for": (r["display_name"] or "").split(" ")[0] if r["person_id"] else "familia",
        "created_at": r["created_at"],
    } for r in rows]


def delete_link(db, household_id: str, link_id: str, *,
                requester_user_id: str | None, requester_role: str | None) -> bool:
    """Borra (soft) un enlace: quien lo agregó o un admin del hogar."""
    r = db.execute(
        "SELECT added_by_user_id FROM family_music_links "
        "WHERE id=? AND household_id=? AND deleted_at IS NULL",
        (link_id, household_id),
    ).fetchone()
    if not r:
        return False
    if not (requester_user_id == r["added_by_user_id"] or requester_role in ("owner", "admin")):
        return False
    db.execute(
        "UPDATE family_music_links SET deleted_at=? WHERE id=? AND household_id=?",
        (_now(), link_id, household_id),
    )
    db.commit()
    return True
