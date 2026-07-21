/**
 * OPS-1 (PWA) — Cara de Domi para los iconos de la app, renderizada como PNG por
 * next/og (satori). Sin dependencias de imágenes binarias: se genera al build/
 * request. Se reutiliza en app/icon.tsx, app/apple-icon.tsx y los iconos del
 * manifest (/pwa/icon-192, /pwa/icon-512).
 */
import React from "react";

export function DomiFace({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #FDBA5A 0%, #F59E3C 55%, #E8822A 100%)",
      }}
    >
      <div
        style={{
          width: size * 0.66,
          height: size * 0.66,
          borderRadius: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 42% 34%, #FFF7E8 0%, #FFDC93 52%, #FBB84E 100%)",
        }}
      >
        <svg
          width={size * 0.42}
          height={size * 0.42}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="36" cy="44" r="7" fill="#6B4423" />
          <circle cx="64" cy="44" r="7" fill="#6B4423" />
          <path
            d="M33 60 Q50 75 67 60"
            stroke="#6B4423"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
