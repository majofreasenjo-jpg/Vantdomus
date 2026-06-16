# Roadmap de Mejora

## Fase 1 - Higiene del repositorio

- Mantener `apps/api`, `apps/web`, `apps/mobile` y `apps/marketing` como superficie activa.
- Mover experimentos antiguos a `legacy`.
- Eliminar del control de versiones bases locales, bundles generados, caches y tokens.
- Crear un README principal con arranque de cada app.

## Fase 2 - Backend estable

- Reemplazar migraciones manuales por Alembic.
- Definir PostgreSQL como base de produccion y SQLite como modo demo/local.
- Separar healthcheck, readiness y migraciones.
- Agregar tests para permisos, scores y dashboard CEO.

## Fase 3 - Agente IA auditable

- Separar prompts, tools y servicio OpenAI.
- Registrar cada tool call con usuario, unidad, payload, resultado y timestamp.
- Confirmar acciones sensibles antes de ejecutar scripts o generar documentos.
- Reemplazar paths absolutos por configuracion.

## Fase 4 - Producto B2B demostrable

- Crear demo limpia: seed empresa, dashboard CEO, causa raiz, conversacion IA y accion correctiva.
- Pulir copy ejecutivo: evitar terminos de prototipo en UI productiva.
- Exportar reporte ejecutivo PDF/PPTX desde dashboard.

## Fase 5 - Comercializacion

- Unificar marca VantDomus / VantUnit / Luxen.
- Definir pricing, casos de uso y verticales prioritarias.
- Preparar pitch demo de 3 minutos.
