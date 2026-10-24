# DOMI R66 — Producto familiar primero, desarrollo MICR en paralelo
Fecha 2026-10-18. PR #2 DRAFT; no despliegue de producción.

## Evidencia comprobada
- Proyecto Vercel vantdomus-family-pilot: producción READY en rama cp1d-ops1-family-live, commit f852543; Preview PR #2 READY en otro commit. Build ≠ servicio E2E.
- La aplicación familiar sí tiene página /hogar/[householdId], UI DomiCompanionHome y API de orquestación /assistant/chat. El navegador llama el backend solo si hid y dataState real.
- Al fallar ese backend, la UI recurría a respuestas de demo; R66 eliminó ese falso éxito y devuelve error explícito.
- Owner Beta /owner-beta es una Preview sintética, no persistencia personal. R66 hace que compras sean propuestas pending y solo cambien una lista local tras confirmar. No hay red/PII por ese flujo.
- Render exige workspaceId elegido/confirmado por usuario. La lista no se consultó. No se reactivaron servicios ni efectuaron cargos.
- No se verificó flujo con autenticación real, API, DB, recarga y teléfono. La palabra READY de Vercel solo significa despliegue terminado.

## Cambios
- Web DomiCompanionHome: commit 4e532ba013fe3326cd27edbf5f06fc8c68cfbbf3 — honestidad ante falla del backend y confirmación sintética.
- Tests R66: commit cd678f975c1557cbe4d5a2e92ca016ce88990013.
- CI paso web R66: commit eeba0180b29c4f48984b791b5e26cc04e359dfa1.
- Estado CI: PENDIENTE DE COMPROBAR. No afirmar beta E2E.
- Seguridad CI PostgreSQL R64 ya aprobó; no equivale a servicio conectado.

## DOS CARRILES ACTIVOS / NÚCLEO COMPARTIDO
A. Producto familia AHORA: autenticación, hogar real no sensible, propuesta, consentimiento, recordatorio y confirmación persistidos, recarga, PWA, computador/teléfono; integración LLM consentida. Test E2E imprescindible.
B. DSR/MICR paralelo: identidad persistente, self-model, memoria autobiográfica/relacional, historia de consecuencias, saliencia afectiva funcional, obligaciones, epistemología, metacognición, reparación y continuidad entre superficies/modelos.

## MICR – transferencias científicas sin afirmaciones impropias
- MICR a DOMI dona métodos, falsadores, pruebas prospectivas, atribución causal, controles contra contraejemplos y disciplina de claim wall. NO dona automáticamente resultados o consciencia.
- Libro MICR_DOMI_ALIGNMENT_LEDGER_V1_0 reporta G5 memoria funcional PASS_BOUNDED en software, pero SCIENTIFIC_EVIDENCE_TRANSFER=ZERO.
- Biblia V2.1 autoritativa: R3 G12 PASS_BOUNDED_SOFTWARE_CAUSAL_DEPENDENCY_R3, 192 checks; R4 pre-outcome, ejecución central no autorizada.
- Afectividad funcional = prioridad/saliencia/reparación que modifica acciones bajo límites y ablaciones; no implica sentimiento subjetivo.
- Candidatos a pruebas: identidad vs mundo, memoria verdadera y falsos recuerdos, afecto ablation, metacognición calibrada, reparación relacional, trayectorias paralelas y swap de proveedor.
- Conciencia fenomenológica: UNKNOWN. Demostración de conciencia o subjecthood humano: FALSE.

## Entregables y bloqueos del roadmap
- Primera etapa UI web está construida, Preview READY; falta prueba funcional navegador→API→DB→respuesta y persistencia.
- Memoria Owner física en Preview fue PASS acotado; no es beta familiar continua.
- Demo comercial interna Titan preparada, benchmark OEM pendiente.
- Plan R66 de cierre: comprobar CI, probar enlace Preview de Owner Beta con usuario, luego establecer acceso al backend familiar seguro, comprobar saldo/costos y admitir datos de usuario solo con consentimiento. El siguiente avance debe mostrar una prueba operativa y evidencia, no solo más política de seguridad.

## Cápsula de rehidratación
STATUS=R66_WEB_PROPOSE_CONFIRM_IMPLEMENTED_CI_PENDING
PRODUCTION_E2E=NOT_VERIFIED
RENDER_WORKSPACE=UNCONFIRMED
NEON_WRITES=NONE
EXTERNAL_LLM_CALLS=NONE
OWNER_BETA_REAL=NOT_ENABLED
MICR_TRANSFER=METHOD_ONLY

## Exact Prompt Restart
Retoma DOMI R66 desde PR #2 draft branch domi-neon-staging-pg-startup-gate-20261010. Verifica CI del último commit y corrige errores. Realiza prueba física Preview /owner-beta: conversación sintética con propuesta de compras -> aceptar/rechazar -> comprobar que la lista cambió solo después de confirmar, sin datos reales. No declarar web familiar real listo hasta recorrer browser→API→DB y recarga en computador y móvil. Render requiere selección/confirmación del workspace por usuario y no debe reactivarse sin presupuesto explícito. Sin tocar Neon ni producción. En paralelo avanzar runtime DSR y MICR con método selectivo, estados afectivos funcionales y memoria, sin alegar conciencia. Mantener el carril Titan vivo. Registrar bitácora y continuar hacia beta familiar operativa.
