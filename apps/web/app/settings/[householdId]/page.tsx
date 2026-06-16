import { getDashboard } from "../../../lib/api";
import { updateTaxonomySetting } from "../../../lib/taxonomy";
import { seedCeo } from "../../../lib/api";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function SettingsPage({ params }: { params: Promise<{ householdId: string }> }) {
    const { householdId: hid } = await params;
    let dash;
    try {
        dash = await getDashboard(hid);
    } catch {
        redirect(`/login?next=/settings/${hid}`);
    }
    const currentIndustry = dash.household.meta?.industry_preset || "default";
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
                <div className="small" style={{ marginBottom: 20 }}>Personaliza el tipo de VantDomus, su jerga, modulos y datos base para el cliente activo.</div>

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

                    <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: 10, color: "#0f172a" }}>Agentes IA</h2>
                    <p className="small" style={{ marginBottom: 15, color: "#64748b" }}>
                        Define el nivel del usuario, modo de autonomia, agentes especializados y memoria importada desde Codex, Claude, Cursor, Gemini u otros espacios.
                    </p>
                    <a href={`/settings/${hid}/agents`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#4c1d95', color: '#fff', padding: '10px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px', marginBottom: 28, marginRight: 12 }}>
                        Configurar Agentes IA
                    </a>

                    <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: 10, color: "#0f172a" }}>Integraciones y canales</h2>
                    <p className="small" style={{ marginBottom: 15, color: "#64748b" }}>
                        Conecta WhatsApp, Teams, Google Drive, correo y fuentes externas para que VantIA reciba informacion, clasifique eventos y proponga acciones trazables.
                    </p>
                    <a href={`/settings/${hid}/coupling`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0f172a', color: '#fff', padding: '10px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>
                        <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                        Configurar conectores
                    </a>
                </div>

            </div>

        </div>
    );
}
