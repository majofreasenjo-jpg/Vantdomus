import { notFound } from "next/navigation";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import DomiCompanionHome from "../components/domi/DomiCompanionHome";

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
    </div>
  );
}
