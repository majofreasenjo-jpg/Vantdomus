export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001";
const ACCESS_TOKEN = process.env.NEXT_PUBLIC_ACCESS_TOKEN || "";

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json();
}

export const getDashboard = (hid: string) => apiFetch(`/households/${encodeURIComponent(hid)}/dashboard`);
export const listTasks = (hid: string) => apiFetch(`/tasks?household_id=${encodeURIComponent(hid)}`);
export const listExpenses = (hid: string) => apiFetch(`/finance/expenses?household_id=${encodeURIComponent(hid)}`);
export const listAlerts = (hid: string) => apiFetch(`/alerts?household_id=${encodeURIComponent(hid)}`).catch(() => ({ items: [] }));
export const getScores = (hid: string) => apiFetch(`/scores/latest?household_id=${encodeURIComponent(hid)}`);
export const seedDemo = (hid: string, mode: "home"|"team") =>
  apiFetch(`/demo/seed?household_id=${encodeURIComponent(hid)}&mode=${mode}`, { method: "POST" });

export const createTask = (hid: string, payload: any) => {
  const qs = new URLSearchParams({
    household_id: hid,
    title: payload.title,
    due_date: payload.due_date || "",
    assigned_person_id: payload.assigned_person_id || "",
    priority: payload.priority || "medium",
    tags: (payload.tags || []).join(","),
  });
  return apiFetch(`/tasks?${qs.toString()}`, { method: "POST" });
};

export const markTaskDone = (hid: string, taskId: string) =>
  apiFetch(`/tasks/${encodeURIComponent(taskId)}/done?household_id=${encodeURIComponent(hid)}`, { method: "POST" });

export const addExpense = (hid: string, payload: any) => {
  const qs = new URLSearchParams({
    household_id: hid,
    amount: String(payload.amount),
    currency: payload.currency || "USD",
    category: payload.category || "general",
    merchant: payload.merchant || "",
    expense_date: payload.expense_date || "",
    notes: payload.notes || "",
    person_id: payload.person_id || "",
  });
  return apiFetch(`/finance/expenses?${qs.toString()}`, { method: "POST" });
};

export const setAdherencePlan = (hid: string, pid: string, med: string, timesCsv: string, mode: "none"|"tap"|"voice") => {
  const qs = new URLSearchParams({ household_id: hid, person_id: pid, med_name: med, reminder_times: timesCsv, verification_mode: mode });
  return apiFetch(`/health/adherence/set?${qs.toString()}`, { method: "POST" });
};

export const healthCheckin = (hid: string, pid: string, med: string, status: "taken"|"missed") => {
  const qs = new URLSearchParams({ household_id: hid, person_id: pid, med_name: med, status });
  return apiFetch(`/health/checkin?${qs.toString()}`, { method: "POST" });
};

export const getPersonHealthTimeline = (pid: string) => apiFetch(`/persons/${encodeURIComponent(pid)}/health-timeline`);

export const getAssistant = (hid: string, refresh=false) =>
  apiFetch(`/assistant/recommendations?household_id=${encodeURIComponent(hid)}&refresh=${refresh ? "true":"false"}`);

export const applyAssistant = (hid: string, recoId: string) => {
  const qs = new URLSearchParams({ household_id: hid, reco_id: recoId });
  return apiFetch(`/assistant/apply?${qs.toString()}`, { method: "POST" });
};

export const assistantPlan = (hid: string, goal: string) => {
  const qs = new URLSearchParams({ household_id: hid, goal });
  return apiFetch(`/assistant/plan?${qs.toString()}`, { method: "POST" });
};
