/**
 * Sprint VG+2 — Evolución de UnitFunctions por persona.
 *
 * Esta es la pantalla "wow" del demo: recorre todas las UnitFunctions de
 * la persona que tengan historial de versiones (unit_function_versions)
 * y muestra la narrativa "antes vs después" + cualquier
 * evidence_item(improvement_detected) asociada.
 *
 * Es la materialización de la Biblioteca de Evolución que recomendó
 * Codex: el sistema no solo registra qué pasó, sino cómo evolucionó la
 * estrategia y qué mejora produjo.
 */

import { cookies } from "next/headers";
import {
  getDashboard,
  getHouseholds,
  getUnitFunctionVersions,
  listEvidence,
  listUnitFunctions,
} from "../../../../lib/api";
import { INDUSTRY_PRESETS_UI } from "../../../../lib/taxonomy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const CHANGE_REASON_LABELS: Record<string, string> = {
  ajuste_horario_post_consulta: "Ajuste de horario tras consulta médica",
  simplificacion_dosis_y_recordatorio_visual: "Simplificación de dosis + recordatorio visual",
  manual_patch: "Edición manual",
  user_confirmation: "Confirmación humana",
  assistant_tool: "Sugerencia del asistente IA",
  no_funcionaba: "Estrategia anterior no funcionó",
  horario_optimo: "Optimización del horario",
};

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

export default async function EvolutionPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
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

  const [dash, ufs, improvementEvidence] = await Promise.all([
    getDashboard(householdId).catch(() => null),
    listUnitFunctions({ household_id: householdId, person_id: personId, limit: 200 }).catch(() => ({ items: [] })),
    listEvidence({ household_id: householdId, person_id: personId, evidence_type: "improvement_detected", limit: 50 }).catch(() => ({ items: [] })),
  ]);

  const preset = dash?.household?.meta?.industry_preset || "default";
  const tax = INDUSTRY_PRESETS_UI[preset] || INDUSTRY_PRESETS_UI["default"];
  const isFamily = Boolean((tax as any).family_mode);
  const person = (dash?.persons || []).find((p: any) => p.id === personId);

  const ufList: any[] = ufs.items || [];

  // Cargar versiones de cada función en paralelo
  const versionsPerFn = await Promise.all(
    ufList.map(async (f) => {
      try {
        const v = await getUnitFunctionVersions(f.id);
        return { fn: f, versions: v.items || [], currentVersion: v.current_version || 1 };
      } catch {
        return { fn: f, versions: [], currentVersion: 1 };
      }
    })
  );

  // Filtrar solo las funciones que tienen historial (al menos 1 versión previa)
  const fnsWithEvolution = versionsPerFn.filter((v) => v.versions.length > 0);

  // Asociar evidencias improvement_detected por unit_function_id
  const improvementByFn = new Map<string, any[]>();
  for (const ev of improvementEvidence.items || []) {
    if (!ev.unit_function_id) continue;
    if (!improvementByFn.has(ev.unit_function_id)) improvementByFn.set(ev.unit_function_id, []);
    improvementByFn.get(ev.unit_function_id)!.push(ev);
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="small" style={{ marginBottom: 8 }}>
        <a href={`/biblioteca/${personId}`} style={{ color: "var(--muted)" }}>← Biblioteca de {person?.display_name || "persona"}</a>
      </div>

      <div className="row" style={{ alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <div className="cardTitle">VantGuide · Biblioteca de Evolución</div>
          <div className="big" style={{ fontSize: 30 }}>
            Cómo cambió y qué aprendimos sobre {person?.display_name || "esta persona"}
          </div>
          <div className="small" style={{ marginTop: 8, maxWidth: 720, lineHeight: 1.5 }}>
            {isFamily
              ? "Cada vez que ajustamos una rutina, un horario de medicamento o una estrategia de estudio, queda registrado. Acá ves qué cambió, por qué, y qué mejora produjo."
              : "Historial de cambios de las funciones asignadas a esta persona y la evolución medida."}
          </div>
        </div>
      </div>

      {fnsWithEvolution.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <div className="cardTitle">Sin evolución registrada todavía</div>
          <div className="small" style={{ marginTop: 8, maxWidth: 500, margin: "8px auto 0" }}>
            {isFamily
              ? "Cuando ajustes un horario de medicamento, una rutina o una estrategia, VantGuide guarda el antes y el después acá."
              : "Las funciones registradas todavía no tienen cambios versionados."}
          </div>
        </div>
      ) : null}

      {fnsWithEvolution.map(({ fn, versions, currentVersion }) => {
        // Snapshot más reciente del historial = inmediatamente anterior al estado actual
        const previous = versions[0]; // ya viene ordenado DESC
        const oldest = versions[versions.length - 1];
        const improvements = improvementByFn.get(fn.id) || [];
        const previousSnapshot = previous?.snapshot || {};
        const reasonLabel = CHANGE_REASON_LABELS[previous?.change_reason] || previous?.change_reason || "Cambio manual";

        return (
          <div key={fn.id} className="card" style={{ marginBottom: 18, padding: 22 }}>
            <div className="row" style={{ marginBottom: 14 }}>
              <div>
                <div className="cardTitle">{fn.category}</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{fn.title}</div>
                <div className="small" style={{ marginTop: 4 }}>
                  Versión actual: <strong>v{currentVersion}</strong> · {versions.length} cambio{versions.length === 1 ? "" : "s"} registrado{versions.length === 1 ? "" : "s"}
                </div>
              </div>
              <a className="btn" href={`/guia/${fn.id}`}>Ver función →</a>
            </div>

            {/* Bloque antes / después */}
            <div className="grid" style={{ gridTemplateColumns: "1fr auto 1fr", gap: 18, alignItems: "stretch", marginBottom: 18 }}>
              <div style={{
                background: "rgba(255,92,122,.05)",
                border: "1px solid rgba(255,92,122,.25)",
                borderRadius: 14,
                padding: 16,
              }}>
                <div className="cardTitle" style={{ color: "var(--bad)" }}>ANTES (v{previous?.version})</div>
                <div style={{ fontWeight: 700, marginTop: 6 }}>
                  {previousSnapshot.title || fn.title}
                </div>
                {previousSnapshot.schedule?.times ? (
                  <div className="small" style={{ marginTop: 8 }}>
                    Horarios: {previousSnapshot.schedule.times.join(" · ")}
                  </div>
                ) : null}
                {previousSnapshot.recurrence ? (
                  <div className="small">Frecuencia: {previousSnapshot.recurrence}</div>
                ) : null}
                {previousSnapshot._demo_note ? (
                  <div className="small" style={{ marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>
                    {previousSnapshot._demo_note}
                  </div>
                ) : null}
                <div className="small" style={{ marginTop: 10, color: "var(--muted)" }}>
                  {fmtDate(previous?.created_at)}
                </div>
              </div>

              <div style={{ alignSelf: "center", fontSize: 28, color: "var(--muted)" }}>→</div>

              <div style={{
                background: "rgba(49,208,122,.05)",
                border: "1px solid rgba(49,208,122,.25)",
                borderRadius: 14,
                padding: 16,
              }}>
                <div className="cardTitle" style={{ color: "var(--good)" }}>AHORA (v{currentVersion})</div>
                <div style={{ fontWeight: 700, marginTop: 6 }}>{fn.title}</div>
                {fn.schedule?.times ? (
                  <div className="small" style={{ marginTop: 8 }}>
                    Horarios: {fn.schedule.times.join(" · ")}
                  </div>
                ) : null}
                {fn.recurrence ? (
                  <div className="small">Frecuencia: {fn.recurrence}</div>
                ) : null}
                <div className="small" style={{ marginTop: 10, color: "var(--muted)" }}>
                  Vigente desde {fmtDate(fn.updated_at)}
                </div>
              </div>
            </div>

            {/* Razón del cambio + mejora detectada */}
            <div className="row" style={{ alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div className="cardTitle">¿Por qué cambiamos?</div>
                <div style={{ fontSize: 14, marginTop: 6 }}>{reasonLabel}</div>
                {previous?.changed_by_ai ? (
                  <div className="small" style={{ marginTop: 4 }}>Sugerido por el asistente IA</div>
                ) : previous?.changed_by_user_id ? (
                  <div className="small" style={{ marginTop: 4 }}>Decisión humana</div>
                ) : null}
              </div>

              {improvements.length > 0 ? (
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div className="cardTitle">📈 Mejora medida</div>
                  {improvements.map((ev: any) => (
                    <div key={ev.id} style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 14, lineHeight: 1.5 }}>{ev.text_content}</div>
                      {ev.metadata && ev.metadata.improvement_pct ? (
                        <div className="big" style={{ fontSize: 22, color: "var(--good)", marginTop: 6 }}>
                          +{Math.round(ev.metadata.improvement_pct)}%
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Snapshots adicionales si hay más de 1 versión */}
            {versions.length > 1 ? (
              <details style={{ marginTop: 16, color: "var(--muted)" }}>
                <summary style={{ cursor: "pointer", fontSize: 13 }}>
                  Ver historial completo ({versions.length} versiones)
                </summary>
                <div style={{ marginTop: 10 }}>
                  {versions.map((v: any) => (
                    <div key={v.id} style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                      <div className="small">
                        <strong>v{v.version}</strong> · {fmtDate(v.created_at)} ·
                        {" "}{CHANGE_REASON_LABELS[v.change_reason] || v.change_reason || "—"}
                      </div>
                      {v.snapshot?._demo_note ? (
                        <div className="small" style={{ marginTop: 4, fontStyle: "italic" }}>
                          {v.snapshot._demo_note}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        );
      })}

      <div className="footerNote">
        {isFamily
          ? "VantGuide aprende de lo que funcionó y de lo que no. Cada cambio que registres ayuda a que las próximas sugerencias sean mejores."
          : "Evolución y aprendizaje del sistema con respecto a esta persona."}
      </div>
    </div>
  );
}
