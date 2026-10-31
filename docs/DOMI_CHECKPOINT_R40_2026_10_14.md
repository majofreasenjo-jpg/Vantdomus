# DOMI R40 — Interfaz privada de Owner Beta, segura por defecto · 2026-10-14

## Evidencia de entrada
- GitHub Security Gate #230, run 38584168521. Jobs backend/web/mobile y PostgreSQL SUCCESS; PostgreSQL 62/62 autenticación y 33/33 RLS+HTTP; auditoría web 0 vulnerabilidades. El staging-smoke fue omitido. Sin certificación de Neon real.
- PR #2 continúa DRAFT. Neon main y validación sin migraciones aplicadas, último estado conocido 0/57 RLS. Railway sin desplegar.

## Cambios R40 efectivos
- Commit 27226802eeae541b74e083ba67dc97dc41d8751b: endpoint autenticado GET /owner-beta/memory/persons devuelve solo perfiles propios validados con RLS, 2 tests adversariales nuevos; total tests RLS+HTTP 35 definidos. La librería web usa apiFetch -> proxy autenticado same-origin con token HttpOnly + CSRF.
- Commit 20252881e06daddf2546e5b2c4109487bde318fd: nueva ruta /owner-private separada totalmente del Preview /owner-beta, que sigue siendo sintético; UI de memoria, conversaciones, consentimiento explícito por mensaje y recuperaciones desde servidor. No localStorage/sessionStorage, no lectura de token JS, no persistencia local de chat. Página requiere preview branch exacto, DOMI_OWNER_PRIVATE_UI_ENABLED=1 y cookie de sesión.
- Commit c7784cd8f4017c8f014331a0541011f9515e72e2: nuevo test de gate de UI ejecutado en postbuild.
- No habilita producción, no modifica Neon, no despliega Railway.
- NUEVO CI R40 NO OBSERVADO NI CERTIFICADO. Exigir backend/web/mobile PASS, 62/62 auth y 35/35 RLS+HTTP. La nueva prueba postbuild también debe aprobar.

## Bloqueos de Owner Beta real
- Conectar y certificar auth sobre Neon aislado bajo rol mínimo, 57/57 FORCE RLS y políticas específicas de todas las familias antes de admitir datos personales. Migraciones no aplicadas.
- Verificar desde la UI cookies reales, CSRF, backend accesible, refresh y logout, consentimiento, revocaciones, MFA, restauración segura, y sesiones interdispositivo.
- La ruta conversacional externa requiere autorización informada real y gating de costes; pruebas R39 mockeaban OpenAIProvider, por tanto NO demuestra conversación modelo real.
- La ruta /owner-private es código de interfaz y no una URL desplegada ni disponible todavía para uso personal.

## Cápsula de rehidratación
DOMI_R40_OWNER_PRIVATE_UI_CANDIDATE_20261014 | CI #230 PASS 62 auth+33 RLS | nuevo endpoint perfiles propios, 35 tests definidos + UI privada separada y gate postbuild, CI nuevo PENDIENTE | Neon RLS 0/57 real última observación | Railway sin deploy | Owner Beta NO DISPONIBLE para uso real.

## Exact Prompt Restart
Retoma VANTDOMUS/DOMI desde DOMI_R40_OWNER_PRIVATE_UI_CANDIDATE_20261014, GitHub majofreasenjo-jpg/Vantdomus PR #2 rama domi-neon-staging-pg-startup-gate-20261010. Comprueba el Security Gate más reciente tras c7784cd8f4017c8f014331a0541011f9515e72e2: backend/web/mobile y postbuild UI PASS, autenticación PG 62/62 y RLS+HTTP 35/35 PASS, web auditoría 0. Corrige cualquier fallo sin deshabilitar pruebas ni eliminar seguridad. Después preparar migración RLS completa y reversible, exclusiva Neon validación y bajo change gate, con pruebas HTTP, cookies/CSRF y continuidad computador-teléfono. No modificar Neon main, no fusionar PR ni desplegar Railway/costos sin autorización explícita. Cada avance: bitácora append-only, Cápsula de Rehidratación y Exact Prompt Restart.
