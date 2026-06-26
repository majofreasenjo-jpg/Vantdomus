"""
Domi copilot por reglas (sin LLM) — responde consultas sobre los datos reales
del hogar. Es el "cerebro" honesto cuando NO hay API key de IA: no inventa,
solo ordena y resume lo que ya existe. Cuando hay key, /assistant/chat usa el
LLM y esto queda como respaldo.

Idioma: español de Chile, cálido y breve.
"""

from datetime import datetime, timezone


def _today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _fetch(db, sql, params=()):
    try:
        return db.execute(sql, params).fetchall()
    except Exception:
        return []


def _persons(db, hid):
    rows = _fetch(db, "SELECT id, display_name FROM persons WHERE household_id=?", (hid,))
    return {r["id"]: r["display_name"] for r in rows}


def _shopping(db, hid):
    return _fetch(db, "SELECT item_name, status, quantity, unit, estimated_price, assigned_to_person_id FROM household_shopping_items WHERE household_id=?", (hid,))


def _activities_today(db, hid):
    today = _today_iso()
    return _fetch(db, "SELECT person_id, title, activity_type, starts_at, status, date_iso FROM daily_activities WHERE household_id=? AND date_iso=?", (hid, today))


def _board(db, hid):
    return _fetch(db, "SELECT title, body, post_type, priority, pinned, resolved_at FROM family_board_posts WHERE household_id=? ORDER BY created_at DESC LIMIT 20", (hid,))


def _meds(db, hid):
    rows = _fetch(db, "SELECT title, schedule FROM unit_functions WHERE household_id=? AND category='medication'", (hid,))
    return rows


def _clp(n):
    try:
        return f"${round(float(n)):,}".replace(",", ".")
    except Exception:
        return str(n)


def answer_domi(question: str, db, household_id: str) -> str:
    """Devuelve una respuesta en texto a partir de la consulta y los datos del hogar."""
    q = (question or "").lower().strip()
    persons = _persons(db, household_id)

    def has(*words):
        return any(w in q for w in words)

    # --- Compras ---
    if has("compra", "comprar", "falta", "lista", "supermercado", "carro", "feria"):
        items = _shopping(db, household_id)
        needed = [r for r in items if r["status"] == "needed"]
        in_cart = [r for r in items if r["status"] == "in_cart"]
        if not needed and not in_cart:
            return "No hay nada pendiente de comprar por ahora. 🛒"
        partes = []
        if needed:
            nombres = ", ".join(r["item_name"] for r in needed[:8])
            partes.append(f"Faltan {len(needed)} productos: {nombres}.")
        if in_cart:
            total = sum((r["estimated_price"] or 0) for r in in_cart)
            extra = f" (total estimado {_clp(total)})" if total else ""
            partes.append(f"En el carro tentativo hay {len(in_cart)}{extra}.")
        partes.append("Puedes verlo y marcarlo en Compras.")
        return " ".join(partes)

    # --- Medicamentos / salud ---
    if has("medicamento", "remedio", "pastilla", "salud", "dosis", "control"):
        meds = _meds(db, household_id)
        if not meds:
            return "No tengo medicamentos cargados en el hogar. Puedes agregarlos desde Salud o la Bandeja Inteligente."
        nombres = ", ".join(m["title"] for m in meds[:6])
        return (f"Hay {len(meds)} medicamento(s) en seguimiento: {nombres}. "
                "Recuerda: las dosis requieren confirmación humana, yo solo te aviso. 🛡️")

    # --- Actividades / agenda / por persona ---
    if has("actividad", "hoy", "agenda", "hacer", "plan", "día", "dia"):
        acts = _activities_today(db, household_id)
        # ¿menciona a una persona?
        for pid, name in persons.items():
            if name and name.lower().split()[0] in q:
                suyas = [a for a in acts if a["person_id"] == pid]
                if not suyas:
                    return f"{name} no tiene actividades registradas hoy."
                lst = "; ".join(a["title"] for a in suyas[:6])
                return f"Hoy {name} tiene: {lst}."
        if not acts:
            return "No hay actividades registradas para hoy. Puedes agregarlas en Actividades."
        pend = [a for a in acts if a["status"] == "planned"]
        return f"Hoy hay {len(acts)} actividades en la familia ({len(pend)} pendientes). Te las muestro en Actividades."

    # --- Avisos / mural ---
    if has("aviso", "mural", "novedad", "mensaje", "recordatorio"):
        posts = [p for p in _board(db, household_id) if not p["resolved_at"]]
        if not posts:
            return "No hay avisos activos en el Mural ahora mismo."
        top = posts[0]
        return f"Hay {len(posts)} avisos activos. El más reciente: «{top['title']}». Puedes verlos todos en el Mural."

    # --- Perfiles / estado / avatar ---
    if has("perfil", "avatar", "foto", "estado", "estoy en casa"):
        return "Cada integrante puede elegir su avatar y poner su estado del hogar (En casa, En camino, Llegué…) en Perfiles."

    # --- Resumen / saludo ---
    if has("resumen", "hola", "qué hay", "que hay", "cómo va", "como va", "novedades"):
        items = _shopping(db, household_id)
        needed = len([r for r in items if r["status"] == "needed"])
        acts = _activities_today(db, household_id)
        posts = [p for p in _board(db, household_id) if not p["resolved_at"]]
        return (f"Resumen de hoy: {len(posts)} avisos activos, {len(acts)} actividades, "
                f"{needed} productos por comprar. ¿Quieres que te muestre alguno?")

    # --- Capacidades / ayuda ---
    if has("ayuda", "qué puedes", "que puedes", "cómo funciona", "como funciona", "?"):
        return ("Puedo contarte qué falta comprar, qué actividades hay hoy, los medicamentos en "
                "seguimiento, los avisos del Mural y un resumen del día. Pregúntame, por ejemplo: "
                "«¿qué falta comprar?» o «¿qué tiene Diego hoy?».")

    # --- Fallback honesto ---
    return ("Por ahora respondo sobre lo que vive en tu hogar: compras, actividades de hoy, "
            "medicamentos, avisos y un resumen del día. Prueba con «¿qué falta comprar?» o "
            "«¿qué hay hoy?». (La conversación con IA plena se activa cuando se configure.)")
