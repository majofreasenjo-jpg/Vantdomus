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
        "finance": "Presupuesto",
        "health": "Bienestar",
        "ai_role": "an AI operational analyst managing a team"
    },
    "family": {
        "name": "Hogar / Familia (B2C)",
        "unit": "Hogar",
        "persons": "Familia",
        "tasks": "Quehaceres",
        "finance": "Gastos Comunes",
        "health": "Salud Familiar",
        "ai_role": "a friendly AI smart home assistant managing family tasks and wellness"
    },
    "mining": {
        "name": "Minería Subterránea",
        "unit": "Mina / Faena",
        "persons": "Cuadrilla Minera",
        "tasks": "Mantenimientos / Tronaduras",
        "finance": "Insumos y Repuestos",
        "health": "Fatiga y Riesgo Vital",
        "ai_role": "an AI operational analyst managing a high-risk underground mining shift with focus on fatigue, safety protocols, and heavy machinery maintenance"
    },
    "construction": {
        "name": "Construcción / Obra Civil",
        "unit": "Obra",
        "persons": "Operarios",
        "tasks": "Avances de Obra",
        "finance": "Materiales y Arriendos",
        "health": "Accidentabilidad",
        "ai_role": "an AI smart foreman managing a large civil construction site with focus on contractor coordination, logistics flow, and fall prevention"
    },
    "healthcare": {
        "name": "Salud / Clínica",
        "unit": "Piso Clínico",
        "persons": "Personal Médico",
        "tasks": "Protocolos Clínicos",
        "finance": "Suministros Médicos",
        "health": "Carga de Estrés / Triage",
        "ai_role": "an AI medical floor coordinator managing a hospital shift with focus on minimizing nurse burnout, patient triage, and clinical protocol adherence"
    }
}

def get_taxonomy(preset_key: str) -> dict:
    """Retorna el diccionario de taxonomía adecuado o el default si no existe."""
    return INDUSTRY_PRESETS.get(preset_key, INDUSTRY_PRESETS["default"])
