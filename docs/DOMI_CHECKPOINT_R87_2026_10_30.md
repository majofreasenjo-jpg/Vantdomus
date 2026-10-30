# DOMI / VANTDOMUS — CHECKPOINT R87 — 2026-10-30

## Principio rector
Continuidad append-only respecto de Biblia Rectora Canónica V2.1 + Addenda 31-32. DOMI no es solo un planificador. La presente habilitación se limita a una evaluación local sintética; **no** demuestra una familia conectada, identidad artificial íntegra, ni experiencia multidispositivo.

## Línea base verificada
- R86 commit `8078afa543dd589142f2abed8d1b4c149d0144cf`: Security Gate 40988569252 = SUCCESS, 6/6 jobs técnicos aprobados; Vercel Preview READY.
- R86 launcher existía y podía comprobar salud de API/web, pero **una base nueva no disponía de un mecanismo UI para registrar el primer hogar ficticio**.
- R85 lectura posterior a reinicio, aislamiento y compras reales del backend fue certificada únicamente con SQLite desechable y TestClient.

## Cambios de R87
1. `apps/web/lib/domiR87LocalFirstRun.mjs`: gate server-side estricto NODE_ENV=development, APP_ENV=local, sin VERCEL_ENV y URL API fija http://127.0.0.1:8001; alias ficticio a example.invalid.
2. `apps/web/app/local-first-run/actions.ts`: server action registra usuario ficticio por JSON, autentica contra backend loopback, crea hogar ficticio y establece cookies de sesión y CSRF, con retorno a family-access. No cambia rutas de registro de servidores remotos.
3. `apps/web/app/local-first-run/page.tsx`: formulario deliberadamente explícito para alta sintética, noindex y notFound fuera del gate. No datos reales.
4. `tools/windows/Start-DOMI-R86-Local.ps1`: tras health checks redirige a /local-first-run.
5. `apps/web/tests/domi-r87-local-first-run.test.mjs` + workflow CI Security Gate: tests de deny-by-default, alias/contraseña y servidor sin secreto en cliente.

## Limitaciones y pendientes de certificación
- Verificar CI del commit completo y deployment de rama Preview. No presentar la ruta local-first-run como accesible en Vercel; debe dar 404 allí.
- Una cuenta creada antes de un error de bootstrap puede quedar sin hogar; recuperar por login y revisión local, sin borrado automático ni reconstrucción silenciosa.
- Windows físico y recorrido UI autenticado aún NO certificados. API HTTP local, no teléfono, no PostgreSQL staging y no IA externa.
- Se requiere usar SOLO nombres, eventos, compras, recuerdos y recetas inventados.

## Scorecard (puertas auditadas, sin ascensos no justificados)
| Eje | Porcentaje | Delta R87 |
|---|---:|---:|
| D01 DOMI personal | 45% | 0 |
| D02 DOMI familiar | 45% | 0 |
| D03 DOMI desarrollativo | 25% | 0 |
| D04 DOMI federado | 45% | 0 |
| D05 DOMI multidispositivo | 45% | 0 |
| D06 DOMI organizacional | 10% | 0 |
| D07 DOMI–EDIS | 10% | 0 |
| D08 DOMI legado | 10% | 0 |
| D09 Titan/comercial | 25% | 0 |
| D10 MICR/ciencia | 25% | 0 |
| **GLOBAL** | **28,5%** | **0** |

## Próxima obligación verificable
Cerrar Security Gate R87 y ejecutar manualmente R86/R87 en Windows: desde BD nueva, alta ficticia, login, creación de hogar, memoria/agenda/compras y reinicio para readback. Luego demostrar entorno aislado PostgreSQL con RLS, sesión física teléfono/computador y las puertas constitutivas restantes. La disponibilidad real depende de configuración controlada de infraestructura; no intervenir Neon archivado ni Render Billing sin autorización explícita.

## Gobierno
No producción. No outreach. No datos del Owner. No borrado/migración sobre bases existentes. Los 12 órganos de DOMI y los 10 ejes continúan siendo el marco rector.
