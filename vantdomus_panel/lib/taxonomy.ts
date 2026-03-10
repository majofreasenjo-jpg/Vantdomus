// lib/taxonomy.ts
import { API_BASE } from "./api";
const ACCESS_TOKEN = process.env.NEXT_PUBLIC_ACCESS_TOKEN || "";

export const updateTaxonomySetting = async (hid: string, industry_preset: string) => {
    const res = await fetch(`${API_BASE}/households/${encodeURIComponent(hid)}/settings/taxonomy`, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ industry_preset }),
        cache: "no-store",
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Error saving taxonomy: ${res.statusText} ${txt}`);
    }
    return res.json();
};

// Mapeos rápidos estáticos para evitar latencia de server-side fetching constante
// El sistema es 100% extensible, puedes añadir N presets (Ej: "Logística", "Agro", "Colegios") en el futuro.
export const INDUSTRY_PRESETS_UI: Record<string, any> = {
    "default": { unit: "Unidad", persons: "Personal", tasks: "Operaciones", finance: "Presupuesto" },
    "family": { unit: "Hogar", persons: "Familia", tasks: "Quehaceres", finance: "Gastos" },
    "mining": { unit: "Mina", persons: "Cuadrilla Minera", tasks: "Mantenimientos", finance: "Insumos" },
    "construction": { unit: "Obra", persons: "Operarios", tasks: "Avance de Obra", finance: "Materiales" },
    "healthcare": { unit: "Piso Clínico", persons: "Personal Médico", tasks: "Protocolos Clínicos", finance: "Suministros" }
};
