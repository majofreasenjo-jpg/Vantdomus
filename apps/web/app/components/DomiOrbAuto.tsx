"use client";

/**
 * DomiOrbAuto — elige Domi 3D (WebGL) o Domi CSS según el entorno.
 *
 * Usa la versión 3D (DomiOrb3D) cuando: hay WebGL, no hay prefers-reduced-motion
 * y el tamaño es suficiente (hero). Si algo de eso no se cumple, cae a DomiOrb
 * (CSS) — que siempre funciona. El 3D se carga sólo en cliente (ssr:false).
 */

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import DomiOrb, { DomiState, DomiChip } from "./DomiOrb";

const DomiOrb3D = dynamic(() => import("./DomiOrb3D"), { ssr: false });

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

export default function DomiOrbAuto(props: {
  state?: DomiState;
  size?: number;
  chips?: DomiChip[];
  label?: string;
}) {
  const size = props.size ?? 150;
  const [use3d, setUse3d] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const bigEnough = size >= 110;
    // Reloj inteligente / pantallas diminutas: nada de 3D (perf + tamaño).
    const screenOk = window.innerWidth >= 360;
    setUse3d(bigEnough && screenOk && !reduce && canUseWebGL());
  }, [size]);

  if (use3d) {
    return <DomiOrb3D state={props.state} size={size} chips={props.chips} label={props.label} />;
  }
  // Fallback CSS (también es lo que se renderiza en SSR / primer paint).
  return <DomiOrb state={props.state} size={size} chips={props.chips} label={props.label} />;
}
