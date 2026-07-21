/**
 * OPS-1 — Proxy de clima real (Open-Meteo, gratis, sin API key).
 *
 * El frontend tiene CSP `connect-src 'self'`, así que el navegador NO puede
 * llamar a api.open-meteo.com directo. Este route (mismo origen) consulta
 * Open-Meteo desde el SERVIDOR y devuelve solo la temperatura y la condición.
 * Recibe lat/lon ya redondeados por el cliente (privacidad ~1 km).
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Códigos WMO → condición en español (resumido).
const WMO: Record<number, string> = {
  0: "Despejado", 1: "Mayormente despejado", 2: "Parcialmente nublado", 3: "Nublado",
  45: "Niebla", 48: "Niebla",
  51: "Llovizna", 53: "Llovizna", 55: "Llovizna",
  56: "Llovizna helada", 57: "Llovizna helada",
  61: "Lluvia", 63: "Lluvia", 65: "Lluvia fuerte",
  66: "Lluvia helada", 67: "Lluvia helada",
  71: "Nieve", 73: "Nieve", 75: "Nieve intensa", 77: "Aguanieve",
  80: "Chubascos", 81: "Chubascos", 82: "Chubascos fuertes",
  85: "Chubascos de nieve", 86: "Chubascos de nieve",
  95: "Tormenta", 96: "Tormenta con granizo", 99: "Tormenta con granizo",
};

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "bad_coords" }, { status: 400 });
  }
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}` +
      `&longitude=${lon.toFixed(2)}&current=temperature_2m,weather_code`;
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!r.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });
    const j = await r.json();
    const t = j?.current?.temperature_2m;
    const code = j?.current?.weather_code;
    if (typeof t !== "number") return NextResponse.json({ error: "no_data" }, { status: 502 });
    return NextResponse.json({ tempC: Math.round(t), condition: WMO[code] ?? "" });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
