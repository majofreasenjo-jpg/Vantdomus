# Domi — Asistente vivo de VantDomus Hogar (concepto)

> Propuesta de personaje/asistente original para que la app se sienta más viva,
> sin usar IP de terceros (nada de Disney, celebridades, voces famosas).

## Nombre
**Domi** (de "domus" = hogar). Alternativas evaluadas: Luma, Nido, Vanti, Alma.
Recomendado: **Domi** (cálido, corto, memorable, neutro de género).

## Personalidad
Cálida · confiable · calmada · útil · no invasiva · **no infantil en exceso**
(sirve para familia y adulto mayor) · no clínica · no caricatura burda. Domi
**acompaña y propone**; nunca decide por el usuario.

## Forma visual (MVP)
Un **orb** suave y redondeado (no una cara caricaturesca): degradado cálido con
un brillo interior y un halo tenue. Transmite "presencia" sin infantilizar.
Implementado en CSS (`AssistantOrb`), liviano y accesible.

## Estados y voz (microcopy)
| Estado | Cuándo | Frase |
|---|---|---|
| idle | en reposo | "Estoy aquí para ayudarte a ordenar el hogar." |
| thinking | analizando documento | "Estoy revisando el documento." |
| alert | propuesta pendiente | "Encontré algo importante, revísalo antes de activar." |
| success | acción creada | "Listo, lo dejé organizado." |
| calm | onboarding / paso a paso | "Vamos paso a paso." |
| listening | (futuro voz) | "Te escucho." |

## Dónde aparece (no invasivo)
Header de Guía Familiar · panel de Bandeja Inteligente · (futuro) empty states,
confirmación IA, onboarding y alertas suaves. **No** en todas partes.

## Implementación
- **Hoy (MVP):** `apps/web/app/components/AssistantOrb.tsx` (CSS, sin assets).
  Props: `state` (idle|thinking|success|alert|calm|listening), `label`,
  `compact`, `showLabel`. Respeta `prefers-reduced-motion`; fallback estático.
- **Después:** Lottie (`.lottie/.json`) para animación rica, o **Rive** con state
  machine para estados interactivos (idle/listening/processing/celebrates/
  gentle_alert/care_mode/study_mode/document_scan). Ver
  `apps/web/public/assistant/README.md`.

## Reglas (DoD visual)
No clipart barato · no app infantil para adulto mayor · funciona en móvil ·
fallback si la animación falla · respeta reduced-motion · no bloquea performance ·
asset siempre **original** con licencia documentada.
