# DOMI R77 — Backend HTTP 503 confirmado y vulnerabilidad crítica Next.js
Fecha 2026-10-22 (Chile) · Canon V2.1 + Addenda 31/32 · PR #2 DRAFT

## Evidencia PRIMARIA y bloqueo
1. Vercel Preview READY para SHA 3a1b3b5b4cfa0e3d57188a3a5c730d37792e7a28, URL https://vantdomus-family-pilot-dbwkshxlt-majofreasenjo-jpgs-projects.vercel.app.
2. GET autenticado por bypass de Vercel a /api/domi-family-backend-check: HTTP 200 de la sonda con JSON state=backend_http_error, upstreamHttpStatus=503, authenticatedJourneyVerified=false, databasePersistenceVerified=false. Es **el backend /health** el que devolvió 503; esto NO aclara aún si Render está suspendido, el servicio está iniciando o el origen está mal configurado.
3. R76 Security Gate #39852134639 = FAILURE. Cinco jobs PASS: mobile, backend, postgres-rls-pilot, postgres-r64-readable-pilot, postgres-real-auth-candidate. Job web FAIL por gate obligatorio `npm audit --omit=dev --audit-level=high`: Next.js 16.0.0–16.4.0, critical, advisories GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r, GHSA-673q-mjm6-r5xr; informe CI dice actualización a Next.js 16.4.2. NO saltarse el gate. No asumir impacto explotado, hacer revisión de compatibilidad antes de actualización.
4. /login HTML HTTP 200 demuestra interfaz disponible; no demuestra autenticación ni persistencia.
5. Render service listing no se pudo ejecutar: conector exige confirmación explícita del workspaceId. Solo hay metadatos de workspace 'My Workspace' de una lectura anterior, pero no se debe seleccionarlo por cuenta propia. NO hubo activación, cambios, secretos expuestos ni facturación nueva.

## HCO bloqueante de DOMI Family
La operación que exige el Owner es browser real → login autorizado → API backend operativo → hogar de ensayo en base persistente → propuestas/confirmación → recarga → celular. Hoy falla ANTES de login en la verificación de reachability backend (/health 503). Es el primer límite efectivo; la siguiente acción no es escribir otro test sino identificar y remediar disponibilidad del servicio, previa selección del workspace Render por el usuario, si corresponde.

## Ruta de remediación sin sacrificar seguridad
A. Confirmar qué workspace Render es el apropiado antes de listar servicios y logs. Inspeccionar su estado, URL, últimos deploys, si está suspendido y si reactivar incurrirá en costo. No hacer cambios sin autorización de gasto.
B. Probar salud con prueba GET mínima tras recuperación; después prueba autenticada con cuenta ficticia autorizada sin tocar hogares reales ni Neon productivo.
C. Separadamente actualizar Next.js a versión parcheada >=16.4.2 con modificación controlada de package.json y package-lock.json, npm ci/audit/typecheck/build y regresiones; no usar --force sin revisar compatibilidad y no relajar gate de audit. Asegurar no mezclarse con producción.
D. Solo con PASS y confirmación Owner de servicio y gastos ejecutar E2E real PC→móvil y certificar D02 integración; no actualizar porcentajes antes de evidencias.

## DIEZ EJES CANÓNICOS, anterior→actual (variación pp), fuente y siguiente
D01 Personal 45→45 (0): R67 linaje sintético; falta identidad individual DB auténtica.
D02 Family 45→45 (0): HTTP R72 local PASS, backend Preview /health=503; sin E2E real.
D03 Desarrollativo 25→25 (0): DSR afectividad causal no integrada.
D04 Federado 45→45 (0): fabric pruebas sintéticas; sin providers+agentes live autorizados.
D05 Multisuperficie 45→45 (0): PC/Android bounded; TV/auto y continuidad E2E falta.
D06 Organizacional 10→10 (0): memoria institucional diseño; faltan precedentes auditables multi-tenant.
D07 DOMI–EDIS 10→10 (0): bridge rector; implementación receptor-native pendiente.
D08 Legado 10→10 (0): consentimiento/custodia no probados en runtime.
D09 Titan 25→25 (0): oferta comercial interna; benchmark/pack legal pendiente.
D10 MICR / Ciencia 25→25 (0): R3 acotado, R4 cero resultado científico; sin conciencia demostrada.
GLOBAL 28,5→28,5 (Δ0) índice acreditado C/I/T/E/A, no tiempo restante ni producto vendido. La falla de CI no invalida automáticamente puertas previamente certificadas pero impide elevar E/A o declarar release.

## Doce órganos y controles
Identidad parcial; Constitución/Obligaciones parcial; Self/Metacognición parcial; Memoria parcial; Relación parcial; Afectividad funcional causal pendiente; Epistémica/Abstención parcial; Autoridad/Delegación parcial; Presencia/Voz parcial; Recuperación/Migración bounded; Adaptadores multisuperficie bounded; Evidencia/Auditoría parcial.
No se ha modificado Neon, producción ni servicios Render. No se han hecho afirmaciones de conciencia, sentimientos subjetivos ni superioridad comercial.

## Cápsula R77
CANON=V2.1_ADD31_ADD32
R77_BACKEND_HEALTH=UPSTREAM_HTTP_503
R76_GATE=FAIL_WEB_NPM_AUDIT_CRITICAL_NEXTJS
PATCH_REQUIRED=NEXTJS_16_4_2_OR_LATER_VALIDATED
RENDER_WORKSPACE=AWAITING_EXPLICIT_OWNER_SELECTION
FAMILY_BROWSER_E2E=NOT_VERIFIED
GLOBAL_CANON=28.5%
PR2=DRAFT
OUTREACH=NONE
PRODUCTION_WRITE=NONE
COST_AUTHORIZED=NO

## Exact Prompt Restart
Retoma DOMI R77, PR #2 branch domi-neon-staging-pg-startup-gate-20261010. Verifica backend /health status en Vercel Preview R76: 503. Security Gate #39852134639 falló npm audit por vulnerabilidad crítica Next 16.0.0–16.4.0, solución propuesta 16.4.2; no omitir audit. Para poder inspeccionar Render, el conector exige confirmación explícita del workspace por el Owner; no seleccionar automáticamente. Después de elegir, listar servicios, observar estado/logs/coste y proponer reactivación SOLO tras autorización. En paralelo reparar dependencia y lockfile con auditoría y pruebas. Probar login→API→DB→confirmar→recarga→móvil con datos sintéticos, no real si inseguro. En cada avance reportar diez ejes con puntuación exacta y 12 órganos. Ningún porcentaje aumenta por documentación ni por diagnosticar 503.
