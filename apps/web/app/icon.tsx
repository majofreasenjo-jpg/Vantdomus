// OPS-1 (PWA) — Favicon generado (next/og). Next inyecta <link rel="icon">.
import { ImageResponse } from "next/og";
import { DomiFace } from "./pwaIcon";

export const size = { width: 256, height: 256 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<DomiFace size={256} />, { ...size });
}
