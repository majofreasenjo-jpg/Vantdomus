import ModoCompra from "./ModoCompra";

export const dynamic = "force-dynamic";

export default async function ModoCompraPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params;
  return <ModoCompra hid={householdId} />;
}
