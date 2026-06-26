import { cookies } from "next/headers";

/**
 * Deja una cookie efímera para que el componente cliente <Celebrate/> lance el
 * confetti de Domi tras una acción de "completar". Se autoconsume en el cliente.
 */
export async function markCelebrate(): Promise<void> {
  try {
    const store = await cookies();
    store.set("vd_celebrate", "1", { path: "/", maxAge: 10, sameSite: "lax" });
  } catch {
    /* noop: si no hay contexto de request, simplemente no celebra */
  }
}
