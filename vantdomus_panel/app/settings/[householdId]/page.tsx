import { getDashboard } from "../../../lib/api";
import { updateTaxonomySetting } from "../../../lib/taxonomy";
import { revalidatePath } from "next/cache";

export default async function SettingsPage({ params }: { params: { householdId: string } }) {
    const hid = params.householdId;
    const dash = await getDashboard(hid);
    const currentIndustry = dash.household.meta?.industry_preset || "default";

    return (
        <div className="grid">
            <div className="card">
                <div className="cardTitle">Configuración de la Unidad</div>
                <div className="big">{dash.household.name}</div>
                <div className="small" style={{ marginBottom: 20 }}>Personaliza la jerga y comportamiento de VantUnit para tu industria.</div>

                <form
                    action={async (fd: FormData) => {
                        "use server";
                        const preset = String(fd.get("industry") || "default");
                        await updateTaxonomySetting(hid, preset);
                        revalidatePath(`/dashboard/${hid}`);
                        revalidatePath(`/settings/${hid}`);
                    }}
                    style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                    <div>
                        <label style={{ fontWeight: "bold", display: "block", marginBottom: 6 }}>
                            Industria / Perfil Empresa
                        </label>
                        <select name="industry" defaultValue={currentIndustry} className="input">
                            <option value="default">General (VantUnit Clásico / Neutro)</option>
                            <option value="family">Hogar / Familia (B2C Consumidor)</option>
                            <option value="mining">Minería Subterránea / Faena</option>
                            <option value="construction">Construcción / Obra Civil</option>
                            <option value="healthcare">Salud / Piso Clínico Hospitalario</option>
                        </select>
                    </div>

                    <div className="small" style={{ fontStyle: "italic", background: "#f5f5f5", padding: 10, borderRadius: 6 }}>
                        Al cambiar este perfil, todа la interfaz Web, Móvil y el Cerebro de la Inteligencia Artificial mutarán instantáneamente
                        para utilizar la jerga y tácticas de tu sector específico.
                    </div>

                    <button className="btn btnPrimary" type="submit" style={{ alignSelf: "flex-start" }}>
                        Guardar Configuración
                    </button>
                </form>
            </div>

        </div>
    );
}
