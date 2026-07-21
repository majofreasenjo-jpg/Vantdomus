// OPS-1 (PWA) — Icono 192x192 para el manifest (Android/Chrome).
import { ImageResponse } from "next/og";
import { DomiFace } from "../../pwaIcon";

export function GET() {
  return new ImageResponse(<DomiFace size={192} />, { width: 192, height: 192 });
}
