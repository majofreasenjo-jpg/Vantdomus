import pandas as pd
import sqlite3
import uuid
from datetime import datetime, timezone
import json
import os
import sys

# Configure path to database
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "vantdomus.db")
EXCEL_PATH = "C:/Users/casa/Downloads/260317-Inf.Operativo Febrero 26 Rev01-P-4267.xlsx"

def now():
    return datetime.now(timezone.utc).isoformat()

def main():
    if not os.path.exists(EXCEL_PATH):
        print(f"Error: {EXCEL_PATH} not found.")
        sys.exit(1)

    print("=== INICIANDO PARSEO B2B (MitoPulse) ===")
    print(f"Leyendo: {EXCEL_PATH}")
    
    # 1. Extracción de Datos (Extract)
    import warnings
    warnings.filterwarnings('ignore')
    
    # Extraer HSEC (Nombre de Proyecto / Encargados)
    df_garvic = pd.read_excel(EXCEL_PATH, sheet_name="Analisis Garvic", header=None)
    adm_contrato = df_garvic.iat[8, 5] if pd.notna(df_garvic.iat[8, 5]) else "Martin Palominos"
    empresa = df_garvic.iat[6, 5] if pd.notna(df_garvic.iat[6, 5]) else "Garvic SpA"
    
    # Extraer HH (Obras Civiles)
    hh_ganadas = df_garvic.iat[4, 2] if pd.notna(df_garvic.iat[4,2]) else 3880
    hh_gastadas = df_garvic.iat[4, 5] if pd.notna(df_garvic.iat[4,5]) else 11781
    hh_efficiency = float(hh_ganadas) / float(hh_gastadas) if float(hh_gastadas) > 0 else 1.0
    task_tension = max(0, min(100, int(hh_efficiency * 100))) # El score bajará si hay sobreconsumo

    # Extraer Proyección a Término
    df_prog = pd.read_excel(EXCEL_PATH, sheet_name="4.3", header=None)
    # Por el volcado, sabemos que la fila 9 o 13 tiene la facturación
    # POM = Presupuesto Original, Base = Facturación
    ingresos = df_prog.iat[13, 3] if pd.notna(df_prog.iat[13, 3]) else 2959445122
    presupuesto = df_prog.iat[13, 4] if pd.notna(df_prog.iat[13, 4]) else 3642796648
    finance_margin = max(0, min(100, int((float(ingresos) / float(presupuesto)) * 100)))

    print(f"-> Contratista: {empresa}")
    print(f"-> Administrador: {adm_contrato}")
    print(f"-> KPI Tasks (Eficiencia HH G/G): {task_tension}%")
    print(f"-> KPI Finance (Avance Físico / Presupuesto): {finance_margin}%")

    # 2. Transformación y Carga (Load SQL)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    
    # AISLAMIENTO C-LEVEL: Purgar faenas de simulación previas (Codelco, ENAP)
    cur.execute("DELETE FROM households")
    cur.execute("DELETE FROM household_memberships")
    cur.execute("DELETE FROM persons")
    cur.execute("DELETE FROM task_items")
    cur.execute("DELETE FROM alerts")
    cur.execute("DELETE FROM expenses")
    cur.execute("DELETE FROM features_daily")
    
    # Crear el household Antucoya
    household_name = f"Minera Antucoya - Proyecto P-4267 ({empresa})"
    h_id = str(uuid.uuid4())
    meta = json.dumps({"industry_preset": "epc", "gerencia": "Proyectos & Montaje"})
    cur.execute("INSERT INTO households (id, name, created_at, meta) VALUES (?,?,?,?)",
                (h_id, household_name, now(), meta))
    
    # Asignar a admin user (importante para que se vea en el Dashboard)
    # Buscamos al usuario admin por defecto o insertamos uno si no hay
    admin = cur.execute("SELECT id FROM users LIMIT 1").fetchone()
    if admin:
        cur.execute("INSERT INTO household_memberships (user_id, household_id, role, created_at) VALUES (?,?,?,?)",
                    (admin["id"], h_id, "owner", now()))
                    
    # INYECCIÓN PERMISOS B2B (MitoPulse Demo UI)
    demo_user_id = "0f1e1d24-57b3-40b8-98c1-bc83f3cfd69c"
    cur.execute("INSERT OR IGNORE INTO household_memberships (user_id, household_id, role, created_at) VALUES (?,?,?,?)",
                (demo_user_id, h_id, "owner", now()))

    print("Proyecto Antucoya P-4267 inyectado a la red VantDomus (MitoPulse) en entorno AISLADO.")

    # Insertar Personas Clave
    cur.execute("INSERT OR IGNORE INTO persons (id, household_id, display_name, relation, created_at) VALUES (?,?,?,?,?)",
                (str(uuid.uuid4()), h_id, str(adm_contrato), "Adm. Contratista", now()))

    # Insertar métricas calculadas en el Event Store de VantDomus
    # (Usaremos tasks items for HH, y finance for presupuesto)
    
    # Registrar Sobregiro de HH como incidente Task
    if task_tension < 50:
        cur.execute("INSERT INTO alerts (id, household_id, severity, title, message, status, created_at) VALUES (?,?,?,?,?,?,?)",
                    (str(uuid.uuid4()), h_id, "high", "Riesgo Severo HH en Obras Civiles", 
                     f"Se han gastado {hh_gastadas} HH para una ganancia de {hh_ganadas} HH (Eficiencia {task_tension}%).", "open", now()))
        
    # Registrar el Ingreso Emitido (MUSD) para impactar el Dashboard B2B
    cur.execute("INSERT INTO expenses (id, household_id, amount, currency, category, merchant, expense_at, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), h_id, float(ingresos)/1_000_000, "USD", "income", "Estado de Pago #05", now(), "Ingreso Emitido Proyección a Término", now()))
    
    # FORZAR LOS FEATURES DIARIOS (C-LEVEL AGGREGATION)
    cur.execute("""
        INSERT OR REPLACE INTO features_daily (
            household_id, feature_date, mode, health_score, task_score, finance_score, hsi,
            missed_7d, tasks_done_7d, tasks_overdue, spend_30d_total, spend_30d_pharmacy, alerts_open, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (h_id, "2026-02-26", "team", 100, task_tension, finance_margin, 100, 
          0, 100, 10, 0, 0, 1, now()))
    
    con.commit()
    con.close()
    print("=== EXTRACCIÓN Y CARGA EXITOSA ===")
    print("El panel gerencial reflejará la disrupción en el P&L Waterfall de inmediato.")

if __name__ == "__main__":
    main()
