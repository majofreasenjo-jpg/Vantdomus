"use client";

import { useMemo, useState } from "react";
// @ts-ignore — deterministic target-native .mjs core.
import {
  createLongitudinalConversationState,
  openConversationSession,
  appendConversationTurn,
  proposeMemoryCandidate,
  adjudicateMemoryCandidate,
  buildLongitudinalContext,
} from "../../lib/domiLongitudinalConversationSpine.mjs";

const PERSON_ID = "OA_PROBE_PERSON";
const HOUSEHOLD_ID = "OA_PROBE_HOUSEHOLD";
const LINEAGE_ID = "OA_PROBE_LINEAGE";
const SESSION_ID = "OA-PROBE-S1";

function createProbeState() {
  let state = createLongitudinalConversationState({ householdId: HOUSEHOLD_ID, lineageId: LINEAGE_ID });
  state = openConversationSession(state, {
    sessionId: SESSION_ID,
    personId: PERSON_ID,
    surfaceClass: "PERSONAL_DESKTOP",
    startedAt: "2026-09-03T15:00:00-04:00",
  });
  return state;
}

export default function MemoryActionProbe() {
  const [state, setState] = useState<any>(() => createProbeState());
  const [handlerClicks, setHandlerClicks] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [lastError, setLastError] = useState<string>("ninguno");
  const [lastStage, setLastStage] = useState<string>("esperando clic");

  const context = useMemo(() => {
    try {
      return buildLongitudinalContext(state, {
        sessionId: SESSION_ID,
        personId: PERSON_ID,
        query: "trabajar mañana música",
        now: new Date().toISOString(),
        authorizedScopes: ["private_self"],
      });
    } catch (error) {
      return { memories: [], contextFingerprint: `CONTEXT_ERROR:${error instanceof Error ? error.message : String(error)}` };
    }
  }, [state]);

  const runRemember = () => {
    const clickNumber = handlerClicks + 1;
    setHandlerClicks(clickNumber);
    setLastStage("handler recibido");
    setLastError("ninguno");

    try {
      const turnId = `PROBE-T-${clickNumber}`;
      const candidateId = `PROBE-C-${clickNumber}`;
      const memoryId = `PROBE-M-${clickNumber}`;
      let next = appendConversationTurn(state, {
        sessionId: SESSION_ID,
        turnId,
        speaker: "USER",
        personId: PERSON_ID,
        text: "Recuerda que prefiero trabajar por la mañana con música instrumental.",
        timestamp: new Date().toISOString(),
      });
      setLastStage("turno capturado");

      next = proposeMemoryCandidate(next, {
        candidateId,
        sessionId: SESSION_ID,
        personId: PERSON_ID,
        memoryType: "preference",
        content: "Prefiero trabajar por la mañana con música instrumental.",
        visibilityScope: "private_self",
        evidenceTurnIds: [turnId],
        origin: "USER_EXPLICIT",
        explicitRememberRequest: true,
        importance: 0.8,
      });
      setLastStage("candidato creado");

      next = adjudicateMemoryCandidate(next, {
        candidateId,
        decision: "ADMIT",
        authority: "USER_EXPLICIT_REMEMBER_REQUEST",
        memoryId,
        adjudicatedAt: new Date().toISOString(),
      });
      setLastStage("memoria admitida");
      setState(next);
      setSuccesses((value) => value + 1);
    } catch (error) {
      setLastStage("ERROR");
      setLastError(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    }
  };

  return (
    <section style={{ maxWidth: 1120, margin: "18px auto 0", padding: "0 20px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ border: "2px solid #b45309", borderRadius: 20, padding: 20, background: "#fff7ed", color: "#431407" }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Diagnóstico del handler de memoria</div>
        <p style={{ margin: "8px 0 14px" }}>
          Este botón ejecuta exactamente la secuencia turno → candidato → admisión. Muestra si el clic entra al handler y en qué etapa falla.
        </p>
        <button
          type="button"
          onClick={runRemember}
          style={{ border: 0, borderRadius: 999, padding: "12px 18px", background: "#7c2d12", color: "white", fontWeight: 800, cursor: "pointer" }}
        >
          Probar “Recuerda que…”
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginTop: 14 }}>
          <div><strong>Clics recibidos:</strong> {handlerClicks}</div>
          <div><strong>Admisiones exitosas:</strong> {successes}</div>
          <div><strong>Memorias recuperadas:</strong> {context.memories?.length ?? 0}</div>
          <div><strong>Última etapa:</strong> {lastStage}</div>
        </div>
        <div style={{ marginTop: 10 }}><strong>Último error:</strong> <code>{lastError}</code></div>
        <div style={{ marginTop: 6 }}><strong>Fingerprint:</strong> <code>{context.contextFingerprint}</code></div>
      </div>
    </section>
  );
}
