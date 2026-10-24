/**
 * R74. Classify failed owner/family login without exposing upstream internals.
 * In particular a suspended/unreachable API is NOT an incorrect password.
 * No network, accounts, tokens or household data are consulted here.
 */
export function classifyDomiLoginFailure(error) {
  const status = typeof error?.status === "number"
    ? error.status
    : Number(/^(\d{3})(?:\s|:|$)/.exec(String(error?.message ?? ""))?.[1] || 0);
  if (status === 428) return "mfa_required";
  if (status === 429) return "rate_limited";
  if ([408, 500, 501, 502, 503, 504, 507, 508].includes(status)) return "service_unavailable";
  if ([400, 401, 403, 404, 422].includes(status)) return "credentials_rejected";
  const msg = String(error?.message || "");
  if (/fetch failed|failed to fetch|network|timeout|timed out|connect|econnrefused|enotfound|dns|socket|aborted|econnreset/i.test(msg)) {
    return "service_unavailable";
  }
  // Fail closed on unexpected failures: an unknown server error is not proof
  // that the human entered invalid credentials.
  return "service_unavailable";
}

export function safeDomiLoginMessage(error) {
  switch (classifyDomiLoginFailure(error)) {
    case "mfa_required": return "Se requiere tu codigo de verificacion MFA.";
    case "rate_limited": return "Demasiados intentos. Intenta nuevamente mas tarde.";
    case "credentials_rejected": return "No se pudo iniciar sesion. Revisa tus credenciales o el estado de tu cuenta.";
    default: return "DOMI no puede conectarse al servicio familiar. No se ha iniciado sesion; intenta mas tarde.";
  }
}
