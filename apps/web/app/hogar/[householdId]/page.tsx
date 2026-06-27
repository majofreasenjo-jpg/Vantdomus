/**
 * U1-COMPANION — Home companion-first.
 *
 * La home YA NO es un dashboard de módulos: es una sola pantalla viva donde
 * Domi conversa y aparecen tarjetas. Este Server Component solo obtiene datos
 * reales (resumen del día, personas, conteos) y se los pasa a <DomiCompanion>,
 * que es la experiencia. Los módulos viven bajo "Más" (ver layout).
 */
import { cookies } from "next/headers";
import {
  getDashboard, familyBoardList, shoppingList, dailyActivitiesList, listUnitFunctions,
} from "../../../lib/api";
import DomiCompanion from "../../components/DomiCompanion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function pickGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default async function HomeCompanion({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId: hid } = await params;
  const store = await cookies();
  const userName = store.get("vd_user_first_name")?.value;

  const [dash, board, shopAll, activities, ufs] = await Promise.all([
    getDashboard(hid).catch(() => null),
    familyBoardList(hid).catch(() => ({ items: [] })),
    shoppingList(hid).catch(() => ({ items: [] })),
    dailyActivitiesList(hid, new Date().toISOString().slice(0, 10)).catch(() => ({ items: [] })),
    listUnitFunctions({ household_id: hid, category: "medication", limit: 50 }).catch(() => ({ items: [] })),
  ]);

  if (!dash) {
    return (
      <div className="card" style={{ padding: 32, maxWidth: 520, margin: "24px auto" }}>
        <div className="cardTitle">No pudimos cargar tu hogar</div>
        <a className="btn" href="/login">Entrar de nuevo</a>
      </div>
    );
  }

  const persons = (dash?.persons || []) as any[];
  const boardItems = (board?.items || []) as any[];
  const alerts = boardItems.filter((p) => p.priority === "high" || p.priority === "urgent" || p.post_type === "alert");
  const pinned = boardItems.filter((p) => p.pinned);
  const schoolNotice = boardItems.find((p) => p.post_type === "school");
  const shopping = (shopAll?.items || []) as any[];
  const shoppingPending = shopping.filter((s) => s.status === "needed");
  const shoppingInCart = shopping.filter((s) => s.status === "in_cart");
  const acts = (activities?.items || []) as any[];
  const plannedActs = acts.filter((a) => a.status === "planned").length;
  const meds = (ufs?.items || []) as any[];
  const tonightMeds = meds.filter((m) => ((m?.schedule?.times || []) as string[]).some((t) => /^(1[89]|2[0-3]):/.test(t)));

  // Resumen real del día (mismas señales que antes, ahora como tarjeta de Domi).
  const lines: string[] = [];
  if (pinned[0]?.title) lines.push(`📌 ${pinned[0].title}`);
  if (tonightMeds.length > 0) lines.push(`Hay ${tonightMeds.length === 1 ? "un medicamento" : `${tonightMeds.length} medicamentos`} con horario para esta noche (la toma la confirma una persona).`);
  if (schoolNotice?.title) lines.push(`Aviso del colegio: ${schoolNotice.title}`);
  if (shoppingPending.length > 0) lines.push(`Faltan ${shoppingPending.length} productos por comprar (${shoppingInCart.length} ya en carro tentativo).`);
  if (plannedActs > 0) lines.push(`${plannedActs} actividad(es) planificada(s) para hoy.`);
  if (persons.length === 0) lines.push("Aún no hay integrantes. Pídeme “configurar mi hogar” y te guío.");
  if (lines.length === 0) lines.push("Todo tranquilo en casa. Buen momento para un respiro o planificar la semana.");

  const summary = { title: "Esto es lo importante hoy", lines };

  const suggestions = [
    { label: "Ordenar mi día", send: "ordenar mi día" },
    { label: "Preparar compras", send: "agrega leche, pan y paracetamol" },
    { label: "Confirmar salud", send: "medicamento de Elena para hoy" },
    { label: "Leer un documento", send: "subir documento" },
    { label: "Un momento de calma", send: "pon música tranquila" },
  ];

  return (
    <DomiCompanion
      userName={userName}
      greeting={pickGreeting()}
      summary={summary}
      suggestions={suggestions}
    />
  );
}
