import DomiWarmLoader from "../components/domi/DomiWarmLoader";

// /inicio resuelve el hogar y redirige a /hogar/<hid>. Mientras resuelve, este
// loader cálido evita el flash del chrome antiguo (fondo oscuro + navbar).
export default function Loading() {
  return <DomiWarmLoader />;
}
