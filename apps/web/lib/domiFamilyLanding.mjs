/**
 * R75 — Determine the first post-login experience without suppressing API
 * failures or sending an authenticated family to the legacy dashboard.
 * Pure decision only; server authentication remains with the existing API.
 */
export function resolveDomiFamilyLanding(response, error = null) {
  if (error) {
    const message = String(error?.message ?? error);
    const code = /^(\d{3})(?:\s|:|$)/.exec(message)?.[1] || "";
    return { state: code === "401" || code === "403" ? "session" : "service_unavailable" };
  }
  if (!response || typeof response !== "object" || !Array.isArray(response.items)) {
    return { state: "service_unavailable" };
  }
  if (response.items.length === 0) return { state: "not_assigned" };
  const first = response.items[0];
  // Reject unexpected types before interpolating into a link.
  if (!first || typeof first.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(first.id)) {
    return { state: "service_unavailable" };
  }
  return { state: "home", householdId: first.id };
}
