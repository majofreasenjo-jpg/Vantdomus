"use client";

import { useEffect, useMemo, useState } from "react";
// @ts-ignore target-native deterministic modules
import {
  closeConversationSession,
  openConversationSession,
} from "../../lib/domiLongitudinalConversationSpine.mjs";
// @ts-ignore target-native deterministic modules
import {
  createSessionContinuationReceipt,
  validateSessionContinuationReceipt,
  consumeSessionContinuationReceipt,
} from "../../lib/domiMultiSurfaceContinuity.mjs";
// @ts-ignore shared synthetic fixture
import {
  seedP5SyntheticDesktopState,
  P5_SYNTHETIC_PERSON_ID,
  P5_SOURCE_SESSION_ID,
  P5_PRIVATE_MEMORY_ID,
  P5_SHARED_MEMORY_ID,
  P5_PRIVATE_TURN_ID,
  P5_SHARED_TURN_ID,
  P5_QUERY,
  P5_AUTHORIZED_SCOPES,
} from "../../lib/domiP5SyntheticFixture.mjs";
// @ts-ignore transport envelope
import {
  createCrossDeviceTransportEnvelope,
  encodeCrossDeviceTransportEnvelope,
  decodeCrossDeviceTransportEnvelope,
} from "../../lib/domiP5CrossDeviceTransport.mjs";

const TTL_MINUTES = 180;

type Mode = "SOURCE" | "DESTINATION";

function nowIso() {
  return new Date().toISOString();
}

function plusMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export default function OwnerAlphaCrossDeviceHarness() {
  const [mode, setMode] = useState<Mode>("SOURCE");
  const [transportLink, setTransportLink] = useState("");
  const [receipt, setReceipt] = useState<any | null>(null);
  const [envelope, setEnvelope] = useState<any | null>(null);
  const [validation, setValidation] = useState<any | null>(null);
  const [consumed, setConsumed] = useState<any | null>(null);
  const [lastError, setLastError] = useState("ninguno");
  const [copied, setCopied] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState("detectando...");

  useEffect(() => {
    const coarse = `${navigator.platform || "platform?"} · ${window.innerWidth}x${window.innerHeight}`;
    setDeviceLabel(coarse);

    const match = window.location.hash.match(/^#handoff=(.+)$/);
    if (!match) return;
    try {
      const decoded = decodeCrossDeviceTransportEnvelope(match[1]);
      const checked = validateSessionContinuationReceipt(decoded.receipt, {
        now: nowIso(),
        expectedPersonId: P5_SYNTHETIC_PERSON_ID,
        expectedTargetSurfaceClass: "PERSONAL_MOBILE",
      });
      setEnvelope(decoded);
      setReceipt(decoded.receipt);
      setValidation(checked);
      setMode("DESTINATION");
      setLastError(checked.pass ? "ninguno" : checked.failures.join(" | "));
    } catch (error: any) {
      setMode("DESTINATION");
      setLastError(error?.message || String(error));
    }
  }, []);

  const createTransport = () => {
    try {
      const fixtureBaseTime = new Date(Date.now() - 15_000).toISOString();
      const state = seedP5SyntheticDesktopState({ baseTime: fixtureBaseTime });
      const created = createSessionContinuationReceipt(state, {
        receiptId: `P5-XDEV-${Date.now()}`,
        sourceSessionId: P5_SOURCE_SESSION_ID,
        personId: P5_SYNTHETIC_PERSON_ID,
        targetSurfaceClass: "PERSONAL_MOBILE",
        purpose: "P5 real cross-device synthetic receipt transport",
        query: P5_QUERY,
        authorizedScopes: [...P5_AUTHORIZED_SCOPES],
        transferableTurnIds: [P5_PRIVATE_TURN_ID, P5_SHARED_TURN_ID],
        createdAt: nowIso(),
        expiresAt: plusMinutes(TTL_MINUTES),
      });
      const wrapped = createCrossDeviceTransportEnvelope({ receipt: created, fixtureBaseTime });
      const encoded = encodeCrossDeviceTransportEnvelope(wrapped);
      const link = `${window.location.origin}${window.location.pathname}${window.location.search}#handoff=${encoded}`;
      setReceipt(created);
      setEnvelope(wrapped);
      setTransportLink(link);
      setValidation(validateSessionContinuationReceipt(created, { now: nowIso() }));
      setConsumed(null);
      setCopied(false);
      setLastError("ninguno");
    } catch (error: any) {
      setLastError(error?.message || String(error));
    }
  };

  const copyTransport = async () => {
    try {
      await navigator.clipboard.writeText(transportLink);
      setCopied(true);
      setLastError("ninguno");
    } catch (error: any) {
      setCopied(false);
      setLastError(error?.message || String(error));
    }
  };

  const shareTransport = async () => {
    if (!transportLink || !navigator.share) return;
    try {
      await navigator.share({
        title: "Domi P5 handoff sintético",
        text: "Abrir este receipt sintético en el teléfono destino.",
        url: transportLink,
      });
      setLastError("ninguno");
    } catch (error: any) {
      if (error?.name !== "AbortError") setLastError(error?.message || String(error));
    }
  };

  const consumeOnPhysicalDestination = () => {
    if (!envelope || !receipt) return;
    try {
      const checked = validateSessionContinuationReceipt(receipt, {
        now: nowIso(),
        expectedPersonId: P5_SYNTHETIC_PERSON_ID,
        expectedTargetSurfaceClass: "PERSONAL_MOBILE",
      });
      setValidation(checked);
      if (!checked.pass) throw new Error(`RECEIPT_INVALID:${checked.failures.join("|")}`);

      let state = seedP5SyntheticDesktopState({ baseTime: envelope.fixtureBaseTime });
      state = closeConversationSession(state, {
        sessionId: P5_SOURCE_SESSION_ID,
        endedAt: nowIso(),
      });
      state = openConversationSession(state, {
        sessionId: "P5-PHONE-REAL-1",
        personId: P5_SYNTHETIC_PERSON_ID,
        surfaceClass: "PERSONAL_MOBILE",
        startedAt: nowIso(),
      });

      const result = consumeSessionContinuationReceipt(state, {
        receipt,
        targetSessionId: "P5-PHONE-REAL-1",
        now: nowIso(),
        query: P5_QUERY,
        authorizedScopes: [...P5_AUTHORIZED_SCOPES],
      });
      setConsumed(result);
      setLastError("ninguno");
    } catch (error: any) {
      setConsumed(null);
      setLastError(error?.message || String(error));
    }
  };

  const expectedMobile = useMemo(() => {
    if (!consumed) return false;
    return consumed.memoryIds.includes(P5_PRIVATE_MEMORY_ID) && consumed.memoryIds.includes(P5_SHARED_MEMORY_ID);
  }, [consumed]);

  const card: React.CSSProperties = { border: "1px solid #d8d0c4", background: "#fff", borderRadius: 18, padding: 18 };
  const codeStyle: React.CSSProperties = { overflowWrap: "anywhere", wordBreak: "break-word" };

  return (
    <main style={{ minHeight: "100vh", background: "#f5f1e8", color: "#28231e", padding: "26px 14px 60px", fontFamily: "Inter,system-ui,sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ ...card, boxShadow: "0 18px 50px rgba(60,50,40,.08)" }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".08em", color: "#7c5d20" }}>P5 · REAL CROSS-DEVICE TRANSPORT · SYNTHETIC ONLY</div>
          <h1 style={{ margin: "7px 0 6px", fontSize: 28 }}>Receipt de computador → teléfono físico</h1>
          <p style={{ margin: 0, color: "#655b50", lineHeight: 1.55 }}>
            El enlace transporta sólo el SessionContinuationReceipt sintético dentro del fragmento URL. No transporta memoria cruda, transcripción completa ni autoridad constitutiva.
          </p>
          <div style={{ marginTop: 10, fontSize: 13 }}>Superficie física detectada: <code>{deviceLabel}</code></div>
        </div>

        {mode === "SOURCE" ? (
          <>
            <section style={{ ...card, marginTop: 16 }}>
              <h2 style={{ marginTop: 0 }}>ORIGEN · computador</h2>
              <button type="button" onClick={createTransport} style={{ border: 0, borderRadius: 14, background: "#173b29", color: "white", padding: "14px 18px", fontWeight: 900, cursor: "pointer" }}>
                1 · Crear receipt transportable a teléfono
              </button>

              {receipt && (
                <div style={{ marginTop: 16, lineHeight: 1.55 }}>
                  <div><strong>Receipt:</strong> <code>{receipt.receiptId}</code></div>
                  <div><strong>Destino:</strong> <code>{receipt.targetSurfaceClass}</code></div>
                  <div><strong>Memorias referenciadas:</strong> <code>{receipt.projectedMemoryIds.join(", ")}</code></div>
                  <div><strong>Raw memory:</strong> <code>{String(receipt.rawMemoryContentIncluded)}</code></div>
                  <div><strong>Raw transcript:</strong> <code>{String(receipt.rawTranscriptContentIncluded)}</code></div>
                  <div><strong>Full state copied:</strong> <code>{String(receipt.fullStateCopied)}</code></div>
                  <div><strong>Integridad:</strong> <code>{validation?.pass ? "PASS" : "FAIL"}</code></div>
                </div>
              )}
            </section>

            {transportLink && (
              <section style={{ ...card, marginTop: 16, borderColor: "#93c5fd", background: "#eff6ff" }}>
                <h2 style={{ marginTop: 0 }}>2 · Llevar al teléfono</h2>
                <p>Este enlace debe abrirse desde un teléfono físico distinto.</p>
                <div style={{ padding: 12, background: "white", borderRadius: 12, border: "1px solid #bfdbfe" }}>
                  <code style={codeStyle}>{transportLink}</code>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <button type="button" onClick={copyTransport} style={{ border: 0, borderRadius: 999, background: "#1d4ed8", color: "white", padding: "10px 15px", fontWeight: 900, cursor: "pointer" }}>
                    {copied ? "Enlace copiado ✓" : "Copiar enlace para teléfono"}
                  </button>
                  {typeof navigator !== "undefined" && Boolean(navigator.share) && (
                    <button type="button" onClick={shareTransport} style={{ border: "1px solid #1d4ed8", borderRadius: 999, background: "white", color: "#1d4ed8", padding: "10px 15px", fontWeight: 900, cursor: "pointer" }}>
                      Compartir al teléfono
                    </button>
                  )}
                </div>
              </section>
            )}
          </>
        ) : (
          <section style={{ ...card, marginTop: 16, borderColor: validation?.pass ? "#86efac" : "#fecaca", background: validation?.pass ? "#f0fdf4" : "#fef2f2" }}>
            <h2 style={{ marginTop: 0 }}>DESTINO · teléfono</h2>
            <div><strong>Payload recibido:</strong> <code>{receipt ? "sí" : "no"}</code></div>
            <div><strong>Integridad / expiración:</strong> <code>{validation?.pass ? "PASS" : "FAIL"}</code></div>
            {receipt && <div><strong>Receipt:</strong> <code>{receipt.receiptId}</code></div>}
            {receipt && <div><strong>Destino declarado:</strong> <code>{receipt.targetSurfaceClass}</code></div>}
            {receipt && <div><strong>Raw memory transportada:</strong> <code>{String(receipt.rawMemoryContentIncluded)}</code></div>}
            {receipt && <div><strong>Raw transcript transportada:</strong> <code>{String(receipt.rawTranscriptContentIncluded)}</code></div>}

            <button type="button" disabled={!validation?.pass} onClick={consumeOnPhysicalDestination} style={{ marginTop: 16, border: 0, borderRadius: 14, background: validation?.pass ? "#1d4ed8" : "#cbd5e1", color: validation?.pass ? "white" : "#64748b", padding: "14px 18px", fontWeight: 900, cursor: validation?.pass ? "pointer" : "not-allowed" }}>
              3 · Consumir receipt EN ESTE TELÉFONO
            </button>

            {consumed && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "white", border: "1px solid #86efac", lineHeight: 1.55 }}>
                <div><strong>Sesión destino:</strong> <code>P5-PHONE-REAL-1 · PERSONAL_MOBILE</code></div>
                <div><strong>Memorias recuperadas:</strong> <code>{consumed.memoryIds.join(", ") || "ninguna"}</code></div>
                <div><strong>Continuity key:</strong> <code>{consumed.continuityKey}</code></div>
                <div style={{ marginTop: 10, fontWeight: 900, color: expectedMobile ? "#166534" : "#991b1b" }}>
                  {expectedMobile ? "P5 REAL CROSS-DEVICE: resultado esperado observado en destino." : "Resultado inesperado: revisar antes de adjudicar PASS."}
                </div>
              </div>
            )}
          </section>
        )}

        <section style={{ ...card, marginTop: 16, background: lastError === "ninguno" ? "#f0fdf4" : "#fef2f2", borderColor: lastError === "ninguno" ? "#bbf7d0" : "#fecaca" }}>
          <strong>Último error:</strong> {lastError}
        </section>

        <p style={{ fontSize: 12, color: "#6b6258", lineHeight: 1.5 }}>
          REAL_OWNER_MEMORY=NOT_STARTED · REAL_DEVELOPMENT_DEMONSTRATED=FALSE · SUBJECTHOOD_DEMONSTRATED=FALSE · SELF_SPECIFICITY_ESTABLISHED=FALSE · CONSCIOUSNESS_DEMONSTRATED=FALSE · PHENOMENAL_CONSCIOUSNESS=UNKNOWN.
        </p>
      </div>
    </main>
  );
}
