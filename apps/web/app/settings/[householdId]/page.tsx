import { getDashboard, updateModuleVisibility } from "../../../lib/api";
import { updateTaxonomySetting } from "../../../lib/taxonomy";
import { seedCeo } from "../../../lib/api";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function SettingsPage({ params, searchParams }: {
    params: Promise<{ householdId: string }>;
    searchParams?: Promise<{ advanced?: string }>;
}) {
    const { householdId: hid } = await params;
    const sp = searchParams ? await searchParams : {};
    const advanced = sp?.advanced === "1";
    let dash;
    try {
        dash = await getDashboard(hid);
    } catch {
        redirect(`/login?next=/settings/${hid}`);
    }
    const currentIndustry = dash.household.meta?.industry_preset || "default";
    const isFamily = currentIndustry === "family";

    if (isFamily && !advanced) {
        return <FamilySettings hid={hid} dash={dash} />;
    }
    return <AdvancedSettings hid={hid} dash={dash} currentIndustry={currentIndustry} isFamily={isFamily} />;
}

function FamilySettings({ hid, dash }: { hid: string; dash: any }) {
    const familyName: string = dash?.household?.meta?.family_name || dash?.household?.name || "Tu hogar";
    return (
        <div className="container">
            <div className="row" style={{ alignItems: "flex-end", marginBottom: 16, gap: 12 }}>
                <div>
                    <div className="small">{familyName}</div>
                    <div className="big" style={{ fontSize: 28 }}>Ajustes del Hogar</div>
                </div>
                <a className="btn" href={`/hogar/${hid}`}>← Panel del Hogar</a>
            </div>

            <div className="card" style={{ padding: 16, marginBottom: 14 }}>
                <div className="cardTitle">Quiénes son parte del hogar</div>
                <p className="small" style={{ marginTop: 6, marginBottom: 12 }}>
                    Integrantes, roles y permisos de la familia. La IA solo accede a lo que cada
                    integrante autoriza.
                </p>
                <a className="btn btnPrimary" href={`/settings/${hid}/members`}>Gestionar integrantes</a>
            </div>

            <div className="card" style={{ padding: 16, marginBottom: 14 }}>
                <div className="cardTitle">Seguridad y registro</div>
                <p className="small" style={{ marginTop: 6, marginBottom: 12 }}>
                    Cambios sensibles del hogar quedan registrados: quién agregó qué, cuándo se
                    confirmó un medicamento, qué propuso la IA y qué confirmó una persona.
                </p>
                <div className="formRow">
                    <a className="btn" href={`/settings/${hid}/audit`}>Ver historial</a>
                    <a className="btn" href={`/settings/${hid}/security`}>MFA y acceso</a>
                </div>
            </div>

            <div className="card" style={{ padding: 16, marginBottom: 14 }}>
                <div className="cardTitle">Asistente Domi — ajustes</div>
                <p className="small" style={{ marginTop: 6 }}>
                    Domi es la cara visible de tu Guía Familiar. La IA real ordena, propone y
                    resume, pero <strong>no decide cosas importantes sin tu confirmación</strong>:
                    medicamentos, salud, finanzas y permisos siempre pasan por una persona.
                </p>
                <a className="btn" style={{ marginTop: 10 }} href={`/settings/${hid}/agents`}>Configurar Domi</a>
            </div>

            <div className="card" style={{ padding: 16, marginBottom: 14 }}>
                <div className="cardTitle">Privacidad: quién ve cada sección</div>
                <p className="small" style={{ marginTop: 6, marginBottom: 12 }}>
                    Elegí el rol mínimo que puede ver las secciones sensibles del hogar. Lo que quede
                    restringido se oculta del menú y se bloquea en el servidor (no solo en pantalla).
                </p>
                <form action={async (fd: FormData) => {
                    "use server";
                    await updateModuleVisibility(hid, {
                        finance: String(fd.get("finance") || "viewer"),
                        health: String(fd.get("health") || "viewer"),
                        documents: String(fd.get("documents") || "viewer"),
                    });
                    revalidatePath(`/settings/${hid}`);
                    revalidatePath(`/hogar/${hid}`);
                }}>
                    {(() => {
                        const mv = (dash?.household?.meta?.module_visibility || {}) as Record<string, string>;
                        const ROLES = [
                            { v: "viewer", l: "Todos los integrantes" },
                            { v: "member", l: "Integrantes (no invitados)" },
                            { v: "admin", l: "Solo admins" },
                            { v: "owner", l: "Solo el dueño del hogar" },
                        ];
                        const MODS = [
                            { k: "finance", l: "💰 Presupuesto / Finanzas" },
                            { k: "health", l: "❤️ Salud" },
                            { k: "documents", l: "📄 Documentos" },
                        ];
                        return MODS.map((m) => (
                            <label key={m.k} className="formRow" style={{ alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                                <span>{m.l}</span>
                                <select className="input" name={m.k} defaultValue={mv[m.k] || "viewer"}>
                                    {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                                </select>
                            </label>
                        ));
                    })()}
                    <button className="btn btnPrimary" type="submit" style={{ marginTop: 8 }}>Guardar privacidad</button>
                </form>
            </div>

            <div className="card" style={{ padding: 16, marginBottom: 14, opacity: 0.85 }}>
                <div className="row" style={{ marginBottom: 4 }}>
                    <div className="cardTitle">Avisos por WhatsApp, correo y otros canales</div>
                    <span className="pill warn">Próximamente</span>
                </div>
                <p className="small" style={{ marginTop: 6 }}>
                    Estamos preparando la conexión con WhatsApp, correo y otras vías para que tu
                    familia reciba avisos donde ya conversa. Aún no está activo; te avisamos cuando
                    lo abramos.
                </p>
            </div>

            <div className="small" style={{ marginTop: 16, color: "var(--muted)" }}>
                ¿Necesitás opciones técnicas? <a href={`/settings/${hid}?advanced=1`}>Abrir modo avanzado</a>.
            </div>
        </div>
    );
}

function AdvancedSettings({ hid, dash, currentIndustry, isFamily }: {
    hid: string; dash: any; currentIndustry: string; isFamily: boolean;
}) {
    const profiles = [
        {
            key: "technical_office",
            title: "Oficina Tecnica Virtual",
            subtitle: "Planificador de unidades, RDI, entregables, costos, contrato, claims y repositorio documental.",
            action: "Activar Oficina Tecnica",
            color: "#f59e0b",
            seed: true,
        },
        {
            key: "puma",
            title: "VantDomus PUMA",
            subtitle: "Red de estaciones, despacho cisterna, HSE combustibles, margen, cumplimiento SEC y licitaciones.",
            action: "Activar PUMA",
            color: "#e11d48",
            seed: true,
        },
        {
            key: "family",
            title: "Planificador Familiar",
            subtitle: "Rutinas, presupuesto, salud, documentos, vencimientos y decisiones del hogar.",
            action: "Activar Familiar",
            color: "#10b981",
            seed: true,
        },
    ];

    return (
        <div className="grid">
            <div className="card">
                <div className="cardTitle">Configuracion de la Unidad</div>
                <div className="big">{dash.household.name}</div>
                <div className="small" style={{ marginBottom: 12 }}>Personaliza el tipo de VantDomus, su jerga, modulos y datos base para el cliente activo.</div>
                {isFamily && (
                    <div className="small" style={{ marginBottom: 16, padding: 8, borderRadius: 6, background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245,158,11,0.35)" }}>
                        Modo avanzado activo. Las opciones técnicas debajo no son visibles para el hogar normalmente.
                        <a href={`/settings/${hid}`} style={{ marginLeft: 8 }}>← Volver al modo familiar</a>
                    </div>
                )}

                <section style={{ marginBottom: 28 }}>
                    <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>Tipo de VantDomus</div>
                    <div className="small" style={{ marginBottom: 14 }}>
                        Estas opciones cambian el tablero ejecutivo completo. La seleccion vive aqui porque corresponde a la configuracion del cliente.
                    </div>
                    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                        {profiles.map((profile) => {
                            const active = currentIndustry === profile.key;
                            return (
                                <form
                                    key={profile.key}
                                    action={async () => {
                                        "use server";
                                        await updateTaxonomySetting(hid, profile.key);
                                        let activeHid = hid;
                                        if (profile.seed) {
                                            const seeded = await seedCeo(profile.key);
                                            activeHid = seeded?.active_household_id || hid;
                                        }
                                        const store = await cookies();
                                        store.set("hid", activeHid, { path: "/", sameSite: "lax" });
                                        revalidatePath("/ceo");
                                        revalidatePath(`/dashboard/${activeHid}`);
                                        revalidatePath(`/settings/${activeHid}`);
                                        redirect("/ceo");
                                    }}
                                    style={{
                                        border: `1px solid ${active ? profile.color : "rgba(148,163,184,0.35)"}`,
                                        borderRadius: 12,
                                        padding: 16,
                                        background: active ? "rgba(15,23,42,0.72)" : "rgba(15,23,42,0.45)",
                                        boxShadow: active ? `0 0 0 1px ${profile.color} inset` : "none",
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                                        <div style={{ color: profile.color, fontWeight: 900 }}>{profile.title}</div>
                                        {active && (
                                            <span style={{ border: `1px solid ${profile.color}`, color: profile.color, borderRadius: 999, padding: "3px 8px", fontSize: 12, fontWeight: 800 }}>
                                                Activo
                                            </span>
                                        )}
                                    </div>
                                    <p className="small" style={{ minHeight: 72, marginBottom: 14 }}>{profile.subtitle}</p>
                                    <button
                                        className="btn"
                                        type="submit"
                                        style={{
                                            width: "100%",
                                            justifyContent: "center",
                                            background: active ? "transparent" : profile.color,
                                            borderColor: profile.color,
                                            color: active ? profile.color : "#06111f",
                                            fontWeight: 900,
                                        }}
                                    >
                                        {active ? `Reinicializar ${profile.title}` : profile.action}
                                    </button>
                                </form>
                            );
                        })}
                    </div>
                </section>

                <form
                    action={async (fd: FormData) => {
                        "use server";
                        const preset = String(fd.get("industry") || "default");
                        await updateTaxonomySetting(hid, preset);
                        const store = await cookies();
                        store.set("hid", hid, { path: "/", sameSite: "lax" });
                        revalidatePath(`/dashboard/${hid}`);
                        revalidatePath(`/settings/${hid}`);
                        revalidatePath("/ceo");
                    }}
                    style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                    <div>
                        <label style={{ fontWeight: "bold", display: "block", marginBottom: 6 }}>
                            Perfil avanzado / industria secundaria
                        </label>
                        <select name="industry" defaultValue={currentIndustry} className="input">
                            <option value="default">General (Planificador adaptable)</option>
                            <option value="technical_office">Oficina tecnica virtual / planificador de unidades</option>
                            <option value="family">Gestion familiar / consumidor</option>
                            <option value="puma">PUMA / combustibles</option>
                            <option value="mining">Mineria / faena</option>
                            <option value="epc">EPC / obra y contrato</option>
                            <option value="construction">Construccion / obra</option>
                            <option value="health">Salud / clinica</option>
                            <option value="corporate">Direccion corporativa</option>
                        </select>
                    </div>

                    <div className="small" style={{ fontStyle: "italic", background: "rgba(148,163,184,0.12)", padding: 10, borderRadius: 6 }}>
                        Usa este selector solo para ajustar la jerga de la unidad actual sin reconstruir la demo operacional completa.
                    </div>

                    <button className="btn btnPrimary" type="submit" style={{ alignSelf: "flex-start" }}>
                        Guardar perfil avanzado
                    </button>
                </form>

                <div style={{ marginTop: 40, paddingTop: 30, borderTop: "1px solid #e2e8f0" }}>
                    <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: 10, color: "#0f172a" }}>Blindaje y Auditoria</h2>
                    <p className="small" style={{ marginBottom: 15, color: "#64748b" }}>
                        Revisa eventos sensibles, mutaciones de datos y acciones ejecutadas por el asistente IA.
                    </p>
                    <a href={`/settings/${hid}/audit`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#14532d', color: '#fff', padding: '10px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px', marginBottom: 28 }}>
                        Ver Bitacora de Blindaje
                    </a>

                    <div>
                        <a href={`/settings/${hid}/members`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#4338ca', color: '#fff', padding: '10px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px', marginBottom: 28, marginRight: 12 }}>
                            Gestionar Miembros
                        </a>
                        <a href={`/settings/${hid}/security`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#7c2d12', color: '#fff', padding: '10px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px', marginBottom: 28 }}>
                            Configurar MFA de Usuario
                        </a>
                    </div>

                    <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: 10, color: "#0f172a" }}>Asistente Domi (avanzado)</h2>
                    <p className="small" style={{ marginBottom: 15, color: "#64748b" }}>
                        Nivel de autonomía, agentes especializados y memoria importada. Cambios aquí afectan
                        cómo Domi propone y cuándo pide confirmación humana.
                    </p>
                    <a href={`/settings/${hid}/agents`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#4c1d95', color: '#fff', padding: '10px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px', marginBottom: 28, marginRight: 12 }}>
                        Configurar Domi (avanzado)
                    </a>

                    <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: 10, color: "#0f172a" }}>Integraciones y canales</h2>
                    <p className="small" style={{ marginBottom: 15, color: "#64748b" }}>
                        Próximamente: avisos por WhatsApp, correo y otras vías. Aún no está activo; cuando se
                        habilite cada conexión, vivirá aquí.
                    </p>
                    <a href={`/settings/${hid}/coupling`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0f172a', color: '#fff', padding: '10px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>
                        <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                        Ver integraciones (vacío)
                    </a>
                </div>

            </div>

        </div>
    );
}
