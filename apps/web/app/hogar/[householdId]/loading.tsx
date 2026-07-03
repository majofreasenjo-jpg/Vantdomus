import DomiWarmLoader from "../../components/domi/DomiWarmLoader";

// Loader cálido de la home companion (reemplaza el skeleton antiguo). Oculta el
// navbar durante la carga vía id="vantdomus-app" → sin flash de chrome antiguo.
export default function Loading() {
  return <DomiWarmLoader />;
}
