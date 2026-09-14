import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { readG5FirstOwnerMemory } from "../../lib/domiG5OwnerLongitudinalSeed.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isPhysicalMobileRequest(userAgent: string, chMobile: string | null) {
  if (chMobile === "?1") return true;
  return /(Android|iPhone|iPad|iPod|Mobile|Windows Phone)/i.test(userAgent);
}

export default async function OwnerG5MobileRecallPage() {
  const isolatedPreview =
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "domi-owner-live-precheck";

  if (!isolatedPreview) notFound();

  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") ?? "";
  const chMobile = requestHeaders.get("sec-ch-ua-mobile");
  const mobileObserved = isPhysicalMobileRequest(userAgent, chMobile);

  if (!mobileObserved) notFound();

  const readback = readG5FirstOwnerMemory();

  console.log(JSON.stringify({
    event: "G5_MOBILE_RECALL_ACCESS",
    gate: "G5_CROSS_SURFACE_REAL_RECALL_DESKTOP_TO_MOBILE",
    surfaceClass: "PERSONAL_MOBILE_CANDIDATE",
    mobileObserved: true,
    entryId: readback.entryId,
    entryFingerprint: readback.entryFingerprint,
    realOwnerMemoryEntryCount: readback.realOwnerMemoryEntryCount,
    scientificRootsMinted: readback.scientificRootsMinted,
    memoryContentLogged: false,
    production: false,
  }));

  return (
    <main style={{ minHeight: "100vh", background: "#07131f", color: "white", padding: "26px 18px", fontFamily: "system-ui, sans-serif" }}>
      <section style={{ maxWidth: 720, margin: "0 auto", border: "1px solid rgba(255,255,255,.16)", borderRadius: 20, padding: 22, background: "rgba(255,255,255,.04)" }}>
        <div style={{ fontSize: 12, letterSpacing: ".11em", textTransform: "uppercase", opacity: .72, fontWeight: 800 }}>
          DOMI · G5 · Mobile Physical Recall Gate
        </div>
        <h1 style={{ fontSize: 28, margin: "8px 0 12px" }}>Recuperación móvil observada</h1>
        <p style={{ margin: 0, opacity: .82, lineHeight: 1.55 }}>
          La solicitud fue clasificada como móvil por cabeceras del navegador. La memoria no fue recibida desde este request; se leyó del registro G5 gobernado.
        </p>

        <div style={{ marginTop: 22, padding: 18, borderRadius: 16, background: "rgba(255,255,255,.07)" }}>
          <div style={{ fontSize: 12, opacity: .68, textTransform: "uppercase", letterSpacing: ".08em" }}>Memoria recuperada</div>
          <div style={{ fontSize: 23, lineHeight: 1.4, marginTop: 8, fontWeight: 750 }}>{readback.content}</div>
        </div>

        <div style={{ marginTop: 20, borderRadius: 14, padding: "14px 16px", background: "rgba(33,197,94,.13)", border: "1px solid rgba(33,197,94,.35)", lineHeight: 1.45 }}>
          MOBILE_REQUEST_OBSERVED=TRUE<br />
          ENTRY_ID={readback.entryId}<br />
          ENTRY_COUNT={readback.realOwnerMemoryEntryCount}<br />
          SCIENTIFIC_ROOTS_MINTED={readback.scientificRootsMinted}
        </div>

        <div style={{ marginTop: 18, fontSize: 12, opacity: .62, lineHeight: 1.55, wordBreak: "break-all" }}>
          Fingerprint: {readback.entryFingerprint}
        </div>

        <div style={{ marginTop: 18, fontSize: 12, opacity: .58, lineHeight: 1.55 }}>
          REAL_DEVELOPMENT_DEMONSTRATED=FALSE · SUBJECTHOOD_DEMONSTRATED=FALSE · SELF_SPECIFICITY_ESTABLISHED=FALSE · CONSCIOUSNESS_DEMONSTRATED=FALSE · PHENOMENAL_CONSCIOUSNESS=UNKNOWN
        </div>
      </section>
    </main>
  );
}
