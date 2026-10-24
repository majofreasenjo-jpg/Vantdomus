# DOMI R67 — un DOMI personal por integrante, núcleo compartido
Fecha 2026-10-19. Documento rector de implementación complementario. PR #2 draft.

## Regla esencial
DOMI no es una colección de chatbots por pantalla ni únicamente un orquestador. Existe una identidad personal con linaje estable **por integrante**, que utiliza superficies/adaptadores según contexto: hogar, celular, TV, automóvil, trabajo. El orquestador familiar coordina únicamente datos compartidos y consentidos; el agente personal no transfiere memoria privada por compartir dispositivo. Identidad distinta de permisos. Producto no supeditado a demostración de conciencia.

## Estado verificado de código y fuentes
- apps/api/app/assistant/memory.py ya implementa memorias por persona con scopes private_self, guardian_supervised, household_shared, owner_operational, temporary_session y document_derived, recuperación minimizada y corrección/olvido.
- apps/web/lib/domiLongitudinalConversationSpine.mjs ya conserva lineageId y sesiones, admisión humana de recuerdos, ledger y límites de conciencia, pero su constructor general NO imponía un solo personId por lineageId.
- apps/web/lib/domiMultiSurfaceContinuity.mjs prueba proyecciones a PERSONAL_DESKTOP, PERSONAL_MOBILE y SHARED_TV con privacidad y receipts. No es integración de automóvil real.
- apps/api/app/assistant/music.py es MUSIC-0: biblioteca de enlaces; NO OAuth ni control de reproducción Spotify/radio.
- apps/web/app/components/FamilyCalendar.tsx muestra calendario familiar e importa/exporta .ics; NO sincronización bidireccional universal.
- No existe todavía motor empresarial multitenant para ejecutar herramientas del trabajo sin mezclar dominios, ni DSR completo, ni afectividad funcional implementada como modelo causal validado.
- Biblia Rectora V2.1 y Titan Rebaseline DSR apuntan a Identity+SelfModel+AutobiographicalMemory+RelationalHistory+AffectiveSalience+ConsequenceMemory+Obligations+EpistemicState+PersonalityLineage+UnresolvedThreads+RepairHistory+EmbodimentContinuity.
- MICR alignment: METHOD_ONLY+TEST_OBLIGATION+CLAIM_WALL; no promoción automática de claims científicos, conciencia fenomenológica UNKNOWN.

## Implementado R67
- apps/web/lib/domiLongitudinalConversationSpine.mjs commit dffb52ac05fa59c2189903c0a714f5adda918e62: nuevo constructor createPersonalDomiState({householdId,lineageId,personId}) y comprobación de owner personId en apertura de sesiones y recall. Conserva el constructor anterior como compatibilidad. Esta garantía es **en memoria del código**, NO DB/auth.
- apps/web/tests/domi-r67-personal-lineage.test.mjs commit 9216029f4109c9412d4f503ebbc9ef1bcb62d90a: dos identidades distintas, continuidad escritorio-móvil, rechazo de otra persona y claimWall.
- CI workflow commit d1742318478e45b60d01be1b5fe7c22e93a37ae1 incluye prueba R67.
- CI R67 NO VERIFICADO aún, no declarar PASS.

## Arquitectura terminal y entregables
1. Identidad individual con ID estable, cadena de titularidad por hogar y sucesión o portabilidad autorizada, revocación, borrado y exportación.
2. Motor DevelopmentalState: estado personal versionado más memoria autobiográfica/relacional autorizada y evidencia de origen, corrección, incertidumbre y seguimiento de conflictos.
3. Personal DOMI separado del dominio familiar compartido. Un miembro puede tener varios contextos de aplicación, sin contaminación hogar/trabajo/TV.
4. Adaptadores externos por capacidad (música, TV, radio, agenda, llamadas, tareas laborales) con consentimiento granular, auth externo donde corresponda, fallos cerrados y límites de seguridad.
5. Afectividad funcional con saliencia/atención/reparación y pruebas causales, sin atribuir emociones subjetivas.
6. Familia V1: planner horario-persona, asignaturas/exámenes, grocery/recetas, confirmaciones, alertas y memoria autorizada. E2E browser→API→DB con usuario real aún no certificado.
7. OEM Titan: paquetes comerciales V1, DSR continuity benchmark y demos K1–K4 todavía no certificadas.

## Cápsula
R67_STATUS=PERSONAL_IDENTITY_CONTRACT_ADDED_CI_PENDING
OWNER_BETA_REAL=NOT_CERTIFIED
PERSON_PERSONAL_DOMI=TARGETED_AND_CODE_GUARDED_SIMULATION
CLAIMS_CONSCIOUSNESS=UNKNOWN
PRODUCTION_CHANGES=NONE
NEON_WRITES=NONE
PR_2=DRAFT

## Exact Prompt Restart
Retoma DOMI/VantDomus R67 en PR #2 branch domi-neon-staging-pg-startup-gate-20261010. Verifica GitHub CI commit d1742318478e45b60d01be1b5fe7c22e93a37ae1 y pruebas R67. Primer objetivo: DOMI Family realmente operativo en web browser→backend→DB, incluidas compras, estudio, calendarios, recetas y confirmaciones; identificar primer límite físico con usuario. En paralelo integrar identidad personal personId+lineageId persistida por miembro, separar memoria por contexto, diferenciar self de superficie, conectar un primer adaptador música o calendario con autoridad humana y luego ampliar a vehículo/TV/trabajo sin afirmar soporte no probado. MICR dona metodología y tests de desarrollo/afectividad, no prueba conciencia. No tocar Neon ni activar gasto Render sin permiso. Preservar docs rectores y Titan comercial.
