# Arquitectura Recomendada

## Vision

VantDomus Improved debe funcionar como una plataforma de inteligencia operacional multi-industria. La misma base de datos y los mismos contratos de API pueden representar hogares, equipos, faenas, plantas, areas corporativas o proyectos EPC, cambiando la taxonomia visible y las reglas de interpretacion.

## Capas

1. API Core
   - Autenticacion y permisos.
   - Unidades operativas (`households`).
   - Personas, tareas, eventos, finanzas, alertas y snapshots.
   - Calculo de scores y agregacion ejecutiva.

2. Intelligence Layer
   - Reglas deterministicas para scores.
   - Recomendaciones operativas.
   - Agente IA con herramientas auditables.
   - Historial de acciones y trazabilidad.

3. Web Panel
   - Operacion diaria por unidad.
   - CEO dashboard para agregacion de gerencias.
   - Drill-down desde P&L/riesgo hacia causa operacional.

4. Mobile App
   - Captura y consulta rapida.
   - Tareas, personas, finanzas y chat operacional.

5. Commercial / Marketing
   - Sitio comercial separado del producto.
   - Propuestas, pricing y material de venta.

## Riesgos actuales detectados

- Algunos archivos mezclan prototipo, demo y produccion.
- La compatibilidad SQLite/Postgres necesita formalizarse.
- Hay paths absolutos a `D:\...` dentro de herramientas del asistente.
- El agente IA mezcla prompt, tools, HTTP OpenAI, fallback y ejecucion de scripts en un solo archivo.
- Ciertos textos muestran problemas de encoding heredados.

## Principios para la version mejorada

- Nada de escrituras ocultas en endpoints de diagnostico.
- Ningun secreto, token o ID real versionado.
- Demo reproducible desde scripts explicitos.
- Acciones IA registradas y auditables.
- Lenguaje ejecutivo sobrio para B2B.
- Legacy conservado, pero fuera del camino principal.
