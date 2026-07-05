import { browserCsrfToken, CSRF_HEADER, isUnsafeMethod } from "./csrf";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001";
const ACCESS_TOKEN = process.env.NEXT_PUBLIC_ACCESS_TOKEN || "";

async function sessionAccessToken() {
  if (typeof window === "undefined") {
    try {
      const { cookies } = await import("next/headers");
      const store = await cookies();
      return store.get("vantdomus_access_token")?.value || ACCESS_TOKEN;
    } catch {
      return ACCESS_TOKEN;
    }
  }
  return ACCESS_TOKEN;
}

function requestUrl(path: string) {
  return typeof window === "undefined" ? `${API_BASE}${path}` : `/api/proxy${path}`;
}

export async function apiFetch(path: string, init?: RequestInit) {
  const accessToken = await sessionAccessToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", headers.get("Content-Type") || "application/json");
  const method = init?.method || "GET";
  if (typeof window !== "undefined" && isUnsafeMethod(method)) {
    headers.set(CSRF_HEADER, browserCsrfToken());
  }
  if (typeof window === "undefined" && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  let res = await fetch(requestUrl(path), {
    ...init,
    headers,
    cache: "no-store",
  });
  if (
    typeof window === "undefined" &&
    res.status === 401 &&
    ACCESS_TOKEN &&
    accessToken !== ACCESS_TOKEN
  ) {
    const retryHeaders = new Headers(headers);
    retryHeaders.set("Authorization", `Bearer ${ACCESS_TOKEN}`);
    res = await fetch(requestUrl(path), {
      ...init,
      headers: retryHeaders,
      cache: "no-store",
    });
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json();
}

async function apiFetchMultipart(path: string, formData: FormData) {
  const accessToken = await sessionAccessToken();
  const headers = new Headers();
  if (typeof window !== "undefined") {
    headers.set(CSRF_HEADER, browserCsrfToken());
  }
  if (typeof window === "undefined" && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  let res = await fetch(requestUrl(path), {
    method: "POST",
    body: formData,
    headers,
    cache: "no-store",
  });
  if (
    typeof window === "undefined" &&
    res.status === 401 &&
    ACCESS_TOKEN &&
    accessToken !== ACCESS_TOKEN
  ) {
    const retryHeaders = new Headers(headers);
    retryHeaders.set("Authorization", `Bearer ${ACCESS_TOKEN}`);
    res = await fetch(requestUrl(path), {
      method: "POST",
      body: formData,
      headers: retryHeaders,
      cache: "no-store",
    });
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json();
}

export const getDashboard = (hid: string) => apiFetch(`/households/${encodeURIComponent(hid)}/dashboard`);
export const exportHouseholdData = (hid: string) => apiFetch(`/households/${encodeURIComponent(hid)}/export`);
export const deleteHouseholdData = (hid: string) =>
  apiFetch(`/households/${encodeURIComponent(hid)}?confirm=DELETE`, { method: "DELETE" });
export const listHouseholdMembers = (hid: string) =>
  apiFetch(`/households/${encodeURIComponent(hid)}/members`, { cache: "no-store" });
export const addHouseholdMember = (hid: string, payload: { email: string; role: string }) =>
  apiFetch(`/households/${encodeURIComponent(hid)}/members`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const updateHouseholdMemberRole = (hid: string, userId: string, role: string) =>
  apiFetch(`/households/${encodeURIComponent(hid)}/members/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
export const removeHouseholdMember = (hid: string, userId: string) =>
  apiFetch(`/households/${encodeURIComponent(hid)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" });
export const listHouseholdInvitations = (hid: string) =>
  apiFetch(`/households/${encodeURIComponent(hid)}/invitations`, { cache: "no-store" });
export const createHouseholdInvitation = (hid: string, payload: { email: string; role: string; ttl_hours: number }) =>
  apiFetch(`/households/${encodeURIComponent(hid)}/invitations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const revokeHouseholdInvitation = (hid: string, invitationId: string) =>
  apiFetch(`/households/${encodeURIComponent(hid)}/invitations/${encodeURIComponent(invitationId)}/revoke`, {
    method: "POST",
  });
export const acceptHouseholdInvitation = (token: string) =>
  apiFetch(`/households/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" });
export const listTasks = (hid: string) => apiFetch(`/tasks?household_id=${encodeURIComponent(hid)}`);
export const listExpenses = (hid: string) => apiFetch(`/finance/expenses?household_id=${encodeURIComponent(hid)}`);
export const listAlerts = (hid: string) => apiFetch(`/alerts?household_id=${encodeURIComponent(hid)}`).catch(() => ({ items: [] }));
export const getScores = (hid: string) => apiFetch(`/scores/latest?household_id=${encodeURIComponent(hid)}`);
export const seedDemo = (hid: string, mode: "home" | "team") =>
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

export const createSchoolStudyPlan = (hid: string, formData: FormData) => {
  formData.set("household_id", hid);
  return apiFetchMultipart("/tasks/school_plan", formData);
};

export const markTaskDone = (hid: string, taskId: string) =>
  apiFetch(`/tasks/${encodeURIComponent(taskId)}/done?household_id=${encodeURIComponent(hid)}`, { method: "POST" });

export const setTaskStatus = (hid: string, taskId: string, status: string) => {
  const qs = new URLSearchParams({ household_id: hid, status });
  return apiFetch(`/tasks/${encodeURIComponent(taskId)}/status?${qs.toString()}`, { method: "POST" });
};

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

export const setAdherencePlan = (hid: string, pid: string, med: string, timesCsv: string, mode: "none" | "tap" | "voice") => {
  const qs = new URLSearchParams({ household_id: hid, person_id: pid, med_name: med, reminder_times: timesCsv, verification_mode: mode });
  return apiFetch(`/health/adherence/set?${qs.toString()}`, { method: "POST" });
};

export const healthCheckin = (hid: string, pid: string, med: string, status: "taken" | "missed") => {
  const qs = new URLSearchParams({ household_id: hid, person_id: pid, med_name: med, status });
  return apiFetch(`/health/checkin?${qs.toString()}`, { method: "POST" });
};

export const getPersonHealthTimeline = (pid: string) => apiFetch(`/persons/${encodeURIComponent(pid)}/health-timeline`);

export const getAssistant = (hid: string, refresh = false) =>
  apiFetch(`/assistant/recommendations?household_id=${encodeURIComponent(hid)}&refresh=${refresh ? "true" : "false"}`);

export const applyAssistant = (hid: string, recoId: string) => {
  const qs = new URLSearchParams({ household_id: hid, reco_id: recoId });
  return apiFetch(`/assistant/apply?${qs.toString()}`, { method: "POST" });
};

export const assistantPlan = (hid: string, goal: string) => {
  const qs = new URLSearchParams({ household_id: hid, goal });
  return apiFetch(`/assistant/plan?${qs.toString()}`, { method: "POST" });
};

export const assistantChat = (
  hid: string,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  temperature = 0.2
) =>
  apiFetch("/assistant/chat", {
    method: "POST",
    body: JSON.stringify({
      household_id: hid,
      messages,
      temperature,
    }),
  });

// Missing endpoints for Panel compatibility
export const getInbox = (hid: string) => apiFetch(`/notifications/outbox?household_id=${encodeURIComponent(hid)}`);
export const getEventDetail = (eid: string) => apiFetch(`/alerts?event_id=${encodeURIComponent(eid)}`).then(res => ({
  event: res.items[0] || { summary: "Desconocido", domain: "system", event_type: "info", occurred_at: "now" },
  payload: {}
}));
export const getHSIStatus = (hid: string) => getScores(hid).then(res => res.items[0] || { hsi: 0 });
export const getHouseholds = () => apiFetch("/households");
export const getPersonDetail = (pid: string) => apiFetch(`/persons/${encodeURIComponent(pid)}`);
// Onboarding
export const createPerson = (hid: string, displayName: string, relation = "") =>
  apiFetch(`/persons?household_id=${encodeURIComponent(hid)}&display_name=${encodeURIComponent(displayName)}&relation=${encodeURIComponent(relation)}`, { method: "POST" });
export const updateHouseholdProfile = (hid: string, body: { family_name?: string; industry_preset?: string }) =>
  apiFetch(`/households/${encodeURIComponent(hid)}/profile`, { method: "PATCH", body: JSON.stringify(body) });
// #17 visibilidad por módulo (rol mínimo: viewer|member|admin|owner)
export const updateModuleVisibility = (hid: string, body: { finance?: string; health?: string; documents?: string }) =>
  apiFetch(`/households/${encodeURIComponent(hid)}/module-visibility`, { method: "PATCH", body: JSON.stringify(body) });
// U3 — avatar + estado del integrante
export const personUpdate = (pid: string, body: Record<string, any>) =>
  apiFetch(`/persons/${encodeURIComponent(pid)}`, { method: "PATCH", body: JSON.stringify(body) });
export const personSetStatus = (pid: string, emoji: string, text: string) =>
  apiFetch(`/persons/${encodeURIComponent(pid)}/status`, { method: "PUT", body: JSON.stringify({ emoji, text }) });
export const personClearStatus = (pid: string) =>
  apiFetch(`/persons/${encodeURIComponent(pid)}/status`, { method: "DELETE" });
export const evalAndPersist = (eid: string) => Promise.resolve({ ok: true, note: "Dummy implementation for build" });
export async function getGerenciaState() {
  return apiFetch("/gerencia/dashboard");
}

export async function getCeoState() {
  return apiFetch("/ceo/dashboard", { cache: "no-store" });
}

export async function seedCeo(company: string = "codelco") {
  return apiFetch(`/ceo/seed?company=${encodeURIComponent(company)}`, { method: "POST" });
}

export async function fastForwardCeo(days: number = 30) {
  return apiFetch(`/ceo/fast_forward?days=${days}`, { method: "POST" });
}

export const listLogbookEntries = (hid: string) =>
  apiFetch(`/logbook?household_id=${encodeURIComponent(hid)}`, { cache: "no-store" });

export const createLogbookEntry = (hid: string, formData: FormData) =>
  apiFetchMultipart(`/logbook?household_id=${encodeURIComponent(hid)}`, formData);

export const analyzeForensicDocument = (hid: string, formData: FormData) => {
  formData.set("household_id", hid);
  return apiFetchMultipart("/forensics/analyze_document", formData);
};

export const analyzeContractualPackage = (hid: string, formData: FormData) => {
  formData.set("household_id", hid);
  return apiFetchMultipart("/forensics/contractual_analysis", formData);
};

// VG+2.5: sube una receta/boleta → crea un medicamento "pendiente confirmar IA".
export const scanPrescription = (hid: string, pid: string, formData: FormData) => {
  formData.set("household_id", hid);
  formData.set("person_id", pid);
  return apiFetchMultipart("/unit_functions/scan_prescription", formData);
};

// VG+2.2: Bandeja Inteligente — analizar documento, listar y confirmar/rechazar.
export const smartInboxAnalyze = (hid: string, pid: string, formData: FormData) => {
  formData.set("household_id", hid);
  if (pid) formData.set("person_id", pid);
  return apiFetchMultipart("/smart_inbox/analyze", formData);
};
export const smartInboxList = (hid: string, status = "pending") =>
  apiFetch(`/smart_inbox/candidates?household_id=${encodeURIComponent(hid)}&status=${encodeURIComponent(status)}`);
export const smartInboxConfirm = (id: string, overrides: Record<string, any> = {}, allowDuplicate = false) =>
  apiFetch(`/smart_inbox/candidates/${encodeURIComponent(id)}/confirm`, {
    method: "POST",
    body: JSON.stringify({ overrides, allow_duplicate: allowDuplicate }),
  });
export const smartInboxReject = (id: string, reason?: string) =>
  apiFetch(`/smart_inbox/candidates/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason, keep_as_learning: true }),
  });

export const createLogbookShareLink = (entryId: string, ttlSeconds = 900) =>
  apiFetch(`/logbook/${encodeURIComponent(entryId)}/share?ttl_seconds=${ttlSeconds}`, { method: "POST" });

export const revokeLogbookShareLink = (token: string) =>
  apiFetch(`/logbook/shared/${encodeURIComponent(token)}/revoke`, { method: "POST" });

export const getMfaStatus = () =>
  apiFetch("/auth/mfa/status", { cache: "no-store" });

export const changePassword = (currentPassword: string, newPassword: string) =>
  apiFetch("/auth/password/change", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });

export const getEmailStatus = () =>
  apiFetch("/auth/email/status", { cache: "no-store" });

export const requestEmailVerification = () =>
  apiFetch("/auth/email/verification/request", { method: "POST" });

export const verifyEmail = (token: string) =>
  apiFetch(`/auth/email/verify?token=${encodeURIComponent(token)}`, { method: "POST" });

export const listAuthSessions = () =>
  apiFetch("/auth/sessions", { cache: "no-store" });

export const revokeAuthSession = (sessionId: string) =>
  apiFetch("/auth/sessions/revoke", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });

export const revokeOtherAuthSessions = () =>
  apiFetch("/auth/sessions/revoke-others", { method: "POST" });

export const logoutCurrentSession = () =>
  apiFetch("/auth/logout", { method: "POST" });

export const requestPasswordReset = (email: string) =>
  apiFetch(`/auth/password/reset/request?email=${encodeURIComponent(email)}`, { method: "POST" });

export const confirmPasswordReset = (token: string, newPassword: string) =>
  apiFetch("/auth/password/reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });

export const setupMfa = () =>
  apiFetch("/auth/mfa/setup", { method: "POST" });

export const enableMfa = (code: string) =>
  apiFetch(`/auth/mfa/enable?code=${encodeURIComponent(code)}`, { method: "POST" });

export const disableMfa = (code: string) =>
  apiFetch(`/auth/mfa/disable?code=${encodeURIComponent(code)}`, { method: "POST" });

export const regenerateMfaRecoveryCodes = (code: string) =>
  apiFetch(`/auth/mfa/recovery-codes/regenerate?code=${encodeURIComponent(code)}`, { method: "POST" });

export const adminResetMfa = (householdId: string, targetUserId: string) =>
  apiFetch(`/auth/mfa/admin-reset?household_id=${encodeURIComponent(householdId)}&target_user_id=${encodeURIComponent(targetUserId)}`, {
    method: "POST",
  });

export const listAuditEvents = (hid: string, limit = 100) =>
  apiFetch(`/audit?household_id=${encodeURIComponent(hid)}&limit=${limit}`, { cache: "no-store" });

export const listAssistantActions = (hid: string, limit = 100) =>
  apiFetch(`/audit/assistant-actions?household_id=${encodeURIComponent(hid)}&limit=${limit}`, { cache: "no-store" });

export const getOperationalStatus = (hid: string) =>
  apiFetch(`/audit/operational-status?household_id=${encodeURIComponent(hid)}`, { cache: "no-store" });

export const listCouplingGateways = (hid: string) =>
  apiFetch(`/coupling/${encodeURIComponent(hid)}/gateways`, { cache: "no-store" });

export const listAgentHubEvents = (hid: string, limit = 30) =>
  apiFetch(`/coupling/${encodeURIComponent(hid)}/agent-events?limit=${encodeURIComponent(String(limit))}`, { cache: "no-store" });

export const createCouplingGateway = (hid: string, payload: any) =>
  apiFetch(`/coupling/${encodeURIComponent(hid)}/gateways`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const rotateCouplingGatewayToken = (hid: string, gatewayId: string) =>
  apiFetch(`/coupling/${encodeURIComponent(hid)}/gateways/${encodeURIComponent(gatewayId)}/rotate-token`, {
    method: "POST",
  });

export const getAgentSettings = (hid: string) =>
  apiFetch(`/households/${encodeURIComponent(hid)}/settings/agents`, { cache: "no-store" });

export const updateAgentSettings = (hid: string, payload: any) =>
  apiFetch(`/households/${encodeURIComponent(hid)}/settings/agents`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const transcribeVoiceAudio = (hid: string, formData: FormData) => {
  formData.set("household_id", hid);
  return apiFetchMultipart("/audio/transcribe", formData);
};

export const synthesizeVoiceSpeech = (hid: string, text: string, voice = "alloy") =>
  apiFetch("/audio/speech", {
    method: "POST",
    body: JSON.stringify({ household_id: hid, text, voice }),
  });

export const getVoiceAudioStatus = () =>
  apiFetch("/audio/status", { cache: "no-store" });


// =============================================================================
// VantGuide — Sprint VG+2 client API
// =============================================================================

export type UnitFunctionRow = {
  id: string;
  household_id: string | null;
  organization_id: string | null;
  person_id: string;
  responsible_person_id: string | null;
  category: string;
  title: string;
  description: string | null;
  source_type: string;
  source_document_id: string | null;
  due_at: string | null;
  schedule: Record<string, any>;
  recurrence: string | null;
  status: string;
  priority: string;
  supervision_level: string;
  support_mode: string | null;
  evidence_required: boolean;
  reward_rule_id: string | null;
  legacy_task_id: string | null;
  created_by_user_id: string;
  created_by_ai: boolean;
  ai_confidence?: number | null;
  ai_needs_confirmation?: boolean | number;
  ai_extraction_source?: string | null;
  ai_explanation?: string | null;
  confirmed_by_user_id?: string | null;
  confirmed_at?: string | null;
  version?: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export const listUnitFunctions = (params: {
  household_id: string;
  person_id?: string;
  category?: string;
  status?: string;
  limit?: number;
}) => {
  const qs = new URLSearchParams();
  qs.set("household_id", params.household_id);
  if (params.person_id) qs.set("person_id", params.person_id);
  if (params.category) qs.set("category", params.category);
  if (params.status) qs.set("status", params.status);
  if (params.limit) qs.set("limit", String(params.limit));
  return apiFetch(`/unit_functions?${qs.toString()}`);
};

export const getUnitFunction = (id: string) =>
  apiFetch(`/unit_functions/${encodeURIComponent(id)}`);

export const getUnitFunctionTimeline = (id: string, limit = 100) =>
  apiFetch(`/unit_functions/${encodeURIComponent(id)}/timeline?limit=${limit}`);

export const getUnitFunctionVersions = (id: string) =>
  apiFetch(`/unit_functions/${encodeURIComponent(id)}/versions`);

export const patchUnitFunction = (id: string, body: Partial<{
  title: string;
  description: string;
  status: string;
  priority: string;
  due_at: string;
  schedule: Record<string, any>;
  recurrence: string;
  supervision_level: string;
  support_mode: string;
  evidence_required: boolean;
  metadata: Record<string, any>;
}>) =>
  apiFetch(`/unit_functions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const confirmUnitFunction = (id: string, confirmed: boolean, changeReason?: string) =>
  apiFetch(`/unit_functions/${encodeURIComponent(id)}/confirm`, {
    method: "POST",
    body: JSON.stringify({ confirmed, change_reason: changeReason }),
  });

export const createUnitFunction = (body: {
  household_id: string;
  person_id: string;
  category: string;
  title: string;
  description?: string;
  source_type?: string;
  due_at?: string;
  schedule?: Record<string, any>;
  recurrence?: string;
  priority?: string;
  supervision_level?: string;
  support_mode?: string;
  evidence_required?: boolean;
}) =>
  apiFetch(`/unit_functions`, {
    method: "POST",
    body: JSON.stringify(body),
  });

// ----- Biblioteca: evidencia + memoria + persona library -----

export type EvidenceItem = {
  id: string;
  unit_function_id: string | null;
  person_id: string | null;
  household_id: string;
  evidence_type: string;
  text_content: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  metadata: Record<string, any>;
  confidence: number | null;
  created_at: string;
};

export const listEvidence = (params: {
  household_id: string;
  person_id?: string;
  unit_function_id?: string;
  evidence_type?: string;
  limit?: number;
}) => {
  const qs = new URLSearchParams();
  qs.set("household_id", params.household_id);
  if (params.person_id) qs.set("person_id", params.person_id);
  if (params.unit_function_id) qs.set("unit_function_id", params.unit_function_id);
  if (params.evidence_type) qs.set("evidence_type", params.evidence_type);
  if (params.limit) qs.set("limit", String(params.limit));
  return apiFetch(`/library/evidence?${qs.toString()}`);
};

export const createEvidence = (body: {
  household_id: string;
  unit_function_id?: string;
  function_event_id?: string;
  person_id?: string;
  evidence_type: string;
  text_content?: string;
  metadata?: Record<string, any>;
  visible_to_roles?: string[];
}) =>
  apiFetch(`/library/evidence`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const getPersonLibrary = (personId: string, householdId: string) =>
  apiFetch(`/library/evidence/library/${encodeURIComponent(personId)}?household_id=${encodeURIComponent(householdId)}`);

export const createMemory = (body: {
  household_id: string;
  person_id?: string;
  memory_type: string;
  content: string;
  importance?: number;
}) =>
  apiFetch(`/library/memory`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const getPersonSupportProfile = (personId: string, householdId: string) =>
  apiFetch(`/persons/${encodeURIComponent(personId)}/support_profile?household_id=${encodeURIComponent(householdId)}`);

// ----- Multi-responsibles -----

export const listResponsibles = (unitFunctionId: string) =>
  apiFetch(`/unit_functions/${encodeURIComponent(unitFunctionId)}/responsibles`);

export const addResponsible = (unitFunctionId: string, body: {
  person_id: string;
  responsibility_role: string;
  escalation_order?: number;
  notify?: boolean;
  can_confirm?: boolean;
  can_edit?: boolean;
  escalation_delay_minutes?: number;
}) =>
  apiFetch(`/unit_functions/${encodeURIComponent(unitFunctionId)}/responsibles`, {
    method: "POST",
    body: JSON.stringify(body),
  });

// ----- Demo seed (already exists upstream as seedDemo; re-export for clarity) -----
// `seedDemo` is exported above; no duplicate here.

// =============================================================================
// U1-LOCAL — Panel del Hogar
// =============================================================================

// Avisos del Hogar
export const familyBoardList = (hid: string, includeArchived = false) =>
  apiFetch(`/family_board/${encodeURIComponent(hid)}?include_archived=${includeArchived ? 'true' : 'false'}`);
export const familyBoardCreate = (hid: string, body: Record<string, any>) =>
  apiFetch(`/family_board/${encodeURIComponent(hid)}`, { method: "POST", body: JSON.stringify(body) });
export const familyBoardResolve = (hid: string, postId: string) =>
  apiFetch(`/family_board/${encodeURIComponent(hid)}/${encodeURIComponent(postId)}/resolve`, { method: "POST", body: "{}" });
export const familyBoardArchive = (hid: string, postId: string) =>
  apiFetch(`/family_board/${encodeURIComponent(hid)}/${encodeURIComponent(postId)}/archive`, { method: "POST", body: "{}" });
export const familyBoardComments = (hid: string, postId: string) =>
  apiFetch(`/family_board/${encodeURIComponent(hid)}/${encodeURIComponent(postId)}/comments`, { cache: "no-store" });
export const familyBoardComment = (hid: string, postId: string, body: string, reaction?: string) =>
  apiFetch(`/family_board/${encodeURIComponent(hid)}/${encodeURIComponent(postId)}/comments`, { method: "POST", body: JSON.stringify({ body, reaction }) });

// Compras del Hogar
export const shoppingList = (hid: string, status?: string) =>
  apiFetch(`/household_shopping/${encodeURIComponent(hid)}/items${status ? `?status=${encodeURIComponent(status)}` : ''}`);
export const shoppingCreate = (hid: string, body: Record<string, any>) =>
  apiFetch(`/household_shopping/${encodeURIComponent(hid)}/items`, { method: "POST", body: JSON.stringify(body) });
export const shoppingMarkInCart = (hid: string, itemId: string) =>
  apiFetch(`/household_shopping/${encodeURIComponent(hid)}/items/${encodeURIComponent(itemId)}/mark-in-cart`, { method: "POST", body: "{}" });
export const shoppingMarkPurchased = (hid: string, itemId: string) =>
  apiFetch(`/household_shopping/${encodeURIComponent(hid)}/items/${encodeURIComponent(itemId)}/mark-purchased`, { method: "POST", body: "{}" });
export const shoppingCancel = (hid: string, itemId: string) =>
  apiFetch(`/household_shopping/${encodeURIComponent(hid)}/items/${encodeURIComponent(itemId)}/cancel`, { method: "POST", body: "{}" });
export const shoppingCart = (hid: string) =>
  apiFetch(`/household_shopping/${encodeURIComponent(hid)}/cart`);

// Actividades del Día
export const dailyActivitiesList = (hid: string, date?: string) =>
  apiFetch(`/daily_activities/${encodeURIComponent(hid)}${date ? `?date=${encodeURIComponent(date)}` : ''}`);
export const dailyActivityCreate = (hid: string, body: Record<string, any>) =>
  apiFetch(`/daily_activities/${encodeURIComponent(hid)}`, { method: "POST", body: JSON.stringify(body) });
export const dailyActivityComplete = (hid: string, activityId: string) =>
  apiFetch(`/daily_activities/${encodeURIComponent(hid)}/${encodeURIComponent(activityId)}/complete`, { method: "POST", body: "{}" });
export const dailyActivityCancel = (hid: string, activityId: string) =>
  apiFetch(`/daily_activities/${encodeURIComponent(hid)}/${encodeURIComponent(activityId)}/cancel`, { method: "POST", body: "{}" });

// Seed v2 (Familia Demo VantDomus)
export const seedDemoHomeV2 = (hid: string) =>
  apiFetch(`/demo/seed?household_id=${encodeURIComponent(hid)}&mode=home_v2`, { method: "POST", body: "{}" });
