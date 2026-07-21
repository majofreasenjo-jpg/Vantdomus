// OPS-1 (PWA) — Icono 512x512 para el manifest (Android/Chrome, incl. maskable).
import { ImageResponse } from "next/og";
import { DomiFace } from "../../pwaIcon";

export function GET() {
  return new ImageResponse(<DomiFace size={512} />, { width: 512, height: 512 });
}
