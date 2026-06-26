"use client";

/**
 * DomiCoreImage — usa la IMAGEN del render de Domi como núcleo, si existe.
 *
 * Intenta `/assistant/domi/<estado>.png` y luego `/assistant/domi/domi.png`.
 * Si ninguna existe (404 / error de carga), se oculta y queda el núcleo CSS
 * (la constelación sigue funcionando sin imagen). Así, en cuanto dejes el PNG
 * de tu render en esa carpeta, Domi se ve IDÉNTICO a tu infografía — sin tocar
 * código. Los chips de módulo + órbitas + halo siguen alrededor.
 */
import { useState } from "react";
import type { DomiState } from "./DomiOrb";

export default function DomiCoreImage({ state }: { state: DomiState }) {
  const candidates = [`/assistant/domi/${state}.png`, `/assistant/domi/domi.png`];
  const [idx, setIdx] = useState(0);
  if (idx >= candidates.length) return null; // ninguna imagen: queda el núcleo CSS
  return (
    <img
      className="domiCimg"
      src={candidates[idx]}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
