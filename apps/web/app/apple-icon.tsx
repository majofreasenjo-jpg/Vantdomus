// OPS-1 (PWA) — Icono de pantalla de inicio en iPhone/iPad (apple-touch-icon).
// Next inyecta <link rel="apple-touch-icon"> automáticamente.
import { ImageResponse } from "next/og";
import { DomiFace } from "./pwaIcon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<DomiFace size={180} />, { ...size });
}
