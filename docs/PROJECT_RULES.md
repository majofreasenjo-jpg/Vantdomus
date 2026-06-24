# VantDomus — Project Rules

> Reglas canónicas y obligatorias del proyecto VantDomus / VantGuide.
> Este documento es fuente de verdad. El chat solo coordina; el chat NO es
> fuente de verdad.

## Fuentes de verdad

La fuente de verdad del proyecto es, en este orden:

1. **GitHub** — repo `https://github.com/majofreasenjo-jpg/Vantdomus` (branch `main`).
2. **Google Drive** — carpeta canónica del proyecto.
3. **Documentos canónicos** (Drive y `docs/` del repo).
4. **Runbooks** (`docs/DEPLOY_DEMO_RUNBOOK.md`, etc.).
5. **Commits**.
6. **Tests**.
7. **Deploy logs no sensibles** y respaldos.

El chat solo coordina. Si un chat temporal se corta, cualquier asistente debe
poder rehidratarse leyendo `docs/REHYDRATION_INDEX.md` y los documentos canónicos.

## Regla canónica de rehidratación / continuidad

Cada **corte importante** debe dejar una cápsula de continuidad en Google Drive,
actualizando como mínimo `VANTDOMUS_REHIDRATACION_ULTIMO_CORTE`.

Se considera "corte importante":
cierre de análisis relevante · aprobación/rechazo de sprint · emisión de bloque
ejecutorio para Claude Code · avance relevante de deploy · cierre de gate ·
cambio arquitectónico · decisión estratégica · detección o corrección de riesgo
de seguridad · cambio de narrativa comercial · cambio importante de UX/producto ·
creación de respaldo · entrega de informe relevante.

Si el cambio es **estructural**, además actualizar:
- `VANTDOMUS_CANONICO_PROYECTO_v1` (Drive) y `docs/VANTDOMUS_CANONICO_PROYECTO.md` (repo).
- `VANTDOMUS_MANUAL_PROYECTO_TECNICO_v1` (Drive) y `docs/VANTDOMUS_MANUAL_PROYECTO_TECNICO.md` (repo).
- `VANTDOMUS_MANUAL_USO_v1` (Drive) y `docs/VANTDOMUS_MANUAL_USO.md` (repo), si afecta al usuario final.

## Cuándo actualizar Google Drive

En todo corte importante (lista de arriba). Mínimo: la cápsula de rehidratación.
La cápsula debe registrar: estado actual, último commit, sprint cerrado, próximo
paso, riesgos abiertos. Nunca registrar secretos.

## Documentos canónicos de Drive

Carpeta canónica:
`https://drive.google.com/drive/folders/1N-zSfErK7P57cGrKyX5lEy4rgSn1WPzd`

1. `VANTDOMUS_CANONICO_PROYECTO_v1` — `https://docs.google.com/document/d/1C1AaM86MLCLkzC-h0VqQcwXuUictomNPtKY9SF2HrH8/edit`
2. `VANTDOMUS_REHIDRATACION_ULTIMO_CORTE` — `https://docs.google.com/document/d/19__lWxvxNaBKJ83SelviG2m6B_ILk7hm7q_vUed3wJU/edit`
3. `VANTDOMUS_MANUAL_USO_v1` — `https://docs.google.com/document/d/1IrBqm_qPuzZDjSrbRJmED9IlNb-JsabmcmJBSR-wQVo/edit`
4. `VANTDOMUS_MANUAL_PROYECTO_TECNICO_v1` — `https://docs.google.com/document/d/18Rw3oyCuHdhrS52ctouL6MWazNZL-RTM6KjJtfRPmQA/edit`

Respaldos de fuente (ZIP + docs) en `G:\Mi unidad\GMATIVE\VantDomus_Backups\<fecha>\`.

## Documentos canónicos del repo (`docs/`)

- `docs/PROJECT_RULES.md` (este).
- `docs/REHYDRATION_INDEX.md` — índice de rehidratación.
- `docs/VANTDOMUS_CANONICO_PROYECTO.md` — documento canónico completo.
- `docs/VANTDOMUS_MANUAL_USO.md` — manual de usuario final.
- `docs/VANTDOMUS_MANUAL_PROYECTO_TECNICO.md` — manual técnico/de proyecto.
- `docs/VANTGUIDE_ARCHITECTURE.md` — decisiones de diseño del motor.
- `docs/DEPLOY_DEMO_RUNBOOK.md` — runbook de deploy.
- `docs/INFORME_AVANCE_FAMILIA_VG.md` — informe de avance.
- `docs/HANDOFF_TO_CLAUDE_CODE.md` — handoff operativo.

## Regla de secretos

**Nunca** imprimir, commitear ni documentar **valores reales** de:
`DATABASE_URL`, `JWT_SECRET`, `VANTDOMUS_MFA_SECRET_KEY`,
`VANTDOMUS_BACKUP_ENCRYPTION_KEY`, API keys, tokens de Render/Vercel/Neon,
OpenAI/Anthropic keys, credenciales SMTP/SendGrid, o cualquier secreto operativo.

- Los secretos finales se generan y cargan **directamente** en Render/Vercel/Neon.
- Nunca pedir que se peguen `DATABASE_URL` u otros secretos por chat.
- Si un secreto aparece en chat/log/doc/commit, se considera **quemado** y debe rotarse.
- En docs se pueden mencionar los **nombres** de las variables, nunca sus valores.

## Regla de cierre de sprint

Todo sprint cierra con:
commit claro · tests relevantes verdes · informe corto · actualización de docs si
corresponde · cápsula de rehidratación en Drive · estado de pendientes · riesgos
abiertos · DoD verificado · next step explícito.

## Regla de comunicación con co-arquitectos

Las decisiones grandes (memoria, lenguaje no clínico, versionado, identidad,
routing de documentos, etc.) pasan por el co-arquitecto externo. No se re-discute
arquitectura aprobada sin un motivo nuevo. Los bloques ejecutorios del
co-arquitecto se siguen al pie, respetando alcance y "NO HACER".

## Regla de no inflar marketing

No prometer lo que no existe. El sitio `apps/marketing/` tiene claims
aspiracionales (PCI, HL7, SLA, etc.) NO respaldados por código: no usarlos como
referencia técnica ni en la demo. No inventar integraciones, IA plena, OCR de
fotos robusto ni claims clínicos.

## Regla de seguridad y datos sensibles

- Lenguaje de `person_support_profile` no clínico (attention_profile, calm_tools,
  memory_support_level), nunca etiquetas patológicas.
- Respetar scoping household/persona y `visible_to_roles` / `consent_scope`.
- La IA propone; el humano confirma. Medication/health requieren confirmación.
- No activar IA plena si `VANTDOMUS_AI_FEATURES_ENABLED=false`.
- La demo no usa datos reales sensibles.

## Regla de backward compatibility

`task_items`, `adherence_plans`, endpoints viejos y el demo seed home NO se
rompen. No borrar legacy sin una migración. `SchoolPlanner` es un adapter de
ingesta académica que produce `unit_functions(category=study)`, no un módulo de
primera clase.

## Regla de deploy

- Backend: Render (apps/api), Python 3.11, `APP_ENV=demo`, AI off.
- Frontend: Vercel (apps/web), `NEXT_PUBLIC_API_BASE` apuntando al backend nuevo.
- DB: Neon controlada por Manuel.
- No usar el deploy Render/Vercel antiguo de Codex ni secretos quemados.
- Seguir `docs/DEPLOY_DEMO_RUNBOOK.md`. Documentar resultado sin secretos.

## Regla de documentación

Cada cambio relevante actualiza el doc correspondiente en `docs/` y, si es corte
importante, la cápsula en Drive. Los manuales (uso y técnico) son documentos
vivos. El próximo asistente empieza por `docs/REHYDRATION_INDEX.md`.
