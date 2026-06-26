import { NextRequest, NextResponse } from "next/server";

/**
 * Handoff de login social: la API redirige aquí con el token de sesión tras un
 * OAuth exitoso. Fijamos la cookie httpOnly que el resto de la app ya usa
 * (vantdomus_access_token) y llevamos al usuario a su inicio.
 *
 * Si no hay token (p. ej. login social no configurado), volvemos al login con
 * un mensaje claro — sin fingir sesión.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const expiresIn = parseInt(req.nextUrl.searchParams.get("expires_in") || "3600", 10);
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=No se pudo completar el login social", req.url));
  }
  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.set("vantdomus_access_token", token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: Number.isFinite(expiresIn) ? expiresIn : 3600,
  });
  return res;
}
