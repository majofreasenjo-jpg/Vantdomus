// CP1d-FAMILY-PILOT-1b.2 — Custodia del token de invitación (solo memoria).
//
// El token viaja EXCLUSIVAMENTE en el fragmento de URL (/invitacion#t=<token>),
// que el navegador NUNCA envía al servidor. Este módulo:
//   1. lee window.location.hash una sola vez;
//   2. extrae exclusivamente #t=;
//   3. valida formato/longitud defensiva;
//   4. limpia la URL con history.replaceState ANTES de cualquier fetch;
//   5. conserva el token solo en memoria de la pestaña;
//   6. lo borra tras éxito, error terminal o desmontaje;
//   7. jamás expone el valor en excepciones ni console output.
//
// No hay fallback desde query string: si llega ?t=, se limpia y se ignora.

// Formato defensivo: el token del backend es secrets.token_urlsafe(32) →
// ~43 chars base64url. Aceptamos [A-Za-z0-9_-] de 20 a 200 chars.
const TOKEN_RE = /^[A-Za-z0-9_-]{20,200}$/;

let _token: string | null = null;

/** Valida el formato del token SIN registrar su valor. */
export function isValidTokenFormat(candidate: unknown): boolean {
  return typeof candidate === "string" && TOKEN_RE.test(candidate);
}

/**
 * Extrae el token del hash una sola vez, limpia la URL y lo guarda en memoria.
 * Devuelve un estado (no el token) para que el llamador NO lo maneje directo.
 * - "ready": había un #t=<token> válido; ya está en memoria y la URL está limpia.
 * - "query-present": llegó ?t= (u otro), se limpió la URL, token IGNORADO.
 * - "absent": no había token utilizable.
 */
export function initTokenFromLocation(loc?: {
  hash: string;
  search: string;
  pathname: string;
}): "ready" | "query-present" | "absent" {
  const location = loc ?? (typeof window !== "undefined" ? window.location : null);
  if (!location) return "absent";

  const hash = location.hash || "";
  const search = location.search || "";
  const hadQueryToken = /[?&]t=/.test(search);

  let extracted: string | null = null;
  // hash llega como "#t=xxxx" (o vacío). Parsear solo el par t=.
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const pair of raw.split("&")) {
    const [k, v] = pair.split("=");
    if (k === "t" && v) {
      extracted = decodeURIComponent(v);
      break;
    }
  }

  // Limpiar SIEMPRE la URL a /invitacion (quita hash y query) antes de seguir.
  _cleanUrl(location.pathname);

  if (extracted && isValidTokenFormat(extracted)) {
    _token = extracted;
    return "ready";
  }
  // Token en query, o hash malformado: se ignora (nunca se procesa un ?t=).
  _token = null;
  return hadQueryToken ? "query-present" : "absent";
}

function _cleanUrl(pathname: string) {
  try {
    if (typeof window !== "undefined" && window.history?.replaceState) {
      // Path fijo /invitacion, sin hash ni query.
      const clean = pathname && pathname.startsWith("/") ? pathname : "/invitacion";
      window.history.replaceState(null, "", clean.split("#")[0].split("?")[0]);
    }
  } catch {
    // no-op: nunca propagar (podría filtrar contexto).
  }
}

/** ¿Hay un token en memoria listo para enviar en el body? */
export function hasToken(): boolean {
  return _token !== null;
}

/**
 * Ejecuta `use(token)` con el token en memoria. El token nunca sale de aquí
 * como valor de retorno; solo se pasa al callback (típicamente el body de un
 * fetch). Se puede borrar tras usarlo con `clearAfter`.
 */
export async function withToken<T>(
  use: (token: string) => Promise<T>,
  opts?: { clearAfter?: boolean },
): Promise<T> {
  if (_token === null) throw new Error("invitation token no disponible");
  try {
    return await use(_token);
  } finally {
    if (opts?.clearAfter) clearToken();
  }
}

/** Borra el token de memoria (tras éxito, error terminal o desmontaje). */
export function clearToken(): void {
  _token = null;
}
