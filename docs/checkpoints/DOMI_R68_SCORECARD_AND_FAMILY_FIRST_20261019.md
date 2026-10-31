# DOMI R68 — Scorecard canónico ejecutable y prioridad Family
Fecha: 2026-10-19. PR #2 borrador. Canon V2.1 Addenda 31+32.

## Evidencias y hallazgo del corte
- Security Gate R67, run 39275807968, SUCCESS para backend, web, mobile y PostgreSQL de ensayo; staging-smoke SKIPPED. R66 y R67 web PASS. NO equivale a producción utilizable.
- La pantalla /login responde HTTP 200, pero sin sesión autorizada no se puede verificar operación familiar real (chat→API→base→recarga).
- apps/web/lib/api.ts enruta peticiones de navegador por /api/proxy y las de servidor a API_BASE. Public login usa /api/public; la API_BASE por defecto es loopback 127.0.0.1:8001. La ausencia de una variable adecuada en un despliegue puede impedir comunicación server/backend; no se ha verificado el valor efectivo de producción (no inspeccionar secretos ni afirmar que ésta es la causa).
- Primer límite verificable: no existe evidencia E2E autenticada de hogar real desde despliegue observado. NO generar nuevos usuarios/datos familiares ni contratar backend por cuenta propia.
- R67 ya tiene test PASS de linaje personal acotado; persistencia real por integrante NO certificada.

## Cambios R68
- docs/governance/DOMI_CANON_10_SCORECARD_BASELINE_20261019.json commit 571e71bdfd2f107c475b0a1615293f5f07e3d15c: baseline diez ejes con puertas C10 I15 T20 E25 A30, evidencia primaria, siguientes cierres, estados family y claims.
- apps/web/tests/domi-canon-10-scorecard.test.mjs commit 9205de10df70d284a6cea2da0d951ecc4d37dd3f: verifica EXACTAMENTE 10 ejes, no omisión, denominador, pesos fijos, índice global 28,5%, claim wall.
- .github/workflows/security-gate.yml commit 459686e1dbdfec92ca806a5af7c0877ce3deeafa: ejecuta test de integridad del scorecard. CI nuevo PENDIENTE de resultado.

## Informe obligatorio de todos los ejes (% anterior → actual, delta)
D01 Personal: 45→45 (0): lineage R67 + memoria scoped. Falta DB/auth persistente.
D02 Familiar: 45→45 (0): chat y propuestas en tests. Falta E2E real desplegado.
D03 Desarrollativo: 25→25 (0): spines y arquitectura; sin afectividad funcional causal integral.
D04 Federado: 45→45 (0): router y prueba unitaria; falta federación real multiagente.
D05 Multisuperficie: 45→45 (0): P5 bounded, TV/auto real no certificado.
D06 Organizacional: 10→10 (0): diseño, sin precedentes por tenant.
D07 DOMI–EDIS: 10→10 (0): bridge rector, sin contrato/prototipo operativo.
D08 Legado: 10→10 (0): programa y consentimiento definidos, sin runtime.
D09 Titan comercial: 25→25 (0): oferta interna, falta bench/demos y aprobación.
D10 MICR ciencia: 25→25 (0): experimentos acotados, sin validación terminal.
GLOBAL 28,5→28,5 (0). No hay avance porcentual porque no se certificó ninguna puerta adicional; R68 mejora control de gobernanza.

## Ejes transversales y los 12 órganos
Identity Kernel [parcial], Constitution/Obligation Kernel [parcial], Self/Metacognition [parcial], Memory Kernel [parcial], Relational Model [parcial], Affective Runtime [sin producto causal], Epistemic/Abstention [parcial], Authority/Delegation [parcial], Presence/Voice [sin aceptación completa], Recovery/Migration [tests acotados], Multi-Surface Adapter [tests acotados], Evidence/Audit [parcial]. Los doce permanecen bajo el canon; no acreditar 100% por entregas de tests.

## Prioridad terminal, costo y seguridad
HCO Family: verificar y solucionar el primer corte de browser→autenticación→API→base→confirmación→recarga. No resolverlo con demos que parezcan persistencia real. La configuración efectiva de producción, dominio/origen API y backend dependen de acceso autorizado a proyecto y pruebas autenticadas. Render no se reactiva sin presupuesto explícito. Neon y familia real no se modifican.
Paralelo: linaje por persona debe tener almacenamiento firmado/autorizado; MI­CR afectividad funcional con ablations; Titan Bench y bridge EDIS siguen su propio carril.

## Cápsula de rehidratación
R68_STATUS=SCORECARD_TEST_ADDED_CI_UNVERIFIED
DOMI_CANON=V2_1_ADD31_ADD32
GLOBAL=28.5%
GATES=C10_I15_T20_E25_A30
FAMILY_PROD_E2E=NOT_CERTIFIED
R67_CI=SUCCESS_RUN_39275807968
PR2=DRAFT
NEON_WRITES=0
EXTERNAL_LLM_CALLS=0
NO_COSTS_AUTHORIZED=TRUE

## Exact Prompt Restart
Retoma DOMI desde R68 en PR #2 rama domi-neon-staging-pg-startup-gate-20261010. Antes de cada avance presentar LOS DIEZ EJES con porcentaje anterior/actual y delta, evidencia, bloqueo y cierre siguiente; la base es 28,5% y 10 ejes definidos en Biblia V2.1 Addendum 32. Verifica GitHub CI nuevo commit 459686e1dbdfec92ca806a5af7c0877ce3deeafa, corrige si falla. Luego abordar de verdad Family browser→login→API→DB→acción confirmada→reload; no exponer credenciales ni cambiar Render/Neon/producción sin autorización. Mantener en paralelo DSR personal, federación de agentes, multiplataforma, organizacional, bridge EDIS, legado, Titan y MICR, conforme Addendum 31. No inventar progreso.
