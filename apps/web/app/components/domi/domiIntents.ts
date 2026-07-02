/**
 * domiIntents — motor LOCAL de respuestas de Domi (CP1b Google Visual Port).
 *
 * El prototipo de AI Studio enviaba el chat a un server Express + Gemini
 * (fetch "/api/chat"). Ese backend NO se porta (regla del port): este módulo
 * genera la respuesta por REGLAS locales, sin red y sin IA externa, manteniendo
 * el mismo contrato { text, action } que consumía sendMessageToDomi.
 *
 * Guarda canónica: las acciones sensibles (medicamentos/salud) NUNCA se
 * auto-ejecutan desde el chat — Domi propone y una persona confirma.
 */
import type { ShoppingItem } from "./domiTypes";

export type DomiActionType =
  | "CONFIRM_MEDICATION"
  | "PREPARE_STUDY"
  | "ADD_SHOPPING_ITEM"
  | "TOGGLE_SHOPPING_ITEM"
  | "BREATHE"
  | "CHANGE_AMBIENT"
  | "NONE";

export interface DomiReply {
  text: string;
  action: { type: DomiActionType; payload?: string };
}

export interface DomiIntentContext {
  medicineConfirmed: boolean;
  studyPrepared: boolean;
  shoppingItems: ShoppingItem[];
  ambientMode: string;
  temperature: string;
  time: string;
}

const PRODUCT_WORDS = /\b(leche|pan|huevos?|arroz|frutas?|verduras?|manzanas?|paracetamol|detergente|az[uú]car|caf[eé]|t[eé]|queso|jam[oó]n|yogur|galletas?|aceite|fideos|tallarines)\b/gi;

export function generateDomiReply(rawText: string, ctx: DomiIntentContext): DomiReply {
  const text = rawText.trim().toLowerCase();

  // — Calma / respiración —
  if (/respira|calma|relaj|ansiedad|estres|estrés/.test(text)) {
    return {
      text: "Claro. Iniciemos una respiración guiada de un minuto: inhala cuando el círculo crezca y exhala cuando baje. Estoy contigo.",
      action: { type: "BREATHE" },
    };
  }

  // — Medicamentos / salud: proponer, NUNCA auto-confirmar (canon) —
  if (/medicin|medicament|remedio|pastilla|metformina|tom[oó]/.test(text)) {
    if (ctx.medicineConfirmed) {
      return {
        text: "La toma de Elena de hoy ya quedó confirmada por la familia. Todo en orden y registrado. 💛",
        action: { type: "NONE" },
      };
    }
    return {
      text: "La toma de Elena de las 21:00 sigue pendiente. Puedo recordarla y dejar todo listo, pero la confirmación la hace una persona: revisa la tarjeta de Cuidado y confírmala ahí.",
      action: { type: "NONE" },
    };
  }

  // — Estudio —
  if (/estudi|matem[aá]t|prueba|tarea|diego|repas/.test(text)) {
    if (ctx.studyPrepared) {
      return {
        text: "El plan de estudio de Diego ya está preparado: bloques de 45 minutos con descansos. Puedes verlo en la tarjeta de Estudio.",
        action: { type: "NONE" },
      };
    }
    return {
      text: "Preparé un plan de repaso para la prueba de matemáticas de Diego: tres bloques de 45 minutos con pausas. Lo dejo listo en la tarjeta de Estudio.",
      action: { type: "PREPARE_STUDY" },
    };
  }

  // — Compras: detectar productos concretos —
  const products = rawText.match(PRODUCT_WORDS);
  if (/compra|lista|falta|agrega|añade|supermercado|feria/.test(text) || products) {
    if (products && products.length > 0) {
      const first = products[0];
      const extra = products.length > 1 ? ` También anoté: ${products.slice(1).join(", ")}.` : "";
      return {
        text: `Listo, agregué ${first} a la lista de compras.${extra} Puedes revisarla en la tarjeta de Compras.`,
        action: { type: "ADD_SHOPPING_ITEM", payload: first[0].toUpperCase() + first.slice(1) },
      };
    }
    const pending = ctx.shoppingItems.filter((i) => !i.checked).length;
    return {
      text: `Hay ${pending} producto${pending === 1 ? "" : "s"} por organizar en la lista. Dime qué agregar (por ejemplo: "agrega leche y pan") y lo anoto.`,
      action: { type: "NONE" },
    };
  }

  // — Seguridad / protección —
  if (/proteg|seguridad|puerta|cerrar|alarma|c[aá]mara/.test(text)) {
    return {
      text: "El hogar está protegido: puertas cerradas y sensores activos. Cualquier cambio importante te lo aviso y lo confirmas tú.",
      action: { type: "NONE" },
    };
  }

  // — Ambiente —
  if (/ambiente|luz|luces|temperatura|noche tranquila|m[uú]sica/.test(text)) {
    return {
      text: `Ajusté el ambiente a "Noche tranquila" (${ctx.temperature}). Si prefieres otro modo, dímelo.`,
      action: { type: "CHANGE_AMBIENT", payload: "Noche tranquila" },
    };
  }

  // — Resumen del día —
  if (/resumen|d[ií]a|hoy|pendiente|qu[eé] hay|que hay|qu[eé] falta|que falta/.test(text)) {
    const pending = ctx.shoppingItems.filter((i) => !i.checked).length;
    const med = ctx.medicineConfirmed ? "la toma de Elena ya está confirmada" : "la toma de Elena de las 21:00 sigue pendiente (la confirma una persona)";
    const study = ctx.studyPrepared ? "el estudio de Diego está preparado" : "la prueba de Diego necesita un plan de repaso";
    return {
      text: `Hoy en tu hogar: ${med}, ${study} y hay ${pending} producto${pending === 1 ? "" : "s"} por organizar en compras. ¿Por dónde partimos?`,
      action: { type: "NONE" },
    };
  }

  // — Saludo —
  if (/^(hola|buenas|buenos|hey|qu[eé] tal)/.test(text)) {
    return {
      text: "Hola 💛 Me alegra acompañarte. Puedo ayudarte con el cuidado de Elena, el estudio de Diego, las compras o un momento de calma. ¿Qué necesitas?",
      action: { type: "NONE" },
    };
  }

  // — Por defecto —
  return {
    text: "Estoy contigo. Puedo ayudarte con el cuidado, el estudio, las compras, la calma o un resumen del día. Cuéntame qué necesitas.",
    action: { type: "NONE" },
  };
}
