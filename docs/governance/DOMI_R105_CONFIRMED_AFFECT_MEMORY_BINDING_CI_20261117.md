# DOMI R105 — Vínculo gobernado de memoria confirmada y afectividad funcional
Corte: 2026-11-17. Rama aislada: `domi-r97-memory-safety-isolated-20261116`.
Alcance: SQLite de prueba, memoria personal explícitamente confirmada, consentimiento separado para uso afectivo, lectura segura en desktop/mobile, ablación. **SIN chat, sin proveedor, sin datos reales, sin deploy, sin consumo.**

## Trabajo material R105
- `apps/api/sqlite_migrations/288_domi_affective_memory_links.sql` crea registro separado por persona/hogar con consent ratification, snapshot de `memory_items.updated_at`, valence/activation/relevance y revocación. Sin backfill ni promoción silenciosa.
- `apps/api/app/db.py` incorpora la migración 288 al manifiesto explícito. Hallazgo del primer CI: la migración existía pero no estaba registrada, lo que produjo 9 fallos. Corregido, no ocultado.
- `apps/api/app/assistant/affective_runtime.py` admite `user_confirmed` como entrada funcional y NO autobiográfica. Importados e inferidos sin ratificar continúan bloqueados.
- `apps/api/app/assistant/affective_memory_bridge.py`: el requester se deriva de `persons` + `household_memberships` en DB por usuario/hogar y una única vinculación. Ratificación sólo de memoria privada `family` verificada por humano y con `inference_status='confirmed'`, sensibilidad normal/baja. Se bloquea rol sin vínculo, sujeto ajeno y otro hogar. UI TV/OTHER sin readback. Módulo no tiene ruta de servicio ni chat y no realiza llamada remota.
- Lectura posterior vuelve a comprobar que la fuente no se eliminó, expiró, corrigió, reclasificó, desconfirmó ni perdió procedencia; el snapshot `updated_at` debe coincidir exactamente. El output no copia texto privado.
- `tests/test_domi_r105_affective_memory_bridge.py`: pruebas reales con DB SQLite desechable, registro de usuarios y miembros, 2 personas, 2 superficies, persistencia tras nueva conexión, revocación, corrección, borrado, no-consent, pending e invalidación por expiración.
- No hay autoescritura de estado emocional ni sentimiento subjetivo demostrado.

## Evidencia CI
- Primera corrida R105: [44012642105](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/44012642105) = FAILURE real, 9 fallos, 44 pass; causa raíz: falta inclusión en manifiesto de migraciones. Corregida en commit `37cf930cc101415d9b6f8425e260f08aea0ee3ab`.
- Corrida de cierre: [44012795788](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/44012795788) = SUCCESS, 53 PASS, 6 warnings; incluye R105 + R104 + privacidad M1. Externas deshabilitadas, Anthropic sin key.
- CI no prueba cliente real/HTTP R105, guardado automático, sincronización entre dispositivos físicos, producción, causalidad afectiva de un LLM ni conciencia.

## Matriz MICR → DOMI y cuatro frentes
1. Documental: MICR-02M exige autorizado ≠ vigente ≠ confiable ≠ identidad; MICR-02A exige ratificación antes de MP_A, 02A emociones funcionales. DFLD5.4 se mantiene como donante histórico, sin repetir pruebas.
2. Implementación: ratificación separada, origen confirmado, restricciones por sujeto y casa; no adjuntar componente a `/assistant/chat` sin nuevas pruebas de consentimiento/custodia de migraciones y reglas de uso.
3. Causal: efectividad sintética bajo ablation y readback persistente; negativo NULL_EFFECT en ausencia de vínculo y tras revocación; no apropiación autobiográfica.
4. Privacidad: dos personas, rol owner no pasa identidad personal, TV/OTHER bloqueado, borrado/corrección/expiración sin leakage. Pendiente demostrar políticas DB Postgres/neon y sesión HTTP autenticada.

## Roadmap gates (sin adelantar autorizaciones)
G0 inventario documental: PARTIAL.
G1 donante original `MICR_AFFECTIVE_SELF`: PARTIAL, no localizado integralmente.
G2 receptor experimental: PASS en lectura aislada SQLite, NO_CHAT.
G3 causalidad: PASS en controles sintéticos limitados, NO_LLM_CAUSAL_PROOF.
G4 memoria longitudinal: PASS en reabrir conexión SQLite con ratificación, NO_CROSS_DEVICE_CERT.
G5 seguridad: PASS en escenarios testados; HTTP endpoints y Postgres NO_CERTIFIED.
G6 usuario piloto y release: OPEN / NO_GO.

## Prioridad siguiente única (R106)
Diseñar y probar endpoints autenticados, de consentimiento claro y revocación de vínculo afectivo, con autorizaciones de hogar/usuario, privacidad y CSRF según mecanismos existentes. No liberar endpoints reales antes de auditoría de datos, migración Postgres ni aceptación OWNER. Reusar las rutas de memoria y contratos de propuesta, no copiar MICR completo. Mantener flags Anthropic OFF y consentimiento/techo de gastos pendiente. Investigacion de experiencia subjetiva MICR = UNKNOWN.

## Roadmap canónico diez ejes, porcentajes históricos no reestimados
| Eje | Histórico | Variación acreditable R105 |
| --- | ---: | --- |
| D01 Identidad personal | 45% | lectura ratificada por sujeto (narrow test) |
| D02 Familiar | 45% | sin modificación productiva |
| D03 Desarrollo y afectividad | 25% | R105 puente aislado PASS |
| D04 Federado | 45% | sin modificación |
| D05 Multisuperficie | 45% | móvil/desktop en contrato, sin prueba física |
| D06 Organizacional | 10% | sin modificación |
| D07 DOMI–EDIS | 10% | sin modificación |
| D08 Legado | 10% | sin modificación |
| D09 Comercial | 25% | sin modificación |
| D10 MICR científico | 25% | transferencia de arquitectura, no evidencia científica |
| **GLOBAL HISTÓRICO** | **28,5%** | no recalculado |

## Exact Prompt Restart
Retoma DOMI R105, rama `domi-r97-memory-safety-isolated-20261116`. R105 CI 44012795788 = 53 PASS, frente a primer fallo 44012642105 (migración 288 omitida, corregida en db.py). `affective_memory_bridge.py` ratifica vínculos explícitos para memoria privada confirmada y revoca/invalidada con fuente; R104 affective_runtime user_confirmed y tests; NO conectado a /assistant/chat, NO Anthropic llamadas. Próximo R106 endpoints autenticados consentimiento+revocación y auditoría de despliegue multi-DB, sin desbloquear producción. R103 voz Anthropic PASS; conservar mínimo conversación, imagen femenina original aún en búsqueda. Informar 10 ejes y gates, sin inflar 28,5%.
