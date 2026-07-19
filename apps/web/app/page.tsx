import { redirect } from "next/navigation";

// CP1d-FAMILY-PILOT-WEB-HARDENING: la raíz NUNCA muestra la portada tecnica
// heredada del prototipo. El piloto familiar cerrado entra SIEMPRE por el
// login. Solución mínima ordenada por auditoría: redirect, sin rediseñar
// Domi ni crear una home nueva.
export default function Home() {
  redirect("/login");
}
