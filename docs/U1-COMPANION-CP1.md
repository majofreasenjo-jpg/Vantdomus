# Sprint U1-COMPANION — CP1: Domi Companion Core

**Estado:** entregado para revisión (no avanzar a CP2 sin aprobación).
**Fecha:** 2026-06-27 · **Commit base:** ver `git log` (`feat(web): U1-COMPANION CP1`).
**Sin deploy · sin secretos · sin APIs externas.**

## Qué se construyó
La home `/hogar/[householdId]` dejó de ser un dashboard de módulos y pasó a ser
una **pantalla única companion-first**: Domi vivo al centro + entrada universal
(voz/texto/documento) + tarjetas dinámicas que aparecen según la conversación.

### Componentes nuevos
- `app/components/DomiCore.tsx` — Domi vivo 100% CSS/SVG (sin foto/raster). Núcleo
  ámbar + halo de acento + órbitas + partículas + rostro SVG. 8 estados:
  `listo · escuchando · pensando · acompanando · proponiendo · esperando · calma · alerta`.
- `app/components/DomiCompanion.tsx` — la pantalla viva (client): Domi + saludo +
  feed de tarjetas + barra de entrada (micrófono / texto / subir documento).
- `app/components/DomiCalm.tsx` — sonido tranquilo generado con Web Audio API
  (local, sin archivos ni servicios). Apoyo de calma, no clínico.
- `lib/domiIntents.ts` — interpretación LOCAL por reglas (sin LLM, sin red):
  texto → frase + estado + tarjetas. Acciones sensibles marcadas `sensitive`.

### Reescrito
- `app/hogar/[householdId]/page.tsx` — Server Component: solo obtiene datos reales
  (resumen del día, conteos) y los pasa a `DomiCompanion`. Sin grillas de módulos.
- `app/layout.tsx` — navegación reducida en familia: **Inicio · Hoy · Guía ·
  Documentos · Más**. El resto (Mural, Compras, Salud, Presupuesto, Biblioteca,
  Agenda, Perfiles, Ajustes) vive bajo **Más**. **Bottom nav móvil** (Inicio /
  Hoy / Domi / Documentos / Guía). Se retiró el Domi flotante (sticker).

### Retirado como principal (no borrado del disco)
`DomiCoreImage`, `DomiLottie`, `DomiOrbAuto`, `DomiPanel`, `DomiFloating` y los PNG
de Domi (`public/assistant/domi/*.png`) ya **no se usan** como asistente principal.

## Verificación (en vivo, navegador local)
- Home: HTTP 200, sin errores de build. Domi vivo (`.dcoreFace`) + estado "listo".
- **No** aparece dashboard viejo (0 grillas "Avisos/Compras del hogar"); **no** hay
  foto (`domiCimg` = 0).
- Feed inicial: tarjeta de **resumen real** ("📌 Diego tiene prueba…", medicamentos
  de la noche, compras pendientes) + **5 acciones sugeridas**.
- Flujo conversacional: "agrega leche y paracetamol" → Domi clasifica
  **Supermercado: leche / Farmacia: paracetamol** → propuesta con **Confirmar /
  Ahora no**; estado pasa a "esperando confirmación"; al confirmar: "✓ Confirmado.
  Lo dejé anotado."
- Confirmación humana: las propuestas sensibles (medicamento, avisar familia)
  muestran "🛡️ Esto requiere tu confirmación. Domi no lo hace solo."
- Responsive móvil (375px): bottom nav visible, nav superior oculta, Domi + barra
  presentes. Módulos (avisos/compras/salud/documentos/recordatorios/guía) siguen 200.

> Nota honesta: no se pudieron adjuntar capturas PNG — el capturador del preview de
> este entorno se cuelga con animaciones continuas. La verificación se hizo midiendo
> el DOM en vivo (estructura, estados, flujo e interacción).

## Real vs mock (CP1)
- **Real:** datos del hogar (resumen, conteos) desde backend; clasificación de
  compras y respuestas por reglas reales; subir archivo (recepción).
- **Mock/local:** voz (Web Speech si el navegador lo soporta; si no, invita a
  escribir); intención por reglas (sin LLM); confirmación de propuestas registra
  localmente (la escritura real a endpoints llega en CP4); ruteo de documento es
  preview (ingesta real en CP4); sonido de calma sintetizado con Web Audio.

## Confirmaciones de la regla del sprint
- ✅ Domi foto ya **no** es el asistente principal (CSS/SVG vivo).
- ✅ Sin deploy. ✅ Sin secretos. ✅ Sin APIs externas. ✅ Sin diagnóstico médico /
  sin reemplazo de cuidador. ✅ Confirmación humana en salud/medicamentos/seguridad.

## Riesgos detectados
1. Web Speech API no está en todos los navegadores → fallback a texto (ya cubierto).
2. El primer arranque del dev server compila lento (Turbopack); el server local se
   apaga entre sesiones (reiniciar cuando toque). No afecta producción (no hay deploy).
3. Falta acción real (escritura) tras confirmar — previsto para CP4.

## Próximo paso recomendado (CP2)
Experiencia Senior / Elena: vista de compañía ("Buenos días, Elena. Estoy aquí
contigo.") con tarjetas (cómo amaneciste, medicamento con confirmación humana,
música tranquila, respiración 1 min, avisar a Camila, mi día, necesito ayuda) y
respuestas cálidas por reglas. **Requiere aprobación antes de iniciar.**
