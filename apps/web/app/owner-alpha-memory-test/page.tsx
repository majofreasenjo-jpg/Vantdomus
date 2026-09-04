import { notFound } from "next/navigation";
import InteractionProbe from "./InteractionProbe";
import OwnerAlphaLongitudinalHarness from "../owner-alpha/OwnerAlphaLongitudinalHarness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function OwnerAlphaMemoryTestPage() {
  const isolatedPreview =
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "domi-owner-live-precheck";

  if (!isolatedPreview) notFound();

  return (
    <main style={{ minHeight: "100vh", background: "#0f1b2d", padding: "28px 0 48px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px", color: "white", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", opacity: .8 }}>
          Owner Alpha · Isolated Interaction Test · Synthetic only
        </div>
        <h1 style={{ margin: "6px 0 8px", fontSize: 30 }}>Diagnóstico físico P3.1</h1>
        <p style={{ margin: 0, maxWidth: 800, opacity: .9 }}>
          Esta ruta elimina DomiCompanionHome y cualquier overlay del producto principal. Primero verifica que los clics lleguen a React; después prueba el mismo harness longitudinal.
        </p>
      </div>
      <InteractionProbe />
      <OwnerAlphaLongitudinalHarness />
    </main>
  );
}
