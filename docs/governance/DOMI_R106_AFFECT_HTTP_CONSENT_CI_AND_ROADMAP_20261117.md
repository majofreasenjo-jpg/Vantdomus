# DOMI R106 — API de laboratorio para consentimiento afectivo autenticado
Corte: 2026-11-17. Rama aislada: `domi-r97-memory-safety-isolated-20261116`.
Estado: HTTP_LAB_OFFLINE_CI_PASS, NO_CHAT, NO_LIVE_API, NO_PROD, NO_OUTREACH, NO_EXTERNAL_SPEND.
Fuentes: MICR-02A, MICR-02M, MICR↔DOMI Bridge Charter, DOMI R100–R105, Biblia DOMI V2.1.

## Evidencia real, no propuesta
- `apps/api/app/assistant/affective_memory_bridge.py`: fuente de memoria privada confirmable sólo por sujeto adulto autenticado; `confirm_personal_memory_source` exige declaración expresa y rechaza inferencias pendientes; `list_personal_affective_links` revela sólo el propio ledger de autorización, sin el texto del recuerdo. Los métodos de ratificación/revocación R105 permanecen inalterados.
- `apps/api/app/routes/assistant_affect_lab.py`: endpoints POST `/assistant/affect-lab/source/confirm`, POST `/ratify`, GET `/own`, POST `/revoke`. Bearer/JTI y consulta de membresía y persona adulta; esquema de petición `extra=forbid`; respuestas minimizadas; ni guardianes ni otros miembros ni owner acceden a consentimiento privado.
- `apps/api/app/main.py`: router montado, pero **todas** las rutas exigen simultáneamente `APP_ENV ∈ {test,local,dev,development}` y `DOMI_AFFECT_R106_HTTP_LAB_ENABLED=true`, o devuelven 404. Ni family-pilot, family-live, staging ni production pueden habilitarlas por accidente.
- `tests/test_domi_r106_affect_http_lab.py`: clientes HTTP autenticados y SQLite desechable, pruebas positivas y adversarias de acceso, consentimiento, revocación, propietario distinto, control de edad y bloqueo de entorno.
- No escribe memorias automáticamente, no ejecuta acciones, no revela recuerdos en respuesta API, no llama Anthropic ni altera `/assistant/chat`. El resultado no acredita expresión emocional subjetiva.

## Ejecución automatizada
- GitHub Actions [run 44015416405](https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/44015416405), job `affect-lab-http-offline`: SUCCESS; **50 passed, 160 warnings, 0 failures**. Los avisos no se confunden con errores bloqueantes, pero deben clasificarse en QA posterior.
- Suite: `test_domi_r106_affect_http_lab.py`, `test_domi_r105_affective_memory_bridge.py`, `test_domi_r104_micr_affect_kernel.py`, `test_domi_memory_identity_http.py`. Regresiones con datos exclusivamente sintéticos y flags externos deshabilitados.
- R105 previo: run 44012795788, 53 PASS tras corregir migración 288. No repetir su trabajo ni trasladar pruebas sintéticas como certificación de producción.

## Cuatro frentes unidos
1. Documental: contrato MICR 02A y 02M preservado, consentimiento para affect separado de confirmación factual; fuente histórica DFLD5.4 no es runtime familiar.
2. Implementación: rutas de laboratorio aisladas, firma autenticada, un solo sujeto adulto, fail-closed con solicitudes maliciosas, ledger mínimo.
3. Causal: persistencia y priorización afectiva verificadas offline R104/R105; R106 valida ciclo de control HTTP, no eficacia de LLM sobre conversación real. ABLATION_ON/OFF en proveedor Anthropic sigue pendiente.
4. Seguridad: ningún permiso en TV compartida, bloqueo por hogar, edad y sujeto; HTTP tests PASS. **PostgreSQL/Neon RLS y ruta real de datos familiares todavía no certificados**.

## Roadmap de gates y bloqueo específico siguiente
- G0 fuentes MICR: PARTIAL, inventario original no exhaustivo.
- G1 donante MICR_AFFECTIVE_SELF: PARTIAL, no copia original verificada.
- G2 receptor afectivo: PASS laboratorio SQLite/HTTP, NO_CHAT.
- G3 ablación causal: PASS sólo sintético R104/R105; Anthropic real y contrafactual conversacional OPEN.
- G4 longitudinal: PASS reapertura de DB SQLite, no cambio de dispositivo físico.
- G5 privacidad: PASS HTTP en escenarios R106, Postgres/Neon NO_CERTIFIED.
- G6 aceptación del propietario y despliegue: OPEN / NO_GO.
- Próxima primera obligación: auditar compatibilidad y seguridad de migración 288/roles/RLS en el PostgreSQL de preproducción sin ejecutarla ni escribir datos; diseñar adaptador sólo de lectura para contexto autenticado y comparar ablation sin exponer la señal afectiva cruda a LLM externo. No activar Anthropic todavía. Antes de cualquier contacto, uso externo de API, migración remota o merge productivo, aprobación específica OWNER.

## 10 ejes canónicos (línea base histórica, no reestimada)
| Eje | Avance | Estado del R106 |
| --- | ---: | --- |
| D01 Personal | 45% | Consentimiento personal vía HTTP laboratorio |
| D02 Familiar | 45% | Sin modificación del runtime familiar |
| D03 Desarrollo y afectividad | 25% | R106 API de consentimiento PASS |
| D04 Federado | 45% | Sin modificación |
| D05 Multisuperficie | 45% | Sin QA físico |
| D06 Organizacional | 10% | Sin modificación |
| D07 DOMI–EDIS | 10% | Sin modificación |
| D08 Legado | 10% | Sin modificación |
| D09 Comercial | 25% | Sin modificación |
| D10 MICR ciencia | 25% | Transferencia funcional; no evidencia fenomenológica |
| **TOTAL HISTÓRICO** | **28,5%** | Sin recálculo |

## Exact prompt restart
Retoma DOMI R106 desde esta bitácora y rama `domi-r97-memory-safety-isolated-20261116`. Ejecución R106 44015416405 50 PASS 160 warnings; rutas de consentimiento afectivo sólo para laboratorio y adultos autenticados, sin chat y Anthropic apagado. R105 readback SQLite y revocación PASS, R104 kernel sintético PASS. No desplegar ni migrar a Postgres, no contactar ni consumir API sin OWNER. Siguiente primera brecha: PostgreSQL/Neon migration/RLS de `288_domi_affective_memory_links.sql`; validar seguridad con análisis de roles y preparar paso de lectura al chat separado con ablation sin filtrar texto de recuerdos. Informar diez ejes y gates en cada corte, preservar diseño minimalista y voz configurable.
