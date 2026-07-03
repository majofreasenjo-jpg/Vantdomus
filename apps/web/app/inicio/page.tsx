/**
 * /inicio — destino de aterrizaje tras el login (CP1c).
 *
 * Resuelve el hogar del usuario y lo lleva DIRECTO a la home companion de Domi
 * (`/hogar/<hid>`), en vez de la pantalla técnica antigua (`/dashboard`).
 * Si no hay hogar o la sesión no es válida, cae a `/dashboard` como respaldo.
 *
 * Nota: redirect() de next/navigation lanza NEXT_REDIRECT (control de flujo), por
 * eso se llama SIEMPRE fuera del try/catch — nunca dentro.
 */
import { redirect } from "next/navigation";
import { getHouseholds } from "../../lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InicioPage() {
  let hid = "";
  try {
    const households = await getHouseholds();
    hid = households?.items?.[0]?.id || "";
  } catch {
    hid = "";
  }

  if (hid) {
    redirect(`/hogar/${hid}`);
  }
  // Sin hogar disponible (o sesión inválida): respaldo a la vista general.
  redirect("/dashboard");
}
