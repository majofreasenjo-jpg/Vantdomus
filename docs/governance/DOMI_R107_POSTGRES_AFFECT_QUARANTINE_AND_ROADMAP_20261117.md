# DOMI R107 — Auditoría de RLS PostgreSQL y cuarentena de consentimiento afectivo
Corte: 2026-11-17. Rama aislada `domi-r97-memory-safety-isolated-20261116`.
Estado: **CI DISPOSABLE POSTGRES SUCCESS / PROD AND NEON MIGRATION NO_GO**.
Fuentes rectoras: MICR-02A, MICR-02M, MICR↔DOMI Bridge Charter, DOMI R100–R106, R31/R33/R63 RLS y Biblia DOMI V2.1.
Operaciones: ni PostgreSQL remoto ni Neon, sin desplegar, sin IA externa, sin datos reales ni gastos.

## Hallazgos determinantes
1. El contrato Postgres de preproducción conserva exactamente 57 tablas en `public` y su `pg_staging_gate.check_postgres_staging_readiness` exige `EXPECTED_DOMI_TABLES=57`, RLS+FORCE RLS y al menos una política por tabla. La `sqlite_migrations/288_domi_affective_memory_links.sql` es una migración **SQLite**: crearla como tabla de producción PostgreSQL produciría 58 tablas y requeriría una nueva política, inventario, roles, pruebas de acceso, reversión y cambio auditado de gate. Nunca subir el contador a 58 a ciegas.
2. La arquitectura signed RLS existente usa JWT+JTI verificado, sesión enlazada a transacción, HMAC y `domi_r31.subject_id()`; `domi_app_runtime` es NOLOGIN NOINHERIT, sin privilegios de dueño ni BYPASSRLS. La pertenencia a casa no acredita consentimiento afectivo (hallazgo histórico R63).
3. R106 `/assistant/affect-lab` queda restringida a `APP_ENV in test/local/dev/development`, flag opt-in y **conexión SQLite real**; la ruta deniega conexiones PG incluso cuando la configuración parece local y favorable. No se incorporaron endpoints a family-live ni producción.
4. R107 instala la definición 288 solamente en una transacción de PostgreSQL 16 **desechable**, añade RLS+FORCE RLS y política `USING(false) WITH CHECK(false)`, verifica que `domi_app_runtime` no tiene SELECT/INSERT/UPDATE/DELETE ni por grant ni por RLS, mide la tabla 58 y comprueba rechazo de startup bajo rol restringido. Hace ROLLBACK y exige retorno a 57, sin tabla 288 residual.
5. **No** se ha diseñado autorización SQL escribible para `ratified_by_user_id`: una API HTTP autenticada no constituye garantía frente a un rol SQL capaz de fabricar consentimientos. La concesión futura exige comprobante/función de escritura restringida, prueba de antirrepetición, transacciones concurrentes y bloqueo de alteración de sujeto, consent scope, valence y revocation. Por defecto todo cerrado.
6. No se ha demostrado equivalencia PostgreSQL–SQLite de la API afectiva en sesiones verdaderas, ni cobertura de Neon: los tests de PostgreSQL cubren denegación (no acceso autorizado), no capacidad productiva.

## Evidencia CI y corrección
- Primera corrida [44108567293](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/44108567293) tuvo 1 fallo de test y 3 PASS: el test consultaba arranque como PG superuser y, correctamente, la validación se detenía antes del recuento por rol peligroso. Corrección: probar el catálogo bajo rol `domi_app_runtime`, sin tratar una protección más temprana como defecto.
- [44108896557](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/44108896557) SUCCESS: PG 4 PASS; SQLite HTTP/regresión 20 PASS.
- [44109084937](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/44109084937) SUCCESS (commit `981504b47e7fb31b11c9d5db4d286566353d6552`): **PostgreSQL 4 PASS + SQLite 21 PASS**, sin DB remota.
- [44109084857](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/44109084857) SUCCESS: **HTTP R106 regresión 51 PASS** (incluye prueba explícita de que no-SQLite se bloquea antes de consultar).
- Warnings de dependencias/deprecaciones persisten; no ocultarlos y auditar por separado.

## Cuatro frentes integrados
A. Documento/procedencia: se revisaron los esquemas PostgreSQL originales, R31/R33/R63, R105/106 y su contrato de seguridad. No asumir que el manuscrito MICR define autorización SQL ejecutable.
B. Álgebra/implementación: prueba de invariantes de permisos RLS, rol cerrado y recuento esperado; 58 != 57 implica rechazo.
C. Causal/ensayos: prueba de falsificador de SQL indebido (cuatro verbos) y reversión sin residuo; no se probó efecto de afecto en proveedor.
D. Identidad/relación: no autorización semántica por membresía, R106 lab limitada SQLite, lectura privada con consentimiento distinto de confirmación factual; sin canales de TV compartida.

## Roadmap de gates
| Gate | Estado R107 | Obligación |
| --- | --- | --- |
| G0 fuentes MICR | PARTIAL | cerrar inventario y trazas donantes |
| G1 núcleo MICR_AFFECTIVE_SELF original | PARTIAL | localizar código original fuente y contrato |
| G2 receptor laboratorio | PASS_NARROW | SQLite R105/R106; adaptador chat NO integrado |
| G3 causalidad afectiva | PASS_SYNTHETIC_ONLY | control de LLM con/sin señales, mismos inputs |
| G4 memoria longitudinal | PASS_SQLITE_REOPEN_ONLY | dos dispositivos con sesión auténtica |
| G5 seguridad | PG_DENIAL_PASS, PROD_NO_GO | migración RLS 58 y autoridad SQL de consentimiento |
| G6 owner/operación | OPEN / NO_GO | QA y aprobación antes de merge/deploy |

## Próximo bloqueo específico R108
Primero resolver la **autoridad de consentimiento en SQL** (sin permisos directos concedidos al runtime) mediante contrato y falsificadores en entorno desechable, y sólo después plantear schema candidate PostgreSQL de 58 tablas. En paralelo puede prepararse un adaptador **sin escrituras y apagado** desde readback de memoria a una política de respuesta propia del gateway, sin pasar datos afectivos privados en bruto a Anthropic. No activar proveedores reales sin clave vigente, límite de costos, consentimiento y pruebas.

## 10 ejes canónicos (porcentajes históricos sin recálculo)
| Eje | Histórico | R107 |
| --- | ---: | --- |
| D01 Personal | 45% | seguridad de identidad en LAB |
| D02 Familiar | 45% | sin cambio productivo |
| D03 Desarrollo/afectividad | 25% | cuarentena PG verificada |
| D04 Federación | 45% | sin cambio |
| D05 Multisuperficie | 45% | falta prueba física |
| D06 Organización | 10% | sin cambio |
| D07 DOMI-EDIS | 10% | sin cambio |
| D08 Legado | 10% | sin cambio |
| D09 Comercial | 25% | sin cambio |
| D10 MICR | 25% | transferencia investigativa sin claim conciencia |
| **Global histórico** | **28,5%** | **no reestimado** |

## Restart
Retoma DOMI R107 rama `domi-r97-memory-safety-isolated-20261116`, expediente `DOMI_R107_POSTGRES_AFFECT_QUARANTINE_AND_ROADMAP_20261117.md`. Nuevo test `tests/security/test_domi_r107_pg_affect_quarantine.py` sobre PG16 desechable: 4 PASS; SQL denegado SELECT/INSERT/UPDATE/DELETE, 58 tablas rechazadas y rollback a 57. CI `44109084937` PG4+SQLite21 SUCCESS; CI `44109084857` R106 HTTP 51 PASS; rama aislada, ninguna migración remota ni deploy. R106 afect lab bloqueada contra PG en `assistant_affect_lab.py`. Primer bloqueo R108: impedir fabricación de consentimiento a nivel SQL antes de cualquier migración PG de 58 tablas; paralelamente adaptar lectura afectiva a chat apagado con pruebas de no filtración y ablación, pero no llamar Anthropic. No rehacer MICR DFLD, R104, R105. Informar 10 ejes, gates, riesgos, commits; no incrementar 28,5% sin base recalculada.
