// Ruta familiar de Documentos. Reutiliza el componente de /esg (mismo
// repositorio) pero con URL coherente para el hogar: en modo family el
// componente ya muestra "Documentos familiares" y oculta la jerga ESG.
// ESG como tal queda reservado para los presets B2B en /esg.
export { default } from "../../esg/[householdId]/page";
