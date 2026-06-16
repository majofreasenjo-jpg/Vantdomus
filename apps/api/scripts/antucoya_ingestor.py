import sqlite3
import uuid
import json
from datetime import datetime, timezone

DB_PATH = "D:/Aplicaciones de Juegos/VantDomus/vantdomus_core/vantdomus.db"

def now():
    return datetime.now(timezone.utc).isoformat()

def inject_antucoya():
    print("Iniciando Ingestor Garvic - Proyecto Antucoya P-4267...")
    print("1. Procesando variables Macro basadas en ECO-01 (Monto Total = 8.536 M$)")
    
    # Supuestos basados en la discrepancia de Dotacion (37% perdida de HH)
    # y los Gastos Generales vs Cláusula 10% de PUMA:
    avance_gantt_osi = 88.0 # Faltan 12% para terminar
    health_hsec = 96.0 # Buena seguridad, Cero Fatalidades
    eficiencia_hh_task = 32.0 # Pésima eficiencia debido al desbalance de histogramas (TEC-05)
    
    # Financial metrics base (M$ format expected scaled up x1000 by CEO route)
    # The CEO route does math based on global_osi / 100 * rev etc.
    # We rely on the core's dynamic compute feature. The CEO route recalculates
    # it IF we don't supply `pnl` in state... Wait, CEO route has hardcoded PNL math!
    # Yes, lines 173-199 in ceo.py do: realized_revenue = 2959.4, etc.
    
    # For now, we will simulate the ingestion by inserting tasks and finance lines.
    
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    
    # Reset
    cur.execute("DELETE FROM households")
    cur.execute("DELETE FROM household_memberships")
    cur.execute("DELETE FROM persons")
    cur.execute("DELETE FROM task_items")
    cur.execute("DELETE FROM alerts")
    cur.execute("DELETE FROM expenses")
    cur.execute("DELETE FROM features_daily")
    
    h_id = str(uuid.uuid4())
    household_name = "Minera Antucoya - Proyecto P-4267 (Garvic SpA)"
    
    meta_dict = {
        "industry_preset": "epc", 
        "gerencia": "Proyectos & Montaje",
        "override_scores": {
            "osi": avance_gantt_osi,
            "health": health_hsec,
            "tasks": eficiencia_hh_task,
            "finance": 81.0,
            "esg": 100.0
        }
    }
    meta = json.dumps(meta_dict)
    
    cur.execute("INSERT INTO households (id, name, created_at, meta) VALUES (?,?,?,?)",
                (h_id, household_name, now(), meta))
    
    # Admin / Demo User links
    users = cur.execute("SELECT id FROM users").fetchall()
    demo_user_id = "0f1e1d24-57b3-40b8-98c1-bc83f3cfd69c"
    
    for u in users:
        cur.execute("INSERT INTO household_memberships (user_id, household_id, role, created_at) VALUES (?,?,?,?)",
                    (u["id"], h_id, "owner", now()))
    
    cur.execute("INSERT OR IGNORE INTO household_memberships (user_id, household_id, role, created_at) VALUES (?,?,?,?)",
                (demo_user_id, h_id, "owner", now()))
                
    # Insert Persona
    p_id = str(uuid.uuid4())
    cur.execute("INSERT INTO persons (id, household_id, display_name, relation, created_at) VALUES (?,?,?,?,?)",
                (p_id, h_id, "Jefatura de Obra", "Administrador B2B", now()))
                
    # Insert anomalies as Alerts
    # 1. Dotacion Mismatch
    cur.execute("INSERT INTO alerts (id, household_id, severity, title, message, status, created_at) VALUES (?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), h_id, "high", "Alerta Histograma TEC-05", 
                 "Fuga detectada de 37% de HH por aplanamiento de matriz en ECO-05 Costo Personal Directo.", "open", now()))
                 
    # 2. Clausula PUMA
    cur.execute("INSERT INTO alerts (id, household_id, severity, title, message, status, created_at) VALUES (?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), h_id, "high", "Riesgo Margen EBITDA (Clausula PUMA)", 
                 "El sobrecosto actual de subcontratos es del 6%, no superando el umbral contractual del 10% para renegociar Suma Alzada.", "open", now()))

    # Insert Task / Finance metrics to drive the score
    # We want Task Score near 32
    cur.execute("INSERT INTO task_items (id, household_id, assigned_person_id, title, status, created_at, updated_at, due_at) VALUES (?,?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), h_id, p_id, "Rendimiento Obras Civiles (Desviacion Costo 8.5M$)", "overdue", now(), now(), now()))
    cur.execute("INSERT INTO task_items (id, household_id, assigned_person_id, title, status, created_at, updated_at, due_at) VALUES (?,?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), h_id, p_id, "Aprobacion ITO", "done", now(), now(), now()))
                
    # Registrar el Ingreso Emitido (M$) para impactar el Dashboard B2B
    monto_total_oferta = 8536.7
    cur.execute("INSERT INTO expenses (id, household_id, amount, currency, category, notes, expense_at, created_at) VALUES (?,?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), h_id, monto_total_oferta, "CLP", "income", "Oferta Económica Total (ECO-01)", now(), now()))
                
    con.commit()
    print("Estructura Causal B2B inyectada satisfactoriamente con los hallazgos documentales EPC.")
    
if __name__ == "__main__":
    inject_antucoya()
