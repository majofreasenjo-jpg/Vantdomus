"""
OPS-2 M11 — Export iCalendar (.ics) del calendario del hogar.

Genera un archivo .ics estándar desde las actividades del hogar, importable en
Google Calendar / Apple Calendar / Outlook SIN OAuth: el usuario descarga el
archivo (sesión autenticada) y lo importa. La sincronización bidireccional
(OAuth) es una fase posterior con infra del Owner.

Solo se exporta lo que el usuario que descarga puede VER (el endpoint aplica el
mismo filtro de visibilidad que la lista).
"""

from __future__ import annotations

from datetime import datetime, timezone


def _esc(text: str) -> str:
    """Escapa texto para ICS (RFC 5545): backslash, coma, punto y coma, saltos."""
    return ((text or "")
            .replace("\\", "\\\\")
            .replace(";", "\\;")
            .replace(",", "\\,")
            .replace("\r\n", "\\n")
            .replace("\n", "\\n"))


def _dt_ics(iso: str | None) -> str | None:
    """ISO-8601 → formato ICS UTC (YYYYMMDDTHHMMSSZ). None si no parsea."""
    if not iso:
        return None
    try:
        s = str(iso).strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    except (ValueError, TypeError):
        return None


def build_ics(items: list[dict], calendar_name: str = "VantDomus — Hogar") -> str:
    """
    Construye el .ics desde actividades [{id, title, description?, starts_at,
    ends_at?, location_label?, status?}]. Omite las que no tienen starts_at
    parseable y las canceladas.
    """
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//VantDomus//Hogar//ES",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_esc(calendar_name)}",
    ]
    for it in items:
        if (it.get("status") or "planned") == "cancelled":
            continue
        start = _dt_ics(it.get("starts_at"))
        if not start:
            continue
        end = _dt_ics(it.get("ends_at")) or start
        lines += [
            "BEGIN:VEVENT",
            f"UID:{_esc(str(it.get('id') or ''))}@vantdomus",
            f"DTSTAMP:{now}",
            f"DTSTART:{start}",
            f"DTEND:{end}",
            f"SUMMARY:{_esc(str(it.get('title') or 'Actividad'))}",
        ]
        if it.get("description"):
            lines.append(f"DESCRIPTION:{_esc(str(it['description']))}")
        if it.get("location_label"):
            lines.append(f"LOCATION:{_esc(str(it['location_label']))}")
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    # RFC 5545 usa CRLF como separador de líneas.
    return "\r\n".join(lines) + "\r\n"
