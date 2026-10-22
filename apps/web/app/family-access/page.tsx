import Link from "next/link";
import { redirect } from "next/navigation";
import { getHouseholds } from "../../lib/api";
import { resolveDomiFamilyLanding } from "../../lib/domiFamilyLanding.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Authenticated landing: never silently downgrade to legacy dashboard. */
export default async function FamilyAccessPage() {
  let result;
  try {
    const households = await getHouseholds();
    result = resolveDomiFamilyLanding(households);
  } catch (error) {
    result = resolveDomiFamilyLanding(null, error);
  }
  if (result.state === "home" && result.householdId) {
    redirect(`/hogar/${result.householdId}`);
  }
  return (
    <main style={{maxWidth:620,margin:"9vh auto",padding:28,fontFamily:"system-ui"}}>
      <h1>DOMI · Acceso familiar</h1>
      {result.state === "session" ? (
        <>
          <p>Tu sesión ya no es válida. Inicia sesión nuevamente. No se ha realizado ningún cambio en tu hogar.</p>
          <Link href="/login?next=/family-access">Iniciar sesión</Link>
        </>
      ) : result.state === "not_assigned" ? (
        <>
          <p>Tu cuenta está autenticada, pero todavía no tiene un hogar asignado. En el piloto familiar cerrado, la incorporación se realiza mediante invitación autorizada.</p>
          <p>No se crearán familiares ni datos de demostración automáticamente.</p>
        </>
      ) : (
        <>
          <p>No puedo consultar el hogar en este momento. Puede ser un problema temporal de conexión con el servicio familiar; no significa necesariamente que tus credenciales sean incorrectas.</p>
          <p>No se ha guardado ni modificado información. Puedes intentar nuevamente.</p>
          <Link href="/family-access">Volver a consultar</Link>
        </>
      )}
    </main>
  );
}
