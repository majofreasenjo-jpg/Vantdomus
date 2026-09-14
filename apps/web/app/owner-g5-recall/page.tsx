import { notFound } from "next/navigation";
import { readG5FirstOwnerMemory } from "../../lib/domiG5OwnerLongitudinalSeed.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function OwnerG5RecallPage() {
  const isolatedPreview =
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "domi-owner-live-precheck";

  if (!isolatedPreview) notFound();

  const readback = readG5FirstOwnerMemory();

  return (
    <main style={{ minHeight: "100vh", background: "#07131f", color: "white", padding: "32px 20px", fontFamily: "system-ui, sans-serif" }}>
      <section style={{ maxWidth: 820, margin: "0 auto", border: "1px solid rgba(255,255,255,.16)", borderRadius: 20, padding: 24, background: "rgba(255,255,255,.04)" }}>
        <div style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", opacity: .7, fontWeight: 800 }}>
          DOMI · G5 Owner Longitudinal Recall · Preview Only
        </div>
        <h1 style={{ fontSize: 30, margin: "8px 0 12px" }}>Readback independiente</h1>
        <p style={{ opacity: .82, lineHeight: 1.55, marginTop: 0 }}>
          Esta superficie no recibe la memoria por query, formulario, body ni transcript del turno actual. Lee únicamente el registro G5 persistido y gobernado.
        </p>

        <div style={{ marginTop: 22, padding: 20, borderRadius: 16, background: "rgba(255,255,255,.07)" }}>
          <div style={{ fontSize: 12, opacity: .68, textTransform: "uppercase", letterSpacing: ".08em" }}>Memoria recuperada</div>
          <div style={{ fontSize: 24, lineHeight: 1.4, marginTop: 8, fontWeight: 700 }}>{readback.content}</div>
        </div>

        <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "8px 16px", marginTop: 22, fontSize: 14 }}>
          <dt style={{ opacity: .65 }}>Entry ID</dt><dd style={{ margin: 0 }}>{readback.entryId}</dd>
          <dt style={{ opacity: .65 }}>Observado</dt><dd style={{ margin: 0 }}>{readback.observedAt}</dd>
          <dt style={{ opacity: .65 }}>Superficie origen</dt><dd style={{ margin: 0 }}>{readback.surfaceClass}</dd>
          <dt style={{ opacity: .65 }}>Prospectivo</dt><dd style={{ margin: 0 }}>{String(readback.prospective)}</dd>
          <dt style={{ opacity: .65 }}>Memorias G5</dt><dd style={{ margin: 0 }}>{readback.realOwnerMemoryEntryCount}</dd>
          <dt style={{ opacity: .65 }}>Scientific roots minted</dt><dd style={{ margin: 0 }}>{readback.scientificRootsMinted}</dd>
          <dt style={{ opacity: .65 }}>Fingerprint</dt><dd style={{ margin: 0, wordBreak: "break-all" }}>{readback.entryFingerprint}</dd>
        </dl>

        <div style={{ marginTop: 24, borderRadius: 14, padding: "14px 16px", background: "rgba(33, 197, 94, .13)", border: "1px solid rgba(33, 197, 94, .35)" }}>
          G5 REAL LONGITUDINAL RECALL: registro persistido disponible para readback físico.
        </div>

        <div style={{ marginTop: 18, fontSize: 12, opacity: .62, lineHeight: 1.5 }}>
          REAL_DEVELOPMENT_DEMONSTRATED=FALSE · SUBJECTHOOD_DEMONSTRATED=FALSE · SELF_SPECIFICITY_ESTABLISHED=FALSE · CONSCIOUSNESS_DEMONSTRATED=FALSE · PHENOMENAL_CONSCIOUSNESS=UNKNOWN
        </div>
      </section>
    </main>
  );
}
