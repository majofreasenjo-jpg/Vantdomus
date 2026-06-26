"use client";

/**
 * DomiLottie — reproduce la animación Lottie de Domi (Opción B, look "render").
 * Carga el JSON de `src`; si falla o no existe, cae a DomiOrb (CSS). El player
 * se importa sólo en cliente (ssr:false).
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import DomiOrb, { DomiState } from "./DomiOrb";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export default function DomiLottie({
  src,
  state = "sereno",
  size = 150,
  label,
}: {
  src: string;
  state?: DomiState;
  size?: number;
  label?: string;
}) {
  const [data, setData] = useState<any | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(src)
      .then((r) => { if (!r.ok) throw new Error("no asset"); return r.json(); })
      .then((j) => { if (alive) setData(j); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [src]);

  // Sin asset / error / aún cargando → CSS (nunca pantalla vacía).
  if (failed || !data) return <DomiOrb state={state} size={size} showChips label={label} />;

  return (
    <div style={{ width: size, height: size, flex: "0 0 auto" }} role="img" aria-label={label || `Domi (${state})`}>
      <Lottie animationData={data} loop autoplay style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
