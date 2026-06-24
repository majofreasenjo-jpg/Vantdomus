/**
 * Sprint VG+2 — Guía Familiar (landing).
 *
 * Lista las UnitFunctions del household activo, agrupadas por persona y
 * categoría. Cada card muestra estado, prioridad, vencimiento legible,
 * badge de IA pendiente confirmación, badge de evidencia requerida.
 *
 * En modo familia el título dice "Guía Familiar". En otros presets:
 * "Guía Operativa" (mining), "Guía de Cuidado" (healthcare), etc.
 *
 * Pedidos por Codex (5.5): nav muestra "Guía", título contextual.
 */

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  getDashboard,
  getHouseholds,
  listUnitFunctions,
  scanPrescription,
  type UnitFunctionRow,
} from "../../lib/api";
import { INDUSTRY_PRESETS_UI } from "../../lib/taxonomy";
import AssistantOrb from "../components/AssistantOrb";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// =============================================================================
// Helpers de formato (puros, no tocan estado)
// =============================================================================

const CATEGORY_LABELS_FAMILY: Record<string, string> = {
  study: "📚 Estudio",
  medication: "💊 Medicamentos",
  health_routine: "🩺 Salud",
  hygiene: "🧼 Higiene",
  nutrition: "🥗 Alimentación",
  sleep: "🛌 Descanso",
  home_chore: "🏡 Hogar",
  appointment: "📅 Citas",
  document_deadline: "📄 Documentos",
  finance: "💰 Presupuesto",
  social_connection: "📞 Vínculos",
  calm_regulation: "🌿 Calma",
  exercise: "🏃 Movimiento",
  caregiver_task: "🤝 Cuidado",
};

const CATEGORY_LABELS_DEFAULT: Record<string, string> = {
  ...CATEGORY_LABELS_FAMILY,
  work_task: "💼 Trabajo",
  operational_protocol: "🔒 Protocolo",
  safety_check: "✅ Verificación",
};

const FAMILY_TITLE_BY_PRESET: Record<string, string> = {
  family: "Guía Familiar",
  mining: "Guía Operativa",
  oil: "Guía Operativa",
  construction: "Guía de Obra",
  healthcare: "Guía de Cuidado",
  corporate: "Guía de Equipo",
  technical_office: "Guía de Gestión",
};

const PRIORITY_PILL: Record<string, string> = {
  urgent: "bad",
  high: "bad",
  medium: "warn",
  low: "",
};

function fmtDueDate(iso: string | null | undefined, family: boolean): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (family) {
      if (diffDays === 0) return "Hoy";
      if (diffDays === 1) return "Mañana";
      if (diffDays === -1) return "Ayer";
      if (diffDays > 0 && diffDays <= 7) return `En ${diffDays} días`;
      if (diffDays < 0 && diffDays >= -7) return `Hace ${-diffDays} días`;
    }
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

function categoryLabel(category: string, isFamily: boolean): string {
  const dict = isFamily ? CATEGORY_LABELS_FAMILY : CATEGORY_LABELS_DEFAULT;
  return dict[category] || category;
}

// =============================================================================
// Resolver household activo (reutiliza patrón de layout)
// =============================================================================

async function resolveActiveHousehold(): Promise<string | null> {
  const store = await cookies();
  const fromCookie = store.get("hid")?.value;
  if (fromCookie) return fromCookie;
  try {
    const list = await getHouseholds();
    if (list?.items?.length) return list.items[0].id;
  } catch {}
  return null;
}

// =============================================================================
// Server Component
// =============================================================================

export default async function GuiaPage({
  searchParams,
}: {
  searchParams: Promise<{ person_id?: string; category?: string }>;
}) {
  const { person_id, category } = await searchParams;
  const householdId = await resolveActiveHousehold();

  if (!householdId) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 32 }}>
          <div className="cardTitle">No hay hogar activo</div>
          <div>
            Volvé al <a href="/dashboard">panel</a> y elegí o creá un hogar.
          </div>
        </div>
      </div>
    );
  }

  let dash: any;
  let unitFunctionsRes: any = { items: [] };
  let preset = "default";
  try {
    dash = await getDashboard(householdId);
    preset = dash?.household?.meta?.industry_preset || "default";
  } catch {}
  const tax = INDUSTRY_PRESETS_UI[preset] || INDUSTRY_PRESETS_UI["default"];
  const isFamily = Boolean((tax as any).family_mode);

  try {
    unitFunctionsRes = await listUnitFunctions({
      household_id: householdId,
      person_id,
      category,
      limit: 200,
    });
  } catch (e) {
    console.error("listUnitFunctions failed", e);
  }

  const items: UnitFunctionRow[] = unitFunctionsRes.items || [];
  const persons: Array<{ id: string; display_name: string; relation?: string }> =
    dash?.persons || [];

  // Agrupar: persona → categoría → funciones
  const grouped = new Map<string, Map<string, UnitFunctionRow[]>>();
  for (const f of items) {
    const personKey = f.person_id;
    if (!grouped.has(personKey)) grouped.set(personKey, new Map());
    const categoryMap = grouped.get(personKey)!;
    if (!categoryMap.has(f.category)) categoryMap.set(f.category, []);
    categoryMap.get(f.category)!.push(f);
  }

  // Estadísticas top-line
  const stats = {
    total: items.length,
    pendingAi: items.filter((f) => f.ai_needs_confirmation && !f.confirmed_at).length,
    overdue: items.filter((f) => f.due_at && new Date(f.due_at) < new Date() && f.status !== "done").length,
    done: items.filter((f) => f.status === "done").length,
  };

  const title = FAMILY_TITLE_BY_PRESET[preset] || "Guía";
  const familyName = dash?.household?.meta?.family_name as string | undefined;

  return (
    <div className="container">
      {/* Header */}
      <div className="row" style={{ alignItems: "flex-end", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isFamily ? <AssistantOrb state="idle" showLabel={false} /> : null}
          <div>
          {!isFamily ? <div className="small" style={{ marginBottom: 6 }}>VantGuide</div> : null}
          <div className="big" style={{ fontSize: 32 }}>
            {title}
            {familyName ? <span style={{ color: "var(--muted)", fontSize: 18, marginLeft: 12 }}>· {familyName}</span> : null}
          </div>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <a className="btn" href={`/biblioteca`}>Biblioteca</a>
          <a className="btn" href={`/dashboard/${householdId}`}>Volver</a>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid cols4" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="cardTitle">Funciones activas</div>
          <div className="big">{stats.total}</div>
        </div>
        <div className="card" style={{ borderColor: stats.pendingAi > 0 ? "rgba(255,204,102,.35)" : undefined }}>
          <div className="cardTitle">{isFamily ? "Pendientes de revisión" : "Pendientes confirmar IA"}</div>
          <div className="big" style={{ color: stats.pendingAi > 0 ? "var(--warn)" : undefined }}>{stats.pendingAi}</div>
          <div className="small" style={{ marginTop: 4 }}>
            La IA sugirió esto. Confirma antes de activar recordatorios.
          </div>
        </div>
        <div className="card" style={{ borderColor: stats.overdue > 0 ? "rgba(255,92,122,.35)" : undefined }}>
          <div className="cardTitle">Vencidas</div>
          <div className="big" style={{ color: stats.overdue > 0 ? "var(--bad)" : undefined }}>{stats.overdue}</div>
        </div>
        <div className="card">
          <div className="cardTitle">Completadas (último mes)</div>
          <div className="big" style={{ color: "var(--good)" }}>{stats.done}</div>
        </div>
      </div>

      {/* VG+2.5: Escanear receta / boleta → medicamento pendiente confirmar IA */}
      {isFamily && persons.length > 0 ? (
        <form
          className="card"
          style={{ marginBottom: 20, padding: 18, borderColor: "rgba(124,160,255,.35)" }}
          action={async (fd: FormData) => {
            "use server";
            const pid = String(fd.get("pid") || "");
            const file = fd.get("file");
            if (!pid || !(file instanceof File) || file.size === 0) return;
            const apiFd = new FormData();
            apiFd.set("file", file);
            await scanPrescription(householdId, pid, apiFd);
            revalidatePath("/guia");
          }}
        >
          <div className="cardTitle">📄 Escanear receta o boleta</div>
          <div className="small" style={{ marginBottom: 10 }}>
            Subí una foto o PDF de la receta. La IA propone el medicamento y queda{" "}
            <strong>pendiente de tu confirmación</strong> antes de activar recordatorios.
          </div>
          <div className="formRow" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select className="input" name="pid" defaultValue={persons[0]?.id} required>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </select>
            <input className="input" type="file" name="file" accept=".pdf,image/*" required />
            <button className="btn btnPrimary" type="submit">Escanear y proponer</button>
          </div>
        </form>
      ) : null}

      {/* Filtros simples */}
      <div className="formRow" style={{ marginBottom: 16 }}>
        <a className={`btn ${!person_id ? "btnPrimary" : ""}`} href={`/guia`}>Todos</a>
        {persons.map((p) => (
          <a
            key={p.id}
            className={`btn ${person_id === p.id ? "btnPrimary" : ""}`}
            href={`/guia?person_id=${encodeURIComponent(p.id)}`}
          >
            {p.display_name}
          </a>
        ))}
      </div>

      {/* Grupos */}
      {items.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <div className="cardTitle">Sin funciones todavía</div>
          <div className="small">
            Cuando agregues medicamentos, rutinas, agenda escolar o tareas del hogar
            aparecerán acá agrupadas por integrante.
          </div>
        </div>
      ) : null}

      {Array.from(grouped.entries()).map(([personId, categoryMap]) => {
        const person = persons.find((p) => p.id === personId);
        return (
          <div key={personId} style={{ marginBottom: 28 }}>
            <div className="sectionTitle" style={{ fontSize: 18, marginBottom: 14 }}>
              {person?.display_name || "Sin asignar"}
              {person?.relation ? <span style={{ color: "var(--muted)", fontSize: 13, marginLeft: 8 }}>· {person.relation}</span> : null}
            </div>
            {Array.from(categoryMap.entries()).map(([cat, fns]) => (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div className="cardTitle" style={{ marginBottom: 8, fontSize: 13 }}>
                  {categoryLabel(cat, isFamily)} ({fns.length})
                </div>
                <div className="grid cols4">
                  {fns.map((f) => {
                    const aiPending = !!(f.ai_needs_confirmation && !f.confirmed_at);
                    const overdueClass =
                      f.due_at && new Date(f.due_at) < new Date() && f.status !== "done"
                        ? "bad"
                        : "";
                    return (
                      <a
                        key={f.id}
                        href={`/guia/${encodeURIComponent(f.id)}`}
                        className="card"
                        style={{
                          textDecoration: "none",
                          color: "inherit",
                          borderColor: aiPending ? "rgba(255,204,102,.45)" : undefined,
                          background: aiPending
                            ? "linear-gradient(180deg, rgba(255,204,102,.05), rgba(18,26,38,.75))"
                            : undefined,
                        }}
                      >
                        <div className="row" style={{ marginBottom: 8 }}>
                          <span className={`pill ${PRIORITY_PILL[f.priority] || ""}`}>
                            {f.priority === "urgent" ? "urgente"
                              : f.priority === "high" ? "alta"
                              : f.priority === "medium" ? "media"
                              : "baja"}
                          </span>
                          {f.status === "done" ? <span className="pill good">✓ hecho</span> : null}
                        </div>
                        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14, lineHeight: 1.3 }}>
                          {f.title}
                        </div>
                        <div className="row">
                          <span className={`small ${overdueClass ? "pill bad" : ""}`}>
                            {fmtDueDate(f.due_at, isFamily)}
                          </span>
                          {aiPending ? (
                            <span className="pill warn" title="La IA sugirió esto — pendiente confirmar">
                              ✋ confirmar IA
                            </span>
                          ) : null}
                          {f.evidence_required && f.status !== "done" ? (
                            <span className="pill" title="Esta función pide evidencia">
                              📎 evidencia
                            </span>
                          ) : null}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      <div className="footerNote">
        {isFamily
          ? "VantDomus adapta su tono al perfil de cada integrante. Funciones, recordatorios y evidencia quedan en tu biblioteca privada."
          : "Cada función registrada deja trazabilidad de cumplimiento, evidencia y aprendizaje."}
      </div>
    </div>
  );
}
