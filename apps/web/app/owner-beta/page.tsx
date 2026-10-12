import { notFound } from "next/navigation";
import DomiCompanionHome from "../components/domi/DomiCompanionHome";
import OwnerAlphaLongitudinalHarness from "../owner-alpha/OwnerAlphaLongitudinalHarness";
import "./owner-beta.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "DOMI · Owner Beta de prueba",
  robots: { index: false, follow: false },
};

// Synthetic Preview only. This is NOT the authenticated Owner Beta.
export default function OwnerBetaPage() {
  const isolatedPreview =
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF ===
      "domi-neon-staging-pg-startup-gate-20261010";

  if (!isolatedPreview) notFound();

  return (
    <main id="domi-owner-beta" lang="es">
      <header className="beta-intro">
        <span className="beta-label">OWNER BETA · PREVIEW SINTÉTICO · SIN DATOS PERSONALES</span>
        <h1>Conversemos con DOMI</h1>
        <p>
          Esta es una vista de prueba que puedes abrir desde computador o teléfono.
          Permite conversar y explorar un ejercicio de memoria autorizada usando
          únicamente información sintética.
        </p>
        <p className="beta-warning" role="note">
          Importante: las respuestas son una simulación local. No se guardan como
          tu memoria real ni se sincronizan con otros dispositivos. No ingreses
          información privada, contraseñas ni datos sensibles.
        </p>
        <nav className="beta-links" aria-label="Pruebas de Owner Beta">
          <a href="#conversacion">1. Conversar con DOMI</a>
          <a href="#memoria">2. Probar memoria simulada</a>
        </nav>
      </header>

      <section id="conversacion" aria-label="Conversación demo con DOMI">
        <DomiCompanionHome
          dataState="demo"
          initialTheme="dawn"
          initialDomiState="listo"
          initialAppearance="original"
          initialDev={false}
        />
      </section>

      <section id="memoria" className="beta-memory" aria-label="Memoria sintética">
        <h2>Memoria, corrección y continuidad</h2>
        <p>
          Prueba «Recuerda que…», recuperación, corrección, olvido y
          «Nueva sesión móvil» con una historia inventada. El cambio de
          sesión ocurre solo en este simulador: todavía no demuestra
          continuidad física computador–teléfono.
        </p>
        <OwnerAlphaLongitudinalHarness />
      </section>
    </main>
  );
}
