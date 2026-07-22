"use client";

// OPS-2 M5 — Selector del MODO de Domi (un solo Domi, configuraciones de
// interacción). Al cambiar, guarda el modo (cookie via server action) y recarga
// el layout, que aplica data-mode en el body (Senior = accesibilidad real).
import { setDomiModeAction } from "../login/actions";

const MODES: { value: string; label: string }[] = [
  { value: "clasico", label: "Clásico" },
  { value: "calma", label: "Calma" },
  { value: "senior", label: "Senior" },
  { value: "estudio", label: "Estudio" },
  { value: "protector", label: "Protector" },
  { value: "noche", label: "Noche" },
];

export default function ModeSwitcher({ current }: { current: string }) {
  return (
    <form action={setDomiModeAction} title="Modo de Domi">
      <select
        name="mode"
        defaultValue={current}
        aria-label="Modo de Domi"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8 }}
      >
        {MODES.map((m) => (
          <option key={m.value} value={m.value}>Modo: {m.label}</option>
        ))}
      </select>
    </form>
  );
}
