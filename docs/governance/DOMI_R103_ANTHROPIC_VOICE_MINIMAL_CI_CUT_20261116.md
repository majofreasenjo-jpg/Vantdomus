# DOMI R103 — Corte verificado Anthropic + voz + continuidad
Fecha de corte: 2026-11-16. Rama aislada `domi-r97-memory-safety-isolated-20261116`.
Autoridad: Biblia Rectora DOMI V2.1, R100 donante MICR afectivo, R101 transferencia y UI minimalista.
Status: CI_OFFLINE_PASS, NO_REAL_ANTHROPIC_CALL, NO_MERGE, NO_DEPLOY, NO_EXTERNAL_SPEND.

## Evidencia de implementación
- `apps/api/app/assistant/providers/anthropic_provider.py`: adaptador Claude Messages para respuestas y propuestas, separado de `anthropic_shadow.py` (R55 sintético vencido). Fail-closed por flags explícitos, key backend, modelo validado; propone sin ejecutar, respuestas estructuradas validadas por gateway.
- `apps/api/app/assistant/gateway.py`: `select_provider` reconoce modo `anthropic`, no rompe `openai` ni `mock`; el perfil `family-pilot` conserva jaula.
- `tests/security/test_domi_r102_anthropic_family.py`: casos de ausencia de flags, perfil pilot, opt-in, respuesta sin herramienta, propuesta validada, formatos adversarios y tamaño.
- `apps/web/lib/voice.ts`: selector `voiceURI` entre voces españolas anunciadas por navegador, no conjetura género; TTS local sin enviar voz a Anthropic.
- `apps/web/app/components/domi/DomiChat.tsx`: botón de reproducción de última respuesta, control temporal de voz y prueba auditiva, dentro del panel conversacional bajo demanda. No almacena preferencia entre usuarios ni toca memorias.
- La portada R98 ya es conversación-primero y oculta tarjetas en la vista principal. El panel detallado sigue disponible. Los artefactos visuales actuales son una esfera; la figura femenina histórica aún requiere localizar su fuente original.

## Ejecución CI objetiva
GitHub Actions run `44003613825`:
https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/44003613825
- `anthropic-offline`: SUCCESS (pytest seguridad Anthropic + gateway + voz; flags externos desactivados, clave vacía).
- `voice-and-interface-typecheck`: SUCCESS (npm ci, TypeScript `tsc --noEmit`, tests de memoria longitudinal y continuidad multisuperficie).
- No prueba clave vigente, facturación, calidad lingüística real, voz disponible en cada dispositivo, servidor desplegado o transferencia afectiva MICR.
- Se requiere nueva clave válida en secreto del backend: captura anterior mostraba clave `DOMI-ANTHROPIC-TEST` vencida 2026-11-15. No copiarla a repositorios, frontend ni mensajes.
- Como todavía no se ha establecido un límite externo de gasto y consentimiento específico de uso de datos familiares, mantener `ASSISTANT_EXTERNAL_CALLS_ALLOWED=0` y `DOMI_ANTHROPIC_FAMILY_OPT_IN=0`.

## Obligaciones pendientes prioritarias
1. No desplegar: completar clasificación/consentimiento del dato familiar transmitido a Anthropic, presupuestos/limites de gasto y prueba live sintética explícitamente autorizada.
2. Recuperar la anfitriona femenina original del piloto para evitar reemplazarla a ciegas con una esfera o imagen nueva.
3. Persistencia de voz por persona autenticada y preferencia entre dispositivos, con controles de TV compartida. Elección de voz no determina ni cambia identidad.
4. Recuperar material MICR-02M/02A/02G y donantes DFLD, cerrar recibo de transferencia y motor afectivo causal aislado; preservar efecto nulo NO_AFFECT.
5. Validar memoria personal, rehidratación, privacidad de dos hogares y continuidad real en PC/móvil/TV.
6. QA real en dispositivos y aceptación owner antes de merge/deploy.

## 10 ejes canónicos (porcentajes históricos no reestimados)
D01 Personal 45%; D02 Familiar 45%; D03 Desarrollo 25%; D04 Federado 45%;
D05 Multisuperficie 45%; D06 Organizaciones 10%; D07 DOMI/EDIS 10%; D08 Legado 10%;
D09 Comercial 25%; D10 MICR/ciencia 25%. Total histórico 28.5%.
El CI verde de R103 no altera estos porcentajes sin una matriz de obligaciones verificadas.

## R101 gates
R101-01 inventario donante: PARTIAL.
R101-02 recibos transferencia: OPEN.
R101-03 UI minimal: PARTIAL (R98 frontend + R103 voz, falta visual histórica y prueba de accesibilidad).
R101-04 motor afectivo: OPEN.
R101-05 causalidad: OPEN.
R101-06 memoria/privacidad/longitudinal: PARTIAL (tests heredados, no revalidación con afecto).
R101-07 owner: OPEN.
R101-08 release: NO_GO.

## Exact prompt restart
Retoma DOMI R103 en rama domi-r97-memory-safety-isolated-20261116. CI offline run 44003613825 doble SUCCESS. Anthropic adapter en apps/api/app/assistant/providers/anthropic_provider.py y gateway, pero flags off/no clave operativa/no despliegue. Selector browser voz en apps/web/lib/voice.ts y DomiChat.tsx PASS typecheck. R98 conversación-primero ya existía, no rehacer. Recuperar imagen original de anfitriona femenina antes de alterar orb, persistencia voz por usuario y terminar transferencia MICR selectiva afectiva causal con memoria segura. Reportar 10 ejes y gates; no confundir afecto funcional con subjetividad.
