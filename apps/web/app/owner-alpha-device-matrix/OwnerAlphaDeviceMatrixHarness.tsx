"use client";

import { useEffect, useMemo, useState } from "react";
// @ts-ignore deterministic continuity modules
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
// @ts-ignore governed resume artifact
import {
  P5_FORWARD_RECEIPT_PURPOSE,
  createP5ContinuityResumeArtifact,
  serializeP5ContinuityResumeArtifact,
  parseP5ContinuityResumeArtifact,
  validateP5ContinuityResumeArtifact,
  reconstructP5ContinuityFromResumeArtifact,
} from "../../lib/domiP5ContinuityResumeArtifact.mjs";
// @ts-ignore device matrix adjudicator
import {
  P5_DEVICE_MATRIX_ARTIFACT_STORAGE_KEY,
  P5_DEVICE_MATRIX_BASELINE_PREFIX,
  P5_DEVICE_MATRIX_RESULT_PREFIX,
  P5_DEVICE_MATRIX_CELLS,
  P5_DEVICE_MATRIX_SPECS,
  classifyP5BrowserEnvironment,
  adjudicateP5DeviceMatrixCell,
} from "../../lib/domiP5DeviceMatrix.mjs";

const TTL_MINUTES = 180;

function nowIso() {
  return new Date().toISOString();
}

function plusMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function makeNonce() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replaceAll("-", "");
  return `p5${Date.now()}${Math.random().toString(16).slice(2)}`;
}

function baselineKey(cell: string) {
  return `${P5_DEVICE_MATRIX_BASELINE_PREFIX}${cell}`;
}

function resultKey(cell: string) {
  return `${P5_DEVICE_MATRIX_RESULT_PREFIX}${cell}`;
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
    pass: receipt.receiptDigest === artifact.receiptDigest && receipt.continuityKey === artifact.continuityKey,
    sourceReplayPass: receipt.receiptDigest === artifact.receiptDigest && receipt.continuityKey === artifact.continuityKey,
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

export default function OwnerAlphaDeviceMatrixHarness() {
  const [environment, setEnvironment] = useState<any | null>(null);
  const [cell, setCell] = useState<string>(P5_DEVICE_MATRIX_CELLS.ANDROID_CHROME_DESTINATION);
  const [artifact, setArtifact] = useState<any | null>(null);
  const [artifactBytes, setArtifactBytes] = useState<number | null>(null);
  const [artifactValidation, setArtifactValidation] = useState<any | null>(null);
  const [baseline, setBaseline] = useState<any | null>(null);
  const [after, setAfter] = useState<any | null>(null);
  const [adjudication, setAdjudication] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastError, setLastError] = useState("ninguno");

  useEffect(() => {
    const detected = classifyP5BrowserEnvironment({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    });
    setEnvironment(detected);
    if (detected.suggestedCell) setCell(detected.suggestedCell);

    try {
      let currentArtifact: any | null = null;
      const stored = window.localStorage.getItem(P5_DEVICE_MATRIX_ARTIFACT_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = parseP5ContinuityResumeArtifact(stored);
          const checked = validateP5ContinuityResumeArtifact(parsed, { now: nowIso() });
          if (checked.pass) currentArtifact = parsed;
        } catch {
          window.localStorage.removeItem(P5_DEVICE_MATRIX_ARTIFACT_STORAGE_KEY);
        }
      }

      if (!currentArtifact) {
        const fixtureBaseTime = new Date(Date.now() - 15_000).toISOString();
        const state = seedP5SyntheticDesktopState({ baseTime: fixtureBaseTime });
        const receipt = createSessionContinuationReceipt(state, {
          receiptId: `P5-MATRIX-${Date.now()}`,
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
        window.localStorage.setItem(
          P5_DEVICE_MATRIX_ARTIFACT_STORAGE_KEY,
          serializeP5ContinuityResumeArtifact(currentArtifact),
        );
      }

      const serialized = serializeP5ContinuityResumeArtifact(currentArtifact);
      setArtifact(currentArtifact);
      setArtifactBytes(new Blob([serialized]).size);
      setArtifactValidation(validateP5ContinuityResumeArtifact(currentArtifact, { now: nowIso() }));
    } catch (error: any) {
      setLastError(error?.message || String(error));
    }
  }, []);

  useEffect(() => {
    if (!cell) return;
    try {
      const savedBaseline = window.localStorage.getItem(baselineKey(cell));
      const savedResult = window.localStorage.getItem(resultKey(cell));
      setBaseline(savedBaseline ? JSON.parse(savedBaseline) : null);
      if (savedResult) {
        const parsed = JSON.parse(savedResult);
        setAdjudication(parsed);
      } else {
        setAdjudication(null);
      }
      setAfter(null);
      setCopied(false);
      setLastError("ninguno");
    } catch (error: any) {
      setLastError(error?.message || String(error));
    }
  }, [cell]);

  const spec = useMemo(() => P5_DEVICE_MATRIX_SPECS[cell], [cell]);
  const detectedMatches = Boolean(
    environment
    && spec
    && environment.platformClass === spec.platformClass
    && environment.browserClass === spec.browserClass
  );

  const runObservation = async (stage: "BASELINE" | "RELOAD" | "REOPEN", transitionConfirmed: boolean) => {
    if (!artifact || !spec || !environment) return;
    setBusy(true);
    setLastError("ninguno");
    try {
      const checked = validateP5ContinuityResumeArtifact(artifact, { now: nowIso() });
      if (!checked.pass) throw new Error(`DEVICE_MATRIX_ARTIFACT_INVALID:${checked.failures.join("|")}`);

      const nonce = makeNonce();
      const response = await fetch(`/api/p5-network-probe?nonce=${encodeURIComponent(nonce)}`, {
        method: "GET",
        cache: "no-store",
        headers: { "x-domi-p5-device-matrix-stage": stage },
      });
      const probe = await response.json();
      if (!response.ok || probe?.ok !== true || probe?.clientNonce !== nonce) {
        throw new Error(`DEVICE_MATRIX_PROBE_FAILED:${response.status}`);
      }

      let continuity: any;
      if (spec.role === "DESTINATION") {
        const reconstructed = reconstructP5ContinuityFromResumeArtifact(artifact, {
          now: nowIso(),
          targetSessionId: `P5-MATRIX-${stage}-${Date.now()}`,
        });
        continuity = {
          pass: Boolean(
            reconstructed.checks.expectedSyntheticReferencesRecovered
            && reconstructed.checks.continuityKeyStable
          ),
          receiptId: reconstructed.reconstructedReceipt.receiptId,
          receiptDigest: reconstructed.reconstructedReceipt.receiptDigest,
          artifactDigest: artifact.artifactDigest,
          continuityKey: reconstructed.consumption.continuityKey,
          memoryIds: [...reconstructed.consumption.memoryIds],
          rawMemoryPersisted: reconstructed.checks.rawMemoryPersisted,
          rawTranscriptPersisted: reconstructed.checks.rawTranscriptPersisted,
          fullStatePersisted: reconstructed.checks.fullStatePersisted,
          authorityPersisted: reconstructed.checks.authorityPersisted,
        };
      } else {
        continuity = sourceReplay(artifact);
      }

      const observation = {
        stage,
        cell,
        selectedCell: cell,
        ownerPhysicalEnvironmentConfirmed: true,
        ownerTransitionConfirmed: transitionConfirmed,
        detectedPlatformClass: environment.platformClass,
        detectedBrowserClass: environment.browserClass,
        role: spec.role,
        browserOnline: navigator.onLine === true,
        handoffPresent: window.location.hash.startsWith("#handoff="),
        observedAt: nowIso(),
        probe: {
          ok: probe.ok === true,
          status: response.status,
          probeId: probe.probeId,
          clientNonce: probe.clientNonce,
          serverTime: probe.serverTime,
        },
        continuity,
      };

      if (stage === "BASELINE") {
        window.localStorage.setItem(baselineKey(cell), JSON.stringify(observation));
        window.localStorage.removeItem(resultKey(cell));
        setBaseline(observation);
        setAfter(null);
        setAdjudication(null);
      } else {
        if (!baseline) throw new Error("DEVICE_MATRIX_BASELINE_REQUIRED");
        const result = adjudicateP5DeviceMatrixCell({ cell, baseline, after: observation });
        setAfter(observation);
        setAdjudication(result);
        window.localStorage.setItem(resultKey(cell), JSON.stringify(result));
      }
    } catch (error: any) {
      setLastError(error?.message || String(error));
    } finally {
      setBusy(false);
    }
  };

  const copyCleanUrl = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}`);
      setCopied(true);
      setLastError("ninguno");
    } catch (error: any) {
      setLastError(error?.message || String(error));
    }
  };

  const resetCell = () => {
    window.localStorage.removeItem(baselineKey(cell));
    window.localStorage.removeItem(resultKey(cell));
    setBaseline(null);
    setAfter(null);
    setAdjudication(null);
    setCopied(false);
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
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".08em", color: "#7c5d20" }}>P5 · SUPPORTED BROWSER / OS / DEVICE MATRIX · SYNTHETIC ONLY</div>
          <h1 style={{ margin: "7px 0 6px", fontSize: 28 }}>Matriz física de compatibilidad acotada</h1>
          <p style={{ margin: 0, color: "#655b50", lineHeight: 1.55 }}>Una celda PASS sólo habilita esa combinación física. Las combinaciones no probadas quedan NOT_TESTED_NOT_SUPPORTED. No existe claim universal por similitud de navegador o sistema operativo.</p>
          <div style={{ marginTop: 12 }}><strong>Detectado:</strong> <code>{environment ? `${environment.platformClass} + ${environment.browserClass}` : "detectando..."}</code></div>
          <div><strong>Celda sugerida:</strong> <code>{environment?.suggestedCell ?? "NONE"}</code></div>
          <div><strong>Artifact:</strong> <code>{artifact ? "PRESENT" : "ABSENT"}</code> · <strong>bytes:</strong> <code>{artifactBytes ?? "n/a"}</code> · <strong>validación:</strong> <code>{artifactValidation?.pass ? "PASS" : "PENDING"}</code></div>
          {artifact && <><div><strong>Receipt:</strong> <code>{artifact.receiptId}</code></div><div><strong>Receipt digest:</strong> <code>{artifact.receiptDigest}</code></div><div><strong>Artifact digest:</strong> <code>{artifact.artifactDigest}</code></div><div><strong>Continuity key:</strong> <code>{artifact.continuityKey}</code></div></>}
        </section>

        <section style={{ ...card, marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>1 · Selecciona la celda física</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {Object.entries(P5_DEVICE_MATRIX_SPECS).map(([key, value]: any) => (
              <button key={key} type="button" onClick={() => setCell(key)} style={{ ...button, textAlign: "left", background: cell === key ? "#173b29" : "#64748b" }}>
                {value.label} · {value.afterStage}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}><strong>Celda activa:</strong> <code>{cell}</code></div>
          <div><strong>Coincidencia física detectada:</strong> <code>{detectedMatches ? "YES" : "NO"}</code></div>
          {!detectedMatches && <p style={{ color: "#991b1b", fontWeight: 800 }}>Esta celda no puede adjudicarse desde este navegador/dispositivo. Abre la misma ruta en la combinación correspondiente.</p>}
        </section>

        <section style={{ ...card, marginTop: 16, background: "#fff7ed", borderColor: "#fdba74" }}>
          <h2 style={{ marginTop: 0 }}>2 · BASELINE físico</h2>
          <p>Confirma que estás realmente usando <strong>{spec?.label}</strong>. DOMI hará un probe fresco y verificará el contrato de continuidad correspondiente al rol <code>{spec?.role}</code>.</p>
          <button type="button" disabled={!artifact || !detectedMatches || busy} onClick={() => runObservation("BASELINE", false)} style={{ ...button, opacity: !artifact || !detectedMatches || busy ? 0.45 : 1 }}>
            {busy ? "Midiendo..." : "Confirmo entorno físico y ejecutar BASELINE"}
          </button>
          {baseline && (
            <div style={{ marginTop: 14, lineHeight: 1.55 }}>
              <div><strong>Probe:</strong> <code>PASS · {baseline.probe.probeId}</code></div>
              <div><strong>Continuidad:</strong> <code>{baseline.continuity.pass ? "PASS" : "FAIL"}</code></div>
              <div><strong>Receipt digest:</strong> <code>{baseline.continuity.receiptDigest}</code></div>
              <div><strong>Continuity key:</strong> <code>{baseline.continuity.continuityKey}</code></div>
              {spec?.role === "DESTINATION"
                ? <div><strong>Referencias:</strong> <code>{baseline.continuity.memoryIds.join(", ")}</code></div>
                : <div><strong>Referencias proyectadas:</strong> <code>{baseline.continuity.projectedMemoryIds.join(", ")}</code></div>}
            </div>
          )}
        </section>

        {baseline && (
          <section style={{ ...card, marginTop: 16, background: "#eff6ff", borderColor: "#bfdbfe" }}>
            <h2 style={{ marginTop: 0 }}>3 · {spec?.afterStage === "REOPEN" ? "Cierre completo + reapertura" : "Reload"}</h2>
            {spec?.afterStage === "REOPEN" ? (
              <>
                <p>La celda móvil exige una reapertura física completa. Copia la URL limpia, cierra completamente el navegador desde aplicaciones recientes, vuelve a abrir el navegador, abre la URL y regresa a esta misma celda. El baseline está guardado sólo como witness sintético local.</p>
                <button type="button" onClick={copyCleanUrl} style={{ ...button, background: "#475569" }}>{copied ? "URL limpia copiada ✓" : "Copiar URL limpia"}</button>
                <button type="button" disabled={busy || !detectedMatches} onClick={() => runObservation("REOPEN", true)} style={{ ...button, marginLeft: 10, opacity: busy || !detectedMatches ? 0.45 : 1 }}>Confirmo cierre/reapertura y ejecutar POST</button>
              </>
            ) : (
              <>
                <p>La celda PC exige una recarga real manteniendo el mismo artifact sintético.</p>
                <button type="button" onClick={() => window.location.reload()} style={{ ...button, background: "#1d4ed8" }}>Recargar página ahora</button>
                <button type="button" disabled={busy || !detectedMatches} onClick={() => runObservation("RELOAD", true)} style={{ ...button, marginLeft: 10, opacity: busy || !detectedMatches ? 0.45 : 1 }}>Confirmo reload y ejecutar POST</button>
              </>
            )}
          </section>
        )}

        {after && (
          <section style={{ ...card, marginTop: 16 }}>
            <h2 style={{ marginTop: 0 }}>4 · POST</h2>
            <div><strong>Stage:</strong> <code>{after.stage}</code></div>
            <div><strong>Probe fresco:</strong> <code>PASS · {after.probe.probeId}</code></div>
            <div><strong>Continuidad:</strong> <code>{after.continuity.pass ? "PASS" : "FAIL"}</code></div>
            <div><strong>Receipt estable:</strong> <code>{baseline?.continuity.receiptDigest === after.continuity.receiptDigest ? "YES" : "NO"}</code></div>
            <div><strong>Artifact estable:</strong> <code>{baseline?.continuity.artifactDigest === after.continuity.artifactDigest ? "YES" : "NO"}</code></div>
            <div><strong>Continuity key estable:</strong> <code>{baseline?.continuity.continuityKey === after.continuity.continuityKey ? "YES" : "NO"}</code></div>
          </section>
        )}

        {adjudication && (
          <section style={{ ...card, marginTop: 16, background: adjudication.pass ? "#f0fdf4" : "#fef2f2", borderColor: adjudication.pass ? "#86efac" : "#fecaca" }}>
            <h2 style={{ marginTop: 0 }}>5 · Adjudicación de celda</h2>
            <div><strong>Resultado:</strong> <code>{adjudication.pass ? "PASS_BOUNDED" : "HOLD"}</code></div>
            <div><strong>Claim:</strong> <code>{adjudication.claim}</code></div>
            <div><strong>Boundary:</strong> <code>{adjudication.supportBoundary}</code></div>
            <div><strong>Fallos:</strong> <code>{adjudication.failures.length ? adjudication.failures.join(" | ") : "ninguno"}</code></div>
            <p style={{ marginBottom: 0, fontWeight: 900 }}>{adjudication.pass ? "CELDA FÍSICA SOPORTADA DE FORMA ACOTADA." : "NO añadir esta celda a la matriz soportada."}</p>
          </section>
        )}

        <section style={{ ...card, marginTop: 16, background: lastError === "ninguno" ? "#f0fdf4" : "#fef2f2", borderColor: lastError === "ninguno" ? "#bbf7d0" : "#fecaca" }}><strong>Último error:</strong> {lastError}</section>
        <section style={{ ...card, marginTop: 16 }}>
          <button type="button" onClick={resetCell} style={{ ...button, background: "#7f1d1d" }}>Reiniciar sólo esta celda</button>
          <p style={{ marginBottom: 0, fontSize: 13 }}>No borra otros PASS físicos ni cambia producción. REAL_OWNER_MEMORY=NOT_STARTED · PRODUCTION_MUTATION=FALSE · SCIENTIFIC_ROOTS_MINTED=0.</p>
        </section>
      </div>
    </main>
  );
}
