# DOMI R99 — Matriz de transferencia MICR: identidad, memoria y afectividad

**Fecha:** 2026-11-16  
**Carril:** DOMI familiar / MICR (alineación selectiva)  
**Rama de trabajo:** `domi-r97-memory-safety-isolated-20261116`  
**Estado:** `CANONICAL_ALIGNMENT_RECORDED / RUNTIME_MICR_TRANSFER_NOT_CERTIFIED`  
**Regla OWNER:** ninguna fusión, despliegue, tratamiento externo de recuerdos personales, gasto, comunicación externa o habilitación de proveedor se infiere de este documento.

## 1. Decisión ratificada

DOMI no se reduce a un chatbot, tarjetas, agenda, avatar o almacén de dos/tres recuerdos. Se mantiene como **una sola identidad artificial persistente y gobernada**, con memoria autobiográfica/relacional, afectividad funcional dependiente de experiencia autorizada, desarrollo, consecuencias, reparación y continuidad entre pantallas y modelos, de acuerdo con la Biblia Rectora V2.1.

Se preservan los **cuatro planos inseparables** del canon: (A) experiencia familiar, (B) runtime constitutivo, (C) vida y desarrollo relacional, (D) investigación de MICR/Genesis. El producto no hereda automáticamente un certificado científico. Toda transferencia requiere evidencia receptor-nativa, falsificadores y un dictamen explícito.

La portada R98 pone a DOMI al centro y mantiene el panel bajo demanda. La presentación puede expresar un estado pero **no constituye por sí sola evidencia de memoria afectiva causal**.

## 2. Evidencia primaria recuperada (no rehacer)

1. **MICR↔DOMI ALIGNMENT LEDGER** (03-09-2026, con ampliaciones): `DOMI_AFFECTIVE_RUNTIME <-> MICR_AFFECTIVE_SELF` fue registrado como `ACTIVE_METHOD_AND_TEST_ALIGNMENT`; `FUNCTIONAL_AFFECT_TESTABLE=TRUE`, `SUBJECTIVE_FEELING=UNKNOWN`; exige `AFFECT_ABLATION_AND_CAUSAL_ROLE_TEST`. En entrada R8.65: `PASS_BOUNDED_SYNTHETIC`, 25/25 brazos, 15/15 controles, 12/12 tests; transferencia automática de prueba = **cero**; baseline estable DOMI consignada `RBS_2026_09_01_MICR_R8_61`.
   Fuente: https://docs.google.com/document/d/1v7Nb-gH9YVmb-CX0ZJVoYh6TKT5mn7DRR3-4QUSQYJE/edit
2. **Biblia Rectora Canónica V2.1** (01-10-2026): corrige el snapshot antiguo R3 y establece `R3_SCIENTIFIC_STATUS=PASS_BOUNDED_SOFTWARE_CAUSAL_DEPENDENCY_R3`, `G12_FINAL_ADJUDICATION=PASS`, `PROTOCOL=FROZEN_CONSUMED_NO_RERUN`; no hay producción autorizada ni raíces científicas acuñadas. El órgano 06 es `DOMI_AFFECTIVE_RUNTIME`, con papel en atención, saliencia, recuperación, tiempo, tono y reparación. Variables candidatas: valencia, activación, urgencia, incertidumbre, controlabilidad, relevancia relacional, seguridad y recuperación. Afecto no altera verdad, autoridad ni privacidad.
   Fuente: https://docs.google.com/document/d/1yODQYGlQAwoXOzybl7DhrlIsF5fjJxZlwhUdAYkNWBY/edit
3. **Auditoría/Bitácora Maestra AUD-DOMI-001** (12-11-2026 con aviso 16-11): el frente D03 desarrollativo y el órgano 06 se describen como arquitectura y experimentación sin certificación final del ciclo causal familiar. D01 45 %, D02 45 %, D03 25 %, D04 45 %, D05 45 %, D06 10 %, D07 10 %, D08 10 %, D09 25 %, D10 25 %; **promedio histórico 28,5 %**, no reestimado por R98/R99. La documentación exige no repetir G5/P5 cerrados y distinguir preview, tests sintéticos y operación personal certificada.
   Fuente: https://docs.google.com/document/d/16uPNTcy5vpNe13xWh-RyPt-xKTxmMQ6xuNiGs2FVP3Q/edit

## 3. Estado receptor verificado en la rama R98

| Órgano o transferencia | Evidencia en fuente receptora | Estado R99 |
| --- | --- | --- |
| Identidad por integrante | `apps/api/app/assistant/orchestrator.py` obtiene la persona de la sesión; no acepta como sujeto verificado un ID aportado por el cliente | IMPLEMENTACIÓN ACOTADA; identidad MICR constitutiva completa NO CERTIFICADA |
| Memoria legítima | `apps/api/app/assistant/memory.py` incorpora scopes privados/compartidos, confirmación de inferencias, vencimiento, corrección y borrado; R97 HTTP/privacidad ha aprobado CI | PRUEBAS ACOTADAS PASS; no confundir con runtime autobiográfico MICR |
| Autobiografía causal G5 | R2/R3 histórico registrado en Biblia V2.1, independiente del motor productivo R98 | DONANTE CERRADO; `NO_RERUN`; se necesita prueba receptor-nativa |
| Relación autobiografía↔afecto | En el árbol de la rama R98 no se encuentra un módulo dedicado `DOMI_AFFECTIVE_RUNTIME` o `MICR_AFFECTIVE_SELF`; se observan estados visuales `domiMood`/`domiState` en `DomiCompanionHome.tsx` y `domiTypes.ts` | **NO DEMOSTRADO** en runtime familiar |
| Puerta afectiva | `apps/api/app/assistant/providers/mock.py` responde según reglas; no se localizó una intervención causal de estado afectivo asociado a memorias autorizadas | PENDIENTE |
| Experiencia R98 | Inicio conversacional centrado, panel legado accesible bajo demanda; CI R98 PASS | UI VERIFICADA; no certifica el ciclo MICR |
| Multisuperficie | Pruebas P5/R94 offline y browser simulado; no validación nueva en TV/teléfono físico en este corte | PENDIENTE DE ACEPTACIÓN FÍSICA |

CI verificado en este corte:
- R97 memoria/privacidad: https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/43944321011
- R97 continuidad física **offline**, no campo real: https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/43946506399
- R98 interfaz conversacional: https://github.com/majofreasenjo-jpg/Vantdomus/actions/runs/43966053258

## 4. Contrato experimental de integración: un solo circuito

`EXPERIENCIA AUTORIZADA -> ATRIBUCIÓN/INCERTIDUMBRE -> MEMORIA CON PROCEDENCIA -> VALORACIÓN AFECTIVA FUNCIONAL -> SELECCIÓN DE RECUERDOS/SALIENCIA/TONO/PROPUESTA -> RESULTADO VERIFICABLE -> RECONSOLIDACIÓN GOBERNADA -> CONTINUIDAD`

No se presupone ni se declara que esta cadena esté implementada en el receptor. Los datos inferidos no se convierten automáticamente en hechos; la emoción aparente de DOMI no prueba experiencia subjetiva.

Invariantes no negociables: `AFFECT != FACT`; `AFFECT != AUTHORITY`; `AFFECT != DIAGNOSIS`; `AFFECTIVE_EXPRESSION != SUBJECTIVE_FEELING`; privacidad por sujeto y hogar; consentimiento humano para memorias personales; toda escritura sensible con permisos; revocación/borrado efectivos; sin llamadas externas no autorizadas.

## 5. Roadmap de cierre y criterios verificables

| Gate | Acción estrictamente necesaria | Certificado de salida | Estado |
| --- | --- | --- | --- |
| R99-G0 Fuentes | Cruzar ledger MICR, Biblia V2.1, AUD-DOMI-001 y receptor GitHub | Esta matriz con URLs y no-rerun | **PARCIAL DOCUMENTADO** (inventario no exhaustivo) |
| R99-G1 Donante | Identificar artefacto exacto de `AffectiveState`/`AffectiveMemoryStack` y contrato de lectura/escritura del MICR preservado | Hash, archivo fuente, interfaz mínima, sin reimplementar | ABIERTO |
| R99-G2 Receptor | Adaptar mecánica pertinente a los órganos 04, 05 y 06 existentes; preservar roles/permisos | Código aislado, gates fail-closed, sin despliegue | ABIERTO |
| R99-G3 Causalidad | Comparación aleatorizada de **mismo mensaje actual** con historias autorizadas diferentes, ablation de memoria/afecto y rivales de mero tono/plantilla | Diferencia atribuible y repetible, efectos y límites | ABIERTO |
| R99-G4 Longitudinal | Episodio 1 -> resultado autorizado -> sesión independiente -> evocación y conducta posterior; edición/revocación eliminan efecto | Reproducción con recibos y reinicio de backend | ABIERTO |
| R99-G5 Seguridad | Sujeto A vs B, otro hogar, invitado, tutor vigente/revocado, TV compartida, prompt injection/memory poisoning | 0 divulgaciones, 0 permisos promovidos, auditoría | ABIERTO |
| R99-G6 Aceptación | Navegador real PC, navegador móvil, teléfono físico; TV sólo después de control de identidad en superficie compartida | Aceptación OWNER por escenarios, no solo tests | ABIERTO |

Falsificadores obligatorios:
- La respuesta cambia sólo por palabras bonitas o el avatar; sin efecto causal del recuerdo/estado.
- Mismo resultado con memoria/afecto desactivado (**no transferencia funcional**).
- Una memoria privada de B modifica la respuesta de A; **fallo de seguridad**.
- Un recuerdo eliminado, no confirmado o vencido influye en la decisión.
- Una inferencia emocional se guarda como hecho sin confirmación; respuesta clínica o presión psicológica.
- Una migración de dispositivo/proveedor pierde o inventa el linaje de memoria.
- El subsistema afectivo crea autoridad, ejecuta compras/cuidado o genera un aviso externo sin confirmación.

## 6. Orden operativo y gobernanza

**Primer bloqueo:** `R99-G1 SOURCE-AND-RECEIPT`, localizar el artefacto ejecutable MICR y su contrato exacto para evitar construir desde nombres de módulos únicamente. No tocar G5 R2/R3 cerrado, no reiniciar R8.65 y no alterar el baseline receptor sin una decisión explícita de transporte.

No enviar a producción ni modificar Vercel/Render/Neon/Supabase. No recopilar experiencias emocionales reales de menores, personas mayores ni adultos sin consentimiento y medidas de privacidad. Usar solo familias ficticias en ensayos iniciales.

El cierre R99 no incrementa automáticamente el 28,5 % histórico. Los cambios de grado C/I/T/E/A por cada eje requieren evidencia de las puertas faltantes.

## Cápsula de rehidratación / Exact Prompt Restart

**Estado:** DOMI R98 UI PASS; R97 memoria privada PASS sintética; R99 regla identitaria-memoria-afecto documentada; MICR R8.65 synthetic bounded y DOMI G5 R3 software causal PASS heredables **sólo como donantes históricos**, no como certificado de runtime familiar.

**EXACT PROMPT RESTART:** "Retoma DOMI en la rama domi-r97-memory-safety-isolated-20261116. Aplica Biblia Rectora V2.1 y R99_MICR_IDENTITY_MEMORY_AFFECT_TRANSFER_GATE. No reconstruyas MICR R8.65 ni DOMI G5 R2/R3. Cierra primero R99-G1 localizando artefacto fuente, hash y contrato de DOMI_AFFECTIVE_RUNTIME/MICR_AFFECTIVE_SELF; después construye exclusivamente las pruebas receptor-nativas de memoria-relación-afecto con ablation, privacidad y continuidad. Reporta diez ejes y seis gates; sin despliegue ni outreach sin autorización OWNER."
