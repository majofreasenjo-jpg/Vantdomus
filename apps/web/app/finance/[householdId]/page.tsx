import { revalidatePath } from "next/cache";
import { Inter, Space_Grotesk } from "next/font/google";
import { addExpense, listExpenses, getDashboard, getHouseholds } from "../../../lib/api";
import DomiFaceMark from "../../components/domi/DomiFaceMark";
import { redirect } from "next/navigation";
import { INDUSTRY_PRESETS_UI } from "../../../lib/taxonomy";

// CP1c-MIN-7 (Finanzas, a pedido del owner): reskin al lenguaje de Domi.
const vfInter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--vf-inter", display: "swap" });
const vfGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--vf-grotesk", display: "swap" });

export default async function Finance({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId: hid } = await params;
  let dash: any;
  let expenses: any;

  try {
    [dash, expenses] = await Promise.all([
      getDashboard(hid),
      listExpenses(hid),
    ]);
  } catch (error: any) {
    let fallbackId = "";
    try {
      const households = await getHouseholds();
      const items = households.items || [];
      fallbackId = items[0]?.id || "";
    } catch {}
    if (fallbackId && fallbackId !== hid) {
      redirect(`/finance/${fallbackId}`);
    }
    const detail = String(error?.message || error || "");
    const isMissingHousehold = detail.includes("Household not found") || detail.includes("404");

    return (
      <div className="grid" style={{ gap: 20 }}>
        <div className="card" style={{ border: "1px solid var(--warn)", background: "rgba(245, 158, 11, 0.08)" }}>
          <div className="cardTitle" style={{ color: "var(--warn)", fontWeight: "bold" }}>
            Unidad financiera no disponible
          </div>
          <div className="big" style={{ fontSize: 26, margin: "6px 0" }}>
            {isMissingHousehold ? "Este enlace pertenece a una unidad anterior" : "No se pudo cargar Finanzas"}
          </div>
          <div className="small" style={{ maxWidth: 760, lineHeight: 1.6 }}>
            {isMissingHousehold
              ? "Esta URL ya no apunta a una unidad activa. Vuelve al tablero de direccion y abre Finanzas desde una unidad vigente."
              : "El servicio financiero no respondio correctamente. Reintenta desde el tablero CEO o revisa que el backend local este activo."}
          </div>
          <div className="row" style={{ justifyContent: "flex-start", marginTop: 18, gap: 10 }}>
            <a className="btn btnPrimary" href="/ceo">Volver a Direccion</a>
            <a className="btn" href="/gerencia">Ver Centro Operativo</a>
          </div>
        </div>
      </div>
    );
  }
  
  // Calcular Totalizadores
  const totalAmount = expenses.items.reduce((acc: number, e: any) => acc + (Number(e.amount) || 0), 0);
  const presetKey = dash.household.meta?.industry_preset || "default";
  const tax = INDUSTRY_PRESETS_UI[presetKey] || INDUSTRY_PRESETS_UI["default"];
  const isFamily = Boolean(tax.family_mode);
  const personLabel = (p: any) => {
    if (!isFamily) return p.display_name;
    return String(p.display_name || "")
      .replace(/^Supervisor\s+/i, "Responsable de ")
      .replace(/^Técnico de\s+/i, "Integrante de ")
      .replace(/^Tecnico de\s+/i, "Integrante de ");
  };
  const categoryLabel = (category: string) => {
    const labels: Record<string, string> = isFamily
      ? {
          general: "General",
          income: "Ingreso familiar",
          home: "Hogar",
          groceries: "Supermercado / despensa",
          health: "Salud y medicamentos",
          education: "Colegio / educacion",
          utilities: "Servicios basicos",
          insurance: "Seguros / polizas",
          senior: "Apoyo senior",
          experiences: "Experiencias familiares",
        }
      : {
          general: "General",
          maintenance: "Mantenimiento",
          logistics: "Logistica",
          contractors: "Contratistas",
          hardware: "Proyecto / activo",
          supplies: "Insumos",
          energy: "Suministros",
          income: "Ingreso",
          home: "Hogar",
        };
    return labels[category] || category;
  };

  return (
    <div id="vantdomus-finance" className={`${vfInter.variable} ${vfGrotesk.variable}`}>
      <style>{`
        body:has(#vantdomus-finance) .nav,
        body:has(#vantdomus-finance) .bottomNav { display:none !important; }
        body:has(#vantdomus-finance) .container { max-width:none !important; padding:0 !important; }
        #vantdomus-finance {
          --vf-ink:#26224d; --vf-muted:#6b6795;
          font-family: var(--vf-inter), ui-sans-serif, system-ui, sans-serif;
          min-height:100dvh; color:var(--vf-ink); padding:26px 20px 48px;
          background:
            radial-gradient(1100px 640px at 15% 6%, rgba(255,176,136,.26), transparent 55%),
            radial-gradient(900px 620px at 88% 18%, rgba(255,136,176,.20), transparent 55%),
            linear-gradient(135deg,#E2E9FF 0%,#FFF1E0 46%,#FFEBEA 100%);
          background-attachment:fixed;
        }
        #vantdomus-finance .vf-wrap { max-width:1040px; margin:0 auto; display:flex; flex-direction:column; gap:18px; }
        #vantdomus-finance .vf-back { display:inline-flex; align-items:center; gap:6px; color:#E58A1F; font-weight:600; text-decoration:none; font-size:14px; width:fit-content; }
        #vantdomus-finance .vf-back:hover { text-decoration:underline; }
        #vantdomus-finance .card {
          background:rgba(255,255,255,.82); border:1px solid rgba(255,255,255,.7);
          border-radius:24px; box-shadow:0 20px 50px -25px rgba(90,70,120,.4);
          -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px);
        }
        #vantdomus-finance .big { font-family:var(--vf-grotesk),sans-serif; color:var(--vf-ink); font-weight:700; }
        #vantdomus-finance .cardTitle { color:#E58A1F; font-weight:700; text-transform:uppercase; font-size:12px; letter-spacing:.6px; }
        #vantdomus-finance .small, #vantdomus-finance .footerNote { color:var(--vf-muted); }
        #vantdomus-finance .sectionTitle { color:var(--vf-ink); font-weight:700; font-size:15px; }
        #vantdomus-finance .input {
          background:rgba(255,255,255,.9); border:1px solid rgba(120,110,160,.25); color:var(--vf-ink);
          border-radius:12px; padding:10px 12px;
        }
        #vantdomus-finance .input:focus { border-color:rgba(245,158,11,.6); outline:none; box-shadow:0 0 0 3px rgba(245,158,11,.16); }
        #vantdomus-finance .btn { border-radius:12px; border:1px solid rgba(120,110,160,.25); background:rgba(255,255,255,.75); color:var(--vf-ink); padding:10px 14px; cursor:pointer; }
        #vantdomus-finance .btnPrimary { border:none; color:#3b2a06; background:linear-gradient(135deg,#FFD27A,#F8B84E 45%,#F59E0B); font-weight:600; box-shadow:0 8px 18px -6px rgba(245,158,11,.5); }
        #vantdomus-finance .pill { border-radius:999px; padding:3px 10px; font-size:12px; border:1px solid; }
        #vantdomus-finance .pill.good { color:#0f9d58; border-color:rgba(16,185,129,.35); background:rgba(16,185,129,.08); }
        #vantdomus-finance .pill.warn { color:#c2410c; border-color:rgba(245,158,11,.4); background:rgba(245,158,11,.1); }
        #vantdomus-finance .table { width:100%; border-collapse:collapse; }
        #vantdomus-finance .table th { color:var(--vf-muted); font-weight:600; text-align:left; padding:12px 14px; font-size:13px; }
        #vantdomus-finance .table td { padding:12px 14px; border-top:1px solid rgba(120,110,160,.14); }
        #vantdomus-finance .vf-total { background:rgba(255,255,255,.85); border:1px solid rgba(245,158,11,.35); border-radius:18px; }
        #vantdomus-finance .vf-thead { background:rgba(255,255,255,.55); }
      `}</style>

    <div className="vf-wrap">
      <a href={`/hogar/${hid}`} className="vf-back">← Volver a Domi</a>
      {/* HEADER FINANCIERO */}
      <div className="row" style={{ alignItems: "flex-end", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isFamily ? <DomiFaceMark size={52} /> : null}
          <div>
          <div className="cardTitle" style={{ color: "var(--primary)", fontWeight: "bold" }}>{isFamily ? "Finanzas del hogar" : "FINANZAS DE LA UNIDAD (VANTDOMUS)"}</div>
          <div className="big" style={{ fontSize: 26, margin: "4px 0" }}>{isFamily ? "Presupuesto familiar y vencimientos" : "Control presupuestario y gastos"}</div>
          <div className="small">{isFamily ? "Organiza ingresos, gastos del hogar, supermercado, salud, colegio, seguros, beneficios y respaldos." : "Registro centralizado de proveedores, contratos, ordenes de compra, facturas y respaldos."}</div>
          </div>
        </div>
        <div className="vf-total" style={{ textAlign: "right", padding: "14px 20px" }}>
           <div className="small" style={{ textTransform: "uppercase", letterSpacing: 1 }}>Total registrado (acumulado)</div>
           <div className="big" style={{ color: "#0f9d58", fontSize: 28 }}>$ {totalAmount.toLocaleString("en-US")}</div>
        </div>
      </div>

      {/* FORMULARIO INGRESO FINANCIERO */}
      <div className="card">
        <div className="sectionTitle" style={{ marginTop: 0 }}>{isFamily ? "Registrar movimiento del hogar" : "Registrar nuevo movimiento financiero"}</div>
        <div style={{ marginTop: 14 }}>
          <form
            className="formRow"
            action={async (fd: FormData) => {
              "use server";
              const amount = Number(fd.get("amount") || 0);
              if (!Number.isFinite(amount) || amount <= 0) {
                return;
              }
              await addExpense(hid, {
                amount,
                currency: String(fd.get("currency") || "USD"),
                category: String(fd.get("category") || (isFamily ? "home" : "general")),
                merchant: String(fd.get("merchant") || "") || undefined,
                expense_date: String(fd.get("expense_date") || "") || undefined,
                person_id: String(fd.get("person_id") || "") || undefined,
                notes: String(fd.get("notes") || "") || undefined,
              });
              revalidatePath(`/finance/${hid}`);
            }}
          >
            <input className="input" name="amount" type="number" min="0.01" step="0.01" required placeholder="Monto" style={{ width: 120 }} />
            <select className="input" name="currency" defaultValue={isFamily ? "CLP" : "USD"}>
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
            </select>
            <select className="input" name="category" defaultValue={isFamily ? "home" : "general"}>
              {isFamily ? (
                <>
                  <option value="home">Categoria familiar...</option>
                  <option value="income">Ingreso familiar</option>
                  <option value="groceries">Supermercado / despensa</option>
                  <option value="health">Salud y medicamentos</option>
                  <option value="education">Colegio / educacion</option>
                  <option value="utilities">Servicios basicos</option>
                  <option value="insurance">Seguros / polizas</option>
                  <option value="senior">Apoyo senior</option>
                  <option value="experiences">Experiencias familiares</option>
                </>
              ) : (
                <>
                  <option value="general">Clasificacion de costo...</option>
                  <option value="maintenance">Mantenimiento mayor y correctivo</option>
                  <option value="logistics">Logistica y transporte</option>
                  <option value="contractors">Subcontratistas y servicios</option>
                  <option value="hardware">Proyecto, crecimiento o activo</option>
                  <option value="supplies">Inventario e insumos</option>
                  <option value="energy">Suministros y combustibles</option>
                </>
              )}
            </select>
            <input className="input" name="merchant" placeholder={isFamily ? "Comercio / institucion" : "Proveedor / contraparte"} style={{ width: 160 }} />
            <input type="date" className="input" name="expense_date" style={{ width: 140 }} />
            <select className="input" name="person_id" defaultValue="">
              <option value="">{isFamily ? "Integrante responsable" : "Responsable / centro de costo"}</option>
              {dash.persons.map((p: any) => (
                <option key={p.id} value={p.id}>{personLabel(p)}</option>
              ))}
            </select>
            <input className="input" name="notes" placeholder={isFamily ? "Nota / boleta / vencimiento" : "Notas / factura"} style={{ width: 180 }} />
            <button className="btn btnPrimary" type="submit">{isFamily ? "Guardar movimiento" : "Registrar movimiento"}</button>
          </form>
          {isFamily ? (
            <div className="footerNote" style={{ lineHeight: 1.6 }}>
              Registrá <strong>ingresos</strong> (categoría “Ingreso familiar”) y <strong>gastos</strong> en el mismo lugar.
              El <strong>integrante responsable</strong> sirve para ver cuánto <strong>aporta o gasta cada persona</strong> del hogar.
              <br/>📎 En “Nota / boleta” podés anotar el respaldo. <em>Próximamente</em>: escanear la boleta y que el sistema cargue el monto, el comercio y la fecha por vos (sin digitar).
            </div>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="sectionTitle" style={{ padding: "16px 16px 8px 16px", margin: 0, borderBottom: "1px solid var(--line)" }}>{isFamily ? "Movimientos y respaldos familiares" : "Libro mayor financiero"}</div>
        <table className="table" style={{ margin: 0 }}>
          <thead className="vf-thead">
            <tr>
              <th style={{ paddingLeft: 16 }}>Fecha</th>
              <th>{isFamily ? "Comercio / institucion" : "Proveedor / contraparte"}</th>
              <th>{isFamily ? "Categoria" : "Partida contable"}</th>
              <th style={{ textAlign: "right" }}>Monto / Moneda</th>
            </tr>
          </thead>
          <tbody>
            {expenses.items.map((e: any) => {
               const highCost = (Number(e.amount) || 0) > 50000;
               return (
                 <tr key={e.id} style={{ background: highCost ? "linear-gradient(90deg, rgba(255,92,122,0.05), transparent)" : "transparent" }}>
                   <td className="small" style={{ paddingLeft: 16, opacity: 0.8 }}>{new Date(e.expense_at).toLocaleString()}</td>
                   <td style={{ fontWeight: "bold" }}>{e.merchant || "Interno / No Registrado"}</td>
                   <td>
                     <span className={["maintenance", "contractors", "hardware"].includes(e.category) ? "pill warn" : "pill good"}>
                       {categoryLabel(e.category)}
                     </span>
                     {highCost && <span title="Alert: High Expenditure" style={{ marginLeft: 6, fontSize: 11, background: "var(--bad)", color: "#fff", padding: "1px 6px", borderRadius: 4 }}>Alto impacto</span>}
                   </td>
                   <td style={{ textAlign: "right" }}>
                     <b style={{ color: highCost ? "var(--bad)" : "inherit" }}>
                        $ {Number(e.amount).toLocaleString("en-US")}
                     </b> 
                     <span className="small"> {e.currency}</span>
                   </td>
                 </tr>
               );
            })}
            {expenses.items.length === 0 ? (
              <tr><td colSpan={4} className="small" style={{ padding: 20, textAlign: "center" }}>{isFamily ? "No hay movimientos familiares registrados. Agrega el primer ingreso, gasto o vencimiento." : "No hay registros financieros para esta unidad. Registra el primer movimiento."}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
