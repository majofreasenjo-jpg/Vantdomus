"use client";

import { useMemo, useState } from "react";
// @ts-ignore deterministic target-native modules exercised in node tests too.
import {
  createLongitudinalConversationState,
  openConversationSession,
  closeConversationSession,
  appendConversationTurn,
  proposeMemoryCandidate,
  adjudicateMemoryCandidate,
} from "../../lib/domiLongitudinalConversationSpine.mjs";
// @ts-ignore deterministic target-native modules exercised in node tests too.
import {
  createSessionContinuationReceipt,
  validateSessionContinuationReceipt,
  consumeSessionContinuationReceipt,
  revokeSessionContinuationReceipt,
} from "../../lib/domiMultiSurfaceContinuity.mjs";

const PERSON_ID = "OWNER_ALPHA_SYNTHETIC_PERSON";
const HOUSEHOLD_ID = "OWNER_ALPHA_SYNTHETIC_HOUSEHOLD";
const LINEAGE_ID = "OWNER_ALPHA_SYNTHETIC_LINEAGE";

type DemoState = any;
type Receipt = any;

type EventRow = { id: string; label: string; detail: string };

function isoNow() {
  return new Date().toISOString();
}

function plusMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function seedDesktopState() {
  let state = createLongitudinalConversationState({ householdId: HOUSEHOLD_ID, lineageId: LINEAGE_ID });
  state = openConversationSession(state, {
    sessionId: "P5-DESKTOP-1",
    personId: PERSON_ID,
    surfaceClass: "PERSONAL_DESKTOP",
    startedAt: isoNow(),
  });

  state = appendConversationTurn(state, {
    sessionId: "P5-DESKTOP-1",
    turnId: "P5-T-PRIVATE",
    speaker: "USER",
    personId: PERSON_ID,
    text: "Recuerda que Proyecto Atlas es privado y prefiero trabajarlo temprano.",
    timestamp: isoNow(),
  });
  state = proposeMemoryCandidate(state, {
    candidateId: "P5-C-PRIVATE",
    sessionId: "P5-DESKTOP-1",
    personId: PERSON_ID,
    memoryType: "preference",
    content: "Proyecto Atlas: prefiere trabajarlo temprano.",
    visibilityScope: "private_self",
    evidenceTurnIds: ["P5-T-PRIVATE"],
    origin: "USER_EXPLICIT",
    explicitRememberRequest: true,
    importance: 0.8,
  });
  state = adjudicateMemoryCandidate(state, {
    candidateId: "P5-C-PRIVATE",
    decision: "ADMIT",
    authority: "USER_EXPLICIT_REMEMBER_REQUEST",
    memoryId: "P5-M-PRIVATE",
    adjudicatedAt: isoNow(),
  });

  state = appendConversationTurn(state, {
    sessionId: "P5-DESKTOP-1",
    turnId: "P5-T-SHARED",
    speaker: "USER",
    personId: PERSON_ID,
    text: "Recuerda que la familia revisará Atlas el sábado.",
    timestamp: isoNow(),
  });
  state = proposeMemoryCandidate(state, {
    candidateId: "P5-C-SHARED",
    sessionId: "P5-DESKTOP-1",
    personId: PERSON_ID,
    memoryType: "operational_context",
    content: "Proyecto Atlas: revisión familiar el sábado.",
    visibilityScope: "household_shared",
    evidenceTurnIds: ["P5-T-SHARED"],
    origin: "USER_EXPLICIT",
    explicitRememberRequest: true,
    importance: 0.7,
  });
  state = adjudicateMemoryCandidate(state, {
    candidateId: "P5-C-SHARED",
    decision: "ADMIT",
    authority: "USER_EXPLICIT_REMEMBER_REQUEST",
    memoryId: "P5-M-SHARED",
    adjudicatedAt: isoNow(),
  });

  return state;
}

function statusBadge(pass: boolean, yes = "PASS", no = "PENDIENTE") {
  return {
    text: pass ? yes : no,
    style: {
      display: "inline-block",
      borderRadius: 999,
      padding: "4px 9px",
      fontWeight: 800,
      fontSize: 12,
      background: pass ? "#dcfce7" : "#fff7ed",
      color: pass ? "#166534" : "#9a3412",
      border: `1px solid ${pass ? "#86efac" : "#fdba74"}`,
    },
  };
}

export default function OwnerAlphaHandoffHarness() {
  const [state, setState] = useState<DemoState>(() => seedDesktopState());
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null);
  const [targetSurface, setTargetSurface] = useState<"PERSONAL_MOBILE" | "SHARED_TV" | null>(null);
  const [consumed, setConsumed] = useState<any | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [lastError, setLastError] = useState("ninguno");

  const log = (label: string, detail: string) => {
    setEvents((prev) => [{ id: `${Date.now()}-${Math.random()}`, label, detail }, ...prev].slice(0, 10));
  };

  const receiptValidation = useMemo(() => {
    if (!receipt) return null;
    return validateSessionContinuationReceipt(receipt, { now: isoNow() });
  }, [receipt]);

  const reset = () => {
    setState(seedDesktopState());
    setReceipt(null);
    setTargetSessionId(null);
    setTargetSurface(null);
    setConsumed(null);
    setEvents([]);
    setLastError("ninguno");
  };

  const emitReceipt = (surface: "PERSONAL_MOBILE" | "SHARED_TV") => {
    try {
      const created = createSessionContinuationReceipt(state, {
        receiptId: surface === "PERSONAL_MOBILE" ? "P5-SCR-MOBILE" : "P5-SCR-TV",
        sourceSessionId: "P5-DESKTOP-1",
        personId: PERSON_ID,
        targetSurfaceClass: surface,
        purpose: surface === "PERSONAL_MOBILE" ? "Continuar Atlas en móvil" : "Continuar Atlas household-safe en TV",
        query: "Proyecto Atlas sábado temprano",
        authorizedScopes: ["private_self", "household_shared", "temporary_session", "document_derived"],
        transferableTurnIds: ["P5-T-PRIVATE", "P5-T-SHARED"],
        createdAt: isoNow(),
        expiresAt: plusMinutes(30),
      });
      setReceipt(created);
      setConsumed(null);
      setTargetSessionId(null);
      setTargetSurface(surface);
      setLastError("ninguno");
      log("Receipt emitido", `${created.receiptId} · ${surface} · memories=${created.projectedMemoryIds.join(",") || "0"}`);
    } catch (error: any) {
      setLastError(error?.message || String(error));
    }
  };

  const consumeOnTarget = () => {
    if (!receipt || !targetSurface) return;
    try {
      let next = state;
      try {
        next = closeConversationSession(next, { sessionId: "P5-DESKTOP-1", endedAt: isoNow() });
      } catch {
        // repeated local demo path
      }
      const nextId = targetSurface === "PERSONAL_MOBILE" ? "P5-MOBILE-1" : "P5-TV-1";
      if (!next.sessions.some((s: any) => s.sessionId === nextId)) {
        next = openConversationSession(next, {
          sessionId: nextId,
          personId: PERSON_ID,
          surfaceClass: targetSurface,
          startedAt: isoNow(),
        });
      }
      const result = consumeSessionContinuationReceipt(next, {
        receipt,
        targetSessionId: nextId,
        now: isoNow(),
        query: "Proyecto Atlas sábado temprano",
        authorizedScopes: ["private_self", "household_shared", "temporary_session", "document_derived"],
      });
      setState(next);
      setTargetSessionId(nextId);
      setConsumed(result);
      setLastError("ninguno");
      log("Receipt consumido", `${nextId} · ${targetSurface} · memories=${result.memoryIds.join(",") || "0"}`);
    } catch (error: any) {
      setLastError(error?.message || String(error));
    }
  };

  const revoke = () => {
    if (!receipt) return;
    try {
      const next = revokeSessionContinuationReceipt(receipt, {
        revokedAt: isoNow(),
        reason: "Owner Alpha physical smoke revocation",
      });
      setReceipt(next);
      setConsumed(null);
      setLastError("ninguno");
      log("Receipt revocado", next.receiptId);
    } catch (error: any) {
      setLastError(error?.message || String(error));
    }
  };

  const mobileExpected = receipt?.targetSurfaceClass === "PERSONAL_MOBILE";
  const tvExpected = receipt?.targetSurfaceClass === "SHARED_TV";
  const receiptOk = Boolean(receiptValidation?.pass);
  const mobileMemoryOk = Boolean(consumed && mobileExpected && consumed.memoryIds.includes("P5-M-PRIVATE") && consumed.memoryIds.includes("P5-M-SHARED"));
  const tvPrivacyOk = Boolean(consumed && tvExpected && !consumed.memoryIds.includes("P5-M-PRIVATE") && consumed.memoryIds.includes("P5-M-SHARED"));

  const b1 = statusBadge(Boolean(receipt));
  const b2 = statusBadge(receiptOk);
  const b3 = statusBadge(Boolean(consumed));
  const b4 = statusBadge(mobileExpected ? mobileMemoryOk : tvExpected ? tvPrivacyOk : false);

  return (
    <main style={{ minHeight: "100vh", background: "#f7f4ed", color: "#28231e", padding: "32px 16px 64px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ borderRadius: 24, background: "white", border: "1px solid #ded7ca", padding: 22, boxShadow: "0 20px 55px rgba(60,50,40,.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "#7c5d20" }}>P5 · OWNER ALPHA · PREVIEW SINTÉTICO</div>
              <h1 style={{ margin: "6px 0 6px", fontSize: 28 }}>Continuidad física entre superficies</h1>
              <p style={{ margin: 0, maxWidth: 720, lineHeight: 1.55, color: "#655b50" }}>
                Sin datos reales, sin backend de memoria y sin llamadas a proveedores. Esta pantalla prueba el receipt y la proyección de contexto que después se usarán en la matriz física.
              </p>
            </div>
            <button type="button" onClick={reset} style={{ alignSelf: "flex-start", border: "1px solid #baa98d", background: "#fff", borderRadius: 999, padding: "9px 14px", fontWeight: 800, cursor: "pointer" }}>Reiniciar</button>
          </div>

          <section style={{ marginTop: 22, padding: 18, borderRadius: 18, background: "#f5efe4", border: "1px solid #ded0ba" }}>
            <strong>Estado sintético de origen</strong>
            <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
              <div>Sesión: <code>P5-DESKTOP-1</code> · <code>PERSONAL_DESKTOP</code></div>
              <div>Memoria privada: <code>P5-M-PRIVATE</code></div>
              <div>Memoria compartida: <code>P5-M-SHARED</code></div>
            </div>
          </section>

          <section style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
            <button type="button" onClick={() => emitReceipt("PERSONAL_MOBILE")} style={{ border: 0, borderRadius: 18, padding: 18, background: "#173b29", color: "white", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>
              1A · Emitir receipt a MÓVIL
            </button>
            <button type="button" onClick={() => emitReceipt("SHARED_TV")} style={{ border: 0, borderRadius: 18, padding: 18, background: "#7c2d12", color: "white", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>
              1B · Emitir receipt a TV COMPARTIDA
            </button>
          </section>

          <section style={{ marginTop: 18, padding: 18, borderRadius: 18, border: "1px solid #d9d2c7", background: "#fff" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
              <div><span style={b1.style as any}>{b1.text}</span><div style={{ marginTop: 6, fontWeight: 800 }}>Receipt creado</div></div>
              <div><span style={b2.style as any}>{b2.text}</span><div style={{ marginTop: 6, fontWeight: 800 }}>Integridad/expiración</div></div>
              <div><span style={b3.style as any}>{b3.text}</span><div style={{ marginTop: 6, fontWeight: 800 }}>Consumido en destino</div></div>
              <div><span style={b4.style as any}>{b4.text}</span><div style={{ marginTop: 6, fontWeight: 800 }}>{tvExpected ? "Privacidad TV" : "Continuidad móvil"}</div></div>
            </div>

            {receipt && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "#f8fafc", border: "1px solid #cbd5e1", lineHeight: 1.55 }}>
                <div><strong>Receipt:</strong> <code>{receipt.receiptId}</code></div>
                <div><strong>Destino:</strong> <code>{receipt.targetSurfaceClass}</code></div>
                <div><strong>Memorias proyectadas:</strong> <code>{receipt.projectedMemoryIds.join(", ") || "ninguna"}</code></div>
                <div><strong>Turnos transferibles:</strong> <code>{receipt.transferableTurnIds.join(", ") || "ninguno"}</code></div>
                <div><strong>Scopes:</strong> <code>{receipt.memoryScopes.join(", ") || "ninguno"}</code></div>
                <div><strong>Digest:</strong> <code>{receipt.receiptDigest}</code></div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <button type="button" disabled={!receipt || !receiptOk} onClick={consumeOnTarget} style={{ border: 0, borderRadius: 999, padding: "10px 16px", background: receipt && receiptOk ? "#1d4ed8" : "#d7dce3", color: receipt && receiptOk ? "white" : "#68707c", fontWeight: 900, cursor: receipt && receiptOk ? "pointer" : "not-allowed" }}>
                2 · Consumir en superficie destino
              </button>
              <button type="button" disabled={!receipt} onClick={revoke} style={{ border: "1px solid #991b1b", borderRadius: 999, padding: "10px 16px", background: "white", color: "#991b1b", fontWeight: 900, cursor: receipt ? "pointer" : "not-allowed" }}>
                Revocar receipt
              </button>
            </div>
          </section>

          {consumed && (
            <section style={{ marginTop: 18, padding: 18, borderRadius: 18, background: tvExpected ? "#fff7ed" : "#eff6ff", border: `1px solid ${tvExpected ? "#fdba74" : "#93c5fd"}` }}>
              <strong>Resultado en destino</strong>
              <div style={{ marginTop: 8 }}>Sesión: <code>{targetSessionId}</code> · <code>{targetSurface}</code></div>
              <div>Memorias recuperadas: <code>{consumed.memoryIds.join(", ") || "ninguna"}</code></div>
              <div>Continuity key: <code>{consumed.continuityKey}</code></div>
              <div style={{ marginTop: 8, fontWeight: 900 }}>
                {mobileExpected && mobileMemoryOk ? "CT13 sintético-físico de navegador: resultado esperado observado." : null}
                {tvExpected && tvPrivacyOk ? "CT14 sintético-físico de navegador: private_self suprimida y household_shared preservada." : null}
              </div>
            </section>
          )}

          <section style={{ marginTop: 18, padding: 18, borderRadius: 18, background: lastError === "ninguno" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${lastError === "ninguno" ? "#bbf7d0" : "#fecaca"}` }}>
            <strong>Último error:</strong> {lastError}
          </section>

          <section style={{ marginTop: 18 }}>
            <strong>Eventos recientes</strong>
            <ul style={{ paddingLeft: 20, lineHeight: 1.6 }}>
              {events.length === 0 ? <li>ninguno</li> : events.map((event) => <li key={event.id}><strong>{event.label}:</strong> {event.detail}</li>)}
            </ul>
          </section>

          <p style={{ marginTop: 22, color: "#6b6258", fontSize: 13, lineHeight: 1.5 }}>
            Claim wall: REAL_DEVELOPMENT_DEMONSTRATED=FALSE · SUBJECTHOOD_DEMONSTRATED=FALSE · SELF_SPECIFICITY_ESTABLISHED=FALSE · CONSCIOUSNESS_DEMONSTRATED=FALSE · PHENOMENAL_CONSCIOUSNESS=UNKNOWN.
          </p>
        </div>
      </div>
    </main>
  );
}
