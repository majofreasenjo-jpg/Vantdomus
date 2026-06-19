/**
 * Sprint VG+2 — Detalle de UnitFunction.
 *
 * Muestra:
 *   - Encabezado con título, persona, categoría, estado
 *   - Si está pendiente confirmación IA, banner destacado con la explicación
 *     y dos acciones: "✓ Confirmar y activar" / "✗ Descartar sugerencia"
 *   - Acciones rápidas: marcar como hecho, registrar evidencia rápida
 *   - Timeline de FunctionEvents
 *   - Evidencia asociada (positiva y negativa)
 *   - Link a la biblioteca de la persona y a la evolución
 *
 * Server Actions para que las acciones se persistan sin JS adicional del
 * lado del cliente.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  confirmUnitFunction,
  createEvidence,
  getDashboard,
  getUnitFunction,
  getUnitFunctionTimeline,
  getUnitFunctionVersions,
  listEvidence,
  patchUnitFunction,
} from "../../../lib/api";
import { INDUSTRY_PRESETS_UI } from "../../../lib/taxonomy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

const EVENT_LABELS: Record<string, string> = {
  scheduled: "📅 Programada",
  reminded: "🔔 Recordatorio enviado",
  reminder_due: "🔔 Recordatorio pendiente",
  checkin_due: "✓ Check-in pendiente",
  completed: "✅ Completada",
  missed: "❌ No se cumplió",
  postponed: "⏸ Pospuesta",
  escalated: "⚠️ Escalada",
  escalation_due: "⚠️ Escalación pendiente",
  rewarded: "🎉 Reconocida",
  failed: "❌ Falló",
  improved: "📈 Mejora detectada",
  caregiver_reviewed: "👤 Revisada por cuidador",
  superseded: "↩️ Reemplazada",
  summary_due: "📊 Resumen pendiente",
};

const EVIDENCE_LABELS: Record<string, string> = {
  checkin_confirmed: "✓ Check-in confirmado",
  checkin_missed: "✗ Check-in omitido",
  voice_confirmation: "🎙 Confirmación por voz",
  photo_evidence: "📷 Foto",
  caregiver_confirmation: "👤 Confirmación cuidador",
  document_uploaded: "📄 Documento subido",
  assignment_completed: "✓ Entrega completada",
  quiz_completed: "✓ Prueba rendida",
  medication_taken: "💊 Medicamento tomado",
  medication_missed: "❌ Medicamento omitido",
  appointment_attended: "✓ Asistió a cita",
  appointment_missed: "❌ Faltó a cita",
  calm_session_completed: "🌿 Sesión de calma completa",
  study_session_completed: "📚 Sesión de estudio completa",
  reward_granted: "🎁 Reconocimiento otorgado",
  alert_triggered: "⚠️ Alerta disparada",
  ai_summary: "🤖 Resumen IA",
  manual_note: "📝 Nota manual",
  negative_outcome: "❗ No funcionó esta vez",
  improvement_detected: "📈 Mejora detectada",
};

export default async function UnitFunctionDetail({
  params,
}: {
  params: Promise<{ unitFunctionId: string }>;
}) {
  const { unitFunctionId } = await params;

  const [f, timelineRes, evidenceRes, versionsRes] = await Promise.all([
    getUnitFunction(unitFunctionId).catch(() => null),
    getUnitFunctionTimeline(unitFunctionId).catch(() => ({ items: [] })),
    listEvidence({ household_id: "", unit_function_id: unitFunctionId }).catch(() => ({ items: [] })),
    getUnitFunctionVersions(unitFunctionId).catch(() => ({ current_version: 1, items: [] })),
  ]);

  if (!f) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 32 }}>
          <div className="cardTitle">Función no encontrada</div>
          <a className="btn" href="/guia">← Volver a la Guía</a>
        </div>
      </div>
    );
  }

  // Resolver dash/persona para mostrar contexto humano
  let dash: any = null;
  try {
    dash = await getDashboard(f.household_id);
  } catch {}
  const preset = dash?.household?.meta?.industry_preset || "default";
  const tax = INDUSTRY_PRESETS_UI[preset] || INDUSTRY_PRESETS_UI["default"];
  const isFamily = Boolean((tax as any).family_mode);
  const person = (dash?.persons || []).find((p: any) => p.id === f.person_id);

  const aiPending = !!(f.ai_needs_confirmation && !f.confirmed_at);
  const events = timelineRes.items || [];
  const evidenceItems = (evidenceRes.items || []).filter(
    (e: any) => e.unit_function_id === unitFunctionId,
  );
  const versions = versionsRes.items || [];

  // Server actions
  async function actionConfirm(formData: FormData) {
    "use server";
    const confirmed = formData.get("confirmed") === "true";
    try {
      await confirmUnitFunction(unitFunctionId, confirmed);
      revalidatePath(`/guia/${unitFunctionId}`);
    } catch (e) {
      console.error("confirmUnitFunction failed", e);
    }
    redirect(`/guia/${unitFunctionId}`);
  }

  async function actionMarkDone(_formData: FormData) {
    "use server";
    try {
      await patchUnitFunction(unitFunctionId, { status: "done" });
      revalidatePath(`/guia/${unitFunctionId}`);
    } catch (e) {
      console.error("patchUnitFunction failed", e);
    }
    redirect(`/guia/${unitFunctionId}`);
  }

  async function actionQuickEvidence(formData: FormData) {
    "use server";
    const evidenceType = String(formData.get("evidence_type") || "manual_note");
    const text = String(formData.get("text") || "").trim();
    if (!text) {
      redirect(`/guia/${unitFunctionId}`);
    }
    try {
      await createEvidence({
        household_id: f!.household_id,
        unit_function_id: unitFunctionId,
        person_id: f!.person_id,
        evidence_type: evidenceType,
        text_content: text,
      });
      revalidatePath(`/guia/${unitFunctionId}`);
    } catch (e) {
      console.error("createEvidence failed", e);
    }
    redirect(`/guia/${unitFunctionId}`);
  }

  return (
    <div className="container">
      {/* Breadcrumbs */}
      <div className="small" style={{ marginBottom: 8 }}>
        <a href="/guia" style={{ color: "var(--muted)" }}>← Guía</a>
        {person ? (
          <>
            {" / "}
            <a href={`/biblioteca/${person.id}`} style={{ color: "var(--muted)" }}>
              {person.display_name}
            </a>
          </>
        ) : null}
      </div>

      {/* Header */}
      <div className="row" style={{ alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <div className="cardTitle">{f.category}</div>
          <div className="big" style={{ fontSize: 26 }}>{f.title}</div>
          {f.description ? <div className="small" style={{ marginTop: 8 }}>{f.description}</div> : null}
        </div>
        <div className="row" style={{ gap: 8 }}>
          {person ? (
            <a className="btn" href={`/biblioteca/${person.id}`}>
              Ver biblioteca de {person.display_name}
            </a>
          ) : null}
        </div>
      </div>

      {/* Banner AI pending */}
      {aiPending ? (
        <div className="card" style={{
          marginBottom: 16,
          borderColor: "rgba(255,204,102,.45)",
          background: "linear-gradient(180deg, rgba(255,204,102,.08), rgba(18,26,38,.85))",
        }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="cardTitle" style={{ color: "var(--warn)" }}>
              ✋ Esta función la sugirió la IA — necesita tu confirmación antes de activarse
            </div>
          </div>
          {f.ai_explanation ? (
            <div className="small" style={{ marginBottom: 10, lineHeight: 1.5 }}>
              <strong>Razón:</strong> {f.ai_explanation}
            </div>
          ) : null}
          {f.ai_confidence !== null && f.ai_confidence !== undefined ? (
            <div className="small" style={{ marginBottom: 10 }}>
              Confianza IA: {Math.round(Number(f.ai_confidence) * 100)}%
              {f.ai_extraction_source ? <> · Fuente: {f.ai_extraction_source}</> : null}
            </div>
          ) : null}
          <div className="formRow">
            <form action={actionConfirm}>
              <input type="hidden" name="confirmed" value="true" />
              <button className="btn btnPrimary" type="submit">
                ✓ Confirmar y activar
              </button>
            </form>
            <form action={actionConfirm}>
              <input type="hidden" name="confirmed" value="false" />
              <button className="btn" type="submit">
                ✗ Descartar sugerencia
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* Estado actual + acciones rápidas */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginBottom: 14 }}>
          <div>
            <div className="cardTitle">Estado actual</div>
            <div className="big" style={{ fontSize: 22 }}>
              {f.status === "done" ? "✓ Completada" :
               f.status === "in_progress" ? "⏳ En curso" :
               f.status === "cancelled" ? "✗ Cancelada" :
               f.status === "superseded" ? "↩ Reemplazada" :
               "📌 Por hacer"}
            </div>
          </div>
          {f.status !== "done" && f.status !== "cancelled" && !aiPending ? (
            <form action={actionMarkDone}>
              <button className="btn btnPrimary" type="submit">Marcar hecho</button>
            </form>
          ) : null}
        </div>
        <div className="grid cols4">
          <div>
            <div className="cardTitle">Asignada a</div>
            <div style={{ fontWeight: 700 }}>{person?.display_name || "—"}</div>
            <div className="small">{person?.relation || ""}</div>
          </div>
          <div>
            <div className="cardTitle">Vence</div>
            <div style={{ fontWeight: 700 }}>{fmtDate(f.due_at)}</div>
          </div>
          <div>
            <div className="cardTitle">Prioridad</div>
            <div style={{ fontWeight: 700 }}>{f.priority}</div>
          </div>
          <div>
            <div className="cardTitle">Versiones</div>
            <div style={{ fontWeight: 700 }}>{versionsRes.current_version || 1}</div>
            {versions.length > 0 && person ? (
              <a className="small" href={`/biblioteca/${person.id}/evolucion`}>Ver evolución →</a>
            ) : null}
          </div>
        </div>
        {f.schedule && f.schedule.times && f.schedule.times.length > 0 ? (
          <div className="footerNote">
            Recordatorios: {f.schedule.times.join(" · ")} ({f.recurrence || "una vez"})
          </div>
        ) : null}
      </div>

      {/* Timeline */}
      <div className="sectionTitle">Línea de tiempo ({events.length})</div>
      <div className="card" style={{ marginBottom: 16 }}>
        {events.length === 0 ? (
          <div className="small">Sin eventos registrados todavía.</div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Cuándo</th><th>Evento</th><th>Origen</th></tr>
            </thead>
            <tbody>
              {events.map((e: any) => (
                <tr key={e.id}>
                  <td className="small">{fmtDate(e.actual_at)}</td>
                  <td>{EVENT_LABELS[e.event_type] || e.event_type}</td>
                  <td className="small">{e.triggered_by || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Evidencia */}
      <div className="sectionTitle">Evidencia ({evidenceItems.length})</div>
      <div className="card" style={{ marginBottom: 16 }}>
        {evidenceItems.length === 0 ? (
          <div className="small" style={{ marginBottom: 10 }}>
            {isFamily
              ? "Sin evidencias todavía. Agregá una abajo (foto, voz, nota)."
              : "Sin evidencias registradas."}
          </div>
        ) : (
          <table className="table" style={{ marginBottom: 10 }}>
            <thead>
              <tr><th>Cuándo</th><th>Tipo</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {evidenceItems.map((e: any) => {
                const isNeg = ["checkin_missed", "medication_missed", "appointment_missed", "negative_outcome", "alert_triggered"].includes(e.evidence_type);
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

        {/* Quick form: registrar evidencia rápida */}
        <form action={actionQuickEvidence} className="formRow" style={{ marginTop: 10 }}>
          <select className="input" name="evidence_type" defaultValue="manual_note">
            <option value="manual_note">📝 Nota manual</option>
            <option value="checkin_confirmed">✓ Confirmé cumplimiento</option>
            <option value="checkin_missed">✗ No se cumplió esta vez</option>
            <option value="caregiver_confirmation">👤 Confirmación del cuidador</option>
            <option value="negative_outcome">❗ Esta vez no funcionó</option>
            <option value="improvement_detected">📈 Mejora detectada</option>
          </select>
          <input
            className="input"
            name="text"
            placeholder={isFamily ? "Contá qué pasó (ej. 'Diego se concentró mejor con música')" : "Detalle"}
            style={{ flex: 1, minWidth: 220 }}
          />
          <button className="btn btnPrimary" type="submit">Agregar a la biblioteca</button>
        </form>
      </div>

      <div className="footerNote">
        Cada cambio de esta función queda versionado. Cuando algo mejora o algo no funciona,
        VantDomus lo guarda para sugerir mejor la próxima vez.
      </div>
    </div>
  );
}
