import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE, STORAGE_KEYS } from "../config";

async function getToken() {
  return (await AsyncStorage.getItem(STORAGE_KEYS.token)) || "";
}

async function apiFetch(path: string, init?: RequestInit) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json();
}

// Auth
export const login = (email: string, password: string) =>
  apiFetch(`/auth/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`, { method: "POST" });

export const register = (email: string, password: string) =>
  apiFetch(`/auth/register?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`, { method: "POST" });

// Households
export const listHouseholds = () => apiFetch(`/households`);

// Dashboard / assistant
export const getDashboard = (hid: string) => apiFetch(`/households/${encodeURIComponent(hid)}/dashboard`);
export const getAssistant = (hid: string, refresh=false) =>
  apiFetch(`/assistant/recommendations?household_id=${encodeURIComponent(hid)}&refresh=${refresh ? "true":"false"}`);
export const applyAssistant = (hid: string, recoId: string) => {
  const qs = new URLSearchParams({ household_id: hid, reco_id: recoId });
  return apiFetch(`/assistant/apply?${qs.toString()}`, { method: "POST" });
};

export const chatAssistant = (hid: string, userMessages: { role: string; content: string }[]) => {
  return apiFetch(`/assistant/chat`, {
    method: "POST",
    body: JSON.stringify({
      household_id: hid,
      messages: userMessages.map(m => ({ role: "user", content: m.content })),
      temperature: 0.2,
    }),
  });
};

// Push + targets
export const registerPushToken = (hid: string, platform: "ios"|"android"|"web", token: string, device_name?: string) => {
  return apiFetch(`/notifications/push/register`, {
    method: "POST",
    body: JSON.stringify({ household_id: hid, platform, token, device_name }),
  });
};

export const listTargets = (hid: string) => apiFetch(`/notifications/targets?household_id=${encodeURIComponent(hid)}`);
export const addTarget = (hid: string, kind: "email"|"whatsapp", destination: string) =>
  apiFetch(`/notifications/targets`, { method: "POST", body: JSON.stringify({ household_id: hid, kind, destination, enabled: true }) });

// Tasks
export const listTasks = (hid: string) => apiFetch(`/tasks?household_id=${encodeURIComponent(hid)}`);
export const createTask = (hid: string, payload: { title: string; priority?: string; due_date?: string; tags?: string[]; assigned_person_id?: string; }) => {
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

// Finance
export const listExpenses = (hid: string) => apiFetch(`/finance/expenses?household_id=${encodeURIComponent(hid)}`);
export const addExpense = (hid: string, payload: { amount: number; currency?: string; category?: string; merchant?: string; expense_date?: string; notes?: string; person_id?: string; }) => {
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

// Health
export const getPersonHealthTimeline = (pid: string) => apiFetch(`/persons/${encodeURIComponent(pid)}/health-timeline`);
export const setAdherencePlan = (hid: string, pid: string, med: string, timesCsv: string, mode: "none"|"tap"|"voice") => {
  const qs = new URLSearchParams({ household_id: hid, person_id: pid, med_name: med, reminder_times: timesCsv, verification_mode: mode });
  return apiFetch(`/health/adherence/set?${qs.toString()}`, { method: "POST" });
};
export const healthCheckin = (hid: string, pid: string, med: string, status: "taken"|"missed") => {
  const qs = new URLSearchParams({ household_id: hid, person_id: pid, med_name: med, status });
  return apiFetch(`/health/checkin?${qs.toString()}`, { method: "POST" });
};
