/**
 * U1-COMPANION CP1b-INTEGRATION — Home companion-first (port Google AI Studio).
 *
 * Server Component: obtiene datos REALES del hogar (integrantes, compras) y los
 * pasa al port aprobado (DomiCompanionHome). Si falla un endpoint,
 * el hogar queda bloqueado por sesion/API: jamas se inventan datos de demo.
 *
 * La experiencia visible es la diseñada por Google AI Studio; aquí no se
 * rediseña nada, solo se conecta la arquitectura del repo.
 */
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { getDashboard, shoppingList } from "../../../lib/api";
import { classifyHouseholdData } from "../../../lib/domiHouseholdDataState.mjs";
import { projectDomiShoppingResponse } from "../../../lib/domiShoppingProjection";
import DomiCompanionHome, { DomiHomeData } from "../../components/domi/DomiCompanionHome";
import { getInitialTheme } from "../../components/domi/domiThemes";
import type { DomiState } from "../../components/domi/domiTypes";

const DOMI_STATES = [
  "listo", "escuchando", "pensando", "proponiendo", "esperando_confirmacion",
  "protector", "calma", "cercano", "alegre", "descanso",
] as const;
const DOMI_APPEARANCES = [
  "original", "estudio", "calma", "protector", "cercano", "noche", "senior",
  "chef", "astronaut", "detective", "wizard",
] as const;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Tipografías del prototipo aprobado, servidas por next/font (sin @import de
// red en runtime). domi.css las consume vía --domi-font-*.
const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--domi-font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--domi-font-grotesk", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--domi-font-jetbrains", display: "swap" });

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HogarCompanionPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { householdId: hid } = await params;
  const sp = await searchParams;

  // Estado inicial resuelto EN EL SERVIDOR desde los query params (y la hora del
  // servidor para el tema por defecto). Se pasa como props para que el primer
  // render de servidor y cliente sea idéntico → sin hydration mismatch. En la
  // demo local servidor y navegador son la misma máquina, así que la hora
  // coincide; el componente sigue permitiendo cambiar tema/estado tras montar.
  const themeParam = first(sp.theme) ?? null;
  const stateParam = first(sp.domiState);
  const appearanceParam = first(sp.domiAppearance) ?? first(sp.domiCostume);
  const devParam = first(sp.dev);

  const initialTheme = getInitialTheme(themeParam);
  const initialDomiState = (DOMI_STATES as readonly string[]).includes(stateParam ?? "")
    ? (stateParam as DomiState)
    : "listo";
  const initialAppearance = (DOMI_APPEARANCES as readonly string[]).includes(appearanceParam ?? "")
    ? (appearanceParam as string)
    : "original";
  const initialDev = devParam === "1" || devParam === "true";

  // Capturamos el error para clasificar el estado de datos (MIN-2.2).
  let dashErr: any = null;
  let shopErr: any = null;
  const [dash, shopping] = await Promise.all([
    getDashboard(hid).catch((e) => { dashErr = e; return null; }),
    shoppingList(hid).catch((e) => { shopErr = e; return null; }),
  ]);

  // R71: evaluate both API responses BEFORE shaping any family data.
  // Empty arrays are valid; malformed/expired data must not seed a family.
  const dataState = classifyHouseholdData({
    dashboard: dash,
    shopping,
    dashboardError: dashErr,
    shoppingError: shopErr,
  });
  const data: DomiHomeData = {};
  if (dataState === "real") {
    data.familyMembers = (dash.persons as any[]).map(p => ({
      id: String(p.id),
      name: p.display_name || "Integrante",
      role: p.relation || "Integrante del hogar",
      avatar: (p.display_name || "?").trim().charAt(0).toUpperCase(),
      status: p.status_text || "En casa",
    }));
    // Same R70 projector for first render and subsequent client-side refresh.
    // Rejecting malformed rows happens in a single canonical mapper.
    data.shoppingItems = projectDomiShoppingResponse(shopping);
  }
  if (dataState !== "real") {
    // Log operacional para QA (sin exponer token ni IDs largos).
    console.warn(`[hogar] estado de datos = ${dataState} (sin datos reales del hogar)`);
  }

  return (
    <div className={`${inter.variable} ${grotesk.variable} ${jetbrains.variable}`}>
      <DomiCompanionHome
        data={data}
        hid={hid}
        dataState={dataState}
        initialTheme={initialTheme}
        initialDomiState={initialDomiState}
        initialAppearance={initialAppearance}
        initialDev={initialDev}
      />
    </div>
  );
}
