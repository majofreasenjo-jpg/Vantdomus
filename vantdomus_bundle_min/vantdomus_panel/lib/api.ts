export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
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
export const getPersonHealthTimeline = (pid: string) => apiFetch(`/persons/${encodeURIComponent(pid)}/health-timeline`);
export const setAdherencePlan = (payload: any) => apiFetch(`/health/adherence/set`, { method: "POST", body: JSON.stringify(payload) });
export const healthCheckin = (payload: any) => apiFetch(`/health/checkin`, { method: "POST", body: JSON.stringify(payload) });
