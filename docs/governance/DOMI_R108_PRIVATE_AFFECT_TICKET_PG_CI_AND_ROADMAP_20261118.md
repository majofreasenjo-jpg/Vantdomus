# DOMI R108 — Comprobante afectivo privado de un solo uso en PostgreSQL
**Corte:** 2026-11-18. **Rama:** `domi-r97-memory-safety-isolated-20261116`.
**Estado:** DISPOSABLE_PG_11_PASS / ISSUER_NOT_BUILT / NO_DEPLOY / NO_NEON_WRITES / NO_ANTHROPIC_CALLS.
**Regla rectora:** MICR-02A+02M y Bridge Charter, R100–R107, cuatro frentes convergentes, sin reciclar resultados históricos ni afirmar afectividad fenomenológica.

## Resultado ejecutado
- [GitHub Actions R108 final, run 44232680083](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/44232680083): job `postgres-affect-tickets-disposable` **SUCCESS**, **11 passed, 0 failed**; PostgreSQL 16 descartable, sin Neon ni credenciales reales.
- `apps/api/postgres_staging_migrations/security/306_domi_r108_private_affect_ticket_candidate.sql`: candidato **no desplegable**, instala `domi_affect.approved_tickets` y `domi_affect.memory_links` en esquema PRIVADO, FORCE RLS y sin grants SELECT/INSERT/UPDATE/DELETE al rol `domi_app_runtime`.
- Las **57 tablas públicas** de R31/R33 se conservan sin alterar `pg_staging_gate.EXPECTED_DOMI_TABLES=57`.
- Se permite EXCLUSIVAMENTE llamar a la función `domi_affect.redeem_ticket(uuid)`: exige sujeto firmado validado con `domi_r31.subject_id()`, ticket emitido previamente por autoridad independiente, titularidad de memoria privada, casa/persona congruentes, confirmación previa, no borrado/expiración, hash SHA-256 de contenido exacto, versión original, consentimiento de lectura sólo propio, no revocación y uso único con `FOR UPDATE`.
- El código NO contiene una vía para crear `approved_tickets` mediante `domi_app_runtime`. Las pruebas insertan vales **sólo con superusuario del contenedor descartable**, como falsificador técnico de canje, no como consentimiento humano.
- `tests/security/test_domi_r108_private_affect_tickets_pg.py`: 11 casos, incluyendo SELECT/INSERT/UPDATE/DELETE directos prohibidos en las dos tablas, canje válido una vez, actor distinto, vínculo con memoria equivocada, expiración, revocación, ausencia de identidad, contenido modificado sin timestamp, JTI incorrecto y dos conexiones concurrentes.

## Bitácora de correcciones sin ocultar fracasos
- Primera corrida `44232139073`: ERROR, ausencia de USAGE en el esquema de funciones de identidad y fixture vencido inválido por CHECK temporal.
- Siguiente corrida `44232335033`: 9 PASS.
- Corrida adversarial `44232497733`: 10 PASS y 1 FAIL; contaminó el fixture de concurrencia un test previo que cambiaba el contenido.
- Corrección en `e0257c2005d891b219a4b8d41595381d4dad1c72`: restauración del contenido sintético en finally. Resultado terminal `44232680083`: **11 PASS**, concurrency single-use comprobada. No se suprimieron negativos.

## Cuatro frentes unidos
1. **Documental:** contrato de identidad MICR ≠ apariencia; afectividad funcional ≠ sentimientos; `authorized != accessible != confirmed`; R63 detectó el error de confundir membresía con autorización de escritura.
2. **Álgebra/implementación:** sujeto firmado por transacción, ticket ligado a hash de fuente, FORCE RLS, privilegios mínimos, bloqueo de SQL directo, unicidad de recibos y serialización FOR UPDATE.
3. **Causal/adversarial:** tests A/B de validez temporal, cuenta/casa, JTI, source-content y carreras; un solo ganador bajo competencia, controles negativos conservados.
4. **Relacional/seguridad:** la identidad de quien reclama se obtiene del validador firmado, no de campos del cliente; no hay rutas a TV compartida, no permite cambiar privilegios de familia ni crear afectos de otros integrantes.

## Dictamen de seguridad (alcance)
**No** está completo el flujo de consentimiento humano. La creación de un ticket requiere una AUTORIDAD EMISORA independiente, atada a consentimiento explícito validado y a sesión, con auditoría, caducidad, antifalsificación y revocación. En R108 el actor privilegiado de laboratorio crea tickets de prueba artificialmente; esto **no** prueba su origen legítimo, ni autoriza emisión desde un endpoint público.
**No** existe función de lectura de links privados lista para chat y con revalidación posterior de revocación, corrección o pérdida de consentimiento. No permitir consulta a Anthropic ni promoción de memorias a autobiografía por este hito.
No desplegar `306` ni activar R106 HTTP fuera del laboratorio. No cambiar contadores de tablas ni roles en Neon; CI PostgreSQL desechable no certifica Neon real.

## Gates
| Gate | Estado R108 | Primer bloqueo |
| --- | --- | --- |
| G0 inventario MICR | PARTIAL | búsqueda original `MICR_AFFECTIVE_SELF` no concluida |
| G1 donante técnico | PARTIAL | source completo afectivo/multicapa sin verificar |
| G2 receptor | PASS contrato LAB, NO_CHAT | usar memoria autorizada y read-only sin contenido crudo |
| G3 causalidad | PASS sintético limitado | proveedor conversacional contrafactual pendiente |
| G4 longitudinalidad | PASS SQLite reapertura, NO dispositivo físico | revalidación post cambio/revocación en PG |
| G5 PG/privacidad | 11 PASS en prueba de canje sintético | emisor autorizado, auditoría y lectura privada de enlaces |
| G6 piloto/producción | NO_GO | aprobación y QA real pendientes |

## Roadmap canónico (sin inflación)
| Eje | % histórico | Estado |
| --- | ---: | --- |
| D01 personal | 45 | continuidad de identidad parcialmente probada, falta piloto real |
| D02 familiar | 45 | sin despliegue nuevo |
| D03 memoria/emoción/desarrollo | 25 | R108 verificación de permisos, no experiencia subjetiva |
| D04 federado | 45 | pendiente evaluación de modelos multiples |
| D05 multisuperficie | 45 | pendiente prueba PC/teléfono/TV |
| D06 organizacional | 10 | sin cambios |
| D07 DOMI–EDIS | 10 | sin cambios |
| D08 legado | 10 | sin cambios |
| D09 comercial | 25 | sin cambios |
| D10 MICR/ciencia | 25 | donantes parciales, sin afirmación de conciencia |
| **Global histórico** | **28,5** | no recalculado |

## Siguiente R109, una sola obligación bloqueante
Diseñar **autoridad emisora de tickets sin exposición del rol privilegiado** y revalidación READ-ONLY de enlaces antes de cualquier inferencia. Exigir prueba adversarial de revocación, edición de recuerdo, 2 hogares/usuarios, repetición, concurrencia y separación real de identidad del emisor y del consumidor. Después diseñar adaptación privada a gateway con efecto ablation-on/off, sin enviar valence cruda o texto sensible a LLM externo. Mantener Anthropic apagado y selección de voz por persona separada de identidad central.

## Exact prompt restart
Retoma DOMI R108 en `domi-r97-memory-safety-isolated-20261116`, expediente `docs/governance/DOMI_R108_PRIVATE_AFFECT_TICKET_PG_CI_AND_ROADMAP_20261118.md`. Fuente: candidato privado `306_domi_r108_private_affect_ticket_candidate.sql`, CI PG16 descartable `44232680083`: 11 PASS, zero fail. No emisor humano existe, no lectura integrada al chat, no Neon ni deploy; no repetir R104–R108. Próximo R109 resolver autoridad emisora de consentimiento en PG sin otorgar INSERT a runtime, y revalidación de enlaces tras cambios de memoria, con cuatro frentes y falsificadores. Reportar 10 ejes y gates, mantener línea base 28,5% histórica. No consumir Anthropic ni activar producción sin OWNER.
