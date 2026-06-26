# Domi — Asistente vivo de VantDomus Hogar (concepto)

> Propuesta de personaje/asistente original para que la app se sienta más viva,
> sin usar IP de terceros (nada de Disney, celebridades, voces famosas).

## DIRECCIÓN VISUAL CANÓNICA (elegida por Manuel) — "Constelación inteligente del hogar"

Referencia visual (Drive): https://drive.google.com/file/d/1groUaiXN6L8-7KV0cBMBK71_ZNwiI_T6/view

Domi = **núcleo tecnológico cálido** que organiza, anticipa, conecta y cuida el
hogar. NO robot genérico / mascota infantil / orb sin identidad / cartoon común /
asistente frío corporativo. SÍ tecnología premium + sistema vivo + cálido +
organizador inteligente + presencia confiable + **constelación modular de funciones**.

Elementos: núcleo luminoso central · rostro simple amable · halo/órbitas · chips
de módulos orbitando (hogar/salud/compras/mensajes/familia/seguridad) · luz
dorada cálida · compatible claro/oscuro.

Paleta: Dorado Solar #FFCD88 · Champagne #F2E6D7 · Coral Suave #FFBFA3 ·
Azul Noche #5B7CFF · Lavanda Bruma #B49AFF.

Estados emocionales: **sereno · motivado · atento · cariñoso · protector**.
Comportamientos: idle=respiración del núcleo · pensando=órbitas giran ·
alert=chip relevante se ilumina · logro=halo se expande y destella ·
cariñoso=coral + pulso · protector=violeta/azul + escudo · organizando=chips se alinean.

**DECISIÓN (Opción B):** para que Domi se vea como el render se usará un **asset
Lottie** (`.json`) por estado. Enchufe implementado: `lib/domiAssets.ts`
(manifiesto), `DomiLottie` (player, ssr:false, fallback a CSS), `DomiOrbAuto`
(elige Lottie si hay asset, si no CSS). Assets van en
`apps/web/public/assistant/domi/` (ver README ahí). Mientras no haya asset, Domi
usa la versión CSS. El owner/diseñador provee el `.json` (LottieFiles o export
After Effects/Bodymovin con la infografía como brief); Rive (.riv) queda como
alternativa interactiva futura. WebGL/three se descartó (conflicto Next 16).

**Implementado (U4, commit 2f5eaeb)** en React/CSS/SVG sin Lottie/Rive:
`DomiOrb` · `DomiPanel` · `DomiStateBadge` · `DomiContextChip`. AssistantOrb pasó
a ser wrapper de compatibilidad sobre DomiOrb. Integrado en Panel del Hogar
(hero) y, vía AssistantOrb, en avisos/compras/actividades. Lottie/Rive = mejora
futura opcional, no bloquea.

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
