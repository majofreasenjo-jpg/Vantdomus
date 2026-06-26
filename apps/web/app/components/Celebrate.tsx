"use client";

/**
 * Celebrate — pequeño momento de celebración de Domi.
 *
 * Las server actions de "completar" (actividad hecha, compra comprada, aviso
 * resuelto) dejan una cookie efímera `vd_celebrate`. Al montar, este componente
 * la detecta, lanza un confetti CSS liviano (~1.4s) y borra la cookie. Respeta
 * prefers-reduced-motion (no anima). Patrón Skylight/Finch: refuerzo positivo.
 */

import { useEffect, useState } from "react";

const COLORS = ["#4A7A6B", "#C2703D", "#5B7DA6", "#B08A2E", "#A85765", "#3E8E96"];

export default function Celebrate() {
  const [pieces, setPieces] = useState<number[]>([]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const has = document.cookie.split("; ").some((c) => c.startsWith("vd_celebrate="));
    if (!has) return;
    // Consumir la cookie inmediatamente para que no repita.
    document.cookie = "vd_celebrate=; path=/; max-age=0";
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) return;
    setPieces(Array.from({ length: 28 }, (_, i) => i));
    const t = setTimeout(() => setPieces([]), 1600);
    return () => clearTimeout(t);
  }, []);

  if (pieces.length === 0) return null;

  return (
    <div className="celebrateLayer" aria-hidden="true">
      {pieces.map((i) => {
        const left = Math.round((i * 37) % 100);
        const delay = (i % 7) * 40;
        const dur = 1100 + (i % 5) * 130;
        const color = COLORS[i % COLORS.length];
        const rot = (i * 53) % 360;
        return (
          <span
            key={i}
            className="confettiPiece"
            style={{
              left: `${left}%`,
              background: color,
              animationDuration: `${dur}ms`,
              animationDelay: `${delay}ms`,
              transform: `rotate(${rot}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}
