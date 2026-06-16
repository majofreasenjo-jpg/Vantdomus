# Runbook operativo cliente PUMA

## Objetivo

Dejar VantDomus listo para operar una demo/puesta en marcha del cliente PUMA desde el dashboard CEO, con foco en continuidad de abastecimiento, estaciones, despacho de camiones cisterna, flotas B2B, tiendas de conveniencia, HSE y cumplimiento.

## Como levantar el modo PUMA

1. Abrir `/ceo`.
2. Presionar `Operar Cliente PUMA`.
3. Validar que el tablero muestre:
   - Gerencia Retail Estaciones.
   - Gerencia Supply & Terminales.
   - Gerencia B2B y Flotas.
   - Gerencia Tiendas y Conveniencia.
   - Gerencia HSE y Cumplimiento.
4. Revisar la franja `PUMA CONTROL OPERACIONAL: RED, DESPACHO Y HSE`.
5. Entrar a cualquier unidad operacional para revisar dashboard, tareas, finanzas, HSE y bitacora.

## Datos minimos para operar con cliente real

- Estaciones y terminales activos.
- Responsables por unidad.
- SLA de reposicion por estacion.
- Inventario y ventas por combustible.
- Turnos y alertas HSE.
- Eventos de derrame, near miss, fatiga o cierre temporal.
- Costos logisticos y ventas B2B/retail.
- Evidencia de auditoria SEC, surtidores y cumplimiento.

## Riesgos que el tablero debe detectar

- Stockout o quiebre de abastecimiento.
- Retraso de camiones cisterna.
- Sobrecarga de turnos y fatiga.
- Incidentes HSE o derrames.
- Merma operacional.
- Desviacion de margen por estacion o contrato B2B.
- Falta de evidencia para auditoria o cumplimiento.

## Flujo comercial recomendado

1. Mostrar vista CEO y P&L.
2. Mostrar red PUMA por gerencias.
3. Abrir `Despacho Camiones Cisterna`, que queda como cuello de botella demo.
4. Mostrar impacto de tareas vencidas y alertas HSE.
5. Registrar una evidencia en bitacora.
6. Crear link firmado para auditoria.
7. Mostrar seguridad: MFA, sesiones, CSRF, auditoria, retencion y exportacion de datos.

## Estado de esta version

- Seed PUMA disponible desde `/ceo`.
- Preset visual `puma` disponible en la taxonomia web.
- Ingresos y costos demo cargados para que el P&L no quede vacio.
- KPI y madurez operacional adaptados a combustibles, retail, B2B, despacho y HSE.

## Alineacion Luxen

La propuesta publica de Luxen enfatiza IA de precision, ciberseguridad, monitoreo continuo, automatizacion inteligente y consultoria tecnologica aplicada a necesidades reales del negocio.

Para PUMA, VantDomus debe traducir eso en:

- Recomendaciones basadas en datos reales de estaciones, despacho, HSE y margen.
- Trazabilidad de cada alerta: causa, impacto, evidencia y responsable.
- Seguridad de datos del cliente: MFA, sesiones, auditoria, retencion y exportacion.
- Monitoreo continuo de stockout, SLA, derrames, fatiga, cumplimiento SEC y costos logisticos.
- Simulacion ejecutiva con impacto financiero y operacional.

Detalle completo: `docs/LUXEN_ALIGNMENT_FOR_VANTDOMUS.md`.
