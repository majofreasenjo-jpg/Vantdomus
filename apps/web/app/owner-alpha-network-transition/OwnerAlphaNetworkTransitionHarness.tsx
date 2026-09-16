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
// @ts-ignore network transition adjudicator
import {
  P5_NETWORK_DIRECTIONS,
  P5_NETWORK_GATE_ARTIFACT_STORAGE_KEY,
  adjudicateP5NetworkTransition,
} from "../../lib/domiP5NetworkTransition.mjs";

const TTL_MINUTES = 180;
type Direction = "WIFI_TO_MOBILE_DATA" | "MOBILE_DATA_TO_WIFI";
type NetworkClass = "WIFI" | "MOBILE_DATA";

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

function connectionHint() {
  const connection = (navigator as any).connection;
  if (!connection) return "Network Information API unavailable";
  const parts = [
    connection.type ? `type=${connection.type}` : null,
    connection.effectiveType ? `effectiveType=${connection.effectiveType}` : null,
    Number.isFinite(connection.downlink) ? `downlink=${connection.downlink}` : null,
    Number.isFinite(connection.rtt) ? `rtt=${connection.rtt}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Network Information API present without class signal";
}

function expectedClasses(direction: Direction) {
  return direction === "WIFI_TO_MOBILE_DATA"
    ? { before: "WIFI" as NetworkClass, after: "MOBILE_DATA" as NetworkClass }
    : { before: "MOBILE_DATA" as NetworkClass, after: "WIFI" as NetworkClass };
}

export default function OwnerAlphaNetworkTransitionHarness() {
  const [direction, setDirection] = useState<Direction>(P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA);
  const [deviceLabel, setDeviceLabel] = useState("detectando...");
  const [artifact, setArtifact] = useState<any | null>(null);
  const [artifactValidation, setArtifactValidation] = useState<any | null>(null);
  const [artifactBytes, setArtifactBytes] = useState<number | null>(null);
  const [beforeObservation, setBeforeObservation] = useState<any | null>(null);
  const [afterObservation, setAfterObservation] = useState<any | null>(null);
  const [adjudication, setAdjudication] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState("ninguno");
  const [hint, setHint] = useState("sin medir");

  useEffect(() => {
    setDeviceLabel(`${navigator.platform || "platform?"} · ${window.innerWidth}x${window.innerHeight}`);
    setHint(connectionHint());
    try {
      const stored = window.localStorage.getItem(P5_NETWORK_GATE_ARTIFACT_STORAGE_KEY);
      if (stored) {
        const parsed = parseP5ContinuityResumeArtifact(stored);
        const checked = validateP5ContinuityResumeArtifact(parsed, { now: nowIso() });
        if (checked.pass) {
          setArtifact(parsed);
          setArtifactValidation(checked);
          setArtifactBytes(new Blob([stored]).size);
          return;
        }
      }

      const fixtureBaseTime = new Date(Date.now() - 15_000).toISOString();
      const state = seedP5SyntheticDesktopState({ baseTime: fixtureBaseTime });
      const receipt = createSessionContinuationReceipt(state, {
        receiptId: `P5-NETWORK-${Date.now()}`,
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
      const created = createP5ContinuityResumeArtifact({ receipt, fixtureBaseTime });
      const serialized = serializeP5ContinuityResumeArtifact(created);
      window.localStorage.setItem(P5_NETWORK_GATE_ARTIFACT_STORAGE_KEY, serialized);
      setArtifact(created);
      setArtifactValidation(validateP5ContinuityResumeArtifact(created, { now: nowIso() }));
      setArtifactBytes(new Blob([serialized]).size);
    } catch (error: any) {
      setLastError(error?.message || String(error));
    }
  }, []);

  const classes = useMemo(() => expectedClasses(direction), [direction]);

  const runObservation = async (stage: "BEFORE" | "AFTER", declaredNetworkClass: NetworkClass) => {
    if (!artifact) return;
    setBusy(true);
    setLastError("ninguno");
    try {
      const checked = validateP5ContinuityResumeArtifact(artifact, { now: nowIso() });
      if (!checked.pass) throw new Error(`NETWORK_GATE_ARTIFACT_INVALID:${checked.failures.join("|")}`);

      const nonce = makeNonce();
      const response = await fetch(`/api/p5-network-probe?nonce=${encodeURIComponent(nonce)}`, {
        method: "GET",
        cache: "no-store",
        headers: { "x-domi-p5-network-stage": stage },
      });
      const probe = await response.json();
      if (!response.ok || probe?.ok !== true || probe?.clientNonce !== nonce) {
        throw new Error(`NETWORK_PROBE_FAILED:${response.status}`);
      }

      const reconstruction = reconstructP5ContinuityFromResumeArtifact(artifact, {
        now: nowIso(),
        targetSessionId: `P5-NET-${stage}-${Date.now()}`,
      });
      const observation = {
        stage,
        declaredNetworkClass,
        ownerPhysicalNetworkConfirmed: true,
        browserOnline: navigator.onLine === true,
        browserConnectionHint: connectionHint(),
        handoffPresent: window.location.hash.startsWith("#handoff="),
        observedAt: nowIso(),
        probe: {
          ok: probe.ok === true,
          status: response.status,
          probeId: probe.probeId,
          clientNonce: probe.clientNonce,
          serverTime: probe.serverTime,
        },
        reconstruction: {
          pass: Boolean(reconstruction.checks.expectedSyntheticReferencesRecovered && reconstruction.checks.continuityKeyStable),
          receiptId: reconstruction.reconstructedReceipt.receiptId,
          receiptDigest: reconstruction.reconstructedReceipt.receiptDigest,
          artifactDigest: artifact.artifactDigest,
          continuityKey: reconstruction.consumption.continuityKey,
          memoryIds: [...reconstruction.consumption.memoryIds],
          rawMemoryPersisted: reconstruction.checks.rawMemoryPersisted,
          rawTranscriptPersisted: reconstruction.checks.rawTranscriptPersisted,
          fullStatePersisted: reconstruction.checks.fullStatePersisted,
          authorityPersisted: reconstruction.checks.authorityPersisted,
        },
      };

      setHint(observation.browserConnectionHint);
      if (stage === "BEFORE") {
        setBeforeObservation(observation);
        setAfterObservation(null);
        setAdjudication(null);
      } else {
        setAfterObservation(observation);
        const result = adjudicateP5NetworkTransition({ direction, before: beforeObservation, after: observation });
        setAdjudication(result);
      }
    } catch (error: any) {
      setLastError(error?.message || String(error));
    } finally {
      setBusy(false);
    }
  };

  const switchDirection = (nextDirection: Direction) => {
    setDirection(nextDirection);
    setBeforeObservation(null);
    setAfterObservation(null);
    setAdjudication(null);
    setLastError("ninguno");
    setHint(connectionHint());
  };

  const clearNetworkArtifact = () => {
    window.localStorage.removeItem(P5_NETWORK_GATE_ARTIFACT_STORAGE_KEY);
    setArtifact(null);
    setArtifactValidation(null);
    setArtifactBytes(null);
    setBeforeObservation(null);
    setAfterObservation(null);
    setAdjudication(null);
    setLastError("artifact borrado; recarga para crear uno sintético nuevo");
  };

  const card: React.CSSProperties = { border: "1px solid #d8d0c4", background: "#fff", borderRadius: 18, padding: 18 };
  const button: React.CSSProperties = { border: 0, borderRadius: 14, background: "#173b29", color: "white", padding: "13px 17px", fontWeight: 900, cursor: "pointer" };
  const expectedRefs = "P5-M-PRIVATE, P5-M-SHARED";

  return (
    <main style={{ minHeight: "100vh", background: "#f5f1e8", color: "#28231e", padding: "26px 14px 60px", fontFamily: "Inter,system-ui,sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <section style={{ ...card, boxShadow: "0 18px 50px rgba(60,50,40,.08)" }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".08em", color: "#7c5d20" }}>P5 · NETWORK TRANSITION ROBUSTNESS · SYNTHETIC ONLY</div>
          <h1 style={{ margin: "7px 0 6px", fontSize: 28 }}>Continuidad durante cambio real de red</h1>
          <p style={{ margin: 0, color: "#655b50", lineHeight: 1.55 }}>Este gate no usa la Network Information API como autoridad. La clase física de red la confirma el owner mirando el estado del teléfono; DOMI exige además un round-trip fresco al servidor y reconstrucción estable del mismo artifact antes y después del cambio.</p>
          <div style={{ marginTop: 10 }}><strong>Superficie:</strong> <code>{deviceLabel}</code></div>
          <div><strong>Artifact:</strong> <code>{artifact ? "PRESENT" : "ABSENT"}</code> · <strong>bytes:</strong> <code>{artifactBytes ?? "n/a"}</code> · <strong>validación:</strong> <code>{artifactValidation?.pass ? "PASS" : "PENDING"}</code></div>
          {artifact && <><div><strong>Receipt:</strong> <code>{artifact.receiptId}</code></div><div><strong>Receipt digest:</strong> <code>{artifact.receiptDigest}</code></div><div><strong>Artifact digest:</strong> <code>{artifact.artifactDigest}</code></div><div><strong>Continuity key:</strong> <code>{artifact.continuityKey}</code></div></>}
          <div style={{ marginTop: 8 }}><strong>Network API hint (informativo, no adjudica):</strong> <code>{hint}</code></div>
        </section>

        <section style={{ ...card, marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>Dirección del gate</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => switchDirection(P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA)} style={{ ...button, background: direction === P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA ? "#173b29" : "#64748b" }}>Wi-Fi → datos móviles</button>
            <button type="button" onClick={() => switchDirection(P5_NETWORK_DIRECTIONS.MOBILE_DATA_TO_WIFI)} style={{ ...button, background: direction === P5_NETWORK_DIRECTIONS.MOBILE_DATA_TO_WIFI ? "#173b29" : "#64748b" }}>Datos móviles → Wi-Fi</button>
          </div>
          <p style={{ marginBottom: 0 }}>Gate activo: <code>{direction}</code></p>
        </section>

        <section style={{ ...card, marginTop: 16, background: "#fff7ed", borderColor: "#fdba74" }}>
          <h2 style={{ marginTop: 0 }}>1 · PRE — confirma físicamente {classes.before === "WIFI" ? "Wi-Fi" : "datos móviles"}</h2>
          <p>Antes de pulsar, mira la barra de estado de Android y confirma que el teléfono está realmente en <strong>{classes.before === "WIFI" ? "Wi-Fi" : "datos móviles"}</strong>. El botón registra esa confirmación y ejecuta un probe fresco + reconstrucción.</p>
          <button type="button" disabled={!artifact || busy} onClick={() => runObservation("BEFORE", classes.before)} style={{ ...button, opacity: !artifact || busy ? 0.45 : 1 }}>{busy ? "Midiendo..." : `Confirmo ${classes.before} y ejecutar PRE`}</button>
          {beforeObservation && (
            <div style={{ marginTop: 14, lineHeight: 1.55 }}>
              <div><strong>PRE network declarado:</strong> <code>{beforeObservation.declaredNetworkClass}</code></div>
              <div><strong>Probe:</strong> <code>PASS · {beforeObservation.probe.probeId}</code></div>
              <div><strong>Reconstrucción:</strong> <code>{beforeObservation.reconstruction.pass ? "PASS" : "FAIL"}</code></div>
              <div><strong>Referencias:</strong> <code>{beforeObservation.reconstruction.memoryIds.join(", ")}</code></div>
              <div><strong>Continuity key:</strong> <code>{beforeObservation.reconstruction.continuityKey}</code></div>
            </div>
          )}
        </section>

        <section style={{ ...card, marginTop: 16, background: beforeObservation ? "#eff6ff" : "#f8fafc", borderColor: beforeObservation ? "#bfdbfe" : "#e2e8f0" }}>
          <h2 style={{ marginTop: 0 }}>2 · Cambia físicamente a {classes.after === "WIFI" ? "Wi-Fi" : "datos móviles"}</h2>
          <p>{direction === P5_NETWORK_DIRECTIONS.WIFI_TO_MOBILE_DATA ? "Abre el panel rápido de Android, desactiva Wi-Fi y confirma que aparecen los datos móviles (4G/5G/LTE)." : "Activa Wi-Fi, espera conexión estable y confirma el icono Wi-Fi antes de volver a DOMI."} No borres el artifact ni cierres esta pestaña.</p>
          <button type="button" disabled={!beforeObservation || busy} onClick={() => runObservation("AFTER", classes.after)} style={{ ...button, opacity: !beforeObservation || busy ? 0.45 : 1 }}>{busy ? "Midiendo..." : `Ya estoy en ${classes.after}; ejecutar POST`}</button>
          {afterObservation && (
            <div style={{ marginTop: 14, lineHeight: 1.55 }}>
              <div><strong>POST network declarado:</strong> <code>{afterObservation.declaredNetworkClass}</code></div>
              <div><strong>Probe fresco:</strong> <code>PASS · {afterObservation.probe.probeId}</code></div>
              <div><strong>Reconstrucción:</strong> <code>{afterObservation.reconstruction.pass ? "PASS" : "FAIL"}</code></div>
              <div><strong>Referencias:</strong> <code>{afterObservation.reconstruction.memoryIds.join(", ")}</code></div>
              <div><strong>Continuity key:</strong> <code>{afterObservation.reconstruction.continuityKey}</code></div>
            </div>
          )}
        </section>

        {adjudication && (
          <section style={{ ...card, marginTop: 16, background: adjudication.pass ? "#f0fdf4" : "#fef2f2", borderColor: adjudication.pass ? "#86efac" : "#fecaca" }}>
            <h2 style={{ marginTop: 0 }}>3 · Adjudicación automática conservadora</h2>
            <div><strong>Resultado:</strong> <code>{adjudication.pass ? "PASS_BOUNDED" : "HOLD"}</code></div>
            <div><strong>Claim:</strong> <code>{adjudication.claim}</code></div>
            <div><strong>Receipt estable:</strong> <code>{beforeObservation?.reconstruction.receiptDigest === afterObservation?.reconstruction.receiptDigest ? "YES" : "NO"}</code></div>
            <div><strong>Artifact estable:</strong> <code>{beforeObservation?.reconstruction.artifactDigest === afterObservation?.reconstruction.artifactDigest ? "YES" : "NO"}</code></div>
            <div><strong>Continuity key estable:</strong> <code>{beforeObservation?.reconstruction.continuityKey === afterObservation?.reconstruction.continuityKey ? "YES" : "NO"}</code></div>
            <div><strong>Referencias esperadas:</strong> <code>{expectedRefs}</code></div>
            <div><strong>Fallos:</strong> <code>{adjudication.failures.length ? adjudication.failures.join(" | ") : "ninguno"}</code></div>
            <p style={{ marginBottom: 0, fontWeight: 800 }}>{adjudication.pass ? "RESULTADO ESPERADO OBSERVADO A TRAVÉS DEL CAMBIO DE RED." : "No adjudicar PASS; preservar el fallo."}</p>
          </section>
        )}

        <section style={{ ...card, marginTop: 16, background: lastError === "ninguno" ? "#f0fdf4" : "#fef2f2", borderColor: lastError === "ninguno" ? "#bbf7d0" : "#fecaca" }}><strong>Último error:</strong> {lastError}</section>
        <section style={{ ...card, marginTop: 16 }}>
          <p style={{ marginTop: 0 }}>El artifact de este gate es sintético y separado de la memoria real del owner. Bórralo sólo después de completar ambas direcciones o si necesitas reiniciar el gate.</p>
          <button type="button" onClick={clearNetworkArtifact} style={{ ...button, background: "#7f1d1d" }}>Borrar artifact sintético de red</button>
        </section>
        <p style={{ fontSize: 12, color: "#6b6258", lineHeight: 1.5 }}>P5_REPEATABILITY_RELOAD_RECONNECT=PASS_BOUNDED · NETWORK_TRANSITION_ROBUSTNESS=PHYSICAL_PENDING · REAL_OWNER_MEMORY=NOT_STARTED · PRODUCTION_MUTATION=FALSE · SCIENTIFIC_ROOTS_MINTED=0.</p>
      </div>
    </main>
  );
}
