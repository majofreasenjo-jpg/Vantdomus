/**
 * domiTypes — port literal de src/types.ts del prototipo aprobado de Google
 * AI Studio (CP1b). Tipos + tokens canónicos de los 10 estados de Domi.
 */
export interface ShoppingItem {
  id: string;
  name: string;
  checked: boolean;
  qty: string;
  category: string;
}

export interface StudyBlock {
  id: string;
  time: string;
  subject: string;
  duration: string;
}

/**
 * CP1c-FUNC-MIN-3.1a — Propuesta del orquestador propose-first (backend real).
 * Domi propone; el humano confirma o rechaza. Nunca se ejecuta sola.
 */
export interface DomiProposal {
  id: string;
  tool_name: string;
  category: string;
  title: string;
  summary: string;
  status: string; // pending | executed | rejected | failed
  sensitive: boolean;
  /** Args propuestos (ej. items de compras) — para reflejar en la UI al confirmar. */
  proposed_payload?: { items?: string[] } & Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model" | "system";
  content: string;
  timestamp: Date;
  actionType?: string;
  /** MIN-3.1a: propuestas reales adjuntas a la respuesta de Domi. */
  proposals?: DomiProposal[];
  /** MIN-3.1a: true si la respuesta vino del simulador local (demo), no del backend. */
  isLocalDemo?: boolean;
}

export interface HomeNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: "care" | "study" | "shopping" | "security" | "system";
}

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: string;
}

export type DomiState =
  | "listo"
  | "escuchando"
  | "pensando"
  | "proponiendo"
  | "esperando_confirmacion"
  | "protector"
  | "calma"
  | "cercano"
  | "alegre"
  | "descanso";

export interface AppState {
  medicineConfirmed: boolean;
  medicineLogs: { time: string; confirmedBy: string }[];
  studyPrepared: boolean;
  studyBlocks: StudyBlock[];
  shoppingItems: ShoppingItem[];
  breathingActive: boolean;
  breathingCycle: "inhale" | "hold" | "exhale" | "idle";
  breathingProgress: number; // 0 to 60 seconds
  ambientMode: string;
  temperature: string;
  time: string;
  messages: ChatMessage[];
  isListening: boolean;
  isSending: boolean;
  activeTab: "inicio" | "hoy" | "documentos" | "mas";
  notifications: HomeNotification[];
  familyMembers: FamilyMember[];
  showFamilyModal: boolean;
  showCareModal: boolean;
  showStudyModal: boolean;
  showShoppingModal: boolean;
  showDailySummaryModal: boolean;
}

export const domiStateTokens: Record<DomiState, {
  label: string;
  microcopy: string;
  description: string;
  primary: string;
  glow: string;
  accent: string;
  face: "happy" | "speaking" | "thinking" | "peaceful" | "serious" | "attentive" | "sleepy" | "joyful";
  animation: "breathe" | "pulse_fast" | "slow_orbits" | "float" | "shield" | "calm_breathe" | "sparkles" | "low_glow";
  dockMode: "standard" | "high_glow" | "subtle" | "tint_blue" | "tint_teal" | "tint_amber" | "tint_violet" | "tint_rose" | "tint_gold";
  cardAccent: "none" | "salud" | "compras" | "estudio" | "bienestar" | "mensajes";
}> = {
  listo: {
    label: "Domi listo",
    microcopy: "Estoy contigo.",
    description: "Puedes hablarme, subir un documento o pedirme que organice tu día.",
    primary: "#F8B84E",
    glow: "#FFE8A8",
    accent: "#D9901F",
    face: "happy",
    animation: "breathe",
    dockMode: "standard",
    cardAccent: "none",
  },
  escuchando: {
    label: "Escuchando",
    microcopy: "Te escucho.",
    description: "Te escucho. Cuéntame qué necesitas.",
    primary: "#22D3EE",
    glow: "#A7F3F8",
    accent: "#F8B84E",
    face: "attentive",
    animation: "pulse_fast",
    dockMode: "high_glow",
    cardAccent: "none",
  },
  pensando: {
    label: "Pensando",
    microcopy: "Estoy ordenando la información.",
    description: "Estoy ordenando la información para ayudarte.",
    primary: "#6478FF",
    glow: "#C7D2FE",
    accent: "#8B5CF6",
    face: "thinking",
    animation: "slow_orbits",
    dockMode: "subtle",
    cardAccent: "none",
  },
  proponiendo: {
    label: "Propuesta lista",
    microcopy: "Te propongo esto.",
    description: "Preparé una sugerencia para revisar contigo.",
    primary: "#14B8A6",
    glow: "#99F6E4",
    accent: "#0F766E",
    face: "happy",
    animation: "float",
    dockMode: "standard",
    cardAccent: "compras",
  },
  esperando_confirmacion: {
    label: "Confirmar",
    microcopy: "Esto necesita confirmación humana.",
    description: "Algunas acciones importantes necesitan confirmación humana.",
    primary: "#F59E0B",
    glow: "#FDE68A",
    accent: "#B45309",
    face: "serious",
    animation: "pulse_fast",
    dockMode: "tint_amber",
    cardAccent: "salud",
  },
  protector: {
    label: "Protector",
    microcopy: "Cuido lo importante.",
    description: "Estoy cuidando lo importante del hogar.",
    primary: "#8B5CF6",
    glow: "#DDD6FE",
    accent: "#4C1D95",
    face: "attentive",
    animation: "shield",
    dockMode: "tint_violet",
    cardAccent: "none",
  },
  calma: {
    label: "Calma",
    microcopy: "Respiremos juntos.",
    description: "Respiremos juntos por un momento.",
    primary: "#A78BFA",
    glow: "#EDE9FE",
    accent: "#7DD3FC",
    face: "sleepy",
    animation: "calm_breathe",
    dockMode: "tint_blue",
    cardAccent: "bienestar",
  },
  cercano: {
    label: "Cercano",
    microcopy: "Estoy aquí contigo.",
    description: "Estoy aquí para acompañarte.",
    primary: "#FB7185",
    glow: "#FFE4E6",
    accent: "#FDA4AF",
    face: "peaceful",
    animation: "sparkles",
    dockMode: "tint_rose",
    cardAccent: "none",
  },
  alegre: {
    label: "Hecho",
    microcopy: "Lo logramos.",
    description: "Lo hicimos juntos.",
    primary: "#FACC15",
    glow: "#FEF3C7",
    accent: "#FDBA74",
    face: "joyful",
    animation: "sparkles",
    dockMode: "tint_gold",
    cardAccent: "none",
  },
  descanso: {
    label: "Noche tranquila",
    microcopy: "Estoy aquí mientras descansas.",
    description: "Te acompaño en una noche tranquila.",
    primary: "#1E3A8A",
    glow: "#F8D88A",
    accent: "#818CF8",
    face: "sleepy",
    animation: "low_glow",
    dockMode: "subtle",
    cardAccent: "none",
  },
};
