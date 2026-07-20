// Perfil de runtime del frontend (CP1d-FAMILY-PILOT-1a-DEPLOY-PREFLIGHT).
//
// Módulo JS puro (sin dependencias de Next) para poder testearlo con
// `node --test` además de importarlo desde los server actions TS.
//
// Entornos ONLINE => cookies Secure obligatorias:
//   - production / prod / staging (sin cambios)
//   - family-pilot (piloto familiar cerrado bajo HTTPS; NO equivale a demo)
//   - family-live (piloto OPERATIVO bajo HTTPS; mismo blindaje, con IA/docs/estudio)
// Entornos de desarrollo local (local/dev/development/demo/test) siguen sin
// Secure para poder trabajar en http://localhost.

// Perfiles familiares CERRADOS (OPS-1): ambos son online, por invitación, sin
// OAuth público. family-live añade las funciones de valor (IA/docs/estudio).
export const FAMILY_PROFILE_ENVS = Object.freeze([
  "family-pilot",
  "family_pilot",
  "familypilot",
  "family-live",
  "family_live",
  "familylive",
]);

export const SECURE_COOKIE_ENVS = Object.freeze([
  "production",
  "prod",
  "staging",
  ...FAMILY_PROFILE_ENVS,
]);

/**
 * Resuelve el APP_ENV efectivo. Acepta un valor explícito (para tests);
 * si no, lee process.env.APP_ENV / VANTDOMUS_DEPLOY_ENV con default "local".
 * @param {string} [explicit]
 * @returns {string}
 */
export function resolveAppEnv(explicit) {
  const raw =
    explicit ??
    process.env.APP_ENV ??
    process.env.VANTDOMUS_DEPLOY_ENV ??
    "local";
  return String(raw).trim().toLowerCase();
}

/**
 * true si las cookies de autenticación/CSRF deben llevar Secure.
 * @param {string} [explicitEnv]
 * @returns {boolean}
 */
export function cookieSecure(explicitEnv) {
  return SECURE_COOKIE_ENVS.includes(resolveAppEnv(explicitEnv));
}

/**
 * true si el entorno es un perfil familiar cerrado (pilot o live): online,
 * por invitación, sin registro público ni OAuth público.
 * @param {string} [explicitEnv]
 * @returns {boolean}
 */
export function isFamilyProfileEnv(explicitEnv) {
  return FAMILY_PROFILE_ENVS.includes(resolveAppEnv(explicitEnv));
}
