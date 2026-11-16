# DOMI R101 — Canon integral de transferencia MICR y anfitriona minimalista
Fecha: 2026-11-16 | Rama aislada: `domi-r97-memory-safety-isolated-20261116`
Estado: CONTRATO DE INTEGRACIÓN Y MATRIZ DE BRECHAS; NO_IMPLICA_IMPLEMENTACIÓN NI DESPLIEGUE.
Autoridad: Biblia Rectora DOMI V2.1 + MICR↔DOMI Bridge Charter (2026-09-03) + R99/R100 + ratificación del OWNER 2026-11-16.
Sin merge a main, producción, gasto, correo ni importación de recuerdos familiares reales.

## Decisión de producto vinculante
Recuperar de MICR todo lo **pertinente, trazable, compatible y seguro**, no sólo memoria o apariencia emocional, para desarrollar un acompañante con identidad longitudinal propia, memoria por persona y relación, afectividad funcional, continuidad de experiencias y permanencia entre superficies, sin confundir productos con pruebas de subjetividad.
Reutilizar el piloto DOMI existente como hospedador y anfitriona femenina central. Su presentación debe ser premium, conversacional, calmada, minimalista, accesible y contextual: **sin tarjetas por defecto**; los artefactos de calendario, compras, estudios, etc. aparecen sólo a petición o por propuesta contextual permitida, con posibilidad de cerrar. El usuario puede abrir explícitamente el panel avanzado heredado. Fondo gradual dawn/day/sunset/night, ajuste al dispositivo y accesibilidad; el estado visual jamás simula certeza sobre emociones sentidas ni recuerdos inexistentes.
El aspecto exacto de la anfitriona femenina se decide contrastando los activos visuales existentes, sin sustituir identidad visual del piloto por una esfera distinta sin autorización.

## A. Fuentes primarias reabiertas
- MICR-02M formalización completa de memoria, candidato: https://docs.google.com/document/d/1DyDdvQpvEbS6tAETTyqEASfUWRyG1824rUQ6yn1dZl0/edit
- MICR-02A emoción, sentimiento representado, regulación: https://docs.google.com/document/d/1dyl8JI_zd1BbpT3_F2bWjBCsBAorRUbNyLCnfFIDZqc/edit
- Puente bidireccional MICR↔DOMI, transferencias con recibo y falsificador: https://docs.google.com/document/d/1D1hmUAyKr_mUY9ZRqBoXb59TK847QrKZSdWBuvhzd2k/edit
- R100 donante ejecutable DFLD5.4, incluidos hallazgos negativos: docs/governance/DOMI_R100_MICR_DONOR_AFFECTIVE_SOURCE_RECOVERY_20261116.md
- Biblia DOMI V2.1: https://docs.google.com/document/d/1yODQYGlQAwoXOzybl7DhrlIsF5fjJxZlwhUdAYkNWBY/edit

## B. Cruce obligatorio de capacidades MICR (no confundir especificación con runtime)
| Capa MICR | Receptor DOMI existente | Delta no acreditado |
| --- | --- | --- |
| Identidad/linaje autónomo | `domiLongitudinalConversationSpine.mjs`, `orchestrator.py`, órgano 01 | Reconstitución de la misma identidad a través de servicios, modelos y superficies reales |
| Memoria M0/MV/MP/K_next, clases H/A/X/R/P/F/S/Aff | `apps/api/app/assistant/memory.py`, órgano 04, pruebas G5 históricas | Semántica multicapa gobernada end-to-end, procedencia/veracidad y prospectiva aplicadas a producto |
| Engramas/replay/reconsolidación | MICR-02G y prototipos DFLD | Verificar portabilidad sin memoria revocada reconstituida; no convertir embedding en memoria vivida |
| Afecto basal/emoción dirigida/Mood/regulación | DFLD5.4 `AffectiveState`, `regulate_affect`, `run_recurrent_workspace`; órgano 06 | Adaptador aislado de estado afectivo ↔ memoria seleccionable ↔ respuesta/decisión de `/assistant/chat` |
| Relación, compromiso, daño, reparación | `open_rupture_cycle`, `apply_repair_outcome` DFLD, órgano 05 | Receipts de reparación longitudinal por persona, con reconocimiento humano y revocación |
| Modelo de sí/metacognición | DFLD/órgano 03 y protocolos MICR | Explicaciones causales fieles, no autobiografía inventada ni introspección fingida |
| Agencia/obligaciones/consentimiento | Orquestador propone; acciones sensibles requieren confirmación | Afecto nunca concede permisos ni acciones automáticas; custodiar K_next sin autoescritura sensible |
| Continuidad/proveedor/migración | `domiMultiSurfaceContinuity.mjs`, G4/P5 y R97 previos | Rehidratación de estado completo en PC/móvil/TV con recibos; test real end-to-end |
| Epistemología y falsificadores | protocolos DFLD, MICR R8.65, órgano 07 | Resultados receptores con controles equiparados, negative seals y abstención |
| Conciencia artificial | MICR investigación independiente | NO transferir como afirmación de capacidad. `PHENOMENAL_CONSCIOUSNESS=UNKNOWN` |

Frontera de memoria MICR-02M: `ACCESSIBLE != AUTHORIZED_FOR_USE`; `RETRIEVED != REMEMBERED_AS_LIVED`. Promoción a MP requiere ratificación, atribución y autorización; memoria importada no es experiencia del agente; revocación, rectificación y contradicción prevalecen sobre saliencia afectiva.
Frontera afectiva MICR-02A: modula atención, latencia, priorización, consulta, tono, futuro y reparación; **jamás** reescribe hechos, diagnóstico, autoridad, derechos ni privacidad. Estados expresados NO prueban sentimientos subjetivos.

## C. Superficies: una identidad, distintas proyecciones
- `PERSONAL_MOBILE`: anfitriona centrada, conversación y voz, una sola acción contextual a la vez, funciones reveladas bajo demanda, texto grande y navegación táctil.
- `PERSONAL_DESKTOP`: anfitriona centrada, espacio amplio para conversación y artefactos temporales; panel avanzado explícito y reversible.
- `SHARED_TV`: modo invitado/compartido por defecto; nunca mostrar memoria privada o afectividad inferida atribuible a alguien sin sesión individual autorizada; voz y controles a distancia, legibilidad.
- `OTHER` (auto/wearable): fail-closed y affordances propias; no intentar ocupar toda la pantalla ni distraer en conducción.
- La hora/cielo afectan el **tema** y no alteran la identidad, historial, inferencia emocional o permisos.
- El anfitrión femenino es representación visual/voz configurable, **no** un sujeto distinto para cada plataforma.

## D. Inventario receptor leído en rama (rutas exactas)
- `apps/web/lib/domiLongitudinalConversationSpine.mjs`: memoria longitudinal, scopes, surface classes y test claims.
- `apps/web/lib/domiMultiSurfaceContinuity.mjs`: perfiles PERSONAL_DESKTOP, PERSONAL_MOBILE, SHARED_TV, OTHER; SHARED_TV sin transferencia de turnos y sólo scopes compartidos autorizados.
- `apps/web/app/components/domi/DomiCompanionHome.tsx`: ya tiene pestaña `inicio` con `panel` por demanda, pero conserva `StatusCards` y mini tarjetas en inicio móvil; `domiMood` opera principalmente en la presentación.
- `apps/web/app/components/DomiPremiumHome.tsx`: experiencia de alta carga visual con nodos y tarjetas; no reemplazar al receptor actual con esta página.
- `apps/api/app/assistant/orchestrator.py`: contexto por persona en hogar y acciones propose-first, sin emisión autónoma de operaciones.
- Artefactos visuales en `apps/web/public/assistant/domi/` y componentes Orb/Face: verificar antes de decidir conservación de figura femenina.
Ninguna de estas presencias de fuente demuestra que la capa MICR afectiva funcione en el piloto desplegado.

## E. Roadmap de entrega, secuencia obligatoria
**R101-01 INVENTARIO:** localizar donantes MICR afectivo, engramático, memoria, identidad/linaje, self, relación y migración, con version, hash, contrato y veredicto de transferencia individual; prohibido copiar el prototipo completo a ciegas.
**R101-02 ALINEACIÓN:** emitir `MICR_TO_DOMI_BRIDGE_RECEIPT` por órgano: dependencia, consentimiento, invasión de privacidad, falsificador, rol receptor, rollback y adjudicación.
**R101-03 UI MINIMAL:** conservar portada actual y anfitriona, retirar tarjetas por defecto en inicio móvil/desktop, mantener panel heredado bajo demanda y accesibilidad; pruebas de tres viewports y keyboard, sin despliegue.
**R101-04 MOTOR:** adaptador afectivo aislado y apagado por defecto en runtime de prueba, con observabilidad y sin mutar autoridad.
**R101-05 CAUSAL:** factorial mismatched/matched, `affect-on/off`, `memory-on/off`, `history-A/B`, shams; mismo presente; registrar también efectos nulos como el histórico NO_AFFECT.
**R101-06 LONGITUDINAL/PRIVACIDAD:** persistencia autorizada, revocación, dos personas, dos hogares, cambio de dispositivo/modelo, memoria corregida y guardián revocado, TV compartida; cero fugas.
**R101-07 OWNER:** prueba con el usuario solo cuando CI y seguridad estén cerrados y exista canal de consentimiento; no engañar con demo local como chat real.
**R101-08 CI/RELEASE:** gates integrales, QA visual y aceptación explícita antes de cualquier merge/deploy.
Investigación MICR/conciencia = carril independiente; tests de MICR no se convierten automáticamente en pruebas del receptor.

## F. Regla anti-bucle
No repetir R8.65, DFLD1/5.4 ni G5 R2/R3. El CI verde histórico no certifica producción ni sentimientos. Cada avance requiere 10 ejes D01–D10, 12 órganos relevantes, gates R101, hash/commit, evidencia nueva, limitaciones y primer bloqueo siguiente. Sin porcentaje de avance inflado por documentación.
Línea base: D01=45 D02=45 D03=25 D04=45 D05=45 D06=10 D07=10 D08=10 D09=25 D10=25; global histórico=28.5%.

## Exact prompt restart
"Retoma DOMI desde R101_MICR_FULL_TRANSFER_AND_MINIMAL_HOST_CANON; rama domi-r97-memory-safety-isolated-20261116. MICR es donante selectivo para identidad, memoria multicapa, afectividad funcional, relato/autobiografía, relación, reparación, epistemología y continuidad. DOMI existente y anfitriona femenina son el receptor; UI premium mínima sin tarjetas permanentes, artefactos sólo bajo demanda y tema por hora; móvil/desktop/TV conservan una sola identidad, nunca scopes privados en TV compartida. No reimplementar DFLD/G5/R8.65. Cerrar inventario MICR y recibos de transferencia; luego UI y adaptador aislados con tests causales y privacidad; sin deploy ni datos reales. Reportar D01-D10 y gates por evidencia."
