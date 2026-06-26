"use client";

/**
 * DomiOrbAuto — elige la mejor representación de Domi disponible:
 *  - Si hay asset Lottie registrado para el estado (lib/domiAssets) → DomiLottie
 *    (look "render", Opción B).
 *  - Si no → DomiOrb (CSS, siempre funciona).
 * Así, en cuanto se dejen los .json en public/assistant/domi/ y se registren,
 * Domi pasa al look render sin tocar las pantallas.
 */

import dynamic from "next/dynamic";
import DomiOrb, { DomiState, DomiChip } from "./DomiOrb";
import { domiLottieSrc } from "../../lib/domiAssets";

// Cargar el player Lottie solo cuando realmente exista un asset (evita arrastrar
// lottie-react al grafo de la página cuando el manifiesto está vacío).
const DomiLottie = dynamic(() => import("./DomiLottie"), { ssr: false });

export default function DomiOrbAuto({
  state = "sereno",
  size = 150,
  chips,
  label,
}: {
  state?: DomiState;
  size?: number;
  chips?: DomiChip[];
  label?: string;
}) {
  const src = domiLottieSrc(state);
  if (src) return <DomiLottie src={src} state={state} size={size} label={label} />;
  return <DomiOrb state={state} size={size} chips={chips} label={label} />;
}
