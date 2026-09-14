import type { Metadata } from "next";
import InvitationClient from "./InvitationClient";

// CP1d-FAMILY-PILOT-1b.2 — Página de aceptación de invitación.
// noindex + no-store; sin scripts de terceros, analytics ni píxeles.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

// Fuerza render dinámico y evita cualquier cacheo de la respuesta.
export const dynamic = "force-dynamic";

export default function InvitacionPage() {
  // El token viaja solo en el fragmento (#t=), invisible para el servidor:
  // toda la lógica vive en el client component.
  return <InvitationClient />;
}
