"use client";

/**
 * DomiOrb3D — Domi en 3D real (WebGL via three.js + react-three-fiber).
 *
 * Núcleo glossy dorado con brillo aditivo (halo/bloom) y rotación suave; el
 * rostro y los chips de contexto van como overlay HTML/SVG encima del canvas
 * para mantenerlos nítidos y livianos. El color del material sale del estado
 * emocional. Pensado para el hero del Panel; en inline/compacto usamos la
 * versión CSS (DomiOrb).
 *
 * Se carga sólo en cliente (ssr:false desde DomiOrbAuto). Si WebGL falla, el
 * wrapper cae a DomiOrb (CSS).
 */

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { DomiState, DomiChip } from "./DomiOrb";

const STATE_COLORS: Record<DomiState, { core: string; glow: string }> = {
  sereno: { core: "#FFD98A", glow: "#FFCD88" },
  motivado: { core: "#FFC04D", glow: "#FFB74D" },
  atento: { core: "#AFC2FF", glow: "#7FA0FF" },
  "cariñoso": { core: "#FFCDB6", glow: "#FFBFA3" },
  protector: { core: "#CFC0FF", glow: "#B49AFF" },
  pensando: { core: "#C9C3F0", glow: "#8A7BD8" },
  logro: { core: "#A8E6C7", glow: "#2E9E6B" },
  organizando: { core: "#FFD98A", glow: "#FFCD88" },
};

const DEFAULT_CHIPS: DomiChip[] = [
  { icon: "🏠", label: "Hogar" },
  { icon: "❤️", label: "Salud" },
  { icon: "🛒", label: "Compras" },
  { icon: "✉️", label: "Mensajes" },
  { icon: "👨‍👩‍👧", label: "Familia" },
  { icon: "🛡️", label: "Seguridad" },
];

function Core({ state }: { state: DomiState }) {
  const mesh = useRef<THREE.Mesh>(null);
  const c = STATE_COLORS[state] || STATE_COLORS.sereno;
  const speed = state === "pensando" ? 0.012 : state === "organizando" ? 0.009 : 0.0035;
  useFrame(() => {
    if (mesh.current) mesh.current.rotation.y += speed;
  });
  return (
    <group>
      {/* Halo / bloom aditivo */}
      <mesh scale={1.42}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial color={c.glow} transparent opacity={0.16} blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {/* Núcleo glossy */}
      <mesh ref={mesh}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhysicalMaterial
          color={c.core}
          emissive={new THREE.Color(c.glow)}
          emissiveIntensity={0.45}
          metalness={0.25}
          roughness={0.16}
          clearcoat={1}
          clearcoatRoughness={0.18}
        />
      </mesh>
    </group>
  );
}

export default function DomiOrb3D({
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
  const list = (chips ?? DEFAULT_CHIPS).slice(0, 6);
  const radius = size * 0.62;
  const c = STATE_COLORS[state] || STATE_COLORS.sereno;

  return (
    <div
      className="domiOrb3d"
      style={{ position: "relative", width: size, height: size, flex: "0 0 auto" }}
      role="img"
      aria-label={label || `Domi, asistente del hogar (${state})`}
    >
      <Canvas
        camera={{ position: [0, 0, 3.1], fov: 42 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        style={{ position: "absolute", inset: 0 }}
      >
        <ambientLight intensity={0.65} />
        <directionalLight position={[3, 4, 5]} intensity={1.3} />
        <pointLight position={[-3, -2, 2]} intensity={0.7} color={c.glow} />
        <Core state={state} />
      </Canvas>

      {/* Rostro (overlay nítido, no rota) */}
      <svg viewBox="0 0 100 64" width={size * 0.34} height={size * 0.22}
        style={{ position: "absolute", left: "50%", top: "47%", transform: "translate(-50%,-50%)", zIndex: 3, pointerEvents: "none" }}>
        <path d="M22 30 Q30 20 38 30" fill="none" stroke="#6b3f12" strokeWidth={6} strokeLinecap="round" />
        <path d="M62 30 Q70 20 78 30" fill="none" stroke="#6b3f12" strokeWidth={6} strokeLinecap="round" />
      </svg>

      {/* Chips de contexto (overlay) */}
      {list.map((chip, i) => {
        const angle = (-90 + i * (360 / list.length)) * (Math.PI / 180);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <span
            key={chip.label}
            className={`domiChip${chip.active ? " active" : ""}`}
            title={chip.label}
            aria-hidden="true"
            style={{
              position: "absolute", zIndex: 4, transform: "translate(-50%,-50%)",
              left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`,
              width: size * 0.22, height: size * 0.22, minWidth: 22, minHeight: 22,
              borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: size * 0.11, background: "var(--card,#fff)",
              border: `1px solid ${chip.active ? "#E8A23C" : "var(--line,#e5ddcf)"}`,
              boxShadow: chip.active ? "0 0 0 3px rgba(255,205,136,.45), 0 4px 14px rgba(120,95,60,.28)" : "0 3px 10px rgba(120,95,60,.18)",
            }}
          >{chip.icon}</span>
        );
      })}

      {state === "protector" ? (
        <span aria-hidden="true" style={{ position: "absolute", bottom: "-2%", right: "-2%", fontSize: size * 0.22, zIndex: 5, filter: "drop-shadow(0 2px 4px rgba(0,0,0,.25))" }}>🛡️</span>
      ) : null}
    </div>
  );
}
