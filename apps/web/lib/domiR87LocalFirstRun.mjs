/**
 * R87: local-only fictional Family onboarding.
 * No cloud registration, production registration changes or external provider.
 * This gate must be evaluated server-side, including on every server action.
 */
export const R87_LOOPBACK_API = "http://127.0.0.1:8001";

export function r87LocalFirstRunEnabled(env = process.env) {
  return env.NODE_ENV === "development" &&
    env.APP_ENV === "local" &&
    !env.VERCEL_ENV &&
    env.NEXT_PUBLIC_API_BASE === R87_LOOPBACK_API;
}

export function r87AliasToEmail(raw) {
  const alias = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!/^[a-z][a-z0-9-]{2,19}$/.test(alias)) return null;
  return alias + "@example.invalid";
}

export function r87ValidFictionalPassword(password, alias) {
  if (typeof password !== "string" || password.length < 12 || password.length > 128) return false;
  if (typeof alias !== "string" || password.toLowerCase().includes(alias.toLowerCase())) return false;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/]
    .filter(re => re.test(password)).length;
  return classes >= 3 || password.length >= 16;
}
