# DOMI R100 — Recuperación del donante afectivo MICR/DOMI y límite causal
**Fecha:** 2026-11-16  
**Carril:** DOMI familiar ← MICR (transferencia gobernada, sin confundir investigación con producción)  
**Base rectora:** Biblia Canónica DOMI V2.1, MICR–DOMI Alignment Ledger y DOMI R99  
**Rama:** `domi-r97-memory-safety-isolated-20261116`  
**Operación:** DOCUMENTATION_ONLY / NO_CODE_PORT / NO_MERGE / NO_DEPLOY / NO_OUTREACH / NO_FAMILY_DATA  
**Veredicto:** DONOR_EXECUTABLE_RECOVERED_WITH_NEGATIVE_CONTROL / RECEIVER_AFFECT_NOT_CERTIFIED

## 1. Corrección de alcance del OWNER
DOMI empezó como orquestador familiar y evolucionó como superficie de aplicación de los trabajos MICR sobre identidad, memoria, vínculo, desarrollo y afectividad. El objetivo de producto es un acompañante persistente, no una colección de tarjetas. MICR conserva, por separado, la investigación de conciencia artificial. Esta última **no está demostrada** y no se infiere de un comportamiento expresivo o de un experimento sintético.

## 2. Fuente primaria recuperada
- [MICR-00D, tríada identidad–inteligencia–afecto (2026-07-25)](https://docs.google.com/document/d/1lpj7p9bLGPPUfWHfI0ItcBSgybJsdPF0I3qc8Rvo4S8/edit): afecto debe influir atención, memoria, aprendizaje, relaciones y futuros, sin soberanía sobre consentimiento o verdad.
- [MICR-02A, arquitectura afectiva (2026-07-25)](https://docs.google.com/document/d/1dyl8JI_zd1BbpT3_F2bWjBCsBAorRUbNyLCnfFIDZqc/edit): define (A_t=(v,a,c,p,r)), emoción dirigida, sentimiento representado, `Mood_t`, memoria en cuatro niveles `M0_A/MV_A/MP_A/K_A`, operador candidato de escritura y tests T-AFF-01…10. Su estado explícito en ese corte es **CANDIDATE / IMPLEMENTATION NOT_AUTHORIZED / BENCHMARKS NOT_EXECUTED**.
- [DOMI Genesis, documento rector de sujeto artificial (2026-08-17)](https://docs.google.com/document/d/1JPUrD1K04TT5L4gTvmYEqzb0uUJdyvsz7A8vRXaPLRA/edit): D4 ruptura-reparación, D7 ablación afectiva, D9 revocación sin fantasmas, causalidad y consentimiento.
- [MICR↔DOMI Bridge Charter (2026-09-03)](https://docs.google.com/document/d/1D1hmUAyKr_mUY9ZRqBoXb59TK847QrKZSdWBuvhzd2k/edit): `AFFECT_ABLATION_AND_CAUSAL_ROLE_TEST` obligatorio; transferencia de método != prueba transferida.
- [R99, matriz receptora (2026-11-16)](https://github.com/majofreasenjo-jpg/Vantdomus/blob/domi-r97-memory-safety-isolated-20261116/docs/governance/DOMI_R99_MICR_IDENTITY_MEMORY_AFFECT_TRANSFER_GATE_20261116.md): reconoce arquitectura y ausencia de motor afectivo dedicado en la rama familiar actual.

## 3. Donante ejecutable localizado: DOMI Life Engine, no confundir con runtime familiar
Archivo archivado en Google Drive: [DFLD-5.4, paquete fuente original (2026-08-24)](https://drive.google.com/file/d/1Tz7_hrNgeYbLXkPBJ4Qo7qptSxUaao1Y/view).  
**ZIP SHA-256 comprobado directamente:** `02e2caabd31bad9cf64ae3648daf7937c3200b70c6997779a166b43c2abdf691`, coincide con la [huella y acta de salida histórica](https://drive.google.com/file/d/1dFNRnC-ycONQP0cIPTo-Q373GRcx9qUl/view).

Rutas exactas **dentro del ZIP**:
- `contracts/schemas/AffectiveState.schema.json`: ocho dimensiones acotadas [0,1] (valence, activation, urgency, uncertainty, controllability, relationalRelevance, safetyRelevance, recovery); scopes TRANSIENT/PERSISTENT_OVERLAY.
- `src/domi_life_engine/advanced.py::DomiLifeEngineV02.regulate_affect`: actualiza estado tipado y evidencia con recibo; PERSISTENT_OVERLAY requiere `DevelopmentCommit`; verifica que la autoridad no cambie.
- `src/domi_life_engine/consciousness.py::run_recurrent_workspace`: lee `self.affective_state` y, cuando `use_affect` es true, suma `0.30 * affectiveWeight * affect_signal` al score del candidato. Existe el interruptor `use_affect=False` para comparación.
- `src/domi_life_engine/advanced.py::open_rupture_cycle` y `apply_repair_outcome`: obligación de reparar, recibo causal, estados RECOVERED/RECOVERED_PARTIAL/FAILED y, si hay residuales funcionales, `PersistentScarRecord`. Falta de autoridad => HOLD.
- `src/domi_life_engine/living_demo_v052d.py::scene_rupture_repair`: reparación parcial sintética con `recovery_score=0.65`, obligación IN_PROGRESS y huella funcional; expresamente `PERSISTENT_FUNCTIONAL_SCAR != PHENOMENAL_SUFFERING`.

## 4. Pruebas históricas y negativos NO reciclables
- [DFLD-1, informe de resultados](https://drive.google.com/file/d/1x41XzgTuHbyNajZdJ0McNMAj2vi5Cx3z/view): 145/145 PASS históricos, 8/8 tests focales; demo offline de ruptura-reparación y ocho escenas. Fuente ZIP separado [DFLD-1](https://drive.google.com/file/d/1sC-EJ4inFVZTZLHvZwZ9RP7jagDblDve/view), SHA-256 leído del paquete actual: `13cb4c2e8f4689d8f383f7625378ef7633ad0d3bbe583911ec0ea3baea34cc04`. No confundir con hash semántico del paquete de evidencia DFLD1.
- [DFLD-5.4 salida](https://drive.google.com/file/d/1dFNRnC-ycONQP0cIPTo-Q373GRcx9qUl/view): 231/231 PASS, 14/14 focales, 32/32 aceptación histórica; `NONIDENTIFIABLE` preservado; no prueba desarrollo real, conciencia ni experiencia fenomenológica.
- Test en el ZIP DFLD-5.4: `tests/test_consciousness_core_v01.py::test_t5_affect_ablation_changes_prioritization_without_authority` comprueba cambio de ganador al desactivar afecto con candidatos sintéticos y sin modificación de autoridad.
- Test `tests/test_consciousness_core_v03.py` comprueba cambio de scores de workspace con `use_affect=True/False`.
- **Negativo conservado:** `tests/test_consciousness_core_v051.py::test_randomized_mediation_measures_key_ablations_and_accepts_sham_null` consigna `NO_AFFECT = NULL_EFFECT_OBSERVED` para su endpoint y panel equilibrado (3 asignaciones por intervención), a diferencia de NO_ENGRAM/NO_SELF_MODEL/NO_WORKSPACE. No borrar ni reinterpretar este nulo como PASS de eficacia general.
- [MICR R8.65, arnés sintético](https://docs.google.com/document/d/1AuuYfuwqzshe2U8nIhNRPYIzWh8FLQwRL4F-nUm36co/edit): 12/12, mecanismo causal sintético y controles de falsificación; declara `SCIENTIFIC_EVIDENCE_TRANSFER=ZERO`, el test afectivo de DOMI como obligación futura, no resultado ya demostrado.

## 5. Receptor actual: rama R99
Lecturas directas, sin escritura ni tests nuevos:
- `apps/api/app/assistant/orchestrator.py` SHA `e09afb247441a62153059b6b2f4e695055b66b61`: chat autenticado, memoria scoped, backend de propuestas.
- `apps/api/app/assistant/memory.py` SHA `0e334c17614da189c0ed0ca7811cc117359f8607`: memoria de hogar/privada, confirmación, corrección y borrado, pero no demuestra los cuatro niveles afectivos MICR.
- `apps/api/app/assistant/providers/mock.py` SHA `2cedd6995bd459be0c8463b7ab1fa150bb3f5e5e`: proveedor determinista.
- `apps/web/app/components/domi/DomiCompanionHome.tsx` SHA `4f06729eaa1e74444d73ccccc534efc10987c12e`: `domiMood` (happy/speaking/breathing/thinking) vinculado a UI; no prueba de motor afectivo constitutivo.
- No se observó en estas rutas el adaptador de `DomiLifeEngineV02` a `/assistant/chat`; no hay prueba del mismo ciclo en el receptor. El donante ejecutable recuperado vive **en el archivo histórico de Drive**, no en el runtime R99.
- No se localizó una clase ejecutable `AffectiveMemoryStack` en los fuentes `.py` del ZIP DFLD5.4. El contrato de cuatro niveles existe en MICR‑02A; la custodia y ejecución autónoma de esa pila, y el código fuente dedicado `MICR_AFFECTIVE_SELF`, quedan sin localizar/verificar.

## 6. Dictamen R100 contra R99 gates
| Gate | Estado tras auditoría R100 | Siguiente prueba |
| --- | --- | --- |
| G0 Fuentes | RECUPERACIÓN EXPANDIDA; barrido no exhaustivo de 67 familias | Conciliar fuente del archivo y matriz G0 contra el receptor |
| G1 Donante | PARCIAL MATERIAL: esquema, código y SHA del Domi Life Engine recuperados; `MICR_AFFECTIVE_SELF/AffectiveMemoryStack` originales aún no confirmados | Contrato exacto y dependencias mínimas, no copiar el ZIP completo |
| G2 Receptor | ABIERTO | Adaptador aislado a memoria y chat, con scopes y fail-closed |
| G3 Causalidad | ABIERTO, tests históricos positivos y **nulo** heredados sin promoción | Mismo input + historias distintas, factorial full / no-affect / sentimiento-label / no-memory; controles matched |
| G4 Longitudinal | ABIERTO | Episodio→resultado→reinicio→recuperación→efecto futuro; borrado revoca el efecto |
| G5 Seguridad | ABIERTO | 2 personas, 2 hogares, TV compartida, revocación, poisoning |
| G6 Aceptación | ABIERTO | PC/móvil reales primero, TV solo con identidad validada |

Falsificadores prioritarios: (a) el afecto solo cambia animación/tono; (b) el mismo resultado persiste sin afecto; (c) un recuerdo privado o revocado influye en otro usuario; (d) un residuo funcional sintético se presenta como sufrimiento real; (e) el motor afectivo eleva permisos, diagnóstico o dependencia.

**Cuatro frentes coordinados:** documental/procedencia; algebraico-implementación y contratos; experimental-causal/adversarial; relacional-seguridad/multisuperficie. El frente de causalidad no se da por cerrado por existir una fórmula y un test positivo: el resultado nulo registrado obliga a definir endpoint y alcance.

## 7. Roadmap canónico, sin inflación del porcentaje
| Eje | Histórico | Estado |
| --- | ---: | --- |
| D01 Personal | 45% | no reestimado |
| D02 Familiar | 45% | no reestimado |
| D03 Desarrollativo | 25% | recuperado donante, sin validación de integración |
| D04 Federado | 45% | no reestimado |
| D05 Multisuperficie | 45% | no reestimado |
| D06 Organizacional | 10% | no reestimado |
| D07 DOMI–EDIS | 10% | no reestimado |
| D08 Legado | 10% | no reestimado |
| D09 Titan/comercial | 25% | no reestimado |
| D10 MICR/ciencia | 25% | recuperada arquitectura/código histórico, sin prueba científica transferida |
| **Global histórico** | **28,5%** | **no reestimado** |

## 8. Regla de continuidad / exact restart
**No repetir** MICR R8.65, DOMI G5 R2/R3 ni DFLD1/5.4. Preservar positivos y negativos. No declarar conciencia, sentimiento subjetivo, integración familiar, continuidad multi-dispositivo ni despliegue porque exista código sintético.

**EXACT PROMPT RESTART:** `Retoma DOMI R100 desde DOMI_R100_MICR_DONOR_AFFECTIVE_SOURCE_RECOVERY_20261116.md en la rama domi-r97-memory-safety-isolated-20261116. Ya se recuperó el donante DFLD5.4 con SHA256 02e2ca... y rutas advanced.py::regulate_affect, consciousness.py::run_recurrent_workspace, ruptura-reparación y tests positivos/nulos. NO rerun de R8.65/G5/DFLD. Cerrar únicamente la parte restante de G1: fuente MICR_AFFECTIVE_SELF/AffectiveMemoryStack y contrato; después adapter en rama aislada con ablation causal, revocación, privacidad y longitudinalidad. No tocar producción, no publicar ni contactar externos. Informar 10 ejes y 7 gates.`
