/**
 * U1-COMPANION CP1b-INTEGRATION — Home companion-first (port Google AI Studio).
 *
 * Server Component: obtiene datos REALES del hogar (integrantes, compras) y los
 * pasa al port aprobado (DomiCompanionHome). Si un endpoint falla, el componente
 * usa su fallback demo del prototipo (marcado como demo) — la integración visual
 * no se bloquea por datos.
 *
 * La experiencia visible es la diseñada por Google AI Studio; aquí no se
 * rediseña nada, solo se conecta la arquitectura del repo.
 */
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { getDashboard, shoppingList } from "../../../lib/api";
import { isPurchased, isExcluded } from "../../../lib/shoppingContract";
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

  const data: DomiHomeData = {};

  // Integrantes reales → FamilyMember del prototipo
  const persons = (dash?.persons || []) as any[];
  if (persons.length > 0) {
    data.familyMembers = persons.map((p) => ({
      id: String(p.id),
      name: p.display_name || "Integrante",
      role: p.relation || "Integrante del hogar",
      avatar: (p.display_name || "?").trim().charAt(0).toUpperCase(),
      status: p.status_text || "En casa",
    }));
  }

  // Compras reales → ShoppingItem del prototipo.
  // MIN-3.3a: la clasificación usa el CONTRATO CANÓNICO (lib/shoppingContract,
  // espejo del backend shopping_contract.py) — este archivo ya no define
  // criterios propios de estados.
  const items = (shopping?.items || []) as any[];
  if (items.length > 0) {
    data.shoppingItems = items
      .filter((s) => !isExcluded(s.status))
      .map((s) => ({
        id: String(s.id),
        name: s.item_name || "Producto",
        checked: isPurchased(s.status),
        qty: `${s.quantity ?? 1}${s.unit ? ` ${s.unit}` : " ud"}`,
        category: s.place_hint || s.category || "Supermercado",
      }));
  }

  // CP1c-FUNC-MIN-2.2 — estado de datos honesto (fallback demo NO silencioso).
  // Clasifica: real | session (401/expirada) | api (backend caído) | demo (sin datos).
  // "real" si el hogar resolvió al menos integrantes reales; si no, se clasifica
  // por el error para explicar HONESTAMENTE al usuario qué está viendo.
  const gotReal = persons.length > 0;
  const errMsg = String(dashErr?.message || shopErr?.message || "");
  let dataState: "real" | "session" | "api" | "demo" = "real";
  if (gotReal) {
    dataState = "real";
  } else if (/401|unauthorized|authentication|forbidden|403|expir|sesi[oó]n/i.test(errMsg)) {
    dataState = "session";
  } else if (/econnrefused|fetch failed|network|timeout|enotfound|econnreset|50[0-9]/i.test(errMsg)) {
    dataState = "api";
  } else {
    dataState = "demo";
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
