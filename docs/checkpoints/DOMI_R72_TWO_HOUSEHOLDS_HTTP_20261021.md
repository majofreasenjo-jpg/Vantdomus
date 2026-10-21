# DOMI R72 — Ensayo HTTP dos hogares y continuidad de sesión
Fecha 2026-10-21. PR #2 DRAFT. No merge ni despliegue.

## Verificación antecedente
R71 Security Gate 39491441035 FAILURE: web falló en un test contractual R69 obsoleto que todavía exigía isReal ? [] : [, contrario a la nueva condición dataState !== "demo". Backend, móvil y los tres jobs PostgreSQL PASS; R70/R71 web no llegaron a ejecutarse en ese run. No afirmar R71 PASS.
Se actualizó R69 a la nueva regla en commit c31b6aede34ae9e4688bf3bad56a975a121abd52.

## Aporte R72
tests/test_domi_r72_family_two_households_http.py commit c0c196ae64380b814c9205be9366383884449b3a: en SQLite efímera, credenciales sintéticas, dos cuentas y hogares independientes, DOMI propone compras sin escribir, confirma tras humano, consulta GET con sesión independiente, comprueba 403 para leer/cancelar datos de otro hogar, cancela producto y verifica nuevo GET/summary, doble confirmación idempotente. Sin red externa, sin Neon ni producción.
.github/workflows/security-gate.yml commit a3274245ace8c6cbe4a09316e2690dce3644b8f2 añade la ejecución explícita en backend.
CI R72 NO VERIFICADO al escribir este checkpoint. La prueba HTTP en el simulador no equivale a navegador físico, proveedor IA real, ni clúster PostgreSQL productivo.

## Scorecard del canon V2.1 Addenda 31–32: anterior → actual (variación)
D01 Personal 45 → 45 (0), identidad personal DB/autenticada pendiente.
D02 Familiar 45 → 45 (0), R72 aún no acreditado; browser→API→DB→móvil de producción pendiente.
D03 Desarrollativo 25 → 25 (0), afectividad causal y memoria longitudinal integrada pendiente.
D04 Federado 45 → 45 (0), enrutamiento multia­gente/proveedor real pendiente.
D05 Multidispositivo 45 → 45 (0), TV/auto y estado persistente físico completo pendiente.
D06 Organizacional 10 → 10 (0), memoria institucional autorizada pendiente.
D07 DOMI-EDIS 10 → 10 (0), bridge ejecutable pendiente.
D08 Legado 10 → 10 (0), consentimiento premortem y runtime pendiente.
D09 Titan 25 → 25 (0), benchmarks OEM pendientes.
D10 MICR/Ciencia 25 → 25 (0), pruebas científicas integrales y falsadores pendientes.
GLOBAL: 28,5 → 28,5 (0). No elevar por añadir test.
12 órganos: Identity parcial; Constitution/Obligations parcial; Self/Metacognition parcial; Memory parcial; Relational parcial; Affective funcional causal pendiente; Epistemic/Abstention parcial; Authority/Delegation parcial; Presence/Voice parcial; Recovery/Migration bounded; MultiSurface bounded; Evidence/Audit parcial.
Revisar controles transversales: privacidad, consentimientos, authority != memory, cero claims conciencia, tenant isolation, test no-network. No outreach ni gastos.

## Cápsula
R72_STATUS=TWO_HOUSEHOLD_HTTP_TEST_COMMITTED_CI_PENDING
R71_LAST_CI=FAIL_39491441035_R69_STALE_ASSERTION
FAMILY_E2E_PHYSICAL=NO
PROD_DEPLOY=NO
NEON=UNCHANGED
RENDER=UNCHANGED
CANON=V2.1_ADD31_ADD32
GLOBAL=28.5%

## Exact Prompt Restart
Retoma DOMI R72 PR #2 branch domi-neon-staging-pg-startup-gate-20261010. Verifica GitHub Security Gate del HEAD más reciente (post a3274245ace8c6cbe4a09316e2690dce3644b8f2) y corrige fallos. Si R72 falla, inspeccionar logs del job backend y las APIs con exactitud: estado 403/404, client lifecycle, entorno sintético, sin degradar aislamiento; si R69/R71 web fallan actualizar el test legítimamente. Luego entregar un piloto family verificable browser→login→session→API→DB→reload→móvil solo en entorno aprobado; no reactivar gastos/Neon/prod sin autorización. En todo avance reportar diez ejes canónicos con % anterior/actual/Δ y el estado de los 12 órganos.