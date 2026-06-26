/**
 * Manifiesto de assets Lottie de Domi (Opción B).
 *
 * Mapea cada estado emocional a su archivo de animación en
 * `public/assistant/domi/`. MIENTRAS ESTÉ VACÍO, Domi usa la versión CSS
 * (DomiOrb) automáticamente. Para activar el look "render", deja los .json
 * (Lottie) en esa carpeta y registra la ruta aquí. Ejemplo:
 *
 *   export const DOMI_LOTTIE = {
 *     sereno:    "/assistant/domi/sereno.json",
 *     atento:    "/assistant/domi/atento.json",
 *     pensando:  "/assistant/domi/pensando.json",
 *     cariñoso:  "/assistant/domi/carinoso.json",
 *     protector: "/assistant/domi/protector.json",
 *     logro:     "/assistant/domi/logro.json",
 *   };
 *
 * No hace falta un archivo por estado: si falta uno, cae al de "sereno" y, si
 * tampoco existe, a la versión CSS.
 */
import type { DomiState } from "../app/components/DomiOrb";

export const DOMI_LOTTIE: Partial<Record<DomiState, string>> = {
  // (vacío: sin assets aún → Domi usa CSS)
};

export function domiLottieSrc(state: DomiState): string | null {
  return DOMI_LOTTIE[state] || DOMI_LOTTIE["sereno"] || null;
}
