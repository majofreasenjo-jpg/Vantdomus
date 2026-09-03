import { notFound } from "next/navigation";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import DomiCompanionHome from "../components/domi/DomiCompanionHome";
import OwnerAlphaLongitudinalHarness from "./OwnerAlphaLongitudinalHarness";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--domi-font-inter",
  display: "swap",
});
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--domi-font-grotesk",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--domi-font-jetbrains",
  display: "swap",
});

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Owner Alpha Preview
 * -------------------
 * Synthetic-only product walkthrough for the owner on the isolated Preview
 * branch. It intentionally bypasses the application login because no real
 * household/session data is admitted here. The Vercel Preview remains the
 * outer access boundary.
 *
 * Production and every other branch fail closed with 404.
 */
export default function OwnerAlphaPage() {
  const isolatedPreview =
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "domi-owner-live-precheck";

  if (!isolatedPreview) notFound();

  return (
    <div
      id="vantdomus-owner-alpha"
      className={`${inter.variable} ${grotesk.variable} ${jetbrains.variable}`}
    >
      <style>{`
        body:has(#vantdomus-owner-alpha) .nav,
        body:has(#vantdomus-owner-alpha) .bottomNav { display: none !important; }
        body:has(#vantdomus-owner-alpha) .container {
          max-width: none !important;
          padding: 0 !important;
        }
        #vantdomus-owner-alpha .owner-alpha-ribbon {
          position: fixed;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          max-width: calc(100vw - 24px);
          padding: 8px 14px;
          border: 1px solid rgba(143,106,43,.22);
          border-radius: 999px;
          background: rgba(255,252,244,.90);
          backdrop-filter: blur(12px);
          box-shadow: 0 8px 30px rgba(90,70,45,.14);
          color: #5a4935;
          font: 600 12px/1.3 var(--domi-font-inter), system-ui, sans-serif;
          text-align: center;
          pointer-events: none;
        }

        /* P3.1 physical-acceptance accessibility hotfix.
           The main Domi theme has light-on-dark control rules that leaked into
           this light synthetic harness. Scope the correction ONLY to P3.1. */
        #vantdomus-owner-alpha .owner-alpha-longitudinal {
          color: #2f271f !important;
          color-scheme: light;
        }
        #vantdomus-owner-alpha .owner-alpha-longitudinal section,
        #vantdomus-owner-alpha .owner-alpha-longitudinal section > div {
          color: #2f271f;
        }
        #vantdomus-owner-alpha .owner-alpha-longitudinal strong,
        #vantdomus-owner-alpha .owner-alpha-longitudinal label,
        #vantdomus-owner-alpha .owner-alpha-longitudinal small,
        #vantdomus-owner-alpha .owner-alpha-longitudinal li,
        #vantdomus-owner-alpha .owner-alpha-longitudinal code {
          color: #2f271f !important;
        }
        #vantdomus-owner-alpha .owner-alpha-longitudinal button {
          color: #352b21 !important;
          opacity: 1;
          font-weight: 650;
        }
        #vantdomus-owner-alpha .owner-alpha-longitudinal button[style*="#5f4b35"] {
          color: #ffffff !important;
        }
        #vantdomus-owner-alpha .owner-alpha-longitudinal button:disabled {
          color: #766b60 !important;
          opacity: .52;
          cursor: not-allowed !important;
        }
        #vantdomus-owner-alpha .owner-alpha-longitudinal input,
        #vantdomus-owner-alpha .owner-alpha-longitudinal textarea {
          color: #ffffff !important;
          background: #383633 !important;
          caret-color: #ffffff;
          border-color: #867b6d !important;
        }
        #vantdomus-owner-alpha .owner-alpha-longitudinal .physical-test-note {
          margin: 0 auto 12px;
          max-width: 1080px;
          border: 2px solid #9a6a18;
          border-radius: 16px;
          padding: 12px 16px;
          background: #fff4d8;
          color: #352b21 !important;
          font: 650 14px/1.45 var(--domi-font-inter), system-ui, sans-serif;
        }
        #vantdomus-owner-alpha .owner-alpha-longitudinal .physical-test-note b {
          color: #7a4e00 !important;
        }
      `}</style>

      <div className="owner-alpha-ribbon">
        Owner Alpha · Preview sintético · sin datos reales · baseline RBS_2026_09_01_MICR_R8_61
      </div>

      <DomiCompanionHome
        dataState="demo"
        initialTheme="dawn"
        initialDomiState="listo"
        initialAppearance="original"
        initialDev={false}
      />

      <div className="owner-alpha-longitudinal">
        <div className="physical-test-note">
          <b>Prueba física P3.1:</b> al pulsar “Recuerda que…” una sola vez, “Memorias recuperadas” debe cambiar de 0 a 1 y aparecer un identificador OA-M-*. Si no cambia, lo tratamos como fallo funcional.
        </div>
        <OwnerAlphaLongitudinalHarness />
      </div>
    </div>
  );
}