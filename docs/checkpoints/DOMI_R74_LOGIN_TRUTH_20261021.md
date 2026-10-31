# DOMI R74 — Diagnóstico honesto del acceso familiar
Fecha 2026-10-21. PR #2 DRAFT, Canon V2.1 + Addenda 31/32.

## Hechos verificables
- Último Security Gate de R73 commit dbfcfcc1fb294b8a30e6cd4759cdd7d903979ca6: run 39690518775 SUCCESS.
- Vercel Preview READY sobre PR #2, pero no hay prueba autenticada contra backend familiar de producción ni readback persistente en PC y teléfono. Ausencia de error agrupado no implica servidor vivo.
- apps/web/app/login/actions.ts capturaba cualquier excepción del backend como contraseña inválida, salvo MFA 428. Fallos de red, 502/503, timeout o backend suspendido se presentaban engañosamente como error humano.
- apps/web/app/inicio/page.tsx y loginAction tienen fallback a /dashboard si no logran recuperar hogares; esto sigue como deuda de diagnóstico UX, no se cambió en R74.
- La ruta de prueba /api/domi-owner-live-precheck está aislada a la rama domi-owner-live-precheck y es una prueba sintética de proveedor lingüístico, NO login ni orquestación familiar.

## Corrección R74
- apps/web/lib/domiLoginFailure.mjs commit 4e5c476f34a10ab958c08bcdd2f7c317d1164388: clasifica MFA, rate limit, credenciales rechazadas e indisponibilidad/red con mensajes sanitizados sin exponer upstream.
- apps/web/app/login/actions.ts commit 6ccdb85f517dfda5503879f35edc463557e60264: usa clasificación honesta en ingreso, no atribuye fallos de API al usuario.
- apps/web/tests/domi-r74-login-truth.test.mjs commit e0e95bf97e7b6d144816569c5e8fc4b3590e2dfa: casos negativos explícitos.
- Security Gate incorpora paso R74 commit 99e098da57b98d30619a22a0ed7fc5c24417f018. CI R74 NO VERIFICADO al corte.
- No se ejecutó login real, ni se enviaron credenciales, ni se inició nueva infraestructura facturable.

## Estado canónico obligatorio
D01 Personal 45→45 (0): linaje por integrante E2E pendiente.
D02 Family 45→45 (0): contrato R72 PASS, clasificación de errores R74 pendiente CI; login real y persistencia web sin certificar.
D03 Desarrollo 25→25 (0): runtime afectividad funcional causal/relacional sin certificar.
D04 Federación 45→45 (0): multinivel/multiproveedor live pendiente.
D05 Multisuperficie 45→45 (0): TV/auto reales pendientes.
D06 Empresa 10→10 (0): memoria institucional aún diseño.
D07 EDIS 10→10 (0): bridge no probado.
D08 Legado 10→10 (0): consentimiento/ejecución sin probar.
D09 Titan 25→25 (0): oferta lista revisión, bench/demos pendientes.
D10 MICR/Science 25→25 (0): resultados R3 limitados, conciencia no demostrada.
GLOBAL 28,5→28,5; delta 0. Ninguna puerta E/A del Addendum 32 certificada.

## Doce órganos, controles
Identity parcial; Constitution/Obligation parcial; Self/Metacognition parcial; Memory parcial; Relational parcial; Affective causal pendiente; Epistemic/Abstention parcial; Authority/Delegation parcial; Presence/Voice parcial; Recovery/Migration limitado; MultiSurface limitado; Evidence/Audit parcial.
Seguridad: no memoria como autoridad, no PII real en Preview, no contaminación empresa/hogar, sin nuevos claims conciencia, sin producción/gastos/Neon/Render.

## Cápsula rehidratación
R74_STATUS=LOGIN_OUTAGE_TRUTH_IMPLEMENTED_CI_PENDING
R73_GATE=39690518775_SUCCESS
REAL_FAMILY_E2E=NOT_CERTIFIED
CANON=V2.1_ADD31_ADD32
GLOBAL=28.5%
PR_2=DRAFT
PRODUCTION_CHANGED=NO

## Exact Prompt Restart
Retomar DOMI R74 PR #2 branch domi-neon-staging-pg-startup-gate-20261010. Verificar CI HEAD posterior al 99e098da57b98d30619a22a0ed7fc5c24417f018, corregir fallos de tests/build. Inspeccionar primera frontera real de acceso sin secretos; si backend suspendido/costoso, no reactivarlo sin permiso. Resolver login y fallback /dashboard engañoso, priorizar E2E Family desde navegador a API DB y segundo dispositivo cuando entorno autorizado exista. No inflar scorecard: diez ejes 45/45/25/45/45/10/10/10/25/25 y GLOBAL 28,5 hasta certificación de puerta adicional; preservar 12 órganos y Titan/EDIS/MICR paralelo.
