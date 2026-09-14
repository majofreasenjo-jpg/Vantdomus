"use client";

import { useState } from "react";

export default function InteractionProbe() {
  const [clicks, setClicks] = useState(0);
  return (
    <section style={{ maxWidth: 1120, margin: "24px auto 0", padding: "0 20px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ border: "2px solid #1f6f43", borderRadius: 20, padding: 20, background: "#f3fff7", color: "#173b29" }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Diagnóstico de interacción</div>
        <p style={{ margin: "8px 0 14px" }}>Este botón no usa memoria ni Domi. Sólo verifica que React esté hidratado y que los clics lleguen al navegador.</p>
        <button
          type="button"
          onClick={() => setClicks((value) => value + 1)}
          style={{ border: 0, borderRadius: 999, padding: "12px 18px", background: "#173b29", color: "white", fontWeight: 800, cursor: "pointer" }}
        >
          Prueba de clic
        </button>
        <span style={{ marginLeft: 14, fontSize: 18, fontWeight: 800 }} data-testid="interaction-count">Clics: {clicks}</span>
        <div style={{ marginTop: 10, fontSize: 14 }}>
          Resultado esperado: <strong>0 → 1 → 2</strong>. Si no cambia, el problema es hidratación/JavaScript. Si cambia, el problema estaba en la página principal o en el harness.
        </div>
      </div>
    </section>
  );
}
