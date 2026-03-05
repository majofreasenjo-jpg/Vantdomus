import { addExpense, listExpenses, getDashboard } from "../../../lib/api";

export default async function Finance({ params }: { params: { householdId: string } }) {
  const hid = params.householdId;
  const dash = await getDashboard(hid);
  const expenses = await listExpenses(hid);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="cardTitle">Finance</div>
        <div className="big" style={{ fontSize: 26 }}>Stability Ledger</div>
        <div className="small">Gastos, categorías, umbrales.</div>

        <div style={{ marginTop: 14 }}>
          <form
            className="formRow"
            action={async (fd: FormData) => {
              "use server";
              await addExpense(hid, {
                amount: Number(fd.get("amount") || 0),
                currency: String(fd.get("currency") || "USD"),
                category: String(fd.get("category") || "general"),
                merchant: String(fd.get("merchant") || "") || undefined,
                expense_date: String(fd.get("expense_date") || "") || undefined,
                person_id: String(fd.get("person_id") || "") || undefined,
                notes: String(fd.get("notes") || "") || undefined,
              });
            }}
          >
            <input className="input" name="amount" placeholder="Monto" style={{ width: 120 }} />
            <select className="input" name="currency" defaultValue="USD">
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="CLP">CLP</option>
              <option value="BRL">BRL</option>
            </select>
            <select className="input" name="category" defaultValue="general">
              <option value="general">general</option>
              <option value="pharmacy">pharmacy</option>
              <option value="utilities">utilities</option>
              <option value="food">food</option>
              <option value="rent">rent</option>
              <option value="education">education</option>
            </select>
            <input className="input" name="merchant" placeholder="Merchant" style={{ width: 160 }} />
            <input className="input" name="expense_date" placeholder="YYYY-MM-DD" style={{ width: 140 }} />
            <select className="input" name="person_id" defaultValue="">
              <option value="">(sin persona)</option>
              {dash.persons.map((p: any) => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </select>
            <input className="input" name="notes" placeholder="Notas" style={{ width: 180 }} />
            <button className="btn btnPrimary" type="submit">Agregar</button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="sectionTitle">Últimos gastos</div>
        <table className="table">
          <thead><tr><th>Date</th><th>Category</th><th>Merchant</th><th>Amount</th></tr></thead>
          <tbody>
            {expenses.items.map((e: any) => (
              <tr key={e.id}>
                <td className="small">{e.expense_at || "—"}</td>
                <td><span className={e.category === "pharmacy" ? "pill warn" : "pill"}>{e.category}</span></td>
                <td className="small">{e.merchant || "—"}</td>
                <td><b>{e.amount}</b> <span className="small">{e.currency}</span></td>
              </tr>
            ))}
            {expenses.items.length === 0 ? (
              <tr><td colSpan={4} className="small">Sin gastos.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
