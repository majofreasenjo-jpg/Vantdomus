/**
 * domiIntents — interpretación LOCAL por reglas (sin LLM, sin red).
 *
 * Convierte lo que la persona dice/escribe en: una frase de Domi, un estado y
 * tarjetas dinámicas. Las acciones sensibles (salud, medicamentos, seguridad,
 * finanzas) se marcan `sensitive` → requieren confirmación humana.
 *
 * CP1: base mínima. Se ampliará en CP3/CP4 y se podrá conectar al orquestador
 * IA real más adelante (mismo contrato de salida).
 */
import type { DomiState } from "../app/components/DomiCore";
import type { ModuleKey } from "../app/components/domiIcons";

export type DomiAction = { label: string; send: string };
export type DomiCard =
  | { kind: "domi"; text: string }
  | { kind: "summary"; title: string; lines: string[] }
  | { kind: "suggestions"; items: { label: string; send: string }[] }
  | { kind: "proposal"; title: string; text: string; lines?: string[]; confirmLabel?: string; sensitive?: boolean }
  | { kind: "breathing"; title: string }
  | { kind: "music"; title: string }
  | { kind: "info"; title: string; text: string }
  // Tarjeta de acción premium (propuesta de Domi por categoría)
  | { kind: "action"; cat: string; color: string; icon: ModuleKey; kicker: string; title: string; text: string; primary: DomiAction; secondary?: DomiAction };

export type DomiResult = { speech: string; state: DomiState; cards: DomiCard[] };
export type DomiCtx = { summary?: { title: string; lines: string[] }; userName?: string; cards?: DomiCard[] };

const PHARMACY = /paracetamol|ibuprofeno|remedio|medicament|pastilla|jarabe|vitamina|aspirina|amoxicilina|losart|antibi/i;

function parseItems(s: string): string[] {
  return s
    .replace(/^.*?(agrega|añade|anota|agregar|compra|comprar|pon|poné|necesito|falta|faltan)\b/i, "")
    .replace(/\ba\s+(compras|la lista|supermercado|farmacia)\b/gi, "")
    .split(/,| y | e /i)
    .map((x) => x.trim().replace(/[.!]+$/, ""))
    .filter((x) => x.length > 1 && x.length < 40);
}

export function interpret(raw: string, ctx: DomiCtx = {}): DomiResult {
  const t = raw.trim().toLowerCase();
  if (!t) return { speech: "Te escucho.", state: "escuchando", cards: [] };

  // Saludo
  if (/^(hola|hey|buenos|buenas|qué tal|que tal)\b/.test(t)) {
    return { speech: `Hola${ctx.userName ? `, ${ctx.userName}` : ""}. Me alegra acompañarte. ¿Qué necesita tu hogar hoy?`, state: "cercano", cards: [] };
  }

  // Resumen / ordenar el día / pendientes
  if (/(qué falta|que falta|qué hay|que hay|resumen|ordenar mi día|ordenar mi dia|pendiente|mi día|mi dia|hoy)/.test(t)) {
    if (ctx.cards?.length) return { speech: "Esto es lo importante en tu hogar hoy.", state: "atento", cards: ctx.cards };
    const s = ctx.summary;
    return {
      speech: "Esto es lo que veo en tu hogar hoy.",
      state: "atento",
      cards: [s ? { kind: "summary", title: s.title, lines: s.lines } : { kind: "domi", text: "Por ahora está todo tranquilo en casa." }],
    };
  }

  // Compras
  if (/(agrega|añade|anota|agregar|compra|comprar|falta|faltan|necesito)\b/.test(t) && !/estudio|prueba|documento|receta/.test(t)) {
    const items = parseItems(raw);
    if (items.length) {
      const farm = items.filter((i) => PHARMACY.test(i));
      const sup = items.filter((i) => !PHARMACY.test(i));
      const lines: string[] = [];
      if (sup.length) lines.push(`Supermercado: ${sup.join(", ")}`);
      if (farm.length) lines.push(`Farmacia: ${farm.join(", ")}`);
      return {
        speech: "Puedo agregar esto a tu lista de compras. ¿Lo confirmas?",
        state: "esperando_confirmacion",
        cards: [{ kind: "proposal", title: "Agregar a compras", text: "Domi clasificó tus productos:", lines, confirmLabel: "Confirmar lista" }],
      };
    }
  }

  // Medicamento (sensible)
  if (/medicament|medicina|remedio|toma|losart|pastilla/.test(t)) {
    return {
      speech: "Te ayudo con el recordatorio, pero la toma la confirma una persona.",
      state: "protector",
      cards: [{
        kind: "proposal", sensitive: true, title: "Recordatorio de medicamento",
        text: "Puedo recordar la toma y avisar a quien cuida. La confirmación de la toma siempre la hace una persona.",
        confirmLabel: "Preparar recordatorio",
      }],
    };
  }

  // Música / calma
  if (/música|musica|canción|cancion|relaj|tranquil|calma/.test(t)) {
    return { speech: "Puedo poner un sonido tranquilo para acompañarte.", state: "sereno", cards: [{ kind: "music", title: "Sonido tranquilo" }] };
  }
  // Respiración
  if (/respir|respira/.test(t)) {
    return { speech: "Respiremos juntos un minuto. Sigue el círculo.", state: "sereno", cards: [{ kind: "breathing", title: "Respiración de 1 minuto" }] };
  }

  // Documento
  if (/documento|receta|boleta|circular|cuenta|sub(e|í|ir)/.test(t)) {
    return {
      speech: "Puedo revisar un documento y proponerte qué hacer con él.",
      state: "atento",
      cards: [{ kind: "info", title: "Subir documento", text: "Toca el clip de la barra para subir una receta, boleta o circular. Si detecto un medicamento, quedará pendiente de confirmación humana." }],
    };
  }

  // Estudio
  if (/estudio|prueba|tarea|materia|temario/.test(t)) {
    return {
      speech: "Puedo preparar un plan de estudio. ¿Lo armo?",
      state: "esperando_confirmacion",
      cards: [{ kind: "proposal", title: "Preparar estudio", text: "Puedo crear un plan por bloques y preparar un paquete para revisar. ¿Quieres que lo arme?", confirmLabel: "Preparar plan" }],
    };
  }

  // Ayuda
  if (/ayuda|auxilio|emergencia|me siento mal|necesito ayuda/.test(t)) {
    return {
      speech: "Estoy contigo. Puedo avisar a tu familia.",
      state: "protector",
      cards: [{ kind: "proposal", sensitive: true, title: "Avisar a la familia", text: "Puedo enviar un aviso a quienes te cuidan. ¿Confirmas?", confirmLabel: "Avisar a la familia" }],
    };
  }

  // Por defecto
  return {
    speech: "Puedo ayudarte con las compras, la salud, los documentos, el estudio o un resumen del hogar. ¿Qué necesitas?",
    state: "atento",
    cards: [],
  };
}
