"use client";

import { useEffect, useMemo, useState } from "react";
// @ts-ignore continuity modules
import { createSessionContinuationReceipt } from "../../lib/domiMultiSurfaceContinuity.mjs";
// @ts-ignore synthetic fixture
import {
  seedP5SyntheticDesktopState,
  P5_SYNTHETIC_PERSON_ID,
  P5_SOURCE_SESSION_ID,
  P5_PRIVATE_TURN_ID,
  P5_SHARED_TURN_ID,
  P5_QUERY,
  P5_AUTHORIZED_SCOPES,
} from "../../lib/domiP5SyntheticFixture.mjs";
// @ts-ignore resume artifact
import {
  P5_FORWARD_RECEIPT_PURPOSE,
  createP5ContinuityResumeArtifact,
  serializeP5ContinuityResumeArtifact,
  parseP5ContinuityResumeArtifact,
  validateP5ContinuityResumeArtifact,
  reconstructP5ContinuityFromResumeArtifact,
} from "../../lib/domiP5ContinuityResumeArtifact.mjs";
// @ts-ignore device matrix classifier
import {
  classifyP5BrowserEnvironment,
  P5_DEVICE_MATRIX_SPECS,
} from "../../lib/domiP5DeviceMatrix.mjs";
// @ts-ignore field beta operations
import {
  P5_FIELD_BETA_ARTIFACT_STORAGE_KEY,
  P5_FIELD_BETA_SESSION_STORAGE_KEY,
  P5_FIELD_BETA_CANONICAL_CONTINUITY_KEY,
  P5_FIELD_BETA_SUPPORT_CONTRACT,
  admitP5FieldBetaSession,
  classifyP5FieldBetaIncident,
  adjudicateP5FieldBetaSession,
} from "../../lib/domiP5FieldBetaOps.mjs";

const TTL_MINUTES = 120;

function nowIso() {
  return new Date().toISOString();
}

function plusMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function nonce() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replaceAll("-", "");
  return `p5${Date.now()}${Math.random().toString(16).slice(2)}`;
}

function sourceReplay(artifact: any) {
  const state = seedP5SyntheticDesktopState({ baseTime: artifact.fixtureBaseTime });
  const receipt = createSessionContinuationReceipt(state, {
    receiptId: artifact.receiptId,
    sourceSessionId: P5_SOURCE_SESSION_ID,
    personId: P5_SYNTHETIC_PERSON_ID,
    targetSurfaceClass: "PERSONAL_MOBILE",
    purpose: P5_FORWARD_RECEIPT_PURPOSE,
    query: P5_QUERY,
    authorizedScopes: [...P5_AUTHORIZED_SCOPES],
    transferableTurnIds: [P5_PRIVATE_TURN_ID, P5_SHARED_TURN_ID],
    createdAt: artifact.receiptCreatedAt,
    expiresAt: artifact.receiptExpiresAt,
  });
  return {
    pass: receipt.receiptDigest === artifact.receiptDigest
      && receipt.continuityKey === artifact.continuityKey,
    receiptId: receipt.receiptId,
    receiptDigest: receipt.receiptDigest,
    artifactDigest: artifact.artifactDigest,
    continuityKey: receipt.continuityKey,
    projectedMemoryIds: [...(receipt.projectedMemoryIds ?? [])],
    rawMemoryPersisted: false,
    rawTranscriptPersisted: false,
    fullStatePersisted: false,
    authorityPersisted: false,
  };
}

function destinationReplay(artifact: any, stage: string) {
  const result = reconstructP5ContinuityFromResumeArtifact(artifact, {
    now: nowIso(),
    targetSessionId: `P5-BETA-OPS-${stage}-${Date.now()}`,
  });
  return {
    pass: Boolean(
      result.checks.expectedSyntheticReferencesRecovered
      && result.checks.continuityKeyStable
    ),
    receiptId: result.reconstructedReceipt.receiptId,
    receiptDigest: result.reconstructedReceipt.receiptDigest,
    artifactDigest: artifact.artifactDigest,
    continuityKey: result.consumption.continuityKey,
    memoryIds: [...result.consumption.memoryIds],
    rawMemoryPersisted: result.checks.rawMemoryPersisted,
    rawTranscriptPersisted: result.checks.rawTranscriptPersisted,
    fullStatePersisted: result.checks.fullStatePersisted,
    authorityPersisted: result.checks.authorityPersisted,
  };
}

async function runPreviewProbe(stage: string) {
  const clientNonce = nonce();
  const response = await fetch(
    `/api/p5-field-beta-preflight?nonce=${encodeURIComponent(clientNonce)}`,
    {
      method: "GET",
      cache: "no-store",
      headers: { "x-domi-p5-field-beta-stage": stage },
    },
  );
  const body = await response.json();
  return {
    ok: response.ok && body?.ok === true,
    status: response.status,
    previewEnvironmentPass: body?.previewEnvironmentPass === true,
    probeId: body?.probeId ?? "",
    clientNonce: body?.clientNonce ?? clientNonce,
    serverTime: body?.serverTime ?? "",
    vercelEnv: body?.vercelEnv ?? "unknown",
    commitSha: body?.commitSha ?? null,
    error: body?.error ?? null,
  };
}

export default function OwnerAlphaFieldBetaOpsHarness() {
  const [environment, setEnvironment] = useState<any | null>(null);
  const [cell, setCell] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<any | null>(null);
  const [artifactValidation, setArtifactValidation] = useState<any | null>(null);
  const [preProbe, setPreProbe] = useState<any | null>(null);
  const [postProbe, setPostProbe] = useState<any | null>(null);
  const [baselineContinuity, setBaselineContinuity] = useState<any | null>(null);
  const [admission, setAdmission] = useState<any | null>(null);
  const [sessionResult, setSessionResult] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState("ninguno");

  useEffect(() => {
    try {
      const detected = classifyP5BrowserEnvironment({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      });
      setEnvironment(detected);
      const supported = detected.suggestedCell
        && Object.prototype.hasOwnProperty.call(
          P5_FIELD_BETA_SUPPORT_CONTRACT.supportedCells,
          detected.suggestedCell,
        )
        ? detected.suggestedCell
        : null;
      setCell(supported);

      let currentArtifact: any | null = null;
      const stored = localStorage.getItem(P5_FIELD_BETA_ARTIFACT_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = parseP5ContinuityResumeArtifact(stored);
          const checked = validateP5ContinuityResumeArtifact(parsed, { now: nowIso() });
          if (checked.pass) currentArtifact = parsed;
        } catch {
          localStorage.removeItem(P5_FIELD_BETA_ARTIFACT_STORAGE_KEY);
        }
      }
      if (!currentArtifact) {
        const fixtureBaseTime = new Date(Date.now() - 15_000).toISOString();
        const state = seedP5SyntheticDesktopState({ baseTime: fixtureBaseTime });
        const receipt = createSessionContinuationReceipt(state, {
          receiptId: `P5-BETA-OPS-${Date.now()}`,
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
        currentArtifact = createP5ContinuityResumeArtifact({ receipt, fixtureBaseTime });
        localStorage.setItem(
          P5_FIELD_BETA_ARTIFACT_STORAGE_KEY,
          serializeP5ContinuityResumeArtifact(currentArtifact),
        );
      }
      setArtifact(currentArtifact);
      setArtifactValidation(validateP5ContinuityResumeArtifact(currentArtifact, { now: nowIso() }));
    } catch (error: any) {
      setLastError(error?.message || String(error));
    }
  }, []);

  const spec = useMemo(() => cell ? P5_DEVICE_MATRIX_SPECS[cell] : null, [cell]);

  const runContinuity = (stage: string) => {
    if (!artifact || !spec) throw new Error("P5_FIELD_BETA_SUPPORTED_CELL_REQUIRED");
    return spec.role === "DESTINATION"
      ? destinationReplay(artifact, stage)
      : sourceReplay(artifact);
  };

  const beginSession = async () => {
    if (!artifact || !artifactValidation?.pass || !environment || !cell || !spec) return;
    setBusy(true);
    setLastError("ninguno");
    try {
      const probe = await runPreviewProbe("BEGIN");
      if (!probe.ok) throw new Error(probe.error || "P5_FIELD_BETA_PREFLIGHT_FAILED");
      const continuity = runContinuity("BEGIN");
      const admitted = admitP5FieldBetaSession({
        cell,
        previewEnvironmentPass: probe.previewEnvironmentPass,
        syntheticOnly: true,
        operatorBoundaryConfirmed: true,
        artifactValidationPass: artifactValidation.pass,
        continuityKey: continuity.continuityKey,
        realOwnerMemoryUsed: false,
        productionMutationRequested: false,
        externalOutreachRequested: false,
        rawMemoryPersisted: continuity.rawMemoryPersisted,
        rawTranscriptPersisted: continuity.rawTranscriptPersisted,
        fullStatePersisted: continuity.fullStatePersisted,
        authorityPersisted: continuity.authorityPersisted,
        detectedPlatformClass: environment.platformClass,
        detectedBrowserClass: environment.browserClass,
        role: spec.role,
      });
      setPreProbe(probe);
      setBaselineContinuity(continuity);
      setAdmission(admitted);
      setSessionResult(null);
      setPostProbe(null);
      localStorage.setItem(P5_FIELD_BETA_SESSION_STORAGE_KEY, JSON.stringify({
        sessionId: `P5-BETA-SESSION-${Date.now()}`,
        startedAt: nowIso(),
        cell,
        role: spec.role,
        preProbeId: probe.probeId,
        receiptDigest: continuity.receiptDigest,
        artifactDigest: continuity.artifactDigest,
        continuityKey: continuity.continuityKey,
        rawContentStored: false,
        productionMutation: false,
        realOwnerMemory: false,
      }));
      if (!admitted.pass) throw new Error(`P5_FIELD_BETA_ADMISSION_HOLD:${admitted.failures.join("|")}`);
    } catch (error: any) {
      setLastError(error?.message || String(error));
    } finally {
      setBusy(false);
    }
  };

  const endSession = async () => {
    if (!admission?.pass || !baselineContinuity) return;
    setBusy(true);
    setLastError("ninguno");
    try {
      const probe = await runPreviewProbe("END");
      if (!probe.ok) throw new Error(probe.error || "P5_FIELD_BETA_POST_PROBE_FAILED");
      const continuity = runContinuity("END");
      const witness = {
        ...continuity,
        receiptStable: continuity.receiptId === baselineContinuity.receiptId
          && continuity.receiptDigest === baselineContinuity.receiptDigest,
        artifactStable: continuity.artifactDigest === baselineContinuity.artifactDigest,
        continuityKeyStable: continuity.continuityKey === baselineContinuity.continuityKey,
      };
      const incident = classifyP5FieldBetaIncident({
        continuityFailure: witness.pass !== true,
        receiptDrift: witness.receiptStable !== true,
        artifactDrift: witness.artifactStable !== true,
        continuityKeyDrift: witness.continuityKeyStable !== true,
        freshProbeFailure: probe.ok !== true,
        rawMemoryObserved: witness.rawMemoryPersisted !== false,
        rawTranscriptObserved: witness.rawTranscriptPersisted !== false,
        fullStateObserved: witness.fullStatePersisted !== false,
        authorityExpansionObserved: witness.authorityPersisted !== false,
        productionMutationObserved: false,
        realOwnerMemoryObserved: false,
      });
      const result = adjudicateP5FieldBetaSession({
        admission,
        preProbe,
        postProbe: probe,
        continuity: witness,
        incident,
        operatorEndConfirmed: true,
      });
      setPostProbe(probe);
      setSessionResult({ ...result, continuity: witness, incident });
      const existing = localStorage.getItem(P5_FIELD_BETA_SESSION_STORAGE_KEY);
      const session = existing ? JSON.parse(existing) : {};
      localStorage.setItem(P5_FIELD_BETA_SESSION_STORAGE_KEY, JSON.stringify({
        ...session,
        endedAt: nowIso(),
        postProbeId: probe.probeId,
        decision: result.decision,
        incidentLevel: incident.level,
        failures: [...result.failures],
      }));
    } catch (error: any) {
      setLastError(error?.message || String(error));
    } finally {
      setBusy(false);
    }
  };

  const clearLocalSession = () => {
    localStorage.removeItem(P5_FIELD_BETA_SESSION_STORAGE_KEY);
    setPreProbe(null);
    setPostProbe(null);
    setBaselineContinuity(null);
    setAdmission(null);
    setSessionResult(null);
    setLastError("ninguno");
  };

  const card: React.CSSProperties = {
    border: "1px solid #d8d0c4",
    background: "#fff",
    borderRadius: 18,
    padding: 18,
  };
  const button: React.CSSProperties = {
    border: 0,
    borderRadius: 14,
    background: "#173b29",
    color: "white",
    padding: "13px 17px",
    fontWeight: 900,
    cursor: "pointer",
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f5f1e8", color: "#28231e", padding: "26px 14px 60px", fontFamily: "Inter,system-ui,sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <section style={{ ...card, boxShadow: "0 18px 50px rgba(60,50,40,.08)" }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".08em", color: "#7c5d20" }}>P5 · BOUNDED FIELD BETA OPERATIONS · SYNTHETIC ONLY</div>
          <h1 style={{ margin: "7px 0 6px", fontSize: 28 }}>Preflight y sesión beta controlada</h1>
          <p style={{ margin: 0, color: "#655b50", lineHeight: 1.55 }}>Este arnés no habilita producción ni memoria real. Sólo admite las celdas físicamente calificadas y exige que el servidor confirme Vercel Preview.</p>
          <div style={{ marginTop: 12 }}><strong>Detectado:</strong> <code>{environment ? `${environment.platformClass} + ${environment.browserClass}` : "detectando..."}</code></div>
          <div><strong>Celda beta soportada:</strong> <code>{cell ?? "NO_SUPPORTED_CELL"}</code></div>
          <div><strong>Rol:</strong> <code>{spec?.role ?? "NONE"}</code></div>
          <div><strong>Artifact:</strong> <code>{artifact ? "PRESENT" : "ABSENT"}</code> · <strong>validación:</strong> <code>{artifactValidation?.pass ? "PASS" : "PENDING"}</code></div>
          {artifact && <><div><strong>Receipt digest:</strong> <code>{artifact.receiptDigest}</code></div><div><strong>Artifact digest:</strong> <code>{artifact.artifactDigest}</code></div><div><strong>Continuity key:</strong> <code>{artifact.continuityKey}</code></div></>}
        </section>

        <section style={{ ...card, marginTop: 16, background: cell ? "#f0fdf4" : "#fef2f2", borderColor: cell ? "#86efac" : "#fecaca" }}>
          <h2 style={{ marginTop: 0 }}>1 · Contrato de entrada</h2>
          <div><strong>FIELD_BETA_READY:</strong> <code>PASS_BOUNDED</code></div>
          <div><strong>Preview only:</strong> <code>true</code></div>
          <div><strong>Synthetic only:</strong> <code>true</code></div>
          <div><strong>Real owner memory:</strong> <code>FORBIDDEN / NOT_STARTED</code></div>
          <div><strong>Production mutation:</strong> <code>FORBIDDEN</code></div>
          <div><strong>External outreach:</strong> <code>NOT_AUTHORIZED</code></div>
          <div><strong>Universal compatibility:</strong> <code>false</code></div>
          {!cell && <p style={{ fontWeight: 900, color: "#991b1b" }}>Este navegador/SO no pertenece a la matriz beta soportada. La sesión queda HOLD.</p>}
        </section>

        <section style={{ ...card, marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>2 · Preflight + admisión</h2>
          <p>Ejecuta un probe fresco al servidor. El servidor debe responder que el entorno es <code>preview</code>; después se valida continuidad sintética y la frontera del contrato.</p>
          <button type="button" disabled={!cell || !artifactValidation?.pass || busy} onClick={beginSession} style={{ ...button, opacity: !cell || !artifactValidation?.pass || busy ? 0.45 : 1 }}>
            {busy ? "Verificando..." : "Confirmo frontera beta y ejecutar PRE"}
          </button>
          {preProbe && (
            <div style={{ marginTop: 14, lineHeight: 1.55 }}>
              <div><strong>Preview server:</strong> <code>{preProbe.previewEnvironmentPass ? "PASS" : "FAIL"} · {preProbe.vercelEnv}</code></div>
              <div><strong>Probe:</strong> <code>{preProbe.ok ? "PASS" : "FAIL"} · {preProbe.probeId}</code></div>
              <div><strong>Commit:</strong> <code>{preProbe.commitSha ?? "n/a"}</code></div>
              <div><strong>Continuidad:</strong> <code>{baselineContinuity?.pass ? "PASS" : "FAIL"}</code></div>
              <div><strong>Admisión:</strong> <code>{admission?.decision}</code></div>
              <div><strong>Fallos:</strong> <code>{admission?.failures?.length ? admission.failures.join(" | ") : "ninguno"}</code></div>
            </div>
          )}
        </section>

        {admission?.pass && (
          <section style={{ ...card, marginTop: 16, background: "#eff6ff", borderColor: "#bfdbfe" }}>
            <h2 style={{ marginTop: 0 }}>3 · Cerrar sesión sintética</h2>
            <p>Este cierre hace un segundo probe fresco y vuelve a reconstruir/reproducir continuidad. No almacena contenido de memoria ni transcript.</p>
            <button type="button" disabled={busy} onClick={endSession} style={{ ...button, background: "#1d4ed8", opacity: busy ? 0.45 : 1 }}>Confirmo cierre y ejecutar POST</button>
            {postProbe && <div style={{ marginTop: 12 }}><strong>POST probe:</strong> <code>PASS · {postProbe.probeId}</code></div>}
          </section>
        )}

        {sessionResult && (
          <section style={{ ...card, marginTop: 16, background: sessionResult.pass ? "#f0fdf4" : "#fef2f2", borderColor: sessionResult.pass ? "#86efac" : "#fecaca" }}>
            <h2 style={{ marginTop: 0 }}>4 · Adjudicación operacional</h2>
            <div><strong>Decisión:</strong> <code>{sessionResult.decision}</code></div>
            <div><strong>Incident level:</strong> <code>{sessionResult.incident.level}</code></div>
            <div><strong>Receipt estable:</strong> <code>{sessionResult.continuity.receiptStable ? "YES" : "NO"}</code></div>
            <div><strong>Artifact estable:</strong> <code>{sessionResult.continuity.artifactStable ? "YES" : "NO"}</code></div>
            <div><strong>Continuity key estable:</strong> <code>{sessionResult.continuity.continuityKeyStable ? "YES" : "NO"}</code></div>
            <div><strong>Fallos:</strong> <code>{sessionResult.failures.length ? sessionResult.failures.join(" | ") : "ninguno"}</code></div>
            <div style={{ marginTop: 10, fontWeight: 900 }}>{sessionResult.pass ? "SESIÓN BETA SINTÉTICA CERRADA PASS_BOUNDED." : "SESIÓN HOLD/STOP SEGÚN PROTOCOLO."}</div>
          </section>
        )}

        <section style={{ ...card, marginTop: 16, background: lastError === "ninguno" ? "#f0fdf4" : "#fef2f2", borderColor: lastError === "ninguno" ? "#bbf7d0" : "#fecaca" }}><strong>Último error:</strong> {lastError}</section>
        <section style={{ ...card, marginTop: 16 }}>
          <button type="button" onClick={clearLocalSession} style={{ ...button, background: "#7f1d1d" }}>Limpiar sólo witness local de sesión</button>
          <p style={{ marginBottom: 0, fontSize: 13 }}>No cambia producción, no borra PASS físicos previos y no habilita memoria real. Sólo elimina el witness sintético local de esta sesión operativa.</p>
        </section>
      </div>
    </main>
  );
}
