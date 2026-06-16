import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Mismo diccionario que en Backend/Vercel
export const INDUSTRY_PRESETS_UI: Record<string, any> = {
  default: { unit: "Unidad VantUnit", persons: "Personal", tasks: "Operaciones", health: "Seguridad/Fatiga", finance: "Presupuesto", esg: "Sostenibilidad", theme: { primary: "#5b7cfa", bg: "#0b0f17" }, kpi: { osi: "Operational Stability Index (OSI)", health: "Safety Score", tasks: "Task Score", finance: "Budget Execution" }, kpi_sub: { osi: "Machine Learning Risk Analysis", health: "missed meds vs total", tasks: "done vs overdue", finance: "spend 30d vs budget" }, macro_kpis: {"capacity": "Utilización de Capacidad", "intensity": "Intensidad de Uso", "uptime": "Uptime Operativo", "opex": "Eficiencia de OPEX", "productivity": "Productividad General"} },
  technical_office: { unit: "Unidad Tecnica", persons: "Equipo Oficina Tecnica", tasks: "Programa / RDI / Entregables", health: "Riesgo / Calidad / HSE", finance: "GG / HH / Costos", esg: "Cumplimiento / Auditoria", theme: { primary: "#f59e0b", bg: "#0b1020" }, kpi: { osi: "Continuidad del Plan de Unidades", health: "Calidad, Riesgo y HSE", tasks: "Hitos, RDI y Entregables", finance: "Costo Recuperable / Presupuesto" }, kpi_sub: { osi: "unidades en obra vs promesa", health: "incidentes y no conformidades", tasks: "programa, RDI, libro de obra", finance: "GG, HH, APU y adicionales" }, macro_kpis: {"capacity": "Unidades en Obra", "intensity": "Carga Contractual", "uptime": "Documentos Aprobados", "opex": "Costo Indirecto", "productivity": "HH Productivas"} },
  mining: { unit: "Faena Minera", persons: "Cuadrilla Minera", tasks: "Obras/Mantenimientos", health: "Fatiga Industrial", finance: "CAPEX/OPEX", esg: "Sostenibilidad y Reporte (ESG)", theme: { primary: "#d97706", bg: "#1f140b" }, kpi: { osi: "Tasa Global de Extracción (KTPD)", health: "Accidentabilidad (LTIFR)", tasks: "Avance Físico del Proyecto", finance: "Cash Cost Directo (C1)" }, kpi_sub: { osi: "Ley de Mineral Cu / REC %", health: "Tasa Gravedad y Somnolencia", tasks: "Desarrollo Mina / Conf. PM", finance: "Costo Neto C3 / Desv. Presupuesto" }, macro_kpis: {"capacity": "Rendimiento (Throughput)", "intensity": "Desgaste de Activos", "uptime": "Disponibilidad Física", "opex": "Cash Cost Directo (C1)", "productivity": "Tonelaje Movido / HH"} },
  oil: { unit: "Instalación", persons: "Operarios de Planta", tasks: "Mantenimiento / Paros", health: "Integridad Operacional", finance: "Márgenes y Costos", esg: "Gestión Ambiental (ESG)", theme: { primary: "#2980b9", bg: "#0d1b2a" }, kpi: { osi: "Tasa de Utilización de Procesos", health: "Disponibilidad de Planta", tasks: "Cumplimiento Paros de Planta", finance: "Costo de Operación Corriente" }, kpi_sub: { osi: "Volumen Procesado (kbpd) / Rendimiento", health: "Cero Fugas / Cero Incidentes HSE", tasks: "Inspecciones ITO / Avance Inversión", finance: "Margen de Refinación (Crack Spread)" }, macro_kpis: {"capacity": "Tasa Utilización Procesos (TUP)", "intensity": "Intensidad Energética (EII)", "uptime": "Disponibilidad Operativa", "opex": "Costos OPEX (Non Energy)", "productivity": "Productividad Laboral"} },
  construction: { unit: "Obra Constructora", persons: "Cuadrilla de Obra", tasks: "Avance Físico", health: "Seguridad/Fatiga", finance: "Presupuesto", theme: { primary: "#f59e0b", bg: "#1a160b" }, kpi: { osi: "Execution Performance", health: "Fatiga", tasks: "tareas hito", finance: "gasto a la fecha" }, kpi_sub: { osi: "curva S", health: "Cero Accidentes", tasks: "Hitos Certificados", finance: "Valor Ganado (EVM)" }, macro_kpis: {"capacity": "Avance Físico del Proyecto", "intensity": "Desgaste de Maquinaria", "uptime": "Tiempo Efectivo de Obra", "opex": "Costo por M2 Avanzado", "productivity": "Rendimiento Cuadrillas"} },
  healthcare: { unit: "Clínica / Hospital", persons: "Personal Médico", tasks: "Fichas/Turnos", health: "Bienestar de Pacientes", finance: "Insumos Clínicos", theme: { primary: "#0ea5e9", bg: "#07121a" }, kpi: { osi: "Índice Resolutivo Clínico", health: "eventos adversos", tasks: "tratamientos", finance: "costo material" }, macro_kpis: {"capacity": "Tasa de Ocupación Quirófanos", "intensity": "Carga de Estrés Médico", "uptime": "Disponibilidad Pacientes", "opex": "Eficiencia de Insumos Clínicos", "productivity": "Atención Diaria por Turno"} },
  family: { unit: "Nucleo Familiar", persons: "Integrantes Familia", tasks: "Rutinas / Compromisos", health: "Bienestar / Salud", finance: "Presupuesto Mensual", esg: "Documentos Familiares", theme: { primary: "#10b981", bg: "#061710" }, kpi: { osi: "Estabilidad Familiar", health: "Bienestar y Salud", tasks: "Rutinas Cumplidas", finance: "Presupuesto Mensual" }, macro_kpis: {"capacity": "Cumplimiento de Rutinas", "intensity": "Carga Familiar", "uptime": "Tiempo de Calidad", "opex": "Eficiencia de Gasto", "productivity": "Compromisos Resueltos"} },
  corporate: { unit: "Departamento", persons: "Colaboradores", tasks: "Iniciativas (CAPEX)", health: "Tensión Adaptativa", finance: "Ejecución OPEX", theme: { primary: "#3b82f6", bg: "#0f172a" }, kpi: { osi: "Objetivos Estratégicos", health: "fugas/tensión", tasks: "hitos ok", finance: "burn rate" }, macro_kpis: {"capacity": "Cumplimiento de OKRs", "intensity": "Burnout / Tensión Adaptativa", "uptime": "Continuidad Operacional", "opex": "Eficiencia de Presupuesto", "productivity": "Hitos Alcanzados"} }
};

interface TaxonomyContextType {
    presetKey: string;
    tax: any;
    setTaxonomy: (preset: string) => void;
}

const TaxonomyContext = createContext<TaxonomyContextType>({
    presetKey: "default",
    tax: INDUSTRY_PRESETS_UI["default"],
    setTaxonomy: () => { }
});

export const TaxonomyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [presetKey, setPresetKey] = useState("default");

    const setTaxonomy = async (preset: string) => {
        const validPreset = INDUSTRY_PRESETS_UI[preset] ? preset : "default";
        setPresetKey(validPreset);
        await AsyncStorage.setItem("@vantunit_taxonomy", validPreset);
    };

    useEffect(() => {
        (async () => {
            const saved = await AsyncStorage.getItem("@vantunit_taxonomy");
            if (saved && INDUSTRY_PRESETS_UI[saved]) {
                setPresetKey(saved);
            }
        })();
    }, []);

    return (
        <TaxonomyContext.Provider value={{ presetKey, tax: INDUSTRY_PRESETS_UI[presetKey], setTaxonomy }}>
            {children}
        </TaxonomyContext.Provider>
    );
};

export const useTaxonomy = () => useContext(TaxonomyContext);
