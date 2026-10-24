# DOMI R75 — Corrección del flujo de acceso familiar
Fecha 2026-10-22. Canon V2.1 Addenda31/32. PR #2 DRAFT.

## Evidencia revisada
R74 CI run 39711815354 SUCCESS. Preview Vercel READY commit 254cfa59d8c5ae636340d64604da644df89aa4d2. El acceso sin credenciales a la página no demuestra backend, sesión o escritura. Sin cambios de producción.

## Hallazgo
Tras POST login exitoso, loginAction intentaba GET /households y, si no había hogares o el backend fallaba, redirigía a /dashboard; esa pantalla antigua ante fallos enviaba nuevamente a /login. Un fallo de lectura de hogares se confundía con problema de autenticación, con posible bucle engañoso. Cuenta autenticada sin hogar no debe ser confundida con falla.

## Cambios
- lib/domiFamilyLanding.mjs (749e247c6157b2272a5ac8fa9dee11575a0e3d8c) clasifica estado home/session/not_assigned/service_unavailable; valida ID.
- app/family-access/page.tsx (bb10e9cd1f058f53238dbe7b16ccfe0d0bb06dc3) muestra mensajes reales y ruta de recuperación sin inventar familias, ni ejecutar writes.
- app/login/actions.ts (84fa5f427dcf3c1886fdad6bc43c5762f61f6e73) dirige ingreso a family-access, sin fallback a dashboard.
- app/inicio/page.tsx (2c4c971ec7c038f6c61afddf437971c33b022fa6) redirige al nuevo resolver.
- apps/web/tests/domi-r75-family-landing.test.mjs (6e58122d9361577f162a0d63787aac249364215b) registra pruebas contractuales; workflow R75 (bbbd4223903195afce46bc6cd0e38a5bfe6f0bf4).
- CI R75 pendiente de comprobación al guardar esta cápsula.

## Scorecard canon anterior→actual Δ
D01 Personal 45→45,0: identidad por integrante aún no E2E.
D02 Familiar 45→45,0: entrada post-login corregida, pero no Family E2E físico.
D03 Desarrollativo 25→25,0: afectividad causal y DSR incompletos.
D04 Federado 45→45,0: proveedores multia­gente no integrados live.
D05 Multisuperficie 45→45,0: TV/auto no certificados.
D06 Organizacional 10→10,0: memoria institucional no ejecutable.
D07 EDIS 10→10,0: bridge no probado.
D08 Legado 10→10,0: consentimiento/custodio runtime no certificado.
D09 Titan 25→25,0: dossier existe; bench no aprobado.
D10 MICR/Science 25→25,0: R3 acotado y claim wall.
GLOBAL=28.5→28.5,0.

## Doce órganos y pruebas
Identity parcial; Constitution/Obligation parcial; Self/Metacognition parcial; Memory parcial; Relational parcial; Affective Runtime causal pendiente; Epistemic/Abstention parcial; Authority/Delegation parcial; Presence/Voice parcial; Recovery/Migration bounded; Multi-Surface bounded; Evidence/Audit parcial.
No se tocaron datos familiares/Neon/Render/producción ni se enviaron mensajes OEM.

## Cápsula y Exact Prompt Restart
R75=FAMILY_LANDING_ROUTING_IMPLEMENTED_CI_PENDING; R74_CI=39711815354_SUCCESS; GLOBAL=28.5; PROD_E2E=NOT_VERIFIED; PR2=DRAFT; NO_NEW_COSTS=TRUE.
EXACT PROMPT RESTART: Retoma DOMI PR2 branch domi-neon-staging-pg-startup-gate-20261010. Verifica CI del commit bbbd4223903195afce46bc6cd0e38a5bfe6f0bf4 y resuelve fallos TypeScript/tests. Probar /family-access en Preview con una sesión válida y un hogar de ensayo autorizado, backend existente, sin datos reales antes de gate seguro; seguir propuesta→confirmación→GET recarga→móvil. No inventar progreso; reportar siempre los diez ejes y los doce órganos según Biblia V2.1 Addenda31/32.