// Ruta familiar de Documentos. Compone la vista existente de /esg (bandeja
// inteligente, en modo family muestra "Documentos familiares") con el registro
// de documentos M9 (trazabilidad + versiones + antivirus + vigencia).
import EsgPage from "../../esg/[householdId]/page";
import FamilyDocuments from "../../components/FamilyDocuments";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params;
  // La página de /esg es un server component async; la renderizamos como hijo.
  const esg = await EsgPage({ params: Promise.resolve({ householdId }) });
  return (
    <>
      {esg}
      <div className="container" style={{ marginTop: 8 }}>
        <FamilyDocuments hid={householdId} />
      </div>
    </>
  );
}
