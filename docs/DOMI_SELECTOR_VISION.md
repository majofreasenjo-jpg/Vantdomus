# Selector de Domi — visión (preparación, no feature aún)

Un **mismo** Domi con **modos visuales/relacionales**. No son bots distintos ni
personajes sin control: Domi conserva identidad única y se adapta por persona,
contexto y momento.

## Modos iniciales
- **Domi Clásico** — hogar completo, organización general.
- **Domi Calma** — bienestar, respiración, música tranquila, acompañamiento.
- **Domi Senior** — adulto mayor: recordatorios, compañía, ayuda simple.
- **Domi Estudio** — apoyo escolar: pruebas, tareas, repaso.
- **Domi Protector** — salud sensible, seguridad, confirmaciones.
- **Domi Noche** — cierre del día, descanso, resumen nocturno.

## Qué puede cambiar cada modo
paleta · halo · expresión · ritmo de animación · tono de voz (futuro) · microcopy ·
acciones sugeridas · nivel de detalle · tipo de tarjetas.

## Estado actual (preparado, NO cableado)
- `apps/web/lib/domiModeTokens.ts`: `DomiMode` + `DOMI_MODE_TOKENS` (label, tagline,
  icon, defaultState emocional, suggestedTheme, motion, detail, cardStyle, suggested).
  Reutiliza `domiStateTokens` (estados emocionales) y `domiThemes` (ambiente).
- **No** se implementa como feature profunda mientras la home premium (CP1b) no
  esté aprobada visualmente por el owner.

## Ubicación futura (cuando se active)
Ajustes de Domi · onboarding familiar · perfil por integrante · selector rápido en
la home (p. ej. `?domiMode=senior` para inspección, luego selector real).

## Regla
Domi no pierde identidad. Es el mismo Domi adaptándose a cada persona y situación.
