"use client";

/**
 * DomiOrbAuto — elige la mejor representación de Domi disponible:
 *  - Si hay asset Lottie registrado para el estado (lib/domiAssets) → DomiLottie
 *    (look "render", Opción B).
 *  - Si no → DomiOrb (CSS, siempre funciona).
 * Así, en cuanto se dejen los .json en public/assistant/domi/ y se registren,
 * Domi pasa al look render sin tocar las pantallas.
 */

import DomiOrb, { DomiState, DomiChip } from "./DomiOrb";
import DomiLottie from "./DomiLottie";
import { domiLottieSrc } from "../../lib/domiAssets";

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
