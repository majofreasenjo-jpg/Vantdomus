"use client";

import { useEffect, useMemo, useState } from "react";
// @ts-ignore deterministic helper
import {
  createP5MobileToDesktopReturnReceipt,
  consumeP5MobileToDesktopReturnReceipt,
} from "../../lib/domiP5MobileToDesktopReturn.mjs";
// @ts-ignore transport envelope
import {
  createCrossDeviceTransportEnvelope,
  encodeCrossDeviceTransportEnvelope,
  decodeCrossDeviceTransportEnvelope,
} from "../../lib/domiP5CrossDeviceTransport.mjs";
// @ts-ignore field access helper
import { buildAuthorizedBrowserReturnHandoffUrl } from "../../lib/domiP5CrossDeviceFieldAccess.mjs";

function nowIso() {
  return new Date().toISOString();
}

export default function OwnerAlphaCrossDeviceReturnHarness() {
  const [deviceLabel, setDeviceLabel] = useState("detectando...");
  const [mode, setMode] = useState<"SOURCE" | "DESTINATION">("SOURCE");
  const [link, setLink] = useState("");
  const [envelope, setEnvelope] = useState<any | null>(null);
  const [receipt, setReceipt] = useState<any | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [lastError, setLastError] = useState("ninguno");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDeviceLabel(`${navigator.platform || "platform?"} · ${window.innerWidth}x${window.innerHeight}`);
    const match = window.location.hash.match(/^#handoff=(.+)$/);
    if (!match) return;
    try {
      const decoded = decodeCrossDeviceTransportEnvelope(match[1]);
      setEnvelope(decoded);
      setReceipt(decoded.receipt);
      setMode("DESTINATION");
      setLastError("ninguno");
    } catch (error: any) {
      setMode("DESTINATION");
      setLastError(error?.message || String(error));
    }
  }, []);

  const createReturn = () => {
    try {
      const baseTime = new Date(Date.now() - 30_000).toISOString();
      const createdAt = nowIso();
      const created = createP5MobileToDesktopReturnReceipt({ baseTime, now: createdAt });
      const wrapped = createCrossDeviceTransportEnvelope({ receipt: created.receipt, fixtureBaseTime: baseTime });
      const encoded = encodeCrossDeviceTransportEnvelope(wrapped);
      const returnUrl = buildAuthorizedBrowserReturnHandoffUrl({
        currentUrl: window.location.href,
        encodedEnvelope: encoded,
      });
      setReceipt(created.receipt);
      setEnvelope(wrapped);
      setLink(returnUrl);
      setCopied(false);
      setLastError("ninguno");
    } catch (error: any) {
      setLastError(error?.message || String(error));
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setLastError("ninguno");
    } catch (error: any) {
      setLastError(error?.message || String(error));
    }
  };

  const shareLink = async () => {
    if (!link || !navigator.share) return;
    try {
      await navigator.share({
        title: "Domi P5 retorno móvil → PC",
        text: "Abrir este receipt sintético en el computador destino.",
        url: link,
      });
      setLastError("ninguno");
    } catch (error: any) {
      if (error?.name !== "AbortError") setLastError(error?.message || String(error));
    }
  };

  const consumeOnDesktop = () => {
    if (!envelope || !receipt) return;
    try {
      const consumed = consumeP5MobileToDesktopReturnReceipt({
        baseTime: envelope.fixtureBaseTime,
        receipt,
        now: nowIso(),
      });
      setResult(consumed);
      setLastError("ninguno");
    } catch (error: any) {
      setResult(null);
      setLastError(error?.message || String(error));
    }
  };

  const expectedDesktop = useMemo(() => Boolean(result?.expectedMemoriesRecovered), [result]);
  const card: React.CSSProperties = { border: "1px solid #d8d0c4", background: "#fff", borderRadius: 18, padding: 18 };

  return (
    <main style={{ minHeight: "100vh", background: "#f5f1e8", color: "#28231e", padding: "26px 14px 60px", fontFamily: "Inter,system-ui,sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <section style={{ ...card, boxShadow: "0 18px 50px rgba(60,50,40,.08)" }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".08em", color: "#7c5d20" }}>P5 · PHYSICAL RETURN · SYNTHETIC ONLY</div>
          <h1 style={{ margin: "7px 0 6px", fontSize: 28 }}>Receipt de teléfono físico → computador</h1>
          <p style={{ margin: 0, color: "#655b50", lineHeight: 1.55 }}>
            El retorno transporta sólo un SessionContinuationReceipt sintético. No transporta memoria cruda, transcripción completa ni autoridad constitutiva.
          </p>
          <div style={{ marginTop: 10, fontSize: 13 }}>Superficie detectada: <code>{deviceLabel}</code></div>
        </section>

        {mode === "SOURCE" ? (
          <section style={{ ...card, marginTop: 16 }}>
            <h2 style={{ marginTop: 0 }}>ORIGEN · teléfono</h2>
            <button type="button" onClick={createReturn} style={{ border: 0, borderRadius: 14, background: "#173b29", color: "white", padding: "14px 18px", fontWeight: 900, cursor: "pointer" }}>
              1 · Crear receipt de retorno al computador
            </button>

            {receipt && (
              <div style={{ marginTop: 16, lineHeight: 1.55 }}>
                <div><strong>Origen:</strong> <code>{receipt.sourceSurfaceClass}</code></div>
                <div><strong>Destino:</strong> <code>{receipt.targetSurfaceClass}</code></div>
                <div><strong>Raw memory:</strong> <code>{String(receipt.rawMemoryContentIncluded)}</code></div>
                <div><strong>Raw transcript:</strong> <code>{String(receipt.rawTranscriptContentIncluded)}</code></div>
                <div><strong>Full state copied:</strong> <code>{String(receipt.fullStateCopied)}</code></div>
              </div>
            )}

            {link && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                <strong>2 · Llevar al computador</strong>
                <p style={{ marginBottom: 10 }}>Copia o comparte este handoff. El payload completo no se imprime en pantalla.</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" onClick={copyLink} style={{ border: 0, borderRadius: 999, background: "#1d4ed8", color: "white", padding: "10px 15px", fontWeight: 900 }}>
                    {copied ? "Enlace copiado ✓" : "Copiar enlace para PC"}
                  </button>
                  {typeof navigator !== "undefined" && Boolean(navigator.share) && (
                    <button type="button" onClick={shareLink} style={{ border: "1px solid #1d4ed8", borderRadius: 999, background: "white", color: "#1d4ed8", padding: "10px 15px", fontWeight: 900 }}>
                      Compartir al PC
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section style={{ ...card, marginTop: 16, background: "#f0fdf4", borderColor: "#86efac" }}>
            <h2 style={{ marginTop: 0 }}>DESTINO · computador</h2>
            <div><strong>Payload recibido:</strong> <code>{receipt ? "sí" : "no"}</code></div>
            {receipt && <div><strong>Origen declarado:</strong> <code>{receipt.sourceSurfaceClass}</code></div>}
            {receipt && <div><strong>Destino declarado:</strong> <code>{receipt.targetSurfaceClass}</code></div>}
            {receipt && <div><strong>Raw memory transportada:</strong> <code>{String(receipt.rawMemoryContentIncluded)}</code></div>}
            {receipt && <div><strong>Raw transcript transportada:</strong> <code>{String(receipt.rawTranscriptContentIncluded)}</code></div>}
            <button type="button" disabled={!receipt} onClick={consumeOnDesktop} style={{ marginTop: 16, border: 0, borderRadius: 14, background: receipt ? "#1d4ed8" : "#cbd5e1", color: "white", padding: "14px 18px", fontWeight: 900 }}>
              3 · Consumir receipt EN ESTE COMPUTADOR
            </button>

            {result && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "white", border: "1px solid #86efac" }}>
                <div><strong>Sesión destino:</strong> <code>{result.consumed.targetSessionId}</code></div>
                <div><strong>Memorias recuperadas:</strong> <code>{result.consumed.memoryIds.join(", ") || "ninguna"}</code></div>
                <div><strong>Continuity key:</strong> <code>{result.consumed.continuityKey}</code></div>
                <div style={{ marginTop: 10, fontWeight: 900, color: expectedDesktop ? "#166534" : "#991b1b" }}>
                  {expectedDesktop ? "P5 MOBILE → PC: resultado esperado observado en destino." : "Resultado inesperado: revisar antes de adjudicar PASS."}
                </div>
              </div>
            )}
          </section>
        )}

        <section style={{ ...card, marginTop: 16, background: lastError === "ninguno" ? "#f0fdf4" : "#fef2f2", borderColor: lastError === "ninguno" ? "#bbf7d0" : "#fecaca" }}>
          <strong>Último error:</strong> {lastError}
        </section>

        <p style={{ fontSize: 12, color: "#6b6258", lineHeight: 1.5 }}>
          MOBILE_TO_PC_REAL_WORLD=NOT_YET_ADJUDICATED · REAL_OWNER_MEMORY=NOT_STARTED · PRODUCTION_MUTATION=FALSE.
        </p>
      </div>
    </main>
  );
}
