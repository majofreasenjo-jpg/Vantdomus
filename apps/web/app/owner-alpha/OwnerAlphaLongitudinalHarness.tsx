"use client";

import { useMemo, useState } from "react";
// @ts-ignore — target-native deterministic .mjs core is exercised directly in node tests too.
import {
  createLongitudinalConversationState,
  openConversationSession,
  closeConversationSession,
  appendConversationTurn,
  proposeMemoryCandidate,
  adjudicateMemoryCandidate,
  correctMemory,
  forgetMemory,
  buildLongitudinalContext,
} from "../../lib/domiLongitudinalConversationSpine.mjs";

type DemoState = any;

type EventRow = {
  id: string;
  label: string;
  detail: string;
};

const PERSON_ID = "OWNER_ALPHA_SYNTHETIC_PERSON";
const HOUSEHOLD_ID = "OWNER_ALPHA_SYNTHETIC_HOUSEHOLD";
const LINEAGE_ID = "OWNER_ALPHA_SYNTHETIC_LINEAGE";

function createInitialState(): DemoState {
  let state = createLongitudinalConversationState({ householdId: HOUSEHOLD_ID, lineageId: LINEAGE_ID });
  state = openConversationSession(state, {
    sessionId: "OA-S1",
    personId: PERSON_ID,
    surfaceClass: "PERSONAL_DESKTOP",
    startedAt: "2026-09-03T15:00:00-04:00",
  });
  return state;
}

function isoNow() {
  return new Date().toISOString();
}

export default function OwnerAlphaLongitudinalHarness() {
  const [state, setState] = useState<DemoState>(() => createInitialState());
  const [sessionId, setSessionId] = useState("OA-S1");
  const [surfaceClass, setSurfaceClass] = useState<"PERSONAL_DESKTOP" | "PERSONAL_MOBILE" | "SHARED_TV">("PERSONAL_DESKTOP");
  const [rememberText, setRememberText] = useState("Prefiero trabajar por la mañana con música instrumental.");
  const [query, setQuery] = useState("trabajar mañana música");
  const [correction, setCorrection] = useState("Prefiero trabajar por la mañana en silencio.");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [lastMemoryId, setLastMemoryId] = useState<string | null>(null);
  const [pendingInferenceId, setPendingInferenceId] = useState<string | null>(null);
  const [counter, setCounter] = useState(1);

  const context = useMemo(() => {
    try {
      return buildLongitudinalContext(state, {
        sessionId,
        personId: PERSON_ID,
        query,
        now: isoNow(),
        authorizedScopes: ["private_self", "household_shared", "temporary_session"],
      });
    } catch {
      return { memories: [], pendingThreads: [], contextFingerprint: "NO_ACTIVE_SESSION" };
    }
  }, [state, sessionId, query]);

  const log = (label: string, detail: string) => {
    setEvents((prev) => [{ id: `${Date.now()}-${Math.random()}`, label, detail }, ...prev].slice(0, 8));
  };

  const remember = () => {
    const n = counter;
    const turnId = `OA-T-${n}`;
    const candidateId = `OA-C-${n}`;
    const memoryId = `OA-M-${n}`;
    let next = appendConversationTurn(state, {
      sessionId,
      turnId,
      speaker: "USER",
      personId: PERSON_ID,
      text: `Recuerda que ${rememberText}`,
      timestamp: isoNow(),
    });
    next = proposeMemoryCandidate(next, {
      candidateId,
      sessionId,
      personId: PERSON_ID,
      memoryType: "preference",
      content: rememberText,
      visibilityScope: "private_self",
      evidenceTurnIds: [turnId],
      origin: "USER_EXPLICIT",
      explicitRememberRequest: true,
      importance: 0.8,
    });
    next = adjudicateMemoryCandidate(next, {
      candidateId,
      decision: "ADMIT",
      authority: "USER_EXPLICIT_REMEMBER_REQUEST",
      memoryId,
      adjudicatedAt: isoNow(),
    });
    setState(next);
    setLastMemoryId(memoryId);
    setCounter(n + 1);
    log("Memoria admitida", `${memoryId} · private_self · evidencia ${turnId}`);
  };

  const newSession = (targetSurface: "PERSONAL_DESKTOP" | "PERSONAL_MOBILE" | "SHARED_TV" = "PERSONAL_MOBILE") => {
    const nextId = `OA-S${counter + 1}`;
    let next = state;
    try {
      next = closeConversationSession(next, { sessionId, endedAt: isoNow() });
    } catch {
      // A closed session is acceptable for repeated demo operations.
    }
    next = openConversationSession(next, {
      sessionId: nextId,
      personId: PERSON_ID,
      surfaceClass: targetSurface,
      startedAt: isoNow(),
    });
    setState(next);
    setSessionId(nextId);
    setSurfaceClass(targetSurface);
    setCounter((v) => v + 1);
    log("Nueva sesión", `${nextId} · ${targetSurface}`);
  };

  const correct = () => {
    if (!lastMemoryId) return;
    const replacementMemoryId = `${lastMemoryId}-R${counter}`;
    const next = correctMemory(state, {
      memoryId: lastMemoryId,
      replacementMemoryId,
      correctedContent: correction,
      authority: "USER_CONFIRMED",
      correctedAt: isoNow(),
    });
    setState(next);
    setLastMemoryId(replacementMemoryId);
    setCounter((v) => v + 1);
    log("Memoria corregida", `${lastMemoryId} → ${replacementMemoryId}`);
  };

  const forget = () => {
    if (!lastMemoryId) return;
    const next = forgetMemory(state, {
      memoryId: lastMemoryId,
      authority: "USER_CONFIRMED",
      forgottenAt: isoNow(),
    });
    setState(next);
    log("Memoria olvidada", `${lastMemoryId} ya no es recuperable; tombstone preservado.`);
    setLastMemoryId(null);
  };

  const proposeInference = () => {
    const n = counter;
    const userTurnId = `OA-IU-${n}`;
    const domiTurnId = `OA-ID-${n}`;
    const candidateId = `OA-INF-${n}`;
    let next = appendConversationTurn(state, {
      sessionId,
      turnId: userTurnId,
      speaker: "USER",
      personId: PERSON_ID,
      text: "Últimamente rindo mejor cuando empiezo temprano.",
      timestamp: isoNow(),
    });
    next = appendConversationTurn(next, {
      sessionId,
      turnId: domiTurnId,
      speaker: "DOMI",
      text: "Hipótesis: quizá prefieres comenzar tareas exigentes temprano.",
      timestamp: isoNow(),
      providerRealized: true,
    });
    next = proposeMemoryCandidate(next, {
      candidateId,
      sessionId,
      personId: PERSON_ID,
      memoryType: "routine_pattern",
      content: "Podría preferir comenzar tareas exigentes temprano.",
      visibilityScope: "private_self",
      evidenceTurnIds: [userTurnId, domiTurnId],
      origin: "DOMI_INFERENCE",
      explicitRememberRequest: false,
      importance: 0.5,
    });
    setState(next);
    setPendingInferenceId(candidateId);
    setCounter(n + 1);
    log("Inferencia pendiente", `${candidateId} no entra al recall hasta confirmación humana.`);
  };

  const confirmInference = () => {
    if (!pendingInferenceId) return;
    const memoryId = `${pendingInferenceId}-M`;
    const next = adjudicateMemoryCandidate(state, {
      candidateId: pendingInferenceId,
      decision: "ADMIT",
      authority: "USER_CONFIRMED",
      memoryId,
      adjudicatedAt: isoNow(),
    });
    setState(next);
    setLastMemoryId(memoryId);
    log("Inferencia confirmada", `${pendingInferenceId} → ${memoryId}`);
    setPendingInferenceId(null);
  };

  const switchSurface = (target: "PERSONAL_DESKTOP" | "PERSONAL_MOBILE" | "SHARED_TV") => {
    newSession(target);
  };

  const reset = () => {
    setState(createInitialState());
    setSessionId("OA-S1");
    setSurfaceClass("PERSONAL_DESKTOP");
    setEvents([]);
    setLastMemoryId(null);
    setPendingInferenceId(null);
    setCounter(1);
  };

  return (
    <section style={{ maxWidth: 1120, margin: "24px auto 48px", padding: "0 20px", fontFamily: "var(--domi-font-inter), system-ui, sans-serif" }}>
      <div style={{ border: "1px solid rgba(90,73,53,.18)", borderRadius: 24, background: "rgba(255,252,244,.96)", boxShadow: "0 18px 50px rgba(90,70,45,.10)", padding: 22 }}>
        <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#8f6a2b" }}>P3.1 · Owner Alpha · Synthetic only</div>
            <h2 style={{ margin: "5px 0 6px", fontSize: 22, color: "#352b21" }}>Memoria longitudinal gobernada</h2>
            <p style={{ margin: 0, maxWidth: 760, color: "#6a5948", lineHeight: 1.5 }}>
              Prueba separada del hogar real. Ningún dato de este panel se escribe al backend. La memoria sólo entra por autoridad humana y el contexto cambia por historia admitida, no por copiar todo el transcript.
            </p>
          </div>
          <button onClick={reset} style={{ border: "1px solid #cbb99f", borderRadius: 999, padding: "8px 13px", background: "white", cursor: "pointer" }}>Reiniciar prueba</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12, marginTop: 18 }}>
          <div style={{ padding: 14, borderRadius: 16, background: "#f7f1e6" }}><strong>Sesión</strong><div>{sessionId}</div><small>{surfaceClass}</small></div>
          <div style={{ padding: 14, borderRadius: 16, background: "#f7f1e6" }}><strong>Memorias recuperadas</strong><div>{context.memories?.length ?? 0}</div><small>{context.memories?.map((m: any) => m.memoryId).join(", ") || "ninguna"}</small></div>
          <div style={{ padding: 14, borderRadius: 16, background: "#f7f1e6" }}><strong>Fingerprint</strong><div style={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>{context.contextFingerprint}</div></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18, marginTop: 18 }}>
          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>1. Memoria explícita</label>
            <textarea value={rememberText} onChange={(e) => setRememberText(e.target.value)} rows={3} style={{ width: "100%", boxSizing: "border-box", borderRadius: 14, border: "1px solid #d8c9b4", padding: 12 }} />
            <button onClick={remember} style={{ marginTop: 8, border: 0, borderRadius: 999, padding: "9px 14px", background: "#5f4b35", color: "white", cursor: "pointer" }}>“Recuerda que…”</button>
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>2. Recall posterior</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: "100%", boxSizing: "border-box", borderRadius: 14, border: "1px solid #d8c9b4", padding: 12 }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button onClick={() => newSession("PERSONAL_MOBILE")} style={{ border: "1px solid #cbb99f", borderRadius: 999, padding: "9px 13px", background: "white", cursor: "pointer" }}>Nueva sesión móvil</button>
              <button onClick={() => switchSurface("SHARED_TV")} style={{ border: "1px solid #cbb99f", borderRadius: 999, padding: "9px 13px", background: "white", cursor: "pointer" }}>Nueva sesión TV compartida</button>
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>3. Corregir / olvidar</label>
            <input value={correction} onChange={(e) => setCorrection(e.target.value)} style={{ width: "100%", boxSizing: "border-box", borderRadius: 14, border: "1px solid #d8c9b4", padding: 12 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button disabled={!lastMemoryId} onClick={correct} style={{ border: "1px solid #cbb99f", borderRadius: 999, padding: "9px 13px", background: "white", cursor: "pointer" }}>Corregir</button>
              <button disabled={!lastMemoryId} onClick={forget} style={{ border: "1px solid #cbb99f", borderRadius: 999, padding: "9px 13px", background: "white", cursor: "pointer" }}>Olvidar</button>
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>4. Inferencia de Domi</label>
            <p style={{ margin: "0 0 8px", color: "#6a5948", fontSize: 13 }}>La inferencia se guarda como candidata, pero no entra al recall hasta confirmarla.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={proposeInference} style={{ border: "1px solid #cbb99f", borderRadius: 999, padding: "9px 13px", background: "white", cursor: "pointer" }}>Proponer inferencia</button>
              <button disabled={!pendingInferenceId} onClick={confirmInference} style={{ border: 0, borderRadius: 999, padding: "9px 13px", background: "#5f4b35", color: "white", cursor: "pointer" }}>Confirmar inferencia</button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18, padding: 14, borderRadius: 16, background: surfaceClass === "SHARED_TV" ? "#fff4dc" : "#f8f5ef" }}>
          <strong>Contexto recuperable ahora</strong>
          {surfaceClass === "SHARED_TV" && <div style={{ marginTop: 4, fontSize: 13 }}>TV compartida: <code>private_self</code> queda suprimido por defecto.</div>}
          <ul style={{ marginBottom: 0 }}>
            {(context.memories ?? []).map((memory: any) => <li key={memory.memoryId}>{memory.memoryId}: {memory.content}</li>)}
            {(context.memories?.length ?? 0) === 0 && <li>Ninguna memoria autorizada coincide con la consulta/superficie.</li>}
          </ul>
        </div>

        <div style={{ marginTop: 18 }}>
          <strong>Eventos recientes</strong>
          <ul>
            {events.map((event) => <li key={event.id}><b>{event.label}</b> — {event.detail}</li>)}
            {events.length === 0 && <li>Aún no hay eventos de la prueba.</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
