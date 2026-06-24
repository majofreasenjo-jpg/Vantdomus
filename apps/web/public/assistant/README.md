# Assistant "Domi" — assets

El MVP de Domi (AssistantOrb) es 100% CSS (ver `app/components/AssistantOrb.tsx`
y el bloque `.assistantOrb` en `app/globals.css`). No requiere assets ni
licencias.

## Cómo reemplazar por Lottie o Rive (futuro)

1. Conseguir/crear un asset ORIGINAL (no usar IP de terceros: nada de Disney,
   celebridades, voces famosas). Documentar fuente/licencia acá.
2. Lottie: colocar `domi.lottie` o `domi.json` en esta carpeta. Cargar con
   `@lottiefiles/dotlottie-react` o `lottie-react` dentro de un componente
   `"use client"` que reemplace internamente a AssistantOrb, manteniendo la misma
   API de props (state/label/compact). Mapear estados a segmentos/markers.
3. Rive: colocar `domi.riv` acá y usar `@rive-app/react-canvas` con una state
   machine; inputs por estado (idle, listening, processing, celebrates,
   gentle_alert, care_mode, study_mode, document_scan).
4. Mantener SIEMPRE: fallback estático, `prefers-reduced-motion`, y que no
   bloquee performance. Si el asset falla en cargar, volver al orb CSS.

Estados que la app ya usa: idle | thinking | success | alert | calm | listening.
