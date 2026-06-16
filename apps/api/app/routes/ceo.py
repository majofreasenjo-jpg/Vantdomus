import uuid, json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from ..deps import get_db, get_current_user, require_operational_feature_enabled
from ..features import compute_and_store
from ..tenancy import ensure_user_default_organization

router = APIRouter(prefix="/ceo", tags=["CEO"])

def now():
    return datetime.now(timezone.utc).isoformat()

@router.get("/dashboard")
def get_ceo_dashboard(user=Depends(get_current_user), db=Depends(get_db)):
    rows = db.execute("""
        SELECT h.id, h.name, h.meta 
        FROM households h 
        JOIN household_memberships m ON h.id=m.household_id 
        WHERE m.user_id=?
    """, (user["user_id"],)).fetchall()
    
    # 1. Agrupar departamentos por Gerencia
    gerencias_map = {}
    for r in rows:
        hid = r["id"]
        name = r["name"]
        meta_str = r["meta"]
        meta = {}
        if meta_str:
            try:
                meta = json.loads(meta_str)
            except:
                pass
                
        gerencia_name = meta.get("gerencia", "Operaciones Generales")
        
        f = compute_and_store(db, hid)
        
        # Simulation overrides
        ovr = meta.get("override_scores", {})
        hsi = ovr.get("osi", f.get("hsi", 0))
        h_score = ovr.get("health", f.get("health_score", 0))
        t_score = ovr.get("tasks", f.get("task_score", 0))
        fin_score = ovr.get("finance", f.get("finance_score", 0))
        
        if gerencia_name not in gerencias_map:
            gerencias_map[gerencia_name] = {
                "name": gerencia_name,
                "departments": [],
                "sum_hsi": 0, "sum_h": 0, "sum_t": 0, "sum_f": 0, "sum_esg": 0,
                "sum_water": 0, "sum_female": 0, "sum_emissions": 0,
                "min_dept_hsi": 100.0,
                "count": 0
            }
            
        g = gerencias_map[gerencia_name]
        g["departments"].append({
            "id": hid,
            "name": name,
            "meta": meta,
            "hsi": hsi,
            "health_score": h_score,
            "task_score": t_score,
            "finance_score": fin_score,
            "esg": f.get("esg", {})
        })
        g["sum_hsi"] += hsi
        g["sum_h"] += h_score
        g["sum_t"] += t_score
        g["sum_f"] += fin_score
        esg_metrics = f.get("esg", {})
        g["sum_esg"] += esg_metrics.get("esg_global", 0)
        g["sum_water"] += esg_metrics.get("water_desalinated_pct", 0)
        g["sum_female"] += esg_metrics.get("female_workforce_pct", 0)
        g["sum_emissions"] += esg_metrics.get("emissions_sox_tonnes", 0)
        g["count"] += 1
        if hsi < g["min_dept_hsi"]:
            g["min_dept_hsi"] = hsi

    # 2. Calcular los puntajes de las Gerencias (Nivel 3)
    gerencias_array = []
    
    ceo_sum_osi = 0.0
    ceo_sum_h = 0.0
    ceo_sum_t = 0.0
    ceo_sum_f = 0.0
    min_gerencia_osi = 100.0
    ceo_count = 0
    
    for g_name, g in gerencias_map.items():
        if g["count"] == 0: continue
        
        avg_hsi = g["sum_hsi"] / g["count"]
        avg_h = g["sum_h"] / g["count"]
        avg_t = g["sum_t"] / g["count"]
        avg_f = g["sum_f"] / g["count"]
        
        penalty_applied = False
        if g["min_dept_hsi"] < 60:
            penalty = (60 - g["min_dept_hsi"]) * 0.6
            avg_hsi = max(0, avg_hsi - penalty)
            penalty_applied = True
            
        avg_esg = g["sum_esg"] / g["count"]
            
        gerencias_array.append({
            "name": g_name,
            "macro_osi": round(avg_hsi, 1),
            "macro_health": round(avg_h, 1),
            "macro_task": round(avg_t, 1),
            "macro_finance": round(avg_f, 1),
            "macro_esg": round(avg_esg, 1),
            "penalty_applied": penalty_applied,
            "min_dept_hsi": round(g["min_dept_hsi"], 1),
            "departments": g["departments"]
        })
        
        ceo_sum_osi += avg_hsi
        ceo_sum_h += avg_h
        ceo_sum_t += avg_t
        ceo_sum_f += avg_f
        ceo_count += 1
        
        if avg_hsi < min_gerencia_osi:
            min_gerencia_osi = avg_hsi
            
    # 3. Calcular Nivel 4 (Global CEO OSI)
    global_osi = 100.0
    global_h = 100.0
    global_t = 100.0
    global_f = 100.0
    ceo_penalty_applied = False
    
    if ceo_count > 0:
        global_osi = ceo_sum_osi / ceo_count
        global_h = ceo_sum_h / ceo_count
        global_t = ceo_sum_t / ceo_count
        global_f = ceo_sum_f / ceo_count
        
        # Super-Bottleneck Penalty CEO
        if min_gerencia_osi < 70:
            penalty = (70 - min_gerencia_osi) * 0.8
            global_osi -= penalty
            ceo_penalty_applied = True
            
    # Calculate comprehensive P&L statement from the active unit dataset
    real_income_raw = db.execute("SELECT SUM(e.amount) FROM expenses e JOIN household_memberships m ON e.household_id=m.household_id WHERE m.user_id=? AND e.category='income'", (user["user_id"],)).fetchone()[0]
    potential_revenue = float(real_income_raw) if real_income_raw else 1000.0
    realized_revenue = potential_revenue * (global_osi / 100.0)
    
    scale = potential_revenue / 1000.0
    
    # Direct Costs (COGS / Cash Cost)
    # Industrias Pesadas: Costo Variable (Feedstock/Insumos) + Costo Fijo (Energía Base/Operación)
    variable_cogs_base = 350.0 * scale
    fixed_cogs_base = 100.0 * scale
    
    # EII Factor (Intensidad Energética): A menor TUP/OSI, más energía se desperdicia por unidad
    eii_penalty_factor = 1.0 + (100.0 - global_osi) * 0.005
    
    variable_cogs = variable_cogs_base * (global_osi / 100.0)
    fixed_cogs = fixed_cogs_base * (2.0 - (global_f / 100.0)) * eii_penalty_factor
    cogs = variable_cogs + fixed_cogs
    
    gross_margin = realized_revenue - cogs
    
    # SG&A & Corrective Maintenance (Penalized by Task Score)
    sga = (150.0 * scale) + (100.0 - global_t) * (2.5 * scale)
    
    ebitda_val = gross_margin - sga
    ebitda_margin_pct = (ebitda_val / realized_revenue * 100.0) if realized_revenue > 0 else 0.0
    
    # D&A, Insurance & HSE Fines (Heavily penalized by Health Score AND Environmental/ESG Compliance)
    global_esg_score = sum(g["sum_esg"] for g in gerencias_map.values()) / max(1, sum(g["count"] for g in gerencias_map.values()))
    esg_penalty = max(0, (80.0 - global_esg_score) * 12.0) * scale # Massive fines if ESG < 80%
    fines_da = (100.0 * scale) + (100.0 - global_h) * (5.0 * scale) + esg_penalty
    
    ebit = ebitda_val - fines_da
    
    # Corporate Tax (27%)
    taxes = ebit * 0.27 if ebit > 0 else 0.0
    
    net_income = ebit - taxes
    
    pnl = {
        "revenue": round(realized_revenue * 1000, 1),
        "cogs": round(cogs * 1000, 1),
        "gross_margin": round(gross_margin * 1000, 1),
        "sga": round(sga * 1000, 1),
        "ebitda": round(ebitda_val * 1000, 1),
        "ebitda_margin": round(ebitda_margin_pct, 1),
        "fines_da": round(fines_da * 1000, 1),
        "ebit": round(ebit * 1000, 1),
        "taxes": round(taxes * 1000, 1),
        "net_income": round(net_income * 1000, 1)
    }
    
    return {
        "global_osi": round(global_osi, 1),
        "global_health": round(global_h, 1),
        "global_task": round(global_t, 1),
        "global_finance": round(global_f, 1),
        "global_esg": round(global_esg_score, 1),
        "ebitda_margin": round(ebitda_margin_pct, 1),
        "pnl": pnl,
        "ceo_penalty_applied": ceo_penalty_applied,
        "min_gerencia_osi": round(min_gerencia_osi, 1),
        "gerencias": sorted(gerencias_array, key=lambda x: x["macro_osi"])
    }


@router.post("/seed")
def seed_ceo(company: str = "codelco", user=Depends(get_current_user), db=Depends(get_db)):
    require_operational_feature_enabled("CEO demo seed", "VANTDOMUS_ALLOW_DEMO_SEED")
    user_id = user["user_id"]
    organization_id = ensure_user_default_organization(db, user_id, name="Demo Industrial Organization")
    db.execute("DELETE FROM households WHERE id IN (SELECT household_id FROM household_memberships WHERE user_id=?)", (user_id,))
    
    company_key = company.lower()
    if company_key == "puma":
        estructura = {
            "Gerencia Retail Estaciones": ["Estacion Santiago Norte", "Estacion Costanera", "Estacion Antofagasta Truck Center", "Estacion Concepcion Ruta"],
            "Gerencia Supply & Terminales": ["Terminal Combustibles Maipu", "Patio de Tanques Zona Centro", "Despacho Camiones Cisterna", "Control Calidad Combustible"],
            "Gerencia Flotas y Empresas": ["Cartera Empresas Norte", "Flotas Transporte Pesado", "Lubricantes Industriales", "Contratos Empresas"],
            "Gerencia Tiendas y Conveniencia": ["Tienda Santiago Norte", "Tienda Costanera", "Tienda Antofagasta", "Abastecimiento Conveniencia"],
            "Gerencia HSE y Cumplimiento": ["Prevencion Derrames", "Auditoria Surtidores", "Cumplimiento SEC", "Capacitacion Operadores"]
        }
        industry = "puma"
        failing_dept_name = "Despacho Camiones Cisterna"
        falla_alerta_titulo = "Quiebre de despacho y riesgo HSE"
        falla_alerta_msg = "Retraso critico en despacho de camiones cisterna con riesgo de desabastecimiento empresarial y eventos HSE por sobretiempo."
        client_name = "PUMA"
    elif company_key in ("technical_office", "oficina", "otv", "vantdomus"):
        estructura = {
            "Direccion de Obra": ["Frente Obra Civil", "Frente Montaje", "Avance Curva S", "Control Subcontratos"],
            "Oficina Tecnica": ["Planificador de Unidades", "Control Documental", "RDI y Libro de Obra", "Programacion y Control"],
            "Costos y Contrato": ["Gastos Generales", "HH Directas e Indirectas", "Estados de Pago", "Ordenes de Cambio"],
            "Claims y Evidencia": ["Matriz de Evidencia", "NOC y Controversias", "Licitacion vs Proyecto", "Repositorio Forense"],
            "Calidad HSE y Cumplimiento": ["Calidad y Protocolos", "HSE y Permisos", "Auditoria Contractual"]
        }
        industry = "technical_office"
        failing_dept_name = "RDI y Libro de Obra"
        falla_alerta_titulo = "RDI criticas sin cierre"
        falla_alerta_msg = "Consultas, instrucciones y documentos pendientes bloquean unidades, cobros y trazabilidad de claims."
        client_name = "Cliente"
    elif company_key in ("family", "familia", "hogar"):
        estructura = {
            "Hogar": ["Rutinas del Hogar", "Compras y Abastecimiento", "Mantenciones Casa", "Apoyo Familiar"],
            "Salud y Bienestar": ["Salud Familiar", "Medicamentos y Controles", "Actividad y Descanso"],
            "Finanzas Familiares": ["Presupuesto Mensual", "Cuentas y Vencimientos", "Ahorro y Emergencias"],
            "Educacion y Rutinas": ["Colegio y Tareas", "Calendario Familiar", "Traslados y Compromisos"],
            "Documentos Familiares": ["Contratos y Seguros", "Garantias y Boletas", "Documentos Importantes"]
        }
        industry = "family"
        failing_dept_name = "Cuentas y Vencimientos"
        falla_alerta_titulo = "Sobrecarga de vencimientos"
        falla_alerta_msg = "Pendientes financieros y rutinas vencidas elevan carga familiar y riesgo de pagos fuera de plazo."
        client_name = "Familia"
    elif company_key == "enap":
        estructura = {
            "Gerencia Corporativa de Refinerías": ["Refinería Bío Bío (ERBB)", "Refinería Aconcagua (ERA)", "Planta Cabo Negro"],
            "Gerencia Corporativa de Logística": ["Oleoductos y Poliductos SONACOL", "Terminal Marítimo Quintero", "Patio de Estanques Concón", "Terminal San Vicente"],
            "Gerencia Exploración y Producción (E&P)": ["Operaciones Magallanes", "Plataformas Costa Afuera", "Operaciones Internacionales"],
            "Gerencia de Excelencia Operacional": ["Mantenimiento Preventivo (PM)", "Inspección Técnica ITO"]
        }
        industry = "oil"
        failing_dept_name = "Oleoductos y Poliductos SONACOL"
        falla_alerta_titulo = "Fuga y Pérdida de Presión Crítica"
        falla_alerta_msg = "Desprendimiento en soldadura del Ducto Trasandino. Derrame potencial de Grado 2 detectado."
        client_name = company.upper()
    else:
        # Default: perfil minero generico.
        estructura = {
            "Gerencia de Minas": ["Mina Subterránea Diablo Regimiento", "Mina Rajo Sur", "Mina Esmeralda", "Reservas Norte", "Dacita", "Transporte Ferroviario Central"],
            "Gerencia de Plantas": ["Planta Molienda SAG", "Planta Chancado Sewell", "Flotación Convencional", "Concentradora"],
            "Gerencia de Fundición": ["Hornos de Fusión Flash", "Convertidores Pierce-Smith", "Refinería de Electrowinning"],
            "Gerencia de Mantenimiento": ["Taller Equipo Pesado LHD", "Mantenimiento Eléctrico Mina", "Ingeniería de Confiabilidad"],
            "Gerencia de Proyectos (Obras Mina)": ["Desarrollo Horizontal Norte", "Proyección Macrobloque", "Soporte y Fortificación"]
        }
        industry = "mining"
        failing_dept_name = "Planta Chancado Sewell"
        falla_alerta_titulo = "Colapso en Chancador Primario"
        falla_alerta_msg = "Vibrador superior dañado y atasco prolongado de colpas. Paralización detiene 40% del KTPD."
        client_name = company.upper()
    
    created_depts = []
    
    for g_name, depts in estructura.items():
        for d_name in depts:
            hid = str(uuid.uuid4())
            meta = {
                "mode": "team",
                "gerencia": g_name,
                "industry_preset": industry,
                "client_name": client_name,
                "monthly_budget": 500000
            }
            db.execute("INSERT INTO households (id,name,meta,created_at,organization_id) VALUES (?,?,?,?,?)",
                       (hid, d_name, json.dumps(meta), now(), organization_id))
            db.execute("INSERT INTO household_memberships (household_id,user_id,role,created_at) VALUES (?,?,?,?)",
                       (hid, user_id, "owner", now()))
                       
            p1 = str(uuid.uuid4())
            p2 = str(uuid.uuid4())
            if industry == "family":
                person1_name = f"Responsable de {d_name}"
                person2_name = f"Integrante de {d_name}"
                relation1 = "Responsable familiar"
                relation2 = "Integrante"
                routine_title = "Rutina familiar registrada"
            else:
                person1_name = f"Supervisor {d_name}"
                person2_name = f"Técnico de {d_name}"
                relation1 = "Jefatura"
                relation2 = "Terreno"
                routine_title = "Inspección de Rutina"
            db.execute("INSERT INTO persons (id,household_id,display_name,relation,created_at) VALUES (?,?,?,?,?)",
                       (p1, hid, person1_name, relation1, now()))
            db.execute("INSERT INTO persons (id,household_id,display_name,relation,created_at) VALUES (?,?,?,?,?)",
                       (p2, hid, person2_name, relation2, now()))
                       
            db.execute("INSERT INTO task_items (id,household_id,title,status,due_at,assigned_person_id,priority,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                       (str(uuid.uuid4()), hid, routine_title, "done", now(), p1, "medium", now(), now()))
            
            if industry in ("puma", "technical_office"):
                db.execute(
                    "INSERT INTO expenses (id,household_id,organization_id,amount,currency,category,merchant,expense_at,notes,person_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (str(uuid.uuid4()), hid, organization_id, 125000.0, "USD", "income", "Valor operacional / contrato", now(), f"Ingreso operacional demo {client_name}", None, now()),
                )
                db.execute(
                    "INSERT INTO expenses (id,household_id,organization_id,amount,currency,category,merchant,expense_at,notes,person_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (str(uuid.uuid4()), hid, organization_id, 32000.0, "USD", "energy", "Costos directos e indirectos", now(), f"Costo operativo demo {client_name}", None, now()),
                )
            elif industry == "family":
                db.execute(
                    "INSERT INTO expenses (id,household_id,organization_id,amount,currency,category,merchant,expense_at,notes,person_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (str(uuid.uuid4()), hid, organization_id, 2800.0, "USD", "income", "Ingreso familiar mensual", now(), "Ingreso familiar demo", None, now()),
                )
                db.execute(
                    "INSERT INTO expenses (id,household_id,organization_id,amount,currency,category,merchant,expense_at,notes,person_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (str(uuid.uuid4()), hid, organization_id, 950.0, "USD", "home", "Gastos del hogar", now(), "Gasto familiar demo", None, now()),
                )

            created_depts.append({"id": hid, "name": d_name, "gerencia": g_name})

    db.commit()
    
    # Causar cuello de botella
    failing_id = next((d["id"] for d in created_depts if d["name"] == failing_dept_name), created_depts[0]["id"])
    
    old = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    critical_task_title = "Accion Critica PUMA" if industry == "puma" else ("Accion critica de Oficina Tecnica" if industry == "technical_office" else ("Pendiente familiar critico" if industry == "family" else "Reparacion Critica"))
    health_alert_summary = "Alerta HSE por Sobrecarga Operativa" if industry == "puma" else ("Alerta por bloqueo documental" if industry == "technical_office" else ("Alerta de sobrecarga familiar" if industry == "family" else "Alerta de Fatiga Severa"))
    environmental_alert_summary = "Riesgo de Derrame en Patio de Despacho" if industry == "puma" else ("Riesgo contractual por evidencia incompleta" if industry == "technical_office" else ("Riesgo de vencimiento familiar" if industry == "family" else "Incidente Ambiental Comunitario"))
    if industry == "puma":
        falla_alerta_titulo = health_alert_summary
        falla_alerta_msg = "Despacho de camiones cisterna fuera de SLA: revisar inventario, seguridad, turnos y continuidad empresarial."
    for i in range(5):
        db.execute("INSERT INTO task_items (id,household_id,title,status,due_at,priority,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
                   (str(uuid.uuid4()), failing_id, f"{critical_task_title} {i+1}", "open", old, "high", old, old))
                   
    for i in range(5):
        db.execute("INSERT INTO events (id,household_id,domain,event_type,occurred_at,summary,payload,created_at) VALUES (?,?,?,?,?,?,?,?)",
                   (str(uuid.uuid4()), failing_id, "health", "medication_checkin", old, health_alert_summary, json.dumps({"checkin":{"status":"missed"}}), old))
                   
    # Incidente Comunitario Ambiental
    db.execute("INSERT INTO events (id,household_id,domain,event_type,occurred_at,summary,payload,created_at) VALUES (?,?,?,?,?,?,?,?)",
               (str(uuid.uuid4()), failing_id, "health", "medication_checkin", old, environmental_alert_summary, json.dumps({"checkin":{"status":"missed"}}), old))
                   
    db.commit()
    active_household_id = failing_id if industry in ("puma", "technical_office", "family") else created_depts[0]["id"]
    active_household_name = next((d["name"] for d in created_depts if d["id"] == active_household_id), created_depts[0]["name"])
    return {
        "message": f"Arquitectura fractal {industry} montada con exito.",
        "industry_preset": industry,
        "active_household_id": active_household_id,
        "active_household_name": active_household_name,
    }

@router.post("/fast_forward")
def ceo_fast_forward(days: int = 30, user=Depends(get_current_user), db=Depends(get_db)):
    require_operational_feature_enabled("CEO simulation controls", "VANTDOMUS_ALLOW_DEMO_SEED")
    """
    Time-Machine: Simula qué pasa financieramente si el Directorio ignora las alertas actuales durante N días.
    Deteriora proactivamente las puntuaciones y crea tareas vencidas masivas.
    """
    user_id = user["user_id"]
    
    # 1. Envejecer tareas existentes para que queden overdue
    db.execute("UPDATE task_items SET due_at = datetime(due_at, '-30 days') WHERE status != 'done' AND household_id IN (SELECT household_id FROM household_memberships WHERE user_id=?)", (user_id,))
    
    # 2. Agregar incidentes de Salud (Fallos, Fugas) a todos los depts
    from datetime import datetime, timedelta
    hid_res = db.execute("SELECT household_id FROM household_memberships WHERE user_id=?", (user_id,)).fetchall()
    for row in hid_res:
        hid = row[0]
        pid_res = db.execute("SELECT id FROM persons WHERE household_id=? LIMIT 1", (hid,)).fetchone()
        if pid_res:
            pid = pid_res[0]
            db.execute("INSERT INTO events (id,household_id,domain,event_type,occurred_at,summary,payload,created_at) VALUES (?,?,?,?,?,?,?,?)",
                       (str(uuid.uuid4()), hid, "health", "critical", now(), "Riesgo operacional proyectado por abandono de alertas", json.dumps({"impact_score": -40, "person_id": pid, "days": days, "source": "ceo_fast_forward"}), now()))
                       
    db.commit()
    return {"message": "El reloj avanzó 30 días. El riesgo sistémico ha devorado la utilidad."}
