"use client";

import { useEffect, useMemo, useState } from "react";
// @ts-ignore deterministic longitudinal modules
import {
  closeConversationSession,
  openConversationSession,
} from "../../lib/domiLongitudinalConversationSpine.mjs";
// @ts-ignore deterministic continuity modules
import {
  createSessionContinuationReceipt,
  consumeSessionContinuationReceipt,
  validateSessionContinuationReceipt,
} from "../../lib/domiMultiSurfaceContinuity.mjs";
// @ts-ignore synthetic fixture
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
// @ts-ignore field access bridge
import {
  buildCrossDeviceFieldHandoffUrl,
  inspectCrossDeviceFieldAccess,
} from "../../lib/domiP5CrossDeviceFieldAccess.mjs";
// @ts-ignore governed resume artifact
import {
  P5_CONTINUITY_RESUME_STORAGE_KEY,
  P5_FORWARD_RECEIPT_PURPOSE,
  createP5ContinuityResumeArtifact,
  serializeP5ContinuityResumeArtifact,
  parseP5ContinuityResumeArtifact,
  validateP5ContinuityResumeArtifact,
  reconstructP5ContinuityFromResumeArtifact,
} from "../../lib/domiP5ContinuityResumeArtifact.mjs";

const TTL_MINUTES = 180;
type Mode = "SOURCE" | "DESTINATION" | "RESUME";

function nowIso() {
  return new Date().toISOString();
}

function plusMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export default function OwnerAlphaContinuityResumeHarness() {
  const [mode, setMode] = useState<Mode>("SOURCE");
  const [deviceLabel, setDeviceLabel] = useState("detectando...");
  const [fieldAccess, setFieldAccess] = useState<any | null>(null);
  const [temporaryAccessLink, setTemporaryAccessLink] = useState("");
  const [transportLink, setTransportLink] = useState("");
  const [receipt, setReceipt] = useState<any | null>(null);
  const [envelope, setEnvelope] = useState<any | null>(null);
  const [receiptValidation, setReceiptValidation] = useState<any | null>(null);
  const [baselineConsumption, setBaselineConsumption] = useState<any | null>(null);
  const [resumeArtifact, setResumeArtifact] = useState<any | null>(null);
  const [resumeValidation, setResumeValidation] = useState<any | null>(null);
  const [resumeResult, setResumeResult] = useState<any | null>(null);
  const [artifactBytes, setArtifactBytes] = useState<number | null>(null);
  const [lastError, setLastError] = useState("ninguno");
  const [copied, setCopied] = useState(false);
  const [cleanUrlCopied, setCleanUrlCopied] = useState(false);
  const [handoffPresent, setHandoffPresent] = useState(false);

  useEffect(() => {
    const coarse = `${navigator.platform || "platform?"} · ${window.innerWidth}x${window.innerHeight}`;
    setDeviceLabel(coarse);
    setFieldAccess(inspectCrossDeviceFieldAccess({ currentUrl: window.location.href }));

    const match = window.location.hash.match(/^#handoff=(.+)$/);
    setHandoffPresent(Boolean(match));
    if (match) {
      try {
        const decoded = decodeCrossDeviceTransportEnvelope(match[1]);
        const checked = validateSessionContinuationReceipt(decoded.receipt, {
          now: nowIso(),
          expectedPersonId: P5_SYNTHETIC_PERSON_ID,
          expectedTargetSurfaceClass: "PERSONAL_MOBILE",
        });
        setEnvelope(decoded);
        setReceipt(decoded.receipt);
        setReceiptValidation(checked);
        setMode("DESTINATION");
        setLastError(checked.pass ? "ninguno" : checked.failures.join(" | "));
        return;
      } catch (error: any) {
        setMode("DESTINATION");
        setLastError(error?.message || String(error));
        return;
      }
    }

    const stored = window.localStorage.getItem(P5_CONTINUITY_RESUME_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = parseP5ContinuityResumeArtifact(stored);
      const checked = validateP5ContinuityResumeArtifact(parsed, { now: nowIso() });
      setResumeArtifact(parsed);
      setResumeValidation(checked);
      setArtifactBytes(new Blob([stored]).size);
      setMode("RESUME");
      setLastError(checked.pass ? "ninguno" : checked.failures.join(" | "));
    } catch (error: any) {
      setMode("RESUME");
      setLastError(error?.message || String(error));
    }
  }, []);

  const refreshFieldAccess = (candidate: string) => {
    try {
      const access = inspectCrossDeviceFieldAccess({
        currentUrl: window.location.href,
        explicitBridge: candidate,
      });
      setFieldAccess(access);
      setLastError("ninguno");
    } catch (error: any) {
      setFieldAccess(inspectCrossDeviceFieldAccess({ currentUrl: window.location.href }));
      setLastError(error?.message || String(error));
    }
  };

  const createTransport = () => {
    try {
      const access = inspectCrossDeviceFieldAccess({
        currentUrl: window.location.href,
        explicitBridge: temporaryAccessLink,
      });
      setFieldAccess(access);
      if (!access.fieldAccessReady) throw new Error("CROSS_DEVICE_FIELD_ACCESS_BRIDGE_REQUIRED");

      const fixtureBaseTime = new Date(Date.now() - 15_000).toISOString();
      const state = seedP5SyntheticDesktopState({ baseTime: fixtureBaseTime });
      const created = createSessionContinuationReceipt(state, {
        receiptId: `P5-RESUME-${Date.now()}`,
        sourceSessionId: P5_SOURCE_SESSION_ID,
        personId: P5_SYNTHETIC_PERSON_ID,
        targetSurfaceClass: "PERSONAL_MOBILE",
        purpose: P5_FORWARD_RECEIPT_PURPOSE,
        query: P5_QUERY,
        authorizedScopes: [...P5_AUTHORIZED_SCOPES],
        transferableTurnIds: [P5_PRIVATE_TURN_ID, P5_SHARED_TURN_ID],
        createdAt: nowIso(),
        expiresAt: plusMinutes(TTL_MINUTES),
      });
      const wrapped = createCrossDeviceTransportEnvelope({ receipt: created, fixtureBaseTime });
      const encoded = encodeCrossDeviceTransportEnvelope(wrapped);
      const link = buildCrossDeviceFieldHandoffUrl({
        currentUrl: window.location.href,
        encodedEnvelope: encoded,
        explicitBridge: temporaryAccessLink,
      });
      setReceipt(created);
      setEnvelope(wrapped);
      setTransportLink(link);
      setReceiptValidation(validateSessionContinuationReceipt(created, { now: nowIso() }));
      setBaselineConsumption(null);
      setResumeArtifact(null);
      setResumeValidation(null);
      setResumeResult(null);
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

  const consumeBaseline = () => {
    if (!envelope || !receipt) return;
    try {
      const checked = validateSessionContinuationReceipt(receipt, {
        now: nowIso(),
        expectedPersonId: P5_SYNTHETIC_PERSON_ID,
        expectedTargetSurfaceClass: "PERSONAL_MOBILE",
      });
      setReceiptValidation(checked);
      if (!checked.pass) throw new Error(`RECEIPT_INVALID:${checked.failures.join("|")}`);

      let state = seedP5SyntheticDesktopState({ baseTime: envelope.fixtureBaseTime });
      state = closeConversationSession(state, {
        sessionId: P5_SOURCE_SESSION_ID,
        endedAt: nowIso(),
      });
      state = openConversationSession(state, {
        sessionId: "P5-PHONE-REPEATABILITY-1",
        personId: P5_SYNTHETIC_PERSON_ID,
        surfaceClass: "PERSONAL_MOBILE",
        startedAt: nowIso(),
      });
      const result = consumeSessionContinuationReceipt(state, {
        receipt,
        targetSessionId: "P5-PHONE-REPEATABILITY-1",
        now: nowIso(),
        query: P5_QUERY,
        authorizedScopes: [...P5_AUTHORIZED_SCOPES],
      });
      setBaselineConsumption(result);
      setLastError("ninguno");
    } catch (error: any) {
      setBaselineConsumption(null);
      setLastError(error?.message || String(error));
    }
  };

  const baselineExpected = useMemo(() => {
    if (!baselineConsumption) return false;
    return baselineConsumption.memoryIds.includes(P5_PRIVATE_MEMORY_ID)
      && baselineConsumption.memoryIds.includes(P5_SHARED_MEMORY_ID);
  }, [baselineConsumption]);

  const persistMinimalArtifact = () => {
    if (!baselineExpected || !receipt || !envelope) return;
    try {
      const artifact = createP5ContinuityResumeArtifact({
        receipt,
        fixtureBaseTime: envelope.fixtureBaseTime,
      });
      const serialized = serializeP5ContinuityResumeArtifact(artifact);
      window.localStorage.setItem(P5_CONTINUITY_RESUME_STORAGE_KEY, serialized);
      const checked = validateP5ContinuityResumeArtifact(artifact, { now: nowIso() });
      setResumeArtifact(artifact);
      setResumeValidation(checked);
      setArtifactBytes(new Blob([serialized]).size);
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
      setHandoffPresent(false);
      setCleanUrlCopied(false);
      setLastError(checked.pass ? "ninguno" : checked.failures.join(" | "));
    } catch (error: any) {
      setLastError(error?.message || String(error));
    }
  };

  const copyCleanUrl = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}${window.location.search}`);
      setCleanUrlCopied(true);
      setLastError("ninguno");
    } catch (error: any) {
      setLastError(error?.message || String(error));
    }
  };

  const resumeFromArtifact = () => {
    if (!resumeArtifact) return;
    try {
      const result = reconstructP5ContinuityFromResumeArtifact(resumeArtifact, {
        now: nowIso(),
        targetSessionId: "P5-PHONE-RESUME-PHYSICAL-1",
      });
      setResumeResult(result);
      setResumeValidation(result.resumeValidation);
      setLastError("ninguno");
    } catch (error: any) {
      setResumeResult(null);
      setLastError(error?.message || String(error));
    }
  };

  const clearArtifact = () => {
    window.localStorage.removeItem(P5_CONTINUITY_RESUME_STORAGE_KEY);
    setResumeArtifact(null);
    setResumeValidation(null);
    setResumeResult(null);
    setArtifactBytes(null);
    setLastError("ninguno");
  };

  const resumedExpected = useMemo(() => {
    return Boolean(resumeResult?.checks?.expectedSyntheticReferencesRecovered
      && resumeResult?.checks?.continuityKeyStable);
  }, [resumeResult]);

  const card: React.CSSProperties = { border: "1px solid #d8d0c4", background: "#fff", borderRadius: 18, padding: 18 };
  const button: React.CSSProperties = { border: 0, borderRadius: 14, background: "#173b29", color: "white", padding: "13px 17px", fontWeight: 900, cursor: "pointer" };

  return (
    <main style={{ minHeight: "100vh", background: "#f5f1e8", color: "#28231e", padding: "26px 14px 60px", fontFamily: "Inter,system-ui,sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <section style={{ ...card, boxShadow: "0 18px 50px rgba(60,50,40,.08)" }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".08em", color: "#7c5d20" }}>P5 · REPEATABILITY / RELOAD / REOPEN · SYNTHETIC ONLY</div>
          <h1 style={{ margin: "7px 0 6px", fontSize: 28 }}>Persistencia mínima gobernada</h1>
          <p style={{ margin: 0, color: "#655b50", lineHeight: 1.55 }}>Este arnés prueba si una continuidad sintética ya validada puede recuperarse después de recargar o reabrir el navegador usando sólo un artifact mínimo. El artifact no contiene receipt completo, memoria cruda, transcript, full state ni autoridad.</p>
          <div style={{ marginTop: 10, fontSize: 13 }}>Superficie física: <code>{deviceLabel}</code></div>
          <div style={{ marginTop: 6, fontSize: 13 }}>Handoff URL presente: <code>{handoffPresent ? "YES" : "NO"}</code></div>
          <div style={{ marginTop: 6, fontSize: 13 }}>Artifact persistido: <code>{resumeArtifact ? "PRESENT" : "ABSENT"}</code></div>
        </section>

        {mode === "SOURCE" && (
          <section style={{ ...card, marginTop: 16 }}>
            <h2 style={{ marginTop: 0 }}>A · Repetir PC → teléfono</h2>
            <p>Genera una nueva ejecución sintética sobre el mismo par físico. Este paso prepara la observación de repeatability; no la adjudica automáticamente.</p>
            {!fieldAccess?.fieldAccessReady && (
              <div style={{ padding: 12, borderRadius: 12, background: "#fff7ed", border: "1px solid #fdba74" }}>
                <p style={{ margin: "0 0 10px" }}>Pega el enlace temporal compartible de Vercel. El bridge queda sólo en memoria de esta pestaña y no entra al artifact persistido.</p>
                <input type="password" autoComplete="off" spellCheck={false} value={temporaryAccessLink} onChange={(event) => { const value = event.target.value; setTemporaryAccessLink(value); if (value.trim()) refreshFieldAccess(value); }} placeholder="Enlace temporal de Vercel" aria-label="Enlace temporal de acceso Vercel" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d6b27a", borderRadius: 10, padding: "12px 13px", font: "inherit" }} />
              </div>
            )}
            <button type="button" onClick={createTransport} style={{ ...button, marginTop: 12 }}>1 · Crear nueva prueba de repeatability</button>
            {transportLink && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                <div><strong>Receipt:</strong> <code>{receipt?.receiptId}</code></div>
                <div><strong>Continuity key:</strong> <code>{receipt?.continuityKey}</code></div>
                <div><strong>Integridad:</strong> <code>{receiptValidation?.pass ? "PASS" : "FAIL"}</code></div>
                <button type="button" onClick={copyTransport} style={{ ...button, marginTop: 12, background: "#1d4ed8" }}>{copied ? "Enlace copiado ✓" : "2 · Copiar enlace para teléfono"}</button>
              </div>
            )}
          </section>
        )}

        {mode === "DESTINATION" && (
          <>
            <section style={{ ...card, marginTop: 16, background: receiptValidation?.pass ? "#f0fdf4" : "#fef2f2", borderColor: receiptValidation?.pass ? "#86efac" : "#fecaca" }}>
              <h2 style={{ marginTop: 0 }}>B · Destino físico antes de persistir</h2>
              <div><strong>Receipt recibido:</strong> <code>{receipt ? "YES" : "NO"}</code></div>
              <div><strong>Receipt válido:</strong> <code>{receiptValidation?.pass ? "PASS" : "FAIL"}</code></div>
              <div><strong>Raw memory transportada:</strong> <code>{String(receipt?.rawMemoryContentIncluded)}</code></div>
              <div><strong>Raw transcript transportada:</strong> <code>{String(receipt?.rawTranscriptContentIncluded)}</code></div>
              <button type="button" disabled={!receiptValidation?.pass} onClick={consumeBaseline} style={{ ...button, marginTop: 14, opacity: receiptValidation?.pass ? 1 : 0.45 }}>3 · Consumir baseline en este teléfono</button>
              {baselineConsumption && (
                <div style={{ marginTop: 12 }}>
                  <div><strong>Memorias recuperadas:</strong> <code>{baselineConsumption.memoryIds.join(", ")}</code></div>
                  <div><strong>Continuity key:</strong> <code>{baselineConsumption.continuityKey}</code></div>
                  <strong style={{ color: baselineExpected ? "#166534" : "#991b1b" }}>{baselineExpected ? "BASELINE REPEATABILITY: resultado esperado observado." : "Resultado inesperado: no persistir."}</strong>
                </div>
              )}
            </section>

            <section style={{ ...card, marginTop: 16 }}>
              <h2 style={{ marginTop: 0 }}>C · Persistir sólo artifact mínimo</h2>
              <p>Este paso guarda únicamente metadatos comprometidos para reconstrucción y elimina el <code>#handoff</code> de la URL. Después del reload, el receipt original ya no estará disponible en la dirección.</p>
              <button type="button" disabled={!baselineExpected} onClick={persistMinimalArtifact} style={{ ...button, opacity: baselineExpected ? 1 : 0.45 }}>4 · Persistir artifact y limpiar handoff</button>
              {resumeArtifact && (
                <div style={{ marginTop: 14, lineHeight: 1.55 }}>
                  <div><strong>Artifact bytes:</strong> <code>{artifactBytes}</code></div>
                  <div><strong>Artifact digest:</strong> <code>{resumeArtifact.artifactDigest}</code></div>
                  <div><strong>Receipt digest comprometido:</strong> <code>{resumeArtifact.receiptDigest}</code></div>
                  <div><strong>Continuity key:</strong> <code>{resumeArtifact.continuityKey}</code></div>
                  <div><strong>Raw memory persistida:</strong> <code>false</code></div>
                  <div><strong>Raw transcript persistida:</strong> <code>false</code></div>
                  <div><strong>Full state persistido:</strong> <code>false</code></div>
                  <div><strong>Authority persistida:</strong> <code>false</code></div>
                  <div><strong>Handoff URL presente:</strong> <code>{handoffPresent ? "YES" : "NO"}</code></div>
                  <div><strong>Validación artifact:</strong> <code>{resumeValidation?.pass ? "PASS" : "FAIL"}</code></div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                    <button type="button" onClick={() => window.location.reload()} style={{ ...button, background: "#1d4ed8" }}>5A · Recargar página ahora</button>
                    <button type="button" onClick={copyCleanUrl} style={{ ...button, background: "#475569" }}>{cleanUrlCopied ? "URL limpia copiada ✓" : "5B · Copiar URL limpia para cierre/reapertura"}</button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {mode === "RESUME" && (
          <section style={{ ...card, marginTop: 16, background: resumeValidation?.pass ? "#f0fdf4" : "#fef2f2", borderColor: resumeValidation?.pass ? "#86efac" : "#fecaca" }}>
            <h2 style={{ marginTop: 0 }}>D · Recuperación sin handoff</h2>
            <div><strong>Handoff URL presente:</strong> <code>{handoffPresent ? "YES" : "NO"}</code></div>
            <div><strong>Artifact:</strong> <code>{resumeArtifact ? "PRESENT" : "UNREADABLE"}</code></div>
            <div><strong>Artifact bytes:</strong> <code>{artifactBytes ?? "n/a"}</code></div>
            <div><strong>Artifact válido/no expirado:</strong> <code>{resumeValidation?.pass ? "PASS" : "FAIL"}</code></div>
            {resumeArtifact && <div><strong>Continuity key:</strong> <code>{resumeArtifact.continuityKey}</code></div>}
            <button type="button" disabled={!resumeValidation?.pass} onClick={resumeFromArtifact} style={{ ...button, marginTop: 14, opacity: resumeValidation?.pass ? 1 : 0.45 }}>6 · Reconstruir y consumir sólo desde artifact</button>
            {resumeResult && (
              <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "white", border: "1px solid #86efac", lineHeight: 1.55 }}>
                <div><strong>Receipt reconstruido:</strong> <code>{resumeResult.reconstructedReceipt.receiptId}</code></div>
                <div><strong>Receipt digest:</strong> <code>{resumeResult.reconstructedReceipt.receiptDigest}</code></div>
                <div><strong>Memorias recuperadas:</strong> <code>{resumeResult.consumption.memoryIds.join(", ")}</code></div>
                <div><strong>Continuity key:</strong> <code>{resumeResult.consumption.continuityKey}</code></div>
                <div><strong>Raw memory persistida:</strong> <code>{String(resumeResult.checks.rawMemoryPersisted)}</code></div>
                <div><strong>Raw transcript persistida:</strong> <code>{String(resumeResult.checks.rawTranscriptPersisted)}</code></div>
                <div><strong>Full state persistido:</strong> <code>{String(resumeResult.checks.fullStatePersisted)}</code></div>
                <div><strong>Authority persistida:</strong> <code>{String(resumeResult.checks.authorityPersisted)}</code></div>
                <div style={{ marginTop: 10, fontWeight: 900, color: resumedExpected ? "#166534" : "#991b1b" }}>{resumedExpected ? "RESULTADO ESPERADO OBSERVADO TRAS RECONSTRUCCIÓN." : "Resultado inesperado: NO adjudicar PASS."}</div>
              </div>
            )}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #d8d0c4" }}>
              <p style={{ marginTop: 0 }}>Para el gate de <strong>close/reopen</strong>: con el artifact persistido y el handoff ausente, cierra completamente el navegador, vuelve a abrir la URL limpia y ejecuta nuevamente el paso 6. La adjudicación sigue siendo manual y física.</p>
              <button type="button" onClick={clearArtifact} style={{ ...button, background: "#7f1d1d" }}>Borrar artifact de prueba</button>
            </div>
          </section>
        )}

        <section style={{ ...card, marginTop: 16, background: lastError === "ninguno" ? "#f0fdf4" : "#fef2f2", borderColor: lastError === "ninguno" ? "#bbf7d0" : "#fecaca" }}><strong>Último error:</strong> {lastError}</section>
        <p style={{ fontSize: 12, color: "#6b6258", lineHeight: 1.5 }}>P5_BIDIRECTIONAL_PHYSICAL_CONTINUITY=PASS_BOUNDED · P5_REPEATABILITY_RELOAD_RECONNECT=PHYSICAL_PENDING · REAL_OWNER_MEMORY=NOT_STARTED · PRODUCTION_MUTATION=FALSE · SCIENTIFIC_ROOTS_MINTED=0.</p>
      </div>
    </main>
  );
}
