"""
Diccionario Central de Taxonomía B2B - VantUnit
Define los presets lingüísticos que mutarán la UI y el Prompt del LLM según la industria seleccionada.
"""

INDUSTRY_PRESETS = {
    "default": {
        "name": "General (VantUnit)",
        "unit": "Unidad",
        "persons": "Personal",
        "tasks": "Operaciones",
        "finance": "Insumos",
        "health": "Fatiga Industrial",
        "ai_role": "Supervisor Algorítmico",
        "theme": {"primary": "#d97706", "bg": "#1f140b"},
        "macro_kpis": {"capacity": "Utilización de Capacidad", "intensity": "Intensidad de Uso", "uptime": "Uptime Operativo", "opex": "Eficiencia de OPEX", "productivity": "Productividad General"}
    },
    "family": {
        "name": "Hogar / Familia (B2C)",
        "unit": "Hogar",
        "persons": "Familia",
        "tasks": "Rutinas / Compromisos",
        "finance": "Presupuesto Mensual",
        "health": "Salud Familiar",
        "ai_role": "a friendly AI smart home assistant managing family tasks and wellness",
        "theme": {"primary": "#5b7cfa", "bg": "#0b0f17"},
        "macro_kpis": {"capacity": "Cumplimiento de Rutinas", "intensity": "Desgaste Familiar", "uptime": "Tiempo de Calidad", "opex": "Eficiencia de Gasto", "productivity": "Tareas Completadas"}
    },
    "technical_office": {
        "name": "Oficina Tecnica Virtual",
        "unit": "Unidad Tecnica",
        "persons": "Equipo Oficina Tecnica",
        "tasks": "Programa / RDI / Entregables",
        "finance": "GG / HH / Costos",
        "health": "Riesgo / Calidad / HSE",
        "ai_role": "an AI technical office controller managing unit planning, RDI, documents, contracts, costs, claims and executive evidence",
        "theme": {"primary": "#f59e0b", "bg": "#0b1020"},
        "macro_kpis": {"capacity": "Unidades en Obra", "intensity": "Carga Contractual", "uptime": "Documentos Aprobados", "opex": "Costo Indirecto", "productivity": "HH Productivas"}
    },
    "mining": {
        "name": "Minería Subterránea",
        "unit": "Faena Minera",
        "persons": "Cuadrilla Minera",
        "tasks": "Mantenimientos / Tronaduras",
        "finance": "Insumos y Repuestos",
        "health": "Fatiga y Riesgo Vital",
        "ai_role": "an AI operational analyst managing a high-risk underground mining shift with focus on fatigue, safety protocols, and heavy machinery maintenance",
        "theme": {"primary": "#facc15", "bg": "#1f140b"},
        "macro_kpis": {"capacity": "Rendimiento (Throughput)", "intensity": "Desgaste de Activos", "uptime": "Disponibilidad Física", "opex": "Cash Cost Directo (C1)", "productivity": "Tonelaje Movido / HH"}
    },
    "oil": {
        "name": "Refinería / Oil & Gas",
        "unit": "Instalación",
        "persons": "Operarios de Planta",
        "tasks": "Mantenimiento / Paros",
        "finance": "Márgenes y Costos",
        "health": "Integridad Operacional",
        "ai_role": "an AI refinery manager optimizing Solomon KPIs, minimizing downtime, and preventing environmental incidents",
        "theme": {"primary": "#2980b9", "bg": "#0d1b2a"},
        "macro_kpis": {"capacity": "Tasa Utilización Procesos (TUP)", "intensity": "Intensidad Energética (EII)", "uptime": "Disponibilidad Operativa", "opex": "Costos OPEX (Non Energy)", "productivity": "Productividad Laboral"}
    },
    "construction": {
        "name": "Construcción / Obra Civil",
        "unit": "Obra",
        "persons": "Operarios",
        "tasks": "Avances de Obra",
        "finance": "Materiales y Arriendos",
        "health": "Accidentabilidad",
        "ai_role": "an AI smart foreman managing a large civil construction site with focus on contractor coordination, logistics flow, and fall prevention",
        "macro_kpis": {"capacity": "Avance Físico del Proyecto", "intensity": "Desgaste de Maquinaria", "uptime": "Tiempo Efectivo de Obra", "opex": "Costo por M2 Avanzado", "productivity": "Rendimiento Cuadrillas"}
    },
    "health": {
        "name": "Salud / Clínica",
        "unit": "Piso Clínico",
        "persons": "Personal Médico",
        "tasks": "Protocolos Clínicos",
        "finance": "Suministros Médicos",
        "health": "Carga de Estrés / Triage",
        "ai_role": "an AI medical floor coordinator managing a hospital shift with focus on minimizing nurse burnout, patient triage, and clinical protocol adherence",
        "macro_kpis": {"capacity": "Tasa de Ocupación Hospitalaria", "intensity": "Carga de Estrés Médico", "uptime": "Disponibilidad de Pabellones", "opex": "Eficiencia de Insumos", "productivity": "Pacientes Atendidos por Turno"}
    },
    "corporate": {
        "name": "Dirección / Corporativo",
        "unit": "Departamento",
        "persons": "Colaboradores",
        "tasks": "Iniciativas (CAPEX)",
        "finance": "Ejecución OPEX",
        "health": "Tensión Adaptativa",
        "ai_role": "an AI Corporate Operations Advisor managing a business department with focus on OKR performance, OPEX efficiency, and mitigating team burnout / adaptive tension",
        "theme": {"primary": "#3b82f6", "bg": "#0f172a"},
        "macro_kpis": {"capacity": "Cumplimiento de OKRs", "intensity": "Burnout / Tensión Adaptativa", "uptime": "Continuidad Operacional", "opex": "Eficiencia de Presupuesto", "productivity": "Hitos Alcanzados"}
    }
}

def get_taxonomy(preset_key: str) -> dict:
    """Retorna el diccionario de taxonomía adecuado o el default si no existe."""
    return INDUSTRY_PRESETS.get(preset_key, INDUSTRY_PRESETS["default"])
