/**
 * Sprint VG+2 — Biblioteca por persona.
 *
 * Tres tabs (via query param `?tab=`):
 *   - evidencia (default): timeline de evidence_items, positivos y NEGATIVOS
 *   - memoria: memory_items filtrados por rol
 *   - funciones: lista de UnitFunctions de esta persona
 *
 * Más arriba: link a /biblioteca/[personId]/evolucion para la narrativa
 * antes/después usando unit_function_versions.
 */

import { cookies } from "next/headers";
import {
  getDashboard,
  getHouseholds,
  getPersonLibrary,
  getPersonSupportProfile,
  listUnitFunctions,
} from "../../../lib/api";
import { INDUSTRY_PRESETS_UI } from "../../../lib/taxonomy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EVIDENCE_LABELS: Record<string, string> = {
  checkin_confirmed: "✓ Check-in confirmado",
  checkin_missed: "✗ Check-in omitido",
  voice_confirmation: "🎙 Voz",
  photo_evidence: "📷 Foto",
  caregiver_confirmation: "👤 Cuidador confirmó",
  document_uploaded: "📄 Documento",
  assignment_completed: "✓ Entrega completada",
  quiz_completed: "✓ Prueba rendida",
  medication_taken: "💊 Medicamento tomado",
  medication_missed: "❌ Medicamento omitido",
  appointment_attended: "✓ Asistió a cita",
  appointment_missed: "❌ Faltó a cita",
  calm_session_completed: "🌿 Calma",
  study_session_completed: "📚 Estudio",
  reward_granted: "🎁 Reconocimiento",
  alert_triggered: "⚠️ Alerta",
  ai_summary: "🤖 Resumen IA",
  manual_note: "📝 Nota",
  negative_outcome: "❗ No funcionó",
  improvement_detected: "📈 Mejora",
};

const MEMORY_LABELS: Record<string, string> = {
  preference: "🌸 Preferencia",
  family_story: "🏡 Historia familiar",
  routine_pattern: "🔁 Patrón de rutina",
  health_context: "🩺 Contexto de salud",
  study_pattern: "📚 Patrón de estudio",
  motivation_pattern: "✨ Patrón de motivación",
  calm_strategy: "🌿 Estrategia de calma",
  risk_pattern: "⚠️ Patrón de riesgo",
  social_connection: "📞 Conexión social",
  negative_learning: "❗ Aprendizaje negativo",
  improvement: "📈 Mejora",
  caregiver_note: "👤 Nota del cuidador",
  operational_context: "⚙ Contexto operativo",
};

const NEGATIVE_EVIDENCE = new Set([
  "checkin_missed",
  "medication_missed",
  "appointment_missed",
  "negative_outcome",
  "alert_triggered",
]);

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

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

export default async function PersonLibrary({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { personId } = await params;
  const { tab = "evidencia" } = await searchParams;
  const householdId = await resolveActiveHousehold();

  if (!householdId) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 32 }}>
          <div className="cardTitle">No hay hogar activo</div>
          <a className="btn" href="/dashboard">← Volver al panel</a>
        </div>
      </div>
    );
  }

  const [library, dash, profile, ufs] = await Promise.all([
    getPersonLibrary(personId, householdId).catch(() => ({
      evidence_items: [], memory_items: [], user_role: "viewer", person_id: personId,
    })),
    getDashboard(householdId).catch(() => null),
    getPersonSupportProfile(personId, householdId).catch(() => null),
    listUnitFunctions({ household_id: householdId, person_id: personId, limit: 200 })
      .catch(() => ({ items: [] })),
  ]);

  const preset = dash?.household?.meta?.industry_preset || "default";
  const tax = INDUSTRY_PRESETS_UI[preset] || INDUSTRY_PRESETS_UI["default"];
  const isFamily = Boolean((tax as any).family_mode);
  const person = (dash?.persons || []).find((p: any) => p.id === personId);

  const evidence: any[] = library.evidence_items || [];
  const memory: any[] = library.memory_items || [];
  const ufList: any[] = ufs.items || [];

  // Stats
  const stats = {
    completedFunctions: ufList.filter((f) => f.status === "done").length,
    activeFunctions: ufList.filter((f) => f.status === "open" || f.status === "in_progress").length,
    positiveEvidence: evidence.filter((e) => !NEGATIVE_EVIDENCE.has(e.evidence_type)).length,
    negativeEvidence: evidence.filter((e) => NEGATIVE_EVIDENCE.has(e.evidence_type)).length,
    memoryItems: memory.length,
  };

  return (
    <div className="container">
      {/* Header */}
      <div className="small" style={{ marginBottom: 8 }}>
        <a href="/biblioteca" style={{ color: "var(--muted)" }}>← Biblioteca</a>
      </div>
      <div className="row" style={{ alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <div className="cardTitle">{isFamily ? "Biblioteca de" : "Biblioteca técnica de"}</div>
          <div className="big" style={{ fontSize: 30 }}>
            {person?.display_name || "Persona"}
          </div>
          <div className="small" style={{ marginTop: 6 }}>
            {person?.relation || ""}
            {profile?.role_in_unit ? ` · ${profile.role_in_unit}` : ""}
            {profile?.communication_style ? ` · estilo: ${profile.communication_style}` : ""}
          </div>
        </div>
        <a className="btn btnPrimary" href={`/biblioteca/${personId}/evolucion`}>
          📈 Ver evolución
        </a>
      </div>

      {/* KPIs */}
      <div className="grid cols4" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="cardTitle">Funciones cumplidas</div>
          <div className="big" style={{ color: "var(--good)" }}>{stats.completedFunctions}</div>
        </div>
        <div className="card">
          <div className="cardTitle">Activas</div>
          <div className="big">{stats.activeFunctions}</div>
        </div>
        <div className="card">
          <div className="cardTitle">Evidencias positivas</div>
          <div className="big" style={{ color: "var(--good)" }}>{stats.positiveEvidence}</div>
        </div>
        <div className="card">
          <div className="cardTitle">Aprendizajes negativos</div>
          <div className="big" style={{ color: "var(--warn)" }}>{stats.negativeEvidence}</div>
          <div className="small" style={{ marginTop: 4 }}>
            {isFamily
              ? "Lo que no funcionó también es valioso."
              : "Casos negativos útiles para el aprendizaje del sistema."}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="formRow" style={{ marginBottom: 16 }}>
        <a
          className={`btn ${tab === "evidencia" ? "btnPrimary" : ""}`}
          href={`/biblioteca/${personId}?tab=evidencia`}
        >
          Evidencia
        </a>
        <a
          className={`btn ${tab === "memoria" ? "btnPrimary" : ""}`}
          href={`/biblioteca/${personId}?tab=memoria`}
        >
          Memoria
        </a>
        <a
          className={`btn ${tab === "funciones" ? "btnPrimary" : ""}`}
          href={`/biblioteca/${personId}?tab=funciones`}
        >
          Funciones
        </a>
      </div>

      {/* Tab: Evidencia */}
      {tab === "evidencia" ? (
        <div className="card">
          {evidence.length === 0 ? (
            <div className="small">Sin evidencias registradas.</div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Cuándo</th><th>Tipo</th><th>Detalle</th></tr>
              </thead>
              <tbody>
                {evidence.map((e: any) => {
                  const isNeg = NEGATIVE_EVIDENCE.has(e.evidence_type);
                  return (
                    <tr key={e.id} style={isNeg ? { background: "rgba(255,92,122,.04)" } : undefined}>
                      <td className="small">{fmtDate(e.created_at)}</td>
                      <td>
                        <span className={`pill ${isNeg ? "bad" : "good"}`}>
                          {EVIDENCE_LABELS[e.evidence_type] || e.evidence_type}
                        </span>
                      </td>
                      <td>{e.text_content || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {/* Tab: Memoria */}
      {tab === "memoria" ? (
        <div className="card">
          {memory.length === 0 ? (
            <div className="small">
              {isFamily
                ? "Aún no hay memorias guardadas. Las memorias se generan cuando el asistente o vos detectan algo importante."
                : "Sin memorias estructuradas."}
            </div>
          ) : (
            memory.map((m: any) => {
              const isNeg = m.memory_type === "negative_learning" || m.memory_type === "risk_pattern";
              return (
                <div
                  key={m.id}
                  style={{
                    paddingTop: 12,
                    paddingBottom: 12,
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <div className="row" style={{ marginBottom: 6 }}>
                    <span className={`pill ${isNeg ? "warn" : "good"}`}>
                      {MEMORY_LABELS[m.memory_type] || m.memory_type}
                    </span>
                    <span className="small">
                      Importancia: {Math.round((m.importance || 0) * 100)}%
                    </span>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5 }}>{m.content}</div>
                  <div className="small" style={{ marginTop: 6 }}>
                    {fmtDate(m.updated_at || m.created_at)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}

      {/* Tab: Funciones */}
      {tab === "funciones" ? (
        <div className="grid cols4">
          {ufList.length === 0 ? (
            <div className="card"><div className="small">Sin funciones registradas.</div></div>
          ) : (
            ufList.map((f: any) => (
              <a
                key={f.id}
                href={`/guia/${encodeURIComponent(f.id)}`}
                className="card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="row" style={{ marginBottom: 6 }}>
                  <span className="pill">{f.category}</span>
                  {f.status === "done" ? <span className="pill good">✓</span> : null}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{f.title}</div>
                <div className="small" style={{ marginTop: 4 }}>{fmtDate(f.due_at)}</div>
              </a>
            ))
          )}
        </div>
      ) : null}

      <div className="footerNote">
        {isFamily
          ? "Esta biblioteca queda en tu hogar. La IA solo accede a lo que el rol permite."
          : "Biblioteca por integrante, con permisos por rol y consentimiento."}
      </div>
    </div>
  );
}
