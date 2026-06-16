import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Catálogo de presets por industria. Cada uno define el lenguaje, los KPIs
 * y los micro-labels que se muestran en pantalla. Cuando el household tiene
 * `meta.industry_preset` en la BD, el DashboardScreen inyecta el preset y
 * todo el app cambia de vocabulario.
 *
 * Para el modo familia se incluye `family_mode: true` y un mapa `viewLabels`
 * con copy familiar (no B2B). Cada screen lee `tax.family_mode` para elegir
 * tono: si es true, usa "Tu asistente familiar", "Tomé mi pastilla", etc;
 * si es false, usa el copy operacional default.
 */
export const INDUSTRY_PRESETS_UI: Record<string, any> = {
  default: {
    unit: "Unidad VantUnit",
    persons: "Personal",
    tasks: "Operaciones",
    health: "Seguridad/Fatiga",
    finance: "Presupuesto",
    esg: "Sostenibilidad",
    family_mode: false,
    theme: { primary: "#5b7cfa", bg: "#0b0f17" },
    kpi: {
      osi: "Operational Stability Index (OSI)",
      health: "Safety Score",
      tasks: "Task Score",
      finance: "Budget Execution",
    },
    kpi_sub: {
      osi: "Machine Learning Risk Analysis",
      health: "missed meds vs total",
      tasks: "done vs overdue",
      finance: "spend 30d vs budget",
    },
    macro_kpis: {
      capacity: "Utilización de Capacidad",
      intensity: "Intensidad de Uso",
      uptime: "Uptime Operativo",
      opex: "Eficiencia de OPEX",
      productivity: "Productividad General",
    },
    viewLabels: {
      dashboard_title: "Dashboard",
      health_card: "Protocolos Operativos",
      health_checkin: "Control en Terreno",
      health_log: "Historial de Novedades",
      health_taken: "Seguro / OK",
      health_missed: "Riesgo / Fallo",
      tasks_create: "Crear",
      tasks_list: "Listado",
      tasks_done_btn: "Done",
      chat_title: "Centro de Comando",
      chat_subtitle: "Escribe comandos a tu supervisor robótico.",
      chat_input_placeholder: "Orden operativa para",
      chat_welcome: "Hola. Soy VantDomus. Pregúntame por el estado del hogar, alertas, tareas o salud.",
    },
  },
  technical_office: {
    unit: "Unidad Tecnica",
    persons: "Equipo Oficina Tecnica",
    tasks: "Programa / RDI / Entregables",
    health: "Riesgo / Calidad / HSE",
    finance: "GG / HH / Costos",
    esg: "Cumplimiento / Auditoria",
    family_mode: false,
    theme: { primary: "#f59e0b", bg: "#0b1020" },
    kpi: {
      osi: "Continuidad del Plan de Unidades",
      health: "Calidad, Riesgo y HSE",
      tasks: "Hitos, RDI y Entregables",
      finance: "Costo Recuperable / Presupuesto",
    },
    kpi_sub: {
      osi: "unidades en obra vs promesa",
      health: "incidentes y no conformidades",
      tasks: "programa, RDI, libro de obra",
      finance: "GG, HH, APU y adicionales",
    },
    macro_kpis: {
      capacity: "Unidades en Obra",
      intensity: "Carga Contractual",
      uptime: "Documentos Aprobados",
      opex: "Costo Indirecto",
      productivity: "HH Productivas",
    },
  },
  mining: {
    unit: "Faena Minera",
    persons: "Cuadrilla Minera",
    tasks: "Obras/Mantenimientos",
    health: "Fatiga Industrial",
    finance: "CAPEX/OPEX",
    esg: "Sostenibilidad y Reporte (ESG)",
    family_mode: false,
    theme: { primary: "#d97706", bg: "#1f140b" },
    kpi: {
      osi: "Tasa Global de Extracción (KTPD)",
      health: "Accidentabilidad (LTIFR)",
      tasks: "Avance Físico del Proyecto",
      finance: "Cash Cost Directo (C1)",
    },
  },
  oil: {
    unit: "Instalación",
    persons: "Operarios de Planta",
    tasks: "Mantenimiento / Paros",
    health: "Integridad Operacional",
    finance: "Márgenes y Costos",
    esg: "Gestión Ambiental (ESG)",
    family_mode: false,
    theme: { primary: "#2980b9", bg: "#0d1b2a" },
  },
  construction: {
    unit: "Obra Constructora",
    persons: "Cuadrilla de Obra",
    tasks: "Avance Físico",
    health: "Seguridad/Fatiga",
    finance: "Presupuesto",
    family_mode: false,
    theme: { primary: "#f59e0b", bg: "#1a160b" },
  },
  healthcare: {
    unit: "Clínica / Hospital",
    persons: "Personal Médico",
    tasks: "Fichas/Turnos",
    health: "Bienestar de Pacientes",
    finance: "Insumos Clínicos",
    family_mode: false,
    theme: { primary: "#0ea5e9", bg: "#07121a" },
  },
  // ========================================================================
  // FAMILIA — preset enriquecido con family_mode + viewLabels específicos.
  // Este es el preset PRIMARIO del producto post-pivote a familia. Toda copy
  // debajo está calibrada para una familia (no para una operación minera).
  // ========================================================================
  family: {
    unit: "Tu Hogar",
    persons: "Integrantes",
    tasks: "Agenda y Tareas",
    health: "Salud y Medicamentos",
    finance: "Presupuesto",
    esg: "Documentos del Hogar",
    family_mode: true,
    theme: { primary: "#10b981", bg: "#061710" },
    kpi: {
      osi: "Estabilidad Familiar",
      health: "Bienestar y Salud",
      tasks: "Rutinas Cumplidas",
      finance: "Presupuesto del Mes",
    },
    kpi_sub: {
      osi: "Cómo va tu hogar esta semana",
      health: "Medicamentos al día y citas próximas",
      tasks: "Hecho vs pendiente",
      finance: "Gasto del mes vs lo que destinaste",
    },
    macro_kpis: {
      capacity: "Cumplimiento de Rutinas",
      intensity: "Carga Familiar",
      uptime: "Tiempo de Calidad",
      opex: "Eficiencia de Gasto",
      productivity: "Compromisos Resueltos",
    },
    viewLabels: {
      dashboard_title: "Tu hogar",
      health_card: "Medicamentos y controles",
      health_checkin_title: "¿Cómo va con la pastilla?",
      health_checkin: "Registro de pastillas",
      health_log: "Historial",
      health_taken: "✓ Tomé mi pastilla",
      health_missed: "Lo olvidé esta vez",
      health_plan_btn: "Configurar plan",
      health_input_placeholder: "Medicamento (ej. Losartán 50mg)",
      tasks_create: "Crear una tarea",
      tasks_list: "Lo que toca",
      tasks_done_btn: "Marcar como hecho",
      tasks_empty: "Todo bajo control 🌱 — sin pendientes por ahora.",
      chat_title: "Tu asistente familiar",
      chat_subtitle: "Pregúntame por la rutina, recordatorios o cualquier ayuda.",
      chat_input_placeholder: "¿En qué te ayudo hoy?",
      chat_welcome: "Hola 👋 Soy tu asistente VantDomus. Estoy al tanto de la familia, medicamentos, agenda escolar y gastos. Probá preguntarme: \"¿cómo va Elena con sus pastillas?\" o \"¿qué tiene Diego esta semana?\".",
    },
  },
  corporate: {
    unit: "Departamento",
    persons: "Colaboradores",
    tasks: "Iniciativas (CAPEX)",
    health: "Tensión Adaptativa",
    finance: "Ejecución OPEX",
    family_mode: false,
    theme: { primary: "#3b82f6", bg: "#0f172a" },
  },
};

interface TaxonomyContextType {
  presetKey: string;
  tax: any;
  setTaxonomy: (preset: string) => void;
}

const TaxonomyContext = createContext<TaxonomyContextType>({
  presetKey: "default",
  tax: INDUSTRY_PRESETS_UI["default"],
  setTaxonomy: () => {},
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

/**
 * Helper: obtiene una viewLabel del preset actual, con fallback a default.
 * Permite que las screens hagan `vl("chat_welcome")` y obtengan el copy
 * correcto sin tener que verificar `family_mode` ellas mismas.
 */
export function getViewLabel(tax: any, key: string, fallback: string = ""): string {
  return tax?.viewLabels?.[key] ?? INDUSTRY_PRESETS_UI.default.viewLabels?.[key] ?? fallback;
}
