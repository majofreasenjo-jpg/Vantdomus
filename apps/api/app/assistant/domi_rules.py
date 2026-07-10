"""
Domi copilot por reglas (sin LLM) — responde consultas sobre los datos reales
del hogar. Es el "cerebro" honesto cuando NO hay API key de IA: no inventa,
solo ordena y resume lo que ya existe. Cuando hay key, /assistant/chat usa el
LLM y esto queda como respaldo.

Idioma: español de Chile, cálido y breve. Cobertura de intenciones amplia para
que no se sienta "tonto": integrantes, persona específica, compras, actividades,
medicamentos, avisos, presupuesto, documentos, saludo/gracias, resumen y ayuda.
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
    """Lista de (id, display_name, relation)."""
    return _fetch(db, "SELECT id, display_name, relation FROM persons WHERE household_id=? ORDER BY display_name", (hid,))


def _household_name(db, hid):
    row = _fetch(db, "SELECT name, meta FROM households WHERE id=?", (hid,))
    if not row:
        return "tu hogar"
    import json
    try:
        meta = json.loads(row[0]["meta"] or "{}")
    except Exception:
        meta = {}
    return meta.get("family_name") or row[0]["name"] or "tu hogar"


def _shopping(db, hid):
    return _fetch(db, "SELECT item_name, status, quantity, unit, estimated_price, assigned_to_person_id FROM household_shopping_items WHERE household_id=?", (hid,))


def _activities_today(db, hid):
    return _fetch(db, "SELECT person_id, title, activity_type, starts_at, status, date_iso FROM daily_activities WHERE household_id=? AND date_iso=?", (hid, _today_iso()))


def _board(db, hid):
    return _fetch(db, "SELECT title, body, post_type, priority, pinned, resolved_at FROM family_board_posts WHERE household_id=? ORDER BY created_at DESC LIMIT 20", (hid,))


def _meds(db, hid):
    return _fetch(db, "SELECT title FROM unit_functions WHERE household_id=? AND category='medication'", (hid,))


def _clp(n):
    try:
        return f"${round(float(n)):,}".replace(",", ".")
    except Exception:
        return str(n)


def _first_name(name):
    return (name or "").strip().split()[0] if name else ""


def _person_in_query(q, persons):
    for p in persons:
        fn = _first_name(p["display_name"]).lower()
        if fn and fn in q:
            return p
    return None


def _person_brief(db, hid, p):
    """Mini-resumen de una persona: actividades de hoy + compras asignadas + relación."""
    name = p["display_name"]
    rel = (p["relation"] or "").strip()
    acts = [a for a in _activities_today(db, hid) if a["person_id"] == p["id"]]
    from app.shopping_contract import is_por_comprar
    shop = [s for s in _shopping(db, hid) if s["assigned_to_person_id"] == p["id"] and is_por_comprar(s["status"])]
    partes = [f"{name}" + (f" ({rel})" if rel else "") + "."]
    if acts:
        partes.append("Hoy: " + "; ".join(a["title"] for a in acts[:5]) + ".")
    else:
        partes.append("Hoy no tiene actividades registradas.")
    if shop:
        partes.append("Encargado de comprar: " + ", ".join(s["item_name"] for s in shop[:5]) + ".")
    return " ".join(partes)


def answer_domi(question: str, db, household_id: str) -> str:
    q = (question or "").lower().strip()
    persons = _persons(db, household_id)

    def has(*words):
        return any(w in q for w in words)

    # --- Saludo / cortesía ---
    if has("gracias", "muchas gracias", "genial", "perfecto") and len(q) < 30:
        return "¡De nada! Aquí estoy cuando me necesites. 🙂"
    if q in ("hola", "buenas", "hey", "holi") or (has("hola", "buenos días", "buenas tardes", "buenas noches") and len(q) < 25):
        nombre = _household_name(db, household_id)
        return f"¡Hola! Soy Domi, tu copilot de {nombre}. ¿Quieres ver las compras, las actividades de hoy o un resumen?"

    # --- Integrantes del hogar ---
    if has("quien", "quién", "integrante", "miembro", "componen", "compone", "somos", "familia est", "grupo familiar", "núcleo", "nucleo", "quienes viven", "personas"):
        if not persons:
            return "Todavía no hay integrantes registrados en el hogar. Puedes agregarlos en Perfiles."
        nombre = _household_name(db, household_id)
        listado = ", ".join(
            (p["display_name"] + (f" ({p['relation']})" if (p["relation"] or "").strip() else ""))
            for p in persons
        )
        return f"El hogar {nombre} tiene {len(persons)} integrantes: {listado}."

    # --- Persona específica (si nombran a alguien) ---
    p = _person_in_query(q, persons)
    if p and not has("compra", "comprar", "falta", "medicamento", "remedio", "aviso", "resumen"):
        return _person_brief(db, household_id, p)

    # --- Compras ---
    # MIN-3.3a: los números salen del CONTRATO CANÓNICO (shopping_contract),
    # nunca de criterios propios. Home, Domi y módulo muestran lo mismo.
    if has("compra", "comprar", "falta", "lista", "supermercado", "carro", "feria", "mercado"):
        from app.shopping_contract import shopping_summary, STATUS_NEEDED, STATUS_IN_CART
        s = shopping_summary(db, household_id)
        if s["por_comprar"] == 0:
            return "No hay nada pendiente de comprar por ahora. 🛒"
        items = _shopping(db, household_id)
        needed_names = [r["item_name"] for r in items if r["status"] == STATUS_NEEDED]
        cart_rows = [r for r in items if r["status"] == STATUS_IN_CART]
        partes = [f"Hay {s['por_comprar']} productos por comprar."]
        if needed_names:
            partes.append(f"Pendientes ({s['needed']}): " + ", ".join(needed_names[:8]) + ".")
        if cart_rows:
            total = sum((r["estimated_price"] or 0) for r in cart_rows)
            extra = f" (total estimado {_clp(total)})" if total else ""
            partes.append(f"En el carro tentativo: {s['in_cart']}{extra}.")
        partes.append("Lo ves y marcas en Compras.")
        return " ".join(partes)

    # --- Medicamentos / salud ---
    if has("medicamento", "remedio", "pastilla", "salud", "dosis", "control", "médico", "medico"):
        meds = _meds(db, household_id)
        if not meds:
            return "No tengo medicamentos cargados. Puedes agregarlos en Salud o escaneando una receta en la Bandeja Inteligente."
        return (f"Hay {len(meds)} medicamento(s) en seguimiento: " + ", ".join(m["title"] for m in meds[:6]) +
                ". Recuerda: las dosis requieren confirmación humana, yo solo aviso. 🛡️")

    # --- Ayuda / capacidades (antes que actividades para no chocar con "hacer") ---
    if has("ayuda", "puedes", "podés", "podes", "sabes hacer", "qué haces", "que haces", "para qué sirves", "para que sirves", "cómo funciona", "como funciona"):
        return ("Puedo ayudarte con: integrantes del hogar, qué hace cada persona hoy, compras y carro, "
                "medicamentos, avisos del Mural, presupuesto, documentos y un resumen del día. "
                "Prueba: «¿quiénes son la familia?», «¿qué tiene Camila hoy?» o «¿qué falta comprar?».")

    # --- Actividades ---
    if has("actividad", "hoy", "agenda", "plan ", "día", "dia", "evento", "horario", "qué hacer", "que hacer"):
        acts = _activities_today(db, household_id)
        if not acts:
            return "No hay actividades registradas para hoy. Puedes agregarlas en Actividades."
        pend = [a for a in acts if a["status"] == "planned"]
        # agrupar por persona
        by = {}
        names = {pp["id"]: _first_name(pp["display_name"]) for pp in persons}
        for a in acts:
            by.setdefault(a["person_id"], []).append(a["title"])
        detalle = " · ".join(f"{names.get(pid, 'Alguien')}: {len(t)}" for pid, t in list(by.items())[:5])
        return f"Hoy hay {len(acts)} actividades ({len(pend)} pendientes). {detalle}. Las ves en Actividades."

    # --- Avisos / mural ---
    if has("aviso", "mural", "novedad", "mensaje", "recordatorio", "noticia"):
        posts = [pp for pp in _board(db, household_id) if not pp["resolved_at"]]
        if not posts:
            return "No hay avisos activos en el Mural ahora mismo."
        return (f"Hay {len(posts)} avisos activos. El más reciente: «{posts[0]['title']}». Puedes verlos todos en el Mural.")

    # --- Presupuesto / finanzas ---
    if has("presupuesto", "gasto", "plata", "dinero", "cuánto", "cuanto", "pagar", "cuenta", "finanza"):
        items = _shopping(db, household_id)
        in_cart = [r for r in items if r["status"] == "in_cart"]
        total = sum((r["estimated_price"] or 0) for r in in_cart)
        base = "El presupuesto del hogar lo manejas en Presupuesto (ingresos, gastos y vencimientos)."
        if total:
            base += f" Por ahora, el carro tentativo suma {_clp(total)} estimado."
        return base

    # --- Documentos ---
    if has("documento", "receta", "boleta", "bandeja", "póliza", "poliza", "garantía", "garantia", "circular"):
        return ("Los documentos viven en Documentos, con la Bandeja Inteligente: pegas o subes una receta/boleta "
                "y Domi propone (medicamento, gasto, etc.) para que tú confirmes.")

    # --- Perfiles / estado ---
    if has("perfil", "avatar", "foto", "estado", "estoy en casa", "en camino"):
        return "Cada integrante elige su avatar y pone su estado del hogar (En casa, En camino, Llegué…) en Perfiles."

    # --- Resumen ---
    if has("resumen", "qué hay", "que hay", "cómo va", "como va", "novedades", "situación", "situacion"):
        # MIN-3.3a: conteo desde el contrato canónico.
        from app.shopping_contract import shopping_summary
        s = shopping_summary(db, household_id)
        acts = _activities_today(db, household_id)
        posts = [pp for pp in _board(db, household_id) if not pp["resolved_at"]]
        return (f"Resumen de hoy: {len(posts)} avisos activos, {len(acts)} actividades, "
                f"{s['por_comprar']} productos por comprar. ¿Quieres ver alguno?")

    # --- Fallback con mejor esfuerzo ---
    if p:  # nombraron a alguien aunque la intención no fuera clara
        return _person_brief(db, household_id, p)
    nombre = _household_name(db, household_id)
    return (f"Sobre {nombre} puedo contarte: integrantes, actividades de hoy, compras, medicamentos, "
            "avisos, presupuesto y un resumen. ¿Cuál te muestro? (La conversación con IA plena se activa "
            "cuando se configure la clave.)")
