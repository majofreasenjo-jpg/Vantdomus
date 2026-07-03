import DomiFaceMark from "./DomiFaceMark";

/**
 * DomiWarmLoader — pantalla de carga cálida y coherente con Domi. Se usa como
 * loading.tsx en las rutas que llevan a la home companion (/inicio resolver y
 * /hogar), para evitar el flash de "página vieja azul" con el navbar durante la
 * transición. id="vantdomus-app" dispara la regla global que oculta el navbar.
 */
export default function DomiWarmLoader({ label = "Domi está preparando tu hogar…" }: { label?: string }) {
  return (
    <div
      id="vantdomus-app"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        zIndex: 40,
        background:
          "radial-gradient(900px 560px at 20% 10%, rgba(255,176,136,.30), transparent 55%)," +
          "radial-gradient(820px 560px at 85% 25%, rgba(255,136,176,.24), transparent 55%)," +
          "linear-gradient(135deg, #E2E9FF 0%, #FFF1E0 46%, #FFEBEA 100%)",
      }}
    >
      <style>{`@keyframes vdload{0%,100%{transform:translateY(0) scale(1);opacity:.92}50%{transform:translateY(-8px) scale(1.03);opacity:1}}`}</style>
      <div style={{ animation: "vdload 1.8s ease-in-out infinite" }}>
        <DomiFaceMark size={104} />
      </div>
      <div style={{ color: "#6b6795", fontSize: 14, fontWeight: 500, letterSpacing: ".2px" }}>{label}</div>
    </div>
  );
}
